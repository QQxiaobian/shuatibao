import { useState, useCallback, useEffect, memo } from 'react';
import { Check, X, Lightbulb, Star, StarOff, BookOpen, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, type IQuestion } from '@/data/questions';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

interface QuestionCardProps {
  question: IQuestion;
  index: number;
  total: number;
  userAnswer: string | string[] | null;
  isAnswered: boolean;
  isCorrect: boolean | null;
  isFavorite: boolean;
  onAnswer: (answer: string | string[]) => void;
  onToggleFavorite: () => void;
  /** 是否直接显示答案（背题模式） */
  showAnswerImmediately?: boolean;
}

export const QuestionCard = memo(function QuestionCard({
  question,
  index,
  total,
  userAnswer,
  isAnswered,
  isCorrect,
  isFavorite,
  onAnswer,
  onToggleFavorite,
  showAnswerImmediately = false,
}: QuestionCardProps) {
  const [shortInput, setShortInput] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  // 切换题目时重置本地选中状态
  useEffect(() => {
    setSelectedOptions([]);
    setShortInput('');
  }, [question.id]);

  const correctAnswers = question.answer;

  const isOptionCorrect = (letter: string) => {
    if (Array.isArray(correctAnswers)) {
      return correctAnswers.includes(letter);
    }
    return correctAnswers === letter;
  };

  const isOptionSelected = (letter: string) => {
    if (isAnswered) {
      if (userAnswer === null) return false;
      if (Array.isArray(userAnswer)) {
        return userAnswer.includes(letter);
      }
      return userAnswer === letter;
    }
    // 未答题时，多选展示本地选中状态，单选展示 userAnswer
    if (question.type === 'multiple') {
      return selectedOptions.includes(letter);
    }
    if (userAnswer === null) return false;
    if (Array.isArray(userAnswer)) {
      return userAnswer.includes(letter);
    }
    return userAnswer === letter;
  };

  const handleSingleClick = (letter: string) => {
    if (isAnswered) return;
    onAnswer(letter);
  };

  const handleMultipleClick = (letter: string) => {
    if (isAnswered) return;
    setSelectedOptions((prev) =>
      prev.includes(letter)
        ? prev.filter((l) => l !== letter)
        : [...prev, letter].sort(),
    );
  };

  const handleMultipleSubmit = () => {
    if (isAnswered || selectedOptions.length === 0) return;
    onAnswer([...selectedOptions]);
  };

  const handleJudgeClick = (val: string) => {
    if (isAnswered) return;
    onAnswer(val);
  };

  const handleShortSubmit = () => {
    if (isAnswered || !shortInput.trim()) return;
    onAnswer(shortInput.trim());
  };

  const getOptionClass = (letter: string) => {
    const selected = isOptionSelected(letter);
    const correct = isOptionCorrect(letter);

    if (!isAnswered) {
      return selected
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50';
    }

    // 已答题
    if (correct) {
      return 'border-success bg-success/10 text-success';
    }
    if (selected && !correct) {
      return 'border-destructive bg-destructive/10 text-destructive';
    }
    return 'border-border bg-card opacity-60';
  };

  return (
    <div className="space-y-4">
      {/* 顶部信息栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            第 {index + 1}/{total} 题
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {QUESTION_TYPE_LABELS[question.type]}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {DIFFICULTY_LABELS[question.difficulty]}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? '取消收藏' : '收藏'}
        >
          {isFavorite ? (
            <Star className="size-5 fill-warning text-warning" />
          ) : (
            <StarOff className="size-5 text-muted-foreground" />
          )}
        </Button>
      </div>

      {/* 进度条 */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {/* 题干 */}
      <div className="pt-2">
        <h2 className="text-base font-medium leading-relaxed text-foreground md:text-lg">
          {question.question}
        </h2>
        <div className="mt-1 text-xs text-muted-foreground">
          {question.subject} · {question.chapter}
        </div>
      </div>

      {/* 选项区 */}
      <div className="space-y-3 pt-2">
        {/* 单选 / 多选 */}
        {(question.type === 'single' || question.type === 'multiple') &&
          question.options.length === 0 && (
            <div className="rounded-xl border border-dashed border-warning/50 bg-warning/5 p-4 text-center text-sm text-warning-foreground">
              <AlertCircle className="mx-auto mb-2 size-5" />
              <p>该题目选项数据缺失，暂时无法作答</p>
              <p className="mt-1 text-xs text-muted-foreground">请联系题库管理员补充选项内容</p>
            </div>
          )}
        {(question.type === 'single' || question.type === 'multiple') &&
          question.options.length > 0 &&
          question.options.map((opt, idx) => {
            const letter = LETTERS[idx];
            const selected = isOptionSelected(letter);
            const correct = isOptionCorrect(letter);
            return (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  question.type === 'single'
                    ? handleSingleClick(letter)
                    : handleMultipleClick(letter)
                }
                disabled={isAnswered}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all',
                  getOptionClass(letter)
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium',
                    selected || (isAnswered && correct)
                      ? 'bg-current text-background'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {isAnswered && correct ? (
                    <Check className="size-4" />
                  ) : isAnswered && selected && !correct ? (
                    <X className="size-4" />
                  ) : (
                    letter
                  )}
                </span>
                <span className="flex-1 text-sm leading-relaxed md:text-base">{opt}</span>
              </button>
            );
          })}

        {/* 多选提交按钮 */}
        {question.type === 'multiple' && !isAnswered && (
          <Button
            className="w-full"
            onClick={handleMultipleSubmit}
            disabled={selectedOptions.length === 0}
          >
            确认答案
          </Button>
        )}

        {/* 判断 */}
        {question.type === 'judge' && (
          <div className="grid grid-cols-2 gap-3">
            {['对', '错'].map((val) => {
              const selected = userAnswer === val;
              const correct = correctAnswers === val;
              let cls = 'border-border bg-card hover:border-primary/50 hover:bg-muted/50';
              if (isAnswered) {
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
                  onClick={() => handleJudgeClick(val)}
                  disabled={isAnswered}
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

        {/* 简答 */}
        {question.type === 'short' && (
          <div className="space-y-3">
            <Textarea
              rows={4}
              placeholder="请输入你的答案..."
              value={shortInput}
              onChange={(e) => setShortInput(e.target.value)}
              disabled={isAnswered}
            />
            {!isAnswered && (
              <Button className="w-full" onClick={handleShortSubmit} disabled={!shortInput.trim()}>
                提交答案
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 答题结果 */}
      {isAnswered && (
        <Card className={cn(
          'border-2',
          isCorrect ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
        )}>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              {showAnswerImmediately ? (
                <>
                  <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <BookOpen className="size-4" />
                  </div>
                  <span className="font-medium text-primary">答案与解析</span>
                </>
              ) : isCorrect ? (
                <>
                  <div className="flex size-7 items-center justify-center rounded-full bg-success text-success-foreground">
                    <Check className="size-4" />
                  </div>
                  <span className="font-medium text-success">回答正确</span>
                </>
              ) : (
                <>
                  <div className="flex size-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                    <X className="size-4" />
                  </div>
                  <span className="font-medium text-destructive">回答错误</span>
                  {question.type !== 'short' && (
                    <span className="ml-auto text-sm text-muted-foreground">
                      正确答案：
                      <span className="font-medium text-foreground">
                        {Array.isArray(correctAnswers) ? correctAnswers.join('、') : correctAnswers}
                      </span>
                    </span>
                  )}
                </>
              )}
            </div>

            {question.type === 'short' && (
              <div className="mb-3">
                <div className="mb-1 text-xs text-muted-foreground">参考答案</div>
                <div className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                  {correctAnswers as string}
                </div>
              </div>
            )}

            {question.analysis && (
              <div className="border-t border-border/50 pt-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Lightbulb className="size-3.5" />
                  答案解析
                </div>
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                  {question.analysis}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
});
