import { currentLocale, t } from '../../core/i18n';
import { STATUS_CATALOG, STATUS_DISCLAIMER } from '../../core/statuses';
import { initPageLocale } from '../shared/locale';
import { el, root } from '../shared/ui';

/**
 * The status guide: every catalogue entry in stage order, with what it means, what you can do and where the
 * explanation comes from. Nothing here is official — the disclaimer says so.
 */

async function main(): Promise<void> {
  const view = root();
  await initPageLocale();
  document.title = t('statuses.pageTitle');
  const content = currentLocale().content;
  view.append(el('h1', 'title', t('statuses.title')));
  view.append(el('p', 'subtitle', STATUS_DISCLAIMER[content]));

  for (const entry of [...STATUS_CATALOG].sort((a, b) => a.stage - b.stage)) {
    const card = el('div', 'card');
    card.append(el('h3', '', entry[content].title));
    card.append(el('p', '', entry[content].explanation));
    card.append(el('p', '', t('statuses.whatYouCanDo', { text: entry[content].whatYouCanDo })));

    if (entry.officialDefinition === 'none') {
      card.append(el('p', 'hint', t('statuses.noOfficialDefinition')));
    }

    const sources = el('ul', 'sources');
    for (const source of entry.sources) {
      const item = el('li');
      const anchor = el('a', 'link', source.label);
      anchor.href = source.url;
      anchor.rel = 'noreferrer noopener';
      item.append(anchor);
      sources.append(item);
    }
    card.append(sources);
    view.append(card);
  }
}

void main();
