import { useState, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  X,
  Check,
  AlertCircle,
  Loader2,
  Settings2,
  Eye,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { IQuestion, QuestionType, Difficulty } from '@/data/questions';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from '@/data/questions';

/** 将 ExcelJS worksheet 转为字符串二维数组（备用解析器用） */
function excelJsSheetToAoa(worksheet: ExcelJS.Worksheet): string[][] {
  const result: string[][] = [];
  if (!worksheet.rowCount) return result;
  // 取最大列数
  let maxCol = 0;
  worksheet.eachRow((row) => {
    if (row.cellCount > maxCol) maxCol = row.cellCount;
  });
  for (let r = 1; r <= worksheet.rowCount; r++) {
    const row: string[] = [];
    for (let c = 1; c <= maxCol; c++) {
      const cell = worksheet.getCell(r, c);
      let val = '';
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'object' && cell.value !== null) {
          const v = cell.value as Record<string, any>;
          if (Array.isArray(v.richText)) {
            val = v.richText.map((rt: any) => rt.text).join('');
          } else if ('result' in v) {
            val = String(v.result ?? '');
          } else if ('text' in v) {
            val = String(v.text);
          } else {
            val = String(cell.value);
          }
        } else {
          val = String(cell.value);
        }
      }
      row.push(val.trim());
    }
    result.push(row);
  }
  return result;
}

interface QuestionImportDialogProps {
  onImport: (
    questions: Omit<IQuestion, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'bankId'>[],
    bankName: string,
  ) => number;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
}

type ImportResult = {
  success: number;
  failed: number;
  errors: string[];
  byType: Record<QuestionType, number>;
  bankResults?: { bankName: string; success: number; failed: number }[];
};

type SheetData = {
  sheetName: string;
  bankName: string;
  /** 所有原始行（字符串二维数组），用于标题行选择 */
  allRows: string[][];
  /** 标题行索引（0-based） */
  headerRowIdx: number;
  columns: string[];
  rawRows: Record<string, string>[];
  mapping: Partial<Record<TargetField, string>>;
  selected: boolean;
};

/** 目标字段（左侧标准字段） */
type TargetField =
  | 'type'
  | 'question'
  | 'optionA'
  | 'optionB'
  | 'optionC'
  | 'optionD'
  | 'optionE'
  | 'optionF'
  | 'optionG'
  | 'optionH'
  | 'optionI'
  | 'answer'
  | 'analysis'
  | 'subject'
  | 'chapter'
  | 'difficulty';

const TARGET_FIELDS: {
  key: TargetField;
  label: string;
  required: boolean;
  group: '必填' | '选项' | '可选';
}[] = [
  { key: 'question', label: '题干', required: true, group: '必填' },
  { key: 'answer', label: '正确答案', required: true, group: '必填' },
  { key: 'type', label: '题型（不选则自动识别）', required: false, group: '必填' },
  { key: 'optionA', label: '选项 A', required: false, group: '选项' },
  { key: 'optionB', label: '选项 B', required: false, group: '选项' },
  { key: 'optionC', label: '选项 C', required: false, group: '选项' },
  { key: 'optionD', label: '选项 D', required: false, group: '选项' },
  { key: 'optionE', label: '选项 E', required: false, group: '选项' },
  { key: 'optionF', label: '选项 F', required: false, group: '选项' },
  { key: 'optionG', label: '选项 G', required: false, group: '选项' },
  { key: 'optionH', label: '选项 H', required: false, group: '选项' },
  { key: 'optionI', label: '选项 I', required: false, group: '选项' },
  { key: 'analysis', label: '解析', required: false, group: '可选' },
  { key: 'subject', label: '学科', required: false, group: '可选' },
  { key: 'chapter', label: '章节', required: false, group: '可选' },
  { key: 'difficulty', label: '难度', required: false, group: '可选' },
];

const LETTER_MAP = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

/** 解析题型字符串 */
function parseType(typeStr: string): QuestionType | null {
  if (!typeStr) return null;
  const t = typeStr.trim().toLowerCase();
  if (t.includes('单选') || t === 'single' || t === '单选题') return 'single';
  if (t.includes('多选') || t === 'multiple' || t === '多选题') return 'multiple';
  if (
    t.includes('判断') ||
    t === 'judge' ||
    t === '判断题' ||
    t === '对错' ||
    t === '是非'
  )
    return 'judge';
  if (
    t.includes('简答') ||
    t.includes('问答') ||
    t === 'short' ||
    t === '简答题' ||
    t === '主观题'
  )
    return 'short';
  return null;
}

/** 解析难度 */
function parseDifficulty(diff: string): Difficulty {
  if (!diff) return 1;
  const d = diff.trim().toLowerCase();
  if (d.includes('难') || d === '3' || d === 'hard' || d.includes('困难')) return 3;
  if (d.includes('中') || d === '2' || d === 'medium' || d.includes('中等')) return 2;
  return 1;
}

/** 解析答案 */
function parseAnswer(
  ans: string,
  type: QuestionType,
): string | string[] {
  if (type === 'multiple') {
    const letters = ans
      .replace(/[\s,，、；;]/g, '')
      .toUpperCase()
      .split('')
      .filter((c) => /[A-H]/.test(c));
    return letters.length > 0 ? letters : ['A'];
  }
  if (type === 'judge') {
    const a = ans.trim();
    if (
      a === '√' ||
      a === '对' ||
      a === '正确' ||
      a === 'T' ||
      a === 'true' ||
      a === '✓' ||
      a === '是' ||
      a === '√ ' ||
      a.toLowerCase() === 'true' ||
      a === '1'
    )
      return '对';
    return '错';
  }
  if (type === 'short') {
    return ans.trim();
  }
  // 单选
  const m = ans.trim().toUpperCase().match(/[A-H]/);
  return m ? m[0] : ans.trim();
}

/** 根据答案和选项自动推断题型 */
function autoDetectType(
  answerStr: string,
  optionCount: number,
): QuestionType {
  const ans = answerStr.trim();
  // 判断题答案特征（优先级最高，避免被误识别为单选）
  const isJudgeAnswer = (
    ans === '正确' ||
    ans === '错误' ||
    ans === '对' ||
    ans === '错' ||
    ans === '√' ||
    ans === '×' ||
    ans === '✓' ||
    ans === '✗' ||
    ans === '✔' ||
    ans === '✘' ||
    ans === '是' ||
    ans === '否' ||
    ans === 'T' ||
    ans === 'F' ||
    ans === 'Y' ||
    ans === 'N' ||
    ans === '1' ||
    ans === '0' ||
    ans.toLowerCase() === 'true' ||
    ans.toLowerCase() === 'false' ||
    ans.toLowerCase() === 'yes' ||
    ans.toLowerCase() === 'no' ||
    ans === '正确。' ||
    ans === '错误。' ||
    /^[是对正确√✓✔]\s*[。.．]?$/.test(ans) ||
    /^[否错错误×✗✘]\s*[。.．]?$/.test(ans)
  );
  // 答案明确是判断题答案 → 优先判为判断题（不管选项多少）
  if (isJudgeAnswer && optionCount <= 4) return 'judge';
  // 没有选项 → 简答（排除判断后）
  if (optionCount === 0) return 'short';
  // 多选：答案含多个字母
  const letters = ans.toUpperCase().match(/[A-H]/g);
  if (letters && letters.length >= 2) return 'multiple';
  // 单选：答案是单个字母
  if (letters && letters.length === 1) return 'single';
  // 其他情况，按选项数量判断
  if (optionCount >= 2) return 'single';
  return 'short';
}

