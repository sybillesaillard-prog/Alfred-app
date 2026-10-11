// Page "Clôture" (07/10, demande de Sybille : "checklist de clôture
// trimestrielle") — une page séparée (choix fait avec elle, AskUserQuestion)
// qui récapitule, trimestre par trimestre, ce qu'il reste à vérifier avant
// d'envoyer au comptable / de déclarer la TVA. Mélange volontaire de deux
// types de contrôle :
// - automatiques, recalculés à chaque ouverture depuis les données déjà
//   dans Alfred (dépenses/recettes rapprochées avec le relevé bancaire,
//   doublons en attente, TVA à payer estimée) — jamais mémorisés à part,
//   pour ne jamais afficher un ✅ périmé ;
// - manuels (fichiers vérifiés sur la page Pointage, TVA réellement
//   déclarée) — des points qu'Alfred ne peut pas constater lui-même, donc
//   mémorisés tels que Sybille les coche (cf. closingChecklist.js).
import { useEffect, useMemo, useState } from "react";
import { ListChecks, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../lib/useCollection";
import { dedupeTransactions, matchTransactions, matchRevenueTransactions } from "../lib/bankTx";
import { quarterKey, quarterLabel, quarterRange } from "../lib/vat";
import { findDuplicateExpenses } from "../lib/duplicates";
import { getDismissedGroupKeys } from "../lib/duplicatesDismissed";
import { getClosingChecklist, setClosingChecklist } from "../lib/closingChecklist";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const todayISO = () => new Date().toISOString().slice(0, 10);

function Check({ ok, label, detail }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700">
      {ok ? (
        <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
      ) : (
        <XCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <p className="text-sm text-slate-100">{label}</p>
        {detail && <p className="text-xs text-slate-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

export default function Closing() {
  const { user } = useAuth();
  const { items: statements, loading: statementsLoading } = useCollection("bankStatements", "createdAt");
  const { items: expenses, loading: expensesLoading } = useCollection("expenses", "date");
  const { items: revenues, loading: revenuesLoading } = useCollection("revenues", "date");

  const allTransactions = useMemo(() => dedupeTransactions(statements), [statements]);

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

  const activeQuarter = selectedQuarter || quarters[0];
  const range = useMemo(() => quarterRange(activeQuarter), [activeQuarter]);

  const quarterDebits = useMemo(
    () => allTransactions.filter((t) => t.amount < 0 && t.date >= range.start && t.date <= range.end),
    [allTransactions, range]
  );
  const quarterCredits = useMemo(
    () => allTransactions.filter((t) => t.amount > 0 && t.date >= range.start && t.date <= range.end),
    [allTransactions, range]
  );
  const quarterExpenses = useMemo(
    () => expenses.filter((e) => e.date >= range.start && e.date <= range.end),
    [expenses, range]
  );
  const quarterRevenues = useMemo(
    () => revenues.filter((r) => r.date >= range.start && r.date <= range.end),
    [revenues, range]
  );

  const expensesMissing = useMemo(
    () => matchTransactions(quarterDebits, quarterExpenses).transactions.filter((t) => !t.matched).length,
    [quarterDebits, quarterExpenses]
  );
  const revenuesMissing = useMemo(
    () => matchRevenueTransactions(quarterCredits, quarterRevenues).transactions.filter((t) => t.amount > 0 && !t.matched).length,
    [quarterCredits, quarterRevenues]
  );

  // Doublons en attente — toutes périodes confondues (la collection
  // "expenses" ne porte pas de notion de trimestre pour ce contrôle, cf.
  // duplicates.js), moins ceux déjà écartés par Sybille sur /doublons.
  const [pendingDuplicates, setPendingDuplicates] = useState(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const groups = findDuplicateExpenses(expenses);
    getDismissedGroupKeys(user.uid).then((dismissed) => {
      if (cancelled) return;
      const dismissedSet = new Set(dismissed);
      const pending = groups.filter((g) => !dismissedSet.has(g.items.map((e) => e.id).join("-")));
      setPendingDuplicates(pending.length);
    });
    return () => {
      cancelled = true;
    };
  }, [user, expenses]);

  const quarterTVACollectee = quarterRevenues.reduce((s, r) => s + (r.tva ?? 0), 0);
  const quarterTVADeductible = quarterExpenses.reduce((s, e) => s + (e.tva ?? 0), 0);
  const quarterTVAAPayer = quarterTVACollectee - quarterTVADeductible;

  // --- Checklist manuelle (persistée par trimestre) ---
  const [checklist, setChecklistState] = useState(null);
  useEffect(() => {
    if (!user || !activeQuarter) return;
    let cancelled = false;
    getClosingChecklist(user.uid, activeQuarter).then((c) => {
      if (!cancelled) setChecklistState(c);
    });
    return () => {
      cancelled = true;
    };
  }, [user, activeQuarter]);

  const toggleFilesChecked = () => {
    if (!user || !checklist) return;
    const next = { ...checklist, filesChecked: !checklist.filesChecked };
    setChecklistState(next);
    setClosingChecklist(user.uid, activeQuarter, next);
  };

  const toggleVatDeclared = () => {
    if (!user || !checklist) return;
    const next = {
      ...checklist,
      vatDeclared: !checklist.vatDeclared,
      vatDeclaredOn: !checklist.vatDeclared ? todayISO() : null,
    };
    setChecklistState(next);
    setClosingChecklist(user.uid, activeQuarter, next);
  };

  const loading = statementsLoading || expensesLoading || revenuesLoading;

  const allAutoOk = expensesMissing === 0 && revenuesMissing === 0 && (pendingDuplicates ?? 0) === 0;
  const allOk = allAutoOk && checklist?.filesChecked && checklist?.vatDeclared;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <ListChecks size={20} className="text-sky-400" />
          Clôture trimestrielle
        </h1>
        <p className="text-slate-400 text-sm">
          Ce qu'il reste à vérifier avant d'envoyer au comptable et de déclarer la TVA — reprend les contrôles déjà
          faits ailleurs dans Alfred (Pointage, Doublons, Recettes), rassemblés ici trimestre par trimestre.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
        <div className="mb-4">
          <label className="block text-xs text-slate-500 mb-1">Trimestre</label>
          <select
            value={activeQuarter}
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

        {loading ? (
          <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>
        ) : (
          <div className="space-y-2.5">
            <Check
              ok={expensesMissing === 0}
              label="Dépenses rapprochées avec le relevé bancaire"
              detail={
                expensesMissing === 0
                  ? "Toutes les opérations débitées du trimestre ont une dépense correspondante."
                  : `${expensesMissing} opération(s) débitée(s) sans dépense enregistrée — voir la page Dépenses.`
              }
            />
            <Check
              ok={revenuesMissing === 0}
              label="Recettes rapprochées avec le relevé bancaire"
              detail={
                revenuesMissing === 0
                  ? "Toutes les entrées créditées du trimestre ont une recette correspondante."
                  : `${revenuesMissing} entrée(s) créditée(s) sans recette enregistrée — voir la page Recettes.`
              }
            />
            <Check
              ok={(pendingDuplicates ?? 0) === 0}
              label="Aucun doublon en attente de vérification"
              detail={
                pendingDuplicates === null
                  ? "Vérification en cours…"
                  : pendingDuplicates === 0
                  ? "Aucun doublon probable en attente (toutes périodes confondues)."
                  : `${pendingDuplicates} groupe(s) de doublons probables à vérifier — voir la page Doublons.`
              }
            />

            <button
              type="button"
              onClick={toggleFilesChecked}
              disabled={!checklist}
              className="w-full text-left"
            >
              <Check
                ok={!!checklist?.filesChecked}
                label="Fichiers justificatifs vérifiés sur le PC (coche une fois vérifié sur Pointage)"
                detail="Contrôle non automatique ici — va sur la page Pointage pour le vérifier, puis coche cette ligne."
              />
            </button>

            <div className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-3">
              <p className="text-sm text-slate-100 mb-1">TVA à payer ce trimestre (estimée)</p>
              <p className="text-lg font-semibold text-slate-100">{eur.format(quarterTVAAPayer)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {eur.format(quarterTVACollectee)} collectée − {eur.format(quarterTVADeductible)} déductible — à
                confirmer avec ton comptable, ce n'est pas un calcul fiscal officiel.
              </p>
            </div>

            <button
              type="button"
              onClick={toggleVatDeclared}
              disabled={!checklist}
              className="w-full text-left"
            >
              <Check
                ok={!!checklist?.vatDeclared}
                label="TVA déclarée pour ce trimestre"
                detail={
                  checklist?.vatDeclared && checklist?.vatDeclaredOn
                    ? `Déclarée le ${checklist.vatDeclaredOn}.`
                    : "Coche une fois la déclaration faite (impots.gouv.fr ou via ton comptable)."
                }
              />
            </button>

            <div
              className={`rounded-lg border px-3 py-3 mt-2 ${
                allOk ? "bg-emerald-400/10 border-emerald-400/30" : "bg-slate-800/40 border-slate-700"
              }`}
            >
              <p className={`text-sm font-medium ${allOk ? "text-emerald-300" : "text-slate-300"}`}>
                {allOk ? "✅ Trimestre prêt à être clôturé." : "Trimestre pas encore prêt — des points restent à traiter ci-dessus."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/pointage"
                className="flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200 transition"
              >
                <ExternalLink size={13} />
                Aller à Pointage
              </Link>
              <Link
                to="/doublons"
                className="flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200 transition"
              >
                <ExternalLink size={13} />
                Aller à Doublons
              </Link>
              <Link
                to="/recettes"
                className="flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200 transition"
              >
                <ExternalLink size={13} />
                Aller à Recettes
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
