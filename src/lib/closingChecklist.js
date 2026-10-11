// Mémorisation de la checklist de clôture trimestrielle (07/10, demande de
// Sybille : "checklist de clôture trimestrielle"). Même pattern qu'ailleurs
// dans l'app pour un petit état persistant qui n'est pas une vraie
// collection (cf. duplicatesDismissed.js, gmailSync.js) : un document
// Firestore par trimestre, accès direct via getDoc/setDoc.
//
// Seuls les points qui ne peuvent pas être recalculés automatiquement à
// chaque ouverture de la page (vérification des fichiers sur le PC — déjà
// faite sur la page Pointage, pas dupliquée ici ; déclaration de TVA faite
// hors d'Alfred, chez le comptable/impots.gouv.fr) sont mémorisés ici. Le
// reste (dépenses/recettes rapprochées, doublons en attente) est recalculé
// à la volée depuis les données déjà enregistrées, jamais stocké à part —
// pour ne jamais afficher un ✅ périmé.
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

function docRef(uid, quarterKey) {
  return doc(db, "users", uid, "closingChecklist", quarterKey);
}

const DEFAULTS = { filesChecked: false, vatDeclared: false, vatDeclaredOn: null };

export async function getClosingChecklist(uid, quarterKey) {
  const snap = await getDoc(docRef(uid, quarterKey));
  if (!snap.exists()) return { ...DEFAULTS };
  return { ...DEFAULTS, ...snap.data() };
}

export function setClosingChecklist(uid, quarterKey, data) {
  return setDoc(docRef(uid, quarterKey), data, { merge: true });
}
