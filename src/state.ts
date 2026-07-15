import type { AppState, FontPreset, RendererMode, Resolution } from './types';

export const defaultSource = String.raw`\begin{align*}
  \left( \int_0^\infty \frac{\sin x}{\sqrt{x}} dx \right)^2 =
  \sum_{k=0}^\infty \frac{(2k)!}{2^{2k}(k!)^2} \frac{1}{2k+1} =
  \prod_{k=1}^\infty \frac{4k^2}{4k^2 - 1} = \frac{\pi}{2}
\end{align*}`;

export const defaultState: AppState = {
  source: defaultSource,
  resolution: 300,
  fontPreset: 'mathjax-tex',
  bold: false,
  whiteOnBlack: false,
  rendererMode: 'svg',
};

const storageKey = 'texsnap:settings';

const resolutions: Resolution[] = [150, 300, 600, 1200];
const rendererModes: RendererMode[] = ['svg', 'png-transparent', 'png-white'];
const fontPresets: FontPreset[] = ['mathjax-tex', 'mathjax-newcm'];

export function parseHashSource(hash: string): string | null {
  const query = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(query);
  const source = params.get('s');
  return source && source.trim() ? source : null;
}

export function buildHashSource(source: string): string {
  const params = new URLSearchParams();
  params.set('s', source);
  return `#${params.toString()}`;
}

export function loadState(storage: Storage, hash: string): AppState {
  const loaded = readSettings(storage);
  const hashSource = parseHashSource(hash);

  return {
    ...defaultState,
    ...loaded,
    source: hashSource ?? loaded.source ?? defaultState.source,
  };
}

export function saveState(storage: Storage, state: AppState): void {
  const { source: _source, ...settings } = state;
  storage.setItem(storageKey, JSON.stringify(settings));
}

function readSettings(storage: Storage): Partial<AppState> {
  const raw = storage.getItem(storageKey);
  if (!raw) return {};
  const value = JSON.parse(raw) as Partial<AppState>;

  return {
    source: typeof value.source === 'string' ? value.source : undefined,
    resolution: isResolution(value.resolution) ? value.resolution : undefined,
    fontPreset: isFontPreset(value.fontPreset) ? value.fontPreset : undefined,
    bold: typeof value.bold === 'boolean' ? value.bold : undefined,
    whiteOnBlack:
      typeof value.whiteOnBlack === 'boolean' ? value.whiteOnBlack : undefined,
    rendererMode: isRendererMode(value.rendererMode)
      ? value.rendererMode
      : undefined,
  };
}

function isResolution(value: unknown): value is Resolution {
  return resolutions.includes(value as Resolution);
}

function isRendererMode(value: unknown): value is RendererMode {
  return rendererModes.includes(value as RendererMode);
}

function isFontPreset(value: unknown): value is FontPreset {
  return fontPresets.includes(value as FontPreset);
}
