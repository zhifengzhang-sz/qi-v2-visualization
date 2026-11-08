// The page's controls (docs/designs/design-chart-lib-2026-10-24.md, Version 1.7, step 3), as TradingView lays them out,
// for both engines: the toolbar (周期, the 缠论 menu, 全部 and 最近, 成交量分布, 指标 to add an average, the settings'
// gear) and the
// legend on the chart, a pane's lines at its top left: the K-line under the pointer (else the last) with its prices,
// then a line a layer, its name in its colour and its values there; a level's line its layers as chips, each turned on
// or off by a click; the page's marks the same. A line's icons on hover: show or hide it, its settings, and an
// average's removal. The engine gives the layers, their state and the values (CHART_UI, @qi/chart's handle.ts); the
// settings are the dialog's (dialog.ts). Browser code: the DOM, and the pointer's last values.

import type { ChartUi, LayerState, Pointer } from "@qi/chart";

export type Periods = {
  readonly current: string;
  readonly pages: readonly { readonly name: string; readonly href: string }[];
};
// what the page's settings give the controls
export type Controls = {
  readonly periods: Periods | undefined;
  // a layer's section of the settings, by its name, where it has one
  readonly sectionOf: (name: string) => string | undefined;
  readonly open: (section?: string) => void;
  readonly addAverage: (period: number) => void;
  readonly removeAverage: (section: string) => void;
};

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: readonly (Node | string)[]
): HTMLElementTagNameMap[K] => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
};

// the icons, as TradingView draws them: an eye, an eye struck through, a gear, a cross, a plus
const paths: Readonly<Record<string, string>> = {
  eye: "M1 9s3-5.5 8-5.5S17 9 17 9s-3 5.5-8 5.5S1 9 1 9z M9 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  hidden: "M1 9s3-5.5 8-5.5S17 9 17 9s-3 5.5-8 5.5S1 9 1 9z M3 15 15 3",
  gear: "M9 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M9 1.5v2 M9 14.5v2 M1.5 9h2 M14.5 9h2 M3.7 3.7l1.4 1.4 M12.9 12.9l1.4 1.4 M3.7 14.3l1.4-1.4 M12.9 5.1l1.4-1.4",
  cross: "M4 4l10 10 M14 4 4 14",
  plus: "M9 3v12 M3 9h12",
};
const icon = (name: string): SVGSVGElement => {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", paths[name] ?? "");
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", "1.4");
  p.setAttribute("stroke-linecap", "round");
  svg.append(p);
  return svg;
};

const style = [
  ".tb{background:none;border:0;color:inherit;font:inherit;padding:4px 8px;border-radius:4px;cursor:pointer;display:inline-flex;align-items:center;gap:4px}",
  ".tb:hover{background:rgba(128,128,128,0.16)}",
  "select.tb{appearance:none;padding-right:8px}select.tb option{background:var(--cl-bg);color:var(--cl-ink)}",
  ".sep{width:1px;height:18px;background:rgba(128,128,128,0.3);margin:0 4px}",
  ".pop{position:fixed;z-index:30;background:var(--cl-bg);border-radius:6px;box-shadow:0 4px 18px rgba(0,0,0,0.35);padding:10px;display:flex;gap:6px;align-items:center}",
  ".pop input{width:5em;background:transparent;color:inherit;border:1px solid rgba(128,128,128,0.45);border-radius:4px;padding:3px 6px;font:inherit}",
  ".lg-pane{position:absolute;left:6px;display:flex;flex-direction:column;align-items:flex-start;font-size:12px;line-height:20px}",
  ".lg-row{display:flex;align-items:center;gap:6px;pointer-events:auto;padding:0 6px;border-radius:4px;text-shadow:0 0 3px var(--cl-bg),0 0 3px var(--cl-bg)}",
  ".lg-row:hover{background:color-mix(in srgb,var(--cl-bg) 82%,transparent)}",
  ".lg-name{font-weight:600}.lg-v{font-variant-numeric:tabular-nums;white-space:nowrap}.lg-k{opacity:0.6;margin-right:2px}",
  ".lg-off>.lg-name,.lg-off>.lg-v{opacity:0.38}",
  ".lg-icons{display:none;gap:1px}.lg-row:hover .lg-icons{display:inline-flex}",
  ".lg-icon{width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;border-radius:3px;cursor:pointer;opacity:0.7}",
  ".lg-icon:hover{opacity:1;background:rgba(128,128,128,0.25)}",
  ".lg-chip{cursor:pointer;padding:0 3px;border-radius:3px}.lg-chip:hover{background:rgba(128,128,128,0.2)}",
  ".lg-chip.off{opacity:0.35;text-decoration:line-through}",
  ".pop-menu{flex-direction:column;align-items:stretch;gap:4px;min-width:14em}",
  ".pm-row{display:flex;align-items:center;gap:10px;padding:2px 0}.pm-level{font-weight:600;min-width:3.6em}",
  ".pm-item{display:inline-flex;align-items:center;gap:3px;cursor:pointer;white-space:nowrap}",
].join("");

