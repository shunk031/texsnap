import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./render', () => ({
  renderEquation: vi.fn(async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '10ex');
    svg.setAttribute('height', '4ex');
    return {
      svgElement: svg,
      svgText: '<svg></svg>',
    };
  }),
}));

describe('main app shell', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(0, 0, 0, 0),
    });
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [],
    });
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('links to the GitHub repository from the footer', async () => {
    await import('./main');

    const link = document.querySelector<HTMLAnchorElement>('.repo-link');
    expect(link).not.toBeNull();
    expect(link?.href).toBe('https://github.com/shunk031/texsnap');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toBe('noreferrer');
    expect(link?.textContent).toContain('shunk031/texsnap');
    expect(link?.querySelector('svg')).not.toBeNull();
  });

  it('scales the preview SVG by the selected resolution', async () => {
    await import('./main');

    await vi.waitFor(() => {
      const svg = document.querySelector<SVGSVGElement>('.preview svg');
      expect(svg?.dataset.previewScale).toBe('2');
      expect(svg?.getAttribute('width')).toBe('20ex');
      expect(svg?.getAttribute('height')).toBe('8ex');
    });
  });
});
