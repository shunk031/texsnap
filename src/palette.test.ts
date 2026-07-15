import { describe, expect, it } from 'vitest';
import {
  backgroundPalette,
  isLightColor,
  wrapSelectionWithBackground,
  wrapSelectionWithColor,
} from './palette';

describe('palette', () => {
  it('wraps selected text with a rgb textcolor command', () => {
    const result = wrapSelectionWithColor('a + x + b', 4, 5, [255, 0, 0]);

    expect(result.source).toBe(String.raw`a + \textcolor[rgb]{1,0,0}{x} + b`);
    expect(result.start).toBe(4);
    expect(result.end).toBe(29);
  });

  it('wraps selected text with a bbox background command', () => {
    const result = wrapSelectionWithBackground(
      'a + x + b',
      4,
      5,
      '#f4cccc',
      '2px',
    );

    expect(result.source).toBe(String.raw`a + \bbox[2px,#f4cccc]{x} + b`);
    expect(result.start).toBe(4);
    expect(result.end).toBe(25);
  });

  it('normalizes reversed selections', () => {
    const result = wrapSelectionWithBackground(
      'a + x + b',
      5,
      4,
      '#f4cccc',
      '2px',
    );

    expect(result.source).toBe(String.raw`a + \bbox[2px,#f4cccc]{x} + b`);
    expect(result.start).toBe(4);
    expect(result.end).toBe(25);
  });

  it('omits bbox margin when margin is zero', () => {
    const result = wrapSelectionWithBackground(
      'a + x + b',
      4,
      5,
      '#f4cccc',
      '0px',
    );

    expect(result.source).toBe(String.raw`a + \bbox[#f4cccc]{x} + b`);
    expect(result.start).toBe(4);
    expect(result.end).toBe(21);
  });

  it('uses the lightest Google color names and hex values', () => {
    expect(backgroundPalette).toEqual([
      { name: 'light red berry 3', hex: '#e6b8af' },
      { name: 'light red 3', hex: '#f4cccc' },
      { name: 'light orange 3', hex: '#fce5cd' },
      { name: 'light yellow 3', hex: '#fff2cc' },
      { name: 'light green 3', hex: '#d9ead3' },
      { name: 'light cyan 3', hex: '#d0e0e3' },
      { name: 'light cornflower blue 3', hex: '#c9daf8' },
      { name: 'light blue 3', hex: '#cfe2f3' },
      { name: 'light purple 3', hex: '#d9d2e9' },
      { name: 'light magenta 3', hex: '#ead1dc' },
    ]);
  });

  it('detects light colors', () => {
    expect(isLightColor([255, 255, 255])).toBe(true);
    expect(isLightColor([0, 0, 0])).toBe(false);
  });
});
