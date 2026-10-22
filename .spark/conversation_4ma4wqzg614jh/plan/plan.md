1. 数据层：题目类型定义 + 示例题库 + 存储 hooks
   - 创建 src/data/questions.ts（IQuestion interface + MOCK_QUESTIONS 示例数据）
   - 创建 src/hooks/useQuestionBank.ts（题库 CRUD + localStorage 持久化）
   - 创建 src/hooks/useWrongBook.ts、useFavorites.ts、useExams.ts

2. Chrome 层：底部 TabBar + Layout + Header
   - 创建 src/components/BottomTabBar.tsx（移动端底部导航）
   - 创建 src/components/Header.tsx（桌面端顶部导航）
   - 重写 src/components/Layout.tsx（Header + BottomTabBar + main）

3. 页面1：题库管理页 LibraryPage
   - 创建 src/pages/LibraryPage/LibraryPage.tsx
   - 创建 QuestionImportDialog.tsx（Excel 导入 + PDF/Word 文档导入）
   - 创建 QuestionListSection.tsx
   - 创建 QuestionEditDialog.tsx

4. 页面2：刷题练习页 PracticePage
   - 创建 src/pages/PracticePage/PracticePage.tsx
   - 模式卡片 + 筛选条件 + 开始练习跳转

5. 页面3：刷题答题页 QuizPage
   - 创建 src/pages/QuizPage/QuizPage.tsx
   - 创建 QuestionCard.tsx（单题展示 + 四种题型 + 即时判分 + 解析）
   - 答题卡抽屉 + 收藏 + 进度持久化

6. 页面4：搜题页 SearchPage
   - 创建 src/pages/SearchPage/SearchPage.tsx
   - 关键词搜索 + 搜索历史 + 结果高亮

7. 页面5：试卷中心页 ExamPage
   - 创建 src/pages/ExamPage/ExamPage.tsx
   - 创建 ExamCreateDialog.tsx（智能组卷配置）
   - 试卷列表 + 导出

8. 页面6：试卷答题页 ExamQuizPage
   - 创建 src/pages/ExamQuizPage/ExamQuizPage.tsx
   - 考试模式 + 成绩统计

9. 路由配置 app.tsx + 全局 Toast
   - 修改 src/app.tsx 注册所有路由
   - 配置 sonner Toaster

10. 运行 build 验证并提交
    - 运行 build 验证，修复报错后 run_commit 提交