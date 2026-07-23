import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Banks from "./pages/Banks";
import BankDetail from "./pages/BankDetail";
import Quiz from "./pages/Quiz";
import Exam from "./pages/Exam";
import WrongAnswers from "./pages/WrongAnswers";
import Favorites from "./pages/Favorites";
import Browse from "./pages/Browse";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/banks" element={<Banks />} />
        <Route path="/banks/:id" element={<BankDetail />} />
        <Route path="/banks/:id/quiz" element={<Quiz />} />
        <Route path="/banks/:id/exam" element={<Exam />} />
        <Route path="/banks/:id/browse" element={<Browse />} />
        <Route path="/wrong" element={<WrongAnswers />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
