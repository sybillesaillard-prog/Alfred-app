import { useMemo, useState } from "react";
import { Landmark, ClipboardList, EyeOff, RotateCcw } from "lucide-react";
import { txSignature, matchTransactions } from "../lib/bankTx";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const todayISO = () => new Date().toISOString().slice(0, 10);

function normalizeDate(raw) {
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return todayISO();
}

function normalizeHeader(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // enlève les accents
    .trim();
}

function parseAmount(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

// Les exports bancaires réels ont souvent bien plus que 3 colonnes (date
// comptable, libellé, référence, débit, crédit, date de valeur, pointage…),
// avec le débit/crédit dans des colonnes séparées — pas forcément en dernière
// position. On repère les colonnes par leur nom d'en-tête plutôt que par leur
// position, et on se rabat sur l'ancienne heuristique (montant = dernière
// colonne numérique) seulement si aucun en-tête reconnu n'est trouvé.
function parseBankCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const rows = lines.map((l) => l.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, "")));

  const headerNorm = rows[0].map(normalizeHeader);
  const findCol = (patterns) => headerNorm.findIndex((h) => patterns.some((p) => p.test(h)));

  const dateIdx = findCol([/^date/]);
  const labelIdx = findCol([/libell/, /description/, /intitul/]);
  const debitIdx = findCol([/^debit/]);
  const creditIdx = findCol([/^credit/]);
  const amountIdx = findCol([/^montant/, /^amount/]);

  const hasNamedHeader = dateIdx !== -1 && (debitIdx !== -1 || creditIdx !== -1 || amountIdx !== -1);
  const dataRows = hasNamedHeader ? rows.slice(1) : rows;

  return dataRows
    .map((cols, i) => {
      if (cols.length < 2) return null;
      let amount = null;
      const dateRaw = dateIdx !== -1 ? cols[dateIdx] : cols[0];
      let label = labelIdx !== -1 ? cols[labelIdx] : null;

      if (hasNamedHeader) {
        const debitVal = debitIdx !== -1 ? parseAmount(cols[debitIdx]) : null;
        const creditVal = creditIdx !== -1 ? parseAmount(cols[creditIdx]) : null;
        if (debitVal != null && debitVal !== 0) {
          amount = debitVal > 0 ? -debitVal : debitVal; // débit = dépense = négatif
        } else if (creditVal != null && creditVal !== 0) {
          amount = creditVal < 0 ? -creditVal : creditVal; // crédit = entrée = positif
        } else if (amountIdx !== -1) {
          amount = parseAmount(cols[amountIdx]);
        }
        if (label == null) {
          label =
            cols
              .filter((_, idx) => ![dateIdx, debitIdx, creditIdx, amountIdx].includes(idx))
              .join(" ")
              .trim() || "Opération";
        }
      } else {
        // Repli : format simple sans en-tête reconnu (ex : Date;Libellé;Montant)
        for (let c = cols.length - 1; c >= 0; c--) {
          const a = parseAmount(cols[c]);
          if (a != null) {
            amount = a;
            break;
          }
        }
        label = cols.slice(1, cols.length - 1).join(" ").trim() || "Opération";
      }

      if (amount == null || amount === 0) return null;
      return { id: "b" + i, date: normalizeDate(dateRaw || ""), label: label || "Opération", amount };
    })
    .filter(Boolean);
}

function simulateBankTransactionsFromPdf(items) {
  const covered = items.slice(0, Math.ceil(items.length * 0.7));
  const base = covered.map((d, i) => ({
    id: "b" + i,
    date: d.date,
    label: (d.fournisseur || d.note || "OPERATION").toUpperCase() + " CB",
    amount: -(d.ttc ?? d.amount ?? 0),
  }));
  const extras = [
    { id: "bx1", date: todayISO(), label: "PRLV EDF ENERGIE", amount: -64.3 },
    { id: "bx2", date: todayISO(), label: "CB RESTAURANT LE MARCHE", amount: -38.5 },
    { id: "bx3", date: todayISO(), label: "CB FNAC.COM", amount: -112.9 },
  ];
  return [...base, ...extras];
}

