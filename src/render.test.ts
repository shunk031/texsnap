import { describe, expect, it } from 'vitest';
import { defaultState } from './state';
import {
  filterRenderablePackages,
  getMathJaxErrorMessage,
  normalizeSvg,
  prepareSource,
  renderEquation,
} from './render';

describe('render', () => {
  it('keeps TeX source unchanged for visual-only options', () => {
    const source = prepareSource({
      ...defaultState,
      source: 'x',
      bold: true,
      whiteOnBlack: true,
    });

    expect(source).toBe('x');
  });

  it('renders MathJax output as serialized SVG', async () => {
    const result = await renderEquation({
      ...defaultState,
      source: String.raw`\frac{a}{b}`,
      bold: true,
      whiteOnBlack: true,
      rendererMode: 'png-white',
    });

    expect(result.svgText).toContain('<svg');
    expect(result.svgText).toContain('role="img"');
    expect(result.svgText).toContain('aria-label="\\frac{a}{b}"');
    expect(result.svgElement.querySelector('rect')).not.toBeNull();
    expect(result.svgElement.style.color).toBe('rgb(255, 255, 255)');
    expect(result.svgElement.style.stroke).toBe('currentColor');
  });

  it('keeps mathrlap content inside the SVG viewBox', async () => {
    const base = await renderEquation({
      ...defaultState,
      source: 'x',
    });
    const overflowing = await renderEquation({
      ...defaultState,
      source: String.raw`x\mathrlap{\text{long label}}`,
    });

    const baseWidth = Number(
      base.svgElement.getAttribute('viewBox')!.split(/\s+/)[2],
    );
    const overflowingWidth = Number(
      overflowing.svgElement.getAttribute('viewBox')!.split(/\s+/)[2],
    );

    expect(overflowingWidth).toBeGreaterThan(baseWidth);
  });

  it('includes SVG text content in the viewBox', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 10 10');
    const text = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'text',
    );
    text.textContent = '日本語';
    Object.defineProperty(text, 'getComputedTextLength', { value: () => 20 });
    svg.append(text);

    normalizeSvg(svg, defaultState);

    expect(svg.getAttribute('viewBox')).toBe('0 0 20 10');
  });

  it('keeps the viewBox finite for Japanese mathrlap labels', async () => {
    const result = await renderEquation({
      ...defaultState,
      source: String.raw`\begin{align*}
\boldsymbol{G} = \{(\underbrace{\boldsymbol{b}_i}_{\mkern-70mu\mathclap{\text{要素 $i$ の bbox}}}, \underbrace{l_i}_{\mathrlap{\mkern-25mu\text{$i$ 番目のレイヤー}}})\}_{i=1}^{N}
\end{align*}`,
    });

    const viewBox = result.svgElement
      .getAttribute('viewBox')!
      .split(/\s+/)
      .map(Number);

    expect(viewBox.every(Number.isFinite)).toBe(true);
  });

  it('renders bbox backgrounds in MathJax output', async () => {
    const result = await renderEquation({
      ...defaultState,
      source: String.raw`\bbox[0.12em,#f4cccc]{x}`,
    });

    const background = result.svgElement.querySelector('rect[fill="#f4cccc"]');
    expect(result.svgText).toContain('<svg');
    expect(background).not.toBeNull();
    expect(Number(background?.getAttribute('width'))).toBeGreaterThanOrEqual(572);
    expect(Number(background?.getAttribute('height'))).toBeGreaterThan(453);
  });

  it('normalizes palette bbox background vertical bounds', async () => {
    const result = await renderEquation({
      ...defaultState,
      source: String.raw`\bbox[0.08em,#f4cccc]{x} + \bbox[0.08em,#fce5cd]{\frac{a}{b}}`,
      backgroundMargin: '.08em',
    });

    const backgrounds = Array.from(
      result.svgElement.querySelectorAll('rect[data-bgcolor="true"]'),
      (rect) => ({
        y: rect.getAttribute('y'),
        height: rect.getAttribute('height'),
      }),
    );

    expect(new Set(backgrounds.map((background) => background.y)).size).toBe(1);
    expect(new Set(backgrounds.map((background) => background.height)).size).toBe(1);
  });

  it('does not add extra horizontal padding while rendering bbox backgrounds', async () => {
    const source = String.raw`\bbox[0.08em,#f4cccc]{A}`;
    const compact = await renderEquation({
      ...defaultState,
      source,
      backgroundMargin: '.08em',
    });
    const wide = await renderEquation({
      ...defaultState,
      source,
      backgroundMargin: '.24em',
    });

    const compactBackground = compact.svgElement.querySelector(
      'rect[data-bgcolor="true"]',
    );
    const wideBackground = wide.svgElement.querySelector(
      'rect[data-bgcolor="true"]',
    );

    expect(wideBackground?.getAttribute('x')).toBe(
      compactBackground?.getAttribute('x'),
    );
    expect(wideBackground?.getAttribute('width')).toBe(
      compactBackground?.getAttribute('width'),
    );
  });

  it('aligns bbox backgrounds to italic glyph visual bounds', async () => {
    const result = await renderEquation({
      ...defaultState,
      source: String.raw`\bbox[0.08em,#f4cccc]{A}`,
      backgroundMargin: '.08em',
    });

    const background = result.svgElement.querySelector(
      'rect[data-bgcolor="true"]',
    );
    const [viewBoxX, , viewBoxWidth] = result.svgElement
      .getAttribute('viewBox')!
      .split(/\s+/)
      .map(Number);

    expect(Number(background?.getAttribute('x'))).toBeGreaterThan(0);
    expect(
      Number(background?.getAttribute('x')) +
        Number(background?.getAttribute('width')),
    ).toBeLessThanOrEqual(viewBoxX + viewBoxWidth);
  });

  it('keeps palette bbox vertical bounds scoped to each row', async () => {
    const result = await renderEquation({
      ...defaultState,
      source: String.raw`\begin{align*}
\bbox[0.08em,#f4cccc]{x} &= \bbox[0.08em,#fce5cd]{\frac{a}{b}} \\
\bbox[0.08em,#fff2cc]{y} &= \bbox[0.08em,#d9ead3]{z}
\end{align*}`,
      backgroundMargin: '.08em',
    });

    const rows = Array.from(
      result.svgElement.querySelectorAll('[data-mml-node="mtr"]'),
      (row) =>
        Array.from(row.querySelectorAll('rect[data-bgcolor="true"]'), (rect) => ({
          y: rect.getAttribute('y'),
          height: rect.getAttribute('height'),
        })),
    );

    expect(rows).toHaveLength(2);
    expect(new Set(rows[0].map((background) => background.y)).size).toBe(1);
    expect(new Set(rows[0].map((background) => background.height)).size).toBe(1);
    expect(new Set(rows[1].map((background) => background.y)).size).toBe(1);
    expect(new Set(rows[1].map((background) => background.height)).size).toBe(1);
    expect(rows[1][0].height).not.toBe(rows[0][0].height);
  });

  it('rejects MathJax TeX errors instead of exporting an error SVG', async () => {
    await expect(
      renderEquation({
        ...defaultState,
        source: String.raw`\notacommand{x}`,
      }),
    ).rejects.toThrow(/TeX error:/);
  });

  it('extracts MathJax merror details for display', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = String.raw`
      <svg>
        <g data-mml-node="merror">
          <title>Undefined control sequence \badcommand</title>
        </g>
      </svg>
    `;

    expect(getMathJaxErrorMessage(wrapper)).toBe(
      String.raw`TeX error: Undefined control sequence \badcommand`,
    );
  });

  it('ignores successful MathJax output when no merror is present', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<svg><g data-mml-node="mi"></g></svg>';

    expect(getMathJaxErrorMessage(wrapper)).toBeNull();
  });

  it('keeps MathJax from rendering TeX errors as exportable output', () => {
    expect(filterRenderablePackages(['base', 'noerrors', 'noundefined'])).toEqual([
      'base',
    ]);
  });
});
