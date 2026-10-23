/* eslint-disable @typescript-eslint/no-require-imports -- a plain CommonJS dev script, run with node */
// Usage: pnpm dev --port 3100, then PLAYWRIGHT_CORE=<path to playwright-core> node scripts/ui-shots.cjs [outDir]
// Needs pnpm photos (fixture photos) and a Playwright Chromium install. Not a dependency of the app.
// Screenshot every UI state with mocked /api/* and Blob uploads. Dev-only, never shipped.
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const fs = require('fs');
const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const OUT = args[0] && !args[0].startsWith('--') ? args[0] : ROOT + '/shots';
// Default: the two names the design review reads (desktop-*, mobile-*). --widths 1440,1024,390 names files by width.
const WIDTHS = flag('--widths') ? flag('--widths').split(',').map(Number) : null;
const ARIA = args.includes('--aria');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:3100';
const fx = (p) => fs.readFileSync(ROOT + '/fixtures/photos/' + p);

const pass = { genderMatch: true, ageBandMatch: true, buildMatch: true, faceShapeMatch: true, stillTemplatePerson: false, reasons: '' };
const now = Date.now();
const jobBase = { id: 'job1', route: 'adult', parentJobId: null, createdAt: new Date(now - 74000).toISOString(), updatedAt: new Date().toISOString() };
const JOBS = {
  waiting: { ...jobBase, status: 'running', stage: 'making_versions', error: null, inputs: null, candidates: [], pollAfterMs: 600000 },
  done: { ...jobBase, status: 'done', stage: 'done', error: null,
    inputs: { template: '/img/template', users: ['/img/u1', '/img/u2'] },
    candidates: [
      { slot: 'a', model: 'x', attempt: 1, refused: false, refusalText: null, failed: false, bodyCheck: { ...pass, buildMatch: false }, score: 81, url: '/img/v1' },
      { slot: 'b', model: 'y', attempt: 1, refused: false, refusalText: null, failed: false, bodyCheck: pass, score: 88, url: '/img/v2' },
      { slot: 'retry', model: 'x', attempt: 1, refused: true, refusalText: 'no', failed: false, bodyCheck: null, score: null, url: null },
    ] },
  failed: { ...jobBase, status: 'failed', stage: 'failed', error: { code: 'NO_FACE', message: 'We could not find a face. Use a photo where your face is clear and facing the camera.' }, inputs: { template: '/img/template', users: ['/img/u1', '/img/u2'] }, candidates: [] },
};
// Review states: 4 selfies (the "+3" badge), and a 16:9 result that must show uncropped.
JOBS.done4 = { ...JOBS.done, inputs: { template: '/img/template', users: ['/img/u1', '/img/u2', '/img/u3', '/img/u4'] } };
JOBS.wide = { ...JOBS.done, candidates: JOBS.done.candidates.map((c) => (c.slot === 'b' ? { ...c, url: '/img/wide' } : c)) };
const IMGS = { template: 'templates/man-action.jpg', u1: 'man-a/1.jpg', u2: 'man-a/2.jpg', u3: 'man-a/3.jpg', u4: 'man-b/2.jpg', v1: 'man-a/3.jpg', v2: 'man-b/1.jpg' };

async function setup(page, { access = true, job = null }) {
  await page.route('**/api/access', (r) => r.request().method() === 'GET'
    ? r.fulfill({ json: { ok: access } })
    : r.fulfill({ status: 401, json: { error: { code: 'BAD_CODE', message: 'That code is not right. Check the email you got.' } } }));
  await page.route('**/api/upload', (r) => r.fulfill({ json: { type: 'blob.generate-client-token', clientToken: 'vercel_blob_client_storeabc_eyJ4IjoxfQ' } }));
  await page.route('https://vercel.com/api/blob/**', async (r) => {
    await new Promise((res) => setTimeout(res, 300));
    const u = new URL(r.request().url());
    const pathname = u.searchParams.get('pathname') || 'uploads/x.jpg';
    r.fulfill({ json: { url: 'https://storeabc.private.blob.vercel-storage.com/' + pathname, downloadUrl: '', pathname, contentType: 'image/jpeg', contentDisposition: 'inline', etag: 'x' } });
  });
  await page.route('**/api/jobs/job1', (r) => r.fulfill({ json: job }));
  await page.route('**/img/*', async (r) => {
    const key = r.request().url().split('/img/')[1];
    const body = key === 'wide' ? await require('sharp')(fx('templates/man-action.jpg')).resize(1600, 900, { fit: 'cover' }).jpeg().toBuffer() : fx(IMGS[key]);
    r.fulfill({ body, contentType: 'image/jpeg' });
  });
}

let current = '';
async function shot(page, name) {
  await page.waitForTimeout(/done|wide/.test(name) ? 3500 : 700);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  if (ARIA && current === 'first') {
    // One aria snapshot per state is enough: the tree is the same at every width.
    const state = name.replace(/^[^-]+-/, '');
    fs.writeFileSync(`${OUT}/${state}.aria.txt`, await page.locator('body').ariaSnapshot());
  }
}

(async () => {
  const browser = await chromium.launch();
  const sizes = WIDTHS ? WIDTHS.map((w) => [String(w), w, w <= 480 ? 844 : 900]) : [['desktop', 1440, 900], ['mobile', 390, 844]];
  for (const [vp, w, h] of sizes) {
    current = vp === sizes[0][0] ? 'first' : '';
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w <= 480 ? 2 : 1, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.head.appendChild(st);
    }));
    let page = await ctx.newPage();
    await setup(page, { access: false });
    await page.goto(BASE);
    await page.fill('#code', 'wrong-code');
    await page.click('button[type=submit]');
    await shot(page, `${vp}-1-gate-error`);
    await page.close();

    page = await ctx.newPage();
    await setup(page, {});
    await page.goto(BASE);
    await shot(page, `${vp}-2-moment-empty`);
    await page.click('text=Try this moment');
    await page.waitForSelector('text=Ready');
    await shot(page, `${vp}-3-moment-chosen`);
    await page.click('text=Next: your photos');
    await page.setInputFiles('input[type=file]', [ROOT + '/fixtures/photos/man-a/1.jpg', ROOT + '/fixtures/photos/man-a/2.jpg']);
    await page.waitForTimeout(1200);
    // A too-small photo to show the reason line.
    await page.setInputFiles('input[type=file]', { name: 'tiny.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') });
    await page.waitForTimeout(800);
    await shot(page, `${vp}-4-you`);
    await page.click('button:has-text("Check and start")');
    await shot(page, `${vp}-5-check`);
    await page.close();

    const NUM = { waiting: 6, done: 7, failed: 8, done4: 10, wide: 11 };
    for (const k of ['waiting', 'done', 'failed', 'done4', 'wide']) {
      page = await ctx.newPage();
      await setup(page, { job: JOBS[k] });
      await page.goto(BASE + '/?job=job1');
      await shot(page, `${vp}-${NUM[k]}-${k}`);
      if (k === 'done') {
        // The full-size viewer, opened from the first version.
        await page.click('button:has-text("Open full size")');
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${OUT}/${vp}-9-viewer.png` });
      }
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  console.log('ok');
})().catch((e) => { console.error(e); process.exit(1); });
