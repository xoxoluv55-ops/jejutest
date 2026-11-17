export interface Settings { master: number; music: number; sfx: number; quality: 'high' | 'low'; hints: boolean; }
export interface SaveData {
  settings: Settings;
  archive: string[];          // unlocked archive entry ids
  bestTime?: number;          // seconds, chapter 1
  clears: number;
  color: string;              // chosen bot color
}
const KEY = 'anatomy-escape-save-v1';
const DEF: SaveData = { settings: { master: 0.8, music: 0.6, sfx: 0.8, quality: 'high', hints: true }, archive: [], clears: 0, color: 'red' };

function read(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEF);
    const d = JSON.parse(raw);
    return { ...structuredClone(DEF), ...d, settings: { ...DEF.settings, ...(d.settings || {}) } };
  } catch { return structuredClone(DEF); }
}
export const Save: SaveData = read();
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(Save)); } catch { /* private mode */ } }
export function unlock(id: string) { if (!Save.archive.includes(id)) { Save.archive.push(id); persist(); return true; } return false; }