/** 按列映射把一行转成题目 */
function rowToQuestion(
  row: Record<string, string>,
  mapping: Partial<Record<TargetField, string>>,
): {
  q: Omit<IQuestion, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'bankId'> | null;
  error?: string;
} {
  const getVal = (field: TargetField): string => {
    const col = mapping[field];
    if (!col) return '';
    const v = row[col];
    if (v === undefined || v === null) return '';
    return String(v).trim();
  };

  // 题干必填
  const question = getVal('question');
  if (!question) {
    return { q: null, error: '题干为空' };
  }

  // 答案必填
  const answerStr = getVal('answer');
  if (!answerStr) {
    return { q: null, error: '正确答案为空' };
  }

  // 收集选项
  const optionFields: TargetField[] = [
    'optionA',
    'optionB',
    'optionC',
    'optionD',
    'optionE',
    'optionF',
    'optionG',
    'optionH',
    'optionI',
  ];
  const options: string[] = [];
  for (const f of optionFields) {
    const v = getVal(f);
    if (v) options.push(v);
  }

  // 题型：先看用户映射的列，没有就自动识别
  let type: QuestionType | null = null;
  const typeStr = getVal('type');
  if (typeStr) {
    type = parseType(typeStr);
  }
  if (!type) {
    type = autoDetectType(answerStr, options.length);
  }

  // 单选/多选至少 2 个选项
  if ((type === 'single' || type === 'multiple') && options.length < 2) {
    // 兜底：如果选项不足但答案像判断题，自动纠正题型为判断
    const ansIsJudge =
      answerStr === '正确' || answerStr === '错误' ||
      answerStr === '对' || answerStr === '错' ||
      answerStr === '√' || answerStr === '×' ||
      answerStr === '✓' || answerStr === '✗' ||
      answerStr === '是' || answerStr === '否' ||
      answerStr.toLowerCase() === 'true' || answerStr.toLowerCase() === 'false' ||
      answerStr === 'T' || answerStr === 'F' ||
      answerStr === '1' || answerStr === '0';
    if (ansIsJudge) {
      type = 'judge';
    } else {
      return {
        q: null,
        error: `题型为「${QUESTION_TYPE_LABELS[type]}」但有效选项不足 2 个`,
      };
    }
  }

  const answer = parseAnswer(answerStr, type);

  const analysis = getVal('analysis');
  const subject = getVal('subject');
  const chapter = getVal('chapter');
  const difficultyStr = getVal('difficulty');
  const difficulty = parseDifficulty(difficultyStr);

  return {
    q: {
      type,
      question,
      options,
      answer,
      analysis,
      subject: subject || '未分类',
      chapter: chapter || '未分类',
      difficulty,
    },
  };
}

/** 智能推荐列映射：根据列名猜测对应字段 */
function suggestMapping(columns: string[]): Partial<Record<TargetField, string>> {
  const mapping: Partial<Record<TargetField, string>> = {};

  /**
   * 为每个选项字母生成所有可能的列名模式
   * 支持：选项A / A选项 / A / A选项： / 第1个选项 / 第一选项 / a / (A) / 【A】
   */
  const optionPatterns = (letter: string, ordinal: number): RegExp[] => {
    const upper = letter.toUpperCase();
    const lower = letter.toLowerCase();
    const cnOrdinals = ['一', '二', '三', '四', '五', '六', '七', '八'];
    const cnOrd = cnOrdinals[ordinal - 1] || '';
    return [
      new RegExp(`^\\s*选项\\s*[${upper}${lower}]\\s*[：:、.．)）】]?\\s*$`, 'i'),
      new RegExp(`^\\s*[${upper}${lower}]\\s*选项?\\s*[：:、.．)）】]?\\s*$`, 'i'),
      new RegExp(`^\\s*[${upper}${lower}]\\s*[、.．:：)）】]\\s*`),
      new RegExp(`^\\s*[（(【\[]\\s*[${upper}${lower}]\\s*[)）\]】]\\s*`),
      new RegExp(`^\\s*第\\s*${ordinal}\\s*[个项题]?\\s*(选项|选择|答案)?`, 'i'),
      ...(cnOrd ? [
        new RegExp(`^\\s*第\\s*${cnOrd}\\s*[个项题]?\\s*(选项|选择|答案)?`, 'i'),
      ] : []),
      new RegExp(`^\\s*opt(ion)?\\s*[._\\-]?\\s*[${upper}${lower}]\\s*$`, 'i'),
      new RegExp(`^\\s*choice\\s*[._\\-]?\\s*[${upper}${lower}]\\s*$`, 'i'),
      // 纯单个大写字母（A/B/C/D...），自动匹配为对应选项列
      new RegExp(`^\\s*[${upper}]\\s*$`),
    ];
  };

  const rules: { field: TargetField; patterns: RegExp[]; priority?: number }[] = [
    {
      field: 'question',
      patterns: [
        /^\s*题干\s*[：:]?\s*$/i,
        /^\s*题目\s*[：:]?\s*$/i,
        /^\s*问题\s*[：:]?\s*$/i,
        /^\s*题目内容\s*[：:]?\s*$/i,
        /^\s*question\s*$/i,
        /^\s*题目描述/, /^\s*题干内容/, /^\s*试题\s*[：:]?\s*$/i,
        /^\s*题目正文/, /^\s*内容\s*[：:]?\s*$/i,
      ],
    },
    {
      field: 'answer',
      patterns: [
        /^\s*正确答案\s*[：:]?\s*$/i,
        /^\s*标准答案\s*[：:]?\s*$/i,
        /^\s*答案\s*[：:]?\s*$/i,
        /^\s*参考答案?\s*[：:]?\s*$/i,
        /^\s*answer\s*$/i,
        /^\s*正确选项?\s*[：:]?\s*$/i,
        /^\s*答\s*[：:]\s*/i,
      ],
    },
    {
      field: 'type',
      patterns: [
        /^\s*题型\s*[：:]?\s*$/i, /^\s*题目类型\s*[：:]?\s*$/i,
        /^\s*type\s*$/i, /^\s*题型分类/, /^\s*题目分类/,
        /^\s*题目种类/, /^\s*类别\s*[：:]?\s*$/i,
      ],
    },
    {
      field: 'analysis',
      patterns: [
        /^\s*解析\s*[：:]?\s*$/i, /^\s*答案解析\s*[：:]?\s*$/i,
        /^\s*题目解析\s*[：:]?\s*$/i, /^\s*analysis\s*$/i,
        /^\s*解释\s*[：:]?\s*$/i, /^\s*详细解析/,
        /^\s*解题思路/, /^\s*题目讲解/, /^\s*参考解析/,
      ],
    },
    {
      field: 'subject',
      patterns: [
        /^\s*学科\s*[：:]?\s*$/i, /^\s*科目\s*[：:]?\s*$/i,
        /^\s*分类\s*[：:]?\s*$/i, /^\s*subject\s*$/i,
        /^\s*课程\s*[：:]?\s*$/i, /^\s*专业\s*[：:]?\s*$/i,
      ],
    },
    {
      field: 'chapter',
      patterns: [
        /^\s*章节\s*[：:]?\s*$/i, /^\s*章\s*[：:]?\s*$/i,
        /^\s*单元\s*[：:]?\s*$/i, /^\s*chapter\s*$/i,
        /^\s*节\s*[：:]?\s*$/i, /^\s*篇章\s*[：:]?\s*$/i,
        /^\s*模块\s*[：:]?\s*$/i, /^\s*部分\s*[：:]?\s*$/i,
      ],
    },
    {
      field: 'difficulty',
      patterns: [
        /^\s*难度\s*[：:]?\s*$/i, /^\s*难度等级\s*[：:]?\s*$/i,
        /^\s*difficulty\s*$/i, /^\s*难易度\s*[：:]?\s*$/i,
        /^\s*难度系数/, /^\s*星级\s*[：:]?\s*$/i,
        /^\s*难度级别/,
      ],
    },
    { field: 'optionA', patterns: optionPatterns('A', 1) },
    { field: 'optionB', patterns: optionPatterns('B', 2) },
    { field: 'optionC', patterns: optionPatterns('C', 3) },
    { field: 'optionD', patterns: optionPatterns('D', 4) },
    { field: 'optionE', patterns: optionPatterns('E', 5) },
    { field: 'optionF', patterns: optionPatterns('F', 6) },
    { field: 'optionG', patterns: optionPatterns('G', 7) },
    { field: 'optionH', patterns: optionPatterns('H', 8) },
    { field: 'optionI', patterns: optionPatterns('I', 9) },
  ];

  // 按匹配优先级排序：题干/答案等关键字段优先匹配，避免被短规则抢走
  const priorityOrder: TargetField[] = [
    'question', 'answer', 'analysis', 'type',
    'subject', 'chapter', 'difficulty',
    'optionA', 'optionB', 'optionC', 'optionD',
    'optionE', 'optionF', 'optionG', 'optionH', 'optionI',
  ];

  for (const field of priorityOrder) {
    const rule = rules.find((r) => r.field === field);
    if (!rule) continue;
    for (const col of columns) {
      const colTrim = col.trim();
      if (rule.patterns.some((p) => p.test(colTrim))) {
        const alreadyUsed = Object.values(mapping);
        if (!alreadyUsed.includes(col)) {
          mapping[field] = col;
          break;
        }
      }
    }
  }

  return mapping;
}

