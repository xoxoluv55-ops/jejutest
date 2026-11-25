import Phaser from 'phaser';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import { measure, View, viewEvents } from './core/view';
import { Save } from './core/save';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';
import { AssemblyPuzzle } from './scenes/puzzles/AssemblyPuzzle';
import { AlignPuzzle } from './scenes/puzzles/AlignPuzzle';
import { XrayPuzzle } from './scenes/puzzles/XrayPuzzle';
import { MuscleScene } from './scenes/MuscleScene';
import { MuscleAtlasPuzzle } from './scenes/puzzles/MuscleAtlasPuzzle';
import { MuscleLinkPuzzle } from './scenes/puzzles/MuscleLinkPuzzle';
import { MuscleMotionPuzzle } from './scenes/puzzles/MuscleMotionPuzzle';
import { ArchiveScene } from './scenes/ArchiveScene';
import { ResultScene } from './scenes/ResultScene';
import { InfoScene } from './scenes/InfoScene';
import { InvestigateScene } from './scenes/InvestigateScene';
import { InvHumerusScene } from './scenes/invest/InvHumerusScene';
import { InvRadiusScene } from './scenes/invest/InvRadiusScene';
import { InvUlnaScene } from './scenes/invest/InvUlnaScene';
import { InvClavicleScene } from './scenes/invest/InvClavicleScene';
import { InvMuscleScene } from './scenes/invest/InvMuscleScene';
import { InvHandScene } from './scenes/invest/InvHandScene';
import { HipScene } from './scenes/HipScene';
import { InvHipScene } from './scenes/invest/InvHipScene';
import { HipSectionPuzzle, HipMusclePuzzle, HipGaitPuzzle } from './scenes/puzzles/HipPuzzles';
import { HandScene } from './scenes/HandScene';
import { HandXrayPuzzle, CarpalAssemblyPuzzle, JointPuzzle } from './scenes/puzzles/HandPuzzles';

View.quality = Save.settings.quality;
const px = measure();

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  backgroundColor: '#04060b',
  width: px.pxW,
  height: px.pxH,
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / View.dpr },
  antialias: true,
  mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
  roundPixels: false,
  powerPreference: 'high-performance',
  input: { activePointers: 4 },
  fps: { target: 60, smoothStep: true },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [BootScene, TitleScene, GameScene, MuscleScene, HUDScene, AssemblyPuzzle, AlignPuzzle, XrayPuzzle, MuscleAtlasPuzzle, MuscleLinkPuzzle, MuscleMotionPuzzle, ArchiveScene, ResultScene, InfoScene, InvestigateScene, InvHumerusScene, InvRadiusScene, InvUlnaScene, InvClavicleScene, InvMuscleScene, HandScene, InvHandScene, HandXrayPuzzle, CarpalAssemblyPuzzle, JointPuzzle, HipScene, InvHipScene, HipSectionPuzzle, HipMusclePuzzle, HipGaitPuzzle],
});

// Phaser's resize() leaves canvas.style untouched when zoom is 1 (dpr-1 screens), so after a rotation / window
// resize the canvas kept its old CSS size (squashed picture, black band, buttons cut off). Always set it here.
function syncCanvasCss() {
  const c = game.canvas; if (!c) return;
  c.style.width = View.cssW + 'px'; c.style.height = View.cssH + 'px';
}
game.events.once('ready', syncCanvasCss);
let rt: number | undefined;
function onResize() {
  clearTimeout(rt);
  rt = window.setTimeout(() => {
    const p = measure();
    game.scale.setZoom(1 / View.dpr);
    game.scale.resize(p.pxW, p.pxH);
    syncCanvasCss();
    viewEvents.emit('resize');
  }, 120);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
viewEvents.on('quality', () => { View.quality = Save.settings.quality; onResize(); });
(window as any).__game = game;
import { G, Bus, newRun, startWorld } from './game/state';
import { View as _V } from './core/view';
import { Audio } from './core/audio';
(window as any).__dbg = { G, Bus, View: _V, newRun, startWorld, Audio };
// iOS Safari only lets an AudioContext start/resume inside a real user-gesture handler (touchend / click / keydown).
// Phaser input callbacks may run outside it, so unlock from native listeners as well.
for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) document.addEventListener(ev, () => { Audio.unlock(); Audio.resumeIfNeeded(); }, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) Audio.resumeIfNeeded(); });
document.addEventListener('gesturestart', e => e.preventDefault());

// ---------------------------------------------------------------- phone "back" (Android back button / back swipe)
// Players naturally press Back to leave a clue or device view; without this the browser left the page and the
// whole game closed. A guard history entry turns Back into an in-game "back": close the open layer / view,
// otherwise open the pause menu. The guard is (re)armed on a user gesture, as browsers ignore entries pushed without one.
import { saveRun } from './core/save';
import { worldKey } from './game/state';
let guarded = false;
function armBackGuard() { if (guarded) return; try { history.pushState({ ae: 1 }, ''); guarded = true; } catch { /* ignore */ } }
for (const ev of ['pointerup', 'touchend', 'keydown']) document.addEventListener(ev, armBackGuard, { capture: true, passive: true });
type Backable = Phaser.Scene & { exit?: () => void; layer?: unknown; closeLayer?: () => void; solved?: boolean };
function inGameBack() {
  const running = game.scene.getScenes(true) as Backable[];      // top-most last
  for (let i = running.length - 1; i >= 0; i--) {
    const s = running[i]; const k = s.scene.key;
    if (k === 'HUD') {
      const hud = s as unknown as { overlay?: unknown; closePause(): void; pausedAt: number; closeOverlay(): void };
      if (hud.overlay) { if (hud.pausedAt >= 0) hud.closePause(); else hud.closeOverlay(); return; }
      continue;
    }
    if (k === worldKey()) { Bus.emit('ui:pause'); return; }
    if (s.layer && s.closeLayer) { s.closeLayer(); return; }
    if (s.exit && !s.solved) { s.exit(); return; }
    return;   // title, result, archive...: stay on the page
  }
}
window.addEventListener('popstate', () => { guarded = false; inGameBack(); armBackGuard(); });

// leaving / backgrounding the page mid-run keeps the progress, so [이어하기] works even if the tab was closed
function autosave() {
  const r = G.run as unknown as { flags?: { intro?: boolean; escaped?: boolean }; startTime: number; elapsed?: number };
  if (!r || !r.flags?.intro || r.flags.escaped || !game.scene.getScene(worldKey())?.sys.isActive() && !game.scene.isPaused(worldKey())) return;
  r.elapsed = (game.loop.time - r.startTime) / 1000;
  saveRun(r);
}
window.addEventListener('pagehide', autosave);
document.addEventListener('visibilitychange', () => { if (document.hidden) autosave(); });
