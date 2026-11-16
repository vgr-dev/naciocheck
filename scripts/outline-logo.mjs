#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import * as fontkit from 'fontkit';

/**
 * Turns the live-text logos in `brand/` into outlined SVGs, so the shipped logo renders the same everywhere
 * without a font installed and without a remote font.
 *
 * Two fonts are involved, and both are pinned by SHA-256: the text is only the same text if the glyphs are the
 * same glyphs.
 *
 * - The wordmark is **Nunito ExtraBold (800)**, from the official Google Fonts repository. The repository ships
 *   one variable file, so the 800 instance is taken from it (`getVariation`) — its default instance is
 *   ExtraLight, which is not this logo.
 * - The tagline is the **system UI font**, as the brand says. A browser asked for weight 500 with only regular
 *   and bold installed renders the regular face, so the outlined tagline uses the regular one too. That face is
 *   whatever `fc-match system-ui` answers on the machine that runs this script, which is why its SHA-256 is
 *   checked: another machine has to install the same font (or set `TAGLINE_FONT`) to regenerate identical files.
 *
 * Sources (editable originals, live text): `brand/logo-horizontal-tagline.svg` (light) and
 * `brand/logo-horizontal-tagline-dark.svg` (dark). Outputs: wordmark alone and with a tagline, light and dark,
 * tagline in Spanish and in English (D7).
 */

const ROOT = resolve(import.meta.dirname, '..');
const BRAND = join(ROOT, 'brand');

const NUNITO_FILE = process.env.NUNITO ?? join(ROOT, '.cache/fonts/Nunito[wght].ttf');
const NUNITO_SHA256 = 'bb55a5ca5c2042335b3991af27c4d0705d0ef41cac6164ac737fd8f2a1e85207';

const TAGLINE_FILE =
  process.env.TAGLINE_FONT ??
  execFileSync('fc-match', ['-f', '%{file}', 'system-ui'], { encoding: 'utf8' }).trim();
const TAGLINE_SHA256 = '690243adfefe0ce154b547db6205794bd30ac4277275179517a90994f4980648';

const WORDMARK_WEIGHT = 800;

/** The English tagline, decided by the user (D7). */
const TAGLINE_EN = 'Your nationality application, up to date.';

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Fails with something a person can act on, instead of quietly outlining with the wrong glyphs. */
function assertFont(path, expected, what) {
  if (!existsSync(path)) {
    throw new Error(
      `${what}: ${path} is not there. See the header of this script for where it comes from.`,
    );
  }
  const actual = sha256(path);
  if (actual !== expected) {
    throw new Error(
      `${what}: ${path} is not the pinned font.\n  expected ${expected}\n  found    ${actual}\n` +
        'Install the pinned font, or point NUNITO / TAGLINE_FONT at the right file and update the constant.',
    );
  }
  return { path, sha256: actual, name: basename(path) };
}

/** Rounds to two decimals: enough for a logo, and it keeps the paths from doubling the file size. */
function round(value) {
  return Math.round(value * 100) / 100;
}

/**
 * The `d` of one run of text, placed with its baseline at `(x, y)`.
 *
 * `run.glyphs[i].path` is in font units with y pointing up; SVG has y pointing down, so every y is subtracted
 * from the baseline. `run.positions[i].xAdvance` already carries the kerning.
 */
function textPath(font, text, { x, y, size }) {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  const commands = [];
  let pen = 0;

  run.glyphs.forEach((glyph, index) => {
    const position = run.positions[index];
    const originX = x + pen * scale;
    for (const { command, args = [] } of glyph.path.commands) {
      const point = (px, py) => `${round(originX + px * scale)} ${round(y - py * scale)}`;
      if (command === 'moveTo') commands.push(`M${point(args[0], args[1])}`);
      else if (command === 'lineTo') commands.push(`L${point(args[0], args[1])}`);
      else if (command === 'quadraticCurveTo') {
        commands.push(`Q${point(args[0], args[1])} ${point(args[2], args[3])}`);
      } else if (command === 'bezierCurveTo') {
        commands.push(
          `C${point(args[0], args[1])} ${point(args[2], args[3])} ${point(args[4], args[5])}`,
        );
      } else if (command === 'closePath') commands.push('Z');
      else throw new Error(`Unexpected path command "${String(command)}" in ${text}`);
    }
    pen += position.xAdvance;
  });

  return { d: commands.join(''), width: pen * scale };
}

/** `<text>` with one `<tspan>` per colour, which is how the sources write the wordmark. */
function readWordmark(svg) {
  const match =
    /<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/.exec(svg);
  if (match === null) throw new Error('No wordmark <text> in the source logo');
  const runs = [];
  for (const tspan of match[4].matchAll(/<tspan fill="(#[0-9A-Fa-f]{6})">([^<]*)<\/tspan>/g)) {
    runs.push({ fill: tspan[1], text: tspan[2] });
  }
  if (runs.length === 0) throw new Error('The wordmark has no <tspan> runs');
  return { x: Number(match[1]), y: Number(match[2]), size: Number(match[3]), runs };
}

