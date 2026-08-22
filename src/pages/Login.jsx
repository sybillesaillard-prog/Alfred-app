import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const friendlyError = (code) => {
    switch (code) {
      case "auth/invalid-email":
        return "Adresse email invalide.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Email ou mot de passe incorrect.";
      case "auth/email-already-in-use":
        return "Un compte existe déjà avec cet email.";
      case "auth/weak-password":
        return "Le mot de passe doit faire au moins 6 caractères.";
      default:
        return "Une erreur est survenue. Réessaie.";
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password);
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-950 px-4 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-sky-400 flex items-center justify-center text-2xl font-bold text-slate-950">
            A
          </div>
          <h1 className="text-2xl font-semibold text-slate-50">Alfred</h1>
          <p className="text-slate-400 text-sm mt-1">
            Ton assistant personnel — dépenses &amp; tâches
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
              placeholder="toi@exemple.com"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-sky-400 text-slate-950 font-medium py-2.5 hover:bg-sky-300 transition disabled:opacity-60"
          >
            {busy
              ? "…"
              : mode === "login"
                ? "Se connecter"
                : "Créer mon compte"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
          className="w-full text-center text-sm text-slate-400 hover:text-slate-200 mt-4"
        >
          {mode === "login"
            ? "Pas encore de compte ? Crée-le en un clic."
            : "Déjà un compte ? Connecte-toi."}
        </button>
      </div>
    </div>
  );
}
