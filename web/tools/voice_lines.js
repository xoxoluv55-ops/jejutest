// Collects every fixed sentence STAR-01 can say, split exactly like the game's Voice.chunks(Voice.clean(text)).
// Output: tools/voice_lines.json  [{ key, text }]  (key = short hash used as the clip file name)
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const W = path.join(__dirname, ".."), RES = path.join(W, "..", "NerveRunner/Assets/NerveRunner/Resources/NerveRunner");
const app = fs.readFileSync(path.join(W, "src/app.js"), "utf8"), minis = fs.readFileSync(path.join(W, "src/minis.js"), "utf8");
// pull clean() and chunks() out of the Voice object so the split is identical
const grab = name => { const i = app.indexOf("    " + name + "("); let d = 0, j = app.indexOf("{", i); for (let k = j; k < app.length; k++) { if (app[k] === "{") d++; else if (app[k] === "}" && --d === 0) return app.slice(i, k + 1); } };
const V = eval("({" + grab("clean") + "," + grab("chunks") + "})");
const texts = new Set(), H = /[가-힣]/;
const lit = line => (line.match(/"((?:[^"\\]|\\.)*)"/g) || []).map(s => JSON.parse(s)).filter(s => H.test(s) && s.length > 1);
// app.js: literals on lines that speak, and the tutorial steps
const lines = app.split("\n");
lines.forEach((l, i) => { if (/Voice\.say\(|hint\(|pickOne\(\[|tutSteps|^\s+(left|right|jump|drift|boost|gate|end): \[|const t = \{|phase\d: "/.test(l)) lit(l).forEach(s => texts.add(s)); });
// minis.js: intros, speech, spoken commands, finish lines
minis.split("\n").forEach(l => { if (/intro:|speech:|say\(|A\.shuffle\(\[\[|finish\(/.test(l)) lit(l).forEach(s => texts.add(s)); });
// content data
for (let i = 1; i <= 9; i++) {
  for (const q of JSON.parse(fs.readFileSync(path.join(RES, `questions_ch${i}.json`), "utf8")).questions) { texts.add(q.question); texts.add(q.explanation || ""); (q.wrongExplanations || []).forEach(w => w && texts.add(w)); }
  for (const b of JSON.parse(fs.readFileSync(path.join(RES, `story_ch${i}.json`), "utf8")).beats) (b.lines || []).forEach(l => { if (l.speaker === "STAR-01") texts.add(l.text); });   // NULL / narrator keep the device voice
}
const out = new Map();
for (const t of texts) for (const c of V.chunks(V.clean(t))) if (H.test(c) && c.length >= 2) out.set(c, crypto.createHash("sha1").update(c).digest("hex").slice(0, 12));
const arr = [...out].map(([text, key]) => ({ key, text }));
fs.writeFileSync(path.join(__dirname, "voice_lines.json"), JSON.stringify(arr, null, 1));
console.log("texts", texts.size, "sentences", arr.length, "chars", arr.reduce((a, x) => a + x.text.length, 0));
module.exports = V;
