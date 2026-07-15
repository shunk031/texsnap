import { describe, expect, it } from 'vitest';
import { defaultState } from './state';
import { prepareSource, renderEquation } from './render';

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
      source: String.raw`\bbox[.12em,#f4cccc]{x}`,
    });

    const background = result.svgElement.querySelector('rect[fill="#f4cccc"]');
    expect(result.svgText).toContain('<svg');
    expect(background).not.toBeNull();
    expect(Number(background?.getAttribute('width'))).toBeGreaterThan(572);
  });
});
