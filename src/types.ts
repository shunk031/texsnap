export type RendererMode = 'svg' | 'png-transparent' | 'png-white';

export type Resolution = 150 | 300 | 600 | 1200;

export type FontPreset = 'mathjax-tex' | 'mathjax-newcm';

export type BackgroundMargin = '0px' | '1px' | '2px' | '3px' | '4px' | '6px';

export interface AppState {
  source: string;
  resolution: Resolution;
  fontPreset: FontPreset;
  bold: boolean;
  whiteOnBlack: boolean;
  rendererMode: RendererMode;
  backgroundMargin: BackgroundMargin;
}

export interface RenderResult {
  svgElement: SVGSVGElement;
  svgText: string;
}
