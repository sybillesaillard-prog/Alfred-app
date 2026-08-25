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

// Lit le texte brut d'une image de ticket/facture (OCR — reconnaissance,
// donc potentiellement imprécise). Ne s'applique qu'aux images (une vraie
// capture photo).
export async function recognizeReceiptText(file, onProgress) {
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(file);
  return data.text || "";
}

// pdfjs-dist (~1,2 Mo avec son worker) n'est chargé qu'à la demande — import
// dynamique plutôt qu'en tête de fichier — pour ne pas alourdir le
// chargement initial de l'appli avec un module utile seulement à l'import
// d'un PDF. Le worker est résolu via l'import "?url" de Vite, qui renvoie
// son URL finale déjà correcte vis-à-vis du base path déployé (ex.
// "/Alfred-app/") — exactement pour éviter de reproduire le bug de chemin
// absolu codé en dur qui cassait l'OCR Tesseract sous GitHub Pages (cf.
// commentaire sur getWorker ci-dessus).
let pdfjsLibPromise = null;
function getPdfjsLib() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjsLib, workerUrlModule]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlModule.default;
      return pdfjsLib;
    });
  }
  return pdfjsLibPromise;
}

// Extrait le texte "en dur" d'un PDF généré numériquement (facture
// email/PDF classique) via pdfjs-dist — PAS de l'OCR : on lit directement le
// calque de texte du PDF, donc un résultat exact (aucune erreur de
// reconnaissance possible), bien plus fiable que l'OCR sur une photo. Si le
// PDF est en réalité une image scannée sans calque de texte (facture reçue
// scannée), le texte extrait sera vide ou quasi vide — c'est détecté par
// l'appelant, qui affiche alors un message adapté plutôt que d'essayer une
// extraction impossible.
//
// ⚠️ pdf.js renvoie les fragments de texte SANS structure de ligne — il faut
// reconstituer les lignes nous-mêmes à partir de la position verticale de
// chaque fragment (item.transform[5]), sinon toute la page se retrouve
// collée en une seule ligne géante. C'était le bug initial de cette
// fonction (corrigé le 25/08/2026, remonté par Sybille : détection des
// montants ET du fournisseur totalement fausse) — extractReceiptFields()
// cherche un libellé PUIS un nombre sur la MÊME ligne, donc sans lignes
// correctement séparées elle retombe sur le premier nombre de toute la page
// au lieu de celui juste après "Total TTC", et le "fournisseur" deviné
// devenait le texte entier de la page mis bout à bout.
export async function extractPdfText(file) {
  const pdfjsLib = await getPdfjsLib();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Regroupe les fragments à peu près à la même hauteur (± 2px, tolère
    // les petites variations de ligne de base/exposants) dans une même
    // ligne, puis trie chaque ligne de gauche à droite et les lignes de
    // haut en bas — reconstitue la mise en page réelle du PDF.
    const rows = [];
    for (const item of content.items) {
      if (!item.str) continue;
      const y = item.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) < 2);
      if (!row) {
        row = { y, parts: [] };
        rows.push(row);
      }
      row.parts.push({ x: item.transform[4], str: item.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.parts.sort((a, b) => a.x - b.x);
      text += row.parts.map((p) => p.str).join(" ") + "\n";
    }
  }
  return text;
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

  // Priorité stricte aux libellés exacts "Total TTC" / "Total HT" /
  // "Total TVA" — les plus fiables et les plus courants sur une facture,
  // que ce soit lue par OCR (photo) ou extraite directement du texte d'un
  // PDF — avec un repli sur des libellés voisins seulement si le libellé
  // exact est absent du document (précision demandée par Sybille le 25/08 :
  // sur un PDF en particulier, la recherche trop large de "tva" tombait
  // parfois sur une autre mention du mot présente ailleurs sur le document
  // — ex. un numéro de TVA intracommunautaire — au lieu du vrai montant de
  // taxe). Chaque champ est cherché en deux passes séparées (jamais mélangé
  // avec les motifs de repli dans la même passe), pour que "Total TTC" soit
  // toujours retenu avant "Net à payer" même si ce dernier apparaît plus
  // tôt dans le texte.
  let ttc =
    findAmount(lines, [/total\s*ttc/i]) ??
    findAmount(lines, [/net\s*a\s*payer/i, /net\s*à\s*payer/i]);
  let ht = findAmount(lines, [/total\s*ht\b/i]) ?? findAmount(lines, [/montant\s*ht\b/i]);
  let tva =
    findAmount(lines, [/total\s*tva/i]) ?? findAmount(lines, [/montant\s*tva/i, /dont\s*tva/i]);

  let rate = null;
  const tvaLineForRate =
    lines.find((l) => /total\s*tva/i.test(l)) || lines.find((l) => /\btva\b/i.test(l));
  if (tvaLineForRate) {
    const pct = tvaLineForRate.match(/(\d{1,2}[.,]?\d?)\s*%/);
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
