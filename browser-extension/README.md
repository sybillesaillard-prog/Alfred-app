# Extension Alfred — Gmail & Google Calendar

Ajoute plusieurs petits boutons flottants en bas à droite :

- **Gmail** : "+ Tâche Alfred" — crée une tâche dans Alfred à partir de l'email ouvert (titre = objet du mail, note = expéditeur, lien vers le mail).
- **Gmail** : "Signer & transférer" (n'apparaît que si le mail ouvert a une pièce jointe PDF) — choisis ta signature Pro ou Perso (chacune importée une fois depuis un fichier image sur ton PC), elle est posée automatiquement en bas à droite de la dernière page du PDF, qui est téléchargé signé et, si possible, directement joint à un "Transférer" tout prêt — il ne reste qu'à cliquer Envoyer.
- **Google Calendar** : "+ Tâche Alfred" — pareil, à partir du rendez-vous ouvert.
- **Google Calendar** : "↻ Reprogrammer" — crée une tâche "Reprogrammer : *titre du RDV*" liée au rendez-vous ouvert, pour se souvenir d'en reprendre un nouveau plus tard (Alfred n'a pas de calendrier propre, donc ça reste une tâche comme les autres, visible dans l'onglet "Tâches").

Pour les tâches, une petite fenêtre s'ouvre avant l'enregistrement : titre, catégorie (Perso/Pro), priorité, échéance et note sont **pré-remplis mais modifiables** — rien n'est jamais créé sans validation. Les tâches créées apparaissent immédiatement dans Alfred (page "Tâches"), avec un lien cliquable vers le mail ou le rendez-vous d'origine.

## Signer & transférer un PDF reçu par mail

1. Ouvre le mail contenant le PDF à signer : le bouton "Signer & transférer" apparaît en bas à droite (il n'apparaît que si le mail a une pièce jointe PDF).
2. Au clic, une petite fenêtre demande "Quelle signature utiliser ?" avec deux lignes, **Pro** et **Perso**. La première fois pour chacune, clique "Importer un fichier…" et choisis une image de ta vraie signature (PNG/JPG) déjà sur ton PC — elle est **enregistrée dans le navigateur** (pas envoyée à Alfred ni ailleurs) et réutilisée automatiquement les fois suivantes, plus besoin de la réimporter à chaque mail. Idéalement une image au fond transparent (ex. export d'une appli de signature) : sinon le fond du fichier (souvent blanc) restera visible une fois posé sur le PDF.
3. Clique "Utiliser celle-ci" sur la ligne voulue (Pro ou Perso) : le PDF signé (signature posée en bas à droite de la dernière page) est téléchargé, et l'extension essaie de l'attacher directement à un "Transférer" qu'elle ouvre pour toi. Il ne reste qu'à vérifier le destinataire/message et cliquer Envoyer — **rien n'est envoyé automatiquement**, Sybille garde la main sur l'envoi.
4. Si l'attachement automatique rate (interface Gmail qui a changé, pièce jointe trop grosse, etc.), le PDF signé est de toute façon déjà sur le disque (téléchargements) — il suffit de le joindre à la main.
5. Pour remplacer le fichier d'une signature (erreur, nouvelle signature) : clic droit (ou appui long) sur le bouton "Signer & transférer" — ouvre la même fenêtre en mode "Gérer mes signatures", sans déclencher de signature.

Tout se passe dans le navigateur : le PDF n'est jamais envoyé à un serveur, ni à Alfred/Firebase, ni ailleurs — uniquement lu et modifié localement avec la bibliothèque `pdf-lib` (vendorisée dans `vendor/pdf-lib.min.js`), puis déposé directement dans Gmail. Les 2 images de signature (Pro et Perso) sont stockées uniquement dans `chrome.storage.local` de ce navigateur, jamais envoyées ailleurs.

**Limite connue :** la signature est toujours posée au même endroit (bas droite, dernière page) — il n'y a pas encore de réglage pour choisir la position ou la page. L'attachement automatique au transfert repose sur l'interface interne de Gmail (comme le pré-remplissage des tâches) : si Gmail change son interface, il peut cesser de fonctionner — le téléchargement, lui, continue toujours à marcher. Si le fichier importé n'a pas de fond transparent, le fond (souvent blanc) de l'image reste visible sur le PDF — pas de retrait automatique du fond.

## Installation (extension non publiée sur le Chrome Web Store)

1. Ouvre `chrome://extensions` dans Chrome.
2. Active "Mode développeur" (en haut à droite).
3. Clique "Charger l'extension non empaquetée" et sélectionne ce dossier (`browser-extension`).
4. L'icône Alfred apparaît dans la barre d'extensions — épingle-la si besoin (icône puzzle 🧩 → épingle).

Après une mise à jour du code de l'extension, il faut la recharger manuellement : `chrome://extensions` → bouton ⟳ sur la carte Alfred.

## Connexion

1. Clique sur l'icône Alfred dans la barre du navigateur.
2. Connecte-toi avec le même email/mot de passe que sur l'app Alfred (les tâches créées vont dans TON compte, exactement comme depuis l'app).
3. Va sur Gmail ou Google Calendar : les boutons apparaissent en bas à droite après quelques secondes.

La connexion reste active tant que tu ne cliques pas sur "Se déconnecter" (le jeton se renouvelle tout seul en arrière-plan). La connexion n'est utile que pour les tâches — "Signer & transférer" fonctionne même sans être connecté à Alfred, puisqu'il ne touche jamais à Firebase.

## Comment ça marche techniquement

- L'extension parle **directement** à Firebase (le même projet que l'app Alfred) — pas de serveur intermédiaire, pas de code à héberger.
- Les tâches créées utilisent exactement le même modèle de données que le formulaire "Nouvelle tâche" de l'app (`users/{toi}/tasks` dans Firestore), donc elles s'affichent, se filtrent et se modifient normalement dans Alfred.
- Les boutons sont **flottants** plutôt qu'insérés dans les menus de Gmail/Calendar : Google change régulièrement l'apparence interne de ces pages, et un bouton flottant reste fiable là où une insertion dans leur barre d'outils casserait à la prochaine mise à jour de Gmail/Calendar.
- Le titre/la date pré-remplis viennent d'une lecture "best effort" de la page (objet du mail, texte du rendez-vous ouvert) : ça marche dans la grande majorité des cas, mais reste modifiable si jamais Google change quelque chose et que le pré-remplissage rate.
- "Signer & transférer" récupère le PDF via l'attribut `download_url` que Gmail pose sur ses pièces jointes (même origine que la page, donc pas de permission réseau supplémentaire), le modifie entièrement dans le navigateur avec `pdf-lib`, puis tente de le déposer dans un compose "Transférer" en simulant un glisser-déposer — comme pour le pré-remplissage, ce dernier point est un "best effort" qui peut casser si Gmail change son interface ; le téléchargement du PDF signé, lui, ne dépend d'aucun détail d'interface et marche toujours.

## Limites connues

- Fonctionne uniquement dans Chrome (ou un navigateur basé Chromium avec le mode développeur).
- Pas encore publiée sur le Chrome Web Store — à recharger manuellement (`chrome://extensions` → bouton ⟳) après une modification du code.
- Le bouton "Reprogrammer" crée une **tâche de rappel**, il ne modifie pas et ne duplique pas l'évènement dans Google Calendar lui-même.
- "Signer & transférer" : position de signature fixe, et attachement automatique au transfert non garanti selon les mises à jour de Gmail (voir ci-dessus).
