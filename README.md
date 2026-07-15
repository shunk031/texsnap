# TeXsnap

[![Deploy to GitHub Pages](https://github.com/shunk031/texsnap/actions/workflows/pages.yml/badge.svg)](https://github.com/shunk031/texsnap/actions/workflows/pages.yml)

TeXsnap is a small, static TeX equation image generator. It runs entirely in the browser with MathJax and does not require PHP, TeX Live, Ghostscript, or a server API.

## Features

- TeX source editor with <kbd>Ctrl</kbd>+<kbd>S</kbd> / <kbd>Cmd</kbd>+<kbd>S</kbd> rendering
- MathJax SVG preview
- Text color palette and Google Slides-style recommended background colors with adjustable margins
- SVG download and clipboard copy
- PNG download and clipboard copy through browser canvas rendering
- Resolution, font-style preset, bold, white-on-black, and renderer-mode controls
- URL hash sharing and local settings persistence

## Usage Tips

Use `\phantom{={}}` instead of `\quad` when stacked `\bbox` terms should start at the same position after an aligned equals sign.

```tex
\begin{align*}
R(A)
&= \bbox[0.08em,#f4cccc]{a_0} \\
&\phantom{={}} \bbox[0.08em,#fce5cd]{+ a_1} \\
&\phantom{={}} \bbox[0.08em,#fff2cc]{- a_2}
\end{align*}
```

## Development

```bash
npm install
npm run dev
```

Run checks before publishing:

```bash
npm test
npm run build
```

## Acknowledgements

TeXsnap owes a great deal to [TeXclip](https://texclip.marutank.net/). TeXclip set the standard for a focused, browser-based TeX equation image workflow: write TeX, generate a clean image, and move it into slides, documents, or design tools with very little friction.

Our TeXsnap is a small, static tribute to that excellent workflow. It keeps the core interaction lightweight enough to run on GitHub Pages, while TeXclip's server-side renderer remains the more complete reference for PNG, EPS, SVG, and full TeX Live font support.
