import { useEffect, useMemo, useState } from "react";
import { Mail, RefreshCw, FileText, Settings2, Star, X, RotateCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../lib/useCollection";
import {
  isGmailConnected,
  connectGmail,
  searchInvoiceCandidates,
  downloadAttachment,
  guessSenderName,
  scoreCandidate,
} from "../lib/gmail";
import { getGmailSyncState, setLastCheckedAt, setKnownSendersAndKeywords } from "../lib/gmailSync";
import ExpenseForm from "../components/ExpenseForm";

// Une "ligne" de résultat = UNE pièce jointe PDF d'un email (un même email
// peut en avoir plusieurs, chacune s'importe séparément comme une dépense
// distincte — c'est aussi ce qui permet de suivre, par pièce jointe, si
// elle a déjà été importée pendant cette session).
function toRows(candidates, knownSenders, keywords) {
  const rows = [];
  for (const c of candidates) {
    const { senderMatch, keywordMatch, score } = scoreCandidate(c, knownSenders, keywords);
    for (const att of c.attachments) {
      rows.push({
        key: `${c.id}:${att.attachmentId}`,
        messageId: c.id,
        attachmentId: att.attachmentId,
        filename: att.filename,
        from: c.from,
        subject: c.subject,
        dateHeader: c.dateHeader,
        internalDate: c.internalDate,
        senderMatch,
        keywordMatch,
        score,
      });
    }
  }
  return rows.sort((a, b) => b.score - a.score || (b.internalDate || 0) - (a.internalDate || 0));
}

const dateFR = (dateHeader) => {
  const d = new Date(dateHeader);
  if (Number.isNaN(d.getTime())) return dateHeader || "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

// Ancien drapeau de test (25/08), désactivé le 25/08 à la demande de
// Sybille une fois les tests d'import Gmail validés — la mémorisation de la
// dernière vérification est de nouveau active (comportement normal : ne
// remonter que les emails reçus depuis la dernière vérification). Laissé en
// place plutôt que supprimé pour pouvoir le réactiver facilement si un futur
// test en a de nouveau besoin.
const TESTING_IGNORE_SYNC_MEMORY = false;

export default function GmailInvoices() {
  const { user } = useAuth();
  const { items: expenses, add: addExpense } = useCollection("expenses", "date");
  const existingFilenames = useMemo(
    () => expenses.map((e) => e.filename).filter(Boolean),
    [expenses]
  );

  const [connected, setConnected] = useState(isGmailConnected());
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  const [syncState, setSyncState] = useState(null); // { lastCheckedAt, knownSenders, keywords }
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [rows, setRows] = useState(null); // null = jamais vérifié cette session
  const [importedKeys, setImportedKeys] = useState(() => new Set());
  // Candidats écartés manuellement ("Ignorer") — mémorisés le temps de la
  // session seulement (comme importedKeys), pour ne plus les proposer tant
  // que la liste actuelle est affichée, sans toucher à Gmail ni Firestore.
  const [ignoredKeys, setIgnoredKeys] = useState(() => new Set());

  // "Réinitialiser" (25/08, demande de Sybille) : oublie manuellement la
  // date de dernière vérification, pour relancer une recherche sur les 90
  // derniers jours une fois, sans repasser en mode test permanent — la
  // vérification suivante réécrit `lastCheckedAt` normalement, comme
  // n'importe quelle vérification (cf. onCheck), donc le comportement
  // normal reprend tout seul juste après.
  const [resetting, setResetting] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [sendersDraft, setSendersDraft] = useState("");
  const [keywordsDraft, setKeywordsDraft] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const [importing, setImporting] = useState(null); // { fournisseur, file } pour ouvrir ExpenseForm

  useEffect(() => {
    if (!user) return;
    getGmailSyncState(user.uid).then((s) => {
      setSyncState(s);
      setSendersDraft(s.knownSenders.join(", "));
      setKeywordsDraft(s.keywords.join(", "));
    });
  }, [user]);

  const onConnect = async () => {
    setConnecting(true);
    setConnectError("");
    try {
      await connectGmail();
      setConnected(true);
    } catch {
      setConnectError(
        "Connexion Gmail refusée ou impossible — vérifie que l'API Gmail est bien activée pour ce compte."
      );
    } finally {
      setConnecting(false);
    }
  };

  const onCheck = async () => {
    if (!user || !syncState) return;
    setChecking(true);
    setCheckError("");
    try {
      const candidates = await searchInvoiceCandidates(
        TESTING_IGNORE_SYNC_MEMORY ? null : syncState.lastCheckedAt
      );
      setRows(toRows(candidates, syncState.knownSenders, syncState.keywords));
      if (!TESTING_IGNORE_SYNC_MEMORY) {
        const now = new Date().toISOString();
        await setLastCheckedAt(user.uid, now);
        setSyncState((s) => ({ ...s, lastCheckedAt: now }));
      }
    } catch (err) {
      setCheckError(err.message || "La vérification a échoué.");
      if (err.message?.includes("reconnecte")) setConnected(false);
    } finally {
      setChecking(false);
    }
  };

  const onImportClick = async (row) => {
    setImporting({ fournisseur: guessSenderName(row.from), loading: true, row });
    try {
      const file = await downloadAttachment(row.messageId, row.attachmentId, row.filename);
      setImporting({ fournisseur: guessSenderName(row.from), file, row });
    } catch (err) {
      setImporting(null);
      setCheckError(err.message || "Le téléchargement de la facture a échoué.");
    }
  };

  const onImportedSubmit = async (data) => {
    await addExpense(data);
    if (importing?.row) {
      setImportedKeys((prev) => new Set(prev).add(importing.row.key));
    }
    setImporting(null);
  };

  const saveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    try {
      const senders = sendersDraft.split(",").map((s) => s.trim()).filter(Boolean);
      const keywords = keywordsDraft.split(",").map((s) => s.trim()).filter(Boolean);
      await setKnownSendersAndKeywords(user.uid, senders, keywords);
      setSyncState((s) => ({ ...s, knownSenders: senders, keywords }));
      setShowSettings(false);
    } finally {
      setSavingSettings(false);
    }
  };

  const onIgnoreClick = (row) => {
    setIgnoredKeys((prev) => new Set(prev).add(row.key));
  };

  const onResetSync = async () => {
    if (!user) return;
    setResetting(true);
    try {
      await setLastCheckedAt(user.uid, null);
      setSyncState((s) => ({ ...s, lastCheckedAt: null }));
    } finally {
      setResetting(false);
    }
  };

  const visibleRows = (rows || []).filter((r) => !importedKeys.has(r.key) && !ignoredKeys.has(r.key));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Import depuis Gmail</h1>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="text-slate-400 hover:text-slate-200 p-1.5"
          aria-label="Réglages"
        >
          <Settings2 size={18} />
        </button>
      </div>

      <p className="text-slate-400 text-sm mb-4">
        Récupère les factures PDF reçues par email, à importer d'un clic comme dépense — vérification
        déclenchée manuellement, jamais automatique.
      </p>

      {showSettings && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Expéditeurs connus (séparés par des virgules)
            </label>
            <textarea
              value={sendersDraft}
              onChange={(e) => setSendersDraft(e.target.value)}
              rows={2}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Mots-clés dans l'objet (séparés par des virgules)
            </label>
            <textarea
              value={keywordsDraft}
              onChange={(e) => setKeywordsDraft(e.target.value)}
              rows={2}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
            />
          </div>
          <p className="text-xs text-slate-500">
            Ces listes ne filtrent rien — tout email avec une pièce jointe PDF reste proposé. Elles
            servent juste à mettre en avant (★) les candidats les plus probables.
          </p>
          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="rounded-lg bg-sky-400 text-slate-950 text-sm font-medium px-3 py-2 hover:bg-sky-300 transition disabled:opacity-60"
          >
            {savingSettings ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      )}

      {!connected ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
          <Mail size={28} className="mx-auto text-slate-500 mb-3" />
          <p className="text-sm text-slate-400 mb-4">
            Connecte la boîte Gmail à interroger pour les factures (compte distinct de celui utilisé pour
            Google Drive).
          </p>
          <button
            onClick={onConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-400 text-slate-950 font-medium px-4 py-2.5 hover:bg-sky-300 transition disabled:opacity-60"
          >
            <Mail size={16} />
            {connecting ? "Connexion…" : "Connecter Gmail"}
          </button>
          {connectError && <p className="text-xs text-red-400 mt-3">{connectError}</p>}
        </div>
      ) : (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-300">
                {TESTING_IGNORE_SYNC_MEMORY
                  ? "Mode test : chaque vérification recherche les 90 derniers jours (mémorisation désactivée)."
                  : syncState?.lastCheckedAt
                  ? `Dernière vérification : ${new Date(syncState.lastCheckedAt).toLocaleString("fr-FR")}`
                  : "Jamais vérifié — la première recherche remonte 90 jours en arrière."}
              </p>
              {!TESTING_IGNORE_SYNC_MEMORY && syncState?.lastCheckedAt && (
                <button
                  type="button"
                  onClick={onResetSync}
                  disabled={resetting}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mt-1 disabled:opacity-60"
                >
                  <RotateCcw size={11} className={resetting ? "animate-spin" : ""} />
                  {resetting
                    ? "Réinitialisation…"
                    : "Réinitialiser (relancer une recherche sur les 90 derniers jours)"}
                </button>
              )}
            </div>
            <button
              onClick={onCheck}
              disabled={checking || !syncState}
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-sky-400 text-slate-950 text-sm font-medium px-3 py-2 hover:bg-sky-300 transition disabled:opacity-60"
            >
              <RefreshCw size={15} className={checking ? "animate-spin" : ""} />
              {checking ? "Vérification…" : "Vérifier la boîte mail"}
            </button>
          </div>

          {checkError && (
            <p className="text-xs text-red-400 mb-4 -mt-2">{checkError}</p>
          )}

          {rows !== null && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
              {visibleRows.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">
                  Aucune facture PDF trouvée depuis la dernière vérification.
                </p>
              ) : (
                visibleRows.map((row) => (
                  <div key={row.key} className="flex items-center gap-3 px-4 py-3">
                    <FileText size={18} className="text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-100 truncate flex items-center gap-1.5">
                        {row.score > 0 && <Star size={12} className="text-amber-300 shrink-0" />}
                        {guessSenderName(row.from)}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {row.subject || "(sans objet)"} · {dateFR(row.dateHeader)} · {row.filename}
                      </p>
                    </div>
                    <button
                      onClick={() => onImportClick(row)}
                      disabled={importing?.row?.key === row.key}
                      className="shrink-0 rounded-lg border border-sky-400/30 bg-sky-400/10 text-sky-300 text-xs font-medium px-3 py-1.5 hover:bg-sky-400/20 transition disabled:opacity-60"
                    >
                      {importing?.row?.key === row.key ? "Téléchargement…" : "Importer"}
                    </button>
                    <button
                      onClick={() => onIgnoreClick(row)}
                      disabled={importing?.row?.key === row.key}
                      aria-label="Ignorer"
                      title="Ignorer"
                      className="shrink-0 rounded-lg border border-slate-700 text-slate-500 p-1.5 hover:bg-slate-800 hover:text-slate-300 transition disabled:opacity-60"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {importing?.file && (
        <ExpenseForm
          initial={null}
          existingFilenames={existingFilenames}
          initialFournisseur={importing.fournisseur}
          initialFile={importing.file}
          onClose={() => setImporting(null)}
          onSubmit={onImportedSubmit}
        />
      )}
    </div>
  );
}