/** The tagline `<text>`: one fill, one run. */
function readTagline(svg) {
  const match =
    /<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*fill="(#[0-9A-Fa-f]{6})"[^>]*>([^<]*)<\/text>/.exec(
      svg,
    );
  if (match === null) throw new Error('No tagline <text> in the source logo');
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    size: Number(match[3]),
    fill: match[4],
    text: match[5],
  };
}

/** The icon: the circle and the two stroked strokes, which the outline does not touch. */
function readIcon(svg) {
  const beforeText = svg.slice(0, svg.indexOf('<text'));
  const elements = [...beforeText.matchAll(/<(?:circle|path)\b[^>]*\/>/g)].map((match) => match[0]);
  if (elements.length !== 3) {
    throw new Error(
      `Expected the circle and two strokes before the wordmark, found ${elements.length}`,
    );
  }
  return elements;
}

function readViewBox(svg) {
  const match = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  if (match === null) throw new Error('No viewBox in the source logo');
  return { width: Number(match[1]), height: Number(match[2]) };
}

/** Builds one outlined logo: the icon as it is, the wordmark split per colour, and optionally a tagline. */
function outline(source, { tagline, nunito, taglineFont, label }) {
  const icon = readIcon(source);
  const viewBox = readViewBox(source);
  const wordmark = readWordmark(source);
  const taglineBox = tagline === null ? null : readTagline(source);

  const wordmarkPaths = [];
  let pen = 0;
  for (const run of wordmark.runs) {
    const path = textPath(nunito, run.text, {
      x: wordmark.x + pen,
      y: wordmark.y,
      size: wordmark.size,
    });
    wordmarkPaths.push(`  <path fill="${run.fill}" d="${path.d}"/>`);
    pen += path.width;
  }

  let taglinePath = null;
  let width = viewBox.width;
  if (tagline !== null && taglineBox !== null) {
    const path = textPath(taglineFont, tagline, {
      x: taglineBox.x,
      y: taglineBox.y,
      size: taglineBox.size,
    });
    // The English tagline is longer than the Spanish one: the logo grows rather than clipping it.
    width = Math.max(viewBox.width, Math.ceil(taglineBox.x + path.width + 8));
    taglinePath = `  <path fill="${taglineBox.fill}" d="${path.d}"/>`;
  }

  const lines = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
      width +
      ' ' +
      viewBox.height +
      '" role="img" aria-label="' +
      label +
      '">',
    '  <!-- GENERATED by scripts/outline-logo.mjs — edit the live-text source instead, then run it again.',
    `       Wordmark: Nunito ExtraBold ${WORDMARK_WEIGHT} (variable font instanced at ${WORDMARK_WEIGHT}), sha256 ${nunito.sha256}.`,
    taglinePath === null
      ? '       No tagline in this variant.'
      : `       Tagline: ${taglineFont.name}, the system UI face here, sha256 ${taglineFont.sha256}.`,
    '  -->',
    ...icon.map((element) => `  ${element}`),
    ...wordmarkPaths,
    ...(taglinePath === null ? [] : [taglinePath]),
    '</svg>',
    '',
  ];

  return lines.join('\n');
}

const nunito = assertFont(NUNITO_FILE, NUNITO_SHA256, 'Nunito ExtraBold');
const taglineFont = assertFont(TAGLINE_FILE, TAGLINE_SHA256, 'The system UI font');
const boldNunito = fontkit.openSync(nunito.path).getVariation({ wght: WORDMARK_WEIGHT });
const taglineFace = fontkit.openSync(taglineFont.path);

const variants = [
  {
    source: 'logo-horizontal-tagline.svg',
    outputs: [
      { file: 'logo-horizontal-outlined-light.svg', tagline: null },
      { file: 'logo-horizontal-tagline-outlined-light.svg', tagline: 'source' },
      { file: 'logo-horizontal-tagline-outlined-light-en.svg', tagline: TAGLINE_EN },
    ],
  },
  {
    source: 'logo-horizontal-tagline-dark.svg',
    outputs: [
      { file: 'logo-horizontal-outlined-dark.svg', tagline: null },
      { file: 'logo-horizontal-tagline-outlined-dark.svg', tagline: 'source' },
      { file: 'logo-horizontal-tagline-outlined-dark-en.svg', tagline: TAGLINE_EN },
    ],
  },
];

for (const variant of variants) {
  const source = readFileSync(join(BRAND, variant.source), 'utf8');
  const sourceTagline = readTagline(source).text;

  for (const output of variant.outputs) {
    // `source` keeps the tagline the editable original carries; a string replaces it (the English one).
    const tagline = output.tagline === 'source' ? sourceTagline : output.tagline;
    const label = tagline === null ? 'NacioCheck' : `NacioCheck — ${tagline}`;
    const outlined = outline(source, {
      tagline,
      nunito: boldNunito,
      taglineFont: taglineFace,
      label,
    });
    writeFileSync(join(BRAND, output.file), outlined, 'utf8');
    console.log(
      `${output.file}: ${String(outlined.length)} bytes, ${tagline === null ? 'no tagline' : `tagline "${tagline}"`}`,
    );
  }
}
