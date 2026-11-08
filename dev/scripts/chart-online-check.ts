// The online page checked in a browser (make chart-online-check; docs/designs/design-chart-online-2026-11-08.md, How
// the release is checked, 3): `bun chart-online-check.ts PORT DIR`, headless Chromium listening on PORT (the target
// starts it), DIR holding four runs the target made: `long`, the test data's bars alone online, its last 100 K-lines
// one at a time, and `long-whole`, the same bars drawn whole; `short`, its first 60 online begun with one K-line, and
// `short-whole`. For each engine's page (chart.html, chart-d3fc.html), over the DevTools protocol:
// - each online page's replay paused and run to its end, an update a frame (so d3fc draws again at each, and tv's
//   chart begun with one K-line updates in place after it is drawn again at its second), with no exception and no
//   fault; the engine's page data then (CHART, and LAYERS for tv) the batch's of the K-lines so far, and the same as
//   the page drawn whole, both made by this browser; at the latest 400 K-lines, its screenshot, legend and all, the
//   whole page's;
// - the view: the long page opened at its latest K-lines follows a K-line appended; opened at its first 100 K-lines,
//   it holds;
// - an update's mean cost, reported: the online component's step and the engine's UPDATE (REPLAY.cost), and that with
//   its frame drawn.
// A line each; exit 1 at the end where any check failed, each failure named.

const [portArg, dir] = process.argv.slice(2);
if (portArg === undefined || dir === undefined) {
  console.error("chart-online-check: bun chart-online-check.ts PORT DIR");
  process.exit(1);
}
const port = Number(portArg);

type Reply = { readonly result?: { readonly result?: { readonly value?: unknown }; readonly data?: string } };
type Tab = {
  readonly evaluate: (expression: string) => Promise<unknown>;
  readonly shot: () => Promise<string | null>;
  readonly errors: readonly string[];
  readonly close: () => Promise<void>;
};

const frames =
  "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))";
// the page data as the page holds them, hashed where they are
const hashed = `(async () => {
  const text = JSON.stringify({ chart: globalThis.CHART, layers: globalThis.LAYERS ?? null });
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
})()`;

// a page in a tab of its own, at a fixed size, once its engine has drawn
const open = async (url: string): Promise<Tab> => {
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })
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
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error")
      errors.push(String(d.params.args?.[0]?.value ?? "a console error"));
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
        (await Bun.sleep(250), ready(left - 1));
  if (!(await ready(240))) errors.push("no handle CHART_UI: the engine did not draw");
  return {
    evaluate,
    shot: async () => (await send("Page.captureScreenshot", { format: "png" })).result?.data ?? null,
    errors,
    close: async () => {
      ws.close();
      await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
    },
  };
};

const sha = (png: string | null): string | null =>
  png === null ? null : new Bun.CryptoHasher("sha256").update(Buffer.from(png, "base64")).digest("hex");
// the K-lines in view, as the page gives their address: time=FROM-TO
const inView = async (t: Tab): Promise<readonly number[]> => {
  const h = String(await t.evaluate("CHART_UI.here()"));
  const m = /time=([0-9]+)-([0-9]+)/.exec(h);
  return m ? [Number(m[1]), Number(m[2])] : [];
};
// at the latest 400 K-lines, settled: its page data's hash and its screenshot's
const latest = async (t: Tab, name: string) => {
  await t.evaluate("CHART_UI.latest()");
  await t.evaluate(frames);
  await Bun.sleep(500);
  const png = await t.shot();
  if (png !== null) await Bun.write(`${dir}/${name}.png`, Buffer.from(png, "base64"));
  return { data: String(await t.evaluate(hashed)), shot: sha(png) };
};

