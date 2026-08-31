import { useEffect, useRef, useState } from "react";

// Dictée vocale (26/08/2026, demande de Sybille) — extrait de TaskForm.jsx
// le 31/08/2026 pour être réutilisé ailleurs (ex. ChoreForm.jsx pour le
// suivi d'entretien) sans dupliquer la logique. S'appuie sur l'API Web
// Speech du navigateur (SpeechRecognition/webkitSpeechRecognition), déjà
// intégrée à Chrome/Edge : pas de service tiers, pas de clé API, pas de
// coût — cohérent avec le reste de l'appli (100% client-side). Pas
// disponible partout (Firefox ne la supporte pas, support partiel sur
// Safari/iOS) : `SpeechRecognitionCtor` vaut `null` dans ce cas, et
// `DictateButton.jsx` s'appuie dessus pour ne pas s'afficher du tout,
// plutôt que d'afficher un bouton qui ne marcherait pas.
export const SpeechRecognitionCtor =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/**
 * Gère une dictée vocale pouvant cibler PLUSIEURS champs d'un même
 * formulaire (ex. titre ET notes) — un seul à la fois peut être en train
 * d'écouter, pour éviter deux dictées simultanées qui se marcheraient
 * dessus (démarrer sur un champ arrête automatiquement l'écoute en cours
 * sur un autre).
 *
 * Usage : const { listeningField, dictateInto } = useDictation();
 * puis dictateInto("titre", setTitre, titre) sur clic d'un DictateButton.
 */
export function useDictation() {
  const [listeningField, setListeningField] = useState(null);
  const recognitionRef = useRef(null);

  // Coupe le micro si le formulaire se ferme pendant une dictée en cours.
  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  // Démarre (ou arrête, si on reclique dessus) la dictée pour un champ
  // donné. `currentValue` est repris tel quel devant le texte dicté, pour
  // pouvoir compléter un champ déjà commencé à la main plutôt que de
  // l'écraser.
  const dictateInto = (field, setValue, currentValue) => {
    if (!SpeechRecognitionCtor) return;
    if (listeningField === field) {
      recognitionRef.current?.stop();
      return;
    }
    recognitionRef.current?.stop();
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "fr-FR";
    recognition.interimResults = true;
    recognition.continuous = false;
    const base = currentValue ? `${currentValue} ` : "";
    recognition.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setValue(base + transcript);
    };
    recognition.onend = () => setListeningField((f) => (f === field ? null : f));
    recognition.onerror = () => setListeningField((f) => (f === field ? null : f));
    recognitionRef.current = recognition;
    setListeningField(field);
    recognition.start();
  };

  return { listeningField, dictateInto };
}
