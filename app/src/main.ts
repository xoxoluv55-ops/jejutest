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
  scene: [BootScene, TitleScene, GameScene, MuscleScene, HUDScene, AssemblyPuzzle, AlignPuzzle, XrayPuzzle, MuscleAtlasPuzzle, MuscleLinkPuzzle, MuscleMotionPuzzle, ArchiveScene, ResultScene, InfoScene],
});

let rt: number | undefined;
function onResize() {
  clearTimeout(rt);
  rt = window.setTimeout(() => {
    const p = measure();
    game.scale.setZoom(1 / View.dpr);
    game.scale.resize(p.pxW, p.pxH);
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
