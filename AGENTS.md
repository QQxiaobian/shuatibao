# 自托管刷题小程序 - 需求拆解文档

## 产品概述

- **产品类型**: 题库管理与刷题工具应用
- **场景类型**: <scene_type>prototype-app</scene_type>
- **目标用户**: 自托管刷题用户、备考学习者、培训机构内部使用
- **核心价值**: 纯前端自托管刷题工具，支持 Excel/PDF/Word 题库导入，提供刷题、搜题、组卷、导出全流程能力，数据全部保存在本地，无需后端服务
- **界面语言**: 中文
- **主题偏好**: 浅色（简洁清爽，对标考试宝）
- **导航模式**: 路径导航
- **导航布局**: Topbar（移动端优先，底部 Tab 导航适配手机端使用）

---

## 页面结构总览

> **说明**：单页应用，使用客户端路由切换视图；移动端采用底部 Tab 导航，桌面端顶部导航。核心功能围绕同一份题库数据，按用户任务流拆分页面。

| 页面名称 | 文件名 | 路由 | 页面类型 | 入口来源 |
|---------|-------|------|---------|---------|
| 题库管理 | `LibraryPage.tsx` | `/` | 一级 | 导航 |
| 刷题练习 | `PracticePage.tsx` | `/practice` | 一级 | 导航（刷题页通过参数模式区分顺序/随机/错题/收藏） |
| 搜题 | `SearchPage.tsx` | `/search` | 一级 | 导航 |
| 试卷中心 | `ExamPage.tsx` | `/exam` | 一级 | 导航 |
| 刷题答题页 | `QuizPage.tsx` | `/quiz/:mode` | 二级 | 刷题练习页 → 选择模式后进入 |
| 试卷答题页 | `ExamQuizPage.tsx` | `/exam/:id` | 二级 | 试卷中心页 → 开始考试 |

> **页面精简说明**：
> - 错题本、收藏题目合并到刷题练习页的模式选择中，不单独成页
> - 导入、导出功能合并在题库管理页中操作
> - 单题展示的答题界面复用同一组件，通过 mode 参数区分练习/考试/错题/收藏模式

---

## 页面布局建议

- **布局模式**: 单栏上下流式布局（移动端优先）—— 刷题类工具主要使用场景为手机端竖屏操作，单题居中展示符合考试宝体验
- **视觉重心**: 内容区（题干 + 选项）—— 刷题时题目是绝对核心，操作按钮固定在底部便于拇指点击
- **结果承载区**:
  - 题库管理页：题库列表 + 导入结果统计（成功/失败条数），初始态为空状态引导导入
  - 刷题答题页：答题结果区（判分反馈 + 正确答案 + 解析），选择选项后即时展开
  - 搜题页：搜索结果列表，初始态为热门搜索/搜索历史
  - 试卷中心页：已生成试卷列表 + 试卷预览，初始态为空状态引导组卷

---

## 插件规划

| 插件实例名称 | 基于官方插件 | 业务用途 | 输出模式 | 所属页面 |
|------------|-----------|---------|---------|---------|
| PDF 文档解析 | `ai-doc-parser` | 解析用户上传的 PDF 格式书籍/教材，提取文本内容用于题库导入 | unary | 题库管理页 |
| Word 文档解析 | `ai-doc-parser` | 解析用户上传的 Word 格式书籍/教材，提取文本内容用于题库导入 | unary | 题库管理页 |
| Excel 题库导入解析 | `ai-doc-parser` | 解析用户上传的 Excel 题库文件，提取题目结构化数据 | unary | 题库管理页 |

> **注意**：Excel 解析优先使用前端 JS 库（如 SheetJS）纯前端解析作为主链路，`ai-doc-parser` 作为 PDF/Word 文档文本提取的补充能力。

---

## 导航配置

- **导航布局**: 移动端底部 Tab 导航（Bottom TabBar），桌面端顶部 Topbar 导航
- **导航项**（仅一级页面）:

| 导航文字 | 路由 | 图标(可选) |
|---------|------|-----------|
| 题库 | `/` | BookOpen |
| 刷题 | `/practice` | PenTool |
| 搜题 | `/search` | Search |
| 试卷 | `/exam` | FileText |

---

## 数据来源声明

