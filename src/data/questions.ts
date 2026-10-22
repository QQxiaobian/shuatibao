// EXPORTS: IQuestion, IExam, IExamRecord, MOCK_QUESTIONS, QUESTION_TYPE_LABELS, DIFFICULTY_LABELS

export type QuestionType = 'single' | 'multiple' | 'judge' | 'short';
export type Difficulty = 1 | 2 | 3;

export interface IQuestion {
  id: string;
  /** 题型：single-单选, multiple-多选, judge-判断, short-简答 */
  type: QuestionType;
  /** 题干 */
  question: string;
  /** 选项A-H，最多8个，判断题该字段为空数组 */
  options: string[];
  /** 正确答案：单选为单个字母，多选为字母数组，判断为"对"/"错"，简答为参考答案文本 */
  answer: string | string[];
  /** 答案解析 */
  analysis: string;
  /** 学科 */
  subject: string;
  /** 章节 */
  chapter: string;
  /** 难度：1-简单, 2-中等, 3-困难 */
  difficulty: Difficulty;
  /** 数据来源：mock-示例数据, import-导入, manual-手动添加 */
  source: 'mock' | 'import' | 'manual';
  /** 所属题库 ID */
  bankId: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
}

export interface IQBank {
  id: string;
  /** 题库名称 */
  name: string;
  /** 题库描述 */
  description?: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
}

export interface IExam {
  id: string;
  /** 试卷名称 */
  name: string;
  /** 所属题库 ID */
  bankId: string;
  /** 题目 ID 列表（按顺序） */
  questionIds: string[];
  /** 题型分布统计 */
  typeDistribution: { single: number; multiple: number; judge: number; short: number };
  /** 各题型单题分值 */
  perQuestionScores: { single: number; multiple: number; judge: number; short: number };
  /** 总分数 */
  totalScore: number;
  /** 创建时间戳 */
  createdAt: number;
}

export interface IExamRecord {
  id: string;
  examId: string;
  examName: string;
  /** 用户答案 */
  userAnswers: Record<string, string | string[]>;
  /** 得分 */
  score: number;
  /** 正确率 */
  accuracy: number;
  /** 用时（秒） */
  duration: number;
  /** 完成时间戳 */
  finishedAt: number;
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  short: '简答题',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: '简单',
  2: '中等',
  3: '困难',
};

const now = Date.now();

