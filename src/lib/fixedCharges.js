import { normalizeLabel } from "./bankTx";

// Catalogue de départ, repris du tableau Excel "Suivi_charges_SYBIL.xlsx"
// (onglet "Suivi mensuel") que Sybille avait construit à la main à partir de
// ses relevés Banque Populaire Méditerranée. Les "mots-clés" ci-dessous sont
// des suppositions raisonnables (ex : n° de référence de prêt, nom de
// l'organisme) — PAS une lecture de ses vrais libellés bancaires, que je
// n'ai pas. Elle doit les vérifier/corriger une fois le premier relevé
// importé, surtout pour les lignes marquées needsReview.
export const SEED_CATEGORIES = [
  "Charges fixes strictes",
  "Téléphonie & abonnements",
  "Loyer (partie variable)",
  "Assurances",
  "Cotisations sociales & retraite",
  "Charges fiscales & péage",
  "Salaires nets versés",
];

export const SEED_CHARGES = [
  {
    category: "Charges fixes strictes",
    label: "Échéance prêt n°1 (réf. 8774864)",
    matchKeyword: "8774864",
    notes: "Mensuel — capital + assurance + intérêts dégressifs",
  },
  {
    category: "Charges fixes strictes",
    label: "Échéance prêt n°2 (réf. 8827757)",
    matchKeyword: "8827757",
    notes: "Mensuel — capital + assurance + intérêts dégressifs",
  },
  {
    category: "Charges fixes strictes",
    label: "Free Telecom (internet pro)",
    matchKeyword: "FREE TELECOM",
    notes: "Mensuel — fixe",
  },
  {
    category: "Charges fixes strictes",
    label: "Cotisation Fréquence Pro 3",
    matchKeyword: "FREQUENCE PRO",
    notes: "Mensuel",
  },
  {
    category: "Charges fixes strictes",
    label: "Loyer SISYPHE IMMOBILIER (bail 0001)",
    matchKeyword: "",
    notes: "Mensuel — bail scindé en 2 à partir de mars 2026 (cf. bail 0005 ci-dessous)",
    needsReview: true,
  },
  {
    category: "Téléphonie & abonnements",
    label: "Free Mobile",
    matchKeyword: "FREE MOBILE",
    notes: "Mensuel",
  },
  {
    category: "Téléphonie & abonnements",
    label: "Google Workspace",
    matchKeyword: "GOOGLE",
    notes: "Mensuel",
  },
  {
    category: "Loyer (partie variable)",
    label: "Loyer SISYPHE IMMOBILIER (bail 0005)",
    matchKeyword: "",
    notes: "Apparu à partir d'avril 2026 suite à la scission du bail 0001",
    needsReview: true,
  },
  {
    category: "Assurances",
    label: "Allianz IARD",
    matchKeyword: "ALLIANZ",
    notes: "Mensuel — montant à peu près stable",
  },
  {
    category: "Cotisations sociales & retraite",
    label: "URSSAF PACA",
    matchKeyword: "URSSAF",
    notes: "Mensuel — peut inclure des régularisations ponctuelles",
  },
  {
    category: "Cotisations sociales & retraite",
    label: "PROBTP ADP-ASS (prévoyance)",
    matchKeyword: "",
    notes: "Mensuel — plusieurs lignes PROBTP distinctes, à différencier par mot-clé",
    needsReview: true,
  },
  {
    category: "Cotisations sociales & retraite",
    label: "PROBTP Formation",
    matchKeyword: "",
    notes: "Mensuel — plusieurs lignes PROBTP distinctes, à différencier par mot-clé",
    needsReview: true,
  },
  {
    category: "Cotisations sociales & retraite",
    label: "PROBTP Retraite",
    matchKeyword: "",
    notes: "Ponctuel — plusieurs lignes PROBTP distinctes, à différencier par mot-clé",
    needsReview: true,
  },
  {
    category: "Cotisations sociales & retraite",
    label: "ALPRO Retraite (AGIRC-ARRCO)",
    matchKeyword: "ALPRO",
    notes: "Mensuel",
  },
  {
    category: "Cotisations sociales & retraite",
    label: "BPCE Vie (prévoyance complémentaire)",
    matchKeyword: "BPCE VIE",
    notes: "Trimestriel",
  },
  {
    category: "Cotisations sociales & retraite",
    label: "CIBTP 15 (caisse congés BTP)",
    matchKeyword: "CIBTP",
    notes: "Mensuel — montant variable selon la masse salariale",
  },
  {
    category: "Charges fiscales & péage",
    label: "DGFIP (impôt PAS-DSN / IS)",
    matchKeyword: "DGFIP",
    notes: "Très irrégulier — peut inclure des acomptes d'IS ponctuels",
  },
  {
    category: "Charges fiscales & péage",
    label: "Autoroutes du Sud de la France",
    matchKeyword: "AUTOROUTES",
    notes: "Mensuel — lié à l'usage réel des véhicules",
  },
  {
    category: "Salaires nets versés",
    label: "Damien ELLENA",
    matchKeyword: "ELLENA",
    notes: "Rythme parfois irrégulier selon les virements",
  },
  {
    category: "Salaires nets versés",
    label: "Mlle SIBILLE SAILLARD",
    matchKeyword: "SAILLARD",
    notes: "Rythme parfois irrégulier selon les virements",
  },
];

// Clé "YYYY-MM" à partir d'une date ISO "YYYY-MM-DD" déjà normalisée par le
// parseur de relevé bancaire (parseBankCsv).
export function monthKeyOf(dateISO) {
  return (dateISO || "").slice(0, 7);
}

export function monthLabelFr(monthKey) {
  const d = new Date(`${monthKey}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return monthKey;
  const label = d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Pour une charge fixe donnée (avec son mot-clé de correspondance) et une
// liste d'opérations bancaires dédupliquées, construit la carte
// { "2026-01": montantDébité, ... } en sommant toutes les opérations
// débitées du mois dont le libellé contient le mot-clé (comparaison
// insensible à la casse et aux accents).
export function matchChargeByMonth(charge, transactions) {
  const byMonth = {};
  const keyword = normalizeLabel(charge.matchKeyword);
  if (!keyword) return byMonth;
  for (const t of transactions) {
    if (t.amount >= 0) continue; // on ne suit que les débits
    if (!normalizeLabel(t.label).includes(keyword)) continue;
    const m = monthKeyOf(t.date);
    byMonth[m] = (byMonth[m] || 0) + Math.abs(t.amount);
  }
  return byMonth;
}

export function average(values) {
  const nums = values.filter((v) => typeof v === "number");
  if (nums.length === 0) return 0;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}
