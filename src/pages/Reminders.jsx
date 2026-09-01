import { useMemo, useState } from "react";
import { Plus, Trash2, Link as LinkIcon, X } from "lucide-react";
import { useCollection } from "../lib/useCollection";
import ReminderForm from "../components/ReminderForm";

// Pense-bête (31/08/2026, demande de Sybille) : un espace fourre-tout pour
// noter des idées en vrac, rangées par rubrique libre (ex. "Films à voir",
// "Séries à voir", "Achat potentiel") — chaque entrée pouvant contenir un ou
// plusieurs liens, une ou plusieurs photos et/ou du texte (plusieurs liens
// et plusieurs photos ajoutés le 01/09/2026). Contrairement à MailTasks.jsx
// (perso/pro fixes), les rubriques sont entièrement définies par
// l'utilisatrice au fil de la saisie (autocomplétion dans ReminderForm),
// donc le regroupement en sections ci-dessous est calculé dynamiquement à
// partir des données.
function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Compat entrées créées avant le passage à plusieurs liens/photos (champs
// uniques `link`/`photoDataUrl`) : on les traite comme un tableau à 1 élément.
function linksOf(it) {
  if (it.links?.length) return it.links;
  if (it.link) return [it.link];
  return [];
}
function photosOf(it) {
  if (it.photoDataUrls?.length) return it.photoDataUrls;
  if (it.photoDataUrl) return [it.photoDataUrl];
  return [];
}

export default function Reminders() {
  const { items, loading, add, update, remove } = useCollection("reminders");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lightbox, setLightbox] = useState(null);

  const existingCategories = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "fr")
    );
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!it.category) continue;
      if (categoryFilter !== "all" && it.category !== categoryFilter) continue;
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category).push(it);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [items, categoryFilter]);

  const onAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  const onEdit = (item) => {
    setEditing(item);
    setShowForm(true);
  };

  const onSubmitForm = (data) => (editing ? update(editing.id, data) : add(data));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Pense-bête</h1>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 bg-sky-400 text-slate-950 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sky-300 transition"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      <p className="text-slate-400 text-sm mb-4">
        Films à voir, séries, idées d'achats... note tout ce qui te passe par la tête, avec un lien, une
        photo ou juste un texte.
      </p>

      {existingCategories.length > 1 && (
        <div className="flex items-center gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`shrink-0 rounded-full px-3 py-1 text-xs border transition ${
              categoryFilter === "all"
                ? "bg-sky-400 text-slate-950 border-sky-400"
                : "border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            Toutes
          </button>
          {existingCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs border transition ${
                categoryFilter === c
                  ? "bg-sky-400 text-slate-950 border-sky-400"
                  : "border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>
      ) : grouped.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">Rien à afficher ici.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, entries]) => (
            <div key={category}>
              <h2 className="text-sm font-medium text-slate-300 mb-2">{category}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {entries.map((it) => {
                  const photos = photosOf(it);
                  const links = linksOf(it);
                  return (
                    <div
                      key={it.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-3 group flex flex-col gap-2"
                    >
                      {photos.length === 1 && (
                        <button type="button" onClick={() => setLightbox(photos[0])} className="block">
                          <img
                            src={photos[0]}
                            alt=""
                            className="w-full h-32 object-cover rounded-lg border border-slate-800"
                          />
                        </button>
                      )}
                      {photos.length > 1 && (
                        <div className="grid grid-cols-3 gap-1">
                          {photos.map((p, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setLightbox(p)}
                              className="block"
                            >
                              <img
                                src={p}
                                alt=""
                                className="w-full h-16 object-cover rounded-lg border border-slate-800"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                      {it.text && <p className="text-sm text-slate-100 whitespace-pre-wrap">{it.text}</p>}
                      {links.length > 0 && (
                        <div className="flex flex-col gap-1">
                          {links.map((lnk, i) => (
                            <a
                              key={i}
                              href={lnk}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 truncate"
                            >
                              <LinkIcon size={12} className="shrink-0" />
                              <span className="truncate">{hostnameOf(lnk)}</span>
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-auto md:opacity-0 md:group-hover:opacity-100 transition">
                        <button
                          onClick={() => onEdit(it)}
                          className="text-xs text-slate-500 hover:text-slate-200 px-1.5 py-1"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => remove(it.id)}
                          className="text-slate-600 hover:text-red-400 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ReminderForm
          initial={editing}
          existingCategories={existingCategories}
          onClose={() => setShowForm(false)}
          onSubmit={onSubmitForm}
        />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-slate-300 hover:text-white p-2"
            aria-label="Fermer"
          >
            <X size={22} />
          </button>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
