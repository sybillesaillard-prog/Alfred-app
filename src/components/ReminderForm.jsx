import { useRef, useState } from "react";
import { X, Image as ImageIcon, Trash2 } from "lucide-react";
import { useDictation } from "../lib/useDictation";
import DictateButton from "./DictateButton";
import { compressImageToDataUrl } from "../lib/imageCompression";

// Formulaire d'ajout/modification d'une entrée du Pense-bête (31/08/2026,
// demande de Sybille : un espace pour noter des idées en vrac — films à
// voir, séries, achats potentiels... — rangées par catégorie libre, avec
// possibilité d'ajouter un lien, une photo, ou du texte).
//
// Contrairement aux catégories fixes de MailTasks.jsx (perso/pro), ici la
// catégorie est un texte libre saisi par l'utilisatrice, avec juste une
// autocomplétion sur celles déjà utilisées — la liste de rubriques doit
// pouvoir grandir sans toucher au code.
export default function ReminderForm({ initial, existingCategories, onSubmit, onClose }) {
  const [category, setCategory] = useState(initial?.category ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [photoDataUrl, setPhotoDataUrl] = useState(initial?.photoDataUrl ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  const { listeningField, dictateInto } = useDictation();

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    setPhotoBusy(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setPhotoDataUrl(dataUrl);
    } catch (err) {
      console.error(err);
      setPhotoError("Impossible de traiter cette image.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const cat = category.trim();
    const txt = text.trim();
    const lnk = link.trim();
    if (!cat) {
      setError("Choisis une rubrique.");
      return;
    }
    if (!txt && !lnk && !photoDataUrl) {
      setError("Ajoute au moins un texte, un lien ou une photo.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        category: cat,
        text: txt || null,
        link: lnk || null,
        photoDataUrl: photoDataUrl || null,
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
        className="w-full md:max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl p-5 space-y-4 safe-bottom max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? "Modifier" : "Nouvelle idée"}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X size={20} />
          </button>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Rubrique</label>
          <input
            autoFocus
            type="text"
            required
            list="reminder-category-options"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ex : Films à voir"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
          />
          <datalist id="reminder-category-options">
            {(existingCategories || []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm text-slate-400">Texte (optionnel)</label>
            <DictateButton
              active={listeningField === "text"}
              onClick={() => dictateInto("text", setText, text)}
            />
          </div>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Une note, un titre..."
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Lien (optionnel)</label>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Photo (optionnel)</label>
          {photoDataUrl ? (
            <div className="relative inline-block">
              <img
                src={photoDataUrl}
                alt=""
                className="h-28 w-28 object-cover rounded-lg border border-slate-700"
              />
              <button
                type="button"
                onClick={() => setPhotoDataUrl(null)}
                className="absolute -top-2 -right-2 bg-slate-800 border border-slate-700 rounded-full p-1 text-slate-300 hover:text-red-400"
                aria-label="Retirer la photo"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoBusy}
              className="flex items-center gap-2 rounded-lg border border-dashed border-slate-700 px-3 py-2.5 text-sm text-slate-400 hover:border-sky-400 hover:text-sky-300 transition disabled:opacity-60"
            >
              <ImageIcon size={16} />
              {photoBusy ? "Traitement…" : "Ajouter une photo"}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onPickPhoto}
            className="hidden"
          />
          {photoError && <p className="text-xs text-red-400 mt-1">{photoError}</p>}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy || photoBusy}
          className="w-full rounded-lg bg-sky-400 text-slate-950 font-medium py-2.5 hover:bg-sky-300 transition disabled:opacity-60"
        >
          {busy ? "…" : initial ? "Enregistrer" : "Ajouter"}
        </button>
      </form>
    </div>
  );
}