export default function BankReconciliation({
  items,
  tasks,
  onCreateTask,
  latestStatement,
  bankTransactions,
  addStatement,
  statementsLoading,
}) {
  const [status, setStatus] = useState("");
  const [createdIds, setCreatedIds] = useState(new Set());

  // Tâches déjà créées pour une opération bancaire donnée (via le bouton
  // "Créer une tâche" ci-dessous, sur cet appareil ou un autre) — permet de
  // reconnaître qu'un justificatif est déjà "en cours de traitement" et de ne
  // pas la redemander à chaque réimport de relevé ou changement d'appareil,
  // plutôt que de se fier à un état local qui se perdait au rechargement.
  const taskSignatures = useMemo(
    () => new Set((tasks || []).filter((t) => t.bankTxSignature).map((t) => t.bankTxSignature)),
    [tasks]
  );

  // Le relevé importé (latestStatement/bankTransactions/addStatement) est
  // désormais géré par la page Dépenses (Expenses.jsx) et transmis ici en
  // props — évite d'ouvrir deux écoutes Firestore séparées sur la même
  // collection "bankStatements" (une ici, une dans le nouveau récap mensuel).

  // Opérations écartées définitivement du rapprochement (ex : URSSAF — pas
  // de justificatif à fournir, pas d'impact TVA), sauvegardées comme le
  // reste pour rester ignorées sur tous les appareils.
  const { items: ignored, add: addIgnored, remove: removeIgnored } = useCollection(
    "ignoredTransactions",
    "createdAt"
  );
  const ignoredSignatures = useMemo(() => new Set(ignored.map((i) => i.signature)), [ignored]);

  // Recalculé à chaque changement des dépenses (ajout/édition/suppression) ou
  // d'un nouveau relevé importé — pas seulement au moment de l'import, sinon
  // un justificatif saisi après coup n'apparaît jamais comme "trouvé".
  const { missing, stats, ignoredCount } = useMemo(() => {
    if (!bankTransactions) return { missing: null, stats: "", ignoredCount: 0 };

    const { transactions: txs } = matchTransactions(bankTransactions, items);

    const allMissing = txs.filter((t) => t.amount < 0 && !t.matched);
    const missingTx = allMissing.filter((t) => !ignoredSignatures.has(txSignature(t)));
    return {
      missing: missingTx,
      stats: `${txs.length} opération(s) analysée(s) · ${txs.filter((t) => t.amount < 0).length - allMissing.length} avec justificatif · ${missingTx.length} sans justificatif`,
      ignoredCount: allMissing.length - missingTx.length,
    };
  }, [bankTransactions, items, ignoredSignatures]);

  const [showIgnored, setShowIgnored] = useState(false);

  const ignoreTransaction = (t) => {
    addIgnored({ signature: txSignature(t), date: t.date, label: t.label, amount: t.amount });
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    setStatus("Analyse du relevé en cours…");
    setCreatedIds(new Set());

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf) {
      // Ce prototype de production ne fait pas encore de vraie extraction de
      // texte PDF : on simule des opérations plausibles pour démontrer le
      // rapprochement. À brancher plus tard sur un vrai service de lecture.
      setTimeout(() => {
        const txs = simulateBankTransactionsFromPdf(items);
        addStatement({ filename: file.name, transactions: txs, simulated: true }).then(() => {
          setStatus(
            `Relevé "${file.name}" analysé (lecture PDF simulée — ${txs.length} opération(s) reconstituée(s) à titre de démonstration). Sauvegardé, visible sur tous tes appareils.`
          );
        });
      }, 800);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const txs = parseBankCsv(String(reader.result));
      addStatement({ filename: file.name, transactions: txs, simulated: false }).then(() => {
        setStatus(`Relevé "${file.name}" analysé : ${txs.length} opération(s) trouvée(s). Sauvegardé, visible sur tous tes appareils.`);
      });
    };
    reader.onerror = () => setStatus("Impossible de lire ce fichier CSV.");
    reader.readAsText(file, "utf-8");
  };

  const createTask = (t) => {
    const title = `Obtenir le justificatif — ${t.label} — ${eur.format(Math.abs(t.amount))}`;
    onCreateTask(title, txSignature(t));
    setCreatedIds((prev) => new Set(prev).add(t.id));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
      <h2 className="text-base font-semibold mb-1">Relevé de compte — justificatifs manquants</h2>
      <p className="text-slate-400 text-sm mb-4">
        Importe ton relevé bancaire pour vérifier s'il manque des tickets ou factures par rapport aux opérations réellement débitées.
      </p>

      <label className="cursor-pointer flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-800/70 transition px-4 py-3 mb-3">
        <Landmark size={20} className="text-slate-300 shrink-0" />
        <span className="text-sm">
          <span className="block font-medium text-slate-100">Importer un relevé de compte</span>
          <span className="block text-slate-400 text-xs">CSV export banque (lecture réelle) ou PDF (lecture simulée pour l'instant)</span>
        </span>
        <input type="file" accept=".csv,.pdf" className="hidden" onChange={handleFile} />
      </label>

      {status ? (
        <p className="text-xs text-slate-500 mb-3">{status}</p>
      ) : (
        latestStatement && (
          <p className="text-xs text-slate-500 mb-3">
            Dernier relevé importé : "{latestStatement.filename}" — importe-en un nouveau pour le remplacer.
          </p>
        )
      )}
      {statementsLoading && !latestStatement && (
        <p className="text-xs text-slate-500 mb-3">Chargement du relevé…</p>
      )}

      {missing !== null && (
        <div>
          <p className="text-xs text-slate-400 mb-3">{stats}</p>
          {missing.length === 0 ? (
            <p className="text-sm text-emerald-300">✅ Toutes les opérations du relevé ont un justificatif correspondant.</p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400 mb-1">
                Opérations débitées sans document enregistré — pense à ajouter le ticket ou la facture :
              </p>
              {missing.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/20"
                >
                  <span className="text-sm text-amber-200 truncate">
                    {t.date} · {t.label}
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium text-amber-200">{eur.format(Math.abs(t.amount))}</span>
                    <button
                      type="button"
                      disabled={createdIds.has(t.id) || taskSignatures.has(txSignature(t))}
                      onClick={() => createTask(t)}
                      title={createdIds.has(t.id) || taskSignatures.has(txSignature(t)) ? "Tâche créée" : "Créer une tâche"}
                      aria-label={createdIds.has(t.id) || taskSignatures.has(txSignature(t)) ? "Tâche créée" : "Créer une tâche"}
                      className="flex items-center justify-center rounded-md border border-amber-300/40 text-amber-200 p-1.5 hover:bg-amber-400/20 transition disabled:opacity-60 disabled:pointer-events-none shrink-0"
                    >
                      <ClipboardList size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => ignoreTransaction(t)}
                      title="Ignorer définitivement cette opération (ex : URSSAF, pas de justificatif à fournir)"
                      aria-label="Ignorer définitivement cette opération"
                      className="flex items-center justify-center rounded-md border border-slate-600 text-slate-400 p-1.5 hover:bg-slate-700/60 hover:text-slate-200 transition shrink-0"
                    >
                      <EyeOff size={15} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {ignoredCount > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowIgnored((v) => !v)}
                className="text-xs text-slate-500 hover:text-slate-300 transition"
              >
                {showIgnored ? "Masquer" : "Afficher"} les {ignoredCount} opération(s) ignorée(s)
              </button>
              {showIgnored && (
                <div className="space-y-1.5 mt-2">
                  {ignored.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700"
                    >
                      <span className="text-sm text-slate-400 truncate">
                        {i.date} · {i.label}
                      </span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-medium text-slate-400">{eur.format(Math.abs(i.amount))}</span>
                        <button
                          type="button"
                          onClick={() => removeIgnored(i.id)}
                          title="Réafficher cette opération dans les justificatifs manquants"
                          className="flex items-center gap-1 text-xs rounded-md border border-slate-600 text-slate-300 px-2 py-1 hover:bg-slate-700 transition whitespace-nowrap"
                        >
                          <RotateCcw size={13} />
                          Réafficher
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
