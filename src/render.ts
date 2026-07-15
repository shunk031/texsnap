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

  for (const rect of rects) {
    alignBackgroundRectHorizontally(rect);
  }

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

  expandViewBoxToFitBackgroundRects(svg, rects);
}

function alignBackgroundRectHorizontally(rect: SVGRectElement): void {
  const contentBounds = backgroundContentXBounds(rect);
  if (!contentBounds) return;

  const x = readNumberAttribute(rect, 'x');
  const width = readNumberAttribute(rect, 'width');
  const center = (contentBounds.min + contentBounds.max) / 2;
  const contentWidth = contentBounds.max - contentBounds.min;
  const normalizedWidth = Math.max(width, contentWidth);
  const normalizedX = center - normalizedWidth / 2;

  if (x !== normalizedX) rect.setAttribute('x', String(normalizedX));
  if (width !== normalizedWidth) {
    rect.setAttribute('width', String(normalizedWidth));
  }
}

function backgroundContentXBounds(
  rect: SVGRectElement,
): { min: number; max: number } | null {
  const parent = rect.parentElement;
  if (!parent) return null;

  const bounds = Array.from(parent.children)
    .filter((child) => child !== rect)
    .map((child) => elementPathXBounds(child, { scale: 1, translate: 0 }))
    .filter((bound): bound is { min: number; max: number } => bound !== null);

  if (bounds.length === 0) return null;

  return {
    min: Math.min(...bounds.map((bound) => bound.min)),
    max: Math.max(...bounds.map((bound) => bound.max)),
  };
}

function elementPathXBounds(
  element: Element,
  transform: HorizontalTransform,
): { min: number; max: number } | null {
  const nextTransform = combineHorizontalTransform(
    transform,
    readHorizontalTransform(element.getAttribute('transform')),
  );
  const bounds: { min: number; max: number }[] = [];

  if (element.tagName.toLowerCase() === 'path') {
    const pathBounds = pathXBounds(element.getAttribute('d') ?? '');
    if (pathBounds) {
      bounds.push({
        min: applyHorizontalTransform(pathBounds.min, nextTransform),
        max: applyHorizontalTransform(pathBounds.max, nextTransform),
      });
    }
  }

  for (const child of Array.from(element.children)) {
    const childBounds = elementPathXBounds(child, nextTransform);
    if (childBounds) bounds.push(childBounds);
  }

  if (bounds.length === 0) return null;

  return {
    min: Math.min(...bounds.map((bound) => bound.min)),
    max: Math.max(...bounds.map((bound) => bound.max)),
  };
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

function expandViewBoxToFitBackgroundRects(
  svg: SVGSVGElement,
  rects: SVGRectElement[],
): void {
  const viewBox = svg.getAttribute('viewBox');
  if (!viewBox) return;

  const [x, y, width, height] = viewBox.split(/\s+/).map(Number);
  if ([x, y, width, height].some(Number.isNaN)) return;

  const rectBounds = rects.map((rect) => rectGlobalXBounds(rect, svg));
  const minX = Math.min(x, ...rectBounds.map((bound) => bound.min));
  const maxX = Math.max(x + width, ...rectBounds.map((bound) => bound.max));
  if (minX === x && maxX === x + width) return;

  svg.setAttribute('viewBox', `${minX} ${y} ${maxX - minX} ${height}`);
  scaleLengthAttribute(svg, 'width', (maxX - minX) / width);
}

function rectGlobalXBounds(
  rect: SVGRectElement,
  svg: SVGSVGElement,
): { min: number; max: number } {
  const transform = horizontalTransformToSvg(rect, svg);
  const x = readNumberAttribute(rect, 'x');
  const width = readNumberAttribute(rect, 'width');
  return {
    min: applyHorizontalTransform(x, transform),
    max: applyHorizontalTransform(x + width, transform),
  };
}

function horizontalTransformToSvg(
  element: Element,
  svg: SVGSVGElement,
): HorizontalTransform {
  let transform: HorizontalTransform = { scale: 1, translate: 0 };
  let cursor: Element | null = element.parentElement;

  while (cursor && cursor !== svg) {
    transform = combineHorizontalTransform(
      readHorizontalTransform(cursor.getAttribute('transform')),
      transform,
    );
    cursor = cursor.parentElement;
  }

  return transform;
}

interface HorizontalTransform {
  scale: number;
  translate: number;
}

function readHorizontalTransform(value: string | null): HorizontalTransform {
  const transform: HorizontalTransform = { scale: 1, translate: 0 };
  if (!value) return transform;

  for (const [, name, rawArgs] of value.matchAll(/(translate|scale|matrix)\(([^)]*)\)/g)) {
    const args = rawArgs
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    if (name === 'translate') {
      transform.translate += transform.scale * (args[0] ?? 0);
    } else if (name === 'scale') {
      transform.scale *= args[0] ?? 1;
    } else if (name === 'matrix') {
      transform.translate += transform.scale * (args[4] ?? 0);
      transform.scale *= args[0] ?? 1;
    }
  }

  return transform;
}