// the page's controls on the engine `ui`; `refresh` makes them again, after the chart was drawn again
export const controls = (ui: ChartUi, c: Controls): { readonly refresh: () => void } => {
  const tools = document.getElementById("tools");
  const legend = document.getElementById("legend");
  const bar = document.getElementById("bar");
  // the pointer's last values, so a line made again shows them
  const last: { p: Pointer } = { p: null };
  const root = document.documentElement.style;
  root.setProperty("--cl-bg", ui.colour("cl-bg"));
  root.setProperty("--cl-ink", ui.colour("cl-ink"));
  document.head.append(element("style", {}, style));

  const button = (label: string | Node, title: string, onclick: () => void): HTMLButtonElement =>
    element("button", { className: "tb", title, onclick }, label);
  const iconOf = (name: string, title: string, onclick: () => void): HTMLSpanElement =>
    element(
      "span",
      {
        className: "lg-icon",
        title,
        onclick: (ev: MouseEvent) => {
          ev.stopPropagation();
          onclick();
        },
      },
      icon(name),
    );

  // a popover at `at`, for adding an average
  const popover = (at: HTMLElement): void => {
    document.querySelectorAll(".pop").forEach((p) => {
      p.remove();
    });
    const r = at.getBoundingClientRect();
    const period = element("input", { type: "number", min: "1", step: "1", value: "60" });
    const pop = element(
      "div",
      { className: "pop" },
      "均线 周期",
      period,
      element("button", {
        className: "tb",
        textContent: "添加",
        onclick: () => {
          pop.remove();
          c.addAverage(Number(period.value));
        },
      }),
    );
    pop.style.left = `${r.left}px`;
    pop.style.top = `${r.bottom + 4}px`;
    document.body.append(pop);
    period.focus();
    setTimeout(() =>
      document.addEventListener("mousedown", function away(ev) {
        if (!pop.contains(ev.target as Node)) {
          pop.remove();
          document.removeEventListener("mousedown", away);
        }
      }),
    );
  };

  // A popover's place under its button, and its closing on a press outside it.
  const placed = (pop: HTMLElement, at: HTMLElement): void => {
    const r = at.getBoundingClientRect();
    pop.style.left = `${r.left}px`;
    pop.style.top = `${r.bottom + 4}px`;
    document.body.append(pop);
    setTimeout(() =>
      document.addEventListener("mousedown", function away(ev) {
        if (!pop.contains(ev.target as Node) && ev.target !== at) {
          pop.remove();
          document.removeEventListener("mousedown", away);
        }
      }),
    );
  };

  // The 缠论 menu: each level in its colour, its layers ticked or not; "只看" shows that level alone, "全部级别"
  // every level. It and the legend's chips set the same layers, so each shows what the other did.
  const chanlunMenu = (at: HTMLElement): void => {
    document.querySelectorAll(".pop").forEach((p) => {
      p.remove();
    });
    const pop = element("div", { className: "pop pop-menu" });
    const fill = (): void => {
      const l = ui.layers();
      const changed = (): void => {
        fill();
        legendOf();
      };
      pop.replaceChildren(
        ...l.levels.map((g) => {
          const head = element("span", { className: "pm-level" }, `级别 ${g.level}`);
          head.style.color = g.colour;
          return element(
            "div",
            { className: "pm-row" },
            head,
            ...g.items.map((it) =>
              element(
                "label",
                { className: "pm-item" },
                element("input", {
                  type: "checkbox",
                  checked: it.on,
                  onchange: (ev: Event) => {
                    ui.show(it.id, (ev.target as HTMLInputElement).checked);
                    changed();
                  },
                }),
                it.name,
              ),
            ),
            button("只看", `只看级别 ${g.level}`, () => {
              const none = g.items.every((it) => !it.on);
              l.levels.forEach((h) => {
                h.items.forEach((it) => {
                  ui.show(it.id, h.level === g.level && (none || it.on));
                });
              });
              changed();
            }),
          );
        }),
        element(
          "div",
          { className: "pm-row" },
          button("全部级别", "显示所有级别", () => {
            l.levels.forEach((h) => {
              h.items.forEach((it) => {
                if (!it.on && it.name !== "分型") ui.show(it.id, true);
              });
            });
            changed();
          }),
        ),
      );
    };
    fill();
    placed(pop, at);
  };

  const toolbar = (): void => {
    const l = ui.layers();
    const periods = c.periods;
    const period =
      periods === undefined || periods.pages.length === 0
        ? []
        : [
            element(
              "select",
              {
                className: "tb",
                title: "周期",
                onchange: (ev: Event) => {
                  location.href = `${(ev.target as HTMLSelectElement).value}#${ui.here()}`;
                },
              },
              ...periods.pages.map((p) =>
                element("option", { value: p.href, selected: p.name === periods.current }, p.name),
              ),
            ),
            element("span", { className: "sep" }),
          ];
    const choice =
      l.choice.items.length === 0
        ? []
        : [
            element("span", { className: "sep" }),
            element(
              "select",
              {
                className: "tb",
                title: l.choice.name,
                onchange: (ev: Event) => {
                  const v = Number((ev.target as HTMLSelectElement).value);
                  ui.choose(v < 0 ? null : v);
                },
              },
              element("option", { value: "-1", selected: l.choice.chosen < 0 }, `${l.choice.name}：无`),
              ...l.choice.items.map((name, i) =>
                element(
                  "option",
                  { value: String(i), selected: i === l.choice.chosen },
                  `${l.choice.name}：${name}`,
                ),
              ),
            ),
          ];
    // 缠论 first: a run of bars only has no levels, and no menu
    const chanlun =
      l.levels.length === 0
        ? []
        : (() => {
            const b = button("缠论 ▾", "缠论：级别与各层", () => chanlunMenu(b));
            return [b, element("span", { className: "sep" })];
          })();
    const add = button(icon("plus"), "添加均线", () => popover(add));
    add.append("指标");
    tools?.replaceChildren(
      ...period,
      ...chanlun,
      button("全部", "全部K线", () => ui.all()),
      button("最近", "最近 400 根K线", () => ui.latest()),
      ...choice,
      element("span", { className: "sep" }),
      add,
    );
    bar?.querySelector(".tb-gear")?.remove();
    const gear = button(icon("gear"), "设置", () => c.open());
    gear.classList.add("tb-gear");
    bar?.append(gear);
  };

  // a value's text, its name dimmed before it
  const value = (name: string, text: string, colour?: string): HTMLSpanElement => {
    const v = element("span", { className: "lg-v" }, element("span", { className: "lg-k" }, name), text);
    if (colour) v.style.color = colour;
    return v;
  };

  // a layer's line: its name in its colour, its values, its icons
  const line = (layer: LayerState, values: readonly HTMLElement[]): HTMLDivElement => {
    const section = c.sectionOf(layer.name);
    const name = element("span", { className: "lg-name" }, layer.name);
    name.style.color = layer.colour;
    return element(
      "div",
      { className: `lg-row${layer.on ? "" : " lg-off"}` },
      name,
      ...values,
      element(
        "span",
        { className: "lg-icons" },
        iconOf(layer.on ? "eye" : "hidden", layer.on ? "隐藏" : "显示", () => {
          ui.show(layer.id, !layer.on);
          legendOf();
        }),
        ...(section === undefined ? [] : [iconOf("gear", "设置", () => c.open(section))]),
        ...(section?.startsWith("averages.")
          ? [iconOf("cross", "删除", () => c.removeAverage(section))]
          : []),
      ),
    );
  };

  const legendOf = (): void => {
    const l = ui.layers();
    const p = last.p;
    const valuesOf = (id: string, colour: string): readonly HTMLElement[] =>
      (p?.values[id] ?? []).map((v) => value(v.name === id ? "" : v.name, v.text, colour));
    const candle = l.apart[0];
    const up = ui.colour("cl-up");
    const down = ui.colour("cl-down");
    const prices =
      p?.candle === null || p === null
        ? []
        : [
            element("span", { className: "lg-v" }, p.stamp),
            ...(["开", "高", "低", "收"] as const).map((k, i) =>
              value(
                k,
                [p.candle?.open, p.candle?.high, p.candle?.low, p.candle?.close][i] ?? "",
                p.candle?.up ? up : down,
              ),
            ),
          ];
    const rows = (pane: number): readonly HTMLElement[] =>
      l.apart
        .filter((a) => a.pane === pane)
        .map((a) => line(a, a === candle ? prices : valuesOf(a.id, a.colour)));
    const levels = l.levels.map((g) => {
      const head = element("span", { className: "lg-name" }, `级别 ${g.level}`);
      head.style.color = g.colour;
      const anyOn = g.items.some((it) => it.on);
      const section = c.sectionOf(g.level === 0 ? "包含" : "走势");
      return element(
        "div",
        { className: `lg-row${anyOn ? "" : " lg-off"}` },
        head,
        ...g.items.map((it) =>
          element("span", {
            className: `lg-chip${it.on ? "" : " off"}`,
            title: it.on ? `隐藏${it.name}` : `显示${it.name}`,
            textContent: it.name,
            onclick: () => {
              ui.show(it.id, !it.on);
              legendOf();
            },
          }),
        ),
        element(
          "span",
          { className: "lg-icons" },
          iconOf(anyOn ? "eye" : "hidden", anyOn ? "隐藏" : "显示", () => {
            g.items.forEach((it) => {
              ui.show(it.id, !anyOn);
            });
            legendOf();
          }),
          ...(section === undefined ? [] : [iconOf("gear", "设置", () => c.open(section))]),
        ),
      );
    });
    const marks =
      l.marks.length === 0
        ? []
        : [
            element(
              "div",
              { className: "lg-row" },
              element("span", { className: "lg-name" }, "标注"),
              ...l.marks.map((m) =>
                element("span", {
                  className: `lg-chip${m.on ? "" : " off"}`,
                  textContent: m.name,
                  onclick: () => {
                    ui.showMark(m.key, !m.on);
                    legendOf();
                  },
                }),
              ),
            ),
          ];
    const panes = ui.panes();
    const most = Math.max(0, ...l.apart.map((a) => a.pane));
    legend?.replaceChildren(
      ...Array.from({ length: most + 1 }, (_, pane) => {
        const box = element(
          "div",
          { className: "lg-pane" },
          ...rows(pane),
          ...(pane === 0 ? [...levels, ...marks] : []),
        );
        box.style.top = `${(panes[pane]?.top ?? 0) + 4}px`;
        return box;
      }),
    );
  };

  const refresh = (): void => {
    toolbar();
    ui.pointer((p) => {
      last.p = p;
      legendOf();
    });
    requestAnimationFrame(legendOf);
  };
  // placed again once the engine has sized its panes, and at each change of the chart's size
  const chart = document.getElementById("chart");
  if (chart !== null) new ResizeObserver(() => setTimeout(legendOf, 50)).observe(chart);
  refresh();
  return { refresh };
};
