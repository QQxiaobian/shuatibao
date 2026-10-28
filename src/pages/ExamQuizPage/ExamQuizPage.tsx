import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Grid3X3, Clock, Check, X, Trophy, RotateCcw, Home, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useExams } from '@/hooks/useExams';
import { useQuestionBank } from '@/hooks/useQuestionBank';
import { useWrongBook } from '@/hooks/useWrongBook';
import { cn } from '@/lib/utils';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, type IQuestion, type QuestionType } from '@/data/questions';
import {
  ApiUnavailableError,
  createExamRecord,
  getSharedExam,
  type ISharedExam,
} from '@/lib/examApi';
import { getParticipantName, setParticipantName } from '@/lib/participant';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

function checkAnswer(question: IQuestion, userAnswer: string | string[]): boolean {
  const correct = question.answer;
  if (question.type === 'single' || question.type === 'judge') {
    return userAnswer === correct;
  }
  if (question.type === 'multiple') {
    const ua = Array.isArray(userAnswer) ? [...userAnswer].sort() : [userAnswer];
    const ca = Array.isArray(correct) ? [...correct].sort() : [correct];
    if (ua.length !== ca.length) return false;
    return ua.every((v, i) => v === ca[i]);
  }
  if (question.type === 'short') {
    return false; // 简答题不自动判分，按错处理或由老师判
  }
  return false;
}

