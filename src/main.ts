import './styles.css';
import { basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { latex } from 'codemirror-lang-latex';
import {
  Copy,
  Download,
  RefreshCw,
  createElement as createLucideElement,
} from 'lucide';
import {
  buildHashSource,
  loadState,
  saveState,
} from './state';
import {
  backgroundPalette,
  colorPalette,
  isLightColor,
  wrapSelectionWithBackground,
  wrapSelectionWithColor,
} from './palette';
import { renderEquation } from './render';
import { copyPng, copySvg, downloadPng, downloadSvg } from './export';
import type { FontPreset, RendererMode, RenderResult, Resolution } from './types';

type IconNode = typeof Download;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing app root.');

let state = loadState(window.localStorage, window.location.hash);
let lastResult: RenderResult | null = null;
let editorView: EditorView;

app.innerHTML = `
  <div class="shell">
    <aside class="controls" aria-label="TeXsnap controls">
      <h1><a href="./">TeXsnap</a></h1>
      <section class="palette-section" aria-labelledby="textColorPaletteLabel">
        <h2 id="textColorPaletteLabel">Text Colors</h2>
        <div class="text-color-palette" id="textColorPalette"></div>
      </section>
      <section class="palette-section" aria-labelledby="backgroundPaletteLabel">
        <h2 id="backgroundPaletteLabel">Recommended Background Colors</h2>
        <div class="background-palette" id="backgroundPalette"></div>
      </section>

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

      <button type="button" class="primary" id="generate">
        <span data-icon="generate"></span>
        <span>Generate</span>
        <span id="shortcut">(Ctrl+S)</span>
      </button>

      <div class="button-grid">
        <button type="button" id="downloadSvg" title="Download SVG">
          <span data-icon="download"></span>
          <span>SVG</span>
        </button>
        <button type="button" id="downloadPng" title="Download PNG">
          <span data-icon="download"></span>
          <span>PNG</span>
        </button>
        <button type="button" id="copySvg" title="Copy SVG">
          <span data-icon="copy"></span>
          <span>Copy SVG</span>
        </button>
        <button type="button" id="copyPng" title="Copy PNG">
          <span data-icon="copy"></span>
          <span>Copy PNG</span>
        </button>
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
  textColorPalette: mustGet<HTMLDivElement>('textColorPalette'),
  backgroundPalette: mustGet<HTMLDivElement>('backgroundPalette'),
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
  mountIcons();
  editorView = createEditor(state.source);
  renderPalettes();
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

function renderPalettes(): void {
  renderTextColorPalette();
  renderBackgroundPalette();
}

function renderTextColorPalette(): void {
  const fragment = document.createDocumentFragment();

  for (const row of colorPalette) {
    for (const rgb of row) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `text-color-swatch ${isLightColor(rgb) ? 'light' : 'dark'}`;
      button.style.backgroundColor = `rgb(${rgb.join(',')})`;
      button.title = `rgb(${rgb.join(', ')})`;
      button.setAttribute('aria-label', `Apply rgb(${rgb.join(', ')}) text color`);
      button.addEventListener('click', () => applyTextColor(rgb));
      fragment.append(button);
    }
  }

  controls.textColorPalette.replaceChildren(fragment);
}

function renderBackgroundPalette(): void {
  const fragment = document.createDocumentFragment();

  for (const color of backgroundPalette) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'background-swatch';
    button.style.backgroundColor = color.hex;
    button.title = `${color.name} ${color.hex}`;
    button.setAttribute('aria-label', `Apply ${color.name} background`);
    button.addEventListener('click', () => applyBackground(color.hex));
    fragment.append(button);
  }

  controls.backgroundPalette.replaceChildren(fragment);
}

function applyTextColor(rgb: readonly [number, number, number]): void {
  applySourceWrap((source, start, end) =>
    wrapSelectionWithColor(source, start, end, rgb),
  );
}

function applyBackground(hex: string): void {
  applySourceWrap((source, start, end) =>
    wrapSelectionWithBackground(source, start, end, hex),
  );
}

function applySourceWrap(
  wrap: (
    source: string,
    start: number,
    end: number,
  ) => { source: string; start: number; end: number },
): void {
  const selection = editorView.state.selection.main;
  const source = editorView.state.doc.toString();
  const updated = wrap(source, selection.from, selection.to);
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

function mountIcons(): void {
  const icons: Record<string, IconNode> = {
    copy: Copy,
    download: Download,
    generate: RefreshCw,
  };

  for (const placeholder of document.querySelectorAll<HTMLElement>('[data-icon]')) {
    const iconName = placeholder.dataset.icon;
    const icon = iconName ? icons[iconName] : undefined;
    if (!icon) continue;

    const svg = createLucideElement(icon, {
      'aria-hidden': 'true',
      class: 'button-icon',
      height: 16,
      width: 16,
      'stroke-width': 2.25,
    });
    placeholder.replaceChildren(svg);
  }
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
