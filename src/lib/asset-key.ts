/**
 * Kunci node Firebase tidak boleh mengandung . # $ [ ] /
 * Dipakai untuk menyimpan gambar di roomAssets/{ROOM}/{kunci}.
 */
export function baseName(path: string): string {
  const parts = String(path).split(/[\\/]/);
  return parts[parts.length - 1] || '';
}

export function assetKey(name: string): string {
  return baseName(name).replace(/[.#$\[\]\/]/g, '_');
}

/** Normalisasi jawaban yang dibaca dari RTDB (bisa array atau object ber-indeks) menjadi array panjang total. */
export function normalizeAnswers(raw: unknown, total: number): (number | null)[] {
  const out: (number | null)[] = new Array(total).fill(null);
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  for (let i = 0; i < total; i++) {
    const v = src[i as unknown as string];
    out[i] = typeof v === 'number' && v >= 0 ? v : null;
  }
  return out;
}
