import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight, FileText, Camera, FileDown } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useCollection } from "../lib/useCollection";
import { categoryInfo } from "../lib/expenseCategories";
import { matchTransactions } from "../lib/bankTx";
import { generateMatchedExpensesPdf, generateMissingTransactionsPdf, downloadBlob } from "../lib/pdf";
import ExpenseForm from "../components/ExpenseForm";
import QuarterlyVat from "../components/QuarterlyVat";
import BankReconciliation from "../components/BankReconciliation";

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const monthLabel = (d) =>
  d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

export default function Expenses() {
  const { items, loading, add, update, remove } = useCollection("expenses", "date");
  const { items: tasks, add: addTask } = useCollection("tasks");
  const [cursor, setCursor] = useState(() => new Date());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);

  const monthExpenses = useMemo(() => {
    return items
      .filter((e) => {
        const d = new Date(e.date);
        return d >= monthStart && d < monthEnd;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [items, cursor]);

  const totalTTC = monthExpenses.reduce((s, e) => s + (e.ttc ?? e.amount ?? 0), 0);
  const totalHT = monthExpenses.reduce((s, e) => s + (e.ht ?? e.ttc ?? e.amount ?? 0), 0);
  const totalTVA = monthExpenses.reduce((s, e) => s + (e.tva ?? 0), 0);

  const byCategory = useMemo(() => {
    const map = {};
    for (const e of monthExpenses) {
      map[e.category] = (map[e.category] || 0) + (e.ttc ?? e.amount ?? 0);
    }
    return Object.entries(map)
      .map(([id, value]) => ({ id, value, ...categoryInfo(id) }))
      .sort((a, b) => b.value - a.value);
  }, [monthExpenses]);

  const grouped = useMemo(() => {
    const map = {};
    for (const e of monthExpenses) {
      (map[e.date] ||= []).push(e);
    }
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [monthExpenses]);

  const existingFilenames = useMemo(
    () => items.map((e) => e.filename).filter(Boolean),
    [items]
  );

  // Relevé bancaire importé — géré ici (plutôt que dans BankReconciliation)
  // pour qu'une seule écoute Firestore serve à la fois le rapprochement
  // détaillé (toutes périodes) et le récap PDF mensuel ci-dessous.
  const { items: statements, add: addStatement, loading: statementsLoading } = useCollection(
    "bankStatements",
    "createdAt"
  );
  const latestStatement = statements[0] || null;
  const bankTransactions = latestStatement?.transactions ?? null;

  // Rapprochement borné au mois consulté (le rapprochement détaillé plus bas
  // reste, lui, sur toutes les périodes) — sert uniquement aux deux récaps
  // PDF téléchargeables ci-dessous.
  const monthlyReconciliation = useMemo(() => {
    if (!bankTransactions) return null;
    const monthlyBankTx = bankTransactions.filter((t) => {
      const d = new Date(t.date);
      return d >= monthStart && d < monthEnd && t.amount < 0;
    });
    const { transactions, expenses: annotated } = matchTransactions(monthlyBankTx, items);
    const matchedIds = new Set(annotated.filter((e) => e.matched).map((e) => e.id));
    return {
      matchedExpenses: monthExpenses.filter((e) => matchedIds.has(e.id)),
      missingTransactions: transactions.filter((t) => !t.matched),
    };
  }, [bankTransactions, items, monthExpenses, cursor]);

  const downloadMatchedPdf = () => {
    if (!monthlyReconciliation) return;
    const blob = generateMatchedExpensesPdf({
      monthLabel: monthLabel(cursor),
      matchedExpenses: monthlyReconciliation.matchedExpenses,
    });
    downloadBlob(blob, `Justificatifs rapproches - ${monthLabel(cursor)}.pdf`);
  };

  const downloadMissingPdf = () => {
    if (!monthlyReconciliation) return;
    const blob = generateMissingTransactionsPdf({
      monthLabel: monthLabel(cursor),
      missingTransactions: monthlyReconciliation.missingTransactions,
    });
    downloadBlob(blob, `Operations sans justificatif - ${monthLabel(cursor)}.pdf`);
  };

  // On mémorise la signature de l'opération bancaire sur la tâche créée, pour
  // que le rapprochement (BankReconciliation) puisse reconnaître qu'une
  // opération a déjà été signalée et ne pas la redemander à chaque réimport
  // de relevé ou changement d'appareil.
  const createTaskFromReconciliation = (title, bankTxSignature) => {
    addTask({ title, category: "pro", priority: "normale", dueDate: "", done: false, bankTxSignature });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Dépenses</h1>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 bg-sky-400 text-slate-950 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sky-300 transition"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 mb-4">
        <button
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
          className="p-1.5 text-slate-400 hover:text-slate-100"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium capitalize">
          {monthLabel(cursor)}
        </span>
        <button
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
          className="p-1.5 text-slate-400 hover:text-slate-100"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-3">
            <p className="text-xs text-slate-400">Total HT</p>
            <p className="text-lg font-semibold mt-1">{eur.format(totalHT)}</p>
          </div>
          <div className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-3">
            <p className="text-xs text-slate-400">TVA</p>
            <p className="text-lg font-semibold mt-1 text-amber-300">{eur.format(totalTVA)}</p>
          </div>
          <div className="rounded-lg bg-sky-400/10 border border-sky-400/30 px-3 py-3">
            <p className="text-xs text-sky-300">Total TTC</p>
            <p className="text-lg font-semibold mt-1 text-sky-300">{eur.format(totalTTC)}</p>
          </div>
        </div>

        {byCategory.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={32}
                    outerRadius={54}
                    stroke="none"
                  >
                    {byCategory.map((c) => (
                      <Cell key={c.id} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => eur.format(v)}
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {byCategory.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: c.color }}
                    />
                    {c.label}
                  </span>
                  <span className="text-slate-400">{eur.format(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>
      ) : grouped.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">
          Aucune dépense ce mois-ci.
        </p>
      ) : (
        <div className="space-y-5 mb-4">
          {grouped.map(([date, exps]) => (
            <div key={date}>
              <p className="text-xs text-slate-500 mb-2 px-1">
                {new Date(date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
                {exps.map((e) => {
                  const cat = categoryInfo(e.category);
                  const title = e.fournisseur || e.note || cat.label;
                  return (
                    <button
                      key={e.id}
                      onClick={() => {
                        setEditing(e);
                        setShowForm(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 transition"
                    >
                      {e.kind === "photo" || e.kind === "pdf" ? (
                        e.kind === "photo" ? (
                          <Camera size={15} className="text-slate-500 shrink-0" />
                        ) : (
                          <FileText size={15} className="text-slate-500 shrink-0" />
                        )
                      ) : (
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: cat.color }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-100 truncate">{title}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {e.fournisseur && e.note ? `${e.note} · ` : ""}
                          {cat.label}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-slate-100">
                        {eur.format(e.ttc ?? e.amount ?? 0)}
                      </span>
                      <span
                        onClick={(ev) => {
                          ev.stopPropagation();
                          remove(e.id);
                        }}
                        className="text-slate-600 hover:text-red-400 p-1"
                      >
                        <Trash2 size={15} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <QuarterlyVat items={items} />

      {/* Récaps PDF mensuels — pour archiver avec les justificatifs du mois */}
      {bankTransactions && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
          <h2 className="text-base font-semibold mb-1">Récaps PDF du mois</h2>
          <p className="text-slate-400 text-sm mb-4">
            À archiver avec tes justificatifs — d'après le dernier relevé bancaire importé.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={downloadMatchedPdf}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 px-3 py-2.5 text-sm font-medium hover:bg-emerald-400/20 transition"
            >
              <FileDown size={16} />
              Justificatifs rapprochés ({monthlyReconciliation?.matchedExpenses.length ?? 0})
            </button>
            <button
              type="button"
              onClick={downloadMissingPdf}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-300 px-3 py-2.5 text-sm font-medium hover:bg-amber-400/20 transition"
            >
              <FileDown size={16} />
              Opérations manquantes ({monthlyReconciliation?.missingTransactions.length ?? 0})
            </button>
          </div>
        </div>
      )}

      <BankReconciliation
        items={items}
        tasks={tasks}
        onCreateTask={createTaskFromReconciliation}
        latestStatement={latestStatement}
        bankTransactions={bankTransactions}
        addStatement={addStatement}
        statementsLoading={statementsLoading}
      />

      {showForm && (
        <ExpenseForm
          initial={editing}
          existingFilenames={existingFilenames}
          onClose={() => setShowForm(false)}
          onSubmit={(data) =>
            editing ? update(editing.id, data) : add(data)
          }
        />
      )}
    </div>
  );
}
