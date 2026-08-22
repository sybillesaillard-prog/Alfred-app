import { useMemo } from "react";
import { quarterKey, quarterLabel } from "../lib/vat";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default function QuarterlyVat({ items }) {
  const byQuarter = useMemo(() => {
    const map = {};
    for (const e of items) {
      const key = quarterKey(e.date);
      if (!key) continue;
      const ttc = e.ttc ?? e.amount ?? 0;
      const ht = e.ht ?? ttc;
      const tva = e.tva ?? 0;
      if (!map[key]) map[key] = { ht: 0, tva: 0, ttc: 0, count: 0 };
      map[key].ht += ht;
      map[key].tva += tva;
      map[key].ttc += ttc;
      map[key].count += 1;
    }
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [items]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
      <h2 className="text-base font-semibold mb-1">TVA par trimestre civil</h2>
      <p className="text-slate-400 text-sm mb-4">
        Pratique pour préparer ta déclaration de TVA (T1 janv.-mars, T2 avr.-juin, T3 juil.-sept., T4 oct.-déc.).
      </p>

      {byQuarter.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">Aucune dépense enregistrée pour l'instant.</p>
      ) : (
        <div className="space-y-2">
          {byQuarter.map(([key, q]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg bg-slate-800/60 border border-slate-700 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-100">{quarterLabel(key)}</p>
                <p className="text-xs text-slate-500">
                  {q.count} document{q.count > 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex gap-5 text-right shrink-0">
                <div>
                  <p className="text-xs text-slate-500">HT</p>
                  <p className="text-sm text-slate-200">{eur.format(q.ht)}</p>
                </div>
                <div>
                  <p className="text-xs text-amber-300/70">TVA</p>
                  <p className="text-sm font-semibold text-amber-300">{eur.format(q.tva)}</p>
                </div>
                <div>
                  <p className="text-xs text-sky-300/70">TTC</p>
                  <p className="text-sm font-semibold text-sky-300">{eur.format(q.ttc)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
