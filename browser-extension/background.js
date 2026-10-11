// Service worker de l'extension : seul endroit qui parle au réseau
// (Firebase Auth + Firestore). Les content scripts (Gmail/Calendar) ne font
// que scanner la page et afficher un petit formulaire — ils passent par des
// messages chrome.runtime pour tout le reste. Ça évite tout souci de CSP
// (Content-Security-Policy) des pages Gmail/Calendar, et centralise la
// gestion du jeton d'authentification à un seul endroit.
import { FIREBASE_CONFIG } from "./config.js";

const AUTH_KEY = "alfred_ext_auth"; // { idToken, refreshToken, uid, email, expiresAt }

async function getAuth() {
  const { [AUTH_KEY]: auth } = await chrome.storage.local.get(AUTH_KEY);
  return auth || null;
}

async function setAuth(auth) {
  await chrome.storage.local.set({ [AUTH_KEY]: auth });
}

async function clearAuth() {
  await chrome.storage.local.remove(AUTH_KEY);
}

// --- Connexion (email + mot de passe du compte Alfred) --------------------

async function login(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || "";
    if (msg.includes("INVALID_LOGIN_CREDENTIALS") || msg.includes("INVALID_PASSWORD") || msg.includes("EMAIL_NOT_FOUND")) {
      throw new Error("Email ou mot de passe incorrect.");
    }
    throw new Error("La connexion a échoué (" + (msg || res.status) + ").");
  }
  const auth = {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    uid: data.localId,
    email: data.email,
    expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000 - 60_000,
  };
  await setAuth(auth);
  return { email: auth.email };
}

async function logout() {
  await clearAuth();
}

// Rafraîchit le jeton s'il expire dans moins d'une minute (ou est déjà
// expiré). Renvoie l'auth à jour, ou null si personne n'est connecté.
async function ensureFreshAuth() {
  const auth = await getAuth();
  if (!auth) return null;
  if (auth.expiresAt > Date.now()) return auth;

  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: auth.refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) {
    // Jeton de rafraîchissement invalide/révoqué — il faut se reconnecter.
    await clearAuth();
    throw new Error("Session Alfred expirée — reconnecte-toi depuis l'icône de l'extension.");
  }
  const refreshed = {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    uid: data.user_id,
    email: auth.email,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 - 60_000,
  };
  await setAuth(refreshed);
  return refreshed;
}

// --- Écriture Firestore -----------------------------------------------

// Convertit un objet JS simple en format "Firestore REST" ({ fields: {...} }),
// avec le même sous-ensemble de types que ceux utilisés par le formulaire de
// tâche d'Alfred (string, boolean, null, timestamp).
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === "boolean") {
      fields[key] = { booleanValue: value };
    } else if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }
  return { fields };
}

// Crée une tâche dans users/{uid}/tasks — exactement le même modèle de
// données que src/lib/useCollection.js + src/components/TaskForm.jsx côté
// app (title, category, subcategory, priority, dueDate, note, done, +
// createdAt), avec en plus un champ `link` (déjà supporté par Tasks.jsx pour
// les tâches créées depuis un mail) pointant vers le mail ou l'évènement
// d'origine.
async function createTask(payload) {
  const auth = await ensureFreshAuth();
  if (!auth) throw new Error("Pas connecté à Alfred — clique sur l'icône de l'extension pour te connecter.");

  const data = {
    title: payload.title,
    category: payload.category === "pro" ? "pro" : "perso",
    subcategory: payload.subcategory || null,
    priority: ["basse", "normale", "haute"].includes(payload.priority) ? payload.priority : "normale",
    dueDate: payload.dueDate || null,
    note: payload.note || null,
    done: false,
    link: payload.link || null,
    createdAt: new Date(),
  };

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/users/${auth.uid}/tasks`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.idToken}`,
    },
    body: JSON.stringify(toFirestoreFields(data)),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error("L'enregistrement dans Alfred a échoué (" + (errBody?.error?.message || res.status) + ").");
  }
  return true;
}

// --- Messagerie avec les content scripts / popup --------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "LOGIN": {
          const result = await login(msg.email, msg.password);
          sendResponse({ ok: true, ...result });
          break;
        }
        case "LOGOUT": {
          await logout();
          sendResponse({ ok: true });
          break;
        }
        case "STATUS": {
          const auth = await getAuth();
          sendResponse({ ok: true, connected: !!auth, email: auth?.email || null });
          break;
        }
        case "CREATE_TASK": {
          await createTask(msg.payload);
          sendResponse({ ok: true });
          break;
        }
        default:
          sendResponse({ ok: false, error: "Message inconnu." });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();
  return true; // réponse asynchrone
});
