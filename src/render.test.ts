import { describe, expect, it } from 'vitest';
import { defaultState } from './state';
import {
  filterRenderablePackages,
  getMathJaxErrorMessage,
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

  it('renders bbox backgrounds in MathJax output', async () => {
    const result = await renderEquation({
      ...defaultState,
      source: String.raw`\bbox[0.12em,#f4cccc]{x}`,
    });

    const background = result.svgElement.querySelector('rect[fill="#f4cccc"]');
    expect(result.svgText).toContain('<svg');
    expect(background).not.toBeNull();
    expect(Number(background?.getAttribute('width'))).toBeGreaterThan(572);
    expect(Number(background?.getAttribute('height'))).toBeGreaterThan(453);
  });

  it('aligns palette bbox background vertical centers', async () => {
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
        center:
          Number(rect.getAttribute('y')) +
          Number(rect.getAttribute('height')) / 2,
      }),
    );

    expect(new Set(backgrounds.map((background) => background.center)).size).toBe(
      1,
    );
    expect(new Set(backgrounds.map((background) => background.height)).size).toBe(
      2,
    );
  });

  it('keeps palette bbox vertical center alignment scoped to each row', async () => {
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
          center:
            Number(rect.getAttribute('y')) +
            Number(rect.getAttribute('height')) / 2,
        })),
    );

    expect(rows).toHaveLength(2);
    expect(new Set(rows[0].map((background) => background.center)).size).toBe(1);
    expect(new Set(rows[1].map((background) => background.center)).size).toBe(1);
    expect(rows[0][0].height).not.toBe(rows[0][1].height);
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
