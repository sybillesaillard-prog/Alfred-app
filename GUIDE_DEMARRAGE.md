# Guide de mise en route — Alfred

Ce guide t'explique comment faire fonctionner l'app pour de vrai : créer la base de données gratuite (Firebase) qui permet la synchro entre ton PC et ton téléphone, puis mettre l'app en ligne (Vercel) pour y accéder de partout.

Compte à prévoir : ~15-20 minutes, aucune carte bancaire nécessaire (tout reste dans les paliers gratuits pour un usage personnel).

---

## Étape 1 — Créer le projet Firebase (gratuit)

Firebase (Google) va stocker tes dépenses et tâches, et les synchroniser en temps réel entre tes appareils.

1. Va sur **https://console.firebase.google.com** et connecte-toi avec ton compte Google.
2. Clique sur **"Ajouter un projet"**.
3. Donne-lui un nom, par exemple `alfred-perso`. Tu peux désactiver Google Analytics (pas nécessaire ici).
4. Clique sur **"Créer le projet"**, puis attends la fin de la création.

### Ajouter une application Web

1. Sur la page d'accueil du projet, clique sur l'icône **`</>`** ("Web").
2. Donne un surnom à l'app (ex. `alfred-web`), pas besoin de cocher "Hébergement Firebase".
3. Clique sur **"Enregistrer l'application"**.
4. Firebase affiche un bloc de code avec un objet `firebaseConfig` qui ressemble à ça :

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "alfred-perso.firebaseapp.com",
     projectId: "alfred-perso",
     storageBucket: "alfred-perso.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef123456",
   };
   ```

   **Garde cette page ouverte**, tu en auras besoin à l'étape 3.

### Activer l'authentification

1. Dans le menu de gauche, va dans **Build > Authentication**.
2. Clique sur **"Get started"**.
3. Choisis le fournisseur **"E-mail/Mot de passe"**, active-le, puis **Enregistrer**.

### Activer la base de données Firestore

1. Dans le menu de gauche, va dans **Build > Firestore Database**.
2. Clique sur **"Créer une base de données"**.
3. Choisis un emplacement proche de toi (ex. `eur3 (Europe)`), puis **Suivant**.
4. Choisis **"Démarrer en mode production"**, puis **Créer**.
5. Une fois la base créée, va dans l'onglet **"Règles"** en haut.
6. Remplace tout le contenu par celui du fichier `firestore.rules` fourni avec le projet (il garantit que seule toi peux lire/écrire tes propres données) :

   ```
   rules_version = '2';

   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

7. Clique sur **"Publier"**.

---

## Étape 2 — Configurer l'app avec tes clés Firebase

1. Ouvre le projet dans ton éditeur de code (VS Code par exemple).
2. Duplique le fichier `.env.example` et renomme la copie en `.env`.
3. Remplis chaque ligne avec les valeurs copiées depuis `firebaseConfig` (étape 1) :

   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=alfred-perso.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=alfred-perso
   VITE_FIREBASE_STORAGE_BUCKET=alfred-perso.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
   ```

4. Enregistre le fichier. **Ne partage jamais ce fichier `.env`** (il n'est pas envoyé sur GitHub grâce au `.gitignore`).

---

## Étape 3 — Tester en local

Dans un terminal, à la racine du projet :

```bash
npm install
npm run dev
```

Ouvre le lien affiché (ex. `http://localhost:5173`). Tu devrais voir l'écran de connexion Alfred. Crée ton compte avec ton email — c'est ce même compte que tu utiliseras sur ton téléphone pour retrouver tes données.

---

## Étape 4 — Mettre l'app en ligne (Vercel, gratuit)

Pour accéder à l'app depuis ton téléphone, il lui faut une adresse web publique.

### Option simple : Vercel + GitHub

1. Crée un dépôt sur **https://github.com** (gratuit) et pousse le code du projet dedans.
2. Va sur **https://vercel.com**, connecte-toi avec ton compte GitHub.
3. Clique sur **"Add New… > Project"**, choisis ton dépôt `alfred-app`.
4. Vercel détecte automatiquement Vite. Avant de déployer, ouvre **"Environment Variables"** et ajoute les 6 mêmes variables que dans ton fichier `.env` (mêmes noms, mêmes valeurs).
5. Clique sur **"Deploy"**. Après 1-2 minutes, Vercel te donne une adresse du type `https://alfred-app-xxxx.vercel.app`.

Cette adresse est celle que tu utiliseras sur ton PC **et** sur ton téléphone.

> Si tu préfères, je peux t'accompagner pour faire ce déploiement en direct la prochaine fois que tu es connectée avec ton navigateur Chrome ouvert — dis-le-moi simplement.

---

## Étape 5 — Installer l'app comme une vraie appli

L'app est une PWA (Progressive Web App) : pas besoin de passer par le Play Store.

**Sur Android (Chrome) :**
1. Ouvre l'adresse Vercel dans Chrome.
2. Un bandeau ou un menu **"Ajouter à l'écran d'accueil"** / **"Installer l'application"** apparaît (menu ⋮ en haut à droite si besoin).
3. Confirme — une icône Alfred apparaît sur ton écran d'accueil, comme une app normale.

**Sur PC (Chrome/Edge) :**
1. Ouvre l'adresse Vercel.
2. Une icône d'installation apparaît dans la barre d'adresse (petit écran avec une flèche), ou via le menu ⋮ **"Installer Alfred…"**.
3. L'app s'ouvre alors dans sa propre fenêtre, sans barre de navigateur.

Connecte-toi avec le même compte (email/mot de passe créé à l'étape 3) sur les deux appareils : tes dépenses et tâches se synchronisent automatiquement, y compris hors-ligne (les modifications faites sans connexion s'envoient dès que le réseau revient).

---

## Et après ?

- **Coût** : Firebase et Vercel sont gratuits dans ces volumes d'usage personnel (le palier gratuit Firebase "Spark" couvre largement un usage solo).
- **Sécurité** : seul ton compte peut lire/écrire tes données grâce aux règles Firestore mises en place.
- **Évolutions possibles** : ajouter des catégories de dépenses, exporter en Excel, ajouter des rappels, etc. — reviens vers moi quand tu veux faire évoluer l'app.
