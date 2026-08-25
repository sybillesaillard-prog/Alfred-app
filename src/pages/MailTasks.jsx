import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Settings2,
  RefreshCw,
  Check,
  X,
  Plus,
  Trash2,
  Mail,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../lib/useCollection";
import {
  isMailboxConnected,
  connectMailbox,
  searchTaskCandidates,
  guessSenderName,
} from "../lib/mailboxAuth";
import {
  getMailTasksSyncState,
  setMailboxes as saveMailboxesConfig,
  setMailboxLastCheckedAt,
  makeMailboxKey,
} from "../lib/mailTasksSync";
import {
  getClaudeApiKey,
  setClaudeApiKey,
  getClaudeModelKey,
  setClaudeModelKey,
  CLAUDE_MODELS,
  analyzeMailsForTasks,
} from "../lib/claudeTasks";

// Recherche, une fois par jour sur clic (jamais automatique — même
// philosophie que l'import Gmail des factures), dans les boîtes mail
// connectées, les mails qui attendent une action de Sybille — cadré avec
// elle le 25/08/2026 (cf. claude/app-alfred-notes.md). Les suggestions
// repérées par l'IA s'ajoutent d'un clic à sa liste de tâches existante
// (`/taches`, collection Firestore "tasks") plutôt que de vivre dans une
// liste séparée à maintenir en double.
export default function MailTasks() {
  const { user } = useAuth();
  const { add: addTask } = useCollection("tasks");

  const [syncState, setSyncState] = useState({ mailboxes: [], lastCheckedAt: {} });
  const [connectedTick, setConnectedTick] = useState(0); // force un re-render après connexion
  const [connectingKey, setConnectingKey] = useState(null);
  const [connectError, setConnectError] = useState("");

  const [checking, setChecking] = useState(false);
  const [checkErrors, setCheckErrors] = useState({});
  const [suggestions, setSuggestions] = useState([]); // { key, mailboxKey, category, mailboxLabel, task, from, subject }
  const [addedKeys, setAddedKeys] = useState(() => new Set());
  const [ignoredKeys, setIgnoredKeys] = useState(() => new Set());

  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [modelDraft, setModelDraft] = useState("haiku");
  const [newMailboxLabel, setNewMailboxLabel] = useState("");
  const [newMailboxCategory, setNewMailboxCategory] = useState("pro");

  useEffect(() => {
    if (!user) return;
    getMailTasksSyncState(user.uid).then(setSyncState);
    setApiKeyDraft(getClaudeApiKey());
    setModelDraft(getClaudeModelKey());
  }, [user]);

  const mailboxes = syncState.mailboxes;

  const onConnect = async (mailboxKey) => {
    setConnectingKey(mailboxKey);
    setConnectError("");
    try {
      await connectMailbox(mailboxKey);
      setConnectedTick((t) => t + 1);
    } catch {
      setConnectError("Connexion Gmail refusée ou impossible pour cette boîte.");
    } finally {
      setConnectingKey(null);
    }
  };

  const onCheckAll = async () => {
    if (!user) return;
    setChecking(true);
    setCheckErrors({});
    const collected = [];
    for (const mb of mailboxes) {
      if (!isMailboxConnected(mb.key)) continue;
      try {
        const candidates = await searchTaskCandidates(mb.key, syncState.lastCheckedAt[mb.key]);
        let flagged = [];
        if (candidates.length > 0) {
          flagged = await analyzeMailsForTasks(mb.label, mb.category, candidates);
        }
        const byId = new Map(candidates.map((c) => [c.id, c]));
        for (const f of flagged) {
          const c = byId.get(f.id);
          if (!c) continue;
          collected.push({
            key: `${mb.key}:${c.id}`,
            mailboxKey: mb.key,
            category: mb.category,
            mailboxLabel: mb.label,
            task: f.task,
            from: guessSenderName(c.from),
            subject: c.subject,
          });
        }
        // La date de dernière vérification n'avance QUE si la recherche ET
        // l'analyse IA ont réussi jusqu'au bout — sinon les mails de cette
        // fenêtre n'ont jamais été vraiment analysés, et seraient sinon
        // silencieusement sautés à la prochaine vérification.
        const now = new Date().toISOString();
        await setMailboxLastCheckedAt(user.uid, mb.key, now);
        setSyncState((s) => ({ ...s, lastCheckedAt: { ...s.lastCheckedAt, [mb.key]: now } }));
      } catch (err) {
        setCheckErrors((e) => ({ ...e, [mb.key]: err.message || "La vérification a échoué." }));
      }
    }
    setSuggestions((prev) => [...prev, ...collected]);
    setChecking(false);
  };

  const onAddSuggestion = async (s) => {
    await addTask({
      title: s.task,
      category: s.category,
      subcategory: "Mail",
      priority: "normale",
      dueDate: null,
      note: `Depuis un mail de ${s.from}${s.subject ? ` — "${s.subject}"` : ""} (${s.mailboxLabel})`,
      done: false,
    });
    setAddedKeys((prev) => new Set(prev).add(s.key));
  };

  const onIgnoreSuggestion = (s) => {
    setIgnoredKeys((prev) => new Set(prev).add(s.key));
  };

  const visibleSuggestions = suggestions.filter((s) => !addedKeys.has(s.key) && !ignoredKeys.has(s.key));
  const bySection = useMemo(
    () => ({
      perso: visibleSuggestions.filter((s) => s.category === "perso"),
      pro: visibleSuggestions.filter((s) => s.category === "pro"),
    }),
    [visibleSuggestions]
  );

  const saveApiSettings = () => {
    setClaudeApiKey(apiKeyDraft.trim());
    setClaudeModelKey(modelDraft);
  };

  const addMailbox = async () => {
    if (!newMailboxLabel.trim() || !user) return;
    const key = makeMailboxKey(mailboxes.map((m) => m.key));
    const updated = [...mailboxes, { key, label: newMailboxLabel.trim(), category: newMailboxCategory }];
    await saveMailboxesConfig(user.uid, updated);
    setSyncState((s) => ({ ...s, mailboxes: updated }));
    setNewMailboxLabel("");
  };

  const removeMailbox = async (key) => {
    if (!user) return;
    const updated = mailboxes.filter((m) => m.key !== key);
    await saveMailboxesConfig(user.uid, updated);
    setSyncState((s) => ({ ...s, mailboxes: updated }));
  };

  const anyConnected = mailboxes.some((mb) => isMailboxConnected(mb.key));

  function MailboxRow({ mb }) {
    const connected = isMailboxConnected(mb.key);
    const lastChecked = syncState.lastCheckedAt[mb.key];
    return (
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="min-w-0">
          <p className="text-sm text-slate-200 truncate">{mb.label}</p>
          <p className="text-xs text-slate-500">
            {connected
              ? lastChecked
                ? `Dernière vérification : ${new Date(lastChecked).toLocaleString("fr-FR")}`
                : "Connectée — jamais vérifiée"
              : "Non connectée"}
          </p>
          {checkErrors[mb.key] && <p className="text-xs text-red-400 mt-0.5">{checkErrors[mb.key]}</p>}
        </div>
        {!connected && (
          <button
            onClick={() => onConnect(mb.key)}
            disabled={connectingKey === mb.key}
            className="shrink-0 text-xs rounded-lg border border-sky-400/40 text-sky-300 px-2.5 py-1.5 hover:bg-sky-400/10 transition disabled:opacity-60"
          >
            {connectingKey === mb.key ? "Connexion…" : "Connecter"}
          </button>
        )}
      </div>
    );
  }

  function SuggestionRow({ s }) {
    return (
      <div className="flex items-start gap-3 px-4 py-3">
        <Sparkles size={16} className="text-sky-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-100">{s.task}</p>
          <p className="text-xs text-slate-500 truncate">
            {s.from}
            {s.subject ? ` — ${s.subject}` : ""}
          </p>
        </div>
        <button
          onClick={() => onAddSuggestion(s)}
          className="shrink-0 flex items-center gap-1 text-xs rounded-lg bg-sky-400 text-slate-950 font-medium px-2.5 py-1.5 hover:bg-sky-300 transition"
        >
          <Check size={13} />
          Ajouter
        </button>
        <button
          onClick={() => onIgnoreSuggestion(s)}
          className="shrink-0 text-slate-500 hover:text-slate-300 p-1.5"
          aria-label="Ignorer"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  function Section({ title, items }) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl mb-4">
        <p className="px-4 py-3 text-sm font-semibold text-slate-200 border-b border-slate-800">
          {title} {items.length > 0 && <span className="text-slate-500 font-normal">({items.length})</span>}
        </p>
        {items.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">Rien à signaler ici.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {items.map((s) => (
              <SuggestionRow key={s.key} s={s} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Tâches depuis mes mails</h1>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="text-slate-400 hover:text-slate-200 p-1.5"
          aria-label="Réglages"
        >
          <Settings2 size={18} />
        </button>
      </div>

      <p className="text-slate-400 text-sm mb-4">
        Repère, une fois par clic (jamais automatique), les mails perso et pro qui attendent une réponse
        ou une action — les suggestions retenues s'ajoutent d'un clic à ta liste de tâches habituelle.
      </p>

      {showSettings && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Clé API Claude (Anthropic)</label>
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              Stockée uniquement dans ce navigateur — jamais envoyée ailleurs qu'à l'API Anthropic.
            </p>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Modèle IA</label>
            <select
              value={modelDraft}
              onChange={(e) => setModelDraft(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm"
            >
              {Object.entries(CLAUDE_MODELS).map(([key, m]) => (
                <option key={key} value={key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={saveApiSettings}
            className="text-xs rounded-lg border border-sky-400/40 text-sky-300 px-2.5 py-1.5 hover:bg-sky-400/10 transition"
          >
            Enregistrer
          </button>

          <div className="border-t border-slate-800 pt-3">
            <p className="text-sm text-slate-400 mb-2">Boîtes mail</p>
            <div className="space-y-1 mb-3">
              {mailboxes.map((mb) => (
                <div key={mb.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-300">
                    {mb.label}{" "}
                    <span className="text-xs text-slate-500">({mb.category === "pro" ? "Pro" : "Perso"})</span>
                  </span>
                  <button
                    onClick={() => removeMailbox(mb.key)}
                    className="text-slate-600 hover:text-red-400 p-1"
                    aria-label="Supprimer cette boîte"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newMailboxLabel}
                onChange={(e) => setNewMailboxLabel(e.target.value)}
                placeholder="Ex : 2e boîte pro"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm"
              />
              <select
                value={newMailboxCategory}
                onChange={(e) => setNewMailboxCategory(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm"
              >
                <option value="perso">Perso</option>
                <option value="pro">Pro</option>
              </select>
              <button
                onClick={addMailbox}
                className="shrink-0 flex items-center gap-1 text-xs rounded-lg border border-slate-600 text-slate-300 px-2.5 py-1.5 hover:bg-slate-800 transition"
              >
                <Plus size={13} />
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
        <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <Mail size={15} className="text-slate-500" />
          Boîtes connectées
        </p>
        <div className="divide-y divide-slate-800/60" key={connectedTick}>
          {mailboxes.map((mb) => (
            <MailboxRow key={mb.key} mb={mb} />
          ))}
        </div>
        {connectError && <p className="text-xs text-red-400 mt-2">{connectError}</p>}

        <button
          onClick={onCheckAll}
          disabled={checking || !anyConnected}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-sky-400 text-slate-950 text-sm font-medium px-3 py-2.5 hover:bg-sky-300 transition disabled:opacity-60"
        >
          <RefreshCw size={15} className={checking ? "animate-spin" : ""} />
          {checking ? "Vérification…" : "Vérifier mes mails"}
        </button>
        {!anyConnected && (
          <p className="flex items-center gap-1 text-xs text-amber-300/80 mt-2">
            <AlertTriangle size={12} />
            Connecte au moins une boîte ci-dessus pour lancer une vérification.
          </p>
        )}
      </div>

      <Section title="Perso" items={bySection.perso} />
      <Section title="Pro" items={bySection.pro} />
    </div>
  );
}
