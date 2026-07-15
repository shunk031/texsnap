import { describe, expect, it } from 'vitest';
import { isLightColor, wrapSelectionWithColor } from './palette';

describe('palette', () => {
  it('wraps selected text with a rgb textcolor command', () => {
    const result = wrapSelectionWithColor('a + x + b', 4, 5, [255, 0, 0]);

    expect(result.source).toBe(String.raw`a + \textcolor[rgb]{1,0,0}{x} + b`);
    expect(result.start).toBe(4);
    expect(result.end).toBe(29);
  });

  it('detects light colors', () => {
    expect(isLightColor([255, 255, 255])).toBe(true);
    expect(isLightColor([0, 0, 0])).toBe(false);
  });
});
