import { useState, useEffect, useCallback, useMemo } from 'react';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import { useQBanks } from './useQBanks';

const STORAGE_KEY = 'quiz_bank_wrong';

export interface WrongItem {
  id: string;
  bankId: string;
  wrongCount: number;
  lastWrongAt: number;
}

export function useWrongBook() {
  const { currentBankId, loaded: banksLoaded } = useQBanks();
  const [allWrong, setAllWrong] = useState<WrongItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!banksLoaded) return;
    const stored = scopedStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // 老数据迁移：没有 bankId 的归到默认题库
        const migrated = parsed.map((w: WrongItem) =>
          w.bankId ? w : { ...w, bankId: 'bank_mock' },
        );
        setAllWrong(migrated);
      } catch {
        setAllWrong([]);
      }
    }
    setLoaded(true);
  }, [banksLoaded]);

  useEffect(() => {
    if (loaded) {
      scopedStorage.setItem(STORAGE_KEY, JSON.stringify(allWrong));
    }
  }, [allWrong, loaded]);

  /** 当前题库的错题列表 */
  const wrongList = useMemo(
    () => allWrong.filter((w) => w.bankId === currentBankId),
    [allWrong, currentBankId],
  );

  const wrongIds = useMemo(() => wrongList.map((w) => w.id), [wrongList]);

  const addWrong = useCallback(
    (questionId: string, bankId?: string) => {
      const targetBankId = bankId || currentBankId;
      setAllWrong((prev) => {
        const existing = prev.find((w) => w.id === questionId);
        if (existing) {
          return prev.map((w) =>
            w.id === questionId
              ? { ...w, wrongCount: w.wrongCount + 1, lastWrongAt: Date.now() }
              : w,
          );
        }
        return [
          ...prev,
          { id: questionId, bankId: targetBankId, wrongCount: 1, lastWrongAt: Date.now() },
        ];
      });
    },
    [currentBankId],
  );

  const removeWrong = useCallback((questionId: string) => {
    setAllWrong((prev) => prev.filter((w) => w.id !== questionId));
  }, []);

  /** 清空当前题库的错题 */
  const clearAll = useCallback(() => {
    setAllWrong((prev) => prev.filter((w) => w.bankId !== currentBankId));
  }, [currentBankId]);

  /** 删除某个题库的所有错题（删除题库时调用） */
  const clearWrongByBankId = useCallback((bankId: string) => {
    setAllWrong((prev) => prev.filter((w) => w.bankId !== bankId));
  }, []);

  const isWrong = useCallback(
    (id: string) => wrongIds.includes(id),
    [wrongIds],
  );

  /** 按多个 bankId 获取错题 ID 列表 */
  const getWrongIdsByBankIds = useCallback(
    (bankIds: string[]) => {
      return allWrong.filter((w) => bankIds.includes(w.bankId)).map((w) => w.id);
    },
    [allWrong],
  );

  return {
    wrongList,
    wrongIds,
    allWrong,
    addWrong,
    removeWrong,
    clearAll,
    clearWrongByBankId,
    isWrong,
    getWrongIdsByBankIds,
    loaded,
  };
}