| 数据/操作 | 来源类型 | 实现要求 | mock 兜底 |
|---|---|---|---|
| 题库数据存储 | local-persist | localStorage key=`__app_quiz_bank_questions`，存储全量题目数据，刷新不丢失 | 初始 5-10 条示例题目，source='mock' 字段标记 |
| Excel 题库导入 | real-file | File API 读取 .xlsx 文件，使用 SheetJS 前端解析，按 Exameow 模板列映射后入库 | 无（必须真实文件） |
| PDF 文档解析导入 | real-plugin | 调 ai-doc-parser 实例，传入用户选中的 PDF 文件，提取文本内容 | 失败提示（toast "文档解析插件暂不可用"） |
| Word 文档解析导入 | real-plugin | 调 ai-doc-parser 实例，传入用户选中的 Word 文件，提取文本内容 | 失败提示（toast "文档解析插件暂不可用"） |
| 错题本数据 | local-persist | localStorage key=`__app_quiz_bank_wrong`，存储错题 ID 列表 + 错误次数 | 无 |
| 收藏题目数据 | local-persist | localStorage key=`__app_quiz_bank_favorites`，存储收藏题目 ID 列表 | 无 |
| 刷题进度 | local-persist | localStorage key=`__app_quiz_bank_progress`，存储各章节/模式的答题进度 | 无 |
| 搜题功能 | local-persist | 在已存储的题库数据中做前端全文关键词匹配（题干 + 解析字段） | 无（依赖本地题库数据） |
| 试卷生成与存储 | local-persist | localStorage key=`__app_quiz_bank_exams`，存储已生成的试卷配置和抽题结果 | 无 |
| 题库导出 Excel | import-export | 使用 SheetJS 生成 xlsx Blob，通过 a.click 触发下载，格式与导入模板兼容 | 无 |
| 试卷导出 HTML/PDF | import-export | 生成可打印 HTML 页面，支持浏览器打印为 PDF；带答案版/不带答案版两种格式 | 无 |
| 用户设置/偏好 | local-persist | localStorage key=`__app_quiz_bank_settings`，存储主题、字体大小等偏好 | 无（默认值内置） |

---

## 功能列表

### 页面：题库管理页 (`/`)

- **页面目标**: 管理题库数据，提供导入、查看、编辑、导出能力
- **功能点**:
  - **题库导入（Excel）**
    - 触发: 页面顶部 "导入题库" 按钮
    - 交互: 点击唤起文件选择器（.xlsx/.xls），支持拖拽上传
    - 提交: 使用 SheetJS 解析 Excel，按 Exameow 模板映射列（题型/题干/选项A-H/正确答案/解析/学科/章节/难度），自动识别单选/多选/判断/简答题型，校验数据完整性后批量入库
    - 反馈: 导入完成弹窗显示统计（成功X条/失败X条/失败原因），toast 提示结果
    - 数据契约: 每条题目含 id/type/question/options[8]/answer/analysis/subject/chapter/difficulty/source
  - **题库导入（PDF/Word）**
    - 触发: 导入弹窗中切换 "文档导入" Tab
    - 交互: 选择 PDF/Word 文件，调 ai-doc-parser 插件提取文本，展示提取结果预览，用户可手动标记题目边界
    - 提交: 用户确认后将识别的题目结构化后入库
    - 反馈: 提取中 loading + 进度，失败时 toast "文档解析插件暂不可用"
  - **题库列表与筛选**
    - 触发: 页面主体区域
    - 交互: 按学科/章节/题型/难度多维度筛选题目，支持分页/无限滚动
    - 展示: 列表项展示题型标签、题干摘要、章节、难度，点击进入题目详情
  - **题目编辑与删除**
    - 触发: 列表项操作菜单（编辑/删除）
    - 交互: 编辑唤起 Dialog 表单（题型、题干、选项A-H，正确答案多选，解析，学科，章节，难度）
    - 提交: 更新 localStorage 中对应题目
    - 反馈: toast "保存成功"/"删除成功"，列表实时刷新
  - **题库导出 Excel**
    - 触发: 页面右上角 "导出" 按钮
    - 交互: 点击后生成 xlsx 文件，格式与导入模板兼容（题型/题干/选项A-H/正确答案/解析/学科/章节/难度）
    - 提交: 生成 Blob + a.click 触发下载
    - 反馈: toast "导出成功"，文件名自动带日期

