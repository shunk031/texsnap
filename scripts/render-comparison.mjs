import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(
  process.argv[2] ?? '/tmp/texsnap-render-comparison',
);
mkdirSync(outputDir, { recursive: true });

const source = String.raw`\begin{align*}
\boldsymbol{G} = \{(\underbrace{\boldsymbol{b}_i}_{\mkern-70mu\mathclap{\text{要素 $i$ の bbox}}}, \underbrace{l_i}_{\mathrlap{\mkern-25mu\text{$i$ 番目のレイヤー}}})\}_{i=1}^{N}
\end{align*}`;
const comparisonPng = resolve(outputDir, 'comparison.png');
const pagePath = resolve(scriptDir, '.render-comparison.html');
writeFileSync(pagePath, buildComparisonPage(source));

const server = await createServer({
  root: resolve(scriptDir, '..'),
  server: { host: '127.0.0.1', port: 0 },
});

try {
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') {
    throw new Error('Vite did not expose a local HTTP address.');
  }

  const chrome = findChrome();
  const base = server.config.base.endsWith('/')
    ? server.config.base
    : `${server.config.base}/`;
  await renderPng(
    chrome,
    `http://127.0.0.1:${address.port}${base}scripts/.render-comparison.html`,
    comparisonPng,
  );
} finally {
  await server.close();
  unlinkSync(pagePath);
}

console.log(`comparison: ${comparisonPng}`);

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes('/') && existsSync(candidate)) return candidate;
    const result = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (result.status === 0) return result.stdout.trim();
  }

  throw new Error(
    'Chrome/Chromium was not found. Set CHROME_BIN to a headless browser.',
  );
}

function renderPng(chrome, url, pngPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      chrome,
      [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=5000',
        '--window-size=1800,1000',
        `--screenshot=${pngPath}`,
        url,
      ],
      { stdio: 'ignore' },
    );

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to render ${url} as PNG.`));
      }
    });
  });
}

function buildComparisonPage(source) {
  return `<!doctype html>
<meta charset="utf-8">
<title>TeXsnap render comparison</title>
<style>
  :root { color-scheme: light; font: 16px system-ui, sans-serif; }
  body { margin: 24px; background: #eef2f5; }
  main { display: grid; gap: 20px; grid-template-columns: 1fr 1fr; }
  section { min-width: 0; padding: 20px; background: #fff; border: 1px solid #ccd5dd; }
  h2 { margin: 0 0 16px; font-size: 18px; }
  .equation { min-height: 260px; display: grid; place-items: center; overflow: hidden; }
  .equation svg { display: block; width: 100%; height: auto; max-height: 700px; }
</style>
<main>
  <section><h2>導入前</h2><div class="equation" id="before"></div></section>
  <section><h2>導入後</h2><div class="equation" id="after"></div></section>
</main>
<script>
  const showError = (error) => {
    const detail = error instanceof Error ? error.stack || error.message : String(error);
    document.querySelectorAll('.equation').forEach((node) => {
      node.textContent = detail;
      node.style.whiteSpace = 'pre-wrap';
      node.style.color = '#b00020';
    });
  };
  window.addEventListener('error', (event) => showError(event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => showError(event.reason));
</script>
<script type="module">
  import { mathjax } from 'mathjax-full/js/mathjax.js';
  import { TeX } from 'mathjax-full/js/input/tex.js';
  import { SVG } from 'mathjax-full/js/output/svg.js';
  import { browserAdaptor } from 'mathjax-full/js/adaptors/browserAdaptor.js';
  import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
  import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
  import { renderEquation } from '/src/render.ts';

  const source = ${JSON.stringify(source)};
  const adaptor = browserAdaptor();
  RegisterHTMLHandler(adaptor);
  const html = mathjax.document(document, {
    InputJax: new TeX({ packages: AllPackages }),
    OutputJax: new SVG({ fontCache: 'none' }),
  });
  const before = adaptor.node('div', {}, [
    html.convert(source, { display: true }),
  ]).querySelector('svg');
  if (!before) throw new Error('MathJax did not return an SVG.');
  document.querySelector('#before').replaceChildren(before);

  const after = await renderEquation({
    source,
    resolution: 300,
    fontPreset: 'mathjax-tex',
    bold: false,
    whiteOnBlack: false,
    rendererMode: 'svg',
    backgroundMargin: '.12em',
  });
  document.querySelector('#after').replaceChildren(after.svgElement);
  document.body.dataset.ready = 'true';
</script>`;
}
