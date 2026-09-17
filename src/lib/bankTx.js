// Utilitaires partagés autour des opérations bancaires importées (relevés
// CSV), utilisés à la fois par le rapprochement des justificatifs
// (BankReconciliation) et par le suivi des charges fixes (FixedCharges) —
// pour que les deux fonctionnalités s'appuient sur exactement la même
// notion d'identité et de normalisation d'une opération.

// Identifiant stable d'une opération bancaire, indépendant de sa position
// dans le relevé (qui change à chaque réimport) et du relevé qui l'a
// introduite (une même opération peut apparaître dans deux exports qui se
// chevauchent).
export function txSignature(t) {
  return `${t.date}|${t.label}|${t.amount}`;
}

// Normalisation simple pour des comparaisons de libellés insensibles à la
// casse et aux accents (ex : "Sisyphe" vs "SISYPHE IMMOBILIER").
export function normalizeLabel(s) {
  return (s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Regroupe les opérations de plusieurs relevés importés (potentiellement
// avec des périodes qui se chevauchent) en une seule liste, sans doublons,
// en se basant sur la signature de chaque opération.
export function dedupeTransactions(statements) {
  const seen = new Set();
  const out = [];
  for (const statement of statements) {
    for (const t of statement.transactions || []) {
      const sig = txSignature(t);
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(t);
    }
  }
  return out;
}

// Rapproche une liste d'opérations bancaires débitées avec une liste de
// dépenses enregistrées, par montant (tolérance 0,02€, sans comparaison de
// date — cf. notes du projet). Logique partagée entre le rapprochement
// détaillé (BankReconciliation, toutes périodes confondues) et les récaps
// mensuels (MonthlyReconciliationSummary, exports PDF) pour qu'ils
// s'accordent toujours sur ce qui est "rapproché" ou non. Ne mute pas les
// tableaux reçus en argument.
//
// Ventilation d'un débit sur 2 factures (18/09, demande de Sybille) : deux
// dépenses créées ensemble depuis "Ventiler ce débit sur 2 factures"
// (ExpenseForm.jsx) partagent le même `splitGroupId` — elles représentent à
// elles deux UN SEUL débit bancaire, chacune ne correspondant à aucun débit
// à elle seule. Elles ne sont donc jamais candidates au rapprochement simple
// (une dépense = une opération) ; elles ne sont reconnues que groupées,
// quand la somme du groupe correspond au montant réellement débité.
export function matchTransactions(transactions, expenses) {
  const exp = expenses.map((e) => ({ ...e, matched: false, ttcResolved: e.ttc ?? e.amount ?? 0 }));
  const txs = transactions.map((t) => ({ ...t, matched: false }));

  const splitGroups = new Map();
  for (const e of exp) {
    if (!e.splitGroupId) continue;
    if (!splitGroups.has(e.splitGroupId)) splitGroups.set(e.splitGroupId, []);
    splitGroups.get(e.splitGroupId).push(e);
  }

  txs.forEach((t) => {
    if (t.amount >= 0) return;
    const amt = Math.abs(t.amount);

    const single = exp.find(
      (e) => !e.matched && !e.splitGroupId && Math.abs(e.ttcResolved - amt) < 0.02
    );
    if (single) {
      single.matched = true;
      t.matched = true;
      return;
    }

    for (const group of splitGroups.values()) {
      if (group.some((e) => e.matched)) continue;
      const sum = group.reduce((s, e) => s + e.ttcResolved, 0);
      if (Math.abs(sum - amt) < 0.02) {
        group.forEach((e) => (e.matched = true));
        t.matched = true;
        break;
      }
    }
  });

  return { transactions: txs, expenses: exp };
}
