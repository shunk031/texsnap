import './styles.css';
import { basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { latex } from 'codemirror-lang-latex';
import {
  buildHashSource,
  loadState,
  saveState,
} from './state';
import { colorPalette, isLightColor, wrapSelectionWithColor } from './palette';
import { renderEquation } from './render';
import { copyPng, copySvg, downloadPng, downloadSvg } from './export';
import type { FontPreset, RendererMode, RenderResult, Resolution } from './types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing app root.');

let state = loadState(window.localStorage, window.location.hash);
let lastResult: RenderResult | null = null;
let editorView: EditorView;

app.innerHTML = `
  <div class="shell">
    <aside class="controls" aria-label="TeXsnap controls">
      <h1><a href="./">TeXsnap</a></h1>
      <div class="colorpalette" id="colorpalette"></div>

      <label for="resolution">Resolution</label>
      <select id="resolution">
        <option value="150">150dpi</option>
        <option value="300">300dpi</option>
        <option value="600">600dpi</option>
        <option value="1200">1200dpi</option>
      </select>

      <label for="fontPreset">Font</label>
      <select id="fontPreset">
        <option value="mathjax-tex">MathJax TeX</option>
        <option value="mathjax-newcm">New CM style</option>
      </select>

      <div class="checks">
        <label><input type="checkbox" id="bold" /> Bold by Default</label>
        <label><input type="checkbox" id="whiteOnBlack" /> White on Black</label>
      </div>

      <label for="rendererMode">Renderer Mode</label>
      <select id="rendererMode">
        <option value="svg">SVG</option>
        <option value="png-transparent">PNG transparent</option>
        <option value="png-white">PNG white</option>
      </select>

      <button type="button" class="primary" id="generate">Generate <span id="shortcut">(Ctrl+S)</span></button>

      <div class="button-grid">
        <button type="button" id="downloadSvg">SVG</button>
        <button type="button" id="downloadPng">PNG</button>
        <button type="button" id="copySvg">Copy SVG</button>
        <button type="button" id="copyPng">Copy PNG</button>
      </div>

      <p class="status" id="status" role="status">Ready</p>
    </aside>

    <main class="workspace">
      <section class="editor-panel" aria-label="LaTeX source">
        <div id="source"></div>
      </section>
      <section class="render-panel" aria-label="Rendered equation">
        <div class="render-toolbar">
          <span>Preview</span>
          <span id="modeLabel"></span>
        </div>
        <div id="preview" class="preview"></div>
      </section>
    </main>
  </div>
`;

const controls = {
  source: mustGet<HTMLDivElement>('source'),
  resolution: mustGet<HTMLSelectElement>('resolution'),
  fontPreset: mustGet<HTMLSelectElement>('fontPreset'),
  bold: mustGet<HTMLInputElement>('bold'),
  whiteOnBlack: mustGet<HTMLInputElement>('whiteOnBlack'),
  rendererMode: mustGet<HTMLSelectElement>('rendererMode'),
  generate: mustGet<HTMLButtonElement>('generate'),
  downloadSvg: mustGet<HTMLButtonElement>('downloadSvg'),
  downloadPng: mustGet<HTMLButtonElement>('downloadPng'),
  copySvg: mustGet<HTMLButtonElement>('copySvg'),
  copyPng: mustGet<HTMLButtonElement>('copyPng'),
  colorPalette: mustGet<HTMLDivElement>('colorpalette'),
  preview: mustGet<HTMLDivElement>('preview'),
  status: mustGet<HTMLParagraphElement>('status'),
  modeLabel: mustGet<HTMLSpanElement>('modeLabel'),
  shortcut: mustGet<HTMLSpanElement>('shortcut'),
};

init();

function init(): void {
  if (navigator.platform.toLowerCase().includes('mac')) {
    controls.shortcut.textContent = '(Cmd+S)';
  }
  editorView = createEditor(state.source);
  renderPalette();
  bindEvents();
  applyStateToControls();
  void generate();
}