### 页面：刷题练习页 (`/practice`)

- **页面目标**: 选择刷题模式和筛选条件，进入答题流程
- **功能点**:
  - **刷题模式选择**
    - 触发: 页面顶部四个模式卡片（顺序练习/随机练习/错题本/收藏题目）
    - 交互: 点击卡片选中模式，展示该模式题目数量
    - 数据: 错题本数量从 `__app_quiz_bank_wrong` 读取，收藏数量从 `__app_quiz_bank_favorites` 读取
  - **筛选条件配置**
    - 触发: 模式卡片下方筛选区域
    - 交互: 章节选择（树形/级联选择）、题型选择（单选/多选/判断/简答 多选）、难度选择（简单/中等/困难 多选）
    - 提交: 实时计算符合条件的题目数量并展示
  - **开始答题**
    - 触发: 底部 "开始练习" 大按钮
    - 交互: 点击后跳转 `/quiz/:mode` 页面，携带筛选参数
    - 反馈: 无符合条件题目时按钮禁用 + 提示

### 页面：刷题答题页 (`/quiz/:mode`)

- **页面目标**: 单题展示、即时判分、记录答题结果（对标考试宝刷题体验）
- **功能点**:
  - **单题展示**
    - 触发: 进入页面
    - 交互: 题目居中展示，显示题型标签、题干、选项列表（单选为圆形单选框，多选为方形复选框，判断为对/错按钮，简答为输入框），底部固定操作栏（上一题/下一题/收藏/答题卡）
    - 样式: 大按钮、大间距，适配手机端拇指点击
  - **即时判分与解析展示**
    - 触发: 用户选择选项/提交答案
    - 交互: 选择后立即判分，正确答案绿色高亮，错误答案红色标记，下方展开解析内容
    - 提交: 答对不处理，答错自动加入错题本（`__app_quiz_bank_wrong`）
    - 反馈: 答对显示 ✓ 绿色反馈，答错显示 ✗ 红色反馈 + 正确答案提示
  - **收藏/取消收藏**
    - 触发: 底部操作栏收藏按钮（星标图标）
    - 交互: 点击切换收藏状态，更新 `__app_quiz_bank_favorites`
    - 反馈: 星标图标填充/空心切换 + toast 轻提示
  - **答题卡概览**
    - 触发: 底部 "答题卡" 按钮
    - 交互: 弹出抽屉，展示所有题号网格（已答/未答/正确/错误 不同颜色标记），点击题号跳转
    - 提交: 仅展示状态，无数据写入
  - **刷题进度持久化**
    - 触发: 每次答题/切换题目时自动保存
    - 交互: 保存当前模式、筛选条件、当前题号、答题记录到 localStorage
    - 反馈: 下次进入同一模式自动恢复进度，弹窗询问 "是否继续上次答题？"

### 页面：搜题页 (`/search`)

- **页面目标**: 全文关键词搜索，快速定位题目
- **功能点**:
  - **关键词搜索**
    - 触发: 顶部搜索框输入 + 回车/搜索按钮
    - 交互: 在题库全量数据中匹配题干和解析字段（包含关键词即命中），支持模糊匹配
    - 提交: 纯前端 filter 匹配，不涉及后端
    - 反馈: 实时展示匹配结果数量，无结果时显示空状态
  - **搜索结果列表**
    - 触发: 搜索结果区域
    - 交互: 列表项展示题型标签、题干（关键词高亮）、章节、难度，点击进入题目详情/直接答题
    - 展示: 按相关度排序（题干匹配优先于解析匹配）
  - **搜索历史**
    - 触发: 搜索框聚焦且无输入时
    - 交互: 展示最近搜索关键词列表，点击直接搜索，支持清空历史
    - 数据: localStorage key=`__app_quiz_bank_search_history`

### 页面：试卷中心页 (`/exam`)

