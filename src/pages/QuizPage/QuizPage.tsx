import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import { ArrowLeft, ArrowRight, Grid3X3, Home, RotateCcw, BookMarked } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { useQuestionBank } from '@/hooks/useQuestionBank';
import { useWrongBook } from '@/hooks/useWrongBook';
import { useFavorites } from '@/hooks/useFavorites';
import { useQBanks } from '@/hooks/useQBanks';
import { cn } from '@/lib/utils';
import type { IQuestion, QuestionType, Difficulty } from '@/data/questions';
import { QuestionCard } from './QuestionCard';

type PracticeMode = 'sequential' | 'random' | 'wrong' | 'favorite' | 'recite';

const PROGRESS_KEY = 'quiz_bank_progress';

interface AnswerRecord {
  userAnswer: string | string[];
  isCorrect: boolean;
}

interface ProgressState {
  mode: PracticeMode;
  filters: { subject: string; chapter: string; type: string; difficulty: string; judgeFilter: string; bankIds: string };
  questionIds: string[];
  currentIndex: number;
  answers: Record<string, AnswerRecord>;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  // 简答：宽松判断
  if (question.type === 'short') {
    return true;
  }
  return false;
}

export default function QuizPage() {
  const navigate = useNavigate();
  const { mode } = useParams<{ mode: string }>();
  const [searchParams] = useSearchParams();
  const { allQuestions, getQuestionById } = useQuestionBank();
  const { getWrongIdsByBankIds, addWrong } = useWrongBook();
  const { currentBankId } = useQBanks();
  const { favorites, toggleFavorite, isFavorite, getFavoritesByBankIds } = useFavorites();

  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [savedProgress, setSavedProgress] = useState<ProgressState | null>(null);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const autoNextTimerRef = useRef<number | null>(null);

  const practiceMode = (mode as PracticeMode) || 'sequential';
  const reciteParam = searchParams.get('recite');
  const isReciteMode = practiceMode === 'recite' || reciteParam === '1';

  const filters = useMemo(() => ({
    subject: searchParams.get('subject') || 'all',
    chapter: searchParams.get('chapter') || 'all',
    type: searchParams.get('type') || 'all',
    difficulty: searchParams.get('difficulty') || 'all',
    judgeFilter: searchParams.get('judgeFilter') || 'all',
    bankIds: searchParams.get('bankIds') || currentBankId,
  }), [searchParams, currentBankId]);

  const selectedBankIds = useMemo(() => {
    const ids = filters.bankIds
      ? filters.bankIds.split(',').filter(Boolean)
      : currentBankId
        ? [currentBankId]
        : [];
    // 兜底：如果题库ID为空但有题目，直接取所有题目的 bankId（避免筛选条件不匹配导致全空）
    if (ids.length === 0 && allQuestions.length > 0) {
      return Array.from(new Set(allQuestions.map((q) => q.bankId)));
    }
    return ids;
  }, [filters.bankIds, currentBankId, allQuestions]);

  const selectedWrongIds = useMemo(
    () => getWrongIdsByBankIds(selectedBankIds),
    [getWrongIdsByBankIds, selectedBankIds],
  );

  const selectedFavIds = useMemo(
    () => getFavoritesByBankIds(selectedBankIds),
    [getFavoritesByBankIds, selectedBankIds],
  );

  // 背题模式下，进度 key 单独存
  const progressKey = useMemo(() => {
    const bankKey = selectedBankIds.join('_');
    return `${PROGRESS_KEY}_${bankKey}_${practiceMode}`;
  }, [practiceMode, selectedBankIds]);

  // 初始化题目列表：题目加载完成后执行；筛选条件/题库范围变化时重新初始化
  useEffect(() => {
    if (allQuestions.length === 0) return;

    // 已有进度且筛选条件未变化 → 显示继续做题对话框，不重置列表
    if (!loaded) {
      const stored = scopedStorage.getItem(progressKey);
      if (stored) {
        try {
          const prog = JSON.parse(stored) as ProgressState;
          if (
            prog.filters.subject === filters.subject &&
            prog.filters.chapter === filters.chapter &&
            prog.filters.type === filters.type &&
            prog.filters.difficulty === filters.difficulty &&
            prog.filters.judgeFilter === filters.judgeFilter &&
            prog.filters.bankIds === filters.bankIds
          ) {
            setQuestionIds(prog.questionIds);
            setCurrentIndex(prog.currentIndex);
            setAnswers(prog.answers);
            setSavedProgress(prog);
            setShowResumeDialog(true);
            setLoaded(true);
            return;
          }
        } catch { /* ignore */ }
      }
    }

    initQuestionList();
    setLoaded(true);
  }, [allQuestions, filters, practiceMode, progressKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const initQuestionList = useCallback(() => {
    // 从指定题库范围内筛选
    const base = allQuestions.filter((q) => selectedBankIds.includes(q.bankId));

    const filtered = base.filter((q) => {
      if (filters.subject !== 'all' && q.subject !== filters.subject) return false;
      if (filters.chapter !== 'all' && q.chapter !== filters.chapter) return false;
      if (filters.type !== 'all' && q.type !== filters.type) return false;
      if (filters.difficulty !== 'all' && String(q.difficulty) !== filters.difficulty) return false;
      // 判断题答案筛选（按题目本身答案是对/错来过滤）
      if (filters.type === 'judge' && filters.judgeFilter !== 'all') {
        if (filters.judgeFilter === 'true') {
          return q.answer === '对';
        }
        if (filters.judgeFilter === 'false') {
          return q.answer === '错';
        }
      }
      return true;
    });

    let ids: string[] = [];

    if (practiceMode === 'wrong') {
      ids = filtered.filter((q) => selectedWrongIds.includes(q.id)).map((q) => q.id);
    } else if (practiceMode === 'favorite') {
      const favSet = new Set(selectedFavIds);
      ids = filtered.filter((q) => favSet.has(q.id)).map((q) => q.id);
    } else if (practiceMode === 'random') {
      ids = shuffle(filtered.map((q) => q.id));
    } else {
      // sequential / recite
      ids = filtered.map((q) => q.id);
    }

    setQuestionIds(ids);
    setCurrentIndex(0);
    setAnswers({});
  }, [allQuestions, filters, practiceMode, selectedFavIds, selectedBankIds, selectedWrongIds]);

  const currentQuestion = useMemo(() => {
    const id = questionIds[currentIndex];
    return id ? getQuestionById(id) : null;
  }, [questionIds, currentIndex, getQuestionById]);

  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;

  // 保存进度
  useEffect(() => {
    if (loaded && questionIds.length > 0) {
      const progress: ProgressState = {
        mode: practiceMode,
        filters,
        questionIds,
        currentIndex,
        answers,
      };
      scopedStorage.setItem(progressKey, JSON.stringify(progress));
    }
  }, [loaded, questionIds, currentIndex, answers, practiceMode, filters, progressKey]);

  // 答对后 1 秒自动跳到下一题
  useEffect(() => {
    // 只在非背题模式、且当前题已答对、且不是最后一题时触发
    if (
      !isReciteMode &&
      currentAnswer &&
      currentAnswer.isCorrect &&
      currentIndex < questionIds.length - 1
    ) {
      autoNextTimerRef.current = window.setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (autoNextTimerRef.current) {
        clearTimeout(autoNextTimerRef.current);
        autoNextTimerRef.current = null;
      }
    };
  }, [currentAnswer, currentIndex, questionIds.length, isReciteMode]);

  const handleAnswer = useCallback((answer: string | string[]) => {
    if (!currentQuestion) return;
    // 背题模式不处理答案
    if (isReciteMode) return;
    const correct = checkAnswer(currentQuestion, answer);
    const record: AnswerRecord = { userAnswer: answer, isCorrect: correct };
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: record }));

    if (!correct && currentQuestion.type !== 'short') {
      addWrong(currentQuestion.id, currentQuestion.bankId);
    }
  }, [currentQuestion, addWrong, isReciteMode]);

  const handleNext = useCallback(() => {
    if (currentIndex < questionIds.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowFinishDialog(true);
    }
  }, [currentIndex, questionIds.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleJumpTo = useCallback((idx: number) => {
    setCurrentIndex(idx);
    setSheetOpen(false);
  }, []);

  const handleResume = useCallback(() => {
    if (savedProgress) {
      setQuestionIds(savedProgress.questionIds);
      setCurrentIndex(savedProgress.currentIndex);
      setAnswers(savedProgress.answers);
    }
    setShowResumeDialog(false);
  }, [savedProgress]);

  const handleRestart = useCallback(() => {
    initQuestionList();
    setShowResumeDialog(false);
  }, [initQuestionList]);

  const handleFinishRestart = useCallback(() => {
    initQuestionList();
    setShowFinishDialog(false);
  }, [initQuestionList]);

  const handleBack = useCallback(() => {
    navigate('/practice');
  }, [navigate]);

  // 统计
  const stats = useMemo(() => {
    const total = questionIds.length;
    const answered = Object.keys(answers).length;
    const correct = Object.values(answers).filter((a) => a.isCorrect).length;
    const wrong = answered - correct;
    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    return { total, answered, correct, wrong, accuracy };
  }, [questionIds, answers]);

  // 下一题按钮始终可用，允许跳过未作答题目

  if (!currentQuestion && questionIds.length === 0 && loaded) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-20 text-center">
        <div className="mb-4 text-4xl">📝</div>
        <h2 className="text-lg font-medium text-foreground">暂无符合条件的题目</h2>
        <p className="mt-1 text-sm text-muted-foreground">请调整筛选条件后重试</p>
        <Button className="mt-6" onClick={handleBack}>
          返回练习
        </Button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="p-8 text-center text-muted-foreground">加载中...</div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col min-h-[calc(100vh-3.5rem)] px-4 py-4 pb-24 md:pb-4">
      {/* 顶部返回 */}
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label="返回">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1 text-sm text-muted-foreground">
          {isReciteMode ? (
            <span className="inline-flex items-center gap-1 text-primary">
              <BookMarked className="size-3.5" />
              背题模式
            </span>
          ) : (
            <>已答 {stats.answered}/{stats.total} · 正确率 {stats.accuracy}%</>
          )}
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
              {questionIds.map((qid, idx) => {
                const ans = answers[qid];
                let cls = 'border-border bg-card text-muted-foreground hover:border-primary/50';
                if (isReciteMode) {
                  // 背题模式用 visited 风格
                  cls = idx <= currentIndex
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground';
                } else if (ans) {
                  cls = ans.isCorrect
                    ? 'border-success bg-success/10 text-success'
                    : 'border-destructive bg-destructive/10 text-destructive';
                }
                if (idx === currentIndex) {
                  cls += ' ring-2 ring-primary ring-offset-2';
                }
                return (
                  <button
                    key={qid}
                    onClick={() => handleJumpTo(idx)}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-lg border text-sm font-medium transition-all',
                      cls,
                    )}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            {!isReciteMode && (
              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="size-3 rounded bg-success/30" /> 正确
                </div>
                <div className="flex items-center gap-1">
                  <span className="size-3 rounded bg-destructive/30" /> 错误
                </div>
                <div className="flex items-center gap-1">
                  <span className="size-3 rounded border border-border" /> 未答
                </div>
              </div>
            )}
            <SheetFooter className="mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setSheetOpen(false);
                  navigate('/');
                }}
              >
                <Home className="mr-2 size-4" />
                返回首页
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* 题目卡片 */}
      <div className="flex-1">
        <QuestionCard
          question={currentQuestion}
          index={currentIndex}
          total={questionIds.length}
          userAnswer={currentAnswer?.userAnswer ?? null}
          isAnswered={isReciteMode || !!currentAnswer}
          isCorrect={isReciteMode ? true : currentAnswer?.isCorrect ?? null}
          isFavorite={isFavorite(currentQuestion.id)}
          onAnswer={handleAnswer}
           onToggleFavorite={() => toggleFavorite(currentQuestion.id, currentQuestion.bankId)}
          showAnswerImmediately={isReciteMode}
        />
      </div>

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
          <Button
            className="flex-1"
            onClick={handleNext}
          >
            {currentIndex === questionIds.length - 1 ? (
              isReciteMode ? '完成背诵' : '完成'
            ) : (
              <>
                下一题
                <ArrowRight className="ml-1 size-4" />
              </>
            )}
          </Button>
        </div>
        {!isReciteMode && currentAnswer?.isCorrect && currentIndex < questionIds.length - 1 && (
          <div className="mt-2 text-center text-xs text-success">
            回答正确，1 秒后自动进入下一题...
          </div>
        )}
      </div>

      {/* 继续上次答题确认 */}
      <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>检测到未完成的答题记录</AlertDialogTitle>
            <AlertDialogDescription>
              上次进度：第 {(savedProgress?.currentIndex ?? 0) + 1}/
                {savedProgress?.questionIds.length ?? 0} 题，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleRestart}>重新开始</AlertDialogCancel>
            <AlertDialogAction onClick={handleResume}>继续答题</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 完成对话框 */}
      <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isReciteMode ? '背诵完成 📖' : '练习完成 🎉'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isReciteMode ? '本轮背题已完成，继续加油！' : '恭喜你完成了本次练习！'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!isReciteMode && (
            <div className="grid grid-cols-3 gap-4 py-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{stats.total}</div>
                <div className="text-xs text-muted-foreground">总题数</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-success">{stats.correct}</div>
                <div className="text-xs text-muted-foreground">答对</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{stats.accuracy}%</div>
                <div className="text-xs text-muted-foreground">正确率</div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleBack}>返回练习</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinishRestart}>
              <RotateCcw className="mr-2 size-4" />
              再来一轮
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
