import { Mic, Square } from "lucide-react";
import { SpeechRecognitionCtor } from "../lib/useDictation";

// Bouton de dictée réutilisable (extrait de TaskForm.jsx le 31/08/2026,
// cf. src/lib/useDictation.js pour la logique). N'apparaît que si le
// navigateur supporte l'API Web Speech — invisible sinon, pas de message
// d'erreur.
export default function DictateButton({ active, onClick }) {
  if (!SpeechRecognitionCtor) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 text-xs rounded-full px-2 py-0.5 transition ${
        active ? "bg-red-500/15 text-red-400" : "text-slate-400 hover:text-sky-300"
      }`}
    >
      {active ? <Square size={11} /> : <Mic size={11} />}
      {active ? "Arrêter" : "Dicter"}
    </button>
  );
}
