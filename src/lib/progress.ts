import { scopedStorage } from '@lark-apaas/client-toolkit-lite';

export const PROGRESS_KEY = 'quiz_bank_progress';
export const PROGRESS_INDEX_KEY = 'quiz_bank_progress_index';

export interface ProgressIndexEntry {
  /** localStorage 中的进度 key */
  key: string;
  /** 可直接跳转的刷题链接 */
  url: string;
  /** 本次练习包含的题库 */
  bankIds: string[];
  /** 练习模式 */
  mode: string;
  /** 是否背题模式 */
  isRecite: boolean;
  /** 当前题号（0 开始） */
  currentIndex: number;
  /** 总题数 */
  total: number;
  /** 已答题数 */
  answered: number;
  updatedAt: number;
}

/** 刷题与背题分别使用独立的进度 key */
export function buildProgressKey(bankIds: string[], mode: string, isRecite: boolean): string {
  const bankKey = bankIds.length > 0 ? bankIds.join('_') : 'all';
  return `${PROGRESS_KEY}_${bankKey}_${mode}_${isRecite ? 'recite' : 'practice'}`;
}

export function readProgressIndex(): ProgressIndexEntry[] {
  const stored = scopedStorage.getItem(PROGRESS_INDEX_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ProgressIndexEntry =>
        e && typeof e.key === 'string' && typeof e.url === 'string',
    );
  } catch {
    return [];
  }
}

export function upsertProgressIndex(entry: ProgressIndexEntry): void {
  const list = readProgressIndex();
  const next = [entry, ...list.filter((e) => e.key !== entry.key)]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 60);
  scopedStorage.setItem(PROGRESS_INDEX_KEY, JSON.stringify(next));
}

/** 某个题库最近的刷题 / 背题进度 */
export function getLatestBankProgress(
  bankId: string,
  isRecite: boolean,
): ProgressIndexEntry | null {
  if (!bankId) return null;
  const list = readProgressIndex()
    .filter((e) => e.isRecite === isRecite && e.bankIds.includes(bankId))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return list[0] || null;
}

/** 进度百分比（0-100） */
export function getProgressPercent(entry: ProgressIndexEntry): number {
  if (!entry.total) return 0;
  const done = entry.isRecite ? entry.currentIndex + 1 : entry.answered;
  return Math.min(100, Math.round((done / entry.total) * 100));
}
