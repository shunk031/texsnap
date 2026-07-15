import { describe, expect, it } from 'vitest';
import { buildHashSource, defaultState, loadState, parseHashSource, saveState } from './state';

describe('state', () => {
  it('parses TeX source from hash', () => {
    expect(parseHashSource('#s=%5Cfrac%7Ba%7D%7Bb%7D')).toBe(String.raw`\frac{a}{b}`);
  });

  it('builds hash source', () => {
    expect(parseHashSource(buildHashSource(String.raw`\sqrt{x}`))).toBe(String.raw`\sqrt{x}`);
  });

  it('restores saved settings and lets hash source win', () => {
    const storage = window.localStorage;
    storage.clear();
    saveState(storage, {
      ...defaultState,
      source: 'ignored',
      resolution: 600,
      rendererMode: 'png-white',
      whiteOnBlack: true,
    });

    const loaded = loadState(storage, buildHashSource('from hash'));
    expect(loaded.source).toBe('from hash');
    expect(loaded.resolution).toBe(600);
    expect(loaded.rendererMode).toBe('png-white');
    expect(loaded.whiteOnBlack).toBe(true);
  });
});
