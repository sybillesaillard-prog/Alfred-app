// Mémorisation des groupes de doublons que Sybille a explicitement écartés
// ("Ce n'est pas un doublon, écarter") sur la page Doublons. Avant le 18/09,
// cet état vivait uniquement dans un useState côté React — perdu à chaque
// rechargement de page/navigation, ce qui faisait réapparaître les groupes
// déjà écartés à chaque fois. Même pattern qu'ailleurs dans l'app pour un
// petit état persistant qui n'est pas une vraie liste (cf. gmailSync.js,
// mailTasksSync.js) : un seul document Firestore (users/{uid}/meta/
// duplicatesDismissed), accès direct via getDoc/setDoc plutôt que via
// useCollection (pensé pour des collections, pas un état global unique).
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

function metaDocRef(uid) {
  return doc(db, "users", uid, "meta", "duplicatesDismissed");
}

// Une "clé" de groupe = les id des dépenses du groupe joints par "-" (même
// construction que dans Duplicates.jsx) — stable tant que les dépenses du
// groupe ne changent pas ; si une nouvelle occurrence rejoint plus tard un
// groupe déjà écarté, la clé change et le groupe (élargi) réapparaît
// normalement pour confirmation, plutôt que de rester caché silencieusement.
export async function getDismissedGroupKeys(uid) {
  const snap = await getDoc(metaDocRef(uid));
  if (!snap.exists()) return [];
  const data = snap.data();
  return Array.isArray(data.keys) ? data.keys : [];
}

export function setDismissedGroupKeys(uid, keys) {
  return setDoc(metaDocRef(uid), { keys }, { merge: true });
}
