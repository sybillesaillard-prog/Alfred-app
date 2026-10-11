// Identifiants publics du projet Firebase d'Alfred (les mêmes que dans
// src/lib/firebase.js de l'app). Comme l'explique le commentaire original :
// ces valeurs ne sont pas des secrets, elles désignent juste le projet
// auprès de Google. La vraie protection vient des règles Firestore
// (firestore.rules), qui n'autorisent chaque utilisateur qu'à lire/écrire
// SES PROPRES données, quel que soit le client (app web ou cette extension).
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDETH8iXYP8WTBivoIxqPdUelhxgL6qYXM",
  projectId: "alfred-perso",
};

// Comptes mail connus, pour deviner automatiquement perso/pro depuis Gmail
// (repris de src/lib/mailTasksSync.js — modifiable ici si les adresses
// changent, la détection reste juste une suggestion pré-remplie et modifiable
// dans le formulaire).
export const KNOWN_MAILBOXES = {
  "sybille.saillard@gmail.com": "perso",
  "sybil.com@gmail.com": "pro",
};
