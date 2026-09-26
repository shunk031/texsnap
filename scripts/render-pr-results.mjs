import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(
  process.argv[2] ?? 'artifacts/pr-render-results',
);
const cases = [
  {
    name: 'mathrlap-overflow',
    title: 'mathrlap overflow',
    source:
      '\\begin{align*}\n' +
      '\\boldsymbol{G} = \\{(\\underbrace{\\boldsymbol{b}_i}_{\\mkern-70mu\\mathclap{\\text{要素 $i$ の bbox}}}, \\underbrace{l_i}_{\\mathrlap{\\mkern-25mu\\text{$i$ 番目のレイヤー}}})\\}_{i=1}^{N}\n' +
      '\\end{align*}',
  },
  {
    name: 'bbox-background',
    title: 'bbox background',
    source:
      '\\bbox[0.12em,#f4cccc]{\\boldsymbol{G} = \\{(\\boldsymbol{b}_i,l_i)\\}_{i=1}^{N}}',
  },
  {
    name: 'aligned-equation',
    title: 'aligned equation',
    source:
      '\\begin{align*}\n' +
      '\\frac{a}{b} &= x + y \\\\\n' +
      '\\boldsymbol{G} &= \\{(b_i, l_i)\\}_{i=1}^{N}\n' +
      '\\end{align*}',
  },
];

mkdirSync(outputDir, { recursive: true });
const pagePath = resolve(scriptDir, '.render-pr-results.html');
writeFileSync(pagePath, buildPage(cases));

const server = await createServer({
  root: resolve(scriptDir, '..'),
  server: { host: '127.0.0.1', port: 0 },
});

let browser;
try {
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') {
    throw new Error('Vite did not expose a local HTTP address.');
  }

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  });
  const base = server.config.base.endsWith('/')
    ? server.config.base
    : server.config.base + '/';
  await page.goto(
    'http://127.0.0.1:' +
      address.port +
      base +
      'scripts/.render-pr-results.html',
    { waitUntil: 'networkidle' },
  );
  await page.waitForSelector('body[data-ready="true"]');

  for (const testCase of cases) {
    await page
      .locator('[data-case="' + testCase.name + '"]')
      .screenshot({
        path: resolve(outputDir, testCase.name + '.png'),
      });
  }
} finally {
  await browser?.close();
  await server.close();
  unlinkSync(pagePath);
}

console.log(
  'Rendered ' +
    cases.length +
    ' PR cases to ' +
    resolve(outputDir),
);

function buildPage(testCases) {
  return [
    '<!doctype html>',
    '<meta charset="utf-8">',
    '<title>TeXsnap PR render results</title>',
    '<style>',
    ':root { color-scheme: light; font: 16px system-ui, sans-serif; }',
    'body { margin: 0; padding: 24px; background: #eef2f5; }',
    'main { display: grid; gap: 24px; }',
    'section { width: 1200px; box-sizing: border-box; padding: 24px; background: #fff; border: 1px solid #ccd5dd; }',
    'h2 { margin: 0 0 16px; font-size: 18px; }',
    '.equation { min-height: 260px; display: grid; place-items: center; }',
    '.equation svg { display: block; width: 100%; height: auto; max-height: 700px; }',
    '</style>',
    '<main id="results"></main>',
    '<script type="module">',
    "import { renderEquation } from '/src/render.ts';",
    'const cases = ' + JSON.stringify(testCases) + ';',
    "const root = document.querySelector('#results');",
    'for (const testCase of cases) {',
    "  const section = document.createElement('section');",
    '  section.dataset.case = testCase.name;',
    "  const heading = document.createElement('h2');",
    '  heading.textContent = testCase.title;',
    "  const equation = document.createElement('div');",
    '  equation.className = "equation";',
    '  const result = await renderEquation({',
    '    source: testCase.source,',
    '    resolution: 300,',
    "    fontPreset: 'mathjax-tex',",
    '    bold: false,',
    '    whiteOnBlack: false,',
    "    rendererMode: 'svg',",
    "    backgroundMargin: '.12em',",
    '  });',
    '  equation.replaceChildren(result.svgElement);',
    '  section.append(heading, equation);',
    '  root.append(section);',
    '}',
    "document.body.dataset.ready = 'true';",
    '</script>',
  ].join('\n');
}
