// node props.cjs <outdir> [name ...]: render the investigation prop layers (props.html) to PNG (density 2, transparent)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const [outDir, ...only] = process.argv.slice(2);
const ROOT = __dirname;
const srv = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); res.end(d); });
});
srv.listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('PAGE', m.text()); });
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/props.html`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const names = only.length ? only : await page.evaluate(() => window.jobList);
  fs.mkdirSync(outDir, { recursive: true });
  for (const n of names) {
    const out = await page.evaluate(async n => window.renderJobs([n]), n);
    if (!out[n]) { console.log('no builder', n); continue; }
    fs.writeFileSync(path.join(outDir, n + '.png'), Buffer.from(out[n].split(',')[1], 'base64'));
    console.log('rendered', n);
  }
  await browser.close(); srv.close();
});
