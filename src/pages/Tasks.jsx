import { useMemo, useState } from "react";
import { Plus, Trash2, Check, StickyNote } from "lucide-react";
import { useCollection } from "../lib/useCollection";
import TaskForm from "../components/TaskForm";

const PRIORITY_ORDER = { haute: 0, normale: 1, basse: 2 };
const PRIORITY_STYLE = {
  haute: "bg-red-950 text-red-400 border-red-900",
  normale: "bg-slate-800 text-slate-400 border-slate-700",
  basse: "bg-slate-800/50 text-slate-500 border-slate-800",
};

export default function Tasks() {
  const { items, loading, add, update, remove } = useCollection("tasks");
  const [filter, setFilter] = useState("all"); // all | perso | pro
  const [showDone, setShowDone] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    return items
      .filter((t) => filter === "all" || t.category === filter)
      .filter((t) => showDone || !t.done)
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const pa = PRIORITY_ORDER[a.priority] ?? 1;
        const pb = PRIORITY_ORDER[b.priority] ?? 1;
        if (pa !== pb) return pa - pb;
        if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
  }, [items, filter, showDone]);

  const counts = useMemo(() => {
    const open = items.filter((t) => !t.done);
    return {
      all: open.length,
      perso: open.filter((t) => t.category === "perso").length,
      pro: open.filter((t) => t.category === "pro").length,
    };
  }, [items]);

  // Sous-catégories déjà utilisées, par catégorie perso/pro — passées au
  // formulaire pour compléter les suggestions de départ (taskCategories.js).
  const existingSubcategories = useMemo(() => {
    const out = { perso: [], pro: [] };
    for (const t of items) {
      if (t.subcategory && out[t.category]) out[t.category].push(t.subcategory);
    }
    return out;
  }, [items]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Tâches</h1>
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

      <div className="flex items-center gap-2 mb-4">
        {[
          { id: "all", label: `Toutes (${counts.all})` },
          { id: "perso", label: `Perso (${counts.perso})` },
          { id: "pro", label: `Pro (${counts.pro})` },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              filter === f.id
                ? "bg-sky-400/10 border-sky-400/40 text-sky-300"
                : "border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setShowDone((v) => !v)}
          className="ml-auto text-xs text-slate-500 hover:text-slate-300"
        >
          {showDone ? "Masquer terminées" : "Voir terminées"}
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">
          Rien à faire ici. 🎉
        </p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 px-4 py-3 group"
            >
              <button
                onClick={() => update(t.id, { done: !t.done })}
                className={`h-5 w-5 shrink-0 rounded-full border flex items-center justify-center transition ${
                  t.done
                    ? "bg-sky-400 border-sky-400"
                    : "border-slate-600 hover:border-sky-400"
                }`}
              >
                {t.done && <Check size={13} className="text-slate-950" />}
              </button>

              <button
                onClick={() => {
                  setEditing(t);
                  setShowForm(true);
                }}
                className="flex-1 min-w-0 text-left"
              >
                <p
                  className={`text-sm truncate ${
                    t.done ? "text-slate-600 line-through" : "text-slate-100"
                  }`}
                >
                  {t.title}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[11px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">
                    {t.category === "pro" ? "Pro" : "Perso"}
                  </span>
                  {t.subcategory && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-500">
                      {t.subcategory}
                    </span>
                  )}
                  {!t.done && (
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded border ${PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.normale}`}
                    >
                      {t.priority}
                    </span>
                  )}
                  {t.dueDate && (
                    <span className="text-[11px] text-slate-500">
                      {new Date(t.dueDate).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  )}
                  {t.note && (
                    <span title={t.note} className="text-slate-600 shrink-0">
                      <StickyNote size={12} />
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={() => remove(t.id)}
                className="text-slate-600 hover:text-red-400 p-1 md:opacity-0 md:group-hover:opacity-100 transition"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TaskForm
          initial={editing}
          existingSubcategories={existingSubcategories}
          onClose={() => setShowForm(false)}
          onSubmit={(data) => (editing ? update(editing.id, data) : add(data))}
        />
      )}
    </div>
  );
}
