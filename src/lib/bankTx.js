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
export function matchTransactions(transactions, expenses) {
  const exp = expenses.map((e) => ({ ...e, matched: false, ttcResolved: e.ttc ?? e.amount ?? 0 }));
  const txs = transactions.map((t) => ({ ...t, matched: false }));

  txs.forEach((t) => {
    if (t.amount >= 0) return;
    const amt = Math.abs(t.amount);
    const candidate = exp.find((e) => !e.matched && Math.abs(e.ttcResolved - amt) < 0.02);
    if (candidate) {
      candidate.matched = true;
      t.matched = true;
    }
  });

  return { transactions: txs, expenses: exp };
}
