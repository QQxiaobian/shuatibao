import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { resolveAppUrl } from '@lark-apaas/client-toolkit-lite';
import { Upload, Download, Plus, Search, BookOpen, AlertCircle, Trash2, Pencil, LayoutGrid, List, Database, Loader2, Star, StarOff, BookMarked, Play } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuestionBank } from '@/hooks/useQuestionBank';
import { useQBanks, DEFAULT_BANK_ID } from '@/hooks/useQBanks';
import { useWrongBook } from '@/hooks/useWrongBook';
import { useFavorites } from '@/hooks/useFavorites';
import { useExams } from '@/hooks/useExams';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, type IQuestion, type QuestionType, type Difficulty } from '@/data/questions';
import { getLatestBankProgress, type ProgressIndexEntry } from '@/lib/progress';
import QuestionImportDialog from './QuestionImportDialog';
import QuestionEditDialog from './QuestionEditDialog';

const difficultyBadgeVariant = (d: Difficulty) => {
  if (d === 1) return 'secondary';
  if (d === 2) return 'default';
  return 'destructive';
};

const typeBadgeVariant = (t: QuestionType) => {
  switch (t) {
    case 'single': return 'default';
    case 'multiple': return 'secondary';
    case 'judge': return 'outline';
    case 'short': return 'destructive';
  }
};

