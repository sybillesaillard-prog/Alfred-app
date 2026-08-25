// État persistant pour la section "Tâches à faire" (import depuis les
// mails, cf. src/pages/MailTasks.jsx) : la liste des boîtes mail
// configurées (Perso/Pro, potentiellement plusieurs de chaque — Sybille a
// prévenu le 25/08 qu'elle ajouterait peut-être une 2e boîte pro) et la
// date de dernière vérification de CHACUNE. Même principe qu'un seul
// document Firestore que src/lib/gmailSync.js, pour la même raison
// (useCollection.js est pensé pour des listes, pas un état global).
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// Boîtes de départ, pré-remplies avec les 2 adresses déjà cadrées avec
// Sybille le 25/08/2026 — modifiables/complétables ensuite depuis les
// réglages de la page (ajout d'une 3e boîte, renommage...).
const DEFAULT_MAILBOXES = [
  { key: "perso-1", label: "Perso (sybille.saillard@gmail.com)", category: "perso" },
  { key: "pro-1", label: "Pro (sybil.com@gmail.com)", category: "pro" },
];

function metaDocRef(uid) {
  return doc(db, "users", uid, "meta", "mailTasksSync");
}

export async function getMailTasksSyncState(uid) {
  const snap = await getDoc(metaDocRef(uid));
  if (!snap.exists()) {
    return { mailboxes: DEFAULT_MAILBOXES, lastCheckedAt: {} };
  }
  const data = snap.data();
  return {
    mailboxes: data.mailboxes?.length ? data.mailboxes : DEFAULT_MAILBOXES,
    lastCheckedAt: data.lastCheckedAt || {},
  };
}

export function setMailboxes(uid, mailboxes) {
  return setDoc(doc(db, "users", uid, "meta", "mailTasksSync"), { mailboxes }, { merge: true });
}

export function setMailboxLastCheckedAt(uid, mailboxKey, iso) {
  return setDoc(
    doc(db, "users", uid, "meta", "mailTasksSync"),
    { lastCheckedAt: { [mailboxKey]: iso } },
    { merge: true }
  );
}

// Génère une clé de boîte unique à partir de son libellé — utilisée quand
// Sybille ajoute une nouvelle boîte depuis les réglages, pour ne jamais
// entrer en collision avec une boîte existante (ni avec les jetons
// sessionStorage de mailboxAuth.js, qui sont indexés par cette clé).
export function makeMailboxKey(existingKeys) {
  let i = 1;
  while (existingKeys.includes(`mailbox-${i}`)) i++;
  return `mailbox-${i}`;
}
