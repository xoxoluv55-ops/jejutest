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
  logs: string[];
  flags: { intro: boolean; assembled: boolean; blackout: boolean; power: boolean; aligned: boolean; xray: boolean; gate: boolean; escaped: boolean };
  stats: { assembly: number; align: number; xray: number };
  learned: string[];
}

export function newRun(difficulty: Difficulty, color: string): RunState {
  return {
    difficulty, color, startTime: 0, elapsed: 0, mistakes: 0, scans: 0, bones: [], logs: [],
    flags: { intro: false, assembled: false, blackout: false, power: false, aligned: false, xray: false, gate: false, escaped: false },
    stats: { assembly: 0, align: 0, xray: 0 }, learned: [],
  };
}

export const G: { run: RunState } = { run: newRun('basic', 'red') };

/** Cross-scene event bus (world <-> HUD <-> puzzles). */
export const Bus = new Phaser.Events.EventEmitter();
