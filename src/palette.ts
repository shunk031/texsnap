export const colorPalette = [
  [
    [255, 255, 255],
    [255, 204, 204],
    [255, 204, 153],
    [255, 255, 153],
    [255, 255, 204],
    [153, 255, 153],
    [153, 255, 255],
    [204, 255, 255],
    [204, 204, 255],
    [255, 204, 255],
  ],
  [
    [204, 204, 204],
    [255, 102, 102],
    [255, 153, 102],
    [255, 255, 102],
    [255, 255, 51],
    [102, 255, 153],
    [51, 255, 255],
    [102, 255, 255],
    [153, 153, 255],
    [255, 153, 255],
  ],
  [
    [192, 192, 192],
    [255, 0, 0],
    [255, 153, 0],
    [255, 204, 102],
    [255, 255, 0],
    [51, 255, 51],
    [102, 204, 204],
    [51, 204, 255],
    [102, 102, 204],
    [204, 102, 204],
  ],
  [
    [153, 153, 153],
    [204, 0, 0],
    [255, 102, 0],
    [255, 204, 51],
    [255, 204, 0],
    [51, 204, 0],
    [0, 204, 204],
    [51, 102, 255],
    [102, 51, 255],
    [204, 51, 204],
  ],
  [
    [102, 102, 102],
    [153, 0, 0],
    [204, 102, 0],
    [204, 153, 51],
    [153, 153, 0],
    [0, 153, 0],
    [51, 153, 153],
    [51, 51, 255],
    [102, 0, 204],
    [153, 51, 153],
  ],
  [
    [51, 51, 51],
    [102, 0, 0],
    [153, 51, 0],
    [153, 102, 51],
    [102, 102, 0],
    [0, 102, 0],
    [51, 102, 102],
    [0, 0, 153],
    [51, 51, 153],
    [102, 51, 102],
  ],
  [
    [0, 0, 0],
    [51, 0, 0],
    [102, 51, 0],
    [102, 51, 51],
    [51, 51, 0],
    [0, 51, 0],
    [0, 51, 51],
    [0, 0, 102],
    [51, 0, 153],
    [51, 0, 51],
  ],
] as const;

export type Rgb = readonly [number, number, number];

export function wrapSelectionWithColor(
  source: string,
  start: number,
  end: number,
  rgb: Rgb,
): { source: string; start: number; end: number } {
  const [r, g, b] = rgb.map((channel) =>
    Math.round((channel / 255) * 100) / 100,
  );
  const selectionStart = Math.min(start, end);
  const selectionEnd = Math.max(start, end);
  const selected = source.slice(selectionStart, selectionEnd);
  const replacement = String.raw`\textcolor[rgb]{${r},${g},${b}}{${selected}}`;
  const updated =
    source.slice(0, selectionStart) + replacement + source.slice(selectionEnd);

  return {
    source: updated,
    start: selectionStart,
    end: selectionStart + replacement.length,
  };
}

export function isLightColor(rgb: Rgb): boolean {
  const [r, g, b] = rgb;
  return 0.299 * r + 0.587 * g + 0.114 * b > 128;
}
