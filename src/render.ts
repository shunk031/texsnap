import type { AppState, RenderResult } from './types';

let mathJaxPromise: Promise<MathJaxApi> | null = null;

interface MathJaxApi {
  convert: (source: string, options: { display: boolean }) => HTMLElement;
}

export async function renderEquation(state: AppState): Promise<RenderResult> {
  const mathJax = await ensureMathJax();
  const wrapper = mathJax.convert(prepareSource(state), {
    display: true,
  });
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
    packages: AllPackages,
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