- **页面目标**: 组卷规则配置、试卷列表管理、试卷导出
- **功能点**:
  - **智能组卷**
    - 触发: 页面顶部 "新建试卷" 按钮
    - 交互: 弹出组卷配置 Dialog，可设置：试卷名称、各题型题量（单选X道/多选X道/判断X道/简答X道）、章节范围、难度分布、抽题方式（随机/顺序）
    - 提交: 按规则从题库中随机抽取题目，生成试卷存入 `__app_quiz_bank_exams`
    - 反馈: 组卷成功 toast，列表新增试卷；题库不足时提示 "题库中符合条件的题目不足X道"
  - **试卷列表**
    - 触发: 页面主体列表
    - 交互: 展示试卷名称、题目总数、创建时间，操作项：开始答题、预览、导出、删除
    - 展示: 按创建时间倒序排列
  - **试卷导出**
    - 触发: 列表项 "导出" 操作 → 选择格式
    - 交互: 支持两种导出格式：带答案版、不带答案版；支持 HTML 直接打印 / PDF 导出
    - 提交: 生成可打印的 HTML 页面（新窗口打开），包含试卷标题、题目、答题区域（不带答案版）或答案+解析（带答案版）
    - 反馈: 新窗口打开打印预览，提示 "按 Ctrl+P 打印或另存为 PDF"

### 页面：试卷答题页 (`/exam/:id`)

- **页面目标**: 模拟考试模式答题
- **功能点**:
  - **考试模式答题**
    - 触发: 从试卷中心页点击 "开始考试"
    - 交互: 顶部显示考试倒计时（可选）和进度，单题展示 + 底部选项，支持上下题切换和答题卡跳转
    - 提交: 全部答完后提交试卷，显示得分和正确率
  - **成绩统计**
    - 触发: 提交试卷后
    - 交互: 展示总分、正确率、各题型正确率、错题列表
    - 数据: 考试记录存入 localStorage key=`__app_quiz_bank_exam_records`

---

## 数据共享配置

| 存储键名 | 数据说明 | 使用页面 |
|---------|---------|---------|
| `__app_quiz_bank_questions` | 全量题库题目列表，类型为 `IQuestion[]` | 题库管理、刷题练习、搜题、试卷中心 |
| `__app_quiz_bank_wrong` | 错题本题目 ID + 错误次数，类型为 `{ id: string; wrongCount: number; lastWrongAt: number }[]` | 刷题练习、刷题答题 |
| `__app_quiz_bank_favorites` | 收藏题目 ID 列表，类型为 `string[]` | 刷题练习、刷题答题 |
| `__app_quiz_bank_progress` | 各模式刷题进度，类型为 `{ mode: string; filters: object; currentIndex: number; answers: object }` | 刷题练习、刷题答题 |
| `__app_quiz_bank_exams` | 已生成试卷列表，类型为 `IExam[]` | 试卷中心、试卷答题 |
| `__app_quiz_bank_exam_records` | 考试记录，类型为 `IExamRecord[]` | 试卷答题 |
| `__app_quiz_bank_search_history` | 搜索历史关键词，类型为 `string[]` | 搜题页 |
| `__app_quiz_bank_settings` | 用户偏好设置，类型为 `{ fontSize: string; showAnswerImmediately: boolean }` | 全局 |

