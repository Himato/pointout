export const styles = /* css */ `
:host {
  all: initial;
  display: block;
  position: fixed;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  z-index: 2147483646;
  color-scheme: light dark;

  --po-bg: #ffffff;
  --po-fg: #1f1e1d;
  --po-muted: #6b6965;
  --po-border: rgba(31, 30, 29, 0.14);
  --po-surface: #f5f4ef;
  --po-accent: #c96442;
  --po-accent-fg: #ffffff;
  --po-outline: #c96442;
  --po-outline-fill: rgba(201, 100, 66, 0.08);
  --po-shadow: 0 8px 28px rgba(0, 0, 0, 0.16), 0 1px 3px rgba(0, 0, 0, 0.1);
  --po-radius: 10px;
  --po-font: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --po-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

@media (prefers-color-scheme: dark) {
  :host {
    --po-bg: #262624;
    --po-fg: #f0eee6;
    --po-muted: #a8a59c;
    --po-border: rgba(240, 238, 230, 0.16);
    --po-surface: #30302e;
    --po-accent: #d97757;
    --po-outline: #e08a6c;
    --po-outline-fill: rgba(224, 138, 108, 0.12);
    --po-shadow: 0 8px 28px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4);
  }
}

*, *::before, *::after { box-sizing: border-box; }

.ui {
  font: 13px/1.4 var(--po-font);
  color: var(--po-fg);
  -webkit-font-smoothing: antialiased;
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  margin: 0;
  padding: 0;
  cursor: pointer;
}

button:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--po-accent);
  outline-offset: 2px;
}

[hidden] { display: none !important; }

/* Hover outline */
.outline {
  position: fixed;
  pointer-events: none;
  border: 2px solid var(--po-outline);
  background: var(--po-outline-fill);
  border-radius: 3px;
  transition: top 60ms, left 60ms, width 60ms, height 60ms;
}
.outline-label {
  position: absolute;
  left: -2px;
  bottom: calc(100% + 4px);
  max-width: min(420px, 90vw);
  padding: 2px 7px;
  border-radius: 5px;
  background: var(--po-outline);
  color: var(--po-accent-fg);
  font: 600 11px/1.5 var(--po-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.outline-label.below { bottom: auto; top: calc(100% + 4px); }
.outline-label .tag { font-weight: 400; opacity: 0.85; }

/* Numbered badges */
.badge {
  position: fixed;
  pointer-events: none;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--po-accent);
  color: var(--po-accent-fg);
  font: 700 11px/20px var(--po-font);
  text-align: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
.badge.gone { opacity: 0.4; filter: grayscale(1); }

/* Comment popover */
.popover {
  position: fixed;
  width: 320px;
  max-width: calc(100vw - 16px);
  padding: 12px;
  border-radius: var(--po-radius);
  background: var(--po-bg);
  border: 1px solid var(--po-border);
  box-shadow: var(--po-shadow);
}
.popover-title {
  margin: 0 0 8px;
  font: 600 12px/1.4 var(--po-mono);
  color: var(--po-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.popover textarea {
  display: block;
  width: 100%;
  min-height: 72px;
  resize: vertical;
  padding: 8px;
  border-radius: 7px;
  border: 1px solid var(--po-border);
  background: var(--po-surface);
  color: var(--po-fg);
  font: 13px/1.45 var(--po-font);
}
.popover-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.popover-hint { margin-right: auto; color: var(--po-muted); font-size: 11px; }
.btn {
  padding: 5px 12px;
  border-radius: 7px;
  border: 1px solid var(--po-border);
}
.btn:hover { background: var(--po-surface); }
.btn.primary {
  background: var(--po-accent);
  border-color: var(--po-accent);
  color: var(--po-accent-fg);
  font-weight: 600;
}
.btn.primary:hover { filter: brightness(1.06); }

/* Pill and menu */
.pill {
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex;
  align-items: stretch;
  border-radius: 999px;
  background: var(--po-bg);
  border: 1px solid var(--po-border);
  box-shadow: var(--po-shadow);
  overflow: hidden;
}
.pill-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px 7px 14px;
  font-weight: 600;
}
.pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--po-muted);
}
.pill[data-on] .pill-dot { background: var(--po-accent); box-shadow: 0 0 0 3px var(--po-outline-fill); }
.pill-count {
  min-width: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--po-surface);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
.pill-more {
  padding: 0 12px 0 8px;
  border-left: 1px solid var(--po-border);
  font-size: 16px;
  line-height: 1;
  color: var(--po-muted);
}
.pill-toggle:hover, .pill-more:hover { background: var(--po-surface); }

.menu {
  position: fixed;
  right: 16px;
  bottom: 60px;
  min-width: 200px;
  padding: 6px;
  border-radius: var(--po-radius);
  background: var(--po-bg);
  border: 1px solid var(--po-border);
  box-shadow: var(--po-shadow);
}
.menu-item {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  text-align: left;
}
.menu-item:hover, .menu-item:focus-visible { background: var(--po-surface); outline: none; }
.menu-item[aria-checked='true']::after { content: '✓'; color: var(--po-accent); }
.menu-sep { height: 1px; margin: 5px 4px; background: var(--po-border); }
.menu-label { padding: 4px 10px 2px; color: var(--po-muted); font-size: 11px; }

.toast {
  position: fixed;
  right: 16px;
  bottom: 60px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--po-fg);
  color: var(--po-bg);
  font-weight: 600;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .outline { transition: none; }
}
`;