// an online page beside its whole: its replay run to the end, its page data and screenshot against the whole page's
const pair = async (online: string, whole: string, name: string): Promise<readonly string[]> => {
  const t = await open(`file://${dir}/${online}`);
  await t.evaluate("REPLAY.pause()");
  const t0 = performance.now();
  const ran = Number(
    await t.evaluate(`(async () => {
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      const go = async (n) => (REPLAY.step() ? (await frame(), go(n + 1)) : n);
      return go(0);
    })()`),
  );
  const framed = (performance.now() - t0) / Math.max(1, ran);
  await t.evaluate(frames);
  const left = Number(await t.evaluate("REPLAY.left()"));
  const fault = await t.evaluate("REPLAY.fault()");
  const same = await t.evaluate(
    "JSON.stringify({ chart: globalThis.CHART, layers: globalThis.LAYERS ?? null }) === REPLAY.whole()",
  );
  const cost = Number(await t.evaluate("REPLAY.cost()"));
  const a = await latest(t, `${name}-online`);
  const errorsOnline = [...t.errors];
  await t.close();
  const w = await open(`file://${dir}/${whole}`);
  const b = await latest(w, `${name}-whole`);
  const errorsWhole = [...w.errors];
  await w.close();
  console.log(
    `chart-online-check: ${name}: ${ran} updates, an update a frame; ${cost.toFixed(2)} ms the step and UPDATE, ${framed.toFixed(2)} ms with its frame`,
  );
  return [
    ...errorsOnline.map((e) => `${name}, online: ${e}`),
    ...errorsWhole.map((e) => `${name}, whole: ${e}`),
    ...(left !== 0 ? [`${name}: ${left} updates left`] : []),
    ...(fault !== null ? [`${name}: the replay's fault: ${fault}`] : []),
    ...(same !== true ? [`${name}: the engine's page data are not the batch's of the K-lines so far`] : []),
    ...(a.data !== b.data ? [`${name}: the page data are not the whole page's`] : []),
    ...(a.shot === null || a.shot !== b.shot
      ? [`${name}: the screenshot is not the whole page's (${name}-*.png)`]
      : []),
  ];
};

// the view after one K-line appended: followed from the latest, held from the first 100
const view = async (page: string, name: string): Promise<readonly string[]> => {
  const check = async (address: string, follows: boolean): Promise<readonly string[]> => {
    const t = await open(`file://${dir}/${page}#${address}`);
    await t.evaluate("REPLAY.pause()");
    await t.evaluate(frames);
    const before = await inView(t);
    // the next K-line appended: run to the end of the one forming, then the first of the next
    const appended = await t.evaluate(`(() => {
      const last = () => CHART_UI.here();
      const was = REPLAY.left();
      const step = () => REPLAY.step();
      while (REPLAY.left() % 4 !== 0) step();
      return step() && REPLAY.left() === was - (was % 4) - 1;
    })()`);
    await t.evaluate(frames);
    await Bun.sleep(300);
    const after = await inView(t);
    const errors = [...t.errors];
    await t.close();
    const [b0 = 0, b1 = 0] = before;
    const [a0 = 0, a1 = 0] = after;
    const ok = follows ? a1 > b1 : a0 === b0 && a1 === b1;
    return [
      ...errors.map((e) => `${name} at ${address}: ${e}`),
      ...(appended !== true ? [`${name} at ${address}: no K-line appended`] : []),
      ...(ok
        ? []
        : [
            `${name} at ${address}: the view ${before.join("-")} then ${after.join("-")}, ${follows ? "not followed" : "not held"}`,
          ]),
    ];
  };
  return [...(await check("latest", true)), ...(await check("range=0-100", false))];
};

const faults = await ["chart.html", "chart-d3fc.html"].reduce<Promise<readonly string[]>>(
  async (done, page) => {
    const list = await done;
    const engine = page === "chart.html" ? "tv" : "d3fc";
    const found = [
      ...(await pair(`long/${page}`, `long-whole/${page}`, `${engine} long`)),
      ...(await pair(`short/${page}`, `short-whole/${page}`, `${engine} short`)),
      ...(await view(`long/${page}`, `${engine} long`)),
    ];
    console.log(`chart-online-check: ${engine}: ${found.length === 0 ? "ok" : found.join("; ")}`);
    return [...list, ...found];
  },
  Promise.resolve([]),
);
process.exit(faults.length > 0 ? 1 : 0);