export default function LibraryPage() {
  const navigate = useNavigate();
  const {
    questions,
    allQuestions,
    subjects,
    chapters,
    addQuestion,
    bulkAddQuestions,
    updateQuestion,
    deleteQuestion,
    getChaptersBySubject,
    deleteQuestionsByBankId,
  } = useQuestionBank();
  const {
    banks,
    currentBank,
    createBank,
    updateBank: updateBankInfo,
    deleteBank,
    switchBank,
    DEFAULT_BANK_ID: DEFAULT_ID,
  } = useQBanks();
  const { clearWrongByBankId } = useWrongBook();
  const { clearFavoritesByBankId, toggleFavorite, isFavorite } = useFavorites();
  const { deleteExamsByBankId } = useExams();
  const [keyword, setKeyword] = useState('');
  const [subject, setSubject] = useState<string>('all');
  const [chapter, setChapter] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<string>('all');
  const [editingQuestion, setEditingQuestion] = useState<IQuestion | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // 题库管理弹窗状态
  const [deleteBankId, setDeleteBankId] = useState<string | null>(null);
  const [renameBankId, setRenameBankId] = useState<string | null>(null);
  const [createBankOpen, setCreateBankOpen] = useState(false);
  const [bankNameInput, setBankNameInput] = useState('');
  const [builtinLoading, setBuiltinLoading] = useState(false);
  const builtinAbortRef = useRef(false);

  const chapterOptions = useMemo(() => getChaptersBySubject(subject), [subject, getChaptersBySubject]);

  // 每个题库最近的刷题 / 背题进度（用于“继续刷题 / 继续背题”）
  const bankProgress = useMemo(() => {
    const map: Record<string, { practice: ProgressIndexEntry | null; recite: ProgressIndexEntry | null }> = {};
    for (const bank of banks) {
      map[bank.id] = {
        practice: getLatestBankProgress(bank.id, false),
        recite: getLatestBankProgress(bank.id, true),
      };
    }
    return map;
  }, [banks]);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (subject !== 'all' && q.subject !== subject) return false;
      if (chapter !== 'all' && q.chapter !== chapter) return false;
      if (type !== 'all' && q.type !== type) return false;
      if (difficulty !== 'all' && String(q.difficulty) !== difficulty) return false;
      if (keyword.trim()) {
        const kw = keyword.toLowerCase();
        if (!q.question.toLowerCase().includes(kw) && !q.analysis.toLowerCase().includes(kw)) {
          return false;
        }
      }
      return true;
    });
  }, [questions, subject, chapter, type, difficulty, keyword]);

  const stats = useMemo(() => {
    const total = questions.length;
    const types = { single: 0, multiple: 0, judge: 0, short: 0 };
    questions.forEach((q) => { types[q.type]++; });
    return { total, ...types };
  }, [questions]);

  const handleBulkAdd = useCallback(
    (
      list: Omit<IQuestion, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'bankId'>[],
      bankName?: string,
    ) => {
      let targetBankId: string;
      if (bankName && bankName.trim()) {
        // 题库名作为独立题库，创建新的
        const newBank = createBank(bankName.trim(), `导入于 ${new Date().toLocaleDateString()}`);
        targetBankId = newBank.id;
      } else {
        targetBankId = currentBank?.id || 'bank_mock';
      }
      const newList = bulkAddQuestions(list, 'import', targetBankId);
      return newList.length;
    },
    [createBank, currentBank, bulkAddQuestions]
  );

  /**
   * 一键导入内置题库
   * 从本地静态 JSON 资源异步加载，按 bankName 自动分成多个独立题库
   * 不打包进 JS 中，避免首屏白屏
   */
  const importBuiltinBank = useCallback(async () => {
    if (builtinLoading) return;
    setBuiltinLoading(true);
    builtinAbortRef.current = false;
    const toastId = toast.loading('正在加载内置题库...');
    try {
      // 正确的内置题库JSON路径：本应用的 public/builtin-questions.json
      // 妙搭 dev server 有 basePath（如 /app/app_xxx/），生产部署也有
      // 尝试：1) 带 basePath 的绝对路径（resolveAppUrl生成，已补全origin）
      //       2) 带 basePath 的相对路径（相对于当前 location.origin）
      //       3) 根路径（兜底，旧版部署可能无basePath）
      const basePath = (window as any).__APP_BASE_PATH__
        || (document.querySelector('base')?.getAttribute('href')?.replace(/\/$/, '') || '');
      const fullUrl = resolveAppUrl('/builtin-questions.json');
      const candidateUrls = [
        fullUrl,
        `${basePath}/builtin-questions.json`,
        '/builtin-questions.json',
      ].filter(Boolean) as string[];
      // 去重
      const urls = Array.from(new Set(candidateUrls));

      let resp: Response | null = null;
      let lastErr = '';
      for (const url of urls) {
        try {
          const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
          const ct = r.headers.get('content-type') || '';
          if (r.ok && ct.includes('json')) {
            resp = r;
            break;
          }
          lastErr = `HTTP ${r.status} ${ct}`;
        } catch (e) {
          lastErr = String(e);
        }
      }
      if (!resp) throw new Error(`加载失败：${lastErr}`);
      const rawData: Array<Record<string, any>> = await resp.json();
      if (!Array.isArray(rawData) || rawData.length === 0) {
        throw new Error('数据为空或格式不正确');
      }

      toast.loading(`已读取 ${rawData.length} 道题，正在按题库分组入库...`, { id: toastId });

      // 按 bankName 分组
      const groups = new Map<string, typeof rawData>();
      for (const item of rawData) {
        const bn = String(item.bankName || '内置题库').trim();
        if (!groups.has(bn)) groups.set(bn, []);
        groups.get(bn)!.push(item);
      }

      const bankNames = Array.from(groups.keys());
      let totalImported = 0;
      let skipped = 0;

      for (let bi = 0; bi < bankNames.length; bi++) {
        if (builtinAbortRef.current) break;
        const bn = bankNames[bi];
        const items = groups.get(bn)!;

        // 同名题库已存在则跳过，避免重复导入
        const existing = banks.find((b) => b.name.trim() === bn.trim());
        if (existing) {
          skipped++;
          continue;
        }

        // 转换为 IQuestion 格式
        const converted: Omit<IQuestion, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'bankId'>[] = [];
        for (const it of items) {
          const typeStr = String(it.type || '').trim();
          let type: 'single' | 'multiple' | 'judge' | 'short' = 'single';
          if (typeStr.includes('多选')) type = 'multiple';
          else if (typeStr.includes('判断') || typeStr.includes('对错')) type = 'judge';
          else if (typeStr.includes('简答') || typeStr.includes('问答') || typeStr.includes('填空')) type = 'short';
          else type = 'single';

          // 健壮提取选项：兼容 dict（字母键）/ 数组 / 字符串 多种格式
          const rawOpts = it.options;
          let optionList: string[] = [];
          if (Array.isArray(rawOpts)) {
            // 数组格式：直接使用
            optionList = rawOpts
              .map((v) => String(v ?? '').trim())
              .filter(Boolean);
          } else if (rawOpts && typeof rawOpts === 'object') {
            // dict 格式：按 A-I 字母顺序取值
            for (let i = 0; i < 9; i++) {
              const letter = String.fromCharCode(65 + i); // A B C ... I
              const v = (rawOpts as Record<string, any>)[letter];
              if (v !== undefined && v !== null && String(v).trim() !== '') {
                optionList.push(String(v).trim());
              }
            }
            // 如果字母键没取到值，尝试按 keys 的原始顺序取（兼容非字母键）
            if (optionList.length === 0) {
              const keys = Object.keys(rawOpts as Record<string, any>);
              if (keys.length > 0) {
                optionList = keys
                  .map((k) => String((rawOpts as Record<string, any>)[k] ?? '').trim())
                  .filter(Boolean);
              }
            }
          } else if (typeof rawOpts === 'string' && rawOpts.trim()) {
            // 字符串格式：按换行或逗号分隔
            optionList = rawOpts
              .split(/[\n;；]/)
              .map((s) => s.replace(/^[A-Z][.、．\s]+/, '').trim())
              .filter(Boolean);
          }

          let answer: string | string[] = String(it.answer || '').trim();
          if (type === 'multiple') {
            // 多选题答案转数组（按字母拆分）
            const letters = answer.toUpperCase().split('').filter((c) => /[A-I]/.test(c));
            answer = letters.length > 0 ? letters : ['A'];
          } else if (type === 'judge') {
            // 判断题答案标准化
            const a = answer.trim();
            if (['对', '正确', '√', 'T', 'true', '是', 'Y'].some((k) => a.includes(k))) {
              answer = '对';
            } else {
              answer = '错';
            }
          }

          // 题型二次识别：如果是单选且恰好2个选项，且选项A/B内容为「正确/错误」或「对/错」，
          // 说明源数据把判断题误标成了单选题，纠正为 judge 类型
          if (type === 'single' && optionList.length === 2) {
            const optA = optionList[0];
            const optB = optionList[1];
            const correctTexts = ['正确', '对', '对的', '正确的', '√', 'T', 'True', 'true'];
            const wrongTexts = ['错误', '错', '不对', '错误的', '×', 'F', 'False', 'false'];
            const aIsCorrect = correctTexts.some((t) => optA === t || optA.replace(/[。.]$/, '') === t);
            const bIsWrong = wrongTexts.some((t) => optB === t || optB.replace(/[。.]$/, '') === t);
            if (aIsCorrect && bIsWrong) {
              type = 'judge';
              // 答案转换：A → 对，B → 错
              const ans = String(it.answer || '').trim().toUpperCase();
              answer = ans === 'A' ? '对' : '错';
            }
          }

          // 兜底：单选/多选 options 为空但答案是字母（源数据缺失），
          // 如果题干含明显填空特征则降级为简答题，避免答题页空白
          if ((type === 'single' || type === 'multiple') && optionList.length === 0) {
            const stem = String(it.stem || it.question || '');
            const hasBlankMarker =
              stem.includes('（）') ||
              stem.includes('（ ）') ||
              stem.includes('()') ||
              stem.includes('( )') ||
              stem.includes('____') ||
              stem.includes('___');
            if (hasBlankMarker && type === 'single') {
              type = 'short';
              answer = String(it.answer || '').trim();
            }
          }

          const diffStr = String(it.difficulty || '').trim();
          let difficulty: 1 | 2 | 3 = 2;
          if (['易', '简单', '初级', '初级工', '初级作业员'].some((k) => diffStr.includes(k))) difficulty = 1;
          else if (['难', '困难', '高级', '高级工', '高级作业员', '技师', '高级技师'].some((k) => diffStr.includes(k))) difficulty = 3;
          else difficulty = 2;

          converted.push({
            type,
            question: String(it.stem || it.question || '').trim(),
            options: optionList,
            answer,
            analysis: String(it.analysis || it.explanation || '').trim(),
            subject: String(it.subject || bn).trim(),
            chapter: String(it.chapter || '未分类').trim(),
            difficulty,
          });
        }

        // 创建题库并入库
        const newBank = createBank(bn, `内置题库 · ${converted.length} 道题`);
        const added = bulkAddQuestions(converted, 'import', newBank.id);
        totalImported += added.length;

        toast.loading(`已导入 ${bi + 1}/${bankNames.length} 个题库 · 累计 ${totalImported} 道`, { id: toastId });

        // 让出主线程，避免UI长时间卡顿
        await new Promise((r) => setTimeout(r, 30));
      }

      const addedCount = bankNames.length - skipped;
      toast.success(
        `内置题库导入完成！新增 ${addedCount} 个题库 · ${totalImported} 道题` +
          (skipped > 0 ? `（跳过 ${skipped} 个同名题库）` : ''),
        { id: toastId },
      );
    } catch (err) {
      toast.error('内置题库导入失败：' + (err as Error).message, { id: toastId });
    } finally {
      setBuiltinLoading(false);
    }
  }, [builtinLoading, createBank, bulkAddQuestions, banks]);

  const handleExport = useCallback(() => {
    if (questions.length === 0) {
      toast.warning('题库为空，无法导出');
      return;
    }
    const data = questions.map((q) => ({
      题型: QUESTION_TYPE_LABELS[q.type],
      题干: q.question,
      选项A: q.options[0] || '',
      选项B: q.options[1] || '',
      选项C: q.options[2] || '',
      选项D: q.options[3] || '',
      选项E: q.options[4] || '',
      选项F: q.options[5] || '',
      选项G: q.options[6] || '',
      选项H: q.options[7] || '',
      正确答案: Array.isArray(q.answer) ? q.answer.join('') : q.answer,
      解析: q.analysis,
      学科: q.subject,
      章节: q.chapter,
      难度: DIFFICULTY_LABELS[q.difficulty],
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '题库');
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `题库导出_${date}.xlsx`);
    toast.success(`导出成功，共 ${questions.length} 道题`);
  }, [questions]);

  const handleEdit = (q: IQuestion) => {
    setEditingQuestion(q);
    setEditOpen(true);
  };

  const handleSave = (data: Omit<IQuestion, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'bankId'>) => {
    if (editingQuestion) {
      updateQuestion(editingQuestion.id, data);
    } else {
      addQuestion(data, 'manual');
    }
    setEditingQuestion(null);
  };

  const handleDeleteConfirm = (id: string) => {
    deleteQuestion(id);
    setDeleteConfirm(null);
    toast.success('删除成功');
  };

  // ========== 题库卡片操作 ==========

  // 获取某个题库的题目数
  const getBankQuestionCount = (bankId: string) => {
    return allQuestions.filter((q) => q.bankId === bankId).length;
  };

  // 新建题库
  const handleCreateBank = () => {
    const name = bankNameInput.trim();
    if (!name) {
      toast.error('请输入题库名称');
      return;
    }
    createBank(name);
    toast.success('题库已创建');
    setBankNameInput('');
    setCreateBankOpen(false);
  };

  // 重命名题库
  const openRenameBank = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return;
    setRenameBankId(bankId);
    setBankNameInput(bank.name);
  };

  const handleRenameBank = () => {
    if (!renameBankId) return;
    const name = bankNameInput.trim();
    if (!name) {
      toast.error('请输入题库名称');
      return;
    }
    updateBankInfo(renameBankId, { name });
    toast.success('题库已重命名');
    setBankNameInput('');
    setRenameBankId(null);
  };

  // 删除题库（级联）
  const handleDeleteBank = () => {
    if (!deleteBankId) return;
    deleteQuestionsByBankId(deleteBankId);
    clearWrongByBankId(deleteBankId);
    clearFavoritesByBankId(deleteBankId);
    deleteExamsByBankId(deleteBankId);
    deleteBank(deleteBankId);
    toast.success('题库已删除');
    setDeleteBankId(null);
  };

  // 导出单个题库为 Excel
  const handleExportBank = (bankId: string) => {
    const bankQuestions = allQuestions.filter((q) => q.bankId === bankId);
    if (bankQuestions.length === 0) {
      toast.warning('该题库为空，无法导出');
      return;
    }
    const data = bankQuestions.map((q) => ({
      题型: QUESTION_TYPE_LABELS[q.type],
      题干: q.question,
      选项A: q.options[0] || '',
      选项B: q.options[1] || '',
      选项C: q.options[2] || '',
      选项D: q.options[3] || '',
      选项E: q.options[4] || '',
      选项F: q.options[5] || '',
      选项G: q.options[6] || '',
      选项H: q.options[7] || '',
      正确答案: Array.isArray(q.answer) ? q.answer.join('') : q.answer,
      解析: q.analysis,
      学科: q.subject,
      章节: q.chapter,
      难度: DIFFICULTY_LABELS[q.difficulty],
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    const bank = banks.find((b) => b.id === bankId);
    XLSX.utils.book_append_sheet(wb, ws, bank?.name || '题库');
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${bank?.name || '题库'}_${date}.xlsx`);
    toast.success(`导出成功，共 ${bankQuestions.length} 道题`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 md:py-8">
      {/* 顶部操作栏 */}
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl">
              {currentBank?.name || '题库管理'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              共 {stats.total} 道题 · 单选 {stats.single} · 多选 {stats.multiple} · 判断 {stats.judge} · 简答 {stats.short}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <QuestionImportDialog onImport={handleBulkAdd}>
            <Button variant="default">
              <Upload className="mr-2 size-4" />
              导入题库
            </Button>
          </QuestionImportDialog>
          <Button
            variant="outline"
            onClick={importBuiltinBank}
            disabled={builtinLoading}
          >
            {builtinLoading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Database className="mr-2 size-4" />
            )}
            {builtinLoading ? '导入中...' : '内置题库'}
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 size-4" />
            导出 Excel
          </Button>
          <div className="flex-1" />
          <Button
            variant="secondary"
            onClick={() => {
              setBankNameInput('');
              setCreateBankOpen(true);
            }}
          >
            <LayoutGrid className="mr-2 size-4" />
            新建题库
          </Button>
          <QuestionEditDialog
            mode="create"
            onSave={(d) => addQuestion(d, 'manual')}
            trigger={
              <Button variant="secondary">
                <Plus className="mr-2 size-4" />
                手动添加
              </Button>
            }
          />
        </div>
      </div>

      {/* 题库列表卡片 */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          全部题库（{banks.length}）
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {banks.map((bank) => {
            const count = getBankQuestionCount(bank.id);
            const isActive = bank.id === currentBank?.id;
            const progress = bankProgress[bank.id];
            return (
              <Card
                key={bank.id}
                className={
                  `cursor-pointer transition-all hover:shadow-md ${
                    isActive
                      ? 'border-primary ring-1 ring-primary/30 bg-primary/[0.02]'
                      : 'hover:border-primary/30'
                  }`
                }
                onClick={() => switchBank(bank.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <BookOpen className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-semibold text-foreground truncate">
                            {bank.name}
                          </h3>
                          {isActive && (
                            <Badge variant="default" className="text-[10px] h-4 px-1 font-normal">
                              当前
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {count} 道题
                        </p>
                      </div>
                    </div>
                  </div>
                  {progress && (progress.practice || progress.recite) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {progress.practice && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(progress.practice!.url);
                          }}
                        >
                          <Play className="mr-1 size-3" />
                          继续刷题
                          <span className="ml-1 text-muted-foreground">
                            {progress.practice.currentIndex + 1}/{progress.practice.total}
                          </span>
                        </Button>
                      )}
                      {progress.recite && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(progress.recite!.url);
                          }}
                        >
                          <BookMarked className="mr-1 size-3" />
                          继续背题
                          <span className="ml-1 text-muted-foreground">
                            {progress.recite.currentIndex + 1}/{progress.recite.total}
                          </span>
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {format(bank.createdAt, 'yyyy/MM/dd', { locale: zhCN })}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportBank(bank.id);
                        }}
                        title="导出"
                      >
                        <Download className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRenameBank(bank.id);
                        }}
                        title="重命名"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {bank.id !== DEFAULT_BANK_ID && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteBankId(bank.id);
                          }}
                          title="删除"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 筛选区 */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="relative col-span-2 md:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="搜索题目..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
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
          </div>
        </CardContent>
      </Card>

      {/* 题目列表 */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-muted">
              {questions.length === 0 ? (
                <BookOpen className="size-8 text-muted-foreground" />
              ) : (
                <AlertCircle className="size-8 text-muted-foreground" />
              )}
            </div>
            <p className="text-base font-medium text-foreground">
              {questions.length === 0 ? '题库还是空的' : '没有符合条件的题目'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {questions.length === 0 ? '点击「导入题库」或「手动添加」开始吧' : '试试调整筛选条件'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <Card
              key={q.id}
              className="cursor-pointer transition-colors hover:border-primary/30"
              onClick={() => handleEdit(q)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <Badge variant={typeBadgeVariant(q.type) as any} className="text-xs">
                      {QUESTION_TYPE_LABELS[q.type]}
                    </Badge>
                    <Badge variant={difficultyBadgeVariant(q.difficulty) as any} className="text-xs">
                      {DIFFICULTY_LABELS[q.difficulty]}
                    </Badge>
                  </div>
                  <p className="flex-1 min-w-0 text-sm leading-relaxed text-foreground line-clamp-2">
                    {q.question}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 -mr-1 -mt-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(q.id, q.bankId);
                    }}
                    aria-label={isFavorite(q.id) ? '取消收藏' : '收藏'}
                  >
                    {isFavorite(q.id) ? (
                      <Star className="size-4 fill-warning text-warning" />
                    ) : (
                      <StarOff className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{q.subject}</span>
                  <span>·</span>
                  <span>{q.chapter}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 编辑对话框 */}
      {editingQuestion && (
        <QuestionEditDialog
          question={editingQuestion}
          mode="edit"
          onSave={handleSave}
          onDelete={() => setDeleteConfirm(editingQuestion.id)}
        />
      )}

      {/* 删除确认 */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将无法恢复，确定要删除这道题目吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteConfirm(deleteConfirm)}
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 新建题库对话框 */}
      <Dialog open={createBankOpen} onOpenChange={setCreateBankOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建题库</DialogTitle>
            <DialogDescription>
              创建一个空题库，之后可以通过导入 Excel 或手动添加的方式往里面加题。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">题库名称</label>
              <Input
                placeholder="请输入题库名称"
                value={bankNameInput}
                onChange={(e) => setBankNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateBank();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateBankOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateBank}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重命名题库对话框 */}
      <Dialog
        open={!!renameBankId}
        onOpenChange={(o) => !o && setRenameBankId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名题库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">题库名称</label>
              <Input
                placeholder="请输入题库名称"
                value={bankNameInput}
                onChange={(e) => setBankNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameBank();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameBankId(null)}>
              取消
            </Button>
            <Button onClick={handleRenameBank}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除题库确认对话框 */}
      <AlertDialog
        open={!!deleteBankId}
        onOpenChange={(o) => !o && setDeleteBankId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除题库？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后该题库的所有题目、错题记录、收藏题目、试卷都会被一并清除，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBank}
              className="bg-destructive hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
