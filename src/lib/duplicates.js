// Détection des dépenses en double (17/09, demande de Sybille : "il faut faire
// un contrôle des justifs en double... cela va fausser les données TVA").
//
// Règle choisie avec elle (AskUserQuestion) : même montant + même fournisseur
// (nom proche) — comparaison insensible à la casse/aux accents/à la
// ponctuation, avec tolérance sur des variantes de nom ("Me CIAPPA" vs
// "CIAPPA", "Optima Formation" vs "OPTIMA FORMATION SARL"...). Pas de filtre
// sur la date : la collection "expenses" ne contient que des achats ponctuels
// scannés au coup par coup (les charges qui reviennent chaque mois — prêts,
// Allianz, EDF...) vivent dans une collection séparée "fixedCharges" et ne
// passent jamais par ce formulaire, donc regrouper par montant+fournisseur
// sans contrainte de date ne risque pas de confondre un doublon avec un
// abonnement récurrent légitime.
//
// Rien n'est jamais supprimé automatiquement ici : la fonction se contente de
// repérer des groupes de dépenses probablement en double, à valider (et
// supprimer une par une, si besoin) par Sybille elle-même dans la page
// "Doublons".

function normalizeName(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // enlève les accents
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Similarité 0..1 entre deux noms de fournisseur normalisés : 1 si
// identiques, 0.9 si l'un contient l'autre (ex. "optima formation" dans
// "optima formation sarl"), sinon un score de Jaccard sur les mots.
function nameSimilarity(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const wa = new Set(na.split(" ").filter((w) => w.length > 1));
  const wb = new Set(nb.split(" ").filter((w) => w.length > 1));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  const union = wa.size + wb.size - inter;
  return union ? inter / union : 0;
}

const AMOUNT_TOLERANCE = 0.02; // même tolérance que le rapprochement bancaire (bankTx.js)
const NAME_SIMILARITY_THRESHOLD = 0.5;

function sameAmount(a, b) {
  const ta = a.ttc ?? a.amount ?? 0;
  const tb = b.ttc ?? b.amount ?? 0;
  return Math.abs(ta - tb) <= AMOUNT_TOLERANCE;
}

function isProbableDuplicate(a, b) {
  if (a.id === b.id) return false;
  if (!sameAmount(a, b)) return false;
  const sim = nameSimilarity(a.fournisseur, b.fournisseur);
  if (sim >= NAME_SIMILARITY_THRESHOLD) return true;
  // Repli : même montant + même date exacte, même si le nom du fournisseur
  // diffère complètement (ex. l'un des deux a été saisi avec un fournisseur
  // manquant/mal deviné) — un même jour + un même montant au centime près
  // reste un signal fort.
  return !!a.date && a.date === b.date;
}

// Union-Find simple pour regrouper les dépenses connectées entre elles.
function groupConnected(items, isLinked) {
  const parent = new Map(items.map((it) => [it.id, it.id]));
  function find(x) {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  }
  function union(x, y) {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (isLinked(items[i], items[j])) union(items[i].id, items[j].id);
    }
  }

  const groups = new Map();
  for (const it of items) {
    const root = find(it.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(it);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

// items : les dépenses telles que renvoyées par useCollection("expenses").
// Renvoie les groupes de doublons probables, triés par impact TTC décroissant
// (le groupe qui fausserait le plus la TVA en premier), chaque groupe
// lui-même trié par date.
export function findDuplicateExpenses(items) {
  // On ignore les dépenses à 0€ (souvent des brouillons/erreurs de saisie
  // sans rapport avec un vrai doublon) et on ne compare qu'entre montants
  // strictement positifs, pour éviter des faux positifs de masse à 0€.
  const candidates = items.filter((e) => (e.ttc ?? e.amount ?? 0) > 0);

  const groups = groupConnected(candidates, isProbableDuplicate);

  const DAY = 24 * 60 * 60 * 1000;

  return groups
    .map((group) => {
      const sorted = [...group].sort((a, b) => (a.date < b.date ? -1 : 1));
      const amounts = sorted.map((e) => e.ttc ?? e.amount ?? 0);
      const tvas = sorted.map((e) => e.tva ?? 0);
      const maxTtc = Math.max(...amounts);
      const maxTva = Math.max(...tvas);
      // Impact si elle garde une seule occurrence et supprime les autres :
      // ce que la TVA/le TTC totaux perdraient en trop.
      const extraTtc = amounts.reduce((s, v) => s + v, 0) - maxTtc;
      const extraTva = tvas.reduce((s, v) => s + v, 0) - maxTva;

      // Étalement du groupe dans le temps : deux scans du même justificatif
      // sont presque toujours rapprochés dans le temps (le jour même ou dans
      // les semaines qui suivent) — un groupe étalé sur plusieurs mois
      // ressemble davantage à un abonnement payé plusieurs fois (ex.
      // catégorie "Logiciels & abonnements") qu'à un vrai doublon. On ne
      // l'écarte pas pour autant (Sybille reste seule juge), mais on
      // l'indique clairement plutôt que d'affirmer à tort "doublon".
      const first = new Date(sorted[0].date).getTime();
      const last = new Date(sorted[sorted.length - 1].date).getTime();
      const spanDays = Number.isFinite(first) && Number.isFinite(last) ? Math.round((last - first) / DAY) : 0;
      const confidence = spanDays <= 35 ? "élevée" : "à vérifier";

      return { items: sorted, extraTtc, extraTva, spanDays, confidence };
    })
    .sort((a, b) => b.extraTtc - a.extraTtc);
}
