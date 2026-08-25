// Lecture automatique de tickets/factures — 100 % gratuite et locale
// (Tesseract.js tourne dans le navigateur, rien n'est envoyé à un serveur
// tiers pour la reconnaissance de texte). Les gros fichiers du moteur
// (worker/core/langue) sont auto-hébergés sous /tesseract/ pour ne pas
// dépendre d'un CDN externe.
import { createWorker } from "tesseract.js";
import { round2 } from "./vat";

let workerPromise = null;
function getWorker(onProgress) {
  if (!workerPromise) {
    // Chemins relatifs à la racine du SITE (import.meta.env.BASE_URL, ex.
    // "/Alfred-app/" sur GitHub Pages), PAS à la racine du domaine — un
    // chemin absolu codé en dur ("/tesseract/...") pointait vers la racine
    // du domaine github.io et renvoyait des 404 depuis la migration de
    // Netlify (hébergé à la racine, donc "/tesseract/..." fonctionnait par
    // coïncidence) vers GitHub Pages (servi sous /Alfred-app/) le 21/08/2026
    // — cause du message "Lecture automatique impossible" en production.
    const base = import.meta.env.BASE_URL || "/";
    workerPromise = createWorker("fra", 1, {
      workerPath: `${base}tesseract/worker.min.js`,
      corePath: `${base}tesseract/tesseract-core-simd-lstm.wasm.js`,
      langPath: `${base}tesseract/lang-data`,
      gzip: true,
      logger: onProgress,
    });
  }
  return workerPromise;
}

// Lit le texte brut d'une image de ticket/facture. Ne s'applique qu'aux
// images (une vraie capture photo) — un PDF importé n'est pas passé à l'OCR.
export async function recognizeReceiptText(file, onProgress) {
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(file);
  return data.text || "";
}

// ---------- Extraction heuristique des champs depuis le texte OCR brut ----------
function parseFrenchNumber(s) {
  let cleaned = s.trim().replace(/\s/g, "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }
  return parseFloat(cleaned);
}

const numRe = /(\d{1,3}(?:[ .]\d{3})*[.,]\d{2})/;
function findAmount(lines, patterns) {
  for (const line of lines) {
    if (patterns.some((p) => p.test(line))) {
      const m = line.match(numRe);
      if (m) return parseFrenchNumber(m[1]);
    }
  }
  return null;
}

export function extractReceiptFields(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let ttc = findAmount(lines, [/total\s*ttc/i, /net\s*a\s*payer/i, /net\s*à\s*payer/i]);
  let ht = findAmount(lines, [/total\s*ht\b/i, /montant\s*ht\b/i]);

  const tvaLine = lines.find((l) => /\btva\b/i.test(l));
  let tva = null;
  let rate = null;
  if (tvaLine) {
    const m = tvaLine.match(numRe);
    if (m) tva = parseFrenchNumber(m[1]);
    const pct = tvaLine.match(/(\d{1,2}[.,]?\d?)\s*%/);
    if (pct) rate = round2(parseFrenchNumber(pct[1]));
  }

  // Repli : certains tickets n'affichent qu'un "SOUS-TOTAL" (= HT) sans le
  // libellé "TOTAL HT" — si on a le TTC et la TVA mais pas le HT, on le
  // déduit par soustraction. Et si le taux n'était pas lisible, on le
  // retrouve à partir de tva/ht.
  if (ht == null && ttc != null && tva != null) {
    ht = round2(ttc - tva);
  }
  if (rate == null && ht && tva != null && ht !== 0) {
    rate = round2((tva / ht) * 100);
  }
  if (ttc == null && ht != null && tva != null) {
    ttc = round2(ht + tva);
  }

  const dateLine = lines.find((l) => /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(l));
  let date = null;
  if (dateLine) {
    const m = dateLine.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) {
      let [, d, mo, y] = m;
      if (y.length === 2) y = "20" + y;
      date = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }

  const fournisseur =
    lines.find((l) => l.length >= 3 && !/^\d/.test(l) && !/siret/i.test(l)) || null;

  return { fournisseur, date, ht, tva, ttc, rate };
}