export const MOCK_QUESTIONS: IQuestion[] = [
  {
    id: 'q1',
    type: 'single',
    question: '在 JavaScript 中，以下哪个方法可以将数组转换为字符串？',
    options: ['toString()', 'toArray()', 'stringify()', 'convert()'],
    answer: 'A',
    analysis: 'toString() 方法可以将数组转换为以逗号分隔的字符串。stringify() 是 JSON 对象的方法，用于将对象转换为 JSON 字符串。',
    subject: '计算机基础',
    chapter: 'JavaScript 基础',
    difficulty: 1,
    source: 'mock',
    bankId: 'bank_mock',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'q2',
    type: 'single',
    question: 'React 中用于管理组件内部状态的 Hook 是？',
    options: ['useEffect', 'useState', 'useContext', 'useRef'],
    answer: 'B',
    analysis: 'useState 是 React 中用于在函数组件中添加状态管理的 Hook。useEffect 用于副作用处理，useContext 用于上下文访问，useRef 用于引用 DOM 或值。',
    subject: '计算机基础',
    chapter: 'React 框架',
    difficulty: 1,
    source: 'mock',
    bankId: 'bank_mock',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'q3',
    type: 'multiple',
    question: '以下哪些是 JavaScript 的基本数据类型？（多选）',
    options: ['String', 'Number', 'Array', 'Boolean', 'Object', 'Undefined'],
    answer: ['A', 'B', 'D', 'F'],
    analysis: 'JavaScript 的基本数据类型包括：String、Number、Boolean、Undefined、Null、Symbol、BigInt。Array 和 Object 属于引用类型（对象类型）。',
    subject: '计算机基础',
    chapter: 'JavaScript 基础',
    difficulty: 2,
    source: 'mock',
    bankId: 'bank_mock',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'q4',
    type: 'multiple',
    question: '以下哪些是 CSS 中的定位方式？（多选）',
    options: ['static', 'relative', 'absolute', 'fixed', 'float', 'sticky'],
    answer: ['A', 'B', 'C', 'D', 'F'],
    analysis: 'CSS position 属性的取值包括：static（默认）、relative、absolute、fixed、sticky。float 是浮动属性，不是定位方式。',
    subject: '计算机基础',
    chapter: 'CSS 样式',
    difficulty: 2,
    source: 'mock',
    bankId: 'bank_mock',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'q5',
    type: 'judge',
    question: 'HTML 是一种编程语言。',
    options: [],
    answer: '错',
    analysis: 'HTML（HyperText Markup Language）是一种标记语言，不是编程语言。它用于描述网页的结构和内容，不具备逻辑运算和流程控制能力。',
    subject: '计算机基础',
    chapter: 'HTML 基础',
    difficulty: 1,
    source: 'mock',
    bankId: 'bank_mock',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'q6',
    type: 'judge',
    question: '在 JavaScript 中，=== 运算符会进行类型转换后再比较值。',
    options: [],
    answer: '错',
    analysis: '=== 是严格相等运算符，不会进行类型转换，只有值和类型都相同时才返回 true。== 是宽松相等运算符，会进行类型转换后再比较。',
    subject: '计算机基础',
    chapter: 'JavaScript 基础',
    difficulty: 2,
    source: 'mock',
    bankId: 'bank_mock',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'q7',
    type: 'short',
    question: '请简述什么是闭包（Closure），并举例说明其应用场景。',
    options: [],
    answer: '闭包是指函数能够访问其词法作用域中的变量，即使函数在其词法作用域之外执行。简单来说，闭包就是"函数+函数声明时的词法环境"的组合。\n\n应用场景：\n1. 数据私有化/封装：使用闭包创建私有变量，避免全局污染\n2. 函数柯里化：利用闭包实现参数的逐步传递\n3. 事件处理回调：事件处理器可以访问外部函数的变量\n4. 模块化：IIFE（立即执行函数表达式）创建模块',
    analysis: '闭包是 JavaScript 中非常重要的概念，理解闭包有助于更好地掌握作用域、内存管理和设计模式。闭包的核心是函数可以"记住"并访问其定义时的词法作用域。',
    subject: '计算机基础',
    chapter: 'JavaScript 进阶',
    difficulty: 3,
    source: 'mock',
    bankId: 'bank_mock',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'q8',
    type: 'single',
    question: 'HTTP 状态码 404 表示什么含义？',
    options: ['服务器内部错误', '请求的资源未找到', '请求成功', '请求被重定向'],
    answer: 'B',
    analysis: 'HTTP 404 Not Found 表示服务器无法找到请求的资源。500 表示服务器内部错误，200 表示请求成功，3xx 系列表示重定向。',
    subject: '计算机基础',
    chapter: '网络基础',
    difficulty: 1,
    source: 'mock',
    bankId: 'bank_mock',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'q9',
    type: 'single',
    question: '在 Git 中，用于查看提交历史记录的命令是？',
    options: ['git status', 'git log', 'git diff', 'git show'],
    answer: 'B',
    analysis: 'git log 用于查看提交历史记录。git status 查看工作区状态，git diff 查看差异，git show 查看某次提交的详细内容。',
    subject: '计算机基础',
    chapter: 'Git 版本控制',
    difficulty: 1,
    source: 'mock',
    bankId: 'bank_mock',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'q10',
    type: 'multiple',
    question: '以下哪些是 React 中的生命周期方法或等效 Hook？（多选）',
    options: ['componentDidMount', 'useEffect', 'componentWillUnmount', 'useMemo', 'render', 'useState'],
    answer: ['A', 'B', 'C', 'E'],
    analysis: 'componentDidMount、componentWillUnmount、render 是类组件的生命周期方法。useEffect 是函数组件中等效于生命周期的 Hook。useMemo 用于性能优化，useState 用于状态管理，它们不属于生命周期方法。',
    subject: '计算机基础',
    chapter: 'React 框架',
    difficulty: 2,
    source: 'mock',
    bankId: 'bank_mock',
    createdAt: now,
    updatedAt: now,
  },
];
