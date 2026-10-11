import { useMemo } from "react";
import { matchRevenueTransactions } from "../lib/bankTx";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

// Symétrique de BankReconciliation.jsx, côté recettes — mais sans import de
// relevé propre : le relevé bancaire est déjà importé une fois depuis la
// page Dépenses (Expenses.jsx, collection partagée `bankStatements`) et
// transmis ici en prop, pour n'avoir qu'un seul endroit où l'importer.
export default function RevenueReconciliation({ items, bankTransactions }) {
  const { missing, stats } = useMemo(() => {
    if (!bankTransactions) return { missing: null, stats: "" };
    const { transactions: txs } = matchRevenueTransactions(bankTransactions, items);
    const credits = txs.filter((t) => t.amount > 0);
    const missingTx = credits.filter((t) => !t.matched);
    return {
      missing: missingTx,
      stats: `${credits.length} entrée(s) créditée(s) sur le relevé · ${credits.length - missingTx.length} avec recette correspondante · ${missingTx.length} sans recette enregistrée`,
    };
  }, [bankTransactions, items]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
      <h2 className="text-base font-semibold mb-1">Relevé de compte — entrées sans recette enregistrée</h2>
      <p className="text-slate-400 text-sm mb-4">
        D'après le dernier relevé bancaire importé depuis la page Dépenses.
      </p>

      {bankTransactions == null && (
        <p className="text-sm text-slate-500">
          Aucun relevé bancaire importé pour l'instant — importes-en un depuis la page "Dépenses" pour activer ce contrôle.
        </p>
      )}

      {missing !== null && (
        <div>
          <p className="text-xs text-slate-400 mb-3">{stats}</p>
          {missing.length === 0 ? (
            <p className="text-sm text-emerald-300">✅ Toutes les entrées du relevé ont une recette correspondante.</p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400 mb-1">
                Virements/paiements reçus sans recette enregistrée en face — pense à les ajouter ci-dessus :
              </p>
              {missing.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/20"
                >
                  <span className="text-sm text-amber-200 truncate">
                    {t.date} · {t.label}
                  </span>
                  <span className="text-sm font-medium text-amber-200 shrink-0">{eur.format(t.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
