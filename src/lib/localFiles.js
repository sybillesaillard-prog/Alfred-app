// Accès direct au dossier "Cabinet ISRAEL" sur le PC de Sybille, depuis le
// navigateur (page Pointage, 18/09, demande de Sybille : "On va faire un seul
// doc qui reprend les manquants et les présents [...] ET un pointage
// vérifiant la présence du fichier sur mon PC").
//
// Contrairement au bouton "Basculer vers mon PC" existant (qui passe par une
// conversation Claude Desktop à chaque fois), Sybille a explicitement choisi
// l'option "Directement dans l'app, en autorisant l'accès une fois" : on
// utilise donc la File System Access API du navigateur
// (window.showDirectoryPicker), disponible sur Chrome/Edge desktop. Le
// FileSystemDirectoryHandle obtenu est structurellement clonable et peut être
// stocké tel quel dans IndexedDB (spec) — c'est ce qu'on fait ici pour ne
// redemander l'accès qu'une seule fois, et pas à chaque visite de la page.
//
// Pas de nouvelle dépendance npm : tout ce fichier repose sur des API
// natives du navigateur, cohérent avec le reste de l'app (pas de backend).

const DB_NAME = "alfred-local-files";
const STORE_NAME = "handles";
const HANDLE_KEY = "cabinetFolder";

export function isFileSystemAccessSupported() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Récupère le dossier autorisé lors d'une visite précédente, s'il existe —
// ne redemande rien à l'utilisateur, échoue silencieusement (retourne null)
// si IndexedDB n'est pas disponible ou vide.
export async function loadCabinetFolderHandle() {
  try {
    return await idbGet(HANDLE_KEY);
  } catch {
    return null;
  }
}

// Ouvre le sélecteur de dossier natif (nécessite un clic utilisateur) et
// mémorise le handle obtenu pour les prochaines visites.
export async function pickCabinetFolder() {
  const handle = await window.showDirectoryPicker({ mode: "read" });
  await idbSet(HANDLE_KEY, handle);
  return handle;
}

// Vérifie (sans interaction) si la permission de lecture est toujours
// accordée pour un handle déjà obtenu — le navigateur peut l'avoir révoquée
// (dossier déplacé/supprimé, permission retirée manuellement).
export async function hasReadPermission(handle) {
  if (!handle) return false;
  try {
    return (await handle.queryPermission({ mode: "read" })) === "granted";
  } catch {
    return false;
  }
}

// Redemande la permission — nécessite un clic utilisateur (bouton "Se
// reconnecter" côté Pointage.jsx), le navigateur refuse sinon silencieusement.
export async function requestReadPermission(handle) {
  if (!handle) return false;
  try {
    return (await handle.requestPermission({ mode: "read" })) === "granted";
  } catch {
    return false;
  }
}

// Liste récursive (profondeur limitée par sécurité — un dossier de
// justificatifs n'est jamais imbriqué à ce point) de tous les noms de
// fichiers présents sous le dossier autorisé, sous-dossiers compris (le
// classement par année/catégorie dans "Cabinet ISRAEL" n'a pas à être connu
// d'Alfred : seul le nom de fichier sert de clé de rapprochement).
export async function listAllFilenames(rootHandle, { maxDepth = 8 } = {}) {
  const names = [];
  async function walk(dirHandle, depth) {
    if (depth > maxDepth) return;
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === "file") {
        names.push(name);
      } else if (entry.kind === "directory") {
        await walk(entry, depth + 1);
      }
    }
  }
  await walk(rootHandle, 0);
  return names;
}

// Normalisation d'un nom de fichier pour une comparaison tolérante : enlève
// l'extension, les accents, la casse et la ponctuation. Sert de repli quand
// le nom sur le disque ne correspond pas au caractère près au `filename`
// généré par buildFilename() (ex : renommé par l'Explorateur Windows lors
// d'un "Enregistrer sous", ou suffixe " (1)" ajouté automatiquement par un
// second téléchargement).
function normalizeFilename(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// true si `filename` (un nom trouvé sur le PC) correspond au fichier attendu
// pour cette dépense (son champ `filename`, généré par buildFilename() à la
// création — voir ExpenseForm.jsx / vat.js).
export function filenameMatchesExpense(filename, expense) {
  if (!filename || !expense?.filename) return false;
  if (filename === expense.filename) return true;
  return normalizeFilename(filename) === normalizeFilename(expense.filename);
}

// Cherche, parmi les noms de fichiers listés sur le PC, celui qui correspond
// à une dépense donnée — exact d'abord, puis tolérant. Retourne le nom
// trouvé ou null.
export function findLocalFileForExpense(expense, filenames) {
  if (!expense?.filename || !filenames?.length) return null;
  const exact = filenames.find((f) => f === expense.filename);
  if (exact) return exact;
  return filenames.find((f) => filenameMatchesExpense(f, expense)) || null;
}
