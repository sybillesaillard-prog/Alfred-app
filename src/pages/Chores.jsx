import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight, StickyNote, Clock } from "lucide-react";
import { useCollection } from "../lib/useCollection";
import ChoreForm from "../components/ChoreForm";

// Journal d'entretien (31/08/2026, demande de Sybille : garder une trace
// des tâches ménagères faites — ex. "aujourd'hui j'ai tondu et nettoyé ma
// terrasse" — pour savoir depuis quand elle n'a pas refait telle activité,
// et combien de temps chacune lui prend). Collection Firestore séparée de
// "tasks" : ce ne sont pas des choses à faire, mais un historique de ce qui
// a déjà été fait — la modélisation (une date, pas une échéance) est
// différente.
//
// Trié par `date` (le jour où l'activité a été faite), pas par `createdAt`
// comme les autres collections — permet de saisir une entrée après coup
// (ex. le lendemain) sans qu'elle se retrouve mal classée.
const ORDER_FIELD = "date";

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(fromISO, toISO) {
  const a = new Date(`${fromISO}T00:00:00`);
  const b = new Date(`${toISO}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

function formatDaysSince(days) {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `Il y a ${days} jours`;
}

function formatMinutes(minutes) {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function formatDayLabel(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export default function Chores() {
  const { items, loading, add, update, remove } = useCollection("chores", ORDER_FIELD);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [labelFilter, setLabelFilter] = useState("all");

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(null);

  const today = todayISO();

  // Libellés déjà utilisés — pour le filtre ci-dessous ET pour l'auto-
  // complétion proposée dans ChoreForm (une activité tapée une fois se
  // retape ensuite en 1 clic).
  const existingLabels = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.label).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "fr")
    );
  }, [items]);

  // Une "fiche" par activité distincte : depuis combien de jours elle n'a
  // pas été refaite, et sa durée moyenne quand elle est renseignée — c'est
  // la réponse directe à "depuis quand je ne l'ai pas fait ?". Triées avec
  // la plus en retard en premier.
  const statsByLabel = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!it.label || !it.date) continue;
      if (!map.has(it.label)) {
        map.set(it.label, { label: it.label, count: 0, lastDate: null, totalMinutes: 0, minutesCount: 0 });
      }
      const s = map.get(it.label);
      s.count += 1;
      if (!s.lastDate || it.date > s.lastDate) s.lastDate = it.date;
      if (typeof it.durationMinutes === "number") {
        s.totalMinutes += it.durationMinutes;
        s.minutesCount += 1;
      }
    }
    return Array.from(map.values())
      .map((s) => ({
        ...s,
        daysSince: s.lastDate ? daysBetween(s.lastDate, today) : null,
        avgMinutes: s.minutesCount ? Math.round(s.totalMinutes / s.minutesCount) : null,
      }))
      .sort((a, b) => (b.daysSince ?? -1) - (a.daysSince ?? -1));
  }, [items, today]);

  // Entrées groupées par jour — utilisé pour les points dans le calendrier
  // et pour retrouver rapidement le détail d'un jour cliqué.
  const entriesByDate = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!it.date) continue;
      if (!map.has(it.date)) map.set(it.date, []);
      map.get(it.date).push(it);
    }
    return map;
  }, [items]);

  const calendarCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // lundi = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push(iso);
    }
    return cells;
  }, [viewMonth]);

  const monthLabel = viewMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const changeMonth = (delta) => {
    setViewMonth((d) => {
      const next = new Date(d);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
    setSelectedDate(null);
  };

  const filtered = useMemo(() => {
    return items
      .filter((it) => labelFilter === "all" || it.label === labelFilter)
      .filter((it) => !selectedDate || it.date === selectedDate);
  }, [items, labelFilter, selectedDate]);

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
        <h1 className="text-xl font-semibold">Entretien</h1>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 bg-sky-400 text-slate-950 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sky-300 transition"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      <p className="text-slate-400 text-sm mb-4">
        Garde une trace de ce que tu fais (tonte, ménage, entretien...) — pour savoir depuis quand tu ne l'as
        pas refait et combien de temps ça te prend.
      </p>

      {/* Fiches par activité : depuis quand + durée moyenne */}
      {statsByLabel.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {statsByLabel.map((s) => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-sm font-medium text-slate-100 truncate">{s.label}</p>
              <p
                className={`text-xs mt-1 ${
                  s.daysSince >= 14 ? "text-amber-300" : "text-slate-500"
                }`}
              >
                {formatDaysSince(s.daysSince)}
                {s.lastDate && <> · {formatDayLabel(s.lastDate)}</>}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                <span>
                  {s.count} fois enregistrée{s.count > 1 ? "s" : ""}
                </span>
                {s.avgMinutes != null && (
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    ~{formatMinutes(s.avgMinutes)} en moyenne
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Calendrier du mois — un point sur les jours où quelque chose a été noté */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => changeMonth(-1)}
            className="text-slate-400 hover:text-slate-200 p-1"
            aria-label="Mois précédent"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-medium capitalize">{monthLabel}</p>
          <button
            onClick={() => changeMonth(1)}
            className="text-slate-400 hover:text-slate-200 p-1"
            aria-label="Mois suivant"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((w, i) => (
            <p key={i} className="text-[11px] text-slate-600 pb-1">
              {w}
            </p>
          ))}
          {calendarCells.map((iso, i) => {
            if (!iso) return <div key={`empty-${i}`} />;
            const dayEntries = entriesByDate.get(iso) || [];
            const hasEntries = dayEntries.length > 0;
            const isToday = iso === today;
            const isSelected = iso === selectedDate;
            const dayNum = Number(iso.slice(-2));
            return (
              <button
                key={iso}
                onClick={() => setSelectedDate((d) => (d === iso ? null : iso))}
                className={`relative aspect-square rounded-lg text-xs flex flex-col items-center justify-center transition ${
                  isSelected
                    ? "bg-sky-400 text-slate-950 font-medium"
                    : isToday
                      ? "border border-sky-400/60 text-slate-100"
                      : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {dayNum}
                {hasEntries && (
                  <span
                    className={`absolute bottom-1 h-1 w-1 rounded-full ${
                      isSelected ? "bg-slate-950" : "bg-sky-400"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <button
            onClick={() => setSelectedDate(null)}
            className="text-xs text-sky-400 hover:text-sky-300 mt-3"
          >
            Voir tout le journal (retirer le filtre du {formatDayLabel(selectedDate)})
          </button>
        )}
      </div>

      {existingLabels.length > 1 && (
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs text-slate-500">Activité</label>
          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-xs text-slate-300"
          >
            <option value="all">Toutes</option>
            {existingLabels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Journal chronologique */}
      {loading ? (
        <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">Rien à afficher ici.</p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
          {filtered.map((it) => (
            <div key={it.id} className="flex items-center gap-3 px-4 py-3 group">
              <button onClick={() => onEdit(it)} className="flex-1 min-w-0 text-left">
                <p className="text-sm text-slate-100 truncate">{it.label}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[11px] text-slate-500">{formatDayLabel(it.date)}</span>
                  {it.durationMinutes != null && (
                    <span className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">
                      <Clock size={10} />
                      {formatMinutes(it.durationMinutes)}
                    </span>
                  )}
                  {it.note && (
                    <span title={it.note} className="text-slate-600 shrink-0">
                      <StickyNote size={12} />
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => remove(it.id)}
                className="text-slate-600 hover:text-red-400 p-1 md:opacity-0 md:group-hover:opacity-100 transition"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ChoreForm
          initial={editing}
          existingLabels={existingLabels}
          onClose={() => setShowForm(false)}
          onSubmit={onSubmitForm}
        />
      )}
    </div>
  );
}
