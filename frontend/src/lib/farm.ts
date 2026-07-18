const STORAGE_KEY = "aqua-sentinel:farm-id";

export function getSavedFarmId(): number | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

export function saveFarmId(id: number): void {
  localStorage.setItem(STORAGE_KEY, String(id));
}

export function clearSavedFarmId(): void {
  localStorage.removeItem(STORAGE_KEY);
}
