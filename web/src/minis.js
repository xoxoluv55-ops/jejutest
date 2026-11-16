// NERVE RUNNER 4.8 - chapter minigames. Each chapter mission is its own small game on a dedicated
// screen (the race pauses): reflex response, tract tracing, brainstem nuclei placement, thalamic relay,
// cortex map, cranial-nerve face, cerebellar balance, saltatory timing.
"use strict";
function createMinis(ctx) {   // ctx: { Snd, say(text) }
  const $ = s => document.querySelector(s);
  const root = $("#mg2"), area = $("#mg2-area"), title = $("#mg2-title"), prompt = $("#mg2-prompt"), fbEl = $("#mg2-fb"), dots = $("#mg2-dots"), tbar = $("#mg2-timer"), intro = $("#mg2-intro");
  let S = null, timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function stopAll() { timers.forEach(clearTimeout); timers = []; if (S && S.raf) cancelAnimationFrame(S.raf); if (S && S.cleanup) S.cleanup(); tbar.style.display = "none"; }
  function renderDots() { dots.innerHTML = S.n ? Array.from({ length: S.n }, (_, k) => `<i class="${k < S.log.length ? (S.log[k] ? "ok" : "no") : k === S.log.length ? "cur" : ""}"></i>`).join("") : ""; }
  const api = {
    area, later, shuffle, esc,
    setPrompt(t) { prompt.innerHTML = t; },
    feedback(ok, text) { fbEl.className = "mg2-fb " + (ok ? "ok" : "no"); fbEl.innerHTML = (ok ? "✔ " : "✘ ") + text; },
    clearFb() { fbEl.className = "mg2-fb"; fbEl.innerHTML = ""; },
    result(ok) { S.log.push(!!ok); if (ok) S.ok++; renderDots(); ok ? ctx.Snd.chime() : ctx.Snd.thud(); },
    timer(sec, onEnd) {   // shrinking bar; returns cancel()
      const bar = tbar.firstElementChild; tbar.style.display = "block"; bar.style.transition = "none"; bar.style.width = "100%"; void bar.offsetWidth;
      bar.style.transition = `width ${sec}s linear`; bar.style.width = "0%"; const t = later(() => { tbar.style.display = "none"; onEnd(); }, sec * 1000);
      return () => { clearTimeout(t); tbar.style.display = "none"; };
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
    $("#mg2-go").onclick = () => { intro.style.display = "none"; ctx.Snd.beep(); G.start(api); };
  }

  //================= games =================
  const GAMES = {};

  // CH.2 spinal reflex emergency
  GAMES.reflex = {
    title: "척수반사 긴급 미션", rounds: 5,
    intro: "갑자기 자극이 들어와요! 척수가 어떻게 반응할지 5초 안에 골라 주세요. 맞히면 반사궁에 신호가 흘러요.",
    note: "※ 실제 반사는 수십 밀리초 안에 일어나요. 제한 시간은 게임을 위한 것이에요.",
    start(A) {
      const R = [
        { k: "stretch", s: "🔨 무릎 아래 힘줄을 반사망치로 톡!", a: 0, arc: ["근방추", "Ia 감각신경", "척수 (단일시냅스)", "α운동신경세포", "넙다리네갈래근 수축"], why: "근방추가 늘어남 → Ia 감각신경 → α운동신경세포 → 같은 근육 수축 (신장반사)" },
        { k: "flex", s: "📌 맨발로 압정을 밟았다!", a: 1, arc: ["통각 수용기", "감각신경", "척수 사이신경세포", "운동신경", "굽힘근 수축"], why: "통각 → 사이신경세포 → 굽힘근 수축으로 발을 들어 올리고 폄근은 억제 (굽힘반사)" },
        { k: "crossed", s: "📌 한 발로 압정을 밟아 그 발을 들었다! 몸이 기우뚱…", a: 2, arc: ["통각 수용기", "감각신경", "척수 (반대쪽으로 교차)", "반대쪽 운동신경", "반대쪽 다리 폄"], why: "자극받은 다리는 굽히고, 반대쪽 다리는 펴서 체중을 받쳐요 (교차폄반사)" },
        { k: "recip", s: "💪 넙다리네갈래근(폄근)이 힘껏 수축한다!", a: 3, arc: ["근방추", "Ia 감각신경", "억제성 사이신경세포", "길항근 운동신경 억제", "뒤넙다리근 이완"], why: "억제성 사이신경세포가 길항근을 이완시켜 동작이 부드러워져요 (상호억제)" },
      ];
      const OPT = ["같은 근육 수축 (다리 차올림)", "굽힘근 수축 (발 들어 올리기)", "반대쪽 다리 펴서 버티기", "길항근 이완"];
      const seq = A.shuffle(R.concat([R[(Math.random() * 4) | 0]])); let i = 0;
      A.area.innerHTML = `<div class="rf-stim" id="rf-stim"></div><div class="rf-arc" id="rf-arc"></div><div class="mg-opts" id="rf-opts"></div>`;
      const round = () => {
        if (i >= seq.length) return A.finish("반사는 뇌까지 가지 않고 척수에서 바로 처리돼요.");
        const r = seq[i]; A.clearFb(); A.setPrompt("자극! 척수의 반응은?");
        document.getElementById("rf-stim").textContent = r.s; A.Snd.tone("square", 1200, 1500, 0.12, 0.2);
        document.getElementById("rf-arc").innerHTML = r.arc.map(x => `<span>${x}</span>`).join("<i>→</i>");
        const box = document.getElementById("rf-opts"); box.innerHTML = OPT.map((o, k) => `<button data-k="${k}">${o}</button>`).join("");
        let answered = false;
        const pick = k => {
          if (answered) return; answered = true; cancel(); const ok = k === r.a; A.result(ok);
          box.querySelectorAll("button").forEach(b => { const kk = +b.dataset.k; b.disabled = true; if (kk === r.a) b.classList.add("right"); else if (kk === k) b.classList.add("wrong"); });
          A.feedback(ok, (k < 0 ? "시간 초과! " : "") + r.why);
          if (ok) document.querySelectorAll("#rf-arc span").forEach((s, n) => A.later(() => s.classList.add("lit"), n * 220));
          i++; A.later(round, 2600);
        };
        const cancel = A.timer(5, () => pick(-1));
        box.querySelectorAll("button").forEach(b => b.onclick = () => pick(+b.dataset.k));
      };
      round();
    },
  };

  // CH.3 tract tracing (crossing points)
  GAMES.cross = {
    title: "신경 교차 경로 추적", rounds: 3,
    intro: "신호를 따라 층마다 신호가 지나가는 쪽(몸의 왼쪽/오른쪽 절반)을 눌러 경로를 그려요. 어디서 반대쪽으로 건너가는지가 핵심!",
    start(A) {
      const T = [
        { name: "뒤기둥-안쪽섬유띠계", from: "왼다리의 진동·위치 감각", up: true, lv: [["척수 (뒤뿌리로 들어옴)", 0], ["척수 위쪽 (뒤기둥 · 널판다발)", 0], ["숨뇌 아래 (얇은핵 · 쐐기핵)", 0], ["숨뇌 위 (교차 → 안쪽섬유띠)", 1], ["시상 VPL", 1], ["마루엽 일차몸감각겉질", 1]], why: "같은 쪽으로 올라가 숨뇌에서 교차해요." },
        { name: "앞가쪽계 (척수시상로)", from: "왼손의 통증·온도", up: true, lv: [["척수 뒤뿔 (들어옴)", 0], ["척수 1–2분절 위 (앞흰질맞교차 후)", 1], ["숨뇌", 1], ["시상 VPL", 1], ["마루엽 일차몸감각겉질", 1]], why: "척수에 들어오자마자 1–2분절 안에서 교차해요." },
        { name: "가쪽겉질척수로", from: "왼손을 움직이라는 명령", up: false, lv: [["일차운동겉질", 1], ["속섬유막", 1], ["숨뇌 피라미드 (교차 전)", 1], ["숨뇌 아래 (피라미드 교차 후)", 0], ["척수 가쪽겉질척수로", 0], ["척수 앞뿔 → 왼손 근육", 0]], why: "숨뇌 피라미드 교차에서 반대쪽으로 넘어가요." },
      ];
      let t = 0;
      const tract = () => {
        if (t >= T.length) return A.finish("감각은 위로 올라가며, 운동 명령은 내려가며 반대쪽으로 교차해요.");
        const tr = T[t], rows = tr.up ? tr.lv.slice().reverse() : tr.lv.slice(); let step = 0, miss = 0; A.clearFb();
        A.setPrompt(`<b>${tr.name}</b> — ${tr.from} ${tr.up ? "↑ 올라가요" : "↓ 내려가요"}`);
        A.area.innerHTML = `<div class="tr-head"><span>◀ 몸 왼쪽</span><span>몸 오른쪽 ▶</span></div><div class="tr-wrap"><svg class="tr-svg" id="tr-svg"></svg>${rows.map((r, k) => `<div class="tr-row" data-r="${k}"><button data-s="0"></button><em>${r[0]}</em><button data-s="1"></button></div>`).join("")}</div>`;
        const order = tr.up ? rows.map((_, k) => rows.length - 1 - k) : rows.map((_, k) => k), pts = [];
        const draw = () => { const svg = document.getElementById("tr-svg"), wr = svg.getBoundingClientRect(); svg.innerHTML = pts.length > 1 ? `<polyline points="${pts.map(p => `${p[0] - wr.left},${p[1] - wr.top}`).join(" ")}" />` : ""; };
        const mark = () => { document.querySelectorAll(".tr-row").forEach((el, k) => el.classList.toggle("cur", k === order[step])); };
        mark();
        A.area.querySelectorAll(".tr-row button").forEach(b => b.onclick = () => {
          const row = +b.parentElement.dataset.r; if (row !== order[step]) return;
          const side = +b.dataset.s, want = rows[row][1], ok = side === want; if (!ok) { miss++; A.Snd.thud(); }
          const good = b.parentElement.querySelector(`button[data-s="${want}"]`); good.classList.add("on"); if (!ok) b.classList.add("bad");
          const rc = good.getBoundingClientRect(); pts.push([rc.left + rc.width / 2, rc.top + rc.height / 2]); draw();
          if (!ok) A.feedback(false, `여기서는 ${want ? "오른쪽" : "왼쪽"}이에요. ${tr.why}`); else A.Snd.coin();
          step++; mark();
          if (step >= rows.length) { const pass = miss <= 1; A.result(pass); A.feedback(pass, `${tr.name}: ${tr.why}`); t++; A.later(tract, 3000); }
        });
      };
      tract();
    },
  };

  // CH.4 brainstem nuclei placement
  GAMES.nuclei = {
    title: "뇌줄기 신경핵 배치", rounds: 7,
    intro: "카드에 적힌 신경핵이 뇌줄기의 어느 층에 있는지 눌러서 제자리에 놓아 주세요.",
    start(A) {
      const L = ["중간뇌", "다리뇌", "숨뇌"];
      const D = A.shuffle([["III 눈돌림신경핵", 0], ["IV 도르래신경핵", 0], ["에딩거-웨스트팔핵 (동공 수축)", 0], ["V 삼차신경 운동핵 (씹기)", 1], ["VI 갓돌림신경핵", 1], ["VII 얼굴신경핵", 1], ["XII 혀밑신경핵", 2], ["의문핵 (삼킴 · 발성)", 2], ["X 미주신경 등쪽운동핵", 2]]).slice(0, 7);
      A.area.innerHTML = `<div class="nu-card" id="nu-card"></div><div class="nu-stem">${L.map((l, k) => `<button class="nu-lv nu-${k}" data-l="${k}"><b>${l}</b><div class="nu-chips"></div></button>`).join("")}</div>`;
      let i = 0;
      const round = () => {
        if (i >= D.length) return A.finish("III·IV는 중간뇌, V·VI·VII은 다리뇌, IX·X·XII은 숨뇌 — 위에서 아래로 번호가 커져요.");
        A.clearFb(); A.setPrompt("이 신경핵은 어느 층에 있을까?"); document.getElementById("nu-card").textContent = D[i][0]; let done = false;
        A.area.querySelectorAll(".nu-lv").forEach(b => b.onclick = () => {
          if (done) return; done = true; const k = +b.dataset.l, ok = k === D[i][1]; A.result(ok);
          const tgt = A.area.querySelector(`.nu-lv[data-l="${D[i][1]}"] .nu-chips`); tgt.insertAdjacentHTML("beforeend", `<span class="${ok ? "" : "fix"}">${A.esc(D[i][0])}</span>`);
          if (!ok) b.classList.add("bad"); A.later(() => b.classList.remove("bad"), 700);
          A.feedback(ok, `${D[i][0]}은 ${L[D[i][1]]}에 있어요.`); i++; A.later(round, 1500);
        });
      };
      round();
    },
  };

  // CH.6 thalamic relay delivery
  GAMES.relay = {
    title: "시상 중계 배달", rounds: 6,
    intro: "감각 신호가 시상에 도착해요! 6초 안에 맞는 중계핵을 눌러서 대뇌겉질로 보내 주세요.",
    start(A) {
      const N = [["LGN", "가쪽무릎핵", "일차시각겉질 (뒤통수엽)"], ["MGN", "안쪽무릎핵", "일차청각겉질 (관자엽)"], ["VPL", "배쪽뒤가쪽핵", "일차몸감각겉질 · 몸"], ["VPM", "배쪽뒤안쪽핵", "일차몸감각겉질 · 얼굴"], ["VL", "배쪽가쪽핵", "일차운동겉질"]];
      const SRC = [["👁", "망막에서 온 빛 신호", 0], ["👂", "달팽이관에서 온 소리 신호", 1], ["✋", "손끝의 촉각·통증", 2], ["🦶", "발바닥의 진동 감각", 2], ["😊", "얼굴 피부의 촉각 (삼차신경)", 3], ["⚖", "소뇌에서 온 운동 조절 신호", 4]];
      const seq = A.shuffle(SRC);
      A.area.innerHTML = `<div class="re-row"><div class="re-src" id="re-src"></div><div class="re-th">${N.map((n, k) => `<button data-k="${k}"><b>${n[0]}</b><small>${n[1]}</small></button>`).join("")}<span class="re-name">시상</span></div><div class="re-dst" id="re-dst">대뇌겉질</div></div>`;
      let i = 0;
      const round = () => {
        if (i >= seq.length) return A.finish("시상은 후각을 뺀 거의 모든 감각이 대뇌로 가기 전에 거치는 관문이에요.");
        const s = seq[i]; A.clearFb(); A.setPrompt("어느 중계핵으로 보낼까?"); document.getElementById("re-src").innerHTML = `<span>${s[0]}</span>${s[1]}`; document.getElementById("re-dst").textContent = "대뇌겉질";
        let done = false; const btns = A.area.querySelectorAll(".re-th button"); btns.forEach(b => b.className = "");
        const pick = k => {
          if (done) return; done = true; cancel(); const ok = k === s[2]; A.result(ok);
          btns.forEach(b => { if (+b.dataset.k === s[2]) b.className = "right"; else if (+b.dataset.k === k) b.className = "wrong"; });
          document.getElementById("re-dst").textContent = "→ " + N[s[2]][2]; A.feedback(ok, `${k < 0 ? "시간 초과! " : ""}${s[1]} → ${N[s[2]][0]} (${N[s[2]][1]}) → ${N[s[2]][2]}`); i++; A.later(round, 2300);
        };
        const cancel = A.timer(6, () => pick(-1)); btns.forEach(b => b.onclick = () => pick(+b.dataset.k));
      };
      round();
    },
  };

  // CH.7 cortex function map
  GAMES.cortex = {
    title: "대뇌 기능 지도", rounds: 6,
    intro: "명령이 떨어지면 그 일을 맡은 대뇌겉질 영역(빛나는 점)을 눌러 주세요. 뇌는 왼쪽을 바라보고 있어요.",
    start(A) {
      const H = { m1: [190, 58, "일차운동겉질"], s1: [222, 62, "일차몸감각겉질"], broca: [118, 150, "브로카 영역"], wern: [272, 150, "베르니케 영역"], a1: [218, 160, "일차청각겉질"], v1: [352, 138, "일차시각겉질"] };
      const Q = A.shuffle([["오른손을 움직여라!", "m1"], ["손끝 감촉을 느껴라!", "s1"], ["말을 만들어 내라!", "broca"], ["들은 말을 이해하라!", "wern"], ["음악 소리를 들어라!", "a1"], ["물체의 모양을 보라!", "v1"]]);
      A.area.innerHTML = `<svg class="cx-brain" viewBox="0 0 400 250">
        <path class="lobe fr" d="M30,130 C28,55 105,18 185,20 L205,128 L150,172 C92,190 38,182 30,130Z"/><path class="lobe pa" d="M185,20 C258,18 312,40 332,82 L250,118 L205,128Z"/>
        <path class="lobe oc" d="M332,82 C372,100 382,152 360,190 L300,170 L250,118Z"/><path class="lobe te" d="M150,172 L205,128 L250,118 L300,170 C268,214 190,224 150,172Z"/>
        <path class="cs" d="M196,22 L210,126"/><text x="85" y="95">이마엽</text><text x="250" y="70">마루엽</text><text x="330" y="160">뒤통수엽</text><text x="180" y="200">관자엽</text>
        ${Object.entries(H).map(([k, h]) => `<g class="hs" data-k="${k}"><circle cx="${h[0]}" cy="${h[1]}" r="17"/><text x="${h[0]}" y="${h[1] + 34}" class="hl"></text></g>`).join("")}</svg>`;
      let i = 0;
      const round = () => {
        if (i >= Q.length) return A.finish("운동은 이마엽, 몸감각은 마루엽, 청각·언어 이해는 관자엽, 시각은 뒤통수엽!");
        const q = Q[i]; A.clearFb(); A.setPrompt(`🧠 <b>${q[0]}</b>`); let done = false; A.say(q[0]);
        A.area.querySelectorAll(".hs").forEach(g => g.onclick = () => {
          if (done) return; done = true; const ok = g.dataset.k === q[1]; A.result(ok);
          const right = A.area.querySelector(`.hs[data-k="${q[1]}"]`); right.classList.add("right"); right.querySelector(".hl").textContent = H[q[1]][2];
          if (!ok) { g.classList.add("wrong"); g.querySelector(".hl").textContent = H[g.dataset.k][2]; A.later(() => { g.classList.remove("wrong"); g.querySelector(".hl").textContent = ""; }, 2000); }
          A.feedback(ok, `${q[0]} → ${H[q[1]][2]}`); i++; A.later(() => { right.classList.remove("right"); right.querySelector(".hl").textContent = ""; round(); }, 2100);
        });
      };
      round();
    },
  };

  // CH.8 cranial nerve face
  GAMES.cranial = {
    title: "뇌신경 얼굴 반응", rounds: 6,
    intro: "동작 명령에 맞는 뇌신경을 고르면 얼굴이 그대로 움직여요!",
    start(A) {
      const ACT = [["눈을 바깥쪽으로!", "VI 갓돌림신경", "abd"], ["눈을 안쪽 아래로!", "IV 도르래신경", "tro"], ["활짝 웃어!", "VII 얼굴신경", "fac"], ["꼭꼭 씹어!", "V 삼차신경", "tri"], ["혀를 쭉 내밀어!", "XII 혀밑신경", "hyp"], ["어깨를 으쓱!", "XI 더부신경", "acc"], ["동공을 작게!", "III 눈돌림신경", "ocu"]];
      const ALL = ACT.map(a => a[1]); const seq = A.shuffle(ACT).slice(0, 6);
      A.area.innerHTML = `<div class="cr-row"><svg class="cr-face" id="cr-face" viewBox="0 0 220 220">
        <g class="sh"><path d="M10,215 C20,175 60,165 110,165 C160,165 200,175 210,215Z"/></g>
        <circle class="head" cx="110" cy="95" r="70"/>
        <g class="eye"><ellipse cx="82" cy="85" rx="16" ry="12"/><circle class="pu pl" cx="82" cy="85" r="6"/></g><g class="eye"><ellipse cx="138" cy="85" rx="16" ry="12"/><circle class="pu pr" cx="138" cy="85" r="6"/></g>
        <g class="jaw"><path class="m0" d="M90,128 Q110,134 130,128"/><path class="m1" d="M84,122 Q110,150 136,122 Z"/><path class="tg" d="M102,132 Q110,160 118,132 Z"/></g></svg>
        <div class="mg-opts col" id="cr-opts"></div></div>`;
      const face = document.getElementById("cr-face"); let i = 0;
      const round = () => {
        if (i >= seq.length) return A.finish("눈을 움직이는 건 III·IV·VI, 표정은 VII, 씹기는 V, 혀는 XII, 어깨는 XI!");
        const s = seq[i]; face.setAttribute("class", "cr-face"); A.clearFb(); A.setPrompt(`🗣 <b>${s[0]}</b>`); A.say(s[0]);
        const opts = A.shuffle([s[1]].concat(A.shuffle(ALL.filter(x => x !== s[1])).slice(0, 3))), box = document.getElementById("cr-opts");
        box.innerHTML = opts.map(o => `<button>${o}</button>`).join(""); let done = false;
        box.querySelectorAll("button").forEach(b => b.onclick = () => {
          if (done) return; done = true; const ok = b.textContent === s[1]; A.result(ok);
          box.querySelectorAll("button").forEach(x => { x.disabled = true; if (x.textContent === s[1]) x.classList.add("right"); else if (x === b) x.classList.add("wrong"); });
          face.setAttribute("class", "cr-face act-" + s[2]); A.feedback(ok, `${s[0]} → ${s[1]}`); i++; A.later(round, 2300);
        });
      };
      round();
    },
  };

  // CH.5 cerebellar balance
  GAMES.balance = {
    title: "소뇌 균형 잡기", rounds: 0,
    intro: "NULL이 STAR-01을 계속 흔들어요(운동실조 흉내). ◀ ▶를 눌러 가운데 초록 구역에 15초 동안 최대한 오래 머물러 주세요. 60% 이상이면 성공!",
    note: "소뇌는 '하려던 움직임'과 '실제 움직임'을 비교해 오차를 계속 고쳐 줘요.",
    start(A) {
      A.area.innerHTML = `<div class="ba-wrap"><div class="ba-beam"><div class="ba-zone"></div><div class="ba-star" id="ba-star">★</div></div><div class="ba-pct" id="ba-pct">0%</div>
        <div class="ba-ctl"><button data-d="-1">◀</button><button data-d="1">▶</button></div></div>`;
      const hold = { "-1": 0, "1": 0 }, keys = e => { if (e.code === "ArrowLeft") hold["-1"] = e.type === "keydown" ? 1 : 0; if (e.code === "ArrowRight") hold["1"] = e.type === "keydown" ? 1 : 0; };
      A.area.querySelectorAll(".ba-ctl button").forEach(b => { const d = b.dataset.d; b.onpointerdown = e => { e.preventDefault(); hold[d] = 1; b.classList.add("down"); }; b.onpointerup = b.onpointercancel = b.onpointerleave = () => { hold[d] = 0; b.classList.remove("down"); }; });
      addEventListener("keydown", keys); addEventListener("keyup", keys); A.S.cleanup = () => { removeEventListener("keydown", keys); removeEventListener("keyup", keys); };
      let x = 0, v = 0, t = 0, inside = 0, last = performance.now(); const star = document.getElementById("ba-star"), pct = document.getElementById("ba-pct");
      A.setPrompt("가운데 초록 구역을 지켜라!"); A.timer(15, () => {});
      const loop = now => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
        const drift = Math.sin(t * 1.3) * 1.6 + Math.sin(t * 2.9 + 1) * 1.1 + Math.sin(t * 0.55 + 2) * 0.9;
        v += (drift + (hold["1"] - hold["-1"]) * 4.2 - v * 2.2) * dt; x = Math.max(-1, Math.min(1, x + v * dt)); if (Math.abs(x) >= 1) v *= -0.3;
        const inZ = Math.abs(x) < 0.28; if (inZ) inside += dt; star.style.left = (50 + x * 46) + "%"; star.classList.toggle("in", inZ);
        pct.textContent = Math.round(inside / Math.max(0.01, t) * 100) + "%";
        if (t >= 15) { const r = inside / t; A.S.pass = r >= 0.6; A.result(A.S.pass); return A.finish(`균형 유지 ${Math.round(r * 100)}%`); }
        A.S.raf = requestAnimationFrame(loop);
      };
      A.S.raf = requestAnimationFrame(loop);
    },
  };

  // CH.1 saltatory conduction timing
  GAMES.saltatory = {
    title: "도약전도 타이밍", rounds: 8,
    intro: "신호가 랑비에 결절(청록 마디)에 닿아 빛나는 순간 [재생성!]을 눌러 활동전위를 다시 만들어 주세요. 수초 구간은 빠르게 건너뛰어요.",
    note: "회색 구간은 수초가 벗겨진 곳(탈수초)이라 신호가 느려져요.",
    start(A) {
      const NODES = 8, damaged = 5;
      A.area.innerHTML = `<div class="sa-axon">${Array.from({ length: NODES }, (_, k) => `<div class="sa-seg${k === damaged ? " dm" : ""}"></div><div class="sa-node" data-n="${k}"></div>`).join("")}<div class="sa-pulse" id="sa-pulse"></div></div><button class="big primary sa-btn" id="sa-btn">⚡ 재생성!</button>`;
      const pulse = document.getElementById("sa-pulse"), nodes = A.area.querySelectorAll(".sa-node"), btn = document.getElementById("sa-btn");
      let k = 0, phase = "travel", t0 = performance.now(), from = 0; A.setPrompt("결절이 빛날 때 누르세요!");
      const posOf = n => { const el = nodes[n], ax = el.parentElement.getBoundingClientRect(), r = el.getBoundingClientRect(); return (r.left + r.width / 2 - ax.left) / ax.width * 100; };
      const travelT = n => (n === damaged ? 1.5 : 0.75 - n * 0.03) * 1000, WINDOW = 650;
      btn.onclick = () => {
        if (phase === "window") { phase = "travel"; A.result(true); nodes[k].classList.add("hit"); A.Snd.coin(); A.feedback(true, k === damaged ? "탈수초 구간을 겨우 통과! 전도가 느렸어요." : "활동전위 재생성! 다음 결절로 껑충"); next(); }
        else if (phase === "travel") { A.feedback(false, "아직! 결절에 닿아 빛날 때 눌러요."); }
      };
      const next = () => { k++; if (k >= NODES) { phase = "end"; return A.later(() => A.finish("수초는 절연체라 전류가 빨리 지나가고, 결절에서만 활동전위가 다시 만들어져요."), 600); } from = posOf(k - 1); t0 = performance.now(); };
      const loop = now => {
        if (phase === "travel") {
          const u = Math.min(1, (now - t0) / travelT(k)), a = k === 0 ? 0 : from, b = posOf(k); pulse.style.left = (a + (b - a) * u) + "%";
          if (u >= 1) { phase = "window"; t0 = now; nodes[k].classList.add("glow"); }
        } else if (phase === "window" && now - t0 > WINDOW) { phase = "travel"; nodes[k].classList.remove("glow"); nodes[k].classList.add("miss"); A.result(false); A.feedback(false, "놓쳤어요 — 신호가 약해졌어요."); next(); }
        if (phase !== "end") A.S.raf = requestAnimationFrame(loop);
      };
      pulse.style.left = "0%"; A.S.raf = requestAnimationFrame(loop);
    },
  };

  return { open, close() { stopAll(); root.className = "mg2"; S = null; } };
}
