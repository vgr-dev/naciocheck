import { t } from '../../core/i18n';
import './brand.css';

/**
 * The product's mark and name, for the top of a page that has no title saying it (the result pages and unlock).
 *
 * The static icon, not the animated one: the animated logo is for moments (onboarding, the changed-status alert),
 * never for chrome (`brand/README.md`). It is a `div`, not a heading, so the page keeps its own `h1`.
 */
export function brandHeader(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'brand';

  const icon = document.createElement('img');
  icon.src = '/icon/128.png';
  icon.alt = '';
  icon.width = 32;
  icon.height = 32;

  const name = document.createElement('span');
  name.className = 'brand-name';
  name.textContent = t('app.title');

  header.append(icon, name);
  return header;
}
