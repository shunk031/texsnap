import type { AppState, RenderResult } from './types';

export function downloadSvg(result: RenderResult): void {
  downloadBlob(
    new Blob([result.svgText], { type: 'image/svg+xml;charset=utf-8' }),
    buildFilename('svg'),
  );
}

export async function downloadPng(
  result: RenderResult,
  state: AppState,
): Promise<void> {
  const blob = await svgToPngBlob(result.svgText, state);
  downloadBlob(blob, buildFilename('png'));
}

export async function copySvg(result: RenderResult): Promise<void> {
  await navigator.clipboard.writeText(result.svgText);
}

export async function copyPng(
  result: RenderResult,
  state: AppState,
): Promise<void> {
  const blob = await svgToPngBlob(result.svgText, state);
  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type]: blob,
    }),
  ]);
}

async function svgToPngBlob(
  svgText: string,
  state: AppState,
): Promise<Blob> {
  const image = await loadImage(svgText);
  const scale = state.resolution / 150;
  const canvas = document.createElement('canvas');
  const width = Math.ceil(image.width * scale);
  const height = Math.ceil(image.height * scale);
  canvas.width = Math.max(width, 1);
  canvas.height = Math.max(height, 1);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available.');

  if (state.rendererMode === 'png-white' || state.whiteOnBlack) {
    context.fillStyle = state.whiteOnBlack ? '#000000' : '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.scale(scale, scale);
  context.drawImage(image, 0, 0);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG export failed.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function loadImage(svgText: string): Promise<HTMLImageElement> {
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const image = new Image();

  return new Promise((resolve, reject) => {
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG image loading failed.'));
    };
    image.src = url;
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildFilename(extension: 'svg' | 'png'): string {
  const stamp = new Date()
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\..+$/, '');
  return `texsnap-${stamp}.${extension}`;
}
