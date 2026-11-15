// Playwright smoke test: loads web/index.html at iPad landscape size, routes the three.js CDN URL to a local copy.
const { chromium } = require("playwright"), path = require("path"), fs = require("fs");
const THREE_LOCAL = process.env.THREE_LOCAL, OUT = process.env.OUT || "/tmp/nr_shots";
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, hasTouch: true });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\//, r => { const rel = r.request().url().split("three@0.160.0/")[1]; r.fulfill({ body: fs.readFileSync(path.join(THREE_LOCAL, rel)), contentType: "text/javascript", headers: { "Access-Control-Allow-Origin": "*" } }); });
  await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message)); page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  const url = "file://" + path.resolve(__dirname, "../index.html");
  const mode = process.argv[2] || "ui";
  if (mode === "ui") {
    await page.goto(url); await page.waitForTimeout(2500); await page.screenshot({ path: OUT + "/01_title.png" });
    await page.click("[data-act=stages]"); await page.waitForTimeout(400); await page.screenshot({ path: OUT + "/02_stages.png" });
    await page.click("[data-stage=ch1]"); await page.waitForTimeout(800); await page.screenshot({ path: OUT + "/03_dialog.png" });
    for (let i = 0; i < 6; i++) { await page.mouse.click(590, 700); await page.waitForTimeout(150); }
    await page.waitForTimeout(5200); await page.screenshot({ path: OUT + "/04_race.png" });
    // hold right steer a bit via keyboard, then wait for first question (fork at ~1000 m)
    await page.keyboard.down("ArrowRight"); await page.waitForTimeout(400); await page.keyboard.up("ArrowRight");
    await page.waitForFunction(() => document.querySelector("#qpanel").classList.contains("on"), null, { timeout: 90000 });
    await page.waitForTimeout(1500); await page.screenshot({ path: OUT + "/05_question.png" });
    await page.click("#b-pause"); await page.waitForTimeout(300); await page.screenshot({ path: OUT + "/06_pause.png" });
  } else {
    // autopilot full runs (time warp) for given stages
    for (const st of (process.argv[3] || "ch1").split(",")) {
      await page.goto(url + `#auto&warp=6&stage=${st}`); await page.reload();
      const t0 = Date.now(); let shot = false;
      while (Date.now() - t0 < 240000) {
        const r = await page.evaluate(() => window.__nrResult || null); if (r && r.stage === st) { console.log(JSON.stringify(r)); break; }
        if (!shot && Date.now() - t0 > 9000) { await page.screenshot({ path: OUT + `/auto_${st}.png` }); shot = true; }
        await page.waitForTimeout(1000);
      }
      await page.screenshot({ path: OUT + `/result_${st}.png` });
      await page.evaluate(() => { window.__nrResult = null; });
    }
  }
  console.log(errors.length ? errors.join("\n") : "no page errors");
  await browser.close();
})();
