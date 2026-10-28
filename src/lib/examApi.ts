import type { IQuestion } from '@/data/questions';

export interface ISharedExamSummary {
  id: string;
  name: string;
  questionCount: number;
  totalScore: number;
  typeDistribution: { single: number; multiple: number; judge: number; short: number };
  perQuestionScores: { single: number; multiple: number; judge: number; short: number };
  createdBy: string;
  createdAt: number;
  recordCount: number;
}

export interface ISharedExam extends ISharedExamSummary {
  questions: IQuestion[];
}

export interface ISharedExamRecord {
  id: string;
  sharedExamId: string;
  examName: string;
  participant: string;
  userAnswers: Record<string, string | string[]>;
  score: number;
  totalScore: number;
  accuracy: number;
  duration: number;
  finishedAt: number;
}

export class ApiUnavailableError extends Error {
  constructor(message = '共享服务未连接') {
    super(message);
    this.name = 'ApiUnavailableError';
  }
}

function apiUrl(path: string): string {
  const base = typeof document !== 'undefined' ? document.baseURI : 'http://localhost/';
  return new URL(`api/${path.replace(/^\/+/, '')}`, base).toString();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new ApiUnavailableError();
  }
  if (!res.ok) {
    let message = `请求失败（${res.status}）`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

/** 检查共享后端是否可用 */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await request<{ ok: boolean }>('health');
    return !!res.ok;
  } catch {
    return false;
  }
}

export async function listSharedExams(): Promise<ISharedExamSummary[]> {
  const res = await request<{ exams: ISharedExamSummary[] }>('shared-exams');
  return res.exams;
}

export async function getSharedExam(id: string): Promise<ISharedExam> {
  const res = await request<{ exam: ISharedExam }>(`shared-exams/${encodeURIComponent(id)}`);
  return res.exam;
}

export async function createSharedExam(payload: {
  name: string;
  questions: IQuestion[];
  totalScore: number;
  typeDistribution: ISharedExamSummary['typeDistribution'];
  perQuestionScores: ISharedExamSummary['perQuestionScores'];
  createdBy: string;
}): Promise<ISharedExamSummary> {
  const res = await request<{ exam: ISharedExamSummary }>('shared-exams', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.exam;
}

export async function deleteSharedExam(id: string): Promise<void> {
  await request<{ ok: boolean }>(`shared-exams/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listExamRecords(sharedExamId?: string): Promise<ISharedExamRecord[]> {
  const query = sharedExamId ? `?sharedExamId=${encodeURIComponent(sharedExamId)}` : '';
  const res = await request<{ records: ISharedExamRecord[] }>(`exam-records${query}`);
  return res.records;
}

export async function createExamRecord(payload: {
  sharedExamId: string;
  examName: string;
  participant: string;
  userAnswers: Record<string, string | string[]>;
  score: number;
  totalScore: number;
  accuracy: number;
  duration: number;
}): Promise<ISharedExamRecord> {
  const res = await request<{ record: ISharedExamRecord }>('exam-records', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.record;
}

/** 生成共享试卷的可访问链接（HashRouter） */
export function buildSharedExamUrl(sharedId: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/exam/shared/${sharedId}`;
}
