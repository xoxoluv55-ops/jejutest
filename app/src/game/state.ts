import Phaser from 'phaser';
import type { BoneId } from '../data/anatomy';

export type Difficulty = 'basic' | 'adv';

export interface RunState {
  difficulty: Difficulty;
  color: string;
  startTime: number;
  elapsed: number;
  mistakes: number;
  scans: number;
  bones: BoneId[];
  items: string[];          // chapter 2+: collected data cores
  logs: string[];
  chapter: number;
  flags: Record<string, boolean>;   // always: intro, gate, escaped (+ chapter-specific)
  stats: Record<string, number>;    // mistakes per puzzle id
  learned: string[];
  // survival (v0.5): hearts, one-hit shield, S-07 keycard, last checkpoint, times hit
  hp: number; shield: number; keycard: boolean; cp: { x: number; y: number; id: string } | null; hits: number;
  // escape-room investigation (v0.7): clues found (kept on death) and this run's codes
  clues: string[]; codes: Record<string, string>; hintsUsed: number;
}

/** 4 digits, no digit repeated (each sticker on the photo shows a different number) */
function randomCode() { const d = Phaser.Utils.Array.Shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]); return d.slice(0, 4).join(''); }

export function newRun(difficulty: Difficulty, color: string, chapter = 1): RunState {
  const ch1 = chapter === 1;
  return {
    difficulty, color, chapter, startTime: 0, elapsed: 0, mistakes: 0, scans: 0, bones: [], items: [], logs: [],
    flags: ch1
      ? { intro: false, assembled: false, blackout: false, power: false, aligned: false, xray: false, gate: false, escaped: false }
      : chapter === 4 ? { intro: false, section: false, muscles: false, load: false, stopped: false, gait: false, gate: false, escaped: false }
      : chapter === 3 ? { intro: false, hxray: false, carpus: false, press: false, released: false, joints: false, gate: false, escaped: false }
      : { intro: false, atlas: false, linked: false, overload: false, stabilized: false, motion: false, gate: false, escaped: false },
    stats: ch1 ? { assembly: 0, align: 0, xray: 0 } : chapter === 4 ? { sect: 0, mus: 0, gait: 0 } : chapter === 3 ? { hxray: 0, hasm: 0, joint: 0 } : { atlas: 0, link: 0, motion: 0 },
    learned: [],
    hp: 3, shield: 0, keycard: false, cp: null, hits: 0,
    clues: [], codes: { scapula: randomCode() }, hintsUsed: 0,
  };
}

/** Scene key of the world scene for the current chapter (CH1 'Game', CH2 'Game2', CH3 'Game3', CH4 'Game4'). */
export function worldKey() { return G.run.chapter === 4 ? 'Game4' : G.run.chapter === 3 ? 'Game3' : G.run.chapter === 2 ? 'Game2' : 'Game'; }
/** Start the current chapter's world scene. */
export function startWorld(sp: Phaser.Scenes.ScenePlugin, data?: { resume?: boolean }) { sp.start(worldKey(), data); }
/** rebuild a RunState from a saved snapshot (fields added in later versions fall back to their defaults) */
export function restoreRun(saved: Record<string, unknown>): RunState {
  const r = saved as unknown as RunState;
  const base = newRun(r.difficulty ?? 'basic', r.color ?? 'red', r.chapter ?? 1);
  return { ...base, ...r, flags: { ...base.flags, ...(r.flags ?? {}) }, codes: { ...base.codes, ...(r.codes ?? {}) }, stats: { ...base.stats, ...(r.stats ?? {}) } };
}

export const G: { run: RunState } = { run: newRun('basic', 'red') };

/** Cross-scene event bus (world <-> HUD <-> puzzles). */
export const Bus = new Phaser.Events.EventEmitter();
