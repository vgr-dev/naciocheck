/**
 * `CHANGELOG.md` parser and renderer for the static site. No dependency and no I/O: the caller reads the
 * file and writes the page.
 *
 * The accepted input is a small subset of Keep a Changelog: an optional `# ` title and prose before the first
 * release, then `## [Unreleased]` or `## [x.y.z] - YYYY-MM-DD`, `### Added|Changed|Fixed|Removed|Security`,
 * `- ` items (with indented continuation lines) and inline `code` and **bold**. Anything else throws with the
 * line number. Links are refused on purpose: an outbound link has to pass the site gate, and the renderer adds
 * the one it allows (the GitHub release) itself.
 */

export const SECTION_HEADINGS = ['Added', 'Changed', 'Fixed', 'Removed', 'Security'];

const REPOSITORY_URL = 'https://github.com/vgr-dev/naciocheck';
const RELEASE_HEADING = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/;
const INLINE_TOKEN = /(`[^`]+`|\*\*[^*`]+\*\*)/;

function fail(line, message) {
  throw new Error(`CHANGELOG.md line ${line}: ${message}`);
}

function isRealDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Splits item text into plain, code and bold parts, and throws on anything left over that looks like Markdown. */
function inlineParts(text, line) {
  if (/\]\(|\]\[|^\s*\[[^\]]*\]:|<https?:|https?:\/\//i.test(text)) {
    fail(line, 'links are not allowed');
  }
  return text
    .split(INLINE_TOKEN)
    .filter((part) => part !== '')
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return { kind: 'code', text: part.slice(1, -1) };
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return { kind: 'bold', text: part.slice(2, -2) };
      }
      if (part.includes('`') || part.includes('**'))
        fail(line, `unbalanced inline markup in "${part}"`);
      return { kind: 'text', text: part };
    });
}

/**
 * @param {string} text the whole file
 * @returns {{ version: string, date: string | null, sections: { heading: string, items: string[] }[] }[]}
 */
export function parseChangelog(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const releases = [];
  let release = null;
  let section = null;
  let sectionLine = 0;
  let itemOpen = false;

  const closeSection = () => {
    if (section && section.items.length === 0)
      fail(sectionLine, `section "${section.heading}" has no items`);
    section = null;
    itemOpen = false;
  };

  lines.forEach((raw, index) => {
    const n = index + 1;
    const line = raw.replace(/\s+$/, '');
    if (line === '') {
      itemOpen = false;
      return;
    }

    if (line.startsWith('## ')) {
      closeSection();
      const match = RELEASE_HEADING.exec(line);
      if (line === '## [Unreleased]') {
        release = { version: 'Unreleased', date: null, sections: [] };
      } else if (match) {
        if (!isRealDate(match[2])) fail(n, `"${match[2]}" is not a valid date`);
        release = { version: match[1], date: match[2], sections: [] };
      } else {
        fail(n, `unknown release heading "${line}"`);
      }
      if (releases.some((r) => r.version === release.version))
        fail(n, `duplicate release "${release.version}"`);
      releases.push(release);
      return;
    }

    if (line.startsWith('#')) {
      if (line.startsWith('### ')) {
        const heading = line.slice(4);
        if (!release) fail(n, 'a section needs a release heading before it');
        if (!SECTION_HEADINGS.includes(heading)) {
          fail(n, `unknown heading "${heading}" (expected ${SECTION_HEADINGS.join(', ')})`);
        }
        closeSection();
        if (release.sections.some((s) => s.heading === heading)) {
          fail(n, `duplicate section "${heading}" in ${release.version}`);
        }
        section = { heading, items: [] };
        sectionLine = n;
        release.sections.push(section);
        return;
      }
      if (!release && /^# \S/.test(line)) return; // the title
      fail(n, `unknown heading "${line}"`);
    }

    if (!release) return; // the preamble is never rendered

    if (line.startsWith('- ')) {
      if (!section) fail(n, 'an item needs a section heading before it');
      const body = line.slice(2).trim();
      if (body === '') fail(n, 'empty item');
      inlineParts(body, n);
      section.items.push(body);
      itemOpen = true;
      return;
    }

    if (itemOpen && section && /^ {2,}\S/.test(line)) {
      const body = line.trim();
      inlineParts(body, n);
      section.items[section.items.length - 1] += ` ${body}`;
      return;
    }

    fail(n, `unexpected text "${line.slice(0, 40)}"`);
  });
  closeSection();

  // Items that continue over several lines are checked again as a whole, so markup cannot straddle lines.
  for (const r of releases) {
    for (const s of r.sections) {
      for (const item of s.items) inlineParts(item, 0);
    }
  }
  return releases;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(item) {
  return inlineParts(item, 0)
    .map(({ kind, text }) => {
      const safe = escapeHtml(text);
      if (kind === 'code') return `<code>${safe}</code>`;
      if (kind === 'bold') return `<strong>${safe}</strong>`;
      return safe;
    })
    .join('');
}

/**
 * Renders the dated releases (`Unreleased` is left out) as HTML. The entries are English whatever the page
 * language, so outside `en` the block is marked `lang="en"`.
 *
 * @param {{ version: string, date: string | null, sections: { heading: string, items: string[] }[] }[]} releases
 * @param {{ lang: string, strings: { noReleases: string, githubRelease: string }, repositoryPublic: boolean }} options
 */
export function renderChangelog(releases, { lang, strings, repositoryPublic }) {
  const dated = releases.filter((r) => r.version !== 'Unreleased' && r.date !== null);
  if (dated.length === 0) {
    return `<p class="changelog-empty">${escapeHtml(strings.noReleases)}</p>`;
  }
  const langAttr = lang === 'en' ? '' : ' lang="en"';
  const articles = dated.map((release) => {
    const version = escapeHtml(release.version);
    const date = escapeHtml(release.date);
    const sections = release.sections
      .map((section) => {
        const items = section.items.map((item) => `<li>${renderInline(item)}</li>`).join('');
        return `<section><h3>${escapeHtml(section.heading)}</h3><ul>${items}</ul></section>`;
      })
      .join('');
    const link = repositoryPublic
      ? `<p class="release-link"><a href="${REPOSITORY_URL}/releases/tag/v${version}">${escapeHtml(strings.githubRelease)}</a></p>`
      : '';
    return (
      `<article class="release" id="v${version}"${langAttr}>` +
      `<h2>${version} <time datetime="${date}">${date}</time></h2>${sections}${link}</article>`
    );
  });
  return articles.join('\n');
}
