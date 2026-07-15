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
