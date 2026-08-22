// Taux de TVA standards + gestion d'un taux personnalisé (achats à l'étranger,
// fournisseurs à 0 %, cas particuliers).

export const VAT_RATES = [
  { value: 0.2, label: "20 %" },
  { value: 0.1, label: "10 %" },
  { value: 0.055, label: "5,5 %" },
  { value: 0.021, label: "2,1 %" },
  { value: 0, label: "0 % (pas de TVA)" },
];

const STANDARD_VALUES = VAT_RATES.map((r) => r.value);

export function isStandardRate(rate) {
  return STANDARD_VALUES.includes(rate);
}

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeFromHT(ht, rate) {
  const tva = round2(ht * rate);
  return { tva, ttc: round2(ht + tva) };
}

export function computeFromTVA(ht, tva) {
  return { ttc: round2(ht + tva) };
}

export function computeFromTTC(ttc, rate) {
  const ht = round2(ttc / (1 + rate));
  const tva = round2(ttc - ht);
  return { ht, tva };
}

export function sanitizeFilenamePart(str) {
  return (str || "Document")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Produit "Fournisseur - Montant€.pdf", en évitant les doublons face aux noms
// déjà utilisés (ajoute " (2)", " (3)"...).
export function buildFilename(fournisseur, ttc, existingFilenames = []) {
  const base = `${sanitizeFilenamePart(fournisseur) || "Document"} - ${(ttc || 0).toFixed(2)}€.pdf`;
  if (!existingFilenames.includes(base)) return base;
  let i = 2;
  let candidate;
  do {
    candidate = base.replace(/\.pdf$/, ` (${i}).pdf`);
    i++;
  } while (existingFilenames.includes(candidate));
  return candidate;
}

export function quarterKey(dateStr) {
  const [y, m] = (dateStr || "").split("-").map(Number);
  if (!y || !m) return null;
  const q = Math.ceil(m / 3);
  return `${y}-T${q}`;
}

const QUARTER_MONTHS_LABEL = { 1: "janv.-mars", 2: "avr.-juin", 3: "juil.-sept.", 4: "oct.-déc." };

export function quarterLabel(key) {
  const [y, q] = key.split("-T");
  return `T${q} ${y} (${QUARTER_MONTHS_LABEL[q]})`;
}
