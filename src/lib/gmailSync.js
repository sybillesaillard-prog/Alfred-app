// Petit état persistant pour la vérification manuelle de la boîte Gmail :
// la date de dernière interrogation (pour ne chercher que les nouveaux
// emails la fois suivante), et les listes d'expéditeurs connus / mots-clés
// que Sybille peut enrichir elle-même. Un seul document Firestore
// (users/{uid}/meta/gmailSync) plutôt qu'une collection — useCollection.js
// est pensé pour des listes, pas pour un état global unique — donc accès
// direct via getDoc/setDoc ici, hors du hook partagé.
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// Point de départ raisonnable, dérivé des fournisseurs déjà connus
// d'Alfred (mots-clés des charges fixes, cf. src/lib/fixedCharges.js, et
// polices Allianz) — à ajuster/compléter par Sybille depuis la page
// "Boîte mail". Une correspondance est une simple sous-chaîne insensible à
// la casse sur l'expéditeur (adresse ou nom affiché).
const DEFAULT_KNOWN_SENDERS = [
  "free.fr",
  "edf.fr",
  "allianz.fr",
  "banquepopulaire.fr",
  "urssaf.fr",
  "probtp.com",
  "alptis.org",
  "bpce.fr",
  "cibtp.fr",
  "impots.gouv.fr",
  "asf.fr",
  "google.com",
];

const DEFAULT_KEYWORDS = ["facture", "reçu", "recu", "avis d'échéance", "echeance", "cotisation"];

function metaDocRef(uid) {
  return doc(db, "users", uid, "meta", "gmailSync");
}

export async function getGmailSyncState(uid) {
  const snap = await getDoc(metaDocRef(uid));
  if (!snap.exists()) {
    return { lastCheckedAt: null, knownSenders: DEFAULT_KNOWN_SENDERS, keywords: DEFAULT_KEYWORDS };
  }
  const data = snap.data();
  return {
    lastCheckedAt: data.lastCheckedAt || null,
    knownSenders: data.knownSenders?.length ? data.knownSenders : DEFAULT_KNOWN_SENDERS,
    keywords: data.keywords?.length ? data.keywords : DEFAULT_KEYWORDS,
  };
}

export function setLastCheckedAt(uid, iso) {
  return setDoc(metaDocRef(uid), { lastCheckedAt: iso }, { merge: true });
}

export function setKnownSendersAndKeywords(uid, knownSenders, keywords) {
  return setDoc(metaDocRef(uid), { knownSenders, keywords }, { merge: true });
}