export default function ExamQuizPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { getExamById, addRecord } = useExams();
  const { getQuestionById } = useQuestionBank();
  const { addWrong } = useWrongBook();

  /** /exam/shared/:id 为共享试卷，题目来自服务端快照 */
  const isShared = location.pathname.startsWith('/exam/shared/');
  const [sharedExam, setSharedExam] = useState<ISharedExam | null>(null);
  const [sharedLoading, setSharedLoading] = useState(isShared);
  const [sharedError, setSharedError] = useState('');

  useEffect(() => {
    if (!isShared || !id) return;
    let cancelled = false;
    setSharedLoading(true);
    setSharedError('');
    getSharedExam(id)
      .then((data) => {
        if (!cancelled) setSharedExam(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setSharedError(
          err instanceof ApiUnavailableError
            ? '共享服务未连接，无法加载这张共享试卷'
            : (err as Error).message,
        );
      })
      .finally(() => {
        if (!cancelled) setSharedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isShared]);

  const localExam = !isShared && id ? getExamById(id) : null;
  const exam = isShared ? sharedExam : localExam;

  const questions = useMemo(() => {
    if (!exam) return [];
    if (isShared) return (exam as ISharedExam).questions || [];
    return ((exam as NonNullable<typeof localExam>).questionIds
      .map((qid) => getQuestionById(qid))
      .filter(Boolean)) as IQuestion[];
  }, [exam, isShared, getQuestionById]);

  const perQuestionScores = exam?.perQuestionScores;

  const getPoints = useCallback(
    (type: QuestionType) => {
      const configured = perQuestionScores?.[type];
      if (typeof configured === 'number') return configured;
      return type === 'single' ? 2 : type === 'multiple' ? 4 : type === 'judge' ? 2 : 10;
    },
    [perQuestionScores],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [shortInput, setShortInput] = useState('');
  const [participant, setParticipant] = useState(getParticipantName());
  const [nameOpen, setNameOpen] = useState(false);
  const [nameInput, setNameInput] = useState(getParticipantName());
  const [uploading, setUploading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 通过链接直接进入共享试卷时，先确认姓名，成绩才能记到对应的人
  useEffect(() => {
    if (isShared && sharedExam && !participant) {
      setNameInput('');
      setNameOpen(true);
    }
  }, [isShared, sharedExam, participant]);

  const confirmName = () => {
    const name = setParticipantName(nameInput);
    if (!name) {
      toast.error('请输入你的姓名');
      return;
    }
    setParticipant(name);
    setNameOpen(false);
  };

  // 计时器
  useEffect(() => {
    if (!submitted && questions.length > 0) {
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [submitted, questions.length]);

  const currentQuestion = questions[currentIndex];

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSingleAnswer = useCallback((letter: string) => {
    if (!currentQuestion || submitted) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: letter }));
  }, [currentQuestion, submitted]);

  const handleMultipleToggle = useCallback((letter: string) => {
    if (!currentQuestion || submitted) return;
    setAnswers((prev) => {
      const current = (prev[currentQuestion.id] as string[]) || [];
      const newArr = current.includes(letter)
        ? current.filter((l) => l !== letter)
        : [...current, letter].sort();
      return { ...prev, [currentQuestion.id]: newArr };
    });
  }, [currentQuestion, submitted]);

  const handleJudgeAnswer = useCallback((val: string) => {
    if (!currentQuestion || submitted) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: val }));
  }, [currentQuestion, submitted]);

  const handleShortSubmit = useCallback(() => {
    if (!currentQuestion || submitted || !shortInput.trim()) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: shortInput.trim() }));
  }, [currentQuestion, submitted, shortInput]);

  // 切换题目时重置简答输入
  useEffect(() => {
    if (currentQuestion?.type === 'short' && answers[currentQuestion.id]) {
      setShortInput(answers[currentQuestion.id] as string);
    } else {
      setShortInput('');
    }
  }, [currentIndex, currentQuestion, answers]);

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleJumpTo = (idx: number) => {
    setCurrentIndex(idx);
    setSheetOpen(false);
  };

  const answeredCount = Object.keys(answers).length;

  const handleSubmit = () => {
    if (submitted) return;
    if (timerRef.current) clearInterval(timerRef.current);

    let correctCount = 0;
    const typeCorrect: Record<string, number> = { single: 0, multiple: 0, judge: 0, short: 0 };
    const typeTotal: Record<string, number> = { single: 0, multiple: 0, judge: 0, short: 0 };

    questions.forEach((q) => {
      typeTotal[q.type]++;
      const userAns = answers[q.id];
      if (userAns !== undefined) {
        const correct = checkAnswer(q, userAns);
        if (correct) {
          correctCount++;
          typeCorrect[q.type]++;
        } else if (q.type !== 'short') {
          addWrong(q.id, q.bankId);
        }
      }
    });

    // 计算得分（每题分值按类型，优先使用试卷配置）
    let score = 0;
    let totalScore = 0;
    questions.forEach((q) => {
      const pts = getPoints(q.type);
      totalScore += pts;
      const userAns = answers[q.id];
      if (userAns !== undefined && checkAnswer(q, userAns)) {
        score += pts;
      }
    });

    const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const recordParticipant = participant || (isShared ? '匿名' : '我');

    // 保存本机记录（共享试卷也留一份，便于离线查看）
    addRecord({
      examId: isShared ? id! : exam!.id,
      examName: exam!.name,
      participant: recordParticipant,
      sharedExamId: isShared ? id : undefined,
      userAnswers: answers,
      score,
      totalScore,
      accuracy,
      duration,
    });

    // 共享试卷：成绩上传到服务端，其他人可查看
    if (isShared && id) {
      setUploading(true);
      createExamRecord({
        sharedExamId: id,
        examName: exam!.name,
        participant: recordParticipant,
        userAnswers: answers,
        score,
        totalScore,
        accuracy,
        duration,
      })
        .then(() => toast.success('成绩已同步到共享试卷'))
        .catch((err) => {
          toast.error(
            err instanceof ApiUnavailableError
              ? '共享服务未连接，成绩仅保存在本机'
              : `成绩同步失败：${(err as Error).message}`,
          );
        })
        .finally(() => setUploading(false));
    }

    setSubmitted(true);
    setShowSubmitConfirm(false);
    toast.success('交卷成功');
  };

  const isOptionSelected = (letter: string) => {
    if (!currentQuestion) return false;
    const ans = answers[currentQuestion.id];
    if (ans === undefined) return false;
    if (Array.isArray(ans)) return ans.includes(letter);
    return ans === letter;
  };

  const isOptionCorrect = (letter: string) => {
    if (!currentQuestion) return false;
    const correct = currentQuestion.answer;
    if (Array.isArray(correct)) return correct.includes(letter);
    return correct === letter;
  };

  const getOptionClass = (letter: string) => {
    const selected = isOptionSelected(letter);
    const correct = isOptionCorrect(letter);

    if (!submitted) {
      return selected
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50';
    }

    if (correct) {
      return 'border-success bg-success/10 text-success';
    }
    if (selected && !correct) {
      return 'border-destructive bg-destructive/10 text-destructive';
    }
    return 'border-border bg-card opacity-60';
  };

  // 成绩统计
  const stats = useMemo(() => {
    if (!submitted) return null;
    let correct = 0;
    const typeStats: Record<string, { correct: number; total: number }> = {
      single: { correct: 0, total: 0 },
      multiple: { correct: 0, total: 0 },
      judge: { correct: 0, total: 0 },
      short: { correct: 0, total: 0 },
    };
    let score = 0;
    let totalScore = 0;

    questions.forEach((q) => {
      typeStats[q.type].total++;
      const pts = getPoints(q.type);
      totalScore += pts;
      const userAns = answers[q.id];
      if (userAns !== undefined && checkAnswer(q, userAns)) {
        correct++;
        typeStats[q.type].correct++;
        score += pts;
      }
    });

    return {
      total: questions.length,
      correct,
      wrong: questions.length - correct,
      accuracy: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0,
      score,
      totalScore,
      typeStats,
    };
  }, [submitted, questions, answers, getPoints]);

  if (isShared && sharedLoading) {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center gap-2 px-4 py-20 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        正在加载共享试卷...
      </div>
    );
  }

  if (isShared && sharedError) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-muted-foreground">{sharedError}</p>
        <Button className="mt-4" onClick={() => navigate('/exam')}>
          返回试卷中心
        </Button>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-muted-foreground">试卷不存在</p>
        <Button className="mt-4" onClick={() => navigate('/exam')}>
          返回试卷中心
        </Button>
      </div>
    );
  }

  // 提交后展示成绩
  if (submitted && stats) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-4 pb-20 md:py-8">
        <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/5 to-background">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-warning/10 text-warning">
                <Trophy className="size-8" />
              </div>
              <h2 className="text-xl font-bold text-foreground">考试完成</h2>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-5xl font-black text-primary tabular-nums">{stats.score}</span>
                <span className="mb-1 text-lg text-muted-foreground">/ {stats.totalScore} 分</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                正确率 {stats.accuracy}% · 用时 {formatTime(duration)}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="size-3.5" />
                答题人：{participant || (isShared ? '匿名' : '我')}
                {isShared && (
                  <>
                    <span>·</span>
                    {uploading ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" />
                        成绩同步中...
                      </span>
                    ) : (
                      <span className="text-primary">共享试卷</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">答题统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                <div className="text-xs text-muted-foreground">总题数</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-success">{stats.correct}</div>
                <div className="text-xs text-muted-foreground">答对</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-destructive">{stats.wrong}</div>
                <div className="text-xs text-muted-foreground">答错/未答</div>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
              {(['single', 'multiple', 'judge', 'short'] as const).map((t) => {
                const ts = stats.typeStats[t];
                if (ts.total === 0) return null;
                const acc = ts.total > 0 ? Math.round((ts.correct / ts.total) * 100) : 0;
                return (
                  <div key={t} className="flex items-center gap-3">
                    <span className="w-16 text-sm text-muted-foreground">{QUESTION_TYPE_LABELS[t]}</span>
                    <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${acc}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                      {ts.correct}/{ts.total} · {acc}%
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">答错的题目</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {questions
              .filter((q) => {
                const ans = answers[q.id];
                return ans === undefined || !checkAnswer(q, ans);
              })
              .map((q, idx) => {
                const ans = answers[q.id];
                const correct = ans !== undefined && checkAnswer(q, ans);
                return (
                  <div key={q.id} className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{idx + 1}</Badge>
                      <Badge variant="secondary" className="text-xs">
                        {QUESTION_TYPE_LABELS[q.type]}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">{q.question}</p>
                    <div className="mt-1 text-xs text-muted-foreground">
                      正确答案：
                      <span className="text-success">
                        {Array.isArray(q.answer) ? q.answer.join('、') : q.answer}
                      </span>
                      {!ans && <span className="ml-2 text-destructive">（未作答）</span>}
                    </div>
                  </div>
                );
              })}
            {stats.wrong === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                全部答对了，太棒了！🎉
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/exam')}>
            <Home className="mr-2 size-4" />
            返回试卷中心
          </Button>
          {isShared && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/exam?tab=shared')}
            >
              <Users className="mr-2 size-4" />
              查看所有人成绩
            </Button>
          )}
          <Button className="flex-1" onClick={() => { setSubmitted(false); setAnswers({}); setCurrentIndex(0); setDuration(0); }}>
            <RotateCcw className="mr-2 size-4" />
            重新答题
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col min-h-[calc(100vh-3.5rem)] px-4 py-4 pb-24 md:pb-4">
      {/* 顶部栏 */}
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/exam')} aria-label="返回">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{exam.name}</div>
          <div className="text-xs text-muted-foreground">
            已答 {answeredCount}/{questions.length} 题
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm font-medium text-foreground">
          <Clock className="size-4 text-muted-foreground" />
          {formatTime(duration)}
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Grid3X3 className="mr-1.5 size-4" />
              答题卡
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-center">答题卡</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-6 gap-2 md:grid-cols-8">
              {questions.map((q, idx) => {
                const answered = answers[q.id] !== undefined;
                const cls = answered
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground';
                const activeCls = idx === currentIndex ? ' ring-2 ring-primary ring-offset-2' : '';
                return (
                  <button
                    key={q.id}
                    onClick={() => handleJumpTo(idx)}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-lg border text-sm font-medium transition-all hover:border-primary/50',
                      cls + activeCls
                    )}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="size-3 rounded bg-primary/30" /> 已答
              </div>
              <div className="flex items-center gap-1">
                <span className="size-3 rounded border border-border" /> 未答
              </div>
            </div>
            <SheetFooter className="mt-6">
              <Button variant="outline" onClick={() => setShowSubmitConfirm(true)}>
                交卷
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* 进度条 */}
      <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {currentQuestion && (
        <div className="flex-1 space-y-4">
          {/* 题型标签 */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              第 {currentIndex + 1}/{questions.length} 题
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {QUESTION_TYPE_LABELS[currentQuestion.type]}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {DIFFICULTY_LABELS[currentQuestion.difficulty]}
            </Badge>
          </div>

          {/* 题干 */}
          <h2 className="text-base font-medium leading-relaxed text-foreground md:text-lg">
            {currentQuestion.question}
          </h2>

          {/* 选项 */}
          <div className="space-y-3 pt-2">
            {(currentQuestion.type === 'single' || currentQuestion.type === 'multiple') &&
              currentQuestion.options.map((opt, idx) => {
                const letter = LETTERS[idx];
                const selected = isOptionSelected(letter);
                const correct = isOptionCorrect(letter);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      currentQuestion.type === 'single'
                        ? handleSingleAnswer(letter)
                        : handleMultipleToggle(letter)
                    }
                    disabled={submitted}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all',
                      getOptionClass(letter)
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium',
                        selected || (submitted && correct)
                          ? 'bg-current text-background'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {submitted && correct ? (
                        <Check className="size-4" />
                      ) : submitted && selected && !correct ? (
                        <X className="size-4" />
                      ) : (
                        letter
                      )}
                    </span>
                    <span className="flex-1 text-sm leading-relaxed md:text-base">{opt}</span>
                  </button>
                );
              })}

            {currentQuestion.type === 'multiple' && !submitted && (
              <p className="text-xs text-muted-foreground">（多选题，请选择所有正确答案）</p>
            )}

            {currentQuestion.type === 'judge' && (
              <div className="grid grid-cols-2 gap-3">
                {['对', '错'].map((val) => {
                  const selected = answers[currentQuestion.id] === val;
                  const correct = currentQuestion.answer === val;
                  let cls = 'border-border bg-card hover:border-primary/50 hover:bg-muted/50';
                  if (submitted) {
                    if (correct) cls = 'border-success bg-success/10 text-success';
                    else if (selected && !correct) cls = 'border-destructive bg-destructive/10 text-destructive';
                    else cls = 'border-border bg-card opacity-60';
                  } else if (selected) {
                    cls = 'border-primary bg-primary/10 text-primary';
                  }
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleJudgeAnswer(val)}
                      disabled={submitted}
                      className={cn(
                        'flex flex-col items-center justify-center gap-2 rounded-xl border-2 py-6 transition-all',
                        cls
                      )}
                    >
                      <span className="text-2xl">{val === '对' ? '✓' : '✗'}</span>
                      <span className="text-sm font-medium">{val === '对' ? '正确' : '错误'}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'short' && (
              <div className="space-y-3">
                <Textarea
                  rows={4}
                  placeholder="请输入你的答案..."
                  value={shortInput}
                  onChange={(e) => setShortInput(e.target.value)}
                  disabled={submitted}
                />
                {!submitted && (
                  <Button
                    className="w-full"
                    onClick={handleShortSubmit}
                    disabled={!shortInput.trim()}
                  >
                    提交答案
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 答题后解析 */}
          {submitted && currentQuestion.analysis && (
            <Card className="border-2 border-success/30 bg-success/5">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-success">
                  <Check className="size-4" />
                  正确答案：
                  {Array.isArray(currentQuestion.answer)
                    ? currentQuestion.answer.join('、')
                    : currentQuestion.answer}
                </div>
                <div className="border-t border-success/20 pt-2">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">答案解析</div>
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                    {currentQuestion.analysis}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 底部操作栏 */}
      <div className="sticky bottom-20 z-10 -mx-4 mt-6 border-t border-border/50 bg-background/95 backdrop-blur-md px-4 py-3 md:static md:bottom-auto md:mx-0 md:mt-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-0">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="mr-1 size-4" />
            上一题
          </Button>
          {currentIndex === questions.length - 1 ? (
            <Button className="flex-1" onClick={() => setShowSubmitConfirm(true)}>
              交卷
            </Button>
          ) : (
            <Button className="flex-1" onClick={handleNext}>
              下一题
              <ArrowRight className="ml-1 size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 交卷确认 */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认交卷</AlertDialogTitle>
            <AlertDialogDescription>
              已作答 {answeredCount}/{questions.length} 题，还有 {questions.length - answeredCount} 题未答。确定要交卷吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续答题</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>确认交卷</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 共享试卷：进入前填写姓名 */}
      <Dialog open={nameOpen} onOpenChange={setNameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>留下你的姓名</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>姓名</Label>
            <Input
              placeholder="输入姓名，成绩将显示在共享记录中"
              value={nameInput}
              maxLength={30}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmName()}
            />
            <p className="text-xs text-muted-foreground">
              这张试卷由 {sharedExam?.createdBy} 共享，共 {sharedExam?.questionCount} 题
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => navigate('/exam?tab=shared')}>
              暂不答题
            </Button>
            <Button onClick={confirmName} disabled={!nameInput.trim()}>
              开始答题
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
