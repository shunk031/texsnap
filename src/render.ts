import type { AppState, RenderResult } from './types';
import { backgroundPalette } from './palette';

let mathJaxPromise: Promise<MathJaxApi> | null = null;
const backgroundColorHexes = new Set(
  backgroundPalette.map((color) => color.hex.toLowerCase()),
);

interface MathJaxApi {
  convert: (source: string, options: { display: boolean }) => HTMLElement;
}

export class TexRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TexRenderError';
  }
}

export async function renderEquation(state: AppState): Promise<RenderResult> {
  const mathJax = await ensureMathJax();
  const wrapper = mathJax.convert(prepareSource(state), {
    display: true,
  });
  const texError = getMathJaxErrorMessage(wrapper);
  if (texError) {
    throw new TexRenderError(texError);
  }

  const svg = wrapper.querySelector('svg');
  if (!(svg instanceof SVGSVGElement)) {
    throw new Error('MathJax did not return an SVG element.');
  }

  const cloned = svg.cloneNode(true) as SVGSVGElement;
  normalizeSvg(cloned, state);

  return {
    svgElement: cloned,
    svgText: serializeSvg(cloned),
  };
}

export function prepareSource(state: AppState): string {
  return state.source;
}

export function serializeSvg(svg: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(svg);
}

export function getMathJaxErrorMessage(root: Element): string | null {
  const errorNode = root.querySelector('[data-mml-node="merror"]');
  if (!errorNode) return null;

  const detail =
    errorNode.querySelector('title')?.textContent ?? errorNode.textContent ?? '';
  const normalized = detail.replace(/\s+/g, ' ').trim();
  return normalized ? `TeX error: ${normalized}` : 'TeX rendering failed.';
}

export function filterRenderablePackages(packages: string[]): string[] {
  return packages.filter(
    (packageName) => !['noerrors', 'noundefined'].includes(packageName),
  );
}

export function normalizeSvg(svg: SVGSVGElement, state: AppState): void {
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', state.source);
  svg.classList.add('texsnap-output');

  if (state.fontPreset === 'mathjax-newcm') {
    svg.style.fontFamily = '"New Computer Modern Math", serif';
  }
  if (state.whiteOnBlack) {
    svg.style.color = '#ffffff';
  }
  if (state.bold) {
    svg.style.stroke = 'currentColor';
    svg.style.strokeWidth = '0.35px';
  }
  expandBackgroundRects(svg);

  if (state.whiteOnBlack || state.rendererMode === 'png-white') {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '-0.4em');
    rect.setAttribute('y', '-0.4em');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute(
      'fill',
      state.whiteOnBlack ? '#000000' : '#ffffff',
    );
    svg.insertBefore(rect, svg.firstChild);
  }
}

function expandBackgroundRects(svg: SVGSVGElement): void {
  const rects = Array.from(
    svg.querySelectorAll<SVGRectElement>('rect[data-bgcolor="true"]'),
  ).filter((rect) => {
    const fill = rect.getAttribute('fill')?.toLowerCase();
    return fill ? backgroundColorHexes.has(fill) : false;
  });
  if (rects.length === 0) return;

  const rectGroups = new Map<Element, SVGRectElement[]>();
  for (const rect of rects) {
    const group = backgroundRectVerticalGroup(rect, svg);
    rectGroups.set(group, [...(rectGroups.get(group) ?? []), rect]);
  }

  for (const groupRects of rectGroups.values()) {
    const minY = Math.min(
      ...groupRects.map((rect) => readNumberAttribute(rect, 'y')),
    );
    const maxBottom = Math.max(
      ...groupRects.map((rect) =>
        readNumberAttribute(rect, 'y') + readNumberAttribute(rect, 'height'),
      ),
    );
    const normalizedHeight = maxBottom - minY;

    for (const rect of groupRects) {
      if (
        readNumberAttribute(rect, 'y') === minY &&
        readNumberAttribute(rect, 'height') === normalizedHeight
      ) {
        continue;
      }

      rect.setAttribute('y', String(minY));
      rect.setAttribute('height', String(normalizedHeight));
    }
  }
}

function backgroundRectVerticalGroup(
  rect: SVGRectElement,
  svg: SVGSVGElement,
): Element {
  return rect.closest('[data-mml-node="mtr"]') ?? svg;
}

function readNumberAttribute(element: Element, attribute: string): number {
  return Number(element.getAttribute(attribute) ?? 0);
}

async function ensureMathJax(): Promise<MathJaxApi> {
  if (!mathJaxPromise) {
    mathJaxPromise = createRenderer();
  }

  return mathJaxPromise;
}

async function createRenderer(): Promise<MathJaxApi> {
  const [
    { mathjax },
    { TeX },
    { SVG },
    { browserAdaptor },
    { RegisterHTMLHandler },
    { AllPackages },
  ] = await Promise.all([
    import('mathjax-full/js/mathjax.js'),
    import('mathjax-full/js/input/tex.js'),
    import('mathjax-full/js/output/svg.js'),
    import('mathjax-full/js/adaptors/browserAdaptor.js'),
    import('mathjax-full/js/handlers/html.js'),
    import('mathjax-full/js/input/tex/AllPackages.js'),
  ]);

  const adaptor = browserAdaptor();
  RegisterHTMLHandler(adaptor);

  const tex = new TeX({
    packages: filterRenderablePackages(AllPackages),
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
  });
  const svg = new SVG({ fontCache: 'none' });
  const html = mathjax.document(document, {
    InputJax: tex,
    OutputJax: svg,
  });

  return {
    convert: (source, options) =>
      adaptor.node('div', {}, [html.convert(source, options)]) as HTMLElement,
  };
}
