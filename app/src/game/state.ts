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
}

export function newRun(difficulty: Difficulty, color: string, chapter = 1): RunState {
  const ch1 = chapter === 1;
  return {
    difficulty, color, chapter, startTime: 0, elapsed: 0, mistakes: 0, scans: 0, bones: [], items: [], logs: [],
    flags: ch1
      ? { intro: false, assembled: false, blackout: false, power: false, aligned: false, xray: false, gate: false, escaped: false }
      : { intro: false, atlas: false, linked: false, overload: false, stabilized: false, motion: false, gate: false, escaped: false },
    stats: ch1 ? { assembly: 0, align: 0, xray: 0 } : { atlas: 0, link: 0, motion: 0 },
    learned: [],
  };
}

/** Scene key of the world scene for the current chapter (CH1 'Game', CH2 'Game2'). */
export function worldKey() { return G.run.chapter === 2 ? 'Game2' : 'Game'; }
/** Start the current chapter's world scene. */
export function startWorld(sp: Phaser.Scenes.ScenePlugin) { sp.start(worldKey()); }

export const G: { run: RunState } = { run: newRun('basic', 'red') };

/** Cross-scene event bus (world <-> HUD <-> puzzles). */
export const Bus = new Phaser.Events.EventEmitter();
