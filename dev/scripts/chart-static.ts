// The static charts, byte for byte (make chart-static; docs/designs/design-chart-online-2026-11-08.md, How the release
// is checked, 2): `bun chart-static.ts PORT ROOT PAGE…`, headless Chromium listening on PORT (the target starts it),
// each PAGE a chart's page under ROOT (chart.html, tv; chart-d3fc.html, d3fc). Each is loaded in a tab of its own at a
// fixed size, as a reader opens it; once its engine has drawn, its page data as the page made them (CHART, and LAYERS
// for tv) are hashed in the page, and its screenshot is taken, written beside it (PAGE.png) and hashed. A line each,
// `SHA256  NAME#data` and `SHA256  NAME#shot`, NAME the page's path under ROOT; exit 1 where a page cannot be drawn,
// or throws while it loads.

const [portArg, root, ...pages] = process.argv.slice(2);
if (portArg === undefined || root === undefined || pages.length === 0) {
  console.error("chart-static: bun chart-static.ts PORT ROOT PAGE…");
  process.exit(1);
}
const port = Number(portArg);

// the page data, as the page made them, hashed where they are
const data = `(async () => {
  const text = JSON.stringify({ chart: globalThis.CHART, layers: globalThis.LAYERS ?? null });
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
})()`;
const frames = "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))";

type Reply = { readonly result?: { readonly result?: { readonly value?: unknown }; readonly data?: string } };

const shot = async (
  page: string,
): Promise<{
  readonly errors: readonly string[];
  readonly data: string | null;
  readonly png: string | null;
}> => {
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`file://${page}`)}`, {
      method: "PUT",
    })
  ).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  const errors: string[] = [];
  const pending = new Map<number, (d: Reply) => void>();
  const ids = { next: 0 };
  ws.addEventListener("message", (m) => {
    const d = JSON.parse(String(m.data));
    if (d.method === "Runtime.exceptionThrown")
      errors.push(
        String(d.params.exceptionDetails?.exception?.description ?? d.params.exceptionDetails?.text).split(
          "\n",
        )[0],
      );
    if (d.id !== undefined) pending.get(d.id)?.(d);
  });
  const send = (method: string, params: object = {}) =>
    new Promise<Reply>((r) => {
      ids.next += 1;
      pending.set(ids.next, r);
      ws.send(JSON.stringify({ id: ids.next, method, params }));
    });
  const evaluate = async (expression: string): Promise<unknown> =>
    (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result
      ?.value;
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1400,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.reload");
  const ready = async (left: number): Promise<boolean> =>
    left === 0
      ? false
      : (await evaluate("typeof CHART_UI !== 'undefined' && document.readyState === 'complete'")) === true ||
        (await Bun.sleep(500), ready(left - 1));
  const up = await ready(240);
  await Bun.sleep(1000);
  await evaluate(frames);
  const hash = up ? await evaluate(data) : null;
  const png = up ? ((await send("Page.captureScreenshot", { format: "png" })).result?.data ?? null) : null;
  ws.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
  return { errors, data: typeof hash === "string" ? hash : null, png };
};

const sha = (bytes: Uint8Array): string => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const named = (page: string): string => (page.startsWith(`${root}/`) ? page.slice(root.length + 1) : page);

const faults = await pages.reduce<Promise<readonly string[]>>(async (done, page) => {
  const list = await done;
  const r = await shot(page);
  const bytes = r.png === null ? null : Buffer.from(r.png, "base64");
  if (bytes !== null) await Bun.write(`${page}.png`, bytes);
  const name = named(page);
  if (r.data !== null) console.log(`${r.data}  ${name}#data`);
  if (bytes !== null) console.log(`${sha(bytes)}  ${name}#shot`);
  const mine = [
    ...r.errors.map((e) => `${name}: an exception: ${e}`),
    ...(r.data === null || bytes === null ? [`${name}: not drawn`] : []),
  ];
  return [...list, ...mine];
}, Promise.resolve([]));
faults.forEach((f) => console.error(`chart-static: ${f}`));
process.exit(faults.length > 0 ? 1 : 0);
