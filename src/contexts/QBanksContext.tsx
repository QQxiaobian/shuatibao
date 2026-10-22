import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import { type IQBank } from '@/data/questions';

const QBANKS_KEY = 'quiz_banks';
const CURRENT_BANK_KEY = 'quiz_current_bank_id';
const QUESTIONS_KEY = 'quiz_bank_questions';

/** 默认示例题库 ID */
export const DEFAULT_BANK_ID = 'bank_mock';

interface QBanksContextValue {
  banks: IQBank[];
  currentBank: IQBank | null;
  currentBankId: string;
  loaded: boolean;
  createBank: (name: string, description?: string) => IQBank;
  updateBank: (id: string, updates: Partial<IQBank>) => void;
  deleteBank: (id: string) => void;
  switchBank: (bankId: string) => void;
  getBankById: (id: string) => IQBank | undefined;
  DEFAULT_BANK_ID: string;
}

const QBanksContext = createContext<QBanksContextValue | null>(null);

/**
 * 创建默认示例题库
 */
function createDefaultBank(): IQBank {
  return {
    id: DEFAULT_BANK_ID,
    name: '示例题库',
    description: '内置示例题目，快速体验功能',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 从 storage 读取已有题目，提取 bankId 并推断题库名称
 * 用于首次迁移时反向补齐题库列表
 */
function scanBanksFromQuestions(): { bankId: string; name: string; source: string; earliestAt: number }[] {
  const raw = scopedStorage.getItem(QUESTIONS_KEY);
  if (!raw) return [];
  try {
    const questions = JSON.parse(raw);
    if (!Array.isArray(questions) || questions.length === 0) return [];

    const bankMap = new Map<string, { name: string; source: string; earliestAt: number }>();

    for (const q of questions) {
      const bid = q.bankId || DEFAULT_BANK_ID;
      const existing = bankMap.get(bid);
      const createdAt = q.createdAt || Date.now();
      let name = bid;
      if (bid === DEFAULT_BANK_ID) {
        name = '示例题库';
      } else if (q.subject) {
        name = q.subject;
      } else if (q.source) {
        name = q.source === 'import' ? '导入题库' : q.source === 'manual' ? '手动题库' : '题库';
      }

      if (!existing) {
        bankMap.set(bid, { name, source: q.source || 'unknown', earliestAt: createdAt });
      } else {
        if (createdAt < existing.earliestAt) {
          existing.earliestAt = createdAt;
        }
      }
    }

    return Array.from(bankMap.entries()).map(([bankId, info]) => ({
      bankId,
      name: info.name,
      source: info.source,
      earliestAt: info.earliestAt,
    }));
  } catch {
    return [];
  }
}

export function QBanksProvider({ children }: { children: ReactNode }) {
  const [banks, setBanks] = useState<IQBank[]>([]);
  const [currentBankId, setCurrentBankId] = useState<string>(DEFAULT_BANK_ID);
  const [loaded, setLoaded] = useState(false);

  // 初始加载
  useEffect(() => {
    const banksStored = scopedStorage.getItem(QBANKS_KEY);
    const currentStored = scopedStorage.getItem(CURRENT_BANK_KEY);

    let bankList: IQBank[] = [];
    if (banksStored) {
      try {
        const parsed = JSON.parse(banksStored);
        if (Array.isArray(parsed)) {
          bankList = parsed;
        }
      } catch {
        bankList = [];
      }
    }

    // 扫描已有题目，补齐缺失的题库条目（老数据迁移）
    const scannedBanks = scanBanksFromQuestions();
    if (scannedBanks.length > 0) {
      const existingIds = new Set(bankList.map((b) => b.id));
      for (const sb of scannedBanks) {
        if (!existingIds.has(sb.bankId)) {
          bankList.push({
            id: sb.bankId,
            name: sb.name,
            description: sb.source === 'import' ? '导入题库' : sb.source === 'manual' ? '手动题库' : '',
            createdAt: sb.earliestAt,
            updatedAt: sb.earliestAt,
          });
        }
      }
      bankList.sort((a, b) => b.createdAt - a.createdAt);
    }

    // 自动清理 0 题空题库（保留默认示例题库，避免全空场景）
    const questionRaw = scopedStorage.getItem(QUESTIONS_KEY);
    let questionBankIds = new Set<string>();
    if (questionRaw) {
      try {
        const qs = JSON.parse(questionRaw);
        if (Array.isArray(qs)) {
          questionBankIds = new Set(qs.map((q: any) => q.bankId || DEFAULT_BANK_ID));
        }
      } catch {
        /* ignore */
      }
    }
    const beforeLen = bankList.length;
    bankList = bankList.filter((b) =>
      b.id === DEFAULT_BANK_ID || questionBankIds.has(b.id),
    );
    const cleaned = beforeLen - bankList.length;
    if (cleaned > 0) {
      // 清理空题库时顺便清理对应的错题/收藏/试卷记录（后面 useQuestionBank 等会自己处理，这里只清 banks 列表）
    }

    // 如果最终还是没有任何题库，创建默认示例题库
    if (bankList.length === 0) {
      bankList = [createDefaultBank()];
    }

    setBanks(bankList);

    // 当前选中的题库：优先用保存的，否则选第一个
    const savedCurrent = currentStored || '';
    if (savedCurrent && bankList.find((b) => b.id === savedCurrent)) {
      setCurrentBankId(savedCurrent);
    } else {
      setCurrentBankId(bankList[0]?.id || DEFAULT_BANK_ID);
    }

    setLoaded(true);
  }, []);

  // 持久化题库列表
  useEffect(() => {
    if (loaded) {
      scopedStorage.setItem(QBANKS_KEY, JSON.stringify(banks));
    }
  }, [banks, loaded]);

  // 持久化当前选中
  useEffect(() => {
    if (loaded) {
      scopedStorage.setItem(CURRENT_BANK_KEY, currentBankId);
    }
  }, [currentBankId, loaded]);

  /** 当前选中的题库 */
  const currentBank = useMemo(
    () => banks.find((b) => b.id === currentBankId) || banks[0] || null,
    [banks, currentBankId],
  );

  /** 创建新题库 */
  const createBank = useCallback((name: string, description?: string): IQBank => {
    const now = Date.now();
    const newBank: IQBank = {
      id: `bank_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim() || '未命名题库',
      description: description?.trim() || '',
      createdAt: now,
      updatedAt: now,
    };
    setBanks((prev) => [newBank, ...prev]);
    // 自动切换到新题库
    setCurrentBankId(newBank.id);
    return newBank;
  }, []);

  /** 更新题库信息 */
  const updateBank = useCallback((id: string, updates: Partial<IQBank>) => {
    setBanks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b)),
    );
  }, []);

  /** 删除题库 */
  const deleteBank = useCallback((id: string) => {
    setBanks((prev) => prev.filter((b) => b.id !== id));
    setCurrentBankId((prev) => {
      if (prev === id) {
        // 用函数式prev拿不到最新banks，用闭包banks
        const remaining = banks.filter((b) => b.id !== id);
        return remaining[0]?.id || DEFAULT_BANK_ID;
      }
      return prev;
    });
  }, [banks]);

  /** 切换当前题库 */
  const switchBank = useCallback((bankId: string) => {
    setCurrentBankId(bankId);
  }, []);

  /** 按 ID 获取题库 */
  const getBankById = useCallback(
    (id: string) => {
      return banks.find((b) => b.id === id);
    },
    [banks],
  );

  const value = useMemo<QBanksContextValue>(
    () => ({
      banks,
      currentBank,
      currentBankId,
      loaded,
      createBank,
      updateBank,
      deleteBank,
      switchBank,
      getBankById,
      DEFAULT_BANK_ID,
    }),
    [banks, currentBank, currentBankId, loaded, createBank, updateBank, deleteBank, switchBank, getBankById],
  );

  return <QBanksContext.Provider value={value}>{children}</QBanksContext.Provider>;
}

export function useQBanks() {
  const ctx = useContext(QBanksContext);
  if (!ctx) {
    throw new Error('useQBanks must be used within QBanksProvider');
  }
  return ctx;
}
