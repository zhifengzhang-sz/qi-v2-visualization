// The engines' browser scripts checked in a browser (make chart-browser-check; the review of @qi/chart, 2026-10-25,
// finding 8): `bun chart-browser-check.ts PORT PAGE…`, headless Chromium listening on PORT (the target starts it), each
// PAGE a chart's page (chart.html, tv; chart-d3fc.html, d3fc). On each, over the DevTools protocol, as a reader uses
// it: it loads with no exception; its legend shows a line for each layer apart by its name, a line for each level with
// its layers as chips, and a line of the marks with theirs; a layer hidden by its chip stays hidden through a redraw
// (REDRAW), and a layer of marks the same, where it has marks; a setting changed in the dialog (MACD's fast period)
// draws the chart again with no fault shown, the change in the engine's layers and in the legend; a click's cost, to
// its second frame, is reported. The two pages of a run give the same layers. A line a page; exit 1 at the end where any check failed, each
// failure named.

type Probe = {
  readonly layers: string;
  // the legend's names and chips against the layers': what is missing from it
  readonly missing: readonly string[];
  readonly hiddenKept: boolean;
  readonly markKept: boolean | null;
  readonly setting: string | null;
  // after the setting, MACD's layer and its legend line, by name: the change drawn
  readonly applied: boolean | null;
  // the 缠论 menu: null where it does what it should (none on a page without levels), else what went wrong
  readonly menu: string | null;
  readonly clickMs: number;
};

// what is run in the page, once its engine has given its handle
const probe = `(async () => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const ui = CHART_UI;
  const l = ui.layers();
  const names = (x) => JSON.stringify({ apart: x.apart.map((a) => a.id), levels: x.levels.map((g) => [g.level, g.items.map((i) => i.id)]) });
  // the legend against the layers: a line a layer apart by its name; a line a level, its layers its chips; a line of
  // the marks, each its chip
  const lines = [...document.querySelectorAll('#legend .lg-row')];
  const named = (n) => lines.find((r) => r.querySelector('.lg-name')?.textContent === n);
  const chips = (r) => [...(r?.querySelectorAll('.lg-chip') ?? [])].map((c) => c.textContent);
  const missing = [
    ...l.apart.filter((a) => !named(a.name)).map((a) => 'the line ' + a.name),
    ...l.levels.flatMap((g) => {
      const r = named('级别 ' + g.level);
      return r ? g.items.filter((i) => !chips(r).includes(i.name)).map((i) => '级别 ' + g.level + "'s chip " + i.name) : ['the line 级别 ' + g.level];
    }),
    ...(l.marks.length === 0 ? [] : (() => { const r = named('标注'); return r ? l.marks.filter((m) => !chips(r).includes(m.name)).map((m) => 'the mark chip ' + m.name) : ['the line 标注']; })()),
    ...(lines.length === l.apart.length + l.levels.length + (l.marks.length > 0 ? 1 : 0) ? [] : [lines.length + ' lines in all']),
  ];
  // the 缠论 menu: on a page with levels, a level's first shown layer unticked there hides the layer and its chip in
  // that level's line of the legend; ticked again after
  const menuBtn = [...document.querySelectorAll('#tools .tb')].find((b) => (b.textContent ?? '').startsWith('缠论'));
  const menu = await (async () => {
    if (l.levels.length === 0) return menuBtn ? 'a 缠论 menu on a page without levels' : null;
    if (!menuBtn) return 'no 缠论 menu';
    menuBtn.click();
    const g = ui.layers().levels[0];
    const target = g.items.find((i) => i.on);
    if (!target) return null;
    const label = [...document.querySelectorAll('.pop-menu .pm-row')]
      .find((r) => (r.querySelector('.pm-level')?.textContent ?? '') === '级别 ' + g.level)
      ?.querySelectorAll('.pm-item');
    const box = [...(label ?? [])].find((x) => x.textContent === target.name)?.querySelector('input');
    if (!box) return 'the 缠论 menu lacks ' + target.name;
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    await frame();
    const now = ui.layers().levels[0].items.find((i) => i.id === target.id);
    // the legend is made again after a change: its lines looked for afresh
    const row = [...document.querySelectorAll('#legend .lg-row')].find((r) => r.querySelector('.lg-name')?.textContent === '级别 ' + g.level);
    const chip = [...(row?.querySelectorAll('.lg-chip') ?? [])].find((c) => c.textContent === target.name);
    const off = now?.on === false && chip?.classList.contains('off') === true;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    document.querySelectorAll('.pop').forEach((p) => p.remove());
    return off ? null : 'unticking ' + target.name + ' in the 缠论 menu did not hide it and its chip';
  })();
  // a level's first layer hidden by its chip, then drawn again
  const first = l.levels[0]?.items.find((i) => i.on);
  const chip = first && [...document.querySelectorAll('.lg-chip')].find((c) => c.textContent === first.name);
  await frame();
  const t0 = performance.now();
  if (chip) chip.click();
  await frame(); await frame();
  const clickMs = Math.round(performance.now() - t0);
  REDRAW();
  const after = ui.layers().levels[0]?.items.find((i) => i.id === first?.id);
  const hiddenKept = first === undefined || after?.on === false;
  // a layer of marks hidden, then drawn again
  const mark = ui.layers().marks[0];
  if (mark) ui.showMark(mark.key, false);
  REDRAW();
  const markKept = mark ? ui.layers().marks.find((m) => m.key === mark.key)?.on === false : null;
  // a setting changed in the dialog
  const gear = document.querySelector('.tb-gear');
  gear?.click();
  const tab = [...document.querySelectorAll('.st-tab')].find((t) => t.textContent === 'MACD');
  tab?.click();
  const fast = [...document.querySelectorAll('.st-row')].find((r) => r.firstChild?.textContent === '快线')?.querySelector('input');
  const setting = fast ? (fast.value = '5', fast.dispatchEvent(new Event('change')), document.querySelector('.st-status')?.textContent ?? '') : null;
  await frame();
  // the change drawn: MACD's layer renamed by its new period, in the engine's layers and in the legend
  const macd = ui.layers().apart.find((a) => a.name.startsWith('MACD'));
  const now = [...document.querySelectorAll('#legend .lg-name')].map((n) => n.textContent);
  const applied = fast ? macd?.name.startsWith('MACD 5 ') === true && now.includes(macd.name) : null;
  return JSON.stringify({ layers: names(l), missing, hiddenKept, markKept, setting, applied, menu, clickMs });
})()`;

