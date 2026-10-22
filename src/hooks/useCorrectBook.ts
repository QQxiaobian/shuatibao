import { useState, useEffect, useCallback, useMemo } from 'react';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import { useQBanks } from './useQBanks';

const STORAGE_KEY = 'quiz_bank_correct';

export interface CorrectItem {
  id: string;
  bankId: string;
  correctCount: number;
  lastCorrectAt: number;
}

export function useCorrectBook() {
  const { currentBankId, loaded: banksLoaded } = useQBanks();
  const [allCorrect, setAllCorrect] = useState<CorrectItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!banksLoaded) return;
    const stored = scopedStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // 老数据迁移：没有 bankId 的归到默认题库
        const migrated = parsed.map((w: CorrectItem) =>
          w.bankId ? w : { ...w, bankId: 'bank_mock' },
        );
        setAllCorrect(migrated);
      } catch {
        setAllCorrect([]);
      }
    }
    setLoaded(true);
  }, [banksLoaded]);

  useEffect(() => {
    if (loaded) {
      scopedStorage.setItem(STORAGE_KEY, JSON.stringify(allCorrect));
    }
  }, [allCorrect, loaded]);

  /** 当前题库的答对列表 */
  const correctList = useMemo(
    () => allCorrect.filter((w) => w.bankId === currentBankId),
    [allCorrect, currentBankId],
  );

  const correctIds = useMemo(() => correctList.map((w) => w.id), [correctList]);

  const addCorrect = useCallback(
    (questionId: string, bankId?: string) => {
      const targetBankId = bankId || currentBankId;
      setAllCorrect((prev) => {
        const existing = prev.find((w) => w.id === questionId);
        if (existing) {
          return prev.map((w) =>
            w.id === questionId
              ? { ...w, correctCount: w.correctCount + 1, lastCorrectAt: Date.now() }
              : w,
          );
        }
        return [
          ...prev,
          { id: questionId, bankId: targetBankId, correctCount: 1, lastCorrectAt: Date.now() },
        ];
      });
    },
    [currentBankId],
  );

  const removeCorrect = useCallback((questionId: string) => {
    setAllCorrect((prev) => prev.filter((w) => w.id !== questionId));
  }, []);

  /** 清空当前题库的答对记录 */
  const clearAll = useCallback(() => {
    setAllCorrect((prev) => prev.filter((w) => w.bankId !== currentBankId));
  }, [currentBankId]);

  /** 删除某个题库的所有答对记录（删除题库时调用） */
  const clearCorrectByBankId = useCallback((bankId: string) => {
    setAllCorrect((prev) => prev.filter((w) => w.bankId !== bankId));
  }, []);

  const isCorrect = useCallback(
    (id: string) => correctIds.includes(id),
    [correctIds],
  );

  /** 按多个 bankId 获取答对题目 ID 列表 */
  const getCorrectIdsByBankIds = useCallback(
    (bankIds: string[]) => {
      return allCorrect.filter((w) => bankIds.includes(w.bankId)).map((w) => w.id);
    },
    [allCorrect],
  );

  return {
    correctList,
    correctIds,
    allCorrect,
    addCorrect,
    removeCorrect,
    clearAll,
    clearCorrectByBankId,
    isCorrect,
    getCorrectIdsByBankIds,
    loaded,
  };
}
