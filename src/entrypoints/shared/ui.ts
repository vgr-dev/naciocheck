import { browser } from 'wxt/browser';
import { formatDate, t } from '../../core/i18n';
import './pages.css';

/** Tiny helpers shared by the extension's own pages: no framework, no remote assets. */

export { formatDate };

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== '') node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

export function root(): HTMLElement {
  const element = document.getElementById('app');
  if (element === null) throw new Error('Missing #app');
  return element;
}

/** One of the extension's own pages, as WXT types them from the entrypoints on disk. */
export type ExtensionPage = Parameters<typeof browser.runtime.getURL>[0];

/** Opens one of the extension's own pages in a new tab. */
export function openPage(path: ExtensionPage): void {
  void browser.tabs.create({ url: browser.runtime.getURL(path) });
}

export function link(text: string, onClick: () => void): HTMLAnchorElement {
  const anchor = el('a', 'link', text);
  anchor.href = '#';
  anchor.addEventListener('click', (event) => {
    event.preventDefault();
    onClick();
  });
  return anchor;
}

/**
 * A confirmation, right after the control that caused it, so it is on screen where the person is looking.
 *
 * It used to be appended to the end of the page, below everything, and nobody saw it. One at a time on a page, and
 * `role="status"`, so a screen reader announces it too.
 */
export function announceAfter(anchor: Element, text: string): void {
  for (const earlier of document.querySelectorAll('p.saved')) earlier.remove();
  const note = el('p', 'hint saved', text);
  note.setAttribute('role', 'status');
  anchor.after(note);
}

/**
 * Marks the card of the application that was just saved: a tinted card with a "Just added" badge, and brought into view
 * if it is off screen. The mark is a colour and a word, not an animation, so it does not depend on motion.
 */
export function markJustAdded(card: HTMLElement): void {
  card.classList.add('just-added');
  card.querySelector('.label')?.append(el('span', 'badge', t('options.justAdded')));
  card.scrollIntoView({ block: 'nearest' });
}

export function button(text: string, onClick: () => void, className = 'button'): HTMLButtonElement {
  const control = el('button', className, text);
  control.type = 'button';
  control.addEventListener('click', onClick);
  return control;
}
