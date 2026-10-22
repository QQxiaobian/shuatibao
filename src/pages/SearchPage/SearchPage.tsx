import { useState, useEffect, useMemo, useCallback } from 'react';
import { scopedStorage, logger } from '@lark-apaas/client-toolkit-lite';
import { Search, X, Clock, Trash2, BookOpen, AlertCircle, Database } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuestionBank } from '@/hooks/useQuestionBank';
import { useQBanks } from '@/hooks/useQBanks';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, type IQuestion, type Difficulty } from '@/data/questions';

const HISTORY_KEY = 'quiz_bank_search_history';
const MAX_HISTORY = 10;

function highlightText(text: string, keyword: string): React.ReactNode {
  if (!keyword.trim()) return text;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-warning/30 px-0.5 text-foreground">
        {text.slice(idx, idx + keyword.length)}
      </mark>
      {text.slice(idx + keyword.length)}
    </>
  );
}

export default function SearchPage() {
  const { questions, allQuestions } = useQuestionBank();
  const { currentBankId, banks, getBankById } = useQBanks();
  const [keyword, setKeyword] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [searchAll, setSearchAll] = useState(false);

  // 搜索数据源：全部题库 / 当前题库
  const searchPool = searchAll ? allQuestions : questions;

  // 题库名称查找
  const getBankName = useCallback((bankId: string): string => {
    const b = getBankById?.(bankId);
    return b?.name || '未知题库';
  }, [getBankById]);

  // 加载搜索历史（按题库隔离，搜全部时用 'all' 做key）
  useEffect(() => {
    const scopeKey = searchAll ? 'all' : currentBankId;
    const stored = scopedStorage.getItem(`${HISTORY_KEY}_${scopeKey}`);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        setHistory([]);
      }
    } else {
      setHistory([]);
    }
  }, [currentBankId, searchAll]);

  // 保存搜索历史
  const saveHistory = useCallback((kw: string) => {
    if (!kw.trim()) return;
    const scopeKey = searchAll ? 'all' : currentBankId;
    setHistory((prev) => {
      const filtered = prev.filter((h) => h !== kw);
      const next = [kw, ...filtered].slice(0, MAX_HISTORY);
      scopedStorage.setItem(`${HISTORY_KEY}_${scopeKey}`, JSON.stringify(next));
      return next;
    });
  }, [currentBankId, searchAll]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    const scopeKey = searchAll ? 'all' : currentBankId;
    scopedStorage.removeItem(`${HISTORY_KEY}_${scopeKey}`);
  }, [currentBankId, searchAll]);

  const removeHistoryItem = useCallback((item: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== item);
      const scopeKey = searchAll ? 'all' : currentBankId;
      scopedStorage.setItem(`${HISTORY_KEY}_${scopeKey}`, JSON.stringify(next));
      return next;
    });
  }, [currentBankId, searchAll]);

  const handleSearch = useCallback((kw: string) => {
    setKeyword(kw);
    saveHistory(kw);
    setIsFocused(false);
  }, [saveHistory]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && keyword.trim()) {
      handleSearch(keyword.trim());
    }
  }, [keyword, handleSearch]);

  const handleClear = useCallback(() => {
    setKeyword('');
  }, []);

  // 搜索结果
  const results = useMemo(() => {
    if (!keyword.trim()) return [];
    const kw = keyword.toLowerCase();
    const matched = searchPool.filter(
      (q) =>
        q.question.toLowerCase().includes(kw) ||
        q.analysis.toLowerCase().includes(kw)
    );
    // 题干匹配优先于解析匹配
    return matched.sort((a, b) => {
      const aInQ = a.question.toLowerCase().includes(kw);
      const bInQ = b.question.toLowerCase().includes(kw);
      if (aInQ && !bInQ) return -1;
      if (!aInQ && bInQ) return 1;
      return 0;
    });
  }, [searchPool, keyword]);

  const showHistory = isFocused && !keyword.trim() && history.length > 0;
  const showEmptyNoKeyword = !keyword.trim() && !showHistory;
  const showEmptyWithKeyword = keyword.trim() && results.length === 0;

  const formatAnswer = (q: IQuestion): string => {
    if (q.type === 'judge') {
      return q.answer === '对' || q.answer === '正确' || q.answer === 'true' || q.answer === 'T' ? '正确（对）' : '错误（错）';
    }
    if (Array.isArray(q.answer)) {
      return q.answer.join('、');
    }
    return String(q.answer);
  };

  const typeBadgeVariant = (t: IQuestion['type']) => {
    switch (t) {
      case 'single': return 'default';
      case 'multiple': return 'secondary';
      case 'judge': return 'outline';
      case 'short': return 'destructive';
    }
  };

  const difficultyBadgeVariant = (d: Difficulty) => {
    if (d === 1) return 'secondary';
    if (d === 2) return 'default';
    return 'destructive';
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 md:py-8">
      <div className="mb-6">
        <h1 className="mb-4 text-xl font-bold text-foreground md:text-2xl">搜题</h1>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            placeholder="搜索题干或解析关键词..."
            className="h-11 pl-9 pr-20"
            autoComplete="off"
          />
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {keyword && (
              <Button variant="ghost" size="icon" onClick={handleClear} className="h-8 w-8">
                <X className="size-4" />
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => keyword.trim() && handleSearch(keyword.trim())}
              disabled={!keyword.trim()}
              className="h-8"
            >
              搜索
            </Button>
          </div>
        </div>
          {/* 搜索范围切换 */}
          <div className="mt-3 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={searchAll}
                onCheckedChange={(v) => setSearchAll(!!v)}
                className="size-4"
              />
              <span>搜索全部题库</span>
            </label>
            <span className="text-xs text-muted-foreground">
              <Database className="mr-1 inline size-3 align-middle" />
              {searchAll ? `共 ${banks.length} 个题库` : `当前题库 · ${getBankById?.(currentBankId)?.name || ''}`}
            </span>
          </div>
        </div>
      {showHistory && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="size-4 text-muted-foreground" />
                搜索历史
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="h-7 text-xs text-muted-foreground"
              >
                <Trash2 className="mr-1 size-3" />
                清空
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((h) => (
                <div
                  key={h}
                  className="group flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm hover:bg-muted/80"
                >
                  <button
                    onClick={() => handleSearch(h)}
                    className="text-foreground/80 hover:text-foreground"
                  >
                    {h}
                  </button>
                  <button
                    onClick={() => removeHistoryItem(h)}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    aria-label="删除"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 搜索结果 */}
      {showEmptyNoKeyword && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-muted">
              <Search className="size-8 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-foreground">输入关键词搜索题目</p>
            <p className="mt-1 text-sm text-muted-foreground">
              支持搜索题干和答案解析
            </p>
          </CardContent>
        </Card>
      )}

      {showEmptyWithKeyword && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="size-8 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-foreground">没有找到相关题目</p>
            <p className="mt-1 text-sm text-muted-foreground">
              试试其他关键词，或者导入更多题目
            </p>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            找到 <span className="font-medium text-foreground">{results.length}</span> 道相关题目
          </div>
          {results.map((q) => (
            <Card
              key={q.id}
              className="transition-colors"
            >
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant={typeBadgeVariant(q.type) as any} className="text-xs">
                    {QUESTION_TYPE_LABELS[q.type]}
                  </Badge>
                  <Badge variant={difficultyBadgeVariant(q.difficulty) as any} className="text-xs">
                    {DIFFICULTY_LABELS[q.difficulty]}
                  </Badge>
                </div>

                {/* 题干 */}
                <p className="text-sm font-medium leading-relaxed text-foreground mb-3">
                  {highlightText(q.question, keyword)}
                </p>

                {/* 选项 */}
                {q.options && q.options.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {q.options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const answerArr = Array.isArray(q.answer) ? q.answer : [String(q.answer)];
                      const isCorrect = answerArr.includes(letter) || answerArr.includes(letter.toLowerCase());
                      const isJudgeWrong = q.type === 'judge' && ((q.answer === '对' && i === 1) || (q.answer === '错' && i === 0));
                      const showCorrect = q.type !== 'judge' ? isCorrect : (i === 0 ? (q.answer === '对' || q.answer === '正确') : (q.answer === '错' || q.answer === '错误'));
                      return (
                        <div
                          key={i}
                          className={
                            'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ' +
                            (showCorrect
                              ? 'border-primary/40 bg-primary/10 text-foreground'
                              : 'border-border bg-card text-foreground/80')
                          }
                        >
                          <span
                            className={
                              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ' +
                              (showCorrect
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground')
                            }
                          >
                            {q.type === 'judge' ? (i === 0 ? '✓' : '✗') : letter}
                          </span>
                          <span className="flex-1 leading-relaxed">
                            {opt || (q.type === 'judge' ? (i === 0 ? '正确' : '错误') : '')}
                          </span>
                          {showCorrect && (
                            <span className="shrink-0 text-xs font-medium text-primary">正确答案</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 判断题特殊处理 */}
                {q.type === 'judge' && (!q.options || q.options.length === 0) && (
                  <div className="mb-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground">
                    <span className="font-medium text-primary">正确答案：</span>
                    {q.answer === '对' || q.answer === '正确' ? '正确 ✓' : '错误 ✗'}
                  </div>
                )}

                {/* 简答题答案 */}
                {q.type === 'short' && (
                  <div className="mb-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm leading-relaxed text-foreground">
                    <div className="mb-1 font-medium text-primary">参考答案：</div>
                    <div className="whitespace-pre-line">{String(q.answer)}</div>
                  </div>
                )}

                {/* 答案摘要 */}
                {q.type !== 'judge' && q.type !== 'short' && (
                  <div className="mb-2 text-xs text-muted-foreground">
                    <span className="font-medium text-primary">正确答案：</span>
                    {formatAnswer(q)}
                  </div>
                )}

                {/* 解析 */}
                {q.analysis && q.analysis.trim() && (
                  <div className="rounded-md bg-muted/60 p-3">
                    <div className="mb-1 text-xs font-medium text-muted-foreground">答案解析</div>
                    <p className="text-xs leading-relaxed text-foreground/80">
                      {highlightText(q.analysis, keyword)}
                    </p>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {searchAll && (
                    <Badge variant="outline" className="text-xs font-normal">
                      <Database className="mr-1 size-3" />
                      {getBankName(q.bankId)}
                    </Badge>
                  )}
                  {!searchAll && (
                    <>
                      <BookOpen className="size-3" />
                      {q.subject} · {q.chapter}
                    </>
                  )}
                  {searchAll && q.subject && (
                    <span className="ml-auto">{q.subject} · {q.chapter}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
