import { useState, useEffect, useCallback, useMemo } from 'react';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import { MOCK_QUESTIONS, type IQuestion, type QuestionType, type Difficulty } from '@/data/questions';
import { useQBanks, DEFAULT_BANK_ID } from './useQBanks';

const STORAGE_KEY = 'quiz_bank_questions';

export function useQuestionBank() {
  const { currentBankId, loaded: banksLoaded } = useQBanks();
  const [allQuestions, setAllQuestions] = useState<IQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 初始加载
  useEffect(() => {
    if (!banksLoaded) return;
    const stored = scopedStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // 数据迁移：确保每个题目的 options 都是 string[] 数组
        // 兼容老数据中 options 可能是对象 dict 或其他格式的情况
        const migrated = parsed.map((q: IQuestion & { options?: any }) => {
          let fixed = q.bankId ? q : { ...q, bankId: DEFAULT_BANK_ID };

          // 修复 options 格式：确保是 string[]
          if (!Array.isArray(fixed.options)) {
            const rawOpts = fixed.options;
            const optList: string[] = [];
            if (rawOpts && typeof rawOpts === 'object') {
              // dict 格式，按 A-I 字母顺序提取
              for (let i = 0; i < 9; i++) {
                const letter = String.fromCharCode(65 + i);
                const v = (rawOpts as Record<string, any>)[letter];
                if (v != null && String(v).trim() !== '') {
                  optList.push(String(v).trim());
                }
              }
            }
            fixed = { ...fixed, options: optList };
          }

          return fixed as IQuestion;
        });
        setAllQuestions(migrated);
      } catch {
        setAllQuestions(MOCK_QUESTIONS);
      }
    } else {
      setAllQuestions(MOCK_QUESTIONS);
    }
    setLoaded(true);
  }, [banksLoaded]);

  // 持久化
  useEffect(() => {
    if (loaded) {
      scopedStorage.setItem(STORAGE_KEY, JSON.stringify(allQuestions));
    }
  }, [allQuestions, loaded]);

  /** 当前题库的题目列表 */
  const questions = useMemo(
    () => allQuestions.filter((q) => q.bankId === currentBankId),
    [allQuestions, currentBankId],
  );

  // 新增题目
  const addQuestion = useCallback(
    (
      q: Omit<IQuestion, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'bankId'>,
      source: IQuestion['source'] = 'manual',
      bankId?: string,
    ) => {
      const now = Date.now();
      const newQ: IQuestion = {
        ...q,
        id: `q_${now}_${Math.random().toString(36).slice(2, 8)}`,
        source,
        bankId: bankId || currentBankId,
        createdAt: now,
        updatedAt: now,
      };
      setAllQuestions((prev) => [...prev, newQ]);
      return newQ;
    },
    [currentBankId],
  );

  // 批量新增（指定 bankId，导入场景用）
  const bulkAddQuestions = useCallback(
    (
      list: Omit<IQuestion, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'bankId'>[],
      source: IQuestion['source'] = 'import',
      bankId?: string,
    ) => {
      const now = Date.now();
      const targetBankId = bankId || currentBankId;
      const newList: IQuestion[] = list.map((q, i) => ({
        ...q,
        id: `q_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        source,
        bankId: targetBankId,
        createdAt: now,
        updatedAt: now,
      }));
      setAllQuestions((prev) => [...prev, ...newList]);
      return newList;
    },
    [currentBankId],
  );

  // 更新题目
  const updateQuestion = useCallback((id: string, updates: Partial<IQuestion>) => {
    setAllQuestions((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, ...updates, updatedAt: Date.now() } : q,
      ),
    );
  }, []);

  // 删除题目
  const deleteQuestion = useCallback((id: string) => {
    setAllQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

  // 批量删除某个题库的所有题目（删除题库时调用）
  const deleteQuestionsByBankId = useCallback((bankId: string) => {
    setAllQuestions((prev) => prev.filter((q) => q.bankId !== bankId));
  }, []);

  // 获取所有学科（当前题库）
  const subjects = useMemo(() => {
    const set = new Set(questions.map((q) => q.subject).filter(Boolean));
    return Array.from(set);
  }, [questions]);

  // 获取所有章节（当前题库）
  const chapters = useMemo(() => {
    const set = new Set(questions.map((q) => q.chapter).filter(Boolean));
    return Array.from(set);
  }, [questions]);

  // 按学科获取章节（当前题库）
  const getChaptersBySubject = useCallback(
    (subject: string) => {
      const set = new Set(
        questions
          .filter((q) => !subject || subject === 'all' || q.subject === subject)
          .map((q) => q.chapter)
          .filter(Boolean),
      );
      return Array.from(set);
    },
    [questions],
  );

  // 筛选题目（当前题库范围内）
  const filterQuestions = useCallback(
    (filters: {
      subject?: string;
      chapter?: string;
      type?: QuestionType | 'all';
      difficulty?: Difficulty | 'all' | Difficulty[];
      keyword?: string;
    }) => {
      return questions.filter((q) => {
        if (filters.subject && filters.subject !== 'all' && q.subject !== filters.subject)
          return false;
        if (filters.chapter && filters.chapter !== 'all' && q.chapter !== filters.chapter)
          return false;
        if (filters.type && filters.type !== 'all' && q.type !== filters.type) return false;
        if (filters.difficulty && filters.difficulty !== 'all') {
          const diffs = Array.isArray(filters.difficulty)
            ? filters.difficulty
            : [filters.difficulty];
          if (!diffs.includes(q.difficulty)) return false;
        }
        if (filters.keyword && filters.keyword.trim()) {
          const kw = filters.keyword.toLowerCase();
          const inQuestion = q.question.toLowerCase().includes(kw);
          const inAnalysis = q.analysis.toLowerCase().includes(kw);
          if (!inQuestion && !inAnalysis) return false;
        }
        return true;
      });
    },
    [questions],
  );

  // 按 ID 获取题目（全量找，跨题库也能查到）
  const getQuestionById = useCallback(
    (id: string) => {
      return allQuestions.find((q) => q.id === id);
    },
    [allQuestions],
  );

  return {
    questions,
    allQuestions,
    loaded,
    addQuestion,
    bulkAddQuestions,
    updateQuestion,
    deleteQuestion,
    deleteQuestionsByBankId,
    subjects,
    chapters,
    getChaptersBySubject,
    filterQuestions,
    getQuestionById,
    currentBankId,
  };
}
