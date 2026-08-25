import { Fragment, useMemo, useState } from "react";
import {
  CalendarClock,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  FileSpreadsheet,
  CalendarCheck2,
  Landmark,
  CheckCircle2,
} from "lucide-react";
import { useCollection } from "../lib/useCollection";
import { dedupeTransactions } from "../lib/bankTx";
import {
  SEED_CATEGORIES,
  SEED_CHARGES,
  monthKeyOf,
  monthLabelFr,
  matchChargeByMonth,
  scheduledChargeSource,
  average,
} from "../lib/fixedCharges";
import { LOANS, getLoanStatus } from "../lib/loans";
import { downloadTableAsXlsx } from "../lib/xlsxExport";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eurCompact = (v) => (v ? eur.format(v) : "—");
const dateFRLong = (iso) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

function ChargeEditForm({ initial, categories, onSave, onCancel }) {
  const [form, setForm] = useState({
    category: initial?.category || "",
    label: initial?.label || "",
    matchKeyword: initial?.matchKeyword || "",
    notes: initial?.notes || "",
  });

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          placeholder="Nom de la charge"
          className="col-span-2 bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm"
        />
        <input
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          placeholder="Catégorie"
          list="fixed-charges-categories"
          className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm"
        />
        <input
          value={form.matchKeyword}
          onChange={(e) => setForm((f) => ({ ...f, matchKeyword: e.target.value }))}
          placeholder="Mot-clé dans le libellé bancaire"
          className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm"
        />
        <input
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Notes (périodicité...)"
          className="col-span-2 bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm"
        />
      </div>
      <datalist id="fixed-charges-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-xs rounded-md border border-slate-600 text-slate-300 px-2 py-1 hover:bg-slate-700 transition"
        >
          <X size={13} />
          Annuler
        </button>
        <button
          type="button"
          onClick={() => form.label.trim() && onSave(form)}
          className="flex items-center gap-1 text-xs rounded-md border border-sky-400/40 text-sky-300 px-2 py-1 hover:bg-sky-400/10 transition"
        >
          <Check size={13} />
          Enregistrer
        </button>
      </div>
    </div>
  );
}

