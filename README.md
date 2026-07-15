# TeXsnap

TeXsnap is a small, static TeX equation image generator inspired by TeXclip.
It is designed for GitHub Pages, so rendering runs entirely in the browser with
MathJax and does not require PHP, TeX Live, Ghostscript, or a server API.

## Features

- TeX source editor with `Ctrl+S` / `Cmd+S` rendering
- MathJax SVG preview
- Color palette that wraps selected source with `\textcolor[rgb]{...}{...}`
- SVG download and clipboard copy
- PNG download and clipboard copy through browser canvas rendering
- Resolution, font-style preset, bold, white-on-black, and renderer-mode controls
- URL hash sharing and local settings persistence

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

## GitHub Pages

The Vite base path is fixed to `/texsnap/`, matching the expected project page:

```text
https://shunk031.github.io/texsnap/
```

The repository includes `.github/workflows/pages.yml`, which builds `dist/` and
deploys it with GitHub Pages Actions when `main` is pushed.

## Differences from TeXclip

TeXclip uses a server-side renderer for PNG, EPS, and SVG output. TeXsnap is
static-only, so it intentionally omits EPS generation and full TeX Live font
compatibility. Use the SVG output directly in Illustrator, Keynote, or
PowerPoint, or convert SVG to EPS with a separate tool when EPS is required.
