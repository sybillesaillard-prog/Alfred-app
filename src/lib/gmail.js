// Connexion Gmail en LECTURE SEULE (gmail.readonly) pour retrouver les
// factures reçues par email et récupérer leurs pièces jointes PDF — cadré
// avec Sybille le 25/08/2026 (cf. claude/app-alfred-notes.md).
//
// Compte Gmail concerné (sybil.com@gmail.com) très probablement DIFFÉRENT
// du compte utilisé pour Google Drive (googleDrive.js) : ce module garde
// donc son propre jeton, son propre client OAuth et sa propre clé de
// stockage, complètement indépendants de googleDrive.js, pour ne jamais
// mélanger les deux comptes/jetons. Le même CLIENT_ID Google Cloud est
// réutilisé (un seul projet, deux scopes différents) — nécessite que le
// scope gmail.readonly soit activé côté Google Cloud Console par Sybille
// elle-même avant la première connexion (hors de portée de cette session).
const CLIENT_ID = "956769503242-9ao945kbfa7pvsacue4srrs5duml1159.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const TOKEN_STORAGE_KEY = "alfred_gmail_token";

function loadStoredToken() {
  try {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    if (!token || !expiresAt || Date.now() >= expiresAt) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function storeToken(token, expiresInSeconds) {
  try {
    const expiresAt = Date.now() + Math.max(0, (expiresInSeconds || 3600) - 120) * 1000;
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ token, expiresAt }));
  } catch {
    // sessionStorage indisponible — tant pis, reconnexion au prochain clic.
  }
}

let accessToken = loadStoredToken();
let tokenClient = null;

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

// Initialisé en arrière-plan dès le chargement du module (comme dans
// googleDrive.js) pour que connectGmail() puisse appeler
// requestAccessToken() sans aucun `await` intermédiaire depuis le clic —
// sinon la popup de consentement Google peut être bloquée par le
// navigateur, surtout sur mobile/PWA.
let tokenClientReady = waitForGis()
  .then(() => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: () => {},
    });
  })
  .catch(() => {});

export function isGmailConnected() {
  return !!accessToken;
}

export function connectGmail() {
  if (tokenClient) {
    return new Promise((resolve, reject) => {
      tokenClient.callback = (resp) => {
        if (resp.error) {
          reject(new Error(resp.error));
          return;
        }
        accessToken = resp.access_token;
        storeToken(accessToken, resp.expires_in);
        resolve(accessToken);
      };
      // "select_account" en plus de "consent" : le compte Gmail à connecter
      // est très probablement différent de celui déjà connecté pour Drive —
      // on force l'écran de choix de compte plutôt que de re-proposer
      // silencieusement le mauvais compte.
      tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent select_account" });
    });
  }
  return tokenClientReady.then(() => connectGmail());
}

function authHeaders() {
  if (!accessToken) throw new Error("Gmail n'est pas connecté.");
  return { Authorization: `Bearer ${accessToken}` };
}

// Requête de recherche Gmail : pièce jointe PDF obligatoire (c'est ce qu'on
// veut récupérer), depuis la dernière vérification (ou repli 90 jours à la
// toute première utilisation, quand aucune date n'est encore mémorisée).
// Les expéditeurs connus et mots-clés d'objet NE filtrent PAS cette
// recherche — pour ne rater aucune facture PDF légitime — ils servent
// seulement à mettre en avant les candidats les plus probables dans la
// liste de résultats (cf. scoreCandidate ci-dessous).
function buildQuery(afterDateISO) {
  const d = afterDateISO ? new Date(afterDateISO) : new Date(Date.now() - 90 * 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `has:attachment filename:pdf after:${y}/${m}/${day}`;
}

function decodeHeader(headers, name) {
  const h = (headers || []).find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

function findPdfParts(payload, out = []) {
  if (!payload) return out;
  if (payload.filename && payload.mimeType === "application/pdf" && payload.body?.attachmentId) {
    out.push({
      filename: payload.filename,
      attachmentId: payload.body.attachmentId,
      size: payload.body.size || 0,
    });
  }
  (payload.parts || []).forEach((p) => findPdfParts(p, out));
  return out;
}

// Cherche les emails avec pièce jointe PDF depuis afterDateISO, et renvoie
// pour chacun ses métadonnées + la liste de ses pièces jointes PDF (un
// email peut en avoir plusieurs). N'écrit rien nulle part — la mémorisation
// de la date de dernière vérification est à la charge de l'appelant
// (cf. src/lib/gmailSync.js), une fois la recherche terminée avec succès.
export async function searchInvoiceCandidates(afterDateISO) {
  const q = buildQuery(afterDateISO);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`,
    { headers: authHeaders() }
  );
  if (!listRes.ok) {
    if (listRes.status === 401 || listRes.status === 403) {
      accessToken = null;
      try {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch {
        // ignore
      }
      throw new Error("Connexion Gmail expirée — reconnecte-toi.");
    }
    throw new Error("La recherche Gmail a échoué.");
  }
  const listData = await listRes.json();
  const messages = listData.messages || [];

  const results = [];
  for (const m of messages) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
      { headers: authHeaders() }
    );
    if (!res.ok) continue;
    const data = await res.json();
    const headers = data.payload?.headers || [];
    const pdfs = findPdfParts(data.payload);
    if (pdfs.length === 0) continue;
    results.push({
      id: data.id,
      threadId: data.threadId,
      from: decodeHeader(headers, "From"),
      subject: decodeHeader(headers, "Subject"),
      dateHeader: decodeHeader(headers, "Date"),
      internalDate: data.internalDate ? Number(data.internalDate) : null,
      attachments: pdfs,
    });
  }
  return results;
}

function base64UrlToBlob(b64url, mimeType) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export async function downloadAttachment(messageId, attachmentId, filename) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("Le téléchargement de la pièce jointe a échoué.");
  const data = await res.json();
  const blob = base64UrlToBlob(data.data, "application/pdf");
  return new File([blob], filename || "facture.pdf", { type: "application/pdf" });
}

// Extrait un nom d'expéditeur lisible depuis un en-tête "From" du type
// `"EDF Particuliers" <no-reply@edf.fr>` ou `contact@fournisseur.fr` — sert
// de suggestion de fournisseur pré-remplie dans le formulaire de dépense
// (comme pour l'OCR), à corriger si besoin.
export function guessSenderName(fromHeader) {
  const raw = fromHeader || "";
  const nameMatch = raw.match(/^"?([^"<]+)"?\s*</);
  const name = nameMatch?.[1]?.trim();
  if (name && !name.includes("@")) return name;
  const email = raw.match(/<([^>]+)>/)?.[1] || raw;
  return (email.split("@")[0] || "").trim();
}

// Score indicatif (PAS un filtre) : combien de signaux connus (expéditeur,
// mot-clé objet) confirment que ce PDF est probablement une vraie facture —
// sert uniquement à trier/mettre en avant les résultats les plus probables
// dans la liste, tout candidat avec PDF reste visible et importable.
export function scoreCandidate(candidate, knownSenders = [], keywords = []) {
  const from = (candidate.from || "").toLowerCase();
  const subject = (candidate.subject || "").toLowerCase();
  const senderMatch = knownSenders.some((s) => s && from.includes(s.toLowerCase()));
  const keywordMatch = keywords.some((k) => k && subject.includes(k.toLowerCase()));
  return { senderMatch, keywordMatch, score: (senderMatch ? 2 : 0) + (keywordMatch ? 1 : 0) };
}
