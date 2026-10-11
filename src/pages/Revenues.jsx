import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useCollection } from "../lib/useCollection";
import { revenueCategoryInfo } from "../lib/revenueCategories";
import RevenueForm from "../components/RevenueForm";
import RevenueReconciliation from "../components/RevenueReconciliation";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

const monthLabel = (d) => d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

// Nouvelle page "Recettes" (07/10, demande de Sybille : "suivi du chiffre
// d'affaires + résultat net") — symétrique de Dépenses.jsx côté entrées
// d'argent, en plus simple (pas d'OCR/scan/Drive, saisie manuelle
// uniquement, cf. RevenueForm.jsx). Le rapprochement bancaire se fait contre
// le MÊME relevé que celui déjà importé depuis la page Dépenses (collection
// partagée `bankStatements`) — un seul endroit pour l'importer, mais utilisé
// des deux côtés (débits → dépenses, crédits → recettes).
export default function Revenues() {
  const { items, loading, add, update, remove } = useCollection("revenues", "date");
  const { items: expenses } = useCollection("expenses", "date");
  const { items: statements } = useCollection("bankStatements", "createdAt");
  const [cursor, setCursor] = useState(() => new Date());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const latestStatement = statements[0] || null;
  const bankTransactions = latestStatement?.transactions ?? null;

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);

  const inMonth = (d) => new Date(d) >= monthStart && new Date(d) < monthEnd;

  const monthRevenues = useMemo(() => {
    return items.filter((r) => inMonth(r.date)).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [items, cursor]);

  const monthExpenses = useMemo(() => {
    return expenses.filter((e) => inMonth(e.date));
  }, [expenses, cursor]);

  const totalTTC = monthRevenues.reduce((s, r) => s + (r.ttc ?? r.amount ?? 0), 0);
  const totalHT = monthRevenues.reduce((s, r) => s + (r.ht ?? r.ttc ?? r.amount ?? 0), 0);
  const totalTVA = monthRevenues.reduce((s, r) => s + (r.tva ?? 0), 0);

  const expensesHT = monthExpenses.reduce((s, e) => s + (e.ht ?? e.ttc ?? e.amount ?? 0), 0);
  const expensesTVA = monthExpenses.reduce((s, e) => s + (e.tva ?? 0), 0);

  const resultatNet = totalHT - expensesHT;
  const tvaAPayer = totalTVA - expensesTVA;

  const byCategory = useMemo(() => {
    const map = {};
    for (const r of monthRevenues) {
      map[r.category] = (map[r.category] || 0) + (r.ttc ?? r.amount ?? 0);
    }
    return Object.entries(map)
      .map(([id, value]) => ({ id, value, ...revenueCategoryInfo(id) }))
      .sort((a, b) => b.value - a.value);
  }, [monthRevenues]);

  const grouped = useMemo(() => {
    const map = {};
    for (const r of monthRevenues) {
      (map[r.date] ||= []).push(r);
    }
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [monthRevenues]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Recettes</h1>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 bg-emerald-400 text-slate-950 rounded-lg px-3 py-2 text-sm font-medium hover:bg-emerald-300 transition"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 mb-4">
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="p-1.5 text-slate-400 hover:text-slate-100"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium capitalize">{monthLabel(cursor)}</span>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
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
            <p className="text-xs text-slate-400">TVA collectée</p>
            <p className="text-lg font-semibold mt-1 text-amber-300">{eur.format(totalTVA)}</p>
          </div>
          <div className="rounded-lg bg-emerald-400/10 border border-emerald-400/30 px-3 py-3">
            <p className="text-xs text-emerald-300">Total TTC</p>
            <p className="text-lg font-semibold mt-1 text-emerald-300">{eur.format(totalTTC)}</p>
          </div>
        </div>

        {byCategory.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="label" innerRadius={32} outerRadius={54} stroke="none">
                    {byCategory.map((c) => (
                      <Cell key={c.id} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => eur.format(v)}
                    contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {byCategory.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                    {c.label}
                  </span>
                  <span className="text-slate-400">{eur.format(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Résultat du mois — recettes moins dépenses, et TVA à payer estimée.
          Base HT pour le résultat (la TVA n'est jamais un vrai revenu/coût,
          elle ne fait que transiter) ; TVA à payer = collectée - déductible,
          même principe que la déclaration réelle mais sans tenir compte
          d'éventuelles régularisations ou d'un crédit de TVA antérieur —
          une estimation à partir de ce qui est saisi dans Alfred, à
          confirmer avec ton comptable avant toute déclaration. */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
        <h2 className="text-base font-semibold mb-1">Résultat du mois (estimation)</h2>
        <p className="text-slate-400 text-sm mb-4">
          Recettes moins dépenses saisies dans Alfred ce mois-ci — à confirmer avec ton comptable, ce n'est pas un calcul fiscal officiel.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div
            className={`rounded-lg border px-3 py-3 ${
              resultatNet >= 0 ? "bg-emerald-400/10 border-emerald-400/30" : "bg-red-400/10 border-red-400/30"
            }`}
          >
            <p className={`text-xs ${resultatNet >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              Résultat net (HT)
            </p>
            <p className={`text-lg font-semibold mt-1 ${resultatNet >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {eur.format(resultatNet)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {eur.format(totalHT)} recettes − {eur.format(expensesHT)} dépenses
            </p>
          </div>
          <div className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-3">
            <p className="text-xs text-slate-400">TVA à payer (estimée)</p>
            <p className="text-lg font-semibold mt-1 text-slate-100">{eur.format(tvaAPayer)}</p>
            <p className="text-xs text-slate-500 mt-1">
              {eur.format(totalTVA)} collectée − {eur.format(expensesTVA)} déductible
            </p>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>
      ) : grouped.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">Aucune recette ce mois-ci.</p>
      ) : (
        <div className="space-y-5 mb-4">
          {grouped.map(([date, revs]) => (
            <div key={date}>
              <p className="text-xs text-slate-500 mb-2 px-1">
                {new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
                {revs.map((r) => {
                  const cat = revenueCategoryInfo(r.category);
                  const title = r.client || r.note || cat.label;
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        setEditing(r);
                        setShowForm(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 transition"
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-100 truncate">{title}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {r.client && r.note ? `${r.note} · ` : ""}
                          {cat.label}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-emerald-300">
                        {eur.format(r.ttc ?? r.amount ?? 0)}
                      </span>
                      <span
                        onClick={(ev) => {
                          ev.stopPropagation();
                          remove(r.id);
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

      <RevenueReconciliation items={items} bankTransactions={bankTransactions} />

      {showForm && (
        <RevenueForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSubmit={(data) => (editing ? update(editing.id, data) : add(data))}
        />
      )}
    </div>
  );
}
