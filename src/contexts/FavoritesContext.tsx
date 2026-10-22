import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import { useQBanks, DEFAULT_BANK_ID } from '@/hooks/useQBanks';

const STORAGE_KEY = 'quiz_bank_favorites';

/** 带题库归属的收藏项 */
interface FavoriteEntry {
  id: string;
  bankId: string;
}

interface FavoritesContextValue {
  allFavorites: FavoriteEntry[];
  favorites: string[];
  loaded: boolean;
  toggleFavorite: (questionId: string, bankId?: string) => void;
  addFavorite: (questionId: string, bankId?: string) => void;
  removeFavorite: (questionId: string) => void;
  isFavorite: (questionId: string) => boolean;
  clearAll: () => void;
  clearFavoritesByBankId: (bankId: string) => void;
  getFavoritesByBankIds: (bankIds: string[]) => string[];
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { currentBankId, loaded: banksLoaded } = useQBanks();
  const [allFavorites, setAllFavorites] = useState<FavoriteEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 初始加载
  useEffect(() => {
    if (!banksLoaded) return;
    const stored = scopedStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // 兼容老数据：string[] 或 FavoriteEntry[]
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
          const migrated: FavoriteEntry[] = parsed.map((id: string) => ({
            id,
            bankId: DEFAULT_BANK_ID,
          }));
          setAllFavorites(migrated);
        } else if (Array.isArray(parsed)) {
          setAllFavorites(parsed);
        } else {
          setAllFavorites([]);
        }
      } catch {
        setAllFavorites([]);
      }
    } else {
      setAllFavorites([]);
    }
    setLoaded(true);
  }, [banksLoaded]);

  // 持久化
  useEffect(() => {
    if (loaded) {
      scopedStorage.setItem(STORAGE_KEY, JSON.stringify(allFavorites));
    }
  }, [allFavorites, loaded]);

  /** 当前题库的收藏 ID 列表 */
  const favorites = useMemo(
    () =>
      allFavorites
        .filter((f) => f.bankId === currentBankId)
        .map((f) => f.id),
    [allFavorites, currentBankId],
  );

  const toggleFavorite = useCallback(
    (questionId: string, bankId?: string) => {
      const targetBankId = bankId || currentBankId;
      setAllFavorites((prev) => {
        const existing = prev.find((f) => f.id === questionId);
        if (existing) {
          return prev.filter((f) => f.id !== questionId);
        }
        return [...prev, { id: questionId, bankId: targetBankId }];
      });
    },
    [currentBankId],
  );

  const addFavorite = useCallback(
    (questionId: string, bankId?: string) => {
      const targetBankId = bankId || currentBankId;
      setAllFavorites((prev) => {
        if (prev.find((f) => f.id === questionId)) return prev;
        return [...prev, { id: questionId, bankId: targetBankId }];
      });
    },
    [currentBankId],
  );

  const removeFavorite = useCallback((questionId: string) => {
    setAllFavorites((prev) => prev.filter((f) => f.id !== questionId));
  }, []);

  const isFavorite = useCallback(
    (questionId: string) => {
      return allFavorites.some((f) => f.id === questionId);
    },
    [allFavorites],
  );

  /** 清空当前题库的收藏 */
  const clearAll = useCallback(() => {
    setAllFavorites((prev) => prev.filter((f) => f.bankId !== currentBankId));
  }, [currentBankId]);

  /** 删除某个题库的所有收藏（删除题库时调用） */
  const clearFavoritesByBankId = useCallback((bankId: string) => {
    setAllFavorites((prev) => prev.filter((f) => f.bankId !== bankId));
  }, []);

  /** 按多个 bankId 获取收藏 ID 列表 */
  const getFavoritesByBankIds = useCallback(
    (bankIds: string[]) => {
      return allFavorites
        .filter((f) => bankIds.includes(f.bankId))
        .map((f) => f.id);
    },
    [allFavorites],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      allFavorites,
      favorites,
      loaded,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      isFavorite,
      clearAll,
      clearFavoritesByBankId,
      getFavoritesByBankIds,
    }),
    [
      allFavorites,
      favorites,
      loaded,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      isFavorite,
      clearAll,
      clearFavoritesByBankId,
      getFavoritesByBankIds,
    ],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return ctx;
}
