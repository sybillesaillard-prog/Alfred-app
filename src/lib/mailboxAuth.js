// Connexion Gmail en LECTURE SEULE (gmail.readonly), généralisée pour
// gérer PLUSIEURS boîtes Gmail indépendantes en parallèle — contrairement à
// src/lib/gmail.js (une seule connexion, dédiée à l'import de factures),
// chaque boîte ici est identifiée par une "clé" arbitraire (mailboxKey,
// cf. src/lib/mailTasksSync.js) et garde son propre jeton, son propre
// client OAuth et sa propre entrée sessionStorage — pour que Sybille
// puisse connecter autant de boîtes Perso/Pro qu'elle veut au fil du temps
// (25/08/2026, demande explicite : "je rajouterai peut-être même une autre
// boîte mail pro") sans avoir à ajouter du code à chaque nouvelle boîte.
//
// Ne réutilise volontairement PAS le jeton déjà connecté par gmail.js (même
// quand il s'agit du même compte Gmail, ex. sybil.com@gmail.com) : les deux
// fonctionnalités (import de factures / tâches à faire) restent
// complètement indépendantes l'une de l'autre, y compris côté connexion —
// se déconnecter de l'une n'affecte jamais l'autre. Léger inconvénient
// assumé : un premier clic "Connecter" est nécessaire ici même si la boîte
// est déjà connectée ailleurs dans l'app.
const CLIENT_ID = "956769503242-9ao945kbfa7pvsacue4srrs5duml1159.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

function storageKey(mailboxKey) {
  return `alfred_mailbox_token_${mailboxKey}`;
}

function loadStoredToken(mailboxKey) {
  try {
    const raw = sessionStorage.getItem(storageKey(mailboxKey));
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    if (!token || !expiresAt || Date.now() >= expiresAt) {
      sessionStorage.removeItem(storageKey(mailboxKey));
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function storeToken(mailboxKey, token, expiresInSeconds) {
  try {
    const expiresAt = Date.now() + Math.max(0, (expiresInSeconds || 3600) - 120) * 1000;
    sessionStorage.setItem(storageKey(mailboxKey), JSON.stringify({ token, expiresAt }));
  } catch {
    // sessionStorage indisponible — tant pis, reconnexion au prochain clic.
  }
}

function waitForGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (window.google?.accounts?.oauth2) {
        clearInterval(iv);
        resolve();
      } else if (tries > 100) {
        clearInterval(iv);
        reject(new Error("Google Identity Services n'a pas pu être chargé."));
      }
    }, 100);
  });
}

// Un état (jeton + client OAuth) par mailboxKey, créé à la demande la
// première fois qu'une boîte est utilisée (contrairement à gmail.js/
// googleDrive.js qui n'ont qu'une seule connexion possible, donc peuvent
// l'initialiser une fois pour toutes au chargement du module).
const mailboxes = new Map(); // mailboxKey -> { accessToken, tokenClient, ready }

function getState(mailboxKey) {
  let s = mailboxes.get(mailboxKey);
  if (!s) {
    s = { accessToken: loadStoredToken(mailboxKey), tokenClient: null, ready: null };
    s.ready = waitForGis()
      .then(() => {
        s.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: () => {},
        });
      })
      .catch(() => {});
    mailboxes.set(mailboxKey, s);
  }
  return s;
}

export function isMailboxConnected(mailboxKey) {
  return !!getState(mailboxKey).accessToken;
}

export function connectMailbox(mailboxKey) {
  const s = getState(mailboxKey);
  if (s.tokenClient) {
    return new Promise((resolve, reject) => {
      s.tokenClient.callback = (resp) => {
        if (resp.error) {
          reject(new Error(resp.error));
          return;
        }
        s.accessToken = resp.access_token;
        storeToken(mailboxKey, s.accessToken, resp.expires_in);
        resolve(s.accessToken);
      };
      // "select_account" : ces boîtes sont potentiellement toutes
      // différentes les unes des autres (et des autres connexions Google de
      // l'app) — on force l'écran de choix de compte plutôt que de
      // re-proposer silencieusement le mauvais compte.
      s.tokenClient.requestAccessToken({ prompt: s.accessToken ? "" : "consent select_account" });
    });
  }
  return s.ready.then(() => connectMailbox(mailboxKey));
}

export function disconnectMailbox(mailboxKey) {
  const s = getState(mailboxKey);
  s.accessToken = null;
  try {
    sessionStorage.removeItem(storageKey(mailboxKey));
  } catch {
    // ignore
  }
}

