import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Trophy, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { IExamRecord } from '@/data/questions';
import {
  ApiUnavailableError,
  listExamRecords,
  type ISharedExamRecord,
} from '@/lib/examApi';

interface ExamRecordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examName: string;
  /** 共享试卷 ID，存在时从服务端读取所有考生的记录 */
  sharedExamId?: string;
  /** 本机保存的记录（共享服务不可用时兜底显示） */
  localRecords?: IExamRecord[];
}

interface RecordRow {
  id: string;
  participant: string;
  score: number;
  totalScore?: number;
  accuracy: number;
  duration: number;
  finishedAt: number;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}分${String(s).padStart(2, '0')}秒`;
}

export default function ExamRecordsDialog({
  open,
  onOpenChange,
  examName,
  sharedExamId,
  localRecords = [],
}: ExamRecordsDialogProps) {
  const [remote, setRemote] = useState<ISharedExamRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!sharedExamId) {
      setRemote([]);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setRemote(await listExamRecords(sharedExamId));
    } catch (err) {
      setRemote([]);
      setError(
        err instanceof ApiUnavailableError
          ? '共享服务未连接，当前仅显示本机记录'
          : (err as Error).message,
      );
    } finally {
      setLoading(false);
    }
  }, [sharedExamId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const rows = useMemo<RecordRow[]>(() => {
    const source: RecordRow[] = remote.length > 0 || (sharedExamId && !error)
      ? remote.map((r) => ({
          id: r.id,
          participant: r.participant,
          score: r.score,
          totalScore: r.totalScore,
          accuracy: r.accuracy,
          duration: r.duration,
          finishedAt: r.finishedAt,
        }))
      : localRecords.map((r) => ({
          id: r.id,
          participant: r.participant || '我',
          score: r.score,
          totalScore: r.totalScore,
          accuracy: r.accuracy,
          duration: r.duration,
          finishedAt: r.finishedAt,
        }));
    return [...source].sort((a, b) => b.finishedAt - a.finishedAt);
  }, [remote, localRecords, sharedExamId, error]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            考试记录
          </DialogTitle>
          <DialogDescription>
            {examName}
            {sharedExamId ? ' · 所有人的答题记录' : ' · 本机记录'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            共 {rows.length} 条记录
          </span>
          {sharedExamId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={load}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 size-3" />
              )}
              刷新
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            {error}
          </div>
        )}

        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            加载中...
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
              <Trophy className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">还没有考试记录</p>
            <p className="mt-1 text-xs text-muted-foreground">完成一次考试后这里会显示成绩</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div key={row.id} className="rounded-xl border border-border/70 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {row.participant.slice(0, 2) || '匿'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {row.participant}
                      {idx === 0 && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          最新
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(row.finishedAt, 'MM-dd HH:mm', { locale: zhCN })} · 用时 {formatDuration(row.duration)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums text-primary">
                      {row.score}
                      <span className="text-xs font-normal text-muted-foreground">
                        {row.totalScore ? ` / ${row.totalScore}` : ''}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">正确率 {row.accuracy}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
