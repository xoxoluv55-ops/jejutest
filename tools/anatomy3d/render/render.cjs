// node render.cjs <scene.json> <jobs.json> <outdir>
// Serves this directory + the scene file, renders each job with three.js in headless Chromium, writes PNGs.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const [sceneFile, jobsFile, outDir] = process.argv.slice(2);
const ROOT = __dirname;
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  const f = p === '/scene.json' ? path.resolve(sceneFile) : path.join(ROOT, p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/json' });
    res.end(d);
  });
});
srv.listen(0, async () => {
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('PAGE', m.text()); });
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.ready === true);
  const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });
  // render in chunks so the returned data URLs stay small
  for (let i = 0; i < jobs.length; i += 4) {
    const chunk = jobs.slice(i, i + 4);
    const out = await page.evaluate(async (jobs) => {
      if (!window.__scene) window.__scene = await (await fetch('/scene.json')).json();
      return window.renderJobs(window.__scene, jobs);
    }, chunk);
    for (const [name, url] of Object.entries(out)) {
      fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    }
    process.stdout.write(`rendered ${Math.min(i + 4, jobs.length)}/${jobs.length}\n`);
  }
  await browser.close(); srv.close();
});
