import { useMemo, useState } from "react";
import { TrendingUp, FileSpreadsheet, FileDown } from "lucide-react";
import { useCollection } from "../lib/useCollection";
import { EXPENSE_CATEGORIES } from "../lib/expenseCategories";
import { monthKeyOf, monthLabelFr, average } from "../lib/fixedCharges";
import { downloadTableAsXlsx } from "../lib/xlsxExport";
import { generateMonthlyMatrixPdf, downloadBlob } from "../lib/pdf";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eurCompact = (v) => (v ? eur.format(v) : "—");

// Historique suivi depuis janvier 2026 (demande explicite de Sybille,
// 23/08/2026) — les mois antérieurs, s'il y en avait, ne sont pas affichés.
const HISTORY_START = "2026-01";

export default function VariableCharges() {
  const { items: expenses, loading } = useCollection("expenses", "date");
  const [exporting, setExporting] = useState(false);

  const months = useMemo(() => {
    const set = new Set(
      expenses.map((e) => monthKeyOf(e.date)).filter((m) => m && m >= HISTORY_START)
    );
    return Array.from(set).sort();
  }, [expenses]);

  const matrix = useMemo(() => {
    // { categoryId: { "2026-01": montant, ... } }
    const m = {};
    for (const c of EXPENSE_CATEGORIES) m[c.id] = {};
    for (const e of expenses) {
      const mk = monthKeyOf(e.date);
      if (!mk || mk < HISTORY_START) continue;
      const catId = EXPENSE_CATEGORIES.some((c) => c.id === e.category) ? e.category : "autre";
      const amt = e.ttc ?? e.amount ?? 0;
      m[catId][mk] = (m[catId][mk] || 0) + amt;
    }
    return m;
  }, [expenses]);

  const totalsByMonth = useMemo(() => {
    const t = {};
    months.forEach((mk) => (t[mk] = 0));
    for (const c of EXPENSE_CATEGORIES) {
      months.forEach((mk) => {
        t[mk] += matrix[c.id]?.[mk] || 0;
      });
    }
    return t;
  }, [matrix, months]);

  const buildRows = () =>
    EXPENSE_CATEGORIES.map((c) => {
      const values = months.map((mk) => matrix[c.id]?.[mk] || 0);
      return { label: c.label, values, average: average(values) };
    });

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const rows = buildRows();
      const totalValues = months.map((mk) => totalsByMonth[mk]);
      await downloadTableAsXlsx({
        filename: `charges-variables-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: "Charges variables",
        monthLabels: months.map(monthLabelFr),
        rows,
        totalRow: { label: "TOTAL DÉPENSES", values: totalValues, average: average(totalValues) },
      });
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = () => {
    const rows = buildRows();
    const totalValues = months.map((mk) => totalsByMonth[mk]);
    const blob = generateMonthlyMatrixPdf({
      title: "Charges variables — historique par catégorie",
      monthLabels: months.map(monthLabelFr),
      rows,
      totalRow: { label: "Total dépenses", values: totalValues, average: average(totalValues) },
    });
    downloadBlob(blob, `charges-variables-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-2">
        <h1 className="text-xl font-semibold">Charges variables</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportPdf}
            disabled={months.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 text-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50"
          >
            <FileDown size={16} />
            PDF
          </button>
          <button
            onClick={exportXlsx}
            disabled={exporting || months.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 text-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50"
          >
            <FileSpreadsheet size={16} />
            {exporting ? "Export…" : "Exporter en XLS"}
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
        <p className="text-slate-400 text-sm flex items-start gap-2">
          <TrendingUp size={16} className="shrink-0 mt-0.5 text-slate-500" />
          <span>
            Historique de tes dépenses enregistrées (module Dépenses), regroupées par catégorie et par mois depuis
            janvier 2026. Se met à jour tout seul à chaque dépense ajoutée, modifiée ou supprimée — aucune saisie
            séparée n'est nécessaire ici.
          </span>
        </p>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>
      ) : months.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
          <p className="text-slate-400 text-sm">
            Aucune dépense enregistrée depuis janvier 2026 pour l'instant — ce tableau se remplira automatiquement au
            fur et à mesure de tes saisies dans Dépenses.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-5 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="sticky left-0 bg-slate-900 pr-3 py-2 font-medium min-w-[200px]">Catégorie</th>
                {months.map((m) => (
                  <th key={m} className="pr-3 py-2 font-medium text-right whitespace-nowrap">
                    {monthLabelFr(m)}
                  </th>
                ))}
                <th className="pr-3 py-2 font-medium text-right whitespace-nowrap">Moyenne</th>
              </tr>
            </thead>
            <tbody>
              {EXPENSE_CATEGORIES.map((c) => {
                const rowValues = months.map((m) => matrix[c.id]?.[m] || 0);
                return (
                  <tr key={c.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                    <td className="sticky left-0 bg-slate-900 pr-3 py-2 text-slate-100">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        {c.label}
                      </span>
                    </td>
                    {rowValues.map((v, i) => (
                      <td key={months[i]} className="pr-3 py-2 text-right text-slate-200 whitespace-nowrap">
                        {eurCompact(v)}
                      </td>
                    ))}
                    <td className="pr-3 py-2 text-right text-slate-200 whitespace-nowrap">
                      {eurCompact(average(rowValues))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-700">
                <td className="sticky left-0 bg-slate-900 py-2 text-sm font-semibold text-slate-100">
                  Total dépenses
                </td>
                {months.map((m) => (
                  <td key={m} className="py-2 text-right text-sm font-semibold text-sky-300">
                    {eurCompact(totalsByMonth[m])}
                  </td>
                ))}
                <td className="py-2 text-right text-sm font-semibold text-sky-300">
                  {eurCompact(average(months.map((m) => totalsByMonth[m])))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
