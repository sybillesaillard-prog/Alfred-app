import { useState } from "react";
import { X } from "lucide-react";
import { REVENUE_CATEGORIES } from "../lib/revenueCategories";
import { VAT_RATES, isStandardRate, computeFromHT, computeFromTVA, computeFromTTC } from "../lib/vat";

const todayISO = () => new Date().toISOString().slice(0, 10);

function round1(n) {
  return Math.round(n * 10) / 10;
}

// Formulaire volontairement plus simple que ExpenseForm.jsx : pas de
// photo/scan/OCR/Drive/ventilation — Sybille saisit juste ce qu'elle a
// facturé/encaissé, le rapprochement avec le relevé bancaire se fait ensuite
// automatiquement (cf. RevenueReconciliation.jsx), exactement comme côté
// dépenses mais sur les lignes créditées plutôt que débitées.
function initialFieldsFrom(initial) {
  if (!initial) {
    return {
      client: "",
      date: todayISO(),
      category: REVENUE_CATEGORIES[0].id,
      rate: 0.2,
      customRate: "",
      ht: "",
      tva: "",
      ttc: "",
      note: "",
    };
  }
  const ttc = initial.ttc ?? initial.amount ?? 0;
  const ht = initial.ht ?? ttc;
  const tva = initial.tva ?? 0;
  const rate = initial.vatRate ?? 0;
  return {
    client: initial.client ?? "",
    date: initial.date ?? todayISO(),
    category: initial.category ?? REVENUE_CATEGORIES[0].id,
    rate: isStandardRate(rate) ? rate : "custom",
    customRate: isStandardRate(rate) ? "" : String(round1(rate * 100)),
    ht: ht ? String(ht) : "",
    tva: tva ? String(tva) : "",
    ttc: ttc ? String(ttc) : "",
    note: initial.note ?? "",
  };
}

export default function RevenueForm({ initial, onSubmit, onClose }) {
  const f0 = initialFieldsFrom(initial);
  const [client, setClient] = useState(f0.client);
  const [date, setDate] = useState(f0.date);
  const [category, setCategory] = useState(f0.category);
  const [rateSel, setRateSel] = useState(f0.rate);
  const [customRate, setCustomRate] = useState(f0.customRate);
  const [ht, setHt] = useState(f0.ht);
  const [tva, setTva] = useState(f0.tva);
  const [ttc, setTtc] = useState(f0.ttc);
  const [note, setNote] = useState(f0.note);
  const [busy, setBusy] = useState(false);

  const effectiveRate = () => {
    if (rateSel === "custom") return (parseFloat(customRate) || 0) / 100;
    return parseFloat(rateSel) || 0;
  };

  const onHtChange = (v) => {
    setHt(v);
    const parsed = parseFloat(String(v).replace(",", ".")) || 0;
    const { tva: t, ttc: tt } = computeFromHT(parsed, effectiveRate());
    setTva(t ? String(t) : "");
    setTtc(tt ? String(tt) : "");
  };
  const onTvaChange = (v) => {
    setTva(v);
    const parsedHt = parseFloat(String(ht).replace(",", ".")) || 0;
    const parsedTva = parseFloat(String(v).replace(",", ".")) || 0;
    const { ttc: tt } = computeFromTVA(parsedHt, parsedTva);
    setTtc(tt ? String(tt) : "");
  };
  const onTtcChange = (v) => {
    setTtc(v);
    const parsed = parseFloat(String(v).replace(",", ".")) || 0;
    const { ht: h, tva: t } = computeFromTTC(parsed, effectiveRate());
    setHt(h ? String(h) : "");
    setTva(t ? String(t) : "");
  };
  const onRateChange = (v) => {
    setRateSel(v);
    const parsed = parseFloat(String(ht).replace(",", ".")) || 0;
    const rate = v === "custom" ? (parseFloat(customRate) || 0) / 100 : parseFloat(v) || 0;
    const { tva: t, ttc: tt } = computeFromHT(parsed, rate);
    setTva(t ? String(t) : "");
    setTtc(tt ? String(tt) : "");
  };
  const onCustomRateChange = (v) => {
    setCustomRate(v);
    const parsed = parseFloat(String(ht).replace(",", ".")) || 0;
    const rate = (parseFloat(v) || 0) / 100;
    const { tva: t, ttc: tt } = computeFromHT(parsed, rate);
    setTva(t ? String(t) : "");
    setTtc(tt ? String(tt) : "");
  };

  const submit = async (e) => {
    e.preventDefault();
    const parsedHt = parseFloat(String(ht).replace(",", ".")) || 0;
    const parsedTva = parseFloat(String(tva).replace(",", ".")) || 0;
    const parsedTtc = parseFloat(String(ttc).replace(",", ".")) || 0;
    if (!parsedTtc || parsedTtc <= 0) return;

    setBusy(true);
    try {
      await onSubmit({
        client: client.trim(),
        date,
        category,
        vatRate: effectiveRate(),
        ht: parsedHt,
        tva: parsedTva,
        ttc: parsedTtc,
        amount: parsedTtc,
        note: note.trim(),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full md:max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl p-5 space-y-4 safe-bottom"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {initial ? "Modifier la recette" : "Nouvelle recette"}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X size={20} />
          </button>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Client</label>
          <input
            type="text"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Ex : Société Dupont"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Catégorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
            >
              {REVENUE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Taux de TVA facturé</label>
          <select
            value={rateSel}
            onChange={(e) => onRateChange(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
          >
            {VAT_RATES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
            <option value="custom">Autre taux</option>
          </select>
          {rateSel === "custom" && (
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={customRate}
              onChange={(e) => onCustomRateChange(e.target.value)}
              placeholder="Taux en %, ex : 19"
              className="w-full mt-2 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
            />
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-sm text-slate-400 mb-1">HT (€)</label>
            <input
              type="text"
              inputMode="decimal"
              value={ht}
              onChange={(e) => onHtChange(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">TVA (€)</label>
            <input
              type="text"
              inputMode="decimal"
              value={tva}
              onChange={(e) => onTvaChange(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">TTC (€)</label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={ttc}
              onChange={(e) => onTtcChange(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 font-semibold outline-none focus:border-sky-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Note (optionnel)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex : facture n°..."
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-400 text-slate-950 font-medium py-2.5 hover:bg-emerald-300 transition disabled:opacity-60"
        >
          {busy ? "…" : initial ? "Enregistrer" : "Ajouter"}
        </button>
      </form>
    </div>
  );
}
