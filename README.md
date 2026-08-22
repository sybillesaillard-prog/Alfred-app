# Alfred

Application personnelle (PWA) pour suivre les dépenses de ta société et tes tâches perso/pro, synchronisée entre ton PC et ton téléphone Android.

**Avant de commencer : lis `GUIDE_DEMARRAGE.md`** — il t'explique pas à pas comment créer le projet Firebase gratuit (nécessaire pour la synchro) et déployer l'app.

## Développement local

```bash
npm install
cp .env.example .env   # puis remplis .env avec tes clés Firebase (voir le guide)
npm run dev
```

## Build de production

```bash
npm run build
npm run preview   # pour tester le build localement
```

## Stack technique

- React + Vite
- Tailwind CSS
- Firebase Authentication (email/mot de passe) + Firestore (base de données temps réel, avec cache local hors-ligne)
- `vite-plugin-pwa` pour le manifest et le service worker (installation sur mobile/PC, fonctionnement hors-ligne)
- React Router pour la navigation
- Recharts pour le graphique de répartition des dépenses