export default function QuestionImportDialog({
  onImport,
  trigger,
}: QuestionImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('excel');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Excel 解析后的所有 sheet 数据
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [mergeSheets, setMergeSheets] = useState(false);
  // 当前正在预览/操作的 sheet 索引（mapping 和 preview 阶段用）
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);

  // 步骤：upload → sheets → mapping → preview → result
  const [step, setStep] = useState<'upload' | 'sheets' | 'header' | 'mapping' | 'preview' | 'result'>(
    'upload',
  );
  const [result, setResult] = useState<ImportResult | null>(null);

  // 导入进度
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, sheetName: '' });

  // 导入错误确认对话框
  const [errorConfirmOpen, setErrorConfirmOpen] = useState(false);
  const [errorPreviewCount, setErrorPreviewCount] = useState({ failed: 0, total: 0 });

  // 当前激活 sheet 的便捷访问
  const activeSheet = sheets[activeSheetIdx] || null;
  const rawRows = activeSheet?.rawRows || [];
  const columns = activeSheet?.columns || [];
  const mapping = activeSheet?.mapping || {};
  const importTitle = activeSheet?.bankName || '';

  // 选中的 sheet 数量
  const selectedSheets = sheets.filter((s) => s.selected);
  const totalRowsAllSheets = sheets.reduce((sum, s) => sum + s.rawRows.length, 0);

  // 文档导入相关
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docExtracting, setDocExtracting] = useState(false);
  const [docText, setDocText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 根据列名数组计算“表头相似度”分数：匹配越多标准字段，分越高 */
  const scoreHeaderRow = useCallback((cells: string[]): number => {
    const nonEmpty = cells.filter((c) => c && c.trim() !== '');
    if (nonEmpty.length < 2) return 0;
    let score = 0;
    for (const cell of nonEmpty) {
      const c = cell.trim();
      // 题干/题目/问题
      if (/^(题干|题目|问题|question)/i.test(c)) score += 10;
      // 答案
      else if (/^(正确答案|标准答案|答案|参考答案|answer)/i.test(c)) score += 10;
      // 选项 A-I（含「选项A」「A选项」「A.」「A」等）
      else if (/^(选项\s*[A-I]|[A-I]\s*选项?|[A-I][、.．:：)）】]|第\s*[一二三四五六七八]\s*[个项题]?\s*(选项|选择)?)/i.test(c)) score += 3;
      // 题型/类型
      else if (/^(题型|题目类型|type|题目种类|类别)/i.test(c)) score += 5;
      // 解析
      else if (/^(解析|答案解析|题目解析|analysis|解释|详细解析)/i.test(c)) score += 4;
      // 学科/章节/难度
      else if (/^(学科|科目|分类|subject|课程|专业)/i.test(c)) score += 2;
      else if (/^(章节|章|单元|chapter|节|篇章|模块|部分)/i.test(c)) score += 2;
      else if (/^(难度|难度等级|difficulty|难易度|星级|难度级别)/i.test(c)) score += 2;
    }
    // 纯数字行（比如题号）扣分
    const numberCells = nonEmpty.filter((c) => /^\d+$/.test(c.trim())).length;
    if (numberCells >= nonEmpty.length * 0.6) score -= 20;
    return score;
  }, []);

  /** 从 allRows 中自动猜测最像表头的行索引 */
  const autoDetectHeaderRow = useCallback((rows: string[][]): number => {
    // 只扫描前 10 行，表头一般在最前面
    const scanEnd = Math.min(rows.length, 10);
    let bestIdx = 0;
    let bestScore = 0;
    for (let i = 0; i < scanEnd; i++) {
      const score = scoreHeaderRow(rows[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    // 如果最高分很低（没有明显表头特征），默认第0行
    return bestScore > 5 ? bestIdx : 0;
  }, [scoreHeaderRow]);

  /** 从指定 headerRowIdx 重建 columns / rawRows / mapping / bankName */
  const rebuildFromHeaderRow = useCallback((
    allRows: string[][],
    headerRowIdx: number,
    sheetName: string,
  ): { columns: string[]; rawRows: Record<string, string>[]; mapping: Partial<Record<TargetField, string>>; bankName: string } | null => {
    if (headerRowIdx < 0 || headerRowIdx >= allRows.length) return null;

    const headerRow = allRows[headerRowIdx];
    const colList = headerRow.filter((c) => c && c.trim() !== '');
    const colIndices: number[] = [];
    headerRow.forEach((c, i) => {
      if (c && c.trim() !== '') colIndices.push(i);
    });

    if (colList.length === 0) return null;

    // 题库名：如果 headerRowIdx > 0，尝试取上一行第一列作为题库名
    let bankName = sheetName;
    if (headerRowIdx > 0) {
      for (let r = headerRowIdx - 1; r >= 0; r--) {
        const firstCell = allRows[r]?.[0]?.trim();
        if (firstCell && firstCell.length <= 50) {
          bankName = firstCell;
          break;
        }
      }
    }

    const json: Record<string, string>[] = [];
    for (let r = headerRowIdx + 1; r < allRows.length; r++) {
      const row = allRows[r];
      if (!row || row.every((c) => String(c || '').trim() === '')) continue;
      const obj: Record<string, string> = {};
      colIndices.forEach((colIdx, i) => {
        obj[colList[i]] = String(row[colIdx] || '').trim();
      });
      json.push(obj);
    }

    if (json.length === 0) return null;

    const mapping = suggestMapping(colList);
    return { columns: colList, rawRows: json, mapping, bankName };
  }, []);

  /** 解析单个 sheet 的二维数组为 SheetData（sheet 数据通用，不依赖具体解析库） */
  const parseSheetAoa = useCallback((
    allRows: string[][],
    sheetName: string,
  ): SheetData | null => {
    if (allRows.length < 2) return null;

    // 智能猜测表头行
    const headerRowIdx = autoDetectHeaderRow(allRows);

    const rebuilt = rebuildFromHeaderRow(allRows, headerRowIdx, sheetName);
    if (!rebuilt) return null;

    return {
      sheetName,
      bankName: rebuilt.bankName,
      allRows,
      headerRowIdx,
      columns: rebuilt.columns,
      rawRows: rebuilt.rawRows,
      mapping: rebuilt.mapping,
      selected: true,
    };
  }, [autoDetectHeaderRow, rebuildFromHeaderRow]);

  /** 解析单个 worksheet 为 SheetData（SheetJS 方式） */
  const parseSheet = useCallback((
    worksheet: XLSX.WorkSheet,
    sheetName: string,
  ): SheetData | null => {
    const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    const allRows: string[][] = aoa.map((row) => row.map((c) => String(c || '').trim()));
    return parseSheetAoa(allRows, sheetName);
  }, [parseSheetAoa]);

  /** 解析 Excel 并进入 sheet 选择步骤
   * 主链路用 SheetJS，失败时自动降级用 ExcelJS 尝试解析，两个都失败才给用户友好提示
   */
  const handleExcelFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('请选择 Excel 文件（.xlsx / .xls / .csv）');
      return;
    }

     setIsParsing(true);
     setResult(null);
     setSheets([]);
     setActiveSheetIdx(0);
     setMergeSheets(false);
     setExcelFileName(file.name.replace(/\.(xlsx|xls|csv)$/i, ''));

    const isXlsx = /\.xlsx$/i.test(file.name);
    let parseError: Error | null = null;

    try {
      // === 方案1: SheetJS 解析 ===
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetNames = workbook.SheetNames;

      const parsedSheets: SheetData[] = [];
      for (const name of sheetNames) {
        const ws = workbook.Sheets[name];
        const parsed = parseSheet(ws, name);
        if (parsed) parsedSheets.push(parsed);
      }

      if (parsedSheets.length === 0) {
        toast.error('未读取到任何有效题目数据，请检查 Excel 格式');
        setIsParsing(false);
        return;
      }

      setSheets(parsedSheets);
      setActiveSheetIdx(0);
      setIsParsing(false);

      if (parsedSheets.length === 1) {
        setStep('header');
      } else {
        setStep('sheets');
      }
      return;
    } catch (err) {
      parseError = err as Error;
      // SheetJS 失败，继续尝试 ExcelJS（仅 xlsx 格式）
    }

    // === 方案2: ExcelJS 降级解析（仅 xlsx 格式） ===
    if (isXlsx) {
      try {
        const buf = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buf);

        const parsedSheets: SheetData[] = [];
        workbook.eachSheet((worksheet) => {
          const aoa = excelJsSheetToAoa(worksheet);
          const parsed = parseSheetAoa(aoa, worksheet.name);
          if (parsed) parsedSheets.push(parsed);
        });

        if (parsedSheets.length > 0) {
          setSheets(parsedSheets);
          setActiveSheetIdx(0);
          setIsParsing(false);

          if (parsedSheets.length === 1) {
            setStep('header');
          } else {
            setStep('sheets');
          }
          toast.info('已使用备用解析器读取文件，建议用 WPS/Office 另存为标准 .xlsx 格式以获得最佳效果');
          return;
        }
      } catch {
        // ExcelJS 也失败，走统一错误提示
      }
    }

    // === 全部失败：友好提示 ===
    const msg = parseError?.message || '';
    const isCompressError = msg.includes('Bad compressed size') || msg.includes('zip') || msg.includes('corrupt');
    const hintLines = [
      '解析文件失败，请尝试以下方法：',
      '1. 用 WPS 或 Office 打开文件，选择「另存为」→ 标准 .xlsx 格式后再上传',
      '2. 如文件为 .xls 旧格式，请另存为 .xlsx 格式',
      '3. 检查文件是否已损坏或被加密',
    ];
    if (isCompressError) {
      hintLines.unshift('该文件使用了特殊压缩格式，前端解析器无法直接读取。');
    }
    toast.error(hintLines.join('\n'), {
      duration: 8000,
    });
    setIsParsing(false);
  }, [parseSheet, parseSheetAoa]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (activeTab === 'excel') {
        handleExcelFile(file);
      } else {
        setDocFile(file);
        setDocText('');
      }
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (activeTab === 'excel') {
        handleExcelFile(file);
      } else {
        setDocFile(file);
        setDocText('');
      }
    }
  };

  /** 预览（校验映射 + 生成预览数据） */
  const previewQuestions = useMemo(() => {
    if (step !== 'preview' && step !== 'result') return [];
    if (!mapping.question || !mapping.answer) return [];
    const preview = rawRows.slice(0, 10).map((row, idx) => ({
      rowIndex: idx + 2,
      ...rowToQuestion(row, mapping),
    }));
    return preview;
  }, [step, mapping, rawRows]);

  /** 切换单个 sheet 选中状态 */
  const toggleSheetSelected = (idx: number) => {
    setSheets((prev) => prev.map((s, i) => (i === idx ? { ...s, selected: !s.selected } : s)));
  };

  /** 全选/全不选 */
  const toggleAllSheets = (selected: boolean) => {
    setSheets((prev) => prev.map((s) => ({ ...s, selected })));
  };

  /** 从 sheet 选择页进入标题行选择 */
  const goFromSheets = () => {
    const selected = sheets.filter((s) => s.selected);
    if (selected.length === 0) {
      toast.error('请至少选择一个 Sheet');
      return;
    }
    // 跳到第一个选中 sheet 的标题行选择步骤
    const firstIdx = sheets.findIndex((s) => s.selected);
    setActiveSheetIdx(firstIdx);
    setStep('header');
  };

  /** 从标题行选择进入下一步（映射，或若自动识别完全则预览） */
  const goFromHeader = () => {
    const s = sheets[activeSheetIdx];
    if (!s) return;
    if (s.columns.length === 0) {
      toast.error('当前标题行没有识别到任何列名，请重新选择');
      return;
    }
    if (s.mapping.question && s.mapping.answer) {
      setStep('preview');
    } else {
      setStep('mapping');
    }
  };

  /** 修改当前 sheet 的标题行索引并重建数据 */
  const changeHeaderRow = (rowIdx: number) => {
    setSheets((prev) => prev.map((s, i) => {
      if (i !== activeSheetIdx) return s;
      const rebuilt = rebuildFromHeaderRow(s.allRows, rowIdx, s.sheetName);
      if (!rebuilt) return s;
      return {
        ...s,
        headerRowIdx: rowIdx,
        columns: rebuilt.columns,
        rawRows: rebuilt.rawRows,
        mapping: rebuilt.mapping,
        bankName: rebuilt.bankName,
      };
    }));
  };

  /** 更新当前 sheet 的列映射 */
  const updateCurrentMapping = (updater: (prev: Partial<Record<TargetField, string>>) => Partial<Record<TargetField, string>>) => {
    setSheets((prev) => prev.map((s, i) => {
      if (i !== activeSheetIdx) return s;
      return { ...s, mapping: updater(s.mapping) };
    }));
  };

  /** 更新当前 sheet 的题库名 */
  const updateCurrentBankName = (name: string) => {
    setSheets((prev) => prev.map((s, i) => {
      if (i !== activeSheetIdx) return s;
      return { ...s, bankName: name };
    }));
  };

  /** 统计预览中各题型数量 */
  const previewStats = useMemo(() => {
    const stats: Record<QuestionType, number> = {
      single: 0,
      multiple: 0,
      judge: 0,
      short: 0,
    };
    previewQuestions.forEach((p) => {
      if (p.q) stats[p.q.type]++;
    });
    return stats;
  }, [previewQuestions]);

  /** 进入预览步骤 */
  const goToPreview = () => {
    if (!mapping.question) {
      toast.error('请至少映射「题干」列');
      return;
    }
    if (!mapping.answer) {
      toast.error('请至少映射「正确答案」列');
      return;
    }
    setStep('preview');
  };

  /** 返回上一步 */
  const handlePrev = () => {
    if (step === 'preview') {
      setStep('mapping');
    } else if (step === 'mapping') {
      setStep('header');
    } else if (step === 'header') {
      if (sheets.length > 1) {
        setStep('sheets');
      } else {
        setStep('upload');
      }
    } else if (step === 'sheets') {
      setStep('upload');
    }
  };

  /** 预统计所有选中 sheet 中解析失败的题目数 */
  const previewErrorCount = useCallback(() => {
    const selected = sheets.filter((s) => s.selected);
    let failed = 0;
    let total = 0;
    for (const sheet of selected) {
      const rows = sheet.rawRows;
      total += rows.length;
      for (let r = 0; r < rows.length; r++) {
        const { q } = rowToQuestion(rows[r], sheet.mapping);
        if (!q) failed++;
      }
    }
    return { failed, total };
  }, [sheets]);

  /** 确认导入：先预检查错误，有错误则弹确认；确认后执行真正导入 */
  const confirmImport = async () => {
    const selected = sheets.filter((s) => s.selected);
    const total = selected.reduce((sum, s) => sum + s.rawRows.length, 0);

    if (total === 0) {
      toast.error('没有可导入的题目');
      return;
    }

    // 预统计错误数
    const { failed } = previewErrorCount();
    if (failed > 0) {
      setErrorPreviewCount({ failed, total });
      setErrorConfirmOpen(true);
      return;
    }

    // 没有错误，直接执行导入
    await doImport(false);
  };

  /** 真正执行导入（skipOnError=true 时跳过错误继续，false 时遇到错误终止） */
  const doImport = async (skipOnError: boolean) => {
    const BATCH_SIZE = 200; // 每批处理 200 题，让出主线程避免卡死
    const selected = sheets.filter((s) => s.selected);
    const total = selected.reduce((sum, s) => sum + s.rawRows.length, 0);

    if (total === 0) {
      toast.error('没有可导入的题目');
      return;
    }

    const mergedBankName = excelFileName || '导入题库';

    let totalSuccess = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];
    const byType: Record<QuestionType, number> = { single: 0, multiple: 0, judge: 0, short: 0 };
    const bankResults: { bankName: string; success: number; failed: number }[] = [];
    let terminated = false;

    setImportProgress({ current: 0, total, sheetName: mergeSheets ? mergedBankName : selected[0]?.bankName || '' });
    setIsParsing(true);

    let processed = 0;

    if (mergeSheets) {
      // 合并模式：所有 Sheet 的题目放到同一个题库
      const allQuestions: Omit<IQuestion, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'bankId'>[] = [];

      for (const sheet of selected) {
        if (terminated) break;
        setImportProgress((prev) => ({ ...prev, sheetName: `${mergedBankName} · ${sheet.sheetName}` }));

        const rows = sheet.rawRows;

        // 分批处理
        for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
          if (terminated) break;
          const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
          for (let r = batchStart; r < batchEnd; r++) {
            const { q, error } = rowToQuestion(rows[r], sheet.mapping);
            if (q) {
              allQuestions.push(q);
              byType[q.type]++;
            } else {
              const errMsg = `[${sheet.sheetName}] 第 ${r + 2} 行：${error}`;
              allErrors.push(errMsg);
              if (!skipOnError) {
                // 终止导入
                terminated = true;
                break;
              }
            }
          }
          if (!terminated) {
            processed += (batchEnd - batchStart);
            setImportProgress({ current: processed, total, sheetName: `${mergedBankName} · ${sheet.sheetName}` });
            // 让出主线程，避免页面卡死
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
      }

      // 统一入库为一个题库（只入库成功的）
      if (allQuestions.length > 0) {
        const count = onImport(allQuestions, mergedBankName);
        totalSuccess += count;
      }
      totalFailed = allErrors.length;
      bankResults.push({ bankName: mergedBankName, success: totalSuccess, failed: totalFailed });
    } else {
      // 独立模式：每个 sheet 一个独立题库
      for (const sheet of selected) {
        if (terminated) break;
        setImportProgress((prev) => ({ ...prev, sheetName: sheet.bankName }));

        const sheetQuestions: Omit<IQuestion, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'bankId'>[] = [];
        const sheetErrors: string[] = [];
        const rows = sheet.rawRows;

        // 分批处理
        for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
          if (terminated) break;
          const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
          for (let r = batchStart; r < batchEnd; r++) {
            const { q, error } = rowToQuestion(rows[r], sheet.mapping);
            if (q) {
              sheetQuestions.push(q);
              byType[q.type]++;
            } else {
              const errMsg = `[${sheet.bankName}] 第 ${r + 2} 行：${error}`;
              sheetErrors.push(errMsg);
              if (allErrors.length < 50) allErrors.push(errMsg);
              if (!skipOnError) {
                terminated = true;
                break;
              }
            }
          }
          if (!terminated) {
            processed += (batchEnd - batchStart);
            setImportProgress({ current: processed, total, sheetName: sheet.bankName });
            // 让出主线程，避免页面卡死
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }

        // 一个 sheet 一个独立题库
        if (sheetQuestions.length > 0) {
          const count = onImport(sheetQuestions, sheet.bankName);
          totalSuccess += count;
        }
        const sheetFailed = sheetErrors.length;
        totalFailed += sheetFailed;
        bankResults.push({ bankName: sheet.bankName, success: sheetQuestions.length, failed: sheetFailed });
      }
    }

    setResult({ success: totalSuccess, failed: totalFailed, errors: allErrors, byType, bankResults });
    setStep('result');
    setIsParsing(false);
    setErrorConfirmOpen(false);
    setImportProgress({ current: 0, total: 0, sheetName: '' });

    if (totalSuccess > 0) {
      const typeSummary = Object.entries(byType)
        .filter(([, n]) => n > 0)
        .map(([t, n]) => `${QUESTION_TYPE_LABELS[t as QuestionType]} ${n}道`)
        .join('、');
      const tip = terminated ? '（部分失败已跳过）' : '';
      toast.success(`成功导入 ${totalSuccess} 道题（${typeSummary}）${tip}`);
    } else {
      toast.error(terminated ? '导入已终止，未成功导入任何题目' : '未成功导入任何题目，请检查列映射是否正确');
    }
  };

  const handleDocExtract = async () => {
    if (!docFile) return;
    setDocExtracting(true);
    try {
      const { capabilityClient } = await import('@lark-apaas/client-toolkit-lite');
      toast.info('正在解析文档，请稍候...');
      const result = await capabilityClient
        .load('doc-parser-import')
        .call('parseDocToMarkdown', {
          fileUrl: [docFile],
        } as any);
      const content = (result as any)?.content || '';
      setDocText(content);
      if (content) {
        toast.success('文档解析成功');
      } else {
        toast.warning('未提取到文本内容');
      }
    } catch {
      toast.error('文档解析插件暂不可用，请使用 Excel 导入');
    } finally {
      setDocExtracting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep('upload');
    setResult(null);
    setSheets([]);
    setActiveSheetIdx(0);
    setImportProgress({ current: 0, total: 0, sheetName: '' });
    setDocFile(null);
    setDocText('');
    setActiveTab('excel');
  };

  const handleTabChange = (v: string) => {
    setActiveTab(v);
    setStep('upload');
    setSheets([]);
    setActiveSheetIdx(0);
    setResult(null);
  };

  const groupedTargetFields = useMemo(() => {
    const groups: Record<string, typeof TARGET_FIELDS> = {
      必填: [],
      选项: [],
      可选: [],
    };
    TARGET_FIELDS.forEach((f) => {
      groups[f.group].push(f);
    });
    return groups;
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
        else setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Upload className="mr-2 size-4" />
            导入题库
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>导入题库</DialogTitle>
         <DialogDescription>
             {step === 'upload' && '支持 Excel / PDF / Word 多种格式导入'}
             {step === 'sheets' && `识别到 ${sheets.length} 个 Sheet，请选择要导入的题库`}
             {step === 'header' && '请选择哪一行是列标题（表头）'}
             {step === 'mapping' && `已识别 ${columns.length} 列，请配置列映射关系`}
             {step === 'preview' && `共 ${rawRows.length} 道题，以下为前 10 道预览`}
             {step === 'result' && '导入完成'}
           </DialogDescription>
        </DialogHeader>

         {/* 步骤指示器 */}
         {activeTab === 'excel' && step !== 'upload' && step !== 'sheets' && step !== 'header' && (
           <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
             <span
               className={`flex items-center gap-1 ${
                 step === 'mapping' ? 'text-primary font-medium' : ''
               }`}
             >
               <Settings2 className="size-3" />
               列映射
             </span>
             <ArrowRight className="size-3" />
             <span
               className={`flex items-center gap-1 ${
                 step === 'preview' ? 'text-primary font-medium' : ''
               }`}
             >
               <Eye className="size-3" />
               预览确认
             </span>
             <ArrowRight className="size-3" />
             <span
               className={`flex items-center gap-1 ${
                 step === 'result' ? 'text-primary font-medium' : ''
               }`}
             >
               <Check className="size-3" />
               导入结果
             </span>
           </div>
         )}

         {/* 多 Sheet 时显示当前 Sheet 信息 */}
         {activeTab === 'excel' && (step === 'header' || step === 'mapping' || step === 'preview') && sheets.length > 1 && (
           <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
             <div className="flex items-center gap-2 min-w-0">
               <FileSpreadsheet className="size-3.5 shrink-0 text-primary" />
               <span className="text-muted-foreground shrink-0">Sheet {activeSheetIdx + 1}/{selectedSheets.length}：</span>
               <span className="font-medium text-foreground truncate">
                 {activeSheet?.bankName}
               </span>
             </div>
             <div className="flex items-center gap-1">
               <Button
                 variant="ghost"
                 size="sm"
                 className="h-7 px-2 text-xs"
                 onClick={() => {
                   const prev = sheets.findIndex((s, i) => s.selected && i < activeSheetIdx);
                   if (prev >= 0) setActiveSheetIdx(prev);
                 }}
                 disabled={activeSheetIdx === 0 || !sheets.some((s, i) => s.selected && i < activeSheetIdx)}
               >
                 <ArrowLeft className="size-3" />
                 上一个
               </Button>
               <Button
                 variant="ghost"
                 size="sm"
                 className="h-7 px-2 text-xs"
                 onClick={() => {
                   const next = sheets.findIndex((s, i) => s.selected && i > activeSheetIdx);
                   if (next >= 0) setActiveSheetIdx(next);
                 }}
                 disabled={!sheets.some((s, i) => s.selected && i > activeSheetIdx)}
               >
                 下一个
                 <ArrowRight className="size-3" />
               </Button>
             </div>
           </div>
         )}

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full">
              <TabsTrigger value="excel" className="flex-1">
                <FileSpreadsheet className="mr-2 size-4" />
                Excel 导入
              </TabsTrigger>
              <TabsTrigger value="doc" className="flex-1">
                <FileText className="mr-2 size-4" />
                文档导入
              </TabsTrigger>
            </TabsList>

            {/* ============ Excel 导入 ============ */}
            <TabsContent value="excel" className="space-y-4 pt-4">
              {/* Step 1: 上传 */}
              {step === 'upload' && (
                <>
                  <p className="text-sm text-muted-foreground">
                    支持任意格式的 Excel 题库，上传后可手动配置列映射关系
                  </p>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                      isDragging
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <FileSpreadsheet className="mb-3 size-10 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      拖拽 Excel 文件到这里
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      或点击下方按钮选择文件（.xlsx / .xls / .csv）
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isParsing}
                    >
                      {isParsing ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 size-4" />
                      )}
                      选择文件
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </div>
                 </>
               )}

               {/* Step 1.5: Sheet 选择（多 sheet 时出现） */}
               {step === 'sheets' && (
                 <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <div className="text-sm text-muted-foreground">
                       共识别到 <span className="font-medium text-foreground">{sheets.length}</span> 个 Sheet
                       ，已选 <span className="font-medium text-foreground">{selectedSheets.length}</span> 个
                       ，共 <span className="font-medium text-foreground">{selectedSheets.reduce((s, x) => s + x.rawRows.length, 0)}</span> 道题
                     </div>
                     <div className="flex items-center gap-2">
                       <Button
                         variant="ghost"
                         size="sm"
                         className="h-7 text-xs"
                         onClick={() => toggleAllSheets(true)}
                       >
                         全选
                       </Button>
                       <Button
                         variant="ghost"
                         size="sm"
                         className="h-7 text-xs"
                         onClick={() => toggleAllSheets(false)}
                       >
                         全不选
                       </Button>
                     </div>
                   </div>

                    <div className="space-y-2">
                      {sheets.map((s, idx) => (
                        <div
                          key={idx}
                          className={
                            'flex items-center gap-3 rounded-xl border p-3 transition-colors ' +
                            (s.selected ? 'border-primary/40 bg-primary/5' : 'border-border bg-card')
                          }
                        >
                          <Checkbox
                            checked={s.selected}
                            onCheckedChange={() => toggleSheetSelected(idx)}
                            className="size-4 shrink-0"
                          />
                          <FileSpreadsheet className="size-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate">
                                {s.bankName}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Sheet: {s.sheetName} · {s.rawRows.length} 道题 · {s.columns.length} 列
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {s.rawRows.length} 题
                          </Badge>
                        </div>
                      ))}
                    </div>

                    {/* 合并选项 */}
                    <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
                      <Checkbox
                        id="merge-sheets"
                        checked={mergeSheets}
                        onCheckedChange={(v) => setMergeSheets(!!v)}
                        className="size-4 shrink-0 mt-0.5"
                      />
                      <label htmlFor="merge-sheets" className="text-xs text-foreground cursor-pointer">
                        <div className="font-medium">合并所有 Sheet 到同一个题库</div>
                        <div className="text-muted-foreground mt-0.5">
                          勾选后，所有选中 Sheet 的题目将合并到一个题库中，题库名为「{excelFileName || '导入题库'}」
                        </div>
                      </label>
                    </div>

                   <div className="rounded-lg bg-accent/30 p-3 text-xs text-accent-foreground">
                      <span className="font-medium">说明：</span>
                      默认每个 Sheet 作为独立题库导入；勾选「合并到同一个题库」可将所有选中 Sheet 的题目合并入库。每个 Sheet 可在下一步单独配置标题行和列映射。
                    </div>
                 </div>
               )}

 
               {/* Step 2: 选择标题行 */}
               {step === 'header' && activeSheet && (
                 <div className="space-y-4">
                   <div className="rounded-lg bg-accent/30 p-3 text-xs text-accent-foreground">
                     <span className="font-medium">提示：</span>
                     请选择哪一行是列标题行（含题干/答案/选项等列名）。系统已自动猜测最可能的一行（绿色高亮），你可以点击任意一行来修改。标题行的下一行将作为第一道题目开始读取。
                   </div>

                   <div className="rounded-xl border overflow-hidden">
                     <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                       前 {Math.min(activeSheet.allRows.length, 10)} 行预览
                       <span className="ml-2 text-muted-foreground/70">
                         （共 {activeSheet.allRows.length} 行）
                       </span>
                     </div>
                     <div className="max-h-[55vh] overflow-auto">
                       <table className="w-full text-xs">
                         <tbody>
                           {activeSheet.allRows.slice(0, 10).map((row, rowIdx) => {
                             const isHeader = rowIdx === activeSheet.headerRowIdx;
                             const nonEmptyCells = row.filter((c) => c && c.trim() !== '').length;
                             // 只展示前 8 列，避免太宽
                             const displayCells = row.slice(0, 8);
                             return (
                               <tr
                                 key={rowIdx}
                                 onClick={() => changeHeaderRow(rowIdx)}
                                 className={
                                   'cursor-pointer border-b border-border/50 transition-colors ' +
                                   (isHeader
                                     ? 'bg-primary/10 hover:bg-primary/15'
                                     : 'hover:bg-muted/40')
                                 }
                               >
                                 <td className="w-10 shrink-0 border-r border-border/50 px-2 py-2 text-center text-muted-foreground bg-muted/30">
                                   {isHeader && <span className="text-primary font-bold">▶</span>}
                                   {!isHeader && <span>第{rowIdx + 1}行</span>}
                                   {isHeader && <span className="ml-1 text-primary font-medium">标题行</span>}
                                 </td>
                                 {displayCells.map((cell, ci) => (
                                   <td
                                     key={ci}
                                     className={
                                       'px-2 py-1.5 align-top ' +
                                       (isHeader ? 'font-medium text-foreground' : 'text-foreground/80')
                                     }
                                   >
                                     <span className="line-clamp-2">
                                       {cell || <span className="text-muted-foreground/50">（空）</span>}
                                     </span>
                                   </td>
                                 ))}
                                 {row.length > 8 && (
                                   <td className="px-2 py-1.5 text-muted-foreground">
                                     +{row.length - 8} 列
                                   </td>
                                 )}
                               </tr>
                             );
                           })}
                         </tbody>
                       </table>
                     </div>
                   </div>

                   <div className="flex items-center justify-between rounded-xl border bg-card p-3">
                     <div className="text-sm">
                       <span className="text-muted-foreground">已识别列数：</span>
                       <span className="font-medium text-foreground">{activeSheet.columns.length} 列</span>
                       <span className="mx-2 text-muted-foreground">·</span>
                       <span className="text-muted-foreground">题目数：</span>
                       <span className="font-medium text-foreground">{activeSheet.rawRows.length} 道</span>
                     </div>
                   </div>
                 </div>
               )}

               {/* Step 3: 列映射 */}
              {step === 'mapping' && (
                 <div className="space-y-5">
                   <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
                     <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                       <FileSpreadsheet className="size-4 shrink-0 text-primary" />
                       <span className="text-muted-foreground shrink-0">题库名称：</span>
                       <Input
                         value={importTitle}
                         onChange={(e) => updateCurrentBankName(e.target.value)}
                         className="h-7 flex-1 min-w-0 text-sm font-medium"
                       />
                     </div>
                     <Badge variant="outline" className="text-xs shrink-0">
                       共 {rawRows.length} 道题
                     </Badge>
                   </div>

                  <div className="flex items-center gap-2 rounded-lg bg-accent/40 p-3 text-xs text-accent-foreground">
                    <Sparkles className="size-4 shrink-0" />
                    <span>
                      已根据列名智能推荐映射，如有误可手动调整。题型列不选时将根据答案自动识别。
                    </span>
                  </div>

                  {(['必填', '选项', '可选'] as const).map((group) => (
                    <div key={group}>
                      <div className="mb-2 text-xs font-medium text-muted-foreground">
                        {group}字段
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {groupedTargetFields[group].map((field) => (
                          <div key={field.key} className="space-y-1">
                            <label className="flex items-center text-xs font-medium">
                              {field.label}
                              {field.required && (
                                <span className="ml-1 text-destructive">*</span>
                              )}
                            </label>
                             <Select
                               value={mapping[field.key] || ''}
                               onValueChange={(val) => {
                                 updateCurrentMapping((prev) => {
                                   const next = { ...prev };
                                   if (val) {
                                     next[field.key] = val;
                                   } else {
                                     delete next[field.key];
                                   }
                                   return next;
                                 });
                               }}
                             >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="选择 Excel 列" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">（不使用）</SelectItem>
                                {columns.map((col) => (
                                  <SelectItem key={col} value={col}>
                                    {col || '(空列名)'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 4: 预览 */}
              {step === 'preview' && (
                <div className="space-y-4">
                  {/* 题型统计 */}
                  <div className="grid grid-cols-4 gap-2">
                    {(['single', 'multiple', 'judge', 'short'] as const).map((t) => (
                      <div
                        key={t}
                        className="rounded-lg border bg-card p-3 text-center"
                      >
                        <div className="text-xs text-muted-foreground">
                          {QUESTION_TYPE_LABELS[t]}
                        </div>
                        <div className="mt-1 text-xl font-bold text-foreground">
                          {previewStats[t]}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 预览列表 */}
                  <div className="space-y-3">
                    {previewQuestions.map((p) => (
                      <div
                        key={p.rowIndex}
                        className={`rounded-xl border p-3 ${
                          p.q ? 'border-border bg-card' : 'border-destructive/40 bg-destructive/5'
                        }`}
                      >
                        <div className="mb-1.5 flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] h-5">
                            第 {p.rowIndex} 行
                          </Badge>
                          {p.q ? (
                            <Badge variant="secondary" className="text-[10px] h-5">
                              {QUESTION_TYPE_LABELS[p.q.type]}
                            </Badge>
                          ) : (
                            <Badge
                              variant="destructive"
                              className="text-[10px] h-5"
                            >
                              解析失败
                            </Badge>
                          )}
                          {p.q && p.q.difficulty > 1 && (
                            <Badge variant="outline" className="text-[10px] h-5">
                              {DIFFICULTY_LABELS[p.q.difficulty]}
                            </Badge>
                          )}
                        </div>
                        {p.q ? (
                          <>
                            <div className="text-sm font-medium line-clamp-2">
                              {p.q.question}
                            </div>
                            {p.q.options.length > 0 && (
                              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                                {p.q.options.slice(0, 4).map((opt, i) => (
                                  <div key={i} className="truncate">
                                    {LETTER_MAP[i]}. {opt}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="mt-2 text-xs text-primary">
                              答案：
                              {Array.isArray(p.q.answer)
                                ? p.q.answer.join('、')
                                : p.q.answer}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-destructive">
                            <AlertCircle className="size-3.5 shrink-0" />
                            {p.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {rawRows.length > 10 && (
                    <div className="text-center text-xs text-muted-foreground">
                      仅展示前 10 道预览，共 {rawRows.length} 道待导入
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: 结果 */}
               {step === 'result' && result && (
                 <div className="space-y-4">
                   {/* 多 sheet 导入时展示分题库明细 */}
                   {result.bankResults && result.bankResults.length > 1 && (
                     <div className="rounded-xl border p-3">
                       <div className="mb-2 text-sm font-medium text-foreground">各题库导入结果</div>
                       <div className="space-y-1.5">
                         {result.bankResults.map((br, i) => (
                           <div key={i} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
                             <div className="flex items-center gap-2 min-w-0">
                               <FileSpreadsheet className="size-3.5 shrink-0 text-primary" />
                               <span className="truncate font-medium text-foreground">{br.bankName}</span>
                             </div>
                             <div className="flex items-center gap-3 shrink-0 tabular-nums">
                               <span className="text-success">✓ {br.success}</span>
                               {br.failed > 0 && <span className="text-destructive">✗ {br.failed}</span>}
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {!result.bankResults || result.bankResults.length <= 1 ? (
                      (mergeSheets ? excelFileName : importTitle) && (
                        <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm text-primary">
                          <FileSpreadsheet className="size-4 shrink-0" />
                          <span className="font-medium">{mergeSheets ? excelFileName : importTitle}</span>
                          <span className="text-primary/70">导入完成</span>
                        </div>
                      )
                    ) : null}

                  <div className="flex items-center gap-4 rounded-xl border p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex size-10 items-center justify-center rounded-full bg-success/10 text-success">
                        <Check className="size-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">成功导入</div>
                        <div className="text-3xl font-bold text-success">
                          {result.success}
                        </div>
                      </div>
                    </div>
                    <div className="h-10 w-px bg-border" />
                    <div className="flex items-center gap-2">
                      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <X className="size-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">失败</div>
                        <div className="text-3xl font-bold text-destructive">
                          {result.failed}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 分题型统计 */}
                  <div className="grid grid-cols-4 gap-2">
                    {(['single', 'multiple', 'judge', 'short'] as const).map((t) => (
                      <div
                        key={t}
                        className="rounded-lg border bg-card p-3 text-center"
                      >
                        <div className="text-xs text-muted-foreground">
                          {QUESTION_TYPE_LABELS[t]}
                        </div>
                        <div className="mt-1 text-xl font-bold text-foreground">
                          {result.byType[t]}
                        </div>
                      </div>
                    ))}
                  </div>

                  {result.errors.length > 0 && (
                    <div className="rounded-xl border p-4">
                      <div className="mb-2 text-sm font-medium text-destructive">
                        失败原因（前 10 条）
                      </div>
                      <div className="max-h-40 space-y-1.5 overflow-y-auto">
                        {result.errors.slice(0, 10).map((err, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-1.5 text-xs text-muted-foreground"
                          >
                            <AlertCircle className="mt-0.5 size-3 shrink-0 text-destructive" />
                            {err}
                          </div>
                        ))}
                        {result.errors.length > 10 && (
                          <div className="text-xs text-muted-foreground">
                            ...还有 {result.errors.length - 10} 条错误
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ============ 文档导入 ============ */}
            <TabsContent value="doc" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                支持导入 PDF / Word 格式的书籍教材，自动提取文本内容（需文档解析插件）
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <FileText className="mb-2 size-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {docFile ? docFile.name : '拖拽或选择 PDF / Word 文件'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={docExtracting}
                >
                  <Upload className="mr-2 size-4" />
                  选择文件
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

              {docFile && (
                <Button className="w-full" onClick={handleDocExtract} disabled={docExtracting}>
                  {docExtracting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  {docExtracting ? '解析中...' : '开始提取文本'}
                </Button>
              )}

              {docText && (
                <div className="rounded-xl border p-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    提取结果预览
                  </div>
                  <div className="max-h-40 overflow-y-auto text-sm leading-relaxed">
                    {docText}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    提示：文档导入后需手动整理为题目格式，建议使用 Excel 导入以获得更好的结构化效果
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

         {/* Footer */}
         <DialogFooter className="flex gap-2 sm:justify-between sm:space-x-0">
           {isParsing && importProgress.total > 0 ? (
             <div className="flex w-full items-center gap-3 text-sm">
               <Loader2 className="size-4 animate-spin text-primary" />
               <div className="flex-1 min-w-0">
                 <div className="text-xs text-muted-foreground">
                   正在导入：{importProgress.sheetName}（{importProgress.current}/{importProgress.total}）
                 </div>
                 <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                   <div
                     className="h-full rounded-full bg-primary transition-all duration-150"
                     style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                   />
                 </div>
               </div>
             </div>
           ) : activeTab === 'excel' && step !== 'upload' && step !== 'result' ? (
             <>
               <Button variant="outline" onClick={handlePrev}>
                 <ArrowLeft className="mr-1 size-4" />
                 上一步
               </Button>
               {step === 'sheets' && (
                 <Button onClick={goFromSheets} disabled={selectedSheets.length === 0}>
                   下一步：选择标题行
                   <ArrowRight className="ml-1 size-4" />
                 </Button>
               )}
               {step === 'header' && (
                 <Button onClick={goFromHeader} disabled={!activeSheet || activeSheet.columns.length === 0}>
                   下一步：配置列映射
                   <ArrowRight className="ml-1 size-4" />
                 </Button>
               )}
               {step === 'mapping' && (
                 <Button onClick={goToPreview}>
                   下一步：预览
                   <ArrowRight className="ml-1 size-4" />
                 </Button>
               )}
               {step === 'preview' && (
                 <Button onClick={confirmImport} disabled={isParsing}>
                   {isParsing ? (
                     <Loader2 className="mr-1 size-4 animate-spin" />
                   ) : (
                     <Check className="mr-1 size-4" />
                   )}
                   确认导入 {selectedSheets.reduce((s, x) => s + x.rawRows.length, 0)} 道
                   {sheets.length > 1 && ` · ${selectedSheets.length}个题库`}
                 </Button>
               )}
             </>
           ) : (
             <Button variant="outline" onClick={handleClose} className="ml-auto">
               {step === 'result' ? '完成' : '关闭'}
             </Button>
           )}
          </DialogFooter>
       </DialogContent>

       {/* 导入错误确认对话框 */}
       <AlertDialog open={errorConfirmOpen} onOpenChange={setErrorConfirmOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle className="flex items-center gap-2">
               <AlertCircle className="size-5 text-destructive" />
               发现 {errorPreviewCount.failed} 道解析失败的题目
             </AlertDialogTitle>
             <AlertDialogDescription className="space-y-2 text-sm">
               <p>
                 共 <span className="font-medium text-foreground">{errorPreviewCount.total}</span> 道题中，有 <span className="font-medium text-destructive">{errorPreviewCount.failed}</span> 道题目解析失败（可能是题干为空、答案缺失、选项不足等原因）。
               </p>
               <p>请选择处理方式：</p>
               <ul className="list-inside list-disc space-y-1 pl-2 text-muted-foreground">
                 <li>跳过错误题目，继续导入剩下的</li>
                 <li>终止导入，返回修改后重试</li>
               </ul>
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel onClick={() => setErrorConfirmOpen(false)}>
              取消导入
             </AlertDialogCancel>
             <AlertDialogAction
               onClick={() => {
                 setErrorConfirmOpen(false);
                 doImport(true);
               }}
             >
               跳过错误继续导入
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     </Dialog>
   );
 }
