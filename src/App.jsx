import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { isFirebaseConfigured } from "./lib/firebase";
import SetupNeeded from "./pages/SetupNeeded";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Expenses from "./pages/Expenses";
import Tasks from "./pages/Tasks";
import FixedCharges from "./pages/FixedCharges";
import VariableCharges from "./pages/VariableCharges";
import GmailInvoices from "./pages/GmailInvoices";

function LoadingScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-950">
      <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-sky-400 animate-spin" />
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/depenses" replace />} />
        <Route path="/depenses" element={<Expenses />} />
        <Route path="/charges-fixes" element={<FixedCharges />} />
        <Route path="/charges-variables" element={<VariableCharges />} />
        <Route path="/taches" element={<Tasks />} />
        <Route path="/boite-mail" element={<GmailInvoices />} />
      </Route>
      <Route path="*" element={<Navigate to="/depenses" replace />} />
    </Routes>
  );
}

export default function App() {
  if (!isFirebaseConfigured) {
    return <SetupNeeded />;
  }
  return <AuthGate />;
}
