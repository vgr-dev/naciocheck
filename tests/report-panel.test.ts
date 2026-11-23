import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { t } from '../src/core/i18n';
import { reportPanel } from '../src/entrypoints/shared/report-panel';

/** The report panel: closed by default, the text editable, Copy and Continue each doing one thing. */

const REPORT = 'NacioCheck report\noutcome: error\nstatusKey: unknown\ncomment:';

function mount(locale: 'es' | 'en' = 'en'): HTMLElement {
  const panel = reportPanel(REPORT, locale);
  document.body.append(panel);
  return panel;
}

function textarea(panel: HTMLElement): HTMLTextAreaElement {
  const field = panel.querySelector('textarea');
  if (field === null) throw new Error('no textarea');
  return field;
}

function click(panel: HTMLElement, text: string): void {
  const control = [...panel.querySelectorAll('button')].find((b) => b.textContent === text);
  if (control === undefined) throw new Error(`no button ${text}`);
  control.click();
}

function clipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('reportPanel', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('is a closed details with the summary, the intro and a labelled textarea holding the report', () => {
    const panel = mount();
    expect(panel.tagName).toBe('DETAILS');
    expect((panel as HTMLDetailsElement).open).toBe(false);
    expect(panel.querySelector('summary')?.textContent).toBe(t('report.summary'));
    expect(panel.textContent).toContain(t('report.intro'));
    const field = textarea(panel);
    expect(field.value).toBe(REPORT);
    expect(field.spellcheck).toBe(false);
    expect(panel.querySelector(`label[for="${field.id}"]`)?.textContent).toBe(
      t('report.textLabel'),
    );
  });

  it('takes another summary key', () => {
    const panel = reportPanel(REPORT, 'en', 'statuses.explanationWrong');
    expect(panel.querySelector('summary')?.textContent).toBe(t('statuses.explanationWrong'));
  });

  it('gives each panel its own textarea id', () => {
    expect(textarea(mount()).id).not.toBe(textarea(mount()).id);
  });

  it('Continue opens one tab on the feedback page with the edited text in the fragment', () => {
    const create = vi.spyOn(browser.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    const panel = mount('en');
    textarea(panel).value = `${REPORT} my own words & more`;
    click(panel, t('report.continue'));

    expect(create).toHaveBeenCalledTimes(1);
    const { url } = create.mock.calls[0]?.[0] ?? {};
    const address = new URL(url ?? '');
    expect(address.host).toBe('naciocheck.vgr.cat');
    expect(address.pathname).toBe('/en/feedback/');
    expect(decodeURIComponent(address.hash.slice(1))).toBe(`${REPORT} my own words & more`);
  });

  it('Continue uses the Spanish page for es', () => {
    const create = vi.spyOn(browser.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    click(mount('es'), t('report.continue'));
    expect(new URL(create.mock.calls[0]?.[0].url ?? '').pathname).toBe('/feedback/');
  });

  it('Copy writes the edited text and announces it', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    clipboard(writeText);
    const create = vi.spyOn(browser.tabs, 'create');
    const panel = mount();
    textarea(panel).value = 'edited';
    click(panel, t('report.copy'));
    await flush();

    expect(writeText).toHaveBeenCalledExactlyOnceWith('edited');
    expect(create).not.toHaveBeenCalled();
    const note = panel.parentElement?.querySelector('p.saved');
    expect(note?.textContent).toBe(t('report.copied'));
    expect(note?.getAttribute('role')).toBe('status');
  });

  it('Copy failure selects the text and announces the fallback', async () => {
    clipboard(vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error('denied')));
    const panel = mount();
    const field = textarea(panel);
    click(panel, t('report.copy'));
    await flush();

    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(field.value.length);
    expect(panel.querySelector('p.saved')?.textContent).toBe(t('report.copyFailed'));
  });

  it('Copy without a clipboard takes the failure path', async () => {
    const panel = mount();
    click(panel, t('report.copy'));
    await flush();
    expect(panel.querySelector('p.saved')?.textContent).toBe(t('report.copyFailed'));
  });
});
