export function readLocal(key, fallback, legacyKey = '') {
  try {
    const value = localStorage.getItem(key) || (legacyKey ? localStorage.getItem(legacyKey) : '');
    return JSON.parse(value || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

export function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the app usable when storage is blocked or full.
  }
}
