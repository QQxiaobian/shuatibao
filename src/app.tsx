import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";
import LibraryPage from "@/pages/LibraryPage/LibraryPage";
import PracticePage from "@/pages/PracticePage/PracticePage";
import QuizPage from "@/pages/QuizPage/QuizPage";
import SearchPage from "@/pages/SearchPage/SearchPage";
import ExamPage from "@/pages/ExamPage/ExamPage";
import ExamQuizPage from "@/pages/ExamQuizPage/ExamQuizPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/library" replace />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="practice" element={<PracticePage />} />
        <Route path="quiz/:mode" element={<QuizPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="exam" element={<ExamPage />} />
        <Route path="exam/shared/:id" element={<ExamQuizPage />} />
        <Route path="exam/:id" element={<ExamQuizPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