function bindEvents(): void {
  controls.generate.addEventListener('click', () => void generate());
  controls.downloadSvg.addEventListener('click', () => {
    if (lastResult) downloadSvg(lastResult);
  });
  controls.downloadPng.addEventListener('click', () => {
    const result = lastResult;
    if (result) void runAction(() => downloadPng(result, state), 'PNG saved.');
  });
  controls.copySvg.addEventListener('click', () => {
    const result = lastResult;
    if (result) void runAction(() => copySvg(result), 'SVG copied.');
  });
  controls.copyPng.addEventListener('click', () => {
    const result = lastResult;
    if (result) void runAction(() => copyPng(result, state), 'PNG copied.');
  });

  for (const input of [
    controls.resolution,
    controls.fontPreset,
    controls.bold,
    controls.whiteOnBlack,
    controls.rendererMode,
  ]) {
    input.addEventListener('change', () => {
      syncStateFromControls();
      void generate();
    });
  }

  window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void generate();
    }
  });

  window.addEventListener('hashchange', () => {
    state = loadState(window.localStorage, window.location.hash);
    applyStateToControls();
    void generate();
  });
}

function renderPalette(): void {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');

  for (const row of colorPalette) {
    const tr = document.createElement('tr');
    for (const rgb of row) {
      const td = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `swatch ${isLightColor(rgb) ? 'light' : 'dark'}`;
      button.style.backgroundColor = `rgb(${rgb.join(',')})`;
      button.title = `rgb(${rgb.join(', ')})`;
      button.addEventListener('click', () => applyColor(rgb));
      td.append(button);
      tr.append(td);
    }
    tbody.append(tr);
  }

  table.append(tbody);
  controls.colorPalette.replaceChildren(table);
}

function applyColor(rgb: readonly [number, number, number]): void {
  const selection = editorView.state.selection.main;
  const source = editorView.state.doc.toString();
  const updated = wrapSelectionWithColor(source, selection.from, selection.to, rgb);
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: updated.source,
    },
    selection: { anchor: updated.start, head: updated.end },
  });
  editorView.focus();
  state.source = updated.source;
  persist();
}

async function generate(): Promise<void> {
  syncStateFromControls();
  setStatus('Rendering...');
  controls.preview.classList.toggle('black', state.whiteOnBlack);
  controls.modeLabel.textContent = labelForMode(state.rendererMode);

  try {
    lastResult = await renderEquation(state);
    controls.preview.replaceChildren(lastResult.svgElement);
    setStatus('Rendered.');
  } catch (error) {
    controls.preview.innerHTML = '';
    setStatus(error instanceof Error ? error.message : 'Render failed.');
  }
}

async function runAction(
  action: () => Promise<void>,
  successMessage: string,
): Promise<void> {
  setStatus('Working...');
  try {
    await action();
    setStatus(successMessage);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Action failed.');
  }
}

function applyStateToControls(): void {
  if (editorView.state.doc.toString() !== state.source) {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: state.source,
      },
    });
  }
  controls.resolution.value = String(state.resolution);
  controls.fontPreset.value = state.fontPreset;
  controls.bold.checked = state.bold;
  controls.whiteOnBlack.checked = state.whiteOnBlack;
  controls.rendererMode.value = state.rendererMode;
}

function syncStateFromControls(): void {
  state = {
    source: editorView.state.doc.toString(),
    resolution: Number(controls.resolution.value) as Resolution,
    fontPreset: controls.fontPreset.value as FontPreset,
    bold: controls.bold.checked,
    whiteOnBlack: controls.whiteOnBlack.checked,
    rendererMode: controls.rendererMode.value as RendererMode,
  };
  persist();
}

function persist(): void {
  saveState(window.localStorage, state);
  window.history.replaceState(null, '', buildHashSource(state.source));
}

function setStatus(message: string): void {
  controls.status.textContent = message;
}

function labelForMode(mode: RendererMode): string {
  if (mode === 'png-transparent') return 'PNG transparent';
  if (mode === 'png-white') return 'PNG white';
  return 'SVG';
}

function mustGet<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}.`);
  return element as T;
}

function createEditor(source: string): EditorView {
  const view = new EditorView({
    parent: controls.source,
    state: EditorState.create({
      doc: source,
      extensions: [
        basicSetup,
        lineNumbers(),
        latex({
          autoCloseTags: true,
          autoCloseBrackets: true,
          enableAutocomplete: true,
          enableLinting: false,
          enableTooltips: true,
          fileName: 'equation.tex',
        }),
        EditorView.lineWrapping,
        keymap.of([
          {
            key: 'Mod-s',
            run() {
              void generate();
              return true;
            },
          },
          indentWithTab,
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          state.source = update.state.doc.toString();
          persist();
        }),
      ],
    }),
  });

  return view;
}
