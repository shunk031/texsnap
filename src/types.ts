export type RendererMode = 'svg' | 'png-transparent' | 'png-white';

export type Resolution = 150 | 300 | 600 | 1200;

export type FontPreset = 'mathjax-tex' | 'mathjax-newcm';

export interface AppState {
  source: string;
  resolution: Resolution;
  fontPreset: FontPreset;
  bold: boolean;
  whiteOnBlack: boolean;
  rendererMode: RendererMode;
}

export interface RenderResult {
  svgElement: SVGSVGElement;
  svgText: string;
}
