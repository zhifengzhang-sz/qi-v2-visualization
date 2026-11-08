// The page's settings dialog, its effects (docs/designs/design-chart-lib-2026-10-24.md, Version 1.7, step 3), as
// TradingView's: centred over the chart; a tab a section down the left (a component, the layout, an average, MACD,
// dialog.ts), opened at the one asked for (a legend line's gear) or the first; the tab's values in rows, a label at
// the left and its control at the right, under 参数 and 样式: a number, a colour (a swatch, the palette's colours in a
// grid to pick from), a choice of two, a text. A change is drawn at once (`apply`), or its reason shown and the
// settings left as they were; 默认值 puts the tab back to the defaults; 保存 downloads every value as the settings
// file's TOML; 取消 puts the settings back as they were when it opened; 确定 keeps them. Browser code: the DOM and one
// cell, the settings as they were when it opened.

import { type Json, type QiError, type Result, result } from "@qi/base";
import { config } from "@qi/core";
import { type Field, sections, withDefaults, withValue } from "../dialog.ts";

export type Dialog = {
  // the settings as they now are, the page's (browser.ts), which `apply` changes
  readonly settings: () => Json;
  readonly defaults: Json;
  // the palette's names and each its colour as the page shows it, for a colour's field
  readonly palette: Readonly<Record<string, string>>;
  // the chart drawn again from the settings, or why it cannot be
  readonly apply: (settings: Json) => Result<void, QiError>;
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

const style = [
  "#settings{padding:0;border:0;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.4);width:min(660px,94vw);",
  "height:min(560px,88vh);color:var(--cl-ink);background:var(--cl-bg);font-size:13px}",
  "#settings::backdrop{background:rgba(0,0,0,0.35)}",
  ".st{display:flex;flex-direction:column;height:100%}",
  ".st-head{padding:14px 18px;font-size:16px;font-weight:600;border-bottom:1px solid rgba(128,128,128,0.22)}",
  ".st-main{flex:1;display:flex;min-height:0}",
  ".st-tabs{width:150px;flex:none;border-right:1px solid rgba(128,128,128,0.22);overflow:auto;padding:6px 0;outline:none}",
  ".st-tab{padding:8px 18px;cursor:pointer;white-space:nowrap}.st-tab:hover{background:rgba(128,128,128,0.12)}",
  ".st-tab.on{background:rgba(41,98,255,0.16);font-weight:600}",
  ".st-body{flex:1;overflow:auto;padding:6px 22px 16px}",
  ".st-group{font-size:11px;letter-spacing:0.05em;opacity:0.55;margin:16px 0 4px}",
  ".st-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:5px 0}",
  ".st input[type=number],.st input[type=text]{width:96px;background:transparent;color:inherit;font:inherit;",
  "border:1px solid rgba(128,128,128,0.45);border-radius:4px;padding:4px 8px}",
  ".st-foot{display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid rgba(128,128,128,0.22)}",
  ".st-foot .sp{flex:1}.st-status{color:#e5534b;font-size:12px;padding:0 18px}",
  ".btn{padding:6px 16px;border-radius:4px;border:1px solid rgba(128,128,128,0.45);background:none;color:inherit;",
  "cursor:pointer;font:inherit}.btn:hover{background:rgba(128,128,128,0.14)}",
  ".btn.primary{background:#2962ff;border-color:#2962ff;color:#fff}.btn.primary:hover{background:#1e53e5}",
  ".sw{width:30px;height:22px;border-radius:4px;border:1px solid rgba(128,128,128,0.5);cursor:pointer;padding:0}",
  ".pal{position:fixed;z-index:40;display:grid;grid-template-columns:repeat(6,24px);gap:5px;padding:10px;",
  "background:var(--cl-bg);border-radius:6px;box-shadow:0 4px 18px rgba(0,0,0,0.4)}",
  ".pal div{width:24px;height:24px;border-radius:4px;cursor:pointer;border:1px solid rgba(128,128,128,0.4)}",
  ".pal div.on{outline:2px solid #2962ff;outline-offset:1px}",
].join("");

// a tab's rows: its own values first (显示, or the layout's), then its parameters, then its style
const groups: readonly (readonly [Field["group"], string])[] = [
  ["layout", ""],
  ["params", "参数"],
  ["style", "样式"],
];

// the dialog; `open(section)` shows it at that section's tab, or the first
export const settingsDialog = (d: Dialog): { readonly open: (section?: string) => void } => {
  // the settings as they were when it opened; the tab shown
  const now = { opened: d.settings(), tab: "" };
  const head = element("div", { className: "st-head" });
  const tabs = element("div", { className: "st-tabs" });
  const body = element("div", { className: "st-body" });
  const status = element("div", { className: "st-status" });
  const dialog = element("dialog", { id: "settings" });

  const tryApply = (s: Json): void =>
    result.match(
      (): void => {
        status.textContent = "";
        show();
      },
      (e: QiError): void => {
        status.textContent = e.message;
        show();
      },
    )(d.apply(s));

  // the palette's colours in a grid by the swatch `at`, the one picked set at `f`'s path
  const palette = (at: HTMLElement, f: Field): void => {
    dialog.querySelectorAll(".pal").forEach((p) => {
      p.remove();
    });
    const r = at.getBoundingClientRect();
    const grid = element(
      "div",
      { className: "pal" },
      ...Object.entries(d.palette).map(([name, hex]) => {
        const cell = element("div", {
          title: name,
          className: name === f.value ? "on" : "",
          onclick: () => {
            grid.remove();
            tryApply(withValue(d.settings(), f.path, name));
          },
        });
        cell.style.background = hex;
        return cell;
      }),
    );
    grid.style.left = `${Math.min(r.left, innerWidth - 200)}px`;
    grid.style.top = `${r.bottom + 4}px`;
    dialog.append(grid);
  };

  const control = (f: Field): HTMLElement =>
    f.kind === "boolean"
      ? element("input", {
          type: "checkbox",
          checked: f.value === true,
          onchange: (ev: Event) =>
            tryApply(withValue(d.settings(), f.path, (ev.target as HTMLInputElement).checked)),
        })
      : f.kind === "colour"
        ? ((): HTMLElement => {
            const sw = element("button", { className: "sw", title: String(f.value) });
            sw.style.background = d.palette[String(f.value)] ?? "transparent";
            sw.onclick = () => palette(sw, f);
            return sw;
          })()
        : element("input", {
            type: f.kind === "number" ? "number" : "text",
            step: "any",
            value: String(f.value),
            onchange: (ev: Event) => {
              const v = (ev.target as HTMLInputElement).value;
              tryApply(withValue(d.settings(), f.path, f.kind === "number" ? Number(v) : v));
            },
          });

  // the tabs, the one shown marked; its rows by group
  const show = (): void => {
    const all = sections(d.settings());
    const s = all.find((x) => x.key === now.tab) ?? all[0];
    now.tab = s?.key ?? "";
    head.textContent = s?.name ?? "设置";
    tabs.replaceChildren(
      ...all.map((x) =>
        element("div", {
          className: `st-tab${x.key === now.tab ? " on" : ""}`,
          textContent: x.name,
          onclick: () => {
            now.tab = x.key;
            show();
          },
        }),
      ),
    );
    body.replaceChildren(
      ...groups.flatMap(([g, name]) => {
        const fs = (s?.fields ?? []).filter((f) => f.group === g);
        return fs.length === 0
          ? []
          : [
              ...(name === "" ? [] : [element("div", { className: "st-group" }, name)]),
              ...fs.map((f) =>
                element("div", { className: "st-row" }, element("span", {}, f.label), control(f)),
              ),
            ];
      }),
    );
  };

  const save = (): void =>
    result.match(
      (text: string): void => {
        const a = element("a", {
          download: "chart.toml",
          href: URL.createObjectURL(new Blob([text], { type: "text/plain" })),
        });
        a.click();
        URL.revokeObjectURL(a.href);
      },
      (e: QiError): void => {
        status.textContent = e.message;
      },
    )(config.toText(d.settings() as { readonly [key: string]: Json }));

  dialog.append(
    element("style", {}, style),
    element(
      "div",
      { className: "st" },
      head,
      element("div", { className: "st-main" }, tabs, body),
      status,
      element(
        "div",
        { className: "st-foot" },
        element("button", {
          className: "btn",
          textContent: "默认值",
          title: "此项恢复默认",
          onclick: () => tryApply(withDefaults(d.settings(), d.defaults, now.tab)),
        }),
        element("button", { className: "btn", textContent: "保存 chart.toml", onclick: save }),
        element("span", { className: "sp" }),
        element("button", {
          className: "btn",
          textContent: "取消",
          onclick: () => {
            tryApply(now.opened);
            dialog.close();
          },
        }),
        element("button", { className: "btn primary", textContent: "确定", onclick: () => dialog.close() }),
      ),
    ),
  );
  dialog.addEventListener("click", (ev) => {
    if (!(ev.target as Element).closest(".pal, .sw"))
      dialog.querySelectorAll(".pal").forEach((p) => {
        p.remove();
      });
  });
  document.body.append(dialog);
  return {
    open: (section?: string): void => {
      now.opened = d.settings();
      now.tab = section ?? now.tab;
      status.textContent = "";
      show();
      dialog.showModal();
      tabs.querySelector(".on")?.scrollIntoView({ block: "nearest" });
    },
  };
};
