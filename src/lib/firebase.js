import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// Ces identifiants Firebase ne sont pas des secrets : ils désignent
// publiquement le projet auprès de Google et se retrouvent de toute façon
// dans le bundle JS envoyé au navigateur de n'importe quel visiteur. La
// vraie protection des données vient des règles Firestore (firestore.rules),
// pas de la confidentialité de ces valeurs — Google documente qu'il est
// normal de les committer telles quelles dans une app web cliente.
// On garde la possibilité de les surcharger via .env (utile en local ou
// si un jour on héberge ailleurs) mais on ne dépend plus de secrets CI.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDETH8iXYP8WTBivoIxqPdUelhxgL6qYXM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "alfred-perso.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "alfred-perso",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "alfred-perso.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "956769503242",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:956769503242:web:f53447f0ed9a7ec572b7f3",
};

// True once every required key is present — lets the UI show a friendly
// setup screen instead of a cryptic Firebase error when .env isn't filled in.
export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (v) => typeof v === "string" && v.length > 0
);

let app, auth, db;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  // Offline-first cache: the app keeps working without network (e.g. metro,
  // avion) and syncs automatically once back online, on any tab/device.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
}

export { app, auth, db };
