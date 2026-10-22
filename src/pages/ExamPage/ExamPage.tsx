import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, Play, Download, TrendingUp } from 'lucide-react';
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
import { useQuestionBank } from '@/hooks/useQuestionBank';
import { useExams } from '@/hooks/useExams';
import { QUESTION_TYPE_LABELS, type IExam, type IQuestion, type QuestionType, type Difficulty } from '@/data/questions';
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

  const { exams, createExam, deleteExam } = useExams();
  const { getQuestionById } = useQuestionBank();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground md:text-2xl">试卷中心</h1>
          <p className="mt-1 text-sm text-muted-foreground">智能组卷，支持导出打印</p>
        </div>
        <ExamCreateDialog onCreate={createExam} />
      </div>

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
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground">{exam.name}</h3>
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
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button size="sm" onClick={() => navigate(`/exam/${exam.id}`)}>
                      <Play className="mr-1 size-3.5" />
                      开始考试
                    </Button>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExportOpen(exam.id)}
                      >
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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
                if (deleteConfirm) {
                  deleteExam(deleteConfirm);
                  toast.success('删除成功');
                }
                setDeleteConfirm(null);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


