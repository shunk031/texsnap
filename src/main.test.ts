import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptCompletion,
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

  it.each([
    ['resolution', 'resolution', '600'],
    ['font preset', 'fontPreset', 'mathjax-newcm'],
    ['bold', 'bold', true],
    ['white-on-black', 'whiteOnBlack', true],
    ['renderer mode', 'rendererMode', 'png-white'],
    ['background margin', 'backgroundMargin', '.16em'],
  ])('rerenders when the %s setting changes', async (_label, id, value) => {
    await import('./main');
    const { renderEquation } = await import('./render');
    const renderMock = vi.mocked(renderEquation);
    await vi.waitFor(() => expect(renderMock).toHaveBeenCalled());
    renderMock.mockClear();

    const control = document.querySelector<HTMLInputElement | HTMLSelectElement>(
      `#${id}`,
    );
    expect(control).not.toBeNull();
    if (!control) return;

    if (control instanceof HTMLInputElement) {
      control.checked = value === true;
    } else {
      control.value = String(value);
    }
    control.dispatchEvent(new Event('change'));

    await vi.waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));
  });

  it('rerenders after applying a palette color', async () => {
    await import('./main');
    const { renderEquation } = await import('./render');
    const renderMock = vi.mocked(renderEquation);
    await vi.waitFor(() => expect(renderMock).toHaveBeenCalled());
    renderMock.mockClear();

    const swatch = document.querySelector<HTMLButtonElement>('.text-color-swatch');
    expect(swatch).not.toBeNull();
    swatch?.click();

    await vi.waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));
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

  it.each([
    [String.raw`$\mathcl`, String.raw`$\mathclap`],
    [String.raw`$\boldsym`, String.raw`$\boldsymbol`],
  ])('offers %s as a completion', async (source, expected) => {
    await import('./main');

    const content = document.querySelector<HTMLElement>('.cm-content');
    const view = content ? EditorView.findFromDOM(content) : null;
    expect(view).not.toBeNull();
    if (!view) return;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: source },
      selection: { anchor: source.length },
    });
    startCompletion(view);

    await vi.waitFor(() => {
      expect(completionStatus(view.state)).toBe('active');
    });

    await vi.waitFor(() => {
      expect(acceptCompletion(view)).toBe(true);
    });
    expect(view.state.doc.toString()).toBe(expected);
    view.destroy();
  });
});
