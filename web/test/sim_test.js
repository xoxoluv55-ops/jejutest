const NR = require("../src/core.js"), fs = require("fs");
const R = __dirname + "/../../NerveRunner/Assets/NerveRunner/Resources/NerveRunner/";
let qs = []; for (let i = 1; i <= 9; i++) qs = qs.concat(JSON.parse(fs.readFileSync(R + `questions_ch${i}.json`)).questions);
const bank = new NR.Bank(qs);
function run(g, mode) {
  const sim = new NR.Sim(g), ap = new NR.AutoPilot(); let c = 0, w = 0; const mis = []; let dOk = 0, dFail = 0, dodge = 0, items = 0, col = "";
  if (mode === "wrong") ap.chooseLane = (q, cor, n) => (cor + 1) % n;
  for (let f = 0; f < 60 * 900 && !sim.finished; f++) {
    const inp = mode === "none" ? { steer: 0 } : ap.think(sim);
    sim.step(inp, 1 / 60);
    for (const e of sim.events) {
      if (e.type === NR.SE.GateResult || e.type === NR.SE.ForkChosen) e.correct ? c++ : w++;
      if (e.type === NR.SE.Trigger && e.tag === "synapse:minigame") sim.applySynapseResult(true);
      if (e.type === NR.SE.ItemUse) items++;
      if (e.type === NR.SE.CollapseResult) col += e.correct ? "ok" : "x" + e.tier;
      if (e.type === NR.SE.DriftEnd) { if (e.tier > 0) dOk++; else if (e.tag === "fail") dFail++; }
      if (e.type === NR.SE.ObstacleDodged) dodge++;
      if (e.type === NR.SE.LineResult) mis.push("line" + e.tag);
      if (e.type === NR.SE.MissionEnd) mis.push(e.tag[0] + (e.correct ? "+" : "-"));
      if (isNaN(sim.x)) throw "NaN";
    }
    sim.events.length = 0;
  }
  return `${sim.finished ? "fin" : "DNF"} ${sim.raceTime.toFixed(1)}s ${c}/${c + w} walls ${sim.wallHits} obs ${sim.obstacleHits} rings ${sim.ringsHit}/${sim.ringsTotal} AP ${sim.fires} zones ${mis.join(",")} sort ${sim.sortsOk}/${sim.sorts} reflex ${sim.reflexOk}/${sim.reflexN} super ${sim.superCombos} loop ${sim.loopOk}/${sim.loopFail}f items ${items} boss ${sim.bossMax ? sim.bossHp + "/" + sim.bossMax : "-"} col ${col} drift ${dOk}/${dFail}fail dodge ${dodge}`;
}
for (const st of NR.STAGES) {
  const g = st.build(bank);
  const ok = run(g, "ok"), none = run(g, "none"); console.log(st.id, "par", g.parTime.toFixed(0), "| ok:", ok, "| wrong:", run(g, "wrong").slice(0, 16), "| none:", none.slice(0, 40));
}
