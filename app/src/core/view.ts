// Logical coordinate system shared by every scene.
// The canvas is rendered at device pixel density (crisp on iPad Retina) while all game/UI code
// works in "logical" units: H is ~900 in landscape, W follows the screen aspect.
import Phaser from 'phaser';

export const View = { W: 1440, H: 900, k: 1, dpr: 1, cssW: 1440, cssH: 900, quality: 'high' as 'high' | 'low' };

export function measure() {
  const cssW = Math.max(320, window.innerWidth);
  const cssH = Math.max(320, window.innerHeight);
  const maxDpr = View.quality === 'high' ? 2 : 1.25;
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const aspect = cssW / cssH;
  let H = 900;
  let W = Math.round(H * aspect);
  if (W < 1180) { W = 1180; H = Math.round(W / aspect); }
  View.W = W; View.H = H; View.dpr = dpr; View.cssW = cssW; View.cssH = cssH;
  View.k = (cssW * dpr) / W;
  return { pxW: Math.round(cssW * dpr), pxH: Math.round(cssH * dpr) };
}

export const viewEvents = new Phaser.Events.EventEmitter();

/** Make a scene camera show logical coords (0,0)-(W,H). */
export function fitCamera(cam: Phaser.Cameras.Scene2D.Camera) {
  cam.setSize(Math.round(View.cssW * View.dpr), Math.round(View.cssH * View.dpr));
  cam.setZoom(View.k);
  cam.centerOn(View.W / 2, View.H / 2);
}

/** Resolution to give Text objects so they stay sharp under camera zoom. */
export function textRes() { return Math.min(3, Math.max(1, Math.ceil(View.k * 1.25 * 4) / 4)); }
