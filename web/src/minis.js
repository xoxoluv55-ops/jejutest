// NERVE RUNNER 4.8 - chapter minigames. Each chapter mission is its own small game on a dedicated
// screen (the race pauses): reflex response, tract tracing, brainstem nuclei placement, thalamic relay,
// cortex map, cranial-nerve face, cerebellar balance, saltatory timing.
"use strict";
function createMinis(ctx) {   // ctx: { Snd, say(text) }
  const $ = s => document.querySelector(s);
  const root = $("#mg2"), area = $("#mg2-area"), title = $("#mg2-title"), prompt = $("#mg2-prompt"), fbEl = $("#mg2-fb"), dots = $("#mg2-dots"), tbar = $("#mg2-timer"), intro = $("#mg2-intro");
  let S = null, timers = [], pausedAt = 0, pausedTotal = 0, curBar = null;
  // a pausable clock: while the game is paused (pause menu) time stands still for timers and loops
  const now = () => (pausedAt || performance.now()) - pausedTotal;
  const arm = o => { o.id = setTimeout(() => { o.dead = true; o.fn(); }, Math.max(0, o.end - now())); };
  const later = (fn, ms) => { const o = { fn, end: now() + ms, dead: false }; timers.push(o); if (!pausedAt) arm(o); return o; };
  const cancel = o => { if (o) { o.dead = true; clearTimeout(o.id); } };
  function pause() {
    if (pausedAt) return; pausedAt = performance.now(); timers.forEach(o => clearTimeout(o.id));
    if (curBar && !curBar.dead) { const bar = tbar.firstElementChild, w = getComputedStyle(bar).width; bar.style.transition = "none"; bar.style.width = w; }
  }
  function resume() {
    if (!pausedAt) return; pausedTotal += performance.now() - pausedAt; pausedAt = 0; timers = timers.filter(o => !o.dead); timers.forEach(arm);
    if (curBar && !curBar.dead) { const bar = tbar.firstElementChild; void bar.offsetWidth; bar.style.transition = `width ${Math.max(0, (curBar.end - now()) / 1000)}s linear`; bar.style.width = "0%"; }
  }
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function stopAll() { timers.forEach(cancel); timers = []; curBar = null; if (S && S.raf) cancelAnimationFrame(S.raf); if (S && S.cleanup) S.cleanup(); tbar.style.display = "none"; }
  function renderDots() { dots.innerHTML = S.n ? Array.from({ length: S.n }, (_, k) => `<i class="${k < S.log.length ? (S.log[k] ? "ok" : "no") : k === S.log.length ? "cur" : ""}"></i>`).join("") : ""; }
  const BASE = ctx.assetBase || "assets/mg/";
  const api = {
    area, later, shuffle, esc, now,
    // images are only requested when their minigame opens (lazy) and dropped with the DOM on exit
    img(file, alt) { return `<img class="art" src="${BASE}${file}" alt="${alt}" decoding="async" draggable="false" onload="this.classList.add('ok')" onerror="this.classList.add('err')"><span class="art-alt">${alt}</span>`; },
    setPrompt(t) { prompt.innerHTML = t; },
    feedback(ok, text) { fbEl.className = "mg2-fb " + (ok ? "ok" : "no"); fbEl.innerHTML = (ok ? "✔ " : "✘ ") + text; },
    clearFb() { fbEl.className = "mg2-fb"; fbEl.innerHTML = ""; },
    result(ok) { S.log.push(!!ok); if (ok) S.ok++; renderDots(); ok ? ctx.Snd.chime() : ctx.Snd.thud(); },
    timer(sec, onEnd) {   // shrinking bar; returns cancel()
      const bar = tbar.firstElementChild; tbar.style.display = "block"; bar.style.transition = "none"; bar.style.width = "100%"; void bar.offsetWidth;
      bar.style.transition = `width ${sec}s linear`; bar.style.width = "0%"; const t = later(() => { tbar.style.display = "none"; onEnd(); }, sec * 1000); curBar = t;
      return () => { cancel(t); tbar.style.display = "none"; };
    },
    say: ctx.say, Snd: ctx.Snd, get S() { return S; },
    finish(summary) {
      stopAll(); const pass = S.n ? S.ok / S.n >= 0.6 : !!S.pass;
      intro.innerHTML = `<b>${pass ? "🎉 미션 성공!" : "미션 종료"}</b><p class="mg2-score">${S.n ? `${S.ok} / ${S.n} 성공` : summary || ""}</p>${S.n && summary ? `<p>${summary}</p>` : ""}<p class="mg2-small">${pass ? "보상: 터보 가속 + 신호 에너지" : "60% 이상이면 성공 — 다음엔 더 잘할 수 있어요!"}</p><button class="big primary" id="mg2-go">계속 달리기 ▶</button>`;
      intro.style.display = "flex"; ctx.say(pass ? "미션 성공! 다시 달리자!" : "아쉽지만 괜찮아, 다시 달리자!");
      $("#mg2-go").onclick = () => { root.className = "mg2"; area.innerHTML = ""; const d = S.done, ok = S.ok, n = S.n; S = null; d(pass, ok, n); };
    },
  };
  function open(kind, done) {
    const G = GAMES[kind]; if (!G) { done(true, 0, 0); return; }
    stopAll(); S = { kind, done, ok: 0, n: G.rounds || 0, log: [], pass: false };
    root.className = "mg2 on mg-" + kind; title.textContent = G.title; area.innerHTML = ""; api.clearFb(); prompt.innerHTML = ""; renderDots();
    intro.innerHTML = `<b>${G.title}</b><p>${G.intro}</p>${G.note ? `<p class="mg2-small">${G.note}</p>` : ""}<button class="big primary" id="mg2-go">시작 ▶</button>`; intro.style.display = "flex";
    ctx.say(G.speech || G.intro);
    if (G.assets) S.pre = G.assets.map(f => { const im = new Image(); im.decoding = "async"; im.src = BASE + f; return im; });   // warm the cache while the intro is read
    $("#mg2-go").onclick = () => { intro.style.display = "none"; ctx.Snd.beep(); G.start(api); };
  }

  //================= games =================
  const GAMES = {};

  // CH.4 brainstem nuclei placement (4.9 art: ch4_brainstem.webp, front view)
  // Hit zones are HTML buttons laid over the image at the midbrain / pons / medulla levels.
  GAMES.nuclei = {
    title: "뇌줄기 신경핵 배치", rounds: 7, assets: ["ch4_brainstem.webp"],
    intro: "카드에 적힌 신경핵이 뇌줄기의 어느 층에 있는지 골라 제자리에 꽂아 주세요. 맞히면 그 층이 빛나요.",
    note: "앞에서 본 뇌줄기 그림이에요. 실제 신경핵들은 뇌줄기 안쪽 깊은 곳(등쪽)에 있어요.",
    start(A) {
      const L = [
        { name: "중간뇌", sub: "Midbrain", box: [110, 112, 110, 36] },
        { name: "다리뇌", sub: "Pons", box: [100, 148, 130, 67] },
        { name: "숨뇌", sub: "Medulla oblongata", box: [112, 215, 104, 85] },
      ];
      const IW = 328, IH = 367, pct = (v, d) => (v / d * 100).toFixed(2) + "%";
      const D = A.shuffle([["III 눈돌림신경핵", 0], ["IV 도르래신경핵", 0], ["에딩거-웨스트팔핵 (동공 수축)", 0], ["V 삼차신경 운동핵 (씹기)", 1], ["VI 갓돌림신경핵", 1], ["VII 얼굴신경핵", 1], ["XII 혀밑신경핵", 2], ["의문핵 (삼킴 · 발성)", 2], ["X 미주신경 등쪽운동핵", 2]]).slice(0, 7);
      A.area.innerHTML = `<div class="art-row">
        <div class="nu-side"><div class="nu-deck"><small>배치할 신경핵</small><div class="nu-card2" id="nu-card"></div></div><div class="nu-log" id="nu-log"></div></div>
        <div class="art-stage nu-stage" style="aspect-ratio:${IW}/${IH}">
          ${A.img("ch4_brainstem.webp", "뇌줄기 (앞에서 본 모습)")}
          ${L.map((l, k) => `<div class="nu-glow" data-g="${k}" style="left:${pct(l.box[0] - 30, IW)};top:${pct(l.box[1] - 10, IH)};width:${pct(l.box[2] + 60, IW)};height:${pct(l.box[3] + 20, IH)}"></div>
            <button class="hit nu-zone" data-l="${k}" style="left:${pct(l.box[0], IW)};top:${pct(l.box[1], IH)};width:${pct(l.box[2], IW)};height:${pct(l.box[3], IH)}" aria-label="${l.name}"></button>
            <div class="nu-tag" style="top:${pct(l.box[1] + l.box[3] / 2, IH)}"><b>${l.name}</b><small>${l.sub}</small><div class="nu-dots" data-d="${k}"></div></div>`).join("")}
          <div class="nu-tag sp" style="top:${pct(335, IH)}"><b>척수</b><small>Spinal cord</small></div>
        </div></div>`;
      let i = 0;
      const round = () => {
        if (i >= D.length) return A.finish("III·IV는 중간뇌, V·VI·VII은 다리뇌, IX·X·XII은 숨뇌 — 위에서 아래로 번호가 커져요.");
        A.clearFb(); A.setPrompt("이 신경핵은 어느 층에 있을까? <small>그림의 층을 눌러요</small>");
        const card = document.getElementById("nu-card"); card.textContent = D[i][0]; card.className = "nu-card2 in"; let done = false;
        A.area.querySelectorAll(".nu-zone").forEach(b => b.onclick = () => {
          if (done) return; done = true; const k = +b.dataset.l, want = D[i][1], ok = k === want; A.result(ok);
          const g = A.area.querySelector(`.nu-glow[data-g="${want}"]`); g.classList.remove("on", "bad"); void g.offsetWidth; g.classList.add("on");
          if (!ok) { const gb = A.area.querySelector(`.nu-glow[data-g="${k}"]`); gb.classList.remove("on", "bad"); void gb.offsetWidth; gb.classList.add("bad"); }
          card.className = "nu-card2 fly" + (ok ? "" : " miss");
          A.area.querySelector(`.nu-dots[data-d="${want}"]`).insertAdjacentHTML("beforeend", `<i class="${ok ? "" : "fix"}" title="${A.esc(D[i][0])}"></i>`);
          document.getElementById("nu-log").insertAdjacentHTML("afterbegin", `<div class="${ok ? "ok" : "no"}">${ok ? "✔" : "✘"} ${A.esc(D[i][0])} → <b>${L[want].name}</b></div>`);
          A.feedback(ok, `${D[i][0]}은 <b>${L[want].name}</b>에 있어요.`); i++; A.later(round, 1700);
        });
      };
      round();
    },
  };

  // CH.7 cortex function map (4.9 art: ch7_cerebrum_lateral.webp, left hemisphere, front = left)
  GAMES.cortex = {
    title: "대뇌 기능 지도", rounds: 6, assets: ["ch7_cerebrum_lateral.webp"],
    intro: "명령이 떨어지면 그 일을 맡은 대뇌겉질 영역을 눌러 주세요. 왼쪽 반구를 옆에서 본 모습이고, 왼쪽이 이마(앞)예요.",
    note: "분홍 띠 = 중심앞이랑(일차운동겉질), 노란 띠 = 중심뒤이랑(일차몸감각겉질), 초록 = 관자엽",
    start(A) {
      const IW = 503, IH = 384, pct = (v, d) => (v / d * 100).toFixed(2) + "%";
      // [x, y, glowW, glowH, rotateDeg, name] in image pixels (checked against the gyri in the art)
      const H = {
        m1: [238, 105, 52, 190, 9, "일차운동겉질 (중심앞이랑)"],
        s1: [281, 100, 50, 185, 9, "일차몸감각겉질 (중심뒤이랑)"],
        broca: [160, 188, 78, 50, -15, "브로카 영역 (아래이마이랑)"],
        a1: [287, 204, 78, 30, -8, "일차청각겉질 (가로관자이랑)"],
        wern: [372, 220, 84, 52, -8, "베르니케 영역 (위관자이랑 뒤쪽)"],
        v1: [470, 212, 50, 92, 0, "일차시각겉질 (뒤통수엽 끝)"],
      };
      const LOBE = [["이마엽", 95, 150], ["마루엽", 390, 95], ["관자엽", 335, 285], ["뒤통수엽", 455, 150], ["소뇌", 410, 330]];
      const Q = A.shuffle([["오른손을 움직여라!", "m1"], ["손끝 감촉을 느껴라!", "s1"], ["말을 만들어 내라!", "broca"], ["들은 말을 이해하라!", "wern"], ["음악 소리를 들어라!", "a1"], ["물체의 모양을 보라!", "v1"]]);
      A.area.innerHTML = `<div class="art-stage cx-stage" style="aspect-ratio:${IW}/${IH}">
        ${A.img("ch7_cerebrum_lateral.webp", "왼쪽 대뇌 반구 (가쪽면)")}
        ${Object.entries(H).map(([k, h]) => `<div class="cx-glow" data-g="${k}" style="left:${pct(h[0] - h[2] / 2, IW)};top:${pct(h[1] - h[3] / 2, IH)};width:${pct(h[2], IW)};height:${pct(h[3], IH)};transform:rotate(${h[4]}deg)"></div>`).join("")}
        ${LOBE.map(l => `<span class="cx-lobe" style="left:${pct(l[1], IW)};top:${pct(l[2], IH)}">${l[0]}</span>`).join("")}
        ${Object.entries(H).map(([k, h]) => `<button class="hit cx-hs" data-k="${k}" style="left:${pct(h[0], IW)};top:${pct(h[1], IH)}" aria-label="영역"><i></i><span class="cx-name"></span></button>`).join("")}
        <span class="cx-dir l">앞 (이마)</span><span class="cx-dir r">뒤</span></div>`;
      let i = 0;
      const round = () => {
        if (i >= Q.length) return A.finish("운동은 중심앞이랑, 몸감각은 중심뒤이랑, 말하기는 브로카, 말 이해는 베르니케, 청각은 관자엽, 시각은 뒤통수엽!");
        const q = Q[i]; A.clearFb(); A.setPrompt(`🧠 <b>${q[0]}</b>`); let done = false; A.say(q[0]);
        A.area.querySelectorAll(".cx-hs").forEach(b => b.onclick = () => {
          if (done) return; done = true; const k = b.dataset.k, ok = k === q[1]; A.result(ok);
          const show = (key, cls) => { const g = A.area.querySelector(`.cx-glow[data-g="${key}"]`), hs = A.area.querySelector(`.cx-hs[data-k="${key}"]`); g.className = "cx-glow " + cls; hs.classList.add(cls); hs.querySelector(".cx-name").textContent = H[key][5]; };
          show(q[1], "right"); if (!ok) show(k, "wrong");
          A.feedback(ok, `${q[0]} → <b>${H[q[1]][5]}</b>`); i++;
          A.later(() => { A.area.querySelectorAll(".cx-glow").forEach(g => g.className = "cx-glow"); A.area.querySelectorAll(".cx-hs").forEach(h => { h.classList.remove("right", "wrong"); h.querySelector(".cx-name").textContent = ""; }); round(); }, 2300);
        });
      };
      round();
    },
  };

  // CH.2 spinal reflex emergency (4.9 art: ch2_spinal_section.webp, dorsal side up)
  GAMES.reflex = {
    title: "척수반사 긴급 미션", rounds: 5, assets: ["ch2_spinal_section.webp"],
    intro: "갑자기 자극이 들어와요! 척수가 어떻게 반응할지 5초 안에 골라 주세요. 맞히면 척수 단면 위로 반사궁 신호가 흘러요.",
    note: "※ 실제 반사는 수십 밀리초 안에 일어나요. 제한 시간은 게임을 위한 것이에요.",
    start(A) {
      const IN = "M8,186 C55,160 105,100 142,84", OUT = "C92,160 62,182 18,228";
      const R = [
        { k: "stretch", s: "🔨 무릎 아래 힘줄을 반사망치로 톡!", a: 0, path: `${IN} L124,142 ${OUT}`, inh: false, arc: ["근방추", "Ia 감각신경", "앞뿔 α운동신경세포 (단일시냅스)", "넙다리네갈래근 수축"], why: "근방추가 늘어남 → Ia 감각신경 → α운동신경세포 → 같은 근육 수축 (신장반사)" },
        { k: "flex", s: "📌 맨발로 압정을 밟았다!", a: 1, path: `${IN} L191,116 L124,142 ${OUT}`, inh: false, arc: ["통각 수용기", "감각신경", "뒤뿔 사이신경세포", "앞뿔 운동신경", "굽힘근 수축"], why: "통각 → 사이신경세포 → 굽힘근 수축으로 발을 들어 올리고 폄근은 억제 (굽힘반사)" },
        { k: "crossed", s: "📌 한 발로 압정을 밟아 그 발을 들었다! 몸이 기우뚱…", a: 2, path: `${IN} L191,116 L262,142 C298,162 330,190 368,228`, inh: false, arc: ["통각 수용기", "감각신경", "사이신경세포 (반대쪽으로 교차)", "반대쪽 앞뿔", "반대쪽 다리 폄"], why: "자극받은 다리는 굽히고, 반대쪽 다리는 펴서 체중을 받쳐요 (교차폄반사)" },
        { k: "recip", s: "💪 넙다리네갈래근(폄근)이 힘껏 수축한다!", a: 3, path: `${IN} L191,116 L132,150`, inh: true, arc: ["근방추", "Ia 감각신경", "억제성 사이신경세포", "길항근 운동신경 억제", "뒤넙다리근 이완"], why: "억제성 사이신경세포가 길항근을 이완시켜 동작이 부드러워져요 (상호억제)" },
      ];
      const OPT = ["같은 근육 수축 (다리 차올림)", "굽힘근 수축 (발 들어 올리기)", "반대쪽 다리 펴서 버티기", "길항근 이완"];
      const IW = 383, IH = 258, pct = (v, d) => (v / d * 100).toFixed(2) + "%";
      const seq = A.shuffle(R.concat([R[(Math.random() * 4) | 0]])); let i = 0;
      A.area.innerHTML = `<div class="art-row rf-row">
        <div class="rf-left"><div class="rf-stim" id="rf-stim"></div><div class="mg-opts" id="rf-opts"></div></div>
        <div class="rf-right"><div class="art-stage rf-stage" style="aspect-ratio:${IW}/${IH}">${A.img("ch2_spinal_section.webp", "척수 단면")}
          <svg class="rf-svg" viewBox="0 0 ${IW} ${IH}" id="rf-svg"></svg>
          <span class="art-lbl" style="left:${pct(150, IW)};top:${pct(46, IH)}">뒤뿔 (감각)</span><span class="art-lbl" style="left:${pct(112, IW)};top:${pct(172, IH)}">앞뿔 (운동)</span>
          <span class="art-lbl sm" style="left:${pct(30, IW)};top:${pct(150, IH)}">뒤뿌리 →</span><span class="art-lbl sm" style="left:${pct(28, IW)};top:${pct(246, IH)}">← 앞뿌리</span>
          <span class="art-lbl sm dim" style="left:${pct(191, IW)};top:${pct(12, IH)}">등쪽</span></div>
          <div class="rf-arc" id="rf-arc"></div></div></div>`;
      const svg = document.getElementById("rf-svg");
      const round = () => {
        if (i >= seq.length) return A.finish("반사는 뇌까지 가지 않고 척수에서 바로 처리돼요.");
        const r = seq[i]; A.clearFb(); A.setPrompt("자극! 척수의 반응은?"); svg.innerHTML = "";
        document.getElementById("rf-stim").textContent = r.s; A.Snd.tone("square", 1200, 1500, 0.12, 0.2);
        document.getElementById("rf-arc").innerHTML = r.arc.map(x => `<span>${x}</span>`).join("<i>→</i>");
        const box = document.getElementById("rf-opts"); box.innerHTML = OPT.map((o, k) => `<button data-k="${k}">${o}</button>`).join("");
        let answered = false;
        const pick = k => {
          if (answered) return; answered = true; cancel(); const ok = k === r.a; A.result(ok);
          box.querySelectorAll("button").forEach(b => { const kk = +b.dataset.k; b.disabled = true; if (kk === r.a) b.classList.add("right"); else if (kk === k) b.classList.add("wrong"); });
          A.feedback(ok, (k < 0 ? "시간 초과! " : "") + r.why);
          // the reflex arc lights up over the spinal cord section (always shows the correct pathway)
          svg.innerHTML = `<path class="rf-path${r.inh ? " inh" : ""}" pathLength="100" d="${r.path}"/><circle r="6" class="rf-dot${r.inh ? " inh" : ""}"><animateMotion dur="1.6s" fill="freeze" path="${r.path}"/></circle>${r.inh ? `<text x="120" y="168" class="rf-inh">⊣ 억제</text>` : ""}`;
          document.querySelectorAll("#rf-arc span").forEach((s, n) => A.later(() => s.classList.add("lit"), n * 300));
          i++; A.later(round, 3000);
        };
        const cancel = A.timer(5, () => pick(-1));
        box.querySelectorAll("button").forEach(b => b.onclick = () => pick(+b.dataset.k));
      };
      round();
    },
  };

  // CH.3 tract tracing (4.9 art: ch3_tract_crossing.webp / ch3_tract_descending.webp as the map)
  GAMES.cross = {
    title: "신경 교차 경로 추적", rounds: 3, assets: ["ch3_tract_crossing.webp", "ch3_tract_descending.webp"],
    intro: "신호를 따라 층마다 신호가 지나가는 쪽(몸의 왼쪽/오른쪽 절반)을 눌러 경로를 그려요. 어디서 반대쪽으로 건너가는지가 핵심!",
    note: "가운데 그림은 경로 이해를 돕는 도식이에요. 층 이름과 정답은 글자로 표시된 해부학 위치를 기준으로 해요.",
    start(A) {
      const T = [
        { name: "뒤기둥-안쪽섬유띠계", from: "왼다리의 진동·위치 감각", up: true, art: "ch3_tract_crossing.webp", lv: [["척수 (뒤뿌리로 들어옴)", 0], ["척수 위쪽 (뒤기둥 · 널판다발)", 0], ["숨뇌 아래 (얇은핵 · 쐐기핵)", 0], ["숨뇌 위 (교차 → 안쪽섬유띠)", 1], ["시상 VPL", 1], ["마루엽 일차몸감각겉질", 1]], why: "같은 쪽으로 올라가 숨뇌에서 교차해요." },
        { name: "앞가쪽계 (척수시상로)", from: "왼손의 통증·온도", up: true, art: "ch3_tract_crossing.webp", lv: [["척수 뒤뿔 (들어옴)", 0], ["척수 1–2분절 위 (앞흰질맞교차 후)", 1], ["숨뇌", 1], ["시상 VPL", 1], ["마루엽 일차몸감각겉질", 1]], why: "척수에 들어오자마자 1–2분절 안에서 교차해요." },
        { name: "가쪽겉질척수로", from: "왼손을 움직이라는 명령", up: false, art: "ch3_tract_descending.webp", lv: [["일차운동겉질", 1], ["속섬유막", 1], ["숨뇌 피라미드 (교차 전)", 1], ["숨뇌 아래 (피라미드 교차 후)", 0], ["척수 가쪽겉질척수로", 0], ["척수 앞뿔 → 왼손 근육", 0]], why: "숨뇌 피라미드 교차에서 반대쪽으로 넘어가요." },
      ];
      let t = 0;
      const tract = () => {
        if (t >= T.length) return A.finish("감각은 위로 올라가며, 운동 명령은 내려가며 반대쪽으로 교차해요.");
        const tr = T[t], rows = tr.up ? tr.lv.slice().reverse() : tr.lv.slice(); let step = 0, miss = 0; A.clearFb();
        A.setPrompt(`<b>${tr.name}</b> — ${tr.from} ${tr.up ? "↑ 올라가요" : "↓ 내려가요"}`);
        A.area.innerHTML = `<div class="tr-head"><span>◀ 몸 왼쪽</span><span>몸 오른쪽 ▶</span></div><div class="tr-wrap"><div class="tr-art">${A.img(tr.art, tr.name + " 도식")}</div><div class="tr-mid"></div><svg class="tr-svg" id="tr-svg"></svg>${rows.map((r, k) => `<div class="tr-row" data-r="${k}"><button data-s="0" aria-label="왼쪽"></button><em>${r[0]}</em><button data-s="1" aria-label="오른쪽"></button></div>`).join("")}</div>`;
        const order = tr.up ? rows.map((_, k) => rows.length - 1 - k) : rows.map((_, k) => k), pts = [];
        const draw = () => { const svg = document.getElementById("tr-svg"), wr = svg.getBoundingClientRect(); const P = pts.map(p => `${p[0] - wr.left},${p[1] - wr.top}`).join(" "); svg.innerHTML = pts.length > 1 ? `<polyline points="${P}" /><polyline class="flow" points="${P}" />` : ""; };
        const mark = () => { document.querySelectorAll(".tr-row").forEach((el, k) => el.classList.toggle("cur", k === order[step])); };
        mark();
        A.area.querySelectorAll(".tr-row button").forEach(b => b.onclick = () => {
          const row = +b.parentElement.dataset.r; if (row !== order[step]) return;
          const side = +b.dataset.s, want = rows[row][1], ok = side === want; if (!ok) { miss++; A.Snd.thud(); }
          const good = b.parentElement.querySelector(`button[data-s="${want}"]`); good.classList.add("on"); if (!ok) b.classList.add("bad");
          const rc = good.getBoundingClientRect(); pts.push([rc.left + rc.width / 2, rc.top + rc.height / 2]); draw();
          if (step > 0 && rows[row][1] !== rows[order[step - 1]][1]) b.parentElement.classList.add("xpt");   // the crossing level
          if (!ok) A.feedback(false, `여기서는 ${want ? "오른쪽" : "왼쪽"}이에요. ${tr.why}`); else A.Snd.coin();
          step++; mark();
          if (step >= rows.length) { const pass = miss <= 1; A.result(pass); A.feedback(pass, `${tr.name}: ${tr.why}`); t++; A.later(tract, 3200); }
        });
      };
      tract();
    },
  };

  // CH.6 thalamic relay delivery (4.9 art: ch6_thalamus.webp — a spread-out schematic of the relay nuclei;
  // the letters baked into the art are covered by HTML labels)
  GAMES.relay = {
    title: "시상 중계 배달", rounds: 6, assets: ["ch6_thalamus.webp"],
    intro: "감각 신호가 시상에 도착해요! 6초 안에 맞는 중계핵을 눌러서 대뇌겉질로 보내 주세요.",
    note: "그림은 핵을 한눈에 보도록 펼친 도식이에요. 실제로 VL은 앞쪽, VPL·VPM은 배쪽 뒤쪽, LGN·MGN은 시상 뒤쪽 아래(무릎체)에 있어요.",
    start(A) {
      const IW = 396, IH = 292, pct = (v, d) => (v / d * 100).toFixed(2) + "%";
      const N = [["LGN", "가쪽무릎핵", "일차시각겉질 (뒤통수엽)", 100, 110], ["MGN", "안쪽무릎핵", "일차청각겉질 (관자엽)", 200, 110], ["VPL", "배쪽뒤가쪽핵", "일차몸감각겉질 · 몸", 303, 110], ["VPM", "배쪽뒤안쪽핵", "일차몸감각겉질 · 얼굴", 143, 203], ["VL", "배쪽가쪽핵", "일차운동겉질", 257, 203]];
      const SRC = [["👁", "망막에서 온 빛 신호", 0], ["👂", "달팽이관에서 온 소리 신호", 1], ["✋", "손끝의 촉각·통증", 2], ["🦶", "발바닥의 진동 감각", 2], ["😊", "얼굴 피부의 촉각 (삼차신경)", 3], ["⚖", "소뇌에서 온 운동 조절 신호", 4]];
      const seq = A.shuffle(SRC);
      A.area.innerHTML = `<div class="art-row re-row2"><div class="re-src" id="re-src"></div><div class="re-beam in" id="re-in"></div>
        <div class="art-stage re-stage" style="aspect-ratio:${IW}/${IH}">${A.img("ch6_thalamus.webp", "시상 중계핵 도식")}
          ${N.map((n, k) => `<div class="re-glow" data-g="${k}" style="left:${pct(n[3], IW)};top:${pct(n[4], IH)}"></div><button class="hit re-nuc" data-k="${k}" style="left:${pct(n[3], IW)};top:${pct(n[4], IH)}"><b>${n[0]}</b><small>${n[1]}</small></button>`).join("")}
          <span class="re-cap">시상</span></div>
        <div class="re-beam out" id="re-out"></div><div class="re-dst" id="re-dst">대뇌겉질</div></div>`;
      let i = 0;
      const round = () => {
        if (i >= seq.length) return A.finish("시상은 후각을 뺀 거의 모든 감각이 대뇌로 가기 전에 거치는 관문이에요.");
        const s = seq[i]; A.clearFb(); A.setPrompt("어느 중계핵으로 보낼까?"); document.getElementById("re-src").innerHTML = `<span>${s[0]}</span>${s[1]}`;
        const dst = document.getElementById("re-dst"); dst.textContent = "대뇌겉질"; dst.classList.remove("lit");
        const bi = document.getElementById("re-in"), bo = document.getElementById("re-out"); bi.className = "re-beam in go"; bo.className = "re-beam out";
        let done = false; const btns = A.area.querySelectorAll(".re-nuc"); btns.forEach(b => b.classList.remove("right", "wrong")); A.area.querySelectorAll(".re-glow").forEach(g => g.className = "re-glow");
        const pick = k => {
          if (done) return; done = true; cancel(); const ok = k === s[2]; A.result(ok);
          btns.forEach(b => { if (+b.dataset.k === s[2]) b.classList.add("right"); else if (+b.dataset.k === k) b.classList.add("wrong"); });
          A.area.querySelector(`.re-glow[data-g="${s[2]}"]`).className = "re-glow on"; if (!ok && k >= 0) A.area.querySelector(`.re-glow[data-g="${k}"]`).className = "re-glow bad";
          bo.className = "re-beam out go"; A.later(() => { dst.textContent = N[s[2]][2]; dst.classList.add("lit"); }, 500);
          A.feedback(ok, `${k < 0 ? "시간 초과! " : ""}${s[1]} → <b>${N[s[2]][0]}</b> (${N[s[2]][1]}) → ${N[s[2]][2]}`); i++; A.later(round, 2600);
        };
        const cancel = A.timer(6, () => pick(-1)); btns.forEach(b => b.onclick = () => pick(+b.dataset.k));
      };
      round();
    },
  };

  // CH.8 cranial nerve face (4.9 art: ch8_face_1..7.webp, one character, one image per expression)
  GAMES.cranial = {
    title: "뇌신경 얼굴 반응", rounds: 6, assets: ["ch8_face_1.webp", "ch8_face_2.webp", "ch8_face_3.webp", "ch8_face_4.webp", "ch8_face_5.webp", "ch8_face_6.webp", "ch8_face_7.webp"],
    intro: "동작 명령에 맞는 뇌신경을 고르면 캐릭터가 그대로 움직여요!",
    start(A) {
      // [command, nerve, face image index, extra animation]
      const ACT = [["눈을 바깥쪽으로!", "VI 갓돌림신경", 2, ""], ["눈을 안쪽 아래로!", "IV 도르래신경", 4, ""], ["활짝 웃어!", "VII 얼굴신경", 3, "bounce"], ["꼭꼭 씹어!", "V 삼차신경", 6, "chew"], ["혀를 쭉 내밀어!", "XII 혀밑신경", 5, "bounce"], ["어깨를 으쓱!", "XI 더부신경", 7, "shrug"], ["동공을 작게!", "III 눈돌림신경", 1, "light"]];
      const ALL = ACT.map(a => a[1]); const seq = A.shuffle(ACT).slice(0, 6);
      A.area.innerHTML = `<div class="cr-row"><div class="cr-stage" id="cr-stage">${[1, 2, 3, 4, 5, 6, 7].map(n => `<img class="cr-img${n === 1 ? " on" : ""}" data-f="${n}" src="${BASE}ch8_face_${n}.webp" alt="" draggable="false">`).join("")}<div class="cr-light"></div><div class="cr-nerve" id="cr-nerve"></div></div><div class="mg-opts col" id="cr-opts"></div></div>`;
      const stage = document.getElementById("cr-stage"), setFace = (n, fx) => { stage.querySelectorAll(".cr-img").forEach(im => im.classList.toggle("on", +im.dataset.f === n)); stage.className = "cr-stage" + (fx ? " fx-" + fx : ""); };
      let i = 0;
      const round = () => {
        if (i >= seq.length) return A.finish("눈을 움직이는 건 III·IV·VI, 표정은 VII, 씹기는 V, 혀는 XII, 어깨는 XI!");
        const s = seq[i]; setFace(1, ""); document.getElementById("cr-nerve").textContent = ""; A.clearFb(); A.setPrompt(`🗣 <b>${s[0]}</b>`); A.say(s[0]);
        const opts = A.shuffle([s[1]].concat(A.shuffle(ALL.filter(x => x !== s[1])).slice(0, 3))), box = document.getElementById("cr-opts");
        box.innerHTML = opts.map(o => `<button>${o}</button>`).join(""); let done = false;
        box.querySelectorAll("button").forEach(b => b.onclick = () => {
          if (done) return; done = true; const ok = b.textContent === s[1]; A.result(ok);
          box.querySelectorAll("button").forEach(x => { x.disabled = true; if (x.textContent === s[1]) x.classList.add("right"); else if (x === b) x.classList.add("wrong"); });
          setFace(s[2], s[3]); const nv = document.getElementById("cr-nerve"); nv.textContent = s[1]; nv.className = "cr-nerve on";
          A.feedback(ok, `${s[0]} → <b>${s[1]}</b>${s[3] === "light" ? " (빛을 비추면 동공이 작아져요 — 부교감 섬유)" : ""}`); i++; A.later(() => { nv.className = "cr-nerve"; round(); }, 2400);
        });
      };
      round();
    },
  };

  // CH.5 cerebellar balance (4.9 art: ch5_cerebellum.webp backdrop + star01.webp on the beam)
  GAMES.balance = {
    title: "소뇌 균형 잡기", rounds: 0, assets: ["ch5_cerebellum.webp", "star01.webp"],
    intro: "NULL이 STAR-01을 계속 흔들어요(운동실조 흉내). ◀ ▶를 눌러 가운데 초록 구역에 15초 동안 최대한 오래 머물러 주세요. 60% 이상이면 성공!",
    note: "소뇌는 '하려던 움직임'과 '실제 움직임'을 비교해 오차를 계속 고쳐 줘요.",
    start(A) {
      A.area.innerHTML = `<div class="ba-wrap"><div class="ba-scene" id="ba-scene"><div class="ba-cb">${A.img("ch5_cerebellum.webp", "소뇌")}</div>
        <div class="ba-beam"><div class="ba-zone"></div><img class="ba-star" id="ba-star" src="${BASE}star01.webp" alt="STAR-01" draggable="false"></div></div>
        <div class="ba-bot"><button class="ba-btn" data-d="-1">◀</button><div class="ba-pct" id="ba-pct">0%</div><button class="ba-btn" data-d="1">▶</button></div></div>`;
      const hold = { "-1": 0, "1": 0 }, keys = e => { if (e.code === "ArrowLeft") hold["-1"] = e.type === "keydown" ? 1 : 0; if (e.code === "ArrowRight") hold["1"] = e.type === "keydown" ? 1 : 0; };
      A.area.querySelectorAll(".ba-btn").forEach(b => { const d = b.dataset.d; b.onpointerdown = e => { e.preventDefault(); hold[d] = 1; b.classList.add("down"); }; b.onpointerup = b.onpointercancel = b.onpointerleave = () => { hold[d] = 0; b.classList.remove("down"); }; });
      addEventListener("keydown", keys); addEventListener("keyup", keys); A.S.cleanup = () => { removeEventListener("keydown", keys); removeEventListener("keyup", keys); };
      let x = 0, v = 0, t = 0, inside = 0, streak = 0, last = A.now(); const star = document.getElementById("ba-star"), pct = document.getElementById("ba-pct"), scene = document.getElementById("ba-scene");
      A.setPrompt("가운데 초록 구역을 지켜라!"); A.timer(15, () => {});
      const loop = () => {
        const now = A.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
        const drift = Math.sin(t * 1.3) * 1.6 + Math.sin(t * 2.9 + 1) * 1.1 + Math.sin(t * 0.55 + 2) * 0.9;
        v += (drift + (hold["1"] - hold["-1"]) * 4.2 - v * 2.2) * dt; x = Math.max(-1, Math.min(1, x + v * dt)); if (Math.abs(x) >= 1) v *= -0.3;
        const inZ = Math.abs(x) < 0.28; if (inZ) { inside += dt; streak += dt; } else streak = 0;
        star.style.left = (50 + x * 44) + "%"; star.style.transform = `translate(-50%,-62%) rotate(${(v * 18).toFixed(1)}deg)`;   // wobbles with the sway
        star.classList.toggle("in", inZ); scene.classList.toggle("calm", streak > 1.2); scene.classList.toggle("lost", Math.abs(x) > 0.8);
        pct.textContent = Math.round(inside / Math.max(0.01, t) * 100) + "%";
        if (t >= 15) { const r = inside / t; A.S.pass = r >= 0.6; A.result(A.S.pass); return A.finish(`균형 유지 ${Math.round(r * 100)}%`); }
        A.S.raf = requestAnimationFrame(loop);
      };
      A.S.raf = requestAnimationFrame(loop);
    },
  };

  // CH.1 saltatory conduction timing (4.9 art: myelin sheath / bare axon tiles cut from ch1_axon_myelin, star01, ch1_synapse)
  GAMES.saltatory = {
    title: "도약전도 타이밍", rounds: 8, assets: ["ch1_sheath_tile.webp", "ch1_axon_bare.webp", "star01.webp", "ch1_synapse.webp"],
    intro: "신호(STAR-01)가 랑비에 결절에 닿아 빛나는 순간 [재생성!]을 눌러 활동전위를 다시 만들어 주세요. 금빛 수초 구간은 빠르게 건너뛰어요.",
    note: "수초가 벗겨진 파란 맨 축삭 구간(탈수초)에서는 신호가 느려져요.",
    start(A) {
      const NODES = 8, damaged = 5;
      A.area.innerHTML = `<div class="sa-wrap"><div class="sa-axon">${Array.from({ length: NODES }, (_, k) => `<div class="sa-seg${k === damaged ? " dm" : ""}"></div><div class="sa-node" data-n="${k}"><i></i></div>`).join("")}<img class="sa-pulse" id="sa-pulse" src="${BASE}star01.webp" alt="" draggable="false"></div>
        <img class="sa-syn" id="sa-syn" src="${BASE}ch1_synapse.webp" alt="축삭종말 시냅스" draggable="false"></div>
        <div class="sa-legend"><span class="m">수초 (절연)</span><span class="n">랑비에 결절</span><span class="d">탈수초</span></div><button class="big primary sa-btn" id="sa-btn">⚡ 재생성!</button>`;
      const pulse = document.getElementById("sa-pulse"), nodes = A.area.querySelectorAll(".sa-node"), btn = document.getElementById("sa-btn");
      let k = 0, phase = "travel", t0 = A.now(), from = 0; A.setPrompt("결절이 빛날 때 누르세요!");
      const posOf = n => { const el = nodes[n], ax = el.parentElement.getBoundingClientRect(), r = el.getBoundingClientRect(); return (r.left + r.width / 2 - ax.left) / ax.width * 100; };
      const travelT = n => (n === damaged ? 1.5 : 0.75 - n * 0.03) * 1000, WINDOW = 650;
      const burst = el => { el.classList.remove("boom"); void el.offsetWidth; el.classList.add("boom"); };
      btn.onclick = () => {
        if (phase === "window") { phase = "travel"; A.result(true); nodes[k].classList.remove("glow"); nodes[k].classList.add("hit"); burst(nodes[k]); A.Snd.coin(); A.feedback(true, k === damaged ? "탈수초 구간을 겨우 통과! 전도가 느렸어요." : "활동전위 재생성! 다음 결절로 껑충"); next(); }
        else if (phase === "travel") { A.feedback(false, "아직! 결절에 닿아 빛날 때 눌러요."); }
      };
      const next = () => { k++; if (k >= NODES) { phase = "end"; document.getElementById("sa-syn").classList.add("lit"); return A.later(() => A.finish("수초는 절연체라 전류가 빨리 지나가고, 결절에서만 활동전위가 다시 만들어져요."), 900); } from = posOf(k - 1); t0 = performance.now(); };
      const loop = () => {
        const now = A.now();
        if (phase === "travel") {
          const u = Math.min(1, (now - t0) / travelT(k)), a = k === 0 ? 0 : from, b = posOf(k), slow = k === damaged;
          pulse.style.left = (a + (b - a) * u) + "%"; pulse.style.transform = `translate(-50%,${slow ? -50 : -50 - Math.sin(u * Math.PI) * 55}%) rotate(${u * 360}deg)`;   // hops between nodes, crawls over the bare axon
          if (u >= 1) { phase = "window"; t0 = now; nodes[k].classList.add("glow"); }
        } else if (phase === "window" && now - t0 > WINDOW) { phase = "travel"; nodes[k].classList.remove("glow"); nodes[k].classList.add("miss"); A.result(false); A.feedback(false, "놓쳤어요 — 신호가 약해졌어요."); next(); }
        if (phase !== "end") A.S.raf = requestAnimationFrame(loop);
      };
      pulse.style.left = "0%"; A.S.raf = requestAnimationFrame(loop);
    },
  };

  return { open, pause, resume, get active() { return !!S; }, close() { stopAll(); root.className = "mg2"; S = null; pausedAt = 0; } };
}
