import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, Play, Download, TrendingUp, Share2, Users, Link2, Copy, RefreshCw, Loader2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuestionBank } from '@/hooks/useQuestionBank';
import { useExams } from '@/hooks/useExams';
import {
  QUESTION_TYPE_LABELS,
  type IExam,
  type IExamRecord,
  type IQuestion,
  type QuestionType,
  type Difficulty,
} from '@/data/questions';
import {
  ApiUnavailableError,
  buildSharedExamUrl,
  createSharedExam,
  deleteSharedExam,
  listSharedExams,
  type ISharedExamSummary,
} from '@/lib/examApi';
import { getParticipantName, setParticipantName } from '@/lib/participant';
import ExamRecordsDialog from './ExamRecordsDialog';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface ExamCreateDialogProps {
  onCreate: (exam: Omit<IExam, 'id' | 'createdAt' | 'bankId'>) => IExam;
  trigger?: React.ReactNode;
}

function ExamCreateDialog({ onCreate, trigger }: ExamCreateDialogProps) {
  const { questions, subjects, getChaptersBySubject } = useQuestionBank();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('all');
  const [chapter, setChapter] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [singleCount, setSingleCount] = useState(10);
  const [multipleCount, setMultipleCount] = useState(5);
  const [judgeCount, setJudgeCount] = useState(5);
  const [shortCount, setShortCount] = useState(0);
  const [singleScore, setSingleScore] = useState(2);
  const [multipleScore, setMultipleScore] = useState(4);
  const [judgeScore, setJudgeScore] = useState(2);
  const [shortScore, setShortScore] = useState(10);

  const chapterOptions = useMemo(() => getChaptersBySubject(subject), [subject, getChaptersBySubject]);

  // 各题型可用数量
  const availableCounts = useMemo(() => {
    const base = questions.filter((q) => {
      if (subject !== 'all' && q.subject !== subject) return false;
      if (chapter !== 'all' && q.chapter !== chapter) return false;
      if (difficulty !== 'all' && String(q.difficulty) !== difficulty) return false;
      return true;
    });
    return {
      single: base.filter((q) => q.type === 'single').length,
      multiple: base.filter((q) => q.type === 'multiple').length,
      judge: base.filter((q) => q.type === 'judge').length,
      short: base.filter((q) => q.type === 'short').length,
    };
  }, [questions, subject, chapter, difficulty]);

  const totalRequested = singleCount + multipleCount + judgeCount + shortCount;
  const totalScore =
    singleCount * singleScore +
    multipleCount * multipleScore +
    judgeCount * judgeScore +
    shortCount * shortScore;
  const canCreate =
    totalRequested > 0 &&
    singleCount <= availableCounts.single &&
    multipleCount <= availableCounts.multiple &&
    judgeCount <= availableCounts.judge &&
    shortCount <= availableCounts.short;

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('请输入试卷名称');
      return;
    }
    if (!canCreate) {
      toast.error('题库中符合条件的题目不足');
      return;
    }

    const base = questions.filter((q) => {
      if (subject !== 'all' && q.subject !== subject) return false;
      if (chapter !== 'all' && q.chapter !== chapter) return false;
      if (difficulty !== 'all' && String(q.difficulty) !== difficulty) return false;
      return true;
    });

    const pickRandom = (type: QuestionType, count: number) => {
      const pool = base.filter((q) => q.type === type);
      return shuffle(pool).slice(0, count).map((q) => q.id);
    };

    const questionIds = [
      ...pickRandom('single', singleCount),
      ...pickRandom('multiple', multipleCount),
      ...pickRandom('judge', judgeCount),
      ...pickRandom('short', shortCount),
    ];

    onCreate({
      name: name.trim(),
      questionIds,
      typeDistribution: {
        single: singleCount,
        multiple: multipleCount,
        judge: judgeCount,
        short: shortCount,
      },
      perQuestionScores: {
        single: singleScore,
        multiple: multipleScore,
        judge: judgeScore,
        short: shortScore,
      },
      totalScore,
    });

    toast.success('试卷生成成功');
    setOpen(false);
    setName('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 size-4" />
            新建试卷
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>智能组卷</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>试卷名称</Label>
            <Input
              placeholder="请输入试卷名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>学科范围</Label>
              <Select value={subject} onValueChange={(v) => { setSubject(v); setChapter('all'); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部学科</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>章节范围</Label>
              <Select value={chapter} onValueChange={setChapter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部章节</SelectItem>
                  {chapterOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>难度范围</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部难度</SelectItem>
                <SelectItem value="1">简单</SelectItem>
                <SelectItem value="2">中等</SelectItem>
                <SelectItem value="3">困难</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-3 text-sm font-medium text-foreground">题目数量配置</div>
            <div className="space-y-3">
              {(['single', 'multiple', 'judge', 'short'] as QuestionType[]).map((t) => {
                const counts = { single: singleCount, multiple: multipleCount, judge: judgeCount, short: shortCount };
                const setters = { single: setSingleCount, multiple: setMultipleCount, judge: setJudgeCount, short: setShortCount };
                const scores = { single: singleScore, multiple: multipleScore, judge: judgeScore, short: shortScore };
                const scoreSetters = { single: setSingleScore, multiple: setMultipleScore, judge: setJudgeScore, short: setShortScore };
                const val = counts[t];
                const avail = availableCounts[t];
                const score = scores[t];
                return (
                   <div key={t} className="space-y-1.5">
                     <div className="flex items-center justify-between">
                       <span className="text-sm text-foreground">{QUESTION_TYPE_LABELS[t]}</span>
                       <div className="flex items-center gap-2 text-xs tabular-nums">
                         <div className="flex items-center gap-1">
                           <Input
                             type="number"
                             min={0}
                             max={Math.max(0, avail)}
                             value={val}
                             onChange={(e) => {
                               const n = Math.max(0, Math.min(Math.max(0, avail), Number(e.target.value) || 0));
                               setters[t](n);
                             }}
                             className={'h-6 w-14 px-1.5 text-center text-xs ' + (val > avail ? 'border-destructive text-destructive' : '')}
                           />
                           <span className="text-muted-foreground">道</span>
                         </div>
                         <span className="text-muted-foreground mx-1">·</span>
                         <div className="flex items-center gap-1">
                           <Input
                             type="number"
                             min={1}
                             max={100}
                             value={score}
                             onChange={(e) => scoreSetters[t](Math.max(1, Number(e.target.value) || 1))}
                             className="h-6 w-14 px-1.5 text-center text-xs"
                           />
                           <span className="text-muted-foreground">分/题</span>
                         </div>
                       </div>
                     </div>
                     <input
                       type="range"
                       min={0}
                       max={Math.max(0, avail)}
                       value={val}
                       onChange={(e) => setters[t](Number(e.target.value))}
                       className="w-full accent-primary"
                     />
                   </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-sm">
              <span className="text-muted-foreground">总计</span>
              <span className="font-medium text-foreground">
                {totalRequested} 题 · {totalScore} 分
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={handleCreate} disabled={!canCreate || !name.trim()}>
            生成试卷
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ExamPage() {

  const { exams, createExam, updateExam, deleteExam, getRecordsByExamId } = useExams();
  const { getQuestionById } = useQuestionBank();
  const [searchParams] = useSearchParams();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<'mine' | 'shared'>(
    searchParams.get('tab') === 'shared' ? 'shared' : 'mine',
  );

  const [recordsTarget, setRecordsTarget] = useState<{
    name: string;
    sharedExamId?: string;
    localRecords: IExamRecord[];
  } | null>(null);

  const [startTarget, setStartTarget] = useState<{ id: string; shared: boolean } | null>(null);
  const [startName, setStartName] = useState(getParticipantName());

  const [shareTarget, setShareTarget] = useState<IExam | null>(null);
  const [shareName, setShareName] = useState(getParticipantName());
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const [sharedExams, setSharedExams] = useState<ISharedExamSummary[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState('');
  const [deleteSharedId, setDeleteSharedId] = useState<string | null>(null);
  const [deletingShared, setDeletingShared] = useState(false);

  const handleExportPrint = (examId: string, withAnswer: boolean) => {
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return;

    const qs = exam.questionIds
      .map((id) => getQuestionById(id))
      .filter(Boolean) as IQuestion[];

    const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

    const questionsHtml = qs
      .map((q, idx) => {
        const typeLabel = QUESTION_TYPE_LABELS[q.type];
        let optionsHtml = '';
        if (q.type === 'single' || q.type === 'multiple') {
          optionsHtml = q.options
            .map(
              (opt, i) => `
                <div style="margin: 6px 0;">
                  <span style="display: inline-block; min-width: 24px;">${LETTERS[i]}.</span>
                  ${opt}
                </div>`
            )
            .join('');
        }
        const answerHtml = withAnswer
          ? `
            <div style="margin-top: 8px; padding: 8px 12px; background: #f0fdf4; border-radius: 6px; font-size: 14px;">
              <strong style="color: #16a34a;">正确答案：</strong>
              ${Array.isArray(q.answer) ? q.answer.join('、') : q.answer}
            </div>
            ${q.analysis ? `<div style="margin-top: 6px; padding: 8px 12px; background: #f5f5f4; border-radius: 6px; font-size: 14px;"><strong>解析：</strong>${q.analysis}</div>` : ''}
            `
          : '';
        const blankLine = q.type === 'short'
          ? '<div style="margin: 12px 0; height: 60px; border-bottom: 1px dashed #d4d4d4;"></div>'
          : '';
        return `
          <div style="margin-bottom: 24px; page-break-inside: avoid;">
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; padding: 2px 8px; background: #e5e7eb; border-radius: 4px; font-size: 12px; margin-right: 8px;">${typeLabel}</span>
              <strong>${idx + 1}. ${q.question}</strong>
            </div>
            ${optionsHtml}
            ${blankLine}
            ${answerHtml}
          </div>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${exam.name}${withAnswer ? '（带答案）' : ''}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #111; }
  h1 { text-align: center; font-size: 24px; margin-bottom: 8px; }
  .subtitle { text-align: center; color: #666; font-size: 14px; margin-bottom: 30px; }
  .info { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e5e5; padding-bottom: 12px; margin-bottom: 24px; font-size: 14px; color: #666; }
  @media print { body { padding: 0; } .no-print { display: none; } }
  .no-print { position: fixed; top: 16px; right: 16px; z-index: 100; }
  .no-print button { padding: 8px 16px; background: #22c55e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()">打印 / 导出 PDF</button>
</div>
<h1>${exam.name}</h1>
<div class="subtitle">${withAnswer ? '带答案版' : '不带答案版'}</div>
<div class="info">
  <span>题目总数：${qs.length} 题</span>
  <span>总分：${exam.totalScore} 分</span>
  <span>考试时间：______ 分钟</span>
</div>
${questionsHtml}
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
    setExportOpen(null);
    toast.success('试卷已在新窗口打开，按 Ctrl+P 打印或另存为 PDF');
  };

  // 生成纯文本试卷
  const generateTxtContent = (exam: { name: string; totalScore: number; questionIds: string[] }, qs: IQuestion[], withAnswer: boolean): string => {
    const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const lines: string[] = [];
    lines.push(exam.name);
    lines.push('='.repeat(50));
    lines.push(`题目总数：${qs.length} 题`);
    lines.push(`总分：${exam.totalScore} 分`);
    lines.push('');
    
    qs.forEach((q, idx) => {
      const typeLabel = QUESTION_TYPE_LABELS[q.type];
      lines.push(`${idx + 1}. [${typeLabel}] ${q.question}`);
      
      if (q.type === 'single' || q.type === 'multiple') {
        q.options.forEach((opt, i) => {
          lines.push(`   ${LETTERS[i]}. ${opt}`);
        });
      }
      
      if (q.type === 'short') {
        lines.push('');
        lines.push('   答：________________________________');
        lines.push('');
      }
      
      if (withAnswer) {
        const answer = Array.isArray(q.answer) ? q.answer.join('、') : q.answer;
        lines.push(`   【正确答案】${answer}`);
        if (q.analysis) {
          lines.push(`   【解析】${q.analysis}`);
        }
      }
      
      lines.push('');
    });
    
    return lines.join('\n');
  };

  const handleExportTxt = (examId: string, withAnswer: boolean) => {
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return;

    const qs = exam.questionIds
      .map((id) => getQuestionById(id))
      .filter(Boolean) as IQuestion[];

    if (qs.length === 0) {
      toast.error('没有可导出的题目');
      return;
    }

    const content = generateTxtContent(exam, qs, withAnswer);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = withAnswer ? '（带答案）' : '';
    a.download = `${exam.name}${suffix}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportOpen(null);
    toast.success('TXT 试卷已导出');
  };

  // 生成 Word (.docx) — 使用 HTML 作为 Word 可打开的文档格式
  const handleExportWord = (examId: string, withAnswer: boolean) => {
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return;

    const qs = exam.questionIds
      .map((id) => getQuestionById(id))
      .filter(Boolean) as IQuestion[];

    if (qs.length === 0) {
      toast.error('没有可导出的题目');
      return;
    }

    const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

    const questionsHtml = qs
      .map((q, idx) => {
        const typeLabel = QUESTION_TYPE_LABELS[q.type];
        let optionsHtml = '';
        if (q.type === 'single' || q.type === 'multiple') {
          optionsHtml = q.options
            .map(
              (opt, i) => `
                <p style="margin: 6px 0; text-indent: 2em;">
                  ${LETTERS[i]}. ${opt}
                </p>`,
            )
            .join('');
        }
        const answerHtml = withAnswer
          ? `
            <p style="margin-top: 8px; padding: 8px 12px; background: #f0fdf4; border-radius: 6px; font-size: 14px;">
              <strong style="color: #16a34a;">正确答案：</strong>
              ${Array.isArray(q.answer) ? q.answer.join('、') : q.answer}
            </p>
            ${q.analysis ? `<p style="margin-top: 6px; padding: 8px 12px; background: #f5f5f4; border-radius: 6px; font-size: 14px;"><strong>解析：</strong>${q.analysis}</p>` : ''}
            `
          : '';
        const blankLine = q.type === 'short'
          ? '<p style="margin: 12px 0; height: 60px; border-bottom: 1px dashed #999;"></p>'
          : '';
        return `
          <div style="margin-bottom: 24px;">
            <p style="margin-bottom: 8px;">
              <span style="display: inline-block; padding: 2px 8px; background: #e5e7eb; border-radius: 4px; font-size: 12px; margin-right: 8px;">${typeLabel}</span>
              <strong>${idx + 1}. ${q.question}</strong>
            </p>
            ${optionsHtml}
            ${blankLine}
            ${answerHtml}
          </div>`;
      })
      .join('');

    // 生成 Word 可识别的 HTML 文档，保存为 .doc 文件（Word 可直接打开）
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<title>${exam.name}${withAnswer ? '（带答案）' : ''}</title>
<style>
  body { font-family: "宋体", SimSun, "Microsoft YaHei", sans-serif; font-size: 14px; color: #000; line-height: 1.6; }
  h1 { text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 8px; }
  .subtitle { text-align: center; color: #666; font-size: 14px; margin-bottom: 30px; }
  .info { display: flex; justify-content: space-between; border-bottom: 1px solid #999; padding-bottom: 12px; margin-bottom: 24px; font-size: 14px; }
</style>
</head>
<body>
<h1>${exam.name}</h1>
<div class="subtitle">${withAnswer ? '带答案版' : '不带答案版'}</div>
<div class="info">
  <span>题目总数：${qs.length} 题</span>
  <span>总分：${exam.totalScore} 分</span>
  <span>考试时间：______ 分钟</span>
</div>
${questionsHtml}
</body>
</html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = withAnswer ? '（带答案）' : '';
    a.download = `${exam.name}${suffix}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportOpen(null);
    toast.success('Word 试卷已导出（.doc 格式，Word 可直接打开）');
  };

  const navigate = useNavigate();

  const loadShared = useCallback(async () => {
    setSharedLoading(true);
    setSharedError('');
    try {
      setSharedExams(await listSharedExams());
    } catch (err) {
      setSharedExams([]);
      setSharedError(
        err instanceof ApiUnavailableError
          ? '共享服务未连接：请使用 docker compose 启动后端版本后再共享试卷'
          : (err as Error).message,
      );
    } finally {
      setSharedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'shared') loadShared();
  }, [tab, loadShared]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('链接已复制');
    } catch {
      toast.error('复制失败，请手动选择复制');
    }
  };

  const openStart = (id: string, shared: boolean) => {
    setStartName(getParticipantName());
    setStartTarget({ id, shared });
  };

  const confirmStart = () => {
    if (!startTarget) return;
    const name = setParticipantName(startName);
    if (!name) {
      toast.error('请输入你的姓名');
      return;
    }
    const target = startTarget;
    setStartTarget(null);
    navigate(target.shared ? `/exam/shared/${target.id}` : `/exam/${target.id}`);
  };

  const openRecords = (exam: IExam) => {
    setRecordsTarget({
      name: exam.name,
      sharedExamId: exam.sharedId,
      localRecords: getRecordsByExamId(exam.id),
    });
  };

  const openSharedRecords = (exam: ISharedExamSummary) => {
    setRecordsTarget({
      name: exam.name,
      sharedExamId: exam.id,
      localRecords: getRecordsByExamId(exam.id),
    });
  };

  const openShare = (exam: IExam) => {
    setShareTarget(exam);
    setShareName(getParticipantName());
    setShareUrl(exam.sharedId ? buildSharedExamUrl(exam.sharedId) : '');
  };

  const handleShare = async () => {
    if (!shareTarget) return;
    const creator = setParticipantName(shareName);
    if (!creator) {
      toast.error('请输入你的姓名');
      return;
    }
    const questions = shareTarget.questionIds
      .map((qid) => getQuestionById(qid))
      .filter(Boolean) as IQuestion[];
    if (questions.length === 0) {
      toast.error('试卷中没有可分享的题目');
      return;
    }

    setSharing(true);
    try {
      if (shareTarget.sharedId) {
        try {
          await deleteSharedExam(shareTarget.sharedId);
        } catch {
          /* 旧共享删除失败时继续创建新的 */
        }
      }
      const created = await createSharedExam({
        name: shareTarget.name,
        questions,
        totalScore: shareTarget.totalScore,
        typeDistribution: shareTarget.typeDistribution,
        perQuestionScores: shareTarget.perQuestionScores,
        createdBy: creator,
      });
      updateExam(shareTarget.id, { sharedId: created.id });
      setShareTarget({ ...shareTarget, sharedId: created.id });
      setShareUrl(buildSharedExamUrl(created.id));
      toast.success('共享成功，复制链接发给其他人即可考试');
    } catch (err) {
      toast.error(
        err instanceof ApiUnavailableError
          ? '共享服务未连接：请使用 docker compose 启动后端版本'
          : (err as Error).message,
      );
    } finally {
      setSharing(false);
    }
  };

  const handleUnshare = async (exam: IExam) => {
    if (!exam.sharedId) return;
    try {
      await deleteSharedExam(exam.sharedId);
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) {
        toast.error((err as Error).message);
      }
    }
    updateExam(exam.id, { sharedId: undefined });
    setShareTarget(null);
    setShareUrl('');
    toast.success('已取消共享');
    if (tab === 'shared') loadShared();
  };

  const handleDeleteExam = async (id: string) => {
    const exam = exams.find((e) => e.id === id);
    if (exam?.sharedId) {
      try {
        await deleteSharedExam(exam.sharedId);
      } catch {
        /* 忽略共享删除失败，继续删除本地试卷 */
      }
    }
    deleteExam(id);
    setDeleteConfirm(null);
    toast.success('删除成功');
  };

  const handleDeleteShared = async () => {
    if (!deleteSharedId) return;
    setDeletingShared(true);
    try {
      await deleteSharedExam(deleteSharedId);
      setSharedExams((prev) => prev.filter((e) => e.id !== deleteSharedId));
      toast.success('共享试卷已删除');
      setDeleteSharedId(null);
    } catch (err) {
      toast.error(
        err instanceof ApiUnavailableError
          ? '共享服务未连接'
          : (err as Error).message,
      );
    } finally {
      setDeletingShared(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground md:text-2xl">试卷中心</h1>
          <p className="mt-1 text-sm text-muted-foreground">智能组卷、在线考试、共享成绩</p>
        </div>
        <ExamCreateDialog onCreate={createExam} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'mine' | 'shared')}>
        <TabsList className="mb-4 grid w-full grid-cols-2">
          <TabsTrigger value="mine">我的试卷</TabsTrigger>
          <TabsTrigger value="shared">共享试卷</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'mine' && (
        <>
          {exams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-muted">
                  <FileText className="size-8 text-muted-foreground" />
                </div>
                <p className="text-base font-medium text-foreground">还没有试卷</p>
                <p className="mt-1 text-sm text-muted-foreground">点击「新建试卷」开始组卷</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => (
                <Card key={exam.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="min-w-0 flex-1 truncate font-medium text-foreground">{exam.name}</h3>
                      {exam.sharedId && (
                        <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                          <Link2 className="size-2.5" />
                          已共享
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{exam.questionIds.length} 题</span>
                      <span>·</span>
                      <span>{exam.totalScore} 分</span>
                      <span>·</span>
                      <span>{format(exam.createdAt, 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {exam.typeDistribution.single > 0 && (
                        <Badge variant="outline" className="text-xs">单选 {exam.typeDistribution.single}</Badge>
                      )}
                      {exam.typeDistribution.multiple > 0 && (
                        <Badge variant="outline" className="text-xs">多选 {exam.typeDistribution.multiple}</Badge>
                      )}
                      {exam.typeDistribution.judge > 0 && (
                        <Badge variant="outline" className="text-xs">判断 {exam.typeDistribution.judge}</Badge>
                      )}
                      {exam.typeDistribution.short > 0 && (
                        <Badge variant="outline" className="text-xs">简答 {exam.typeDistribution.short}</Badge>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Button size="sm" onClick={() => openStart(exam.id, false)}>
                        <Play className="mr-1 size-3.5" />
                        开始考试
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openRecords(exam)}>
                        <Users className="mr-1 size-3.5" />
                        记录
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openShare(exam)}>
                        <Share2 className="mr-1 size-3.5" />
                        {exam.sharedId ? '共享链接' : '分享'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setExportOpen(exam.id)}>
                        <Download className="mr-1 size-3.5" />
                        导出
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteConfirm(exam.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'shared' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              通过链接分享给其他人，所有人的成绩都会汇总在这里
            </p>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={loadShared} disabled={sharedLoading}>
              {sharedLoading ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 size-3" />
              )}
              刷新
            </Button>
          </div>

          {sharedError && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              {sharedError}
            </div>
          )}

          {sharedLoading && sharedExams.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                正在加载共享试卷...
              </CardContent>
            </Card>
          ) : !sharedError && sharedExams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-muted">
                  <Share2 className="size-8 text-muted-foreground" />
                </div>
                <p className="text-base font-medium text-foreground">还没有共享试卷</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  在「我的试卷」中点击「分享」生成链接
                </p>
              </CardContent>
            </Card>
          ) : (
            sharedExams.map((exam) => (
              <Card key={exam.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="min-w-0 flex-1 truncate font-medium text-foreground">{exam.name}</h3>
                    <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                      <Link2 className="size-2.5" />
                      共享
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{exam.questionCount} 题</span>
                    <span>·</span>
                    <span>{exam.totalScore} 分</span>
                    <span>·</span>
                    <span>{exam.recordCount} 人已考</span>
                    <span>·</span>
                    <span>{exam.createdBy} 共享</span>
                    <span>·</span>
                    <span>{format(exam.createdAt, 'MM-dd HH:mm', { locale: zhCN })}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {exam.typeDistribution.single > 0 && (
                      <Badge variant="outline" className="text-xs">单选 {exam.typeDistribution.single}</Badge>
                    )}
                    {exam.typeDistribution.multiple > 0 && (
                      <Badge variant="outline" className="text-xs">多选 {exam.typeDistribution.multiple}</Badge>
                    )}
                    {exam.typeDistribution.judge > 0 && (
                      <Badge variant="outline" className="text-xs">判断 {exam.typeDistribution.judge}</Badge>
                    )}
                    {exam.typeDistribution.short > 0 && (
                      <Badge variant="outline" className="text-xs">简答 {exam.typeDistribution.short}</Badge>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Button size="sm" onClick={() => openStart(exam.id, true)}>
                      <Play className="mr-1 size-3.5" />
                      开始考试
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openSharedRecords(exam)}>
                      <Users className="mr-1 size-3.5" />
                      考试记录
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyText(buildSharedExamUrl(exam.id))}
                    >
                      <Copy className="mr-1 size-3.5" />
                      复制链接
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => setDeleteSharedId(exam.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* 导出选择 */}
      <Dialog open={!!exportOpen} onOpenChange={(o) => !o && setExportOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>导出试卷</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 打印 / PDF */}
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">打印 / PDF</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => exportOpen && handleExportPrint(exportOpen, false)}
                >
                  <FileText className="mr-1.5 size-3.5" />
                  不带答案
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => exportOpen && handleExportPrint(exportOpen, true)}
                >
                  <TrendingUp className="mr-1.5 size-3.5" />
                  带答案+解析
                </Button>
              </div>
            </div>
            {/* Word */}
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">导出 Word（.docx）</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => exportOpen && handleExportWord(exportOpen, false)}
                >
                  <FileText className="mr-1.5 size-3.5" />
                  不带答案
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => exportOpen && handleExportWord(exportOpen, true)}
                >
                  <TrendingUp className="mr-1.5 size-3.5" />
                  带答案+解析
                </Button>
              </div>
            </div>
            {/* TXT */}
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">导出 TXT（纯文本）</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => exportOpen && handleExportTxt(exportOpen, false)}
                >
                  <FileText className="mr-1.5 size-3.5" />
                  不带答案
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => exportOpen && handleExportTxt(exportOpen, true)}
                >
                  <TrendingUp className="mr-1.5 size-3.5" />
                  带答案+解析
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportOpen(null)}>取消</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将无法恢复，确定要删除这张试卷吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) handleDeleteExam(deleteConfirm);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 考试记录 */}
      <ExamRecordsDialog
        open={!!recordsTarget}
        onOpenChange={(o) => !o && setRecordsTarget(null)}
        examName={recordsTarget?.name || ''}
        sharedExamId={recordsTarget?.sharedExamId}
        localRecords={recordsTarget?.localRecords || []}
      />

      {/* 开始考试：填写姓名 */}
      <Dialog open={!!startTarget} onOpenChange={(o) => !o && setStartTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>开始考试</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>你的姓名</Label>
              <Input
                placeholder="输入姓名，成绩将以此记录"
                value={startName}
                maxLength={30}
                onChange={(e) => setStartName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmStart()}
              />
              <p className="text-xs text-muted-foreground">
                {startTarget?.shared
                  ? '提交后成绩会同步到共享试卷，其他人可以看到'
                  : '成绩会保存在本机考试记录中'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStartTarget(null)}>取消</Button>
            <Button onClick={confirmStart} disabled={!startName.trim()}>
              <Play className="mr-1.5 size-4" />
              开始考试
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分享试卷 */}
      <Dialog
        open={!!shareTarget}
        onOpenChange={(o) => {
          if (!o) {
            setShareTarget(null);
            setShareUrl('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-4 text-primary" />
              共享试卷
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {shareTarget && (
              <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground">
                {shareTarget.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {shareTarget.questionIds.length} 题 · {shareTarget.totalScore} 分
                </span>
              </div>
            )}

            {shareUrl ? (
              <>
                <div className="space-y-2">
                  <Label>共享链接</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                    <Button variant="outline" size="icon" onClick={() => copyText(shareUrl)}>
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    把链接发给其他人，他们打开即可考试，成绩会汇总到「共享试卷 → 考试记录」
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 px-3 py-2 text-xs text-muted-foreground">
                  提示：共享后题目会保存到服务端，修改本地试卷不会影响已共享的版本。重新共享会生成新的链接。
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>你的姓名</Label>
                <Input
                  placeholder="输入姓名，其他人可见"
                  value={shareName}
                  maxLength={30}
                  onChange={(e) => setShareName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  共享后其他人在「共享试卷」中可以看到这张试卷及所有人的成绩
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            {shareTarget?.sharedId && (
              <Button
                variant="outline"
                className="mr-auto text-destructive"
                onClick={() => handleUnshare(shareTarget)}
              >
                <Unlink className="mr-1.5 size-4" />
                取消共享
              </Button>
            )}
            <Button variant="ghost" onClick={() => { setShareTarget(null); setShareUrl(''); }}>
              关闭
            </Button>
            {shareUrl ? (
              <Button onClick={() => window.open(shareUrl, '_blank')}>
                打开考试页
              </Button>
            ) : (
              <Button onClick={handleShare} disabled={sharing || !shareName.trim()}>
                {sharing ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Share2 className="mr-1.5 size-4" />
                )}
                生成共享链接
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除共享试卷确认 */}
      <AlertDialog open={!!deleteSharedId} onOpenChange={(o) => !o && setDeleteSharedId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除共享试卷</AlertDialogTitle>
            <AlertDialogDescription>
              将从服务器删除这张共享试卷及其所有考试记录，其他人将无法再通过链接访问。确定删除吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingShared}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteShared();
              }}
              disabled={deletingShared}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingShared ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : null}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