const [port, ...pages] = process.argv.slice(2);
if (port === undefined || pages.length === 0) {
  console.error("chart-browser-check: PORT and at least one PAGE");
  process.exit(1);
}
// the browser up, listening: thirty seconds at most
const listening = async (left: number): Promise<boolean> =>
  left > 0 &&
  ((await fetch(`http://127.0.0.1:${port}/json/version`).then(
    (r) => r.ok,
    () => false,
  )) ||
    (await Bun.sleep(500), listening(left - 1)));
if (!(await listening(60))) {
  console.error(`chart-browser-check: no browser on port ${port}`);
  process.exit(1);
}

// one page in a tab of its own: its exceptions while it loads and is probed, and the probe's result
const check = async (
  page: string,
): Promise<{ readonly errors: readonly string[]; readonly probe: Probe | null }> => {
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`file://${page}`)}`, {
      method: "PUT",
    })
  ).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  const errors: string[] = [];
  const pending = new Map<
    number,
    (d: { readonly result?: { readonly result?: { readonly value?: unknown } } }) => void
  >();
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
    new Promise<{ readonly result?: { readonly result?: { readonly value?: unknown } } }>((r) => {
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
  const raw = up ? await evaluate(probe) : null;
  ws.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
  return { errors, probe: typeof raw === "string" ? (JSON.parse(raw) as Probe) : null };
};

const results = await pages.reduce<
  Promise<
    readonly { readonly page: string; readonly faults: readonly string[]; readonly layers: string | null }[]
  >
>(async (done, page) => {
  const list = await done;
  const { errors, probe: p } = await check(page);
  const faults = [
    ...errors.map((e) => `an exception: ${e}`),
    ...(p === null ? ["no handle CHART_UI: the engine did not draw"] : []),
    ...(p !== null && p.missing.length > 0 ? [`the legend lacks ${p.missing.join(", ")}`] : []),
    ...(p !== null && !p.hiddenKept ? ["a layer hidden is shown again after a redraw"] : []),
    ...(p !== null && p.markKept === false ? ["a layer of marks hidden is shown again after a redraw"] : []),
    ...(p !== null && p.setting !== null && p.setting !== "" ? [`a setting refused: ${p.setting}`] : []),
    ...(p !== null && p.menu !== null ? [p.menu] : []),
    ...(p !== null && p.applied === false
      ? ["a setting changed in the dialog is not drawn (MACD's period)"]
      : []),
  ];
  console.log(
    `chart-browser-check: ${page}: ${faults.length === 0 ? "ok" : faults.join("; ")}` +
      (p === null ? "" : `; a click ${p.clickMs} ms${p.markKept === null ? "" : ", marks"}`),
  );
  return [...list, { page, faults, layers: p?.layers ?? null }];
}, Promise.resolve([]));

// the two pages of a run, the same layers
const pairs = results.flatMap((r) => {
  const other = results.find((o) => o.page === r.page.replace(/chart\.html$/, "chart-d3fc.html") && o !== r);
  return other && r.layers !== other.layers ? [`${r.page} and ${other.page} give other layers`] : [];
});
pairs.forEach((p) => console.log(`chart-browser-check: ${p}`));
process.exit(results.some((r) => r.faults.length > 0) || pairs.length > 0 ? 1 : 0);
