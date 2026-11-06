import { browser } from 'wxt/browser';
import './pages.css';

/** Tiny helpers shared by the extension's own pages: no framework, no remote assets. */

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

export function formatDate(iso: string | null): string {
  if (iso === null) return 'nunca';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
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

export function button(text: string, onClick: () => void, className = 'button'): HTMLButtonElement {
  const control = el('button', className, text);
  control.type = 'button';
  control.addEventListener('click', onClick);
  return control;
}