```ts
interface IQuestion {
  id: string;
  /** 题型：single-单选, multiple-多选, judge-判断, short-简答 */
  type: 'single' | 'multiple' | 'judge' | 'short';
  /** 题干 */
  question: string;
  /** 选项A-H，最多8个，判断题该字段为空 */
  options: string[];
  /** 正确答案：单选为单个字母，多选为字母数组，判断为对/错，简答为参考答案文本 */
  answer: string | string[];
  /** 答案解析 */
  analysis: string;
  /** 学科 */
  subject: string;
  /** 章节 */
  chapter: string;
  /** 难度：1-简单, 2-中等, 3-困难 */
  difficulty: 1 | 2 | 3;
  /** 数据来源：mock-示例数据, import-导入, manual-手动添加 */
  source: 'mock' | 'import' | 'manual';
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
}

interface IExam {
  id: string;
  /** 试卷名称 */
  name: string;
  /** 题目 ID 列表（按顺序） */
  questionIds: string[];
  /** 题型分布统计 */
  typeDistribution: { single: number; multiple: number; judge: number; short: number };
  /** 总分数 */
  totalScore: number;
  /** 创建时间戳 */
  createdAt: number;
}

interface IExamRecord {
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

-------

<scene_type>prototype-app</scene_type>

# UI 设计指南

## 1. 设计推导依据

- **参考意图**: Mood Reference —— 借鉴"考试宝"简洁清爽、移动端友好的刷题界面气质，不进行像素级复刻，视觉系统按自托管工具产品语义重建。
- **核心情绪 / 应用类型**: 轻量教育工具，强调专注刷题、即时反馈、低干扰学习；纯前端本地存储，打开即用。
- **独特记忆点**: 单题居中卡片式刷题 + 选项大按钮即时判分反馈，绿色正确 / 红色错误的色块对比强烈，配合解析展开动效，形成"做题-反馈-理解"的清晰节奏。

## 2. Art Direction

- **方向名**: 清透学习感
- **Design Style**: Soft Blocks + Minimal Clean —— 大圆角软色块营造轻松学习氛围，极简布局减少认知负担，适合长时间刷题。
- **DNA 参数**: 圆角 soft (`rounded-xl` / `rounded-2xl`) / 阴影 subtle (`shadow-sm`) / 间距 standard (`gap-4` / `p-6`) / 字体方向 清晰无衬线 / 装饰手法 轻量渐变顶栏 + 选项色块反馈。
- **应用类型**: Tool —— 移动端优先，单栏居中，底部操作区固定。

## 3. Color System

**色彩关系**: 清爽薄荷绿主色 + 同色系极浅反馈底 + 纯白卡片背景，配合暖灰文字；正确态用绿、错误态用暖红，均为低饱和不刺眼。
**配色设计理由**: 薄荷绿传达成长、正确与低压力，适合教育学习场景；纯白卡片确保题干和选项高对比可读；正确/错误反馈色饱和度克制，避免长时间刷题产生视觉疲劳。
**主色推导**: 从"学习成长 + 正确反馈"语义出发，选取 HSL 160° 附近的薄荷绿，比纯草绿更冷静、比深蓝更有活力，符合自托管轻工具的清新定位。
**使用比例**: 65% 中性（白/浅灰） / 28% 辅助（浅绿底 / 浅灰底） / 7% primary；primary 只用于主按钮、激活 tab、正确状态高亮；链接和 icon 用 accentForeground。

| 角色 | CSS 变量 | Tailwind Class | HSL 值 | 设计说明 |
|---|---|---|---|---|
| bg | `--background` | `bg-background` | hsl(150 20% 98%) | 页面背景，极浅薄荷白 |
| card | `--card` | `bg-card` | hsl(0 0% 100%) | 题目卡片、表单、弹层 |
| text | `--foreground` | `text-foreground` | hsl(215 25% 18%) | 题干、标题、正文 |
| textMuted | `--muted-foreground` | `text-muted-foreground` | hsl(215 12% 48%) | 解析说明、辅助信息、进度数字 |
| primary | `--primary` | `bg-primary` / `text-primary` | hsl(160 55% 42%) | 主按钮、正确态、激活 tab、品牌识别 |
| primaryForeground | `--primary-foreground` | `text-primary-foreground` | hsl(0 0% 100%) | primary 上的文字和图标 |
| accent | `--accent` | `bg-accent` | hsl(160 45% 94%) | hover 浅底、选中浅底、正确项浅底 |
| accentForeground | `--accent-foreground` | `text-accent-foreground` | hsl(160 50% 30%) | accent 上的文字和图标 |
| border | `--border` | `border-border` | hsl(214 15% 90%) | 输入框、卡片、菜单边界 |

**语义色提示**: 
- 正确 / 成功：与 primary 同色系，bg `hsl(160 50% 94%)` / border `hsl(160 48% 72%)` / text `hsl(160 60% 32%)`
- 错误 / 答错：暖红系，饱和度与 primary 对齐 ±10%，bg `hsl(0 50% 95%)` / border `hsl(0 48% 78%)` / text `hsl(0 60% 40%)`
- 警告 / 提示：琥珀系，bg `hsl(40 60% 94%)` / border `hsl(40 55% 75%)` / text `hsl(35 70% 35%)`

## 4. 字体与节奏

- **font-display**: Noto Sans SC —— 中文题干和选项清晰易读，字重跨度大，标题有力、正文舒适。
- **font-body**: Noto Sans SC —— 全中文学习场景首选，长时间阅读不疲劳，Google Fonts 可靠加载。
- **字号**: H1 text-3xl；H2 text-xl；题干 text-lg ~ text-xl；选项 text-base；muted text-sm。
- **圆角**: 大 (rounded-xl / rounded-2xl) —— 选项按钮和卡片大圆角增加亲和感，减少考试紧张感。

## 5. 全局布局契约

- **Reference Layout Use**: 按需求结构推导，刷题页借鉴考试宝"单题居中 + 底部选项 + 顶栏进度"的三段式结构。
- **Page / Section Order**: 题库导入 → 题库列表 / 筛选 → 刷题页（核心）→ 搜题 → 试卷生成 → 导出设置。
- **Standard Content Zone**: Tool max-w-md (移动端) ~ max-w-2xl (平板/桌面) + `mx-auto`；刷题页严格居中单栏。
- **Shell / Frame Alignment**: 底部 tab 导航（移动端）/ 侧边栏（桌面端）由 AGENTS 给定，内容区独立居中，不与 chrome 共宽。
- **Padding & Rhythm**: `px-4 md:px-6 py-6`，题目卡片内边距 `p-5 md:p-6`，选项间距 `gap-3`。
- **Full-bleed Zones**: 顶栏进度条可全宽，底部操作栏可全宽固定；题目卡片和文字受 Standard Content Zone 约束。
- **Local Narrowing**: 题库列表页桌面端可放宽到 max-w-4xl 双栏；刷题页始终收窄到 max-w-xl 居中。
- **Overflow Strategy**: 长解析、长题干使用自然换行，选项列表纵向滚动；表格类导入预览用 `overflow-x-auto`。
- **Flexibility Boundary**: 允许移动端 padding 和选项按钮高度微调；不允许切换主色、圆角风格或阴影强度。

## 6. 视觉与动效

- **装饰**: 顶栏轻量渐变 + 选项选中色块填充，几乎无多余装饰。
- **阴影/边界**: 轻 —— 卡片 `shadow-sm`，选中态用边框 + 背景色区分，不用重阴影。
- **动效**: 精致克制 —— 选项点击有 150ms 缩放反馈，正确/错误色块 200ms 淡入，解析展开 250ms ease；页面切换用淡入，不用花哨转场。

## 7. 组件原则

- 按钮、选项卡、输入框必须有 Default / Hover / Active / Focus / Disabled 五种状态。
- 选项按钮是核心交互：默认白底灰边，hover 浅绿底，选中正确态绿底白字，选中错误态红底白字，正确答案（选错时显示）浅绿底绿边。
- Primary 只用于"下一题""提交""开始练习"等主行动；次级操作用 outline 样式。
- 空状态、加载中、错题为空都用轻量插画 + 文案，延续薄荷绿主题。

## 8. Image Direction

- **Image Role**: 空状态插画 / 欢迎页轻量图形
- **Image Art Direction**: 极简扁平插画风格，薄荷绿 + 米白主色调；构图主体为书本、铅笔、对勾等学习相关符号，线条圆润，无复杂阴影；光线均匀柔和，整体情绪轻松鼓励。
- **Image Prompt Keywords**: minimal flat illustration, mint green and cream white, book and checkmark, rounded shapes, soft pastel, learning theme, clean white background, simple line art, friendly character, educational app aesthetic
- **Image Avoidance**: 避免3D渲染、商务人士素材图、高饱和渐变色块堆、复杂场景插画、考试焦虑相关元素（时钟、红叉满屏）。

## 9. Anti-patterns

- **Split personality**: 刷题页用一套色、设置页又回到默认蓝；全站统一薄荷绿语言。
- **Phantom tokens**: 编造不存在的 CSS 变量；只用已定义的 9 角色 + 语义色。
- **Default SaaS drift**: 回到通用蓝紫渐变 + 卡片堆叠；用薄荷绿 + 大圆角选项按钮建立产品识别。
- **Invisible interaction**: 只做 hover 不做 focus-visible；选项和按钮必须有键盘焦点环。
- **Mono-hue tyranny**: 主色同时用于按钮、tab、icon、边框、链接；primary 只给 CTA 和正确态，其余交给 accent / 中性色。
- **Status color drift**: 错误红太艳、警告黄太亮，盖过主色；语义色饱和度与 primary 对齐 ±10%。