import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Shuffle,
  XCircle,
  Star,
  ChevronRight,
  Filter,
  BookMarked,
  Check,
  ChevronDown,
  Eye,
} from 'lucide-react';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useQuestionBank } from '@/hooks/useQuestionBank';
import { useQBanks } from '@/hooks/useQBanks';
import { useWrongBook } from '@/hooks/useWrongBook';
import { useFavorites } from '@/hooks/useFavorites';
import { QUESTION_TYPE_LABELS, type QuestionType, type Difficulty } from '@/data/questions';

type PracticeMode = 'sequential' | 'random' | 'wrong' | 'favorite' | 'recite';
type JudgeFilter = 'all' | 'true' | 'false';

/** 背题模式偏好：是否只显示正确选项 */
const RECITE_ONLY_CORRECT_KEY = 'quiz_bank_recite_only_correct';

interface ModeCardProps {
  mode: PracticeMode;
  label: string;
  description: string;
  icon: React.ElementType;
  count: number;
  active: boolean;
  onClick: () => void;
  accent: string;
}

function ModeCard({
  label,
  description,
  icon: Icon,
  count,
  active,
  onClick,
  accent,
}: ModeCardProps) {
  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer transition-all ${
        active
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'hover:border-primary/30 hover:bg-muted/30'
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`flex size-10 items-center justify-center rounded-lg ${accent}`}>
            <Icon className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground">{label}</h3>
              <Badge variant={active ? 'default' : 'secondary'} className="text-xs">
                {count} 题
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PracticePage() {
  const navigate = useNavigate();
  const { allQuestions, subjects, getChaptersBySubject } = useQuestionBank();
  const { banks, currentBankId } = useQBanks();
  const { allWrong, getWrongIdsByBankIds } = useWrongBook();
  const { getFavoritesByBankIds } = useFavorites();

  const [mode, setMode] = useState<PracticeMode>('sequential');
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([currentBankId]);
  const [reciteMode, setReciteMode] = useState(false);
  const [onlyCorrectOptions, setOnlyCorrectOptions] = useState(
    () => scopedStorage.getItem(RECITE_ONLY_CORRECT_KEY) === '1',
  );
  const [subject, setSubject] = useState<string>('all');
  const [chapter, setChapter] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<string>('all');
  const [judgeFilter, setJudgeFilter] = useState<JudgeFilter>('all');
  const [bankPopoverOpen, setBankPopoverOpen] = useState(false);

  const chapterOptions = useMemo(() => getChaptersBySubject(subject), [subject, getChaptersBySubject]);

  // 当 currentBankId 变化（刷新恢复 / 切换题库）时，同步到选中的题库
  // 避免 useState 初始值只在首次渲染生效，导致刷新后还是默认题库
  useEffect(() => {
    if (currentBankId) {
      setSelectedBankIds((prev) => {
        // 只有在用户没手动选过多个题库时才同步
        if (prev.length <= 1) return [currentBankId];
        return prev;
      });
    }
  }, [currentBankId]);

  // 已选题库的题目集合
  const bankQuestions = useMemo(() => {
    return allQuestions.filter((q) => selectedBankIds.includes(q.bankId));
  }, [allQuestions, selectedBankIds]);

  // 判断题答案筛选：按题目本身的正确答案是「对」还是「错」来筛选
  const selectedCorrectIds = useMemo(() => {
    return bankQuestions
      .filter((q) => q.type === 'judge' && q.answer === '对')
      .map((q) => q.id);
  }, [bankQuestions]);

  const selectedWrongIds = useMemo(() => {
    return getWrongIdsByBankIds(selectedBankIds);
  }, [getWrongIdsByBankIds, selectedBankIds]);

  // 已选题库的收藏题 ID 集合
  const selectedFavoriteIds = useMemo(() => {
    return getFavoritesByBankIds(selectedBankIds);
  }, [getFavoritesByBankIds, selectedBankIds]);

  // 基础筛选
  const baseFiltered = useMemo(() => {
    return bankQuestions.filter((q) => {
      if (subject !== 'all' && q.subject !== subject) return false;
      if (chapter !== 'all' && q.chapter !== chapter) return false;
      if (type !== 'all' && q.type !== type) return false;
      if (difficulty !== 'all' && String(q.difficulty) !== difficulty) return false;
      // 判断题答案筛选（当 type=='judge' 时生效：按题目本身答案是对/错来过滤）
      if (type === 'judge' && judgeFilter !== 'all') {
        if (judgeFilter === 'true') {
          return q.answer === '对';
        }
        if (judgeFilter === 'false') {
          return q.answer === '错';
        }
      }
      return true;
    });
  }, [bankQuestions, subject, chapter, type, difficulty, judgeFilter, selectedWrongIds]);

  // 各模式题目数
  const modeCounts = useMemo(() => {
    const wrongCount = baseFiltered.filter((q) => selectedWrongIds.includes(q.id)).length;
    const favCount = baseFiltered.filter((q) => selectedFavoriteIds.includes(q.id)).length;
    return {
      sequential: baseFiltered.length,
      random: baseFiltered.length,
      wrong: wrongCount,
      favorite: favCount,
      recite: baseFiltered.length,
    };
  }, [baseFiltered, selectedWrongIds, selectedFavoriteIds]);

  const availableCount = modeCounts[mode];

  const toggleBank = (bankId: string) => {
    setSelectedBankIds((prev) =>
      prev.includes(bankId) ? prev.filter((id) => id !== bankId) : [...prev, bankId],
    );
  };

  const selectAllBanks = () => {
    setSelectedBankIds(banks.map((b) => b.id));
  };

  const clearBankSelection = () => {
    setSelectedBankIds([]);
  };

  const handleStart = () => {
    if (availableCount === 0) return;
    const params = new URLSearchParams({
      mode,
      subject,
      chapter,
      type,
      difficulty,
      judgeFilter,
      bankIds: selectedBankIds.join(','),
      recite: reciteMode ? '1' : '0',
      onlyCorrect: reciteMode && onlyCorrectOptions ? '1' : '0',
    });
    navigate(`/quiz/${mode}?${params.toString()}`);
  };

  const handleOnlyCorrectChange = (checked: boolean) => {
    setOnlyCorrectOptions(checked);
    scopedStorage.setItem(RECITE_ONLY_CORRECT_KEY, checked ? '1' : '0');
  };

  const selectedBankLabel = useMemo(() => {
    if (selectedBankIds.length === 0) return '请选择题库';
    if (selectedBankIds.length === banks.length && banks.length > 0) return '全部题库';
    if (selectedBankIds.length === 1) {
      const b = banks.find((bank) => bank.id === selectedBankIds[0]);
      return b?.name || '选择题库';
    }
    return `已选 ${selectedBankIds.length} 个题库`;
  }, [selectedBankIds, banks]);

  const modes: ModeCardProps[] = [
    {
      mode: 'sequential',
      label: '顺序练习',
      description: '按题库顺序逐题练习',
      icon: BookOpen,
      count: modeCounts.sequential,
      active: mode === 'sequential',
      onClick: () => setMode('sequential'),
      accent: 'bg-primary/10 text-primary',
    },
    {
      mode: 'random',
      label: '随机练习',
      description: '随机抽取题目练习',
      icon: Shuffle,
      count: modeCounts.random,
      active: mode === 'random',
      onClick: () => setMode('random'),
      accent: 'bg-info/10 text-info',
    },
    {
      mode: 'wrong',
      label: '错题本',
      description: '重做之前做错的题目',
      icon: XCircle,
      count: modeCounts.wrong,
      active: mode === 'wrong',
      onClick: () => setMode('wrong'),
      accent: 'bg-destructive/10 text-destructive',
    },
    {
      mode: 'favorite',
      label: '收藏题目',
      description: '练习已收藏的重点题目',
      icon: Star,
      count: modeCounts.favorite,
      active: mode === 'favorite',
      onClick: () => setMode('favorite'),
      accent: 'bg-warning/10 text-warning',
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 md:py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground md:text-2xl">刷题练习</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          选择题库和模式，开始练习
        </p>
      </div>

      {/* 题库选择 */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">题库选择</span>
            <Badge variant="secondary" className="text-xs">
              {selectedBankIds.length} / {banks.length}
            </Badge>
          </div>
          <Popover open={bankPopoverOpen} onOpenChange={setBankPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between font-normal"
              >
                <span className="truncate">{selectedBankLabel}</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopContent
              banks={banks}
              selectedBankIds={selectedBankIds}
              onToggle={toggleBank}
              onSelectAll={selectAllBanks}
              onClear={clearBankSelection}
            />
          </Popover>
        </CardContent>
      </Card>

      {/* 模式选择 */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {modes.map((m) => (
          <ModeCard key={m.mode} {...m} />
        ))}
      </div>

      {/* 背题模式设置 */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <BookMarked className="size-4.5" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">背题模式</div>
                <div className="text-xs text-muted-foreground">直接显示答案和解析，翻页记忆</div>
              </div>
            </div>
            <Switch
              checked={reciteMode}
              onCheckedChange={setReciteMode}
              aria-label="背题模式"
            />
          </div>

          <div
            className={`mt-4 flex items-center justify-between border-t border-border/60 pt-4 ${
              reciteMode ? '' : 'opacity-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex size-9 items-center justify-center rounded-lg ${
                  reciteMode ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                <Eye className="size-4.5" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">只显示正确选项</div>
                <div className="text-xs text-muted-foreground">隐藏错误选项，专注记忆正确答案</div>
              </div>
            </div>
            <Switch
              checked={reciteMode && onlyCorrectOptions}
              onCheckedChange={handleOnlyCorrectChange}
              disabled={!reciteMode}
              aria-label="只显示正确选项"
            />
          </div>
        </CardContent>
      </Card>

      {/* 筛选条件 */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">筛选条件</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select value={subject} onValueChange={(v) => { setSubject(v); setChapter('all'); }}>
              <SelectTrigger><SelectValue placeholder="学科" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部学科</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={chapter} onValueChange={setChapter}>
              <SelectTrigger><SelectValue placeholder="章节" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部章节</SelectItem>
                {chapterOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="题型" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部题型</SelectItem>
                {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger><SelectValue placeholder="难度" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部难度</SelectItem>
                <SelectItem value="1">简单</SelectItem>
                <SelectItem value="2">中等</SelectItem>
                <SelectItem value="3">困难</SelectItem>
              </SelectContent>
            </Select>
            {type === 'judge' && (
              <div className="col-span-2">
                <Label className="mb-1.5 block text-sm font-medium text-foreground">
                  判断题筛选
                </Label>
                <div className="flex gap-2">
                  {[
                    { value: 'all', label: '全部判断题' },
                    { value: 'true', label: '答案为正确' },
                    { value: 'false', label: '答案为错误' },
                  ].map((opt) => (
                    <Button
                      key={opt.value}
                      variant={judgeFilter === opt.value ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setJudgeFilter(opt.value as JudgeFilter)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 开始按钮 */}
      <div className="sticky bottom-20 z-10 md:static md:bottom-auto">
        <Button
          size="lg"
          className="w-full text-base"
          onClick={handleStart}
          disabled={availableCount === 0 || selectedBankIds.length === 0}
        >
          开始练习
          <ChevronRight className="ml-1 size-5" />
          <span className="ml-1 text-sm opacity-80">（{availableCount} 题）</span>
        </Button>
      </div>
    </div>
  );
}

interface PopContentProps {
  banks: { id: string; name: string }[];
  selectedBankIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

function PopContent({ banks, selectedBankIds, onToggle, onSelectAll, onClear }: PopContentProps) {
  return (
    <PopoverContent className="w-72 p-3" align="start">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          我的题库（{banks.length}）
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onSelectAll}
          >
            全选
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onClear}
          >
            清空
          </Button>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {banks.map((bank) => {
          const checked = selectedBankIds.includes(bank.id);
          return (
            <div
              key={bank.id}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                checked ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
              }`}
              onClick={() => onToggle(bank.id)}
            >
              <Checkbox checked={checked} onCheckedChange={() => onToggle(bank.id)} />
              <span className="text-sm truncate flex-1">{bank.name}</span>
              {checked && <Check className="size-4 shrink-0" />}
            </div>
          );
        })}
      </div>
    </PopoverContent>
  );
}