function combineHorizontalTransform(
  parent: HorizontalTransform,
  child: HorizontalTransform,
): HorizontalTransform {
  return {
    scale: parent.scale * child.scale,
    translate: parent.translate + parent.scale * child.translate,
  };
}

function applyHorizontalTransform(
  value: number,
  transform: HorizontalTransform,
): number {
  return transform.scale * value + transform.translate;
}

function scaleLengthAttribute(
  element: Element,
  attribute: string,
  scale: number,
): void {
  const value = element.getAttribute(attribute);
  const match = value?.match(/^([\d.]+)([a-z%]+)$/i);
  if (!match) return;

  element.setAttribute(attribute, `${Number(match[1]) * scale}${match[2]}`);
}

function pathXBounds(path: string): { min: number; max: number } | null {
  const tokens = path.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  if (!tokens) return null;

  const xValues: number[] = [];
  let index = 0;
  let command = '';
  let currentX = 0;
  let currentY = 0;

  while (index < tokens.length) {
    if (isPathCommand(tokens[index])) {
      command = tokens[index++];
    }
    if (!command) break;

    const lowerCommand = command.toLowerCase();
    const relative = command === lowerCommand;
    if (lowerCommand === 'z') continue;

    const paramCount = pathCommandParamCount(lowerCommand);
    if (paramCount === 0) break;

    while (index < tokens.length && !isPathCommand(tokens[index])) {
      const values = tokens.slice(index, index + paramCount).map(Number);
      if (values.length < paramCount || values.some(Number.isNaN)) break;
      collectPathCommandXValues(
        lowerCommand,
        relative,
        values,
        currentX,
        xValues,
      );
      const nextPoint = pathCommandEndPoint(
        lowerCommand,
        relative,
        values,
        currentX,
        currentY,
      );
      currentX = nextPoint.x;
      currentY = nextPoint.y;
      index += paramCount;

      if (lowerCommand === 'm') command = relative ? 'l' : 'L';
    }
  }

  if (xValues.length === 0) return null;
  return { min: Math.min(...xValues), max: Math.max(...xValues) };
}

function isPathCommand(token: string): boolean {
  return /^[a-zA-Z]$/.test(token);
}

function pathCommandParamCount(command: string): number {
  return (
    {
      a: 7,
      c: 6,
      h: 1,
      l: 2,
      m: 2,
      q: 4,
      s: 4,
      t: 2,
      v: 1,
    }[command] ?? 0
  );
}

function collectPathCommandXValues(
  command: string,
  relative: boolean,
  values: number[],
  currentX: number,
  xValues: number[],
): void {
  if (command === 'h') {
    xValues.push(relative ? currentX + values[0] : values[0]);
    return;
  }
  if (command === 'v') {
    xValues.push(currentX);
    return;
  }

  const xIndexes =
    command === 'a'
      ? [5]
      : Array.from({ length: values.length / 2 }, (_, pairIndex) => pairIndex * 2);

  for (const xIndex of xIndexes) {
    xValues.push(relative ? currentX + values[xIndex] : values[xIndex]);
  }

  if (command === 'a') xValues.push(currentX);
}

function pathCommandEndPoint(
  command: string,
  relative: boolean,
  values: number[],
  currentX: number,
  currentY: number,
): { x: number; y: number } {
  if (command === 'h') {
    return { x: relative ? currentX + values[0] : values[0], y: currentY };
  }
  if (command === 'v') {
    return { x: currentX, y: relative ? currentY + values[0] : values[0] };
  }

  const endXIndex = command === 'a' ? 5 : values.length - 2;
  const endYIndex = command === 'a' ? 6 : values.length - 1;
  return {
    x: relative ? currentX + values[endXIndex] : values[endXIndex],
    y: relative ? currentY + values[endYIndex] : values[endYIndex],
  };
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
