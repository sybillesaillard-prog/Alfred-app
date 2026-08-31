import { useState } from "react";
import { X } from "lucide-react";
import { useDictation } from "../lib/useDictation";
import DictateButton from "./DictateButton";

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Formulaire d'ajout/modification d'une entrée du journal d'entretien
// (31/08/2026, demande de Sybille : garder une trace des tâches ménagères
// faites — tonte, nettoyage de la terrasse, etc. — pour savoir depuis
// quand elle ne les a pas refaites et combien de temps elles prennent).
// Même structure que TaskForm.jsx (modale, dictée vocale sur le libellé et
// la note) pour rester cohérent avec le reste de l'appli.
export default function ChoreForm({ initial, existingLabels, onSubmit, onClose }) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [durationMinutes, setDurationMinutes] = useState(
    initial?.durationMinutes != null ? String(initial.durationMinutes) : ""
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);

  const { listeningField, dictateInto } = useDictation();

  const submit = async (e) => {
    e.preventDefault();
    if (!label.trim() || !date) return;
    setBusy(true);
    try {
      const minutes = durationMinutes.trim() ? Math.max(0, Math.round(Number(durationMinutes))) : null;
      await onSubmit({
        label: label.trim(),
        date,
        durationMinutes: Number.isFinite(minutes) ? minutes : null,
        note: note.trim() || null,
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
        className="w-full md:max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl p-5 space-y-4 safe-bottom"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {initial ? "Modifier l'entrée" : "Nouvelle entrée"}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X size={20} />
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm text-slate-400">Qu'as-tu fait ?</label>
            <DictateButton
              active={listeningField === "label"}
              onClick={() => dictateInto("label", setLabel, label)}
            />
          </div>
          <input
            autoFocus
            type="text"
            required
            list="chore-label-options"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex : Tonte de la pelouse"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
          />
          <datalist id="chore-label-options">
            {(existingLabels || []).map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label className="block text-sm text-slate-400 mb-1">Durée (minutes, optionnel)</label>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="Ex : 45"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm text-slate-400">Notes (optionnel)</label>
            <DictateButton
              active={listeningField === "note"}
              onClick={() => dictateInto("note", setNote, note)}
            />
          </div>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Détails..."
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-sky-400 text-slate-950 font-medium py-2.5 hover:bg-sky-300 transition disabled:opacity-60"
        >
          {busy ? "…" : initial ? "Enregistrer" : "Ajouter"}
        </button>
      </form>
    </div>
  );
}
