import { useState, useEffect, useCallback, useMemo } from 'react';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import type { IExam, IExamRecord } from '@/data/questions';
import { useQBanks } from './useQBanks';

const EXAMS_KEY = 'quiz_bank_exams';
const RECORDS_KEY = 'quiz_bank_exam_records';

export function useExams() {
  const { currentBankId, loaded: banksLoaded } = useQBanks();
  const [allExams, setAllExams] = useState<IExam[]>([]);
  const [allRecords, setAllRecords] = useState<IExamRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!banksLoaded) return;
    const examsStored = scopedStorage.getItem(EXAMS_KEY);
    const recordsStored = scopedStorage.getItem(RECORDS_KEY);
    if (examsStored) {
      try {
        const parsed = JSON.parse(examsStored);
        // 老数据迁移：没有 bankId 的归到默认题库
        const migrated = parsed.map((e: IExam) =>
          e.bankId ? e : { ...e, bankId: 'bank_mock' },
        );
        setAllExams(migrated);
      } catch {
        setAllExams([]);
      }
    }
    if (recordsStored) {
      try {
        setAllRecords(JSON.parse(recordsStored));
      } catch {
        setAllRecords([]);
      }
    }
    setLoaded(true);
  }, [banksLoaded]);

  useEffect(() => {
    if (loaded) {
      scopedStorage.setItem(EXAMS_KEY, JSON.stringify(allExams));
    }
  }, [allExams, loaded]);

  useEffect(() => {
    if (loaded) {
      scopedStorage.setItem(RECORDS_KEY, JSON.stringify(allRecords));
    }
  }, [allRecords, loaded]);

  /** 当前题库的试卷列表 */
  const exams = useMemo(
    () => allExams.filter((e) => e.bankId === currentBankId),
    [allExams, currentBankId],
  );

  const createExam = useCallback(
    (exam: Omit<IExam, 'id' | 'createdAt' | 'bankId'>, bankId?: string) => {
      const now = Date.now();
      const targetBankId = bankId || currentBankId;
      const newExam: IExam = {
        ...exam,
        id: `exam_${now}_${Math.random().toString(36).slice(2, 8)}`,
        bankId: targetBankId,
        createdAt: now,
      };
      setAllExams((prev) => [newExam, ...prev]);
      return newExam;
    },
    [currentBankId],
  );

  const updateExam = useCallback((examId: string, updates: Partial<IExam>) => {
    setAllExams((prev) =>
      prev.map((e) => (e.id === examId ? { ...e, ...updates } : e)),
    );
  }, []);

  const deleteExam = useCallback((examId: string) => {
    setAllExams((prev) => prev.filter((e) => e.id !== examId));
  }, []);

  /** 删除某个题库的所有试卷（删除题库时调用） */
  const deleteExamsByBankId = useCallback((bankId: string) => {
    setAllExams((prev) => prev.filter((e) => e.bankId !== bankId));
  }, []);

  const getExamById = useCallback(
    (id: string) => {
      return allExams.find((e) => e.id === id);
    },
    [allExams],
  );

  const addRecord = useCallback((record: Omit<IExamRecord, 'id' | 'finishedAt'>) => {
    const newRecord: IExamRecord = {
      ...record,
      id: `record_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      finishedAt: Date.now(),
    };
    setAllRecords((prev) => [newRecord, ...prev]);
    return newRecord;
  }, []);

  const getRecordsByExamId = useCallback(
    (examId: string) => {
      return allRecords.filter((r) => r.examId === examId);
    },
    [allRecords],
  );

  return {
    exams,
    allExams,
    allRecords,
    createExam,
    updateExam,
    deleteExam,
    deleteExamsByBankId,
    getExamById,
    addRecord,
    getRecordsByExamId,
    loaded,
  };
}
