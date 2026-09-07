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
const BASCULE_PROMPT = `Lance la bascule des justificatifs de dépenses de mon Google Drive vers mon PC (dossier "Alfred - Justificatifs", classé par année/mois d'achat). Pour chaque justificatif encore présent : télécharge-le, trouve le dossier "Fournisseurs" du mois correspondant dans mon arborescence locale (Cabinet ISRAEL/<année>/<mois>/Fournisseurs — réutilise le nom de dossier déjà existant, ne le renomme pas et n'en crée pas un nouveau si un similaire existe déjà), dépose le fichier là, vérifie que ça a réussi, puis seulement à ce moment-là supprime (corbeille, pas suppression définitive) le fichier du Drive. Si un fichier très proche existe déjà dans le dossier de destination (même montant ou nom proche), transfère quand même le nouveau fichier mais signale-le moi clairement à la fin sans rien supprimer ni écraser. Si tu n'as pas accès à mon PC en ce moment, ne touche à rien côté Drive et dis-le moi.`;

export function buildBasculeClaudeDesktopLink() {
  return `claude://claude.ai/new?q=${encodeURIComponent(BASCULE_PROMPT)}`;
}
