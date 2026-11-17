// Save and load: the player's cash, completed missions and last position
// persist in localStorage, so quitting and coming back resumes the story.
const SAVE_KEY = 'sunset-shores-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: data.cash,
      missionIndex: data.missionIndex,
      playerX: data.playerX,
      playerZ: data.playerZ,
      savedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
}