function authHeaders(mailboxKey) {
  const s = getState(mailboxKey);
  if (!s.accessToken) throw new Error("Cette boîte mail n'est pas connectée.");
  return { Authorization: `Bearer ${s.accessToken}` };
}

function invalidateOnAuthError(mailboxKey, status) {
  if (status === 401 || status === 403) {
    disconnectMailbox(mailboxKey);
    return new Error("Connexion Gmail expirée — reconnecte-toi.");
  }
  return null;
}

// Requête large (pas de filtre "pièce jointe PDF" comme gmail.js — on
// cherche ici des mails à LIRE, pas des factures à télécharger) : les
// dernières nouveautés depuis la dernière vérification (ou repli 3 MOIS à
// la toute première utilisation d'une boîte — demande explicite de Sybille
// le 25/08/2026, pour que la toute première mise en route retrouve aussi
// les tâches un peu plus anciennes, pas seulement les tout derniers jours),
// en excluant les catégories Gmail "Promotions" et "Réseaux sociaux" qui ne
// contiennent quasiment jamais de vraie action à faire — pour limiter le
// volume envoyé à l'IA (donc le coût) sans risquer de rater une vraie tâche
// dans les autres catégories (Principale, Notifications...).
const INITIAL_LOOKBACK_DAYS = 90;

function buildQuery(afterDateISO) {
  const d = afterDateISO ? new Date(afterDateISO) : new Date(Date.now() - INITIAL_LOOKBACK_DAYS * 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `after:${y}/${m}/${day} -category:promotions -category:social`;
}

function decodeHeader(headers, name) {
  const h = (headers || []).find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

// Cherche les mails récents d'une boîte et renvoie leurs métadonnées
// essentielles (expéditeur, objet, aperçu) — SANS le corps complet du mail,
// pour limiter à la fois la donnée envoyée à l'IA (coût) et la donnée
// personnelle exposée. `snippet` (aperçu ~100-200 caractères fourni
// directement par l'API Gmail) suffit dans la grande majorité des cas pour
// juger si un mail attend une action ou non. Limité à 40 mails par
// vérification "normale" (depuis la dernière vérification mémorisée), pour
// borner le coût d'un seul clic sur "Vérifier" au quotidien.
const MAX_CANDIDATES = 40;

// Plafond plus large UNIQUEMENT pour la toute première vérification d'une
// boîte (fenêtre de 3 mois, voir INITIAL_LOOKBACK_DAYS ci-dessus) — sinon 40
// candidats risqueraient de ne couvrir que les tout derniers jours de cette
// fenêtre de 3 mois et de rater des tâches plus anciennes. Le surcoût reste
// négligeable : quelques centaines de mails de plus dans le même UN SEUL
// appel groupé à l'IA (cf. claudeTasks.js) représente au pire quelques
// centimes de plus, jamais un appel par mail.
const MAX_CANDIDATES_FIRST_CHECK = 150;

export async function searchTaskCandidates(mailboxKey, afterDateISO) {
  const q = buildQuery(afterDateISO);
  const maxResults = afterDateISO ? MAX_CANDIDATES : MAX_CANDIDATES_FIRST_CHECK;
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`,
    { headers: authHeaders(mailboxKey) }
  );
  if (!listRes.ok) {
    const err = invalidateOnAuthError(mailboxKey, listRes.status);
    throw err || new Error("La recherche Gmail a échoué.");
  }
  const listData = await listRes.json();
  const messages = listData.messages || [];

  const results = [];
  for (const m of messages) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: authHeaders(mailboxKey) }
    );
    if (!res.ok) continue;
    const data = await res.json();
    const headers = data.payload?.headers || [];
    results.push({
      id: data.id,
      threadId: data.threadId,
      from: decodeHeader(headers, "From"),
      subject: decodeHeader(headers, "Subject"),
      dateHeader: decodeHeader(headers, "Date"),
      internalDate: data.internalDate ? Number(data.internalDate) : null,
      snippet: data.snippet || "",
    });
  }
  return results;
}

// Même heuristique que gmail.js/guessSenderName — dupliquée ici plutôt que
// partagée pour garder les deux modules de connexion Gmail indépendants.
export function guessSenderName(fromHeader) {
  const raw = fromHeader || "";
  const nameMatch = raw.match(/^"?([^"<]+)"?\s*</);
  const name = nameMatch?.[1]?.trim();
  if (name && !name.includes("@")) return name;
  const email = raw.match(/<([^>]+)>/)?.[1] || raw;
  return (email.split("@")[0] || "").trim();
}