export default function FixedCharges() {
  const { items: charges, loading, add, update, remove } = useCollection("fixedCharges");
  const { items: statements, loading: statementsLoading } = useCollection("bankStatements", "createdAt");

  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const transactions = useMemo(() => dedupeTransactions(statements), [statements]);

  // Prêts bancaires en cours (calendrier d'amortissement officiel, cf.
  // src/lib/loans.js) — capital restant dû et prochaine échéance calculés à
  // partir de la date du jour, indépendamment des relevés bancaires
  // importés (pas de rapprochement ici, ce sont des chiffres officiels).
  const loanStatuses = LOANS.map((loan) => ({ loan, status: getLoanStatus(loan) }));

  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => monthKeyOf(t.date)).filter(Boolean));
    return Array.from(set).sort();
  }, [transactions]);

  const matrix = useMemo(() => {
    const m = {};
    for (const c of charges) m[c.id] = matchChargeByMonth(c, transactions);
    return m;
  }, [charges, transactions]);

  const visibleCharges = useMemo(
    () => charges.filter((c) => (showArchived ? true : !c.archived)),
    [charges, showArchived]
  );

  const categoryNames = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const c of charges) {
      if (c.category && !seen.has(c.category)) {
        seen.add(c.category);
        list.push(c.category);
      }
    }
    for (const c of SEED_CATEGORIES) {
      if (!seen.has(c)) {
        seen.add(c);
        list.push(c);
      }
    }
    return list;
  }, [charges]);

  const groups = useMemo(() => {
    const order = [];
    const map = {};
    for (const c of visibleCharges) {
      const cat = c.category || "Sans catégorie";
      if (!map[cat]) {
        map[cat] = [];
        order.push(cat);
      }
      map[cat].push(c);
    }
    return order.map((category) => ({ category, items: map[category] }));
  }, [visibleCharges]);

  const totalsByMonth = useMemo(() => {
    const t = {};
    months.forEach((m) => (t[m] = 0));
    for (const c of visibleCharges) {
      months.forEach((m) => {
        t[m] += matrix[c.id]?.[m] || 0;
      });
    }
    return t;
  }, [visibleCharges, matrix, months]);

  const seedStarter = async () => {
    setSeeding(true);
    try {
      for (const c of SEED_CHARGES) {
        // eslint-disable-next-line no-await-in-loop -- volontaire : on garde l'ordre du tableau d'origine
        await add({
          category: c.category,
          label: c.label,
          matchKeyword: c.matchKeyword,
          notes: c.notes,
          archived: false,
        });
      }
    } finally {
      setSeeding(false);
    }
  };

  const [exporting, setExporting] = useState(false);
  const exportXlsx = async () => {
    setExporting(true);
    try {
      const monthLabels = months.map(monthLabelFr);
      const rows = [];
      for (const { category, items } of groups) {
        const catValues = months.map((m) => items.reduce((s, c) => s + (matrix[c.id]?.[m] || 0), 0));
        rows.push({ label: category.toUpperCase(), values: catValues, average: average(catValues), bold: true });
        for (const c of items) {
          const rowValues = months.map((m) => matrix[c.id]?.[m] || 0);
          rows.push({ label: `  ${c.label}`, values: rowValues, average: average(rowValues) });
        }
      }
      const totalValues = months.map((m) => totalsByMonth[m]);
      await downloadTableAsXlsx({
        filename: `charges-fixes-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: "Charges fixes",
        monthLabels,
        rows,
        totalRow: { label: "TOTAL CHARGES SUIVIES", values: totalValues, average: average(totalValues) },
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-2">
        <h1 className="text-xl font-semibold">Charges fixes</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportXlsx}
            disabled={exporting || months.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 text-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50"
          >
            <FileSpreadsheet size={16} />
            {exporting ? "Export…" : "Exporter en XLS"}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 bg-sky-400 text-slate-950 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sky-300 transition"
          >
            <Plus size={16} />
            Ajouter
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
        <p className="text-slate-400 text-sm flex items-start gap-2">
          <CalendarClock size={16} className="shrink-0 mt-0.5 text-slate-500" />
          <span>
            Ce suivi se met à jour automatiquement à partir des relevés bancaires importés dans Dépenses → Rapprochement
            bancaire : chaque charge a un mot-clé recherché dans les libellés des opérations débitées, mois par mois.
            Aucune saisie manuelle de montant n'est nécessaire — vérifie juste que le mot-clé de chaque charge correspond
            bien à tes vrais libellés bancaires (colonne "Mot-clé", éditable).
          </span>
        </p>
      </div>

      {loanStatuses.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
            <Landmark size={16} className="text-slate-500" />
            Prêts bancaires en cours
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {loanStatuses.map(({ loan, status }) => (
              <div key={loan.key} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                <p className="text-sm text-slate-100 font-medium">{loan.label}</p>
                <p className="text-xs text-slate-500 mb-2">
                  N° {loan.contractNumber} — {loan.bank}
                </p>
                <p className="text-xs text-slate-400">
                  Capital restant dû
                  <span className="block text-lg font-semibold text-sky-300">{eurCompact(status.remaining)}</span>
                </p>
                {status.next ? (
                  <p className="text-xs text-slate-400 mt-1.5">
                    Prochaine échéance
                    <span className="block text-sm text-slate-200">
                      {dateFRLong(status.next.date)} — {eurCompact(status.next.echeance)}
                    </span>
                  </p>
                ) : (
                  <p className="flex items-center gap-1 text-xs text-emerald-400 mt-1.5">
                    <CheckCircle2 size={12} />
                    Prêt entièrement remboursé
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1.5">
                  Fin de remboursement
                  <span className="block text-sm text-slate-200">{dateFRLong(status.endDate)}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading || statementsLoading ? (
        <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>
      ) : charges.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
          <p className="text-slate-400 text-sm mb-4">
            Aucune charge fixe enregistrée. Tu peux repartir de la liste initiale de ton tableau (à vérifier ensuite),
            ou ajouter tes charges une par une.
          </p>
          <button
            onClick={seedStarter}
            disabled={seeding}
            className="bg-sky-400 text-slate-950 rounded-lg px-4 py-2 text-sm font-medium hover:bg-sky-300 transition disabled:opacity-60"
          >
            {seeding ? "Import en cours…" : "Importer la liste de départ"}
          </button>
        </div>
      ) : (
        <>
          {months.length === 0 && (
            <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-4 mb-4 text-sm text-amber-200">
              Aucun relevé bancaire importé pour l'instant — importe-en un dans Dépenses → Rapprochement bancaire pour
              voir les montants se remplir automatiquement ici.
            </div>
          )}

          {showAddForm && (
            <div className="mb-4">
              <ChargeEditForm
                categories={categoryNames}
                onSave={(data) => {
                  add({ ...data, archived: false });
                  setShowAddForm(false);
                }}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-5 mb-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="sticky left-0 bg-slate-900 pr-3 py-2 font-medium min-w-[220px]">Charge</th>
                  <th className="pr-3 py-2 font-medium min-w-[140px]">Mot-clé</th>
                  {months.map((m) => (
                    <th key={m} className="pr-3 py-2 font-medium text-right whitespace-nowrap">
                      {monthLabelFr(m)}
                    </th>
                  ))}
                  <th className="pr-3 py-2 font-medium text-right whitespace-nowrap">Moyenne</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {groups.map(({ category, items }) => {
                  const catTotals = months.map((m) => items.reduce((s, c) => s + (matrix[c.id]?.[m] || 0), 0));
                  return (
                    <Fragment key={category}>
                      <tr className="bg-slate-800/40">
                        <td
                          colSpan={2}
                          className="sticky left-0 bg-slate-800/40 px-0 py-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wide"
                        >
                          {category}
                        </td>
                        {catTotals.map((v, i) => (
                          <td key={months[i]} className="py-1.5 text-right text-xs text-slate-400">
                            {eurCompact(v)}
                          </td>
                        ))}
                        <td className="py-1.5 text-right text-xs text-slate-400">{eurCompact(average(catTotals))}</td>
                        <td></td>
                      </tr>
                      {items.map((c) => {
                        const rowValues = months.map((m) => matrix[c.id]?.[m] || 0);
                        const isEditing = editingId === c.id;
                        const scheduleSource = scheduledChargeSource(c);
                        if (isEditing) {
                          return (
                            <tr key={c.id}>
                              <td colSpan={months.length + 3} className="py-2">
                                <ChargeEditForm
                                  initial={c}
                                  categories={categoryNames}
                                  onSave={(data) => {
                                    update(c.id, data);
                                    setEditingId(null);
                                  }}
                                  onCancel={() => setEditingId(null)}
                                />
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={c.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                            <td className="sticky left-0 bg-slate-900 pr-3 py-2 text-slate-100">
                              <div className="flex items-center gap-1.5">
                                {c.archived && <Archive size={12} className="text-slate-600 shrink-0" />}
                                <span className={c.archived ? "text-slate-500 line-through" : ""}>{c.label}</span>
                              </div>
                              {c.notes && <p className="text-xs text-slate-500">{c.notes}</p>}
                            </td>
                            <td className="pr-3 py-2 text-slate-400">
                              {scheduleSource === "allianz" ? (
                                <span
                                  className="flex items-center gap-1 text-xs text-emerald-300/90"
                                  title="Montant ventilé depuis le calendrier officiel Allianz, pas depuis le libellé bancaire"
                                >
                                  <CalendarCheck2 size={12} />
                                  Calendrier Allianz
                                </span>
                              ) : scheduleSource === "loan" ? (
                                <span
                                  className="flex items-center gap-1 text-xs text-emerald-300/90"
                                  title="Montant ventilé depuis le tableau d'amortissement officiel du prêt, pas depuis le libellé bancaire"
                                >
                                  <CalendarCheck2 size={12} />
                                  Tableau d'amortissement
                                </span>
                              ) : c.matchKeyword ? (
                                <code className="text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">
                                  {c.matchKeyword}
                                </code>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-amber-300/80">
                                  <AlertTriangle size={12} />
                                  à définir
                                </span>
                              )}
                            </td>
                            {rowValues.map((v, i) => (
                              <td key={months[i]} className="pr-3 py-2 text-right text-slate-200 whitespace-nowrap">
                                {eurCompact(v)}
                              </td>
                            ))}
                            <td className="pr-3 py-2 text-right text-slate-200 whitespace-nowrap">
                              {eurCompact(average(rowValues))}
                            </td>
                            <td className="py-2">
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setEditingId(c.id)}
                                  className="text-slate-500 hover:text-slate-200 p-1"
                                  title="Modifier"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => update(c.id, { archived: !c.archived })}
                                  className="text-slate-500 hover:text-slate-200 p-1"
                                  title={c.archived ? "Réactiver cette charge" : "Archiver (charge qui n'existe plus)"}
                                >
                                  {c.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => remove(c.id)}
                                  className="text-slate-500 hover:text-red-400 p-1"
                                  title="Supprimer définitivement"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-700">
                  <td colSpan={2} className="sticky left-0 bg-slate-900 py-2 text-sm font-semibold text-slate-100">
                    Total charges suivies
                  </td>
                  {months.map((m) => (
                    <td key={m} className="py-2 text-right text-sm font-semibold text-sky-300">
                      {eurCompact(totalsByMonth[m])}
                    </td>
                  ))}
                  <td className="py-2 text-right text-sm font-semibold text-sky-300">
                    {eurCompact(average(months.map((m) => totalsByMonth[m])))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <button
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-300 transition"
          >
            {showArchived ? "Masquer" : "Afficher"} les charges archivées
          </button>
        </>
      )}
    </div>
  );
}
