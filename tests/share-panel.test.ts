import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { setLocale, t, type MessageKey } from '../src/core/i18n';
import { buildShareSummary } from '../src/core/share';
import {
  addApplication,
  appendCheck,
  getApplication,
  listChecks,
  type Check,
  type PlainIdentity,
} from '../src/core/storage';
import { sharePanel } from '../src/entrypoints/shared/share-panel';

const IDENTITY: PlainIdentity = {
  kind: 'plain',
  nie: 'X0000000X',
  numero: 'R500001',
  year: '2015',
  birthDate: '1990-01-01',
};

async function setup(withCheck = true): Promise<{
  panel: HTMLElement;
  id: string;
  checks: Check[];
  application: Awaited<ReturnType<typeof addApplication>>;
}> {
  const application = await addApplication({ label: 'Personal label', identity: IDENTITY });
  if (withCheck) {
    await appendCheck({
      applicationId: application.id,
      outcome: 'status',
      statusKey: 'abierto-registrado',
      raw: 'Abierto - Registrado.',
      subStatus: null,
    });
  }
  const checks = await listChecks(application.id);
  const panel = sharePanel(application, checks);
  document.body.append(panel);
  return { panel, id: application.id, checks, application };
}

function click(panel: HTMLElement, key: MessageKey): void {
  const found = [...panel.querySelectorAll('button')].find((item) => item.textContent === t(key));
  if (!found) throw new Error(`Missing button ${key}`);
  found.click();
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForNotice(panel: HTMLElement, key: MessageKey): Promise<void> {
  await vi.waitFor(() => {
    expect(panel.querySelector('[role="status"]')?.textContent).toBe(t(key));
  });
}

describe('sharePanel', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    document.body.replaceChildren();
    setLocale('es');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('starts closed and previews only the generated status summary', async () => {
    const { panel, checks } = await setup();
    expect((panel as HTMLDetailsElement).open).toBe(false);
    const preview = panel.querySelector('textarea');
    expect(preview?.value).toBe(buildShareSummary(checks, null));
    expect(preview?.value).not.toMatch(/Personal label|X0000000X|R500001|1990-01-01|error/i);
  });

  it('copies the preview on click and announces success', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { panel } = await setup();
    click(panel, 'share.copy');
    await flush();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(panel.querySelector('textarea')?.value);
    expect(panel.querySelector('[role="status"]')?.textContent).toBe(t('share.copied'));
  });

  it('selects the preview and announces the manual-copy hint when copying fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    const { panel } = await setup();
    const preview = panel.querySelector('textarea') as HTMLTextAreaElement;
    click(panel, 'share.copy');
    await flush();
    expect(document.activeElement).toBe(preview);
    expect(preview.selectionEnd).toBe(preview.value.length);
    expect(panel.querySelector('[role="status"]')?.textContent).toBe(t('share.copyFailed'));
  });

  it('saves and clears the filing date and updates the preview', async () => {
    const { panel, id, checks } = await setup();
    const date = panel.querySelector('input[type="date"]') as HTMLInputElement;
    date.value = '2026-01-15';
    click(panel, 'share.saveDate');
    await waitForNotice(panel, 'share.dateSaved');
    expect(await getApplication(id)).toMatchObject({ filingDate: '2026-01-15' });
    expect(panel.querySelector('textarea')?.value).toBe(buildShareSummary(checks, '2026-01-15'));
    click(panel, 'share.clearDate');
    await waitForNotice(panel, 'share.dateCleared');
    expect(await getApplication(id)).not.toHaveProperty('filingDate');
    expect(panel.querySelector('textarea')?.value).toBe(buildShareSummary(checks, null));
  });

  it('refuses future, after-check and impossible dates without storing them', async () => {
    const { panel, id } = await setup();
    const date = panel.querySelector('input[type="date"]') as HTMLInputElement;
    date.value = '2999-01-01';
    click(panel, 'share.saveDate');
    await flush();
    expect(panel.querySelector('[role="status"]')?.textContent).toBe(
      t('validation.filingDateFuture'),
    );
    expect(await getApplication(id)).not.toHaveProperty('filingDate');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2025, 0, 1, 12));
    const oldCheckSetup = await setup();
    vi.setSystemTime(new Date(2025, 0, 3, 12));
    const oldDate = oldCheckSetup.panel.querySelector('input[type="date"]') as HTMLInputElement;
    oldDate.value = '2025-01-02';
    click(oldCheckSetup.panel, 'share.saveDate');
    await flush();
    expect(oldCheckSetup.panel.querySelector('[role="status"]')?.textContent).toBe(
      t('validation.filingDateAfterCheck'),
    );
    expect(await getApplication(oldCheckSetup.id)).not.toHaveProperty('filingDate');
    vi.useRealTimers();

    const savedSetup = await setup();
    const savedDate = savedSetup.panel.querySelector('input[type="date"]') as HTMLInputElement;
    savedDate.value = '2026-01-15';
    click(savedSetup.panel, 'share.saveDate');
    await waitForNotice(savedSetup.panel, 'share.dateSaved');
    savedDate.value = '';
    Object.defineProperty(savedDate, 'validity', {
      configurable: true,
      value: { badInput: true },
    });
    click(savedSetup.panel, 'share.saveDate');
    await flush();
    expect(savedSetup.panel.querySelector('[role="status"]')?.textContent).toBe(
      t('validation.filingDate'),
    );
    expect(await getApplication(savedSetup.id)).toMatchObject({ filingDate: '2026-01-15' });
  });

  it('shows an empty hint without a preview when no checks or date exist', async () => {
    const { panel } = await setup(false);
    expect(panel.querySelector('textarea')).toBeNull();
    expect(panel.textContent).toContain(t('share.nothing'));
  });

  it('adds the registration row when a filing date is saved before any checks', async () => {
    const { panel, id } = await setup(false);
    const date = panel.querySelector('input[type="date"]') as HTMLInputElement;
    date.value = '2026-01-15';
    click(panel, 'share.saveDate');
    await waitForNotice(panel, 'share.dateSaved');

    expect(await getApplication(id)).toMatchObject({ filingDate: '2026-01-15' });
    expect(panel.querySelector('textarea')?.value).toBe(
      `1. 15/01/2026 - Abierto - Registrado.\nGenerado con naciocheck.vgr.cat`,
    );
  });

  it('keeps the summary identical while labels follow the selected locale', async () => {
    const { panel, checks, application } = await setup();
    const spanishSummary = panel.querySelector('textarea')?.value;
    setLocale('en');
    const englishPanel = sharePanel(application, checks);
    expect(englishPanel.querySelector('summary')?.textContent).toBe(t('share.summary'));
    expect(englishPanel.querySelector('textarea')?.value).toBe(spanishSummary);
  });
});
