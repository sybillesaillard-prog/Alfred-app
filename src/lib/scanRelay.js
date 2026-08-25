// Pont vers le relais scanner local (script PowerShell "AlfredScanRelay.ps1"
// lancé automatiquement à l'ouverture de session sur le PC de Sybille).
// Alfred est servi en HTTPS (GitHub Pages) mais l'imprimante réseau (HP
// OfficeJet Pro 7740) ne parle qu'en HTTP simple via eSCL/AirScan — un
// navigateur bloque ce mélange direct ("contenu mixte"). Le relais tourne
// donc sur le PC et fait le pont, joignable en HTTP depuis la page HTTPS.
//
// Important : on appelle "localhost", pas "127.0.0.1" — c'est le seul nom
// que Windows autorise un serveur local à écouter sans droits administrateur
// (cf. src/lib/scanRelay/AlfredScanRelay.ps1 pour le détail), donc le relais
// n'écoute QUE sur ce nom-là. Les deux bouts doivent rester cohérents.
//
// Ce module ne fait rien si le relais n'est pas lancé — remplace juste le
// bouton "Photographier" (pensé pour le téléphone) par un bouton "Scanner"
// sur les appareils qui ne sont probablement pas un téléphone.

const RELAY_BASE = "http://localhost:47821";
const SAVED_SCANNER_KEY = "alfred:scanner:target";

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

// Vrai si l'appareil courant n'est probablement PAS un téléphone (donc un
// candidat pour le bouton "Scanner" plutôt que "Photographier"). Heuristique
// volontairement simple : Alfred n'a pas besoin d'être exact à 100%, juste
// de choisir un bouton pertinent par défaut.
export function isLikelyDesktop() {
  if (typeof navigator === "undefined") return false;
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

// Vérifie si le relais tourne sur ce PC (réponse rapide attendue — sinon on
// considère qu'il n'est pas lancé, sans bloquer l'UI).
export async function isRelayRunning() {
  const { signal, cancel } = withTimeout(null, 1200);
  try {
    const res = await fetch(`${RELAY_BASE}/health`, { signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    cancel();
  }
}

export async function discoverScanners() {
  const res = await fetch(`${RELAY_BASE}/discover`);
  if (!res.ok) throw new Error("La découverte a échoué.");
  const data = await res.json();
  return data.scanners || [];
}

export function getSavedScanner() {
  try {
    const raw = localStorage.getItem(SAVED_SCANNER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveScanner(target) {
  try {
    localStorage.setItem(SAVED_SCANNER_KEY, JSON.stringify(target));
  } catch {
    // pas grave si ça échoue (mode privé…) — juste pas de mémorisation
  }
}

// Lance un scan (vitre, une page, couleur, format JPEG — comme une photo)
// et renvoie un File exploitable directement par le reste du formulaire
// (même chemin que le fichier issu de "Photographier"/"Importer").
export async function scanDocument(target) {
  const res = await fetch(`${RELAY_BASE}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host: target.host,
      port: target.port,
      https: !!target.https,
      root: target.root,
      resolution: 300,
    }),
  });
  if (!res.ok) {
    let message = "Le scan a échoué.";
    try {
      const errBody = await res.json();
      if (errBody.error) message = errBody.error;
    } catch {
      // corps non-JSON, on garde le message par défaut
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const filename = `scan-${Date.now()}.jpg`;
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}
