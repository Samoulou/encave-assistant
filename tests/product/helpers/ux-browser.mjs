import { chromium } from '@playwright/test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function zoomBrowser() {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const directory = resolve(root, '.local'); await mkdir(directory, { recursive: true });
  const profile = await mkdtemp(join(directory, 'ux-profile-'));
  const extension = fileURLToPath(new URL('./zoom-extension', import.meta.url));
  let context;
  const removeOwnedProfile = async () => {
    const resolved = resolve(profile);
    if (!resolved.startsWith(directory + sep) || !resolved.slice(directory.length + 1).startsWith('ux-profile-')) throw new Error('Unexpected profile cleanup path');
    await rm(resolved, { recursive: true, force: true });
  };
  try {
    context = await chromium.launchPersistentContext(profile, { headless: true, channel: 'chromium', viewport: { width: 1440, height: 1000 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 10_000 });
    return {
      context,
      zoom: async (page, factor) => worker.evaluate(async ({ url, factor }) => {
        const tabs = await chrome.tabs.query({ url });
        if (tabs.length !== 1 || tabs[0].id === undefined) throw new Error('Expected one isolated test tab');
        await chrome.tabs.setZoom(tabs[0].id, factor);
        return chrome.tabs.getZoom(tabs[0].id);
      }, { url: page.url(), factor }),
      stop: async () => { await context.close(); await removeOwnedProfile(); },
    };
  } catch (error) { if (context) await context.close(); await removeOwnedProfile(); throw error; }
}
