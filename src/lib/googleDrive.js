// Sauvegarde des justificatifs dans le Google Drive personnel de
// l'utilisatrice — gratuit, aucune carte bancaire requise, aucun stockage
// tiers (Firebase Storage nécessite le plan payant Blaze, donc écarté).
// Portée volontairement restreinte à "drive.file" : l'app ne peut voir/
// modifier QUE les fichiers qu'elle a elle-même créés, jamais le reste du
// Drive de l'utilisatrice.
const CLIENT_ID = "956769503242-9ao945kbfa7pvsacue4srrs5duml1159.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "Alfred - Justificatifs";
const TOKEN_STORAGE_KEY = "alfred_drive_token";

// Sur mobile, ouvrir l'appareil photo système (via <input capture>) peut
// faire recharger le contexte JS de la page pour libérer de la mémoire —
// ce qui effaçait tout état en mémoire (dont accessToken) et forçait à se
// reconnecter à Drive à chaque photo. On persiste donc le token (avec son
// expiration) dans sessionStorage : il survit à ce rechargement tout en
// restant propre à l'onglet et en disparaissant à la fermeture, comme un
// vrai token de session.
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
    // On retire une marge de 2 minutes pour ne jamais utiliser un token
    // tout juste expiré à cause d'un léger décalage d'horloge.
    const expiresAt = Date.now() + Math.max(0, (expiresInSeconds || 3600) - 120) * 1000;
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ token, expiresAt }));
  } catch {
    // sessionStorage indisponible (navigation privée stricte, etc.) : tant
    // pis, on retombe simplement sur une reconnexion par photo.
  }
}

let accessToken = loadStoredToken();
let tokenClient = null;
let folderIdCache = null;

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

// Beaucoup de navigateurs (surtout mobile, et particulièrement dans une PWA
// installée) n'autorisent la fenêtre de consentement Google (une popup) que
// si elle est ouverte de façon strictement synchrone dans le clic de
// l'utilisatrice — le moindre `await` avant `requestAccessToken()` peut
// suffire à la faire bloquer silencieusement. On initialise donc le client
// OAuth en arrière-plan dès que ce module est chargé (bien avant le clic),
// pour que `connectDrive()` puisse l'appeler sans aucun `await` intermédiaire.
let tokenClientReady = waitForGis()
  .then(() => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: () => {}, // remplacé à chaque appel dans connectDrive()
    });
  })
  .catch(() => {}); // on retentera au moment du clic si besoin

export function isDriveConnected() {
  return !!accessToken;
}

// Ouvre la fenêtre de consentement Google. À appeler directement depuis un
// gestionnaire de clic — ne rien faire d'asynchrone avant cet appel côté
// composant, sous peine de blocage du popup par le navigateur.
export function connectDrive() {
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
      tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
    });
  }
  // Repli si le client n'a pas encore fini de s'initialiser (rare : clic
  // très rapide après ouverture de la page) — le popup peut être bloqué
  // dans ce cas précis, mais c'est un filet de sécurité plutôt que le
  // chemin normal.
  return tokenClientReady.then(() => connectDrive());
}

async function getFolderId() {
  if (folderIdCache) return folderIdCache;
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (data.files?.length > 0) {
    folderIdCache = data.files[0].id;
    return folderIdCache;
  }
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const created = await createRes.json();
  folderIdCache = created.id;
  return folderIdCache;
}

// Envoie le fichier (blob PDF/image) vers le dossier "Alfred - Justificatifs"
// du Drive de l'utilisatrice, sous le nom déjà calculé par buildFilename().
export async function uploadReceiptToDrive(blob, filename) {
  if (!accessToken) throw new Error("Google Drive n'est pas connecté.");
  const folderId = await getFolderId();

  const metadata = { name: filename, parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", blob);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );
  const uploaded = await res.json();
  if (!uploaded.id) {
    throw new Error(uploaded.error?.message || "Échec de l'envoi vers Drive.");
  }
  return uploaded; // { id, name, webViewLink }
}
