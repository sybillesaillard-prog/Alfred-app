// Bascule des justificatifs Drive -> PC (01/09, demande de Sybille) : le
// transfert lui-même ne peut pas se faire depuis l'app (une PWA ne peut pas
// écrire à un chemin arbitraire du disque local) — il est fait par Claude,
// via son accès à Google Drive et au PC de Sybille. Une tâche programmée le
// fait déjà automatiquement chaque dimanche soir ; ce lien sert au
// déclenchement manuel (07/09, demande de Sybille : "ajoute un bouton
// quelquepart dans alfred pour lancer la bascule").
//
// Le bouton ouvre l'app Claude Desktop avec la demande déjà écrite dans le
// champ de saisie — rien ne part avant qu'elle clique Envoyer elle-même
// (schéma d'URL `claude://claude.ai/new?q=...`, documenté par Anthropic).
// Ouvrir via Claude Desktop plutôt qu'un lien https://claude.ai classique
// est un choix délibéré : c'est ce qui donne à la conversation le meilleur
// accès à son PC (nécessaire pour écrire les fichiers), plutôt qu'une
// session web qui n'y serait pas forcément liée.
//
// 10/09, demande de Sybille : vérifier/corriger le compte actif de l'appli
// "Google Drive pour ordinateur" sur son PC avant de lancer la bascule (elle
// a plusieurs comptes Google, et cette appli peut se retrouver connectée au
// mauvais). Ajouté comme une étape 0 explicite dans le texte de la demande.
// Choix assumé, validé avec elle (AskUserQuestion) : Claude peut basculer
// lui-même vers le bon compte via le sélecteur de compte de l'appli, mais ne
// doit JAMAIS saisir de mot de passe à sa place (règle générale de sécurité
// de cette session) — s'il faut se reconnecter, il doit s'arrêter à cet
// écran et lui demander de le faire elle-même, puis reprendre.
const BASCULE_PROMPT = `Lance la bascule des justificatifs de dépenses de mon Google Drive vers mon PC.

Étape 0 (à faire avant tout le reste) : vérifie le compte actif de l'application "Google Drive pour ordinateur" sur mon PC (icône dans la barre des tâches Windows, en bas à droite). Si elle n'est pas connectée à sybille.saillard@gmail.com, bascule toi-même vers ce compte via le sélecteur de compte de l'application (ajoute-le comme compte si besoin). Ne saisis jamais mon mot de passe à ma place : si une connexion ou une vérification (mot de passe, code, validation sur mon téléphone) est demandée, arrête-toi à cet écran, dis-le-moi clairement et attends que je la fasse moi-même avant de continuer. Si l'application est déjà sur le bon compte, passe directement à la suite.

Ensuite, pour le dossier "Alfred - Justificatifs" (classé par année/mois d'achat) : pour chaque justificatif encore présent, télécharge-le, trouve le dossier "Fournisseurs" du mois correspondant dans mon arborescence locale (Cabinet ISRAEL/<année>/<mois>/Fournisseurs — réutilise le nom de dossier déjà existant, ne le renomme pas et n'en crée pas un nouveau si un similaire existe déjà), dépose le fichier là, vérifie que ça a réussi, puis seulement à ce moment-là supprime (corbeille, pas suppression définitive) le fichier du Drive. Si un fichier très proche existe déjà dans le dossier de destination (même montant ou nom proche), transfère quand même le nouveau fichier mais signale-le moi clairement à la fin sans rien supprimer ni écraser. Si tu n'as pas accès à mon PC en ce moment, ne touche à rien côté Drive et dis-le moi.`;

export function buildBasculeClaudeDesktopLink() {
  return `claude://claude.ai/new?q=${encodeURIComponent(BASCULE_PROMPT)}`;
}
