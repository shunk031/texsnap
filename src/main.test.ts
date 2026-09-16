import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completionStatus,
  startCompletion,
} from '@codemirror/autocomplete';
import { EditorView, runScopeHandlers } from '@codemirror/view';

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

  it('accepts an active completion with Tab and indents otherwise', async () => {
    await import('./main');

    const content = document.querySelector<HTMLElement>('.cm-content');
    const view = content ? EditorView.findFromDOM(content) : null;
    expect(view).not.toBeNull();
    if (!view) return;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: String.raw`\fr` },
      selection: { anchor: 3 },
    });
    startCompletion(view);

    await vi.waitFor(() => {
      expect(completionStatus(view.state)).toBe('active');
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(
      runScopeHandlers(
        view,
        new KeyboardEvent('keydown', { key: 'Tab' }),
        'editor',
      ),
    ).toBe(true);
    expect(view.state.doc.toString()).toBe(String.raw`\frac`);

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: 'x' },
      selection: { anchor: 1 },
    });
    runScopeHandlers(
      view,
      new KeyboardEvent('keydown', { key: 'Tab' }),
      'editor',
    );
    expect(view.state.doc.toString()).toBe('  x');
    view.destroy();
  });
});
