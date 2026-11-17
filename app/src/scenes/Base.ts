import Phaser from 'phaser';
import { fitCamera, viewEvents } from '../core/view';

/** Scene whose camera always maps logical (0..W, 0..H). Override layout() for resize handling. */
export class BaseScene extends Phaser.Scene {
  protected onResize = () => { fitCamera(this.cameras.main); this.layout(); };
  protected initView() {
    fitCamera(this.cameras.main);
    viewEvents.on('resize', this.onResize);
    this.events.once('shutdown', () => viewEvents.off('resize', this.onResize));
    this.events.once('destroy', () => viewEvents.off('resize', this.onResize));
  }
  layout() { /* default: restart with same data */ this.scene.restart(this.sys.settings.data); }
  /** pointer -> logical coordinates */
  lp(p: Phaser.Input.Pointer) { return this.cameras.main.getWorldPoint(p.x, p.y); }
}
