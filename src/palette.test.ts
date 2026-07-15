import { describe, expect, it } from 'vitest';
import {
  backgroundPalette,
  isLightColor,
  updateBackgroundMargins,
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
      '.12em',
    );

    expect(result.source).toBe(String.raw`a + \bbox[.12em,#f4cccc]{x} + b`);
    expect(result.start).toBe(4);
    expect(result.end).toBe(27);
  });

  it('normalizes reversed selections', () => {
    const result = wrapSelectionWithBackground(
      'a + x + b',
      5,
      4,
      '#f4cccc',
      '.12em',
    );

    expect(result.source).toBe(String.raw`a + \bbox[.12em,#f4cccc]{x} + b`);
    expect(result.start).toBe(4);
    expect(result.end).toBe(27);
  });

  it('omits bbox margin when margin is zero', () => {
    const result = wrapSelectionWithBackground(
      'a + x + b',
      4,
      5,
      '#f4cccc',
      '0em',
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

  it('updates generated bbox background margins', () => {
    const source = String.raw`\bbox[#f4cccc]{x} + \bbox[2px,#d9ead3]{y}`;

    expect(updateBackgroundMargins(source, '.16em')).toBe(
      String.raw`\bbox[.16em,#f4cccc]{x} + \bbox[.16em,#d9ead3]{y}`,
    );
  });

  it('removes generated bbox margins when margin is zero', () => {
    const source = String.raw`\bbox[.12em,#f4cccc]{x}`;

    expect(updateBackgroundMargins(source, '0em')).toBe(
      String.raw`\bbox[#f4cccc]{x}`,
    );
  });

  it('leaves non-palette and complex bbox options unchanged', () => {
    const source =
      String.raw`\bbox[.12em,#123456]{x} + ` +
      String.raw`\bbox[.12em,border:1px solid #f4cccc,#f4cccc]{y}`;

    expect(updateBackgroundMargins(source, '.16em')).toBe(source);
  });

  it('detects light colors', () => {
    expect(isLightColor([255, 255, 255])).toBe(true);
    expect(isLightColor([0, 0, 0])).toBe(false);
  });
});
