import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { SUBCATEGORIES_BY_CATEGORY } from "../lib/taskCategories";
import { useDictation } from "../lib/useDictation";
import DictateButton from "./DictateButton";

export default function TaskForm({ initial, existingSubcategories, onSubmit, onClose }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "perso");
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "normale");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);

  // Dictée vocale (26/08/2026) — logique partagée dans src/lib/useDictation.js
  // (extraite le 31/08/2026 pour être réutilisée aussi par ChoreForm.jsx).
  const { listeningField, dictateInto } = useDictation();

  // Suggestions de sous-catégorie propres à perso/pro : la liste de départ
  // (taskCategories.js) complétée par celles déjà utilisées sur d'autres
  // tâches de cette même catégorie — la liste s'enrichit donc toute seule
  // au fil de la saisie, sans écran de gestion séparé à maintenir.
  const subcategoryOptions = useMemo(() => {
    const seed = SUBCATEGORIES_BY_CATEGORY[category] || [];
    const used = (existingSubcategories?.[category] || []).filter(Boolean);
    return [...new Set([...seed, ...used])];
  }, [category, existingSubcategories]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        category,
        subcategory: subcategory.trim() || null,
        priority,
        dueDate: dueDate || null,
        note: note.trim() || null,
        done: initial?.done ?? false,
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
            {initial ? "Modifier la tâche" : "Nouvelle tâche"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1"
          >
            <X size={20} />
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm text-slate-400">Titre</label>
            <DictateButton
              active={listeningField === "title"}
              onClick={() => dictateInto("title", setTitle, title)}
            />
          </div>
          <input
            autoFocus
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Envoyer le devis à..."
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Catégorie
            </label>
            <div className="flex rounded-lg bg-slate-800 border border-slate-700 p-1">
              {[
                { id: "perso", label: "Perso" },
                { id: "pro", label: "Pro" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (c.id !== category) setSubcategory("");
                    setCategory(c.id);
                  }}
                  className={`flex-1 rounded-md py-1.5 text-sm transition ${
                    category === c.id
                      ? "bg-sky-400 text-slate-950 font-medium"
                      : "text-slate-400"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Priorité
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
            >
              <option value="basse">Basse</option>
              <option value="normale">Normale</option>
              <option value="haute">Haute</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">
            Sous-catégorie (optionnel)
          </label>
          <input
            type="text"
            list="subcategory-options"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            placeholder={category === "pro" ? "Ex : Client Dupont" : "Ex : Maison"}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
          />
          <datalist id="subcategory-options">
            {subcategoryOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">
            Échéance (optionnel)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
          />
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
            placeholder="Détails, contexte, lien..."
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
