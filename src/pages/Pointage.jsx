// Page "Pointage" (18/09, demande de Sybille : "On va travailler sur le
// pointage des justifs par rapport au relevé de compte. On va faire un seul
// doc qui reprend les manquants et les présents mais en marquant le pointage
// de la saisie des justifs via Alfred, ET un pointage vérifiant la présence
// du fichier sur mon PC. Comme ça lorsque je dois envoyer au comptable tous
// mes justifs, je sais si il y a tout.")
//
// Choix confirmés avec elle (AskUserQuestion) :
// - Référence pour "manquant" : le relevé bancaire — une ligne par opération
//   débitée, pas la liste des dépenses saisies (sinon une dépense jamais
//   saisie n'apparaîtrait jamais du tout).
// - Deux colonnes de contrôle par opération : "Saisi dans Alfred" (une
//   dépense correspond-elle à ce débit — matchTransactions dans bankTx.js)
//   et "Fichier sur PC" (le fichier de cette dépense est-il bien présent
//   dans le dossier "Cabinet ISRAEL" — via l'API File System Access,
//   src/lib/localFiles.js, autorisation donnée une seule fois).
// - Période : par trimestre civil, comme le suivi TVA existant (vat.js).
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  XCircle,
  MinusCircle,
  FileDown,
  AlertTriangle,
} from "lucide-react";
import { useCollection } from "../lib/useCollection";
import { dedupeTransactions, matchTransactions, txSignature } from "../lib/bankTx";
import { quarterKey, quarterLabel, quarterRange } from "../lib/vat";
import {
  isFileSystemAccessSupported,
  loadCabinetFolderHandle,
  pickCabinetFolder,
  hasReadPermission,
  requestReadPermission,
  listAllFilenames,
  findLocalFileForExpense,
} from "../lib/localFiles";
import { downloadPointageAsXlsx } from "../lib/xlsxExport";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Pointage() {
  const { items: statements, loading: statementsLoading } = useCollection("bankStatements", "createdAt");
  const { items: expenses, loading: expensesLoading } = useCollection("expenses", "date");

  const allTransactions = useMemo(() => dedupeTransactions(statements), [statements]);

  // Liste des trimestres proposés : ceux couverts par le relevé bancaire
  // importé, plus le trimestre en cours (même s'il n'y a encore aucune
  // opération dedans) pour ne pas laisser Sybille devant une page vide avant
  // d'avoir importé son relevé du moment.
  const quarters = useMemo(() => {
    const set = new Set([quarterKey(todayISO())]);
    for (const t of allTransactions) {
      const k = quarterKey(t.date);
      if (k) set.add(k);
    }
    return [...set].sort((a, b) => (a < b ? 1 : -1));
  }, [allTransactions]);

  const [selectedQuarter, setSelectedQuarter] = useState(quarters[0]);
  useEffect(() => {
    if (!quarters.includes(selectedQuarter)) setSelectedQuarter(quarters[0]);
  }, [quarters, selectedQuarter]);

  const range = useMemo(() => quarterRange(selectedQuarter || quarters[0]), [selectedQuarter, quarters]);

  const quarterDebits = useMemo(
    () =>
      allTransactions.filter((t) => t.amount < 0 && t.date >= range.start && t.date <= range.end),
    [allTransactions, range]
  );

  const matched = useMemo(
    () => matchTransactions(quarterDebits, expenses).transactions.sort((a, b) => (a.date < b.date ? 1 : -1)),
    [quarterDebits, expenses]
  );

  // --- Accès au dossier "Cabinet ISRAEL" sur le PC (File System Access API) ---
  const fsSupported = isFileSystemAccessSupported();
  const [folderHandle, setFolderHandle] = useState(null);
  const [folderStatus, setFolderStatus] = useState("checking"); // checking | none | needs-permission | granted | error
  const [filenames, setFilenames] = useState(null); // null = pas encore vérifié
  const [scanning, setScanning] = useState(false);
  const [fsError, setFsError] = useState("");

  const scanFolder = async (handle) => {
    setScanning(true);
    setFsError("");
    try {
      const names = await listAllFilenames(handle);
      setFilenames(names);
    } catch (err) {
      console.error("Lecture du dossier impossible :", err);
      setFsError("Impossible de lire le contenu du dossier. Réessaie, ou reconnecte le dossier.");
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (!fsSupported) {
      setFolderStatus("none");
      return;
    }
    let cancelled = false;
    loadCabinetFolderHandle().then(async (handle) => {
      if (cancelled) return;
      if (!handle) {
        setFolderStatus("none");
        return;
      }
      setFolderHandle(handle);
      const ok = await hasReadPermission(handle);
      if (cancelled) return;
      if (ok) {
        setFolderStatus("granted");
        scanFolder(handle);
      } else {
        setFolderStatus("needs-permission");
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fsSupported]);

  const connectFolder = async () => {
    try {
      const handle = await pickCabinetFolder();
      setFolderHandle(handle);
      setFolderStatus("granted");
      scanFolder(handle);
    } catch (err) {
      // L'utilisateur a annulé la sélection — pas une vraie erreur.
      if (err?.name !== "AbortError") {
        console.error("Sélection du dossier impossible :", err);
        setFsError("Impossible d'accéder à ce dossier.");
      }
    }
  };

  const reconnectFolder = async () => {
    const ok = await requestReadPermission(folderHandle);
    if (ok) {
      setFolderStatus("granted");
      scanFolder(folderHandle);
    }
  };

  const fileCheckAvailable = folderStatus === "granted" && filenames !== null;

  // --- Lignes du tableau : une par opération débitée du trimestre ---
  const rows = useMemo(
    () =>
      matched.map((t) => {
        const saisi = t.matched;
        let fichier = null;
        if (saisi && fileCheckAvailable) {
          fichier = t.matchedExpenses.every((e) => !!findLocalFileForExpense(e, filenames));
        }
        return {
          id: t.id ?? txSignature(t),
          date: t.date,
          label: t.label,
          amount: Math.abs(t.amount),
          saisi,
          fichier,
          matchedExpenses: t.matchedExpenses,
        };
      }),
    [matched, fileCheckAvailable, filenames]
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const saisiCount = rows.filter((r) => r.saisi).length;
    const fichierManquant = fileCheckAvailable
      ? rows.filter((r) => r.saisi && r.fichier === false).length
      : null;
    return { total, saisiCount, nonSaisiCount: total - saisiCount, fichierManquant };
  }, [rows, fileCheckAvailable]);

  const exportXlsx = () => {
    downloadPointageAsXlsx({
      filename: `Pointage justificatifs - ${quarterLabel(selectedQuarter || quarters[0])}.xlsx`,
      quarterLabel: quarterLabel(selectedQuarter || quarters[0]),
      rows,
      fileCheckAvailable,
    });
  };

  const loading = statementsLoading || expensesLoading;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <ClipboardCheck size={20} className="text-sky-400" />
          Pointage justificatifs
        </h1>
        <p className="text-slate-400 text-sm">
          Une ligne par opération débitée sur ton relevé bancaire, avec deux contrôles : est-elle saisie dans
          Alfred, et son fichier est-il bien présent sur ton PC. De quoi vérifier d'un coup d'œil qu'il ne manque
          rien avant d'envoyer au comptable.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Trimestre</label>
            <select
              value={selectedQuarter || quarters[0]}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            >
              {quarters.map((q) => (
                <option key={q} value={q}>
                  {quarterLabel(q)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={exportXlsx}
            disabled={rows.length === 0}
            className="flex items-center gap-2 text-sm rounded-lg border border-slate-700 px-3 py-2 text-slate-200 hover:bg-slate-800 transition disabled:opacity-50 disabled:pointer-events-none"
          >
            <FileDown size={16} />
            Exporter en .xlsx
          </button>
        </div>

        {/* Bloc accès dossier PC */}
        {!fsSupported ? (
          <div className="flex items-start gap-3 bg-slate-800/60 border border-slate-700 rounded-lg p-3 mb-4 text-sm">
            <AlertTriangle size={16} className="text-amber-300 shrink-0 mt-0.5" />
            <p className="text-slate-300">
              Ton navigateur ne permet pas de vérifier automatiquement les fichiers sur ton PC (fonctionne sur
              Chrome ou Edge). Le pointage "Saisi dans Alfred" reste disponible ci-dessous.
            </p>
          </div>
        ) : folderStatus === "none" ? (
          <button
            type="button"
            onClick={connectFolder}
            className="flex items-center gap-2 text-sm rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-sky-200 hover:bg-sky-400/20 transition mb-4"
          >
            <FolderOpen size={16} />
            Autoriser l'accès à mon dossier de justificatifs (une seule fois)
          </button>
        ) : folderStatus === "needs-permission" ? (
          <button
            type="button"
            onClick={reconnectFolder}
            className="flex items-center gap-2 text-sm rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-amber-200 hover:bg-amber-400/20 transition mb-4"
          >
            <RefreshCw size={16} />
            Se reconnecter au dossier de justificatifs
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
            <CheckCircle2 size={14} className="text-emerald-400" />
            {scanning
              ? "Lecture du dossier en cours…"
              : `Dossier connecté — ${filenames?.length ?? 0} fichier(s) trouvé(s).`}
            <button
              type="button"
              onClick={() => scanFolder(folderHandle)}
              className="text-slate-400 hover:text-slate-200 transition ml-1"
              title="Relire le dossier"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        )}
        {fsError && <p className="text-xs text-red-400 mb-4">{fsError}</p>}

        {loading ? (
          <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">
            Aucune opération débitée trouvée pour ce trimestre — importe ton relevé bancaire depuis la page
            Dépenses.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400 mb-4">
              <span>{stats.total} opération(s)</span>
              <span className="text-emerald-300">{stats.saisiCount} saisie(s) dans Alfred</span>
              {stats.nonSaisiCount > 0 && (
                <span className="text-amber-300">{stats.nonSaisiCount} non saisie(s)</span>
              )}
              {fileCheckAvailable && stats.fichierManquant > 0 && (
                <span className="text-red-400">{stats.fichierManquant} fichier(s) manquant(s) sur le PC</span>
              )}
            </div>

            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                    <th className="px-5 py-2 font-normal">Date</th>
                    <th className="px-2 py-2 font-normal">Opération</th>
                    <th className="px-2 py-2 font-normal text-right">Montant</th>
                    <th className="px-2 py-2 font-normal text-center">Saisi Alfred</th>
                    <th className="px-5 py-2 font-normal text-center">Fichier PC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-2.5 text-slate-400 whitespace-nowrap">{r.date}</td>
                      <td className="px-2 py-2.5 text-slate-200 truncate max-w-xs">{r.label}</td>
                      <td className="px-2 py-2.5 text-slate-200 text-right whitespace-nowrap">
                        {eur.format(r.amount)}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {r.saisi ? (
                          <CheckCircle2 size={16} className="text-emerald-400 inline" />
                        ) : (
                          <XCircle size={16} className="text-amber-400 inline" />
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        {!fileCheckAvailable ? (
                          <MinusCircle size={16} className="text-slate-600 inline" title="Non vérifié" />
                        ) : !r.saisi ? (
                          <MinusCircle size={16} className="text-slate-600 inline" title="Rien à vérifier — non saisie" />
                        ) : r.fichier ? (
                          <CheckCircle2 size={16} className="text-emerald-400 inline" />
                        ) : (
                          <XCircle size={16} className="text-red-400 inline" title="Fichier introuvable sur le PC" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
