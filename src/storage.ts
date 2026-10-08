const KEY = "lastCity";

export function loadLastCity(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveLastCity(city: string): void {
  try {
    localStorage.setItem(KEY, city);
  } catch {
    // storage unavailable (private mode, quota); ignore
  }
}
