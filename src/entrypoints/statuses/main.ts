import { STATUS_CATALOG, STATUS_DISCLAIMER } from '../../core/statuses';
import { el, root } from '../shared/ui';

/**
 * The status guide: every catalogue entry in stage order, with what it means, what you can do and where the
 * explanation comes from. Nothing here is official — the disclaimer says so.
 */

function main(): void {
  const view = root();
  view.append(el('h1', 'title', 'Qué significa cada estado'));
  view.append(el('p', 'subtitle', STATUS_DISCLAIMER.es));

  for (const entry of [...STATUS_CATALOG].sort((a, b) => a.stage - b.stage)) {
    const card = el('div', 'card');
    card.append(el('h3', '', entry.es.title));
    card.append(el('p', '', entry.es.explanation));
    card.append(el('p', '', `Qué puedes hacer: ${entry.es.whatYouCanDo}`));

    if (entry.officialDefinition === 'none') {
      card.append(el('p', 'hint', 'Sin definición oficial: las fuentes no coinciden.'));
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

main();
