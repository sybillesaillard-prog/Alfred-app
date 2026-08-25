// Suivi des prêts bancaires en cours (Banque Populaire Méditerranée), à
// partir de leurs tableaux d'amortissement officiels PDF fournis par
// Sybille le 25/08/2026. Comme pour src/lib/allianzPolicies.js, le taux et
// l'échéancier d'un prêt sont fixes et connus à l'avance en intégralité —
// donc encodés en dur ici plutôt que recalculés, une seule fois pour toute
// la durée du prêt.
//
// `schedule` liste CHAQUE échéance : sa date, son montant, et le capital
// restant dû JUSTE APRÈS cette échéance. `getLoanStatus(loan, todayISO)`
// déduit de cette liste, pour une date donnée (aujourd'hui par défaut) :
// - le capital restant dû ACTUEL = le restant dû de la dernière échéance
//   déjà passée (strictement avant aujourd'hui), ou le montant initial du
//   prêt si aucune échéance n'est encore passée ;
// - la prochaine échéance à venir (date + montant), ou `null` si le prêt
//   est déjà entièrement remboursé (toutes les échéances passées).
//
// ⚠️ Si Sybille renégocie un prêt, en solde un par anticipation, ou en
// souscrit un nouveau, ce fichier doit être mis à jour à la main (nouveau
// tableau d'amortissement fourni par la banque) — rien ici n'est recalculé
// automatiquement à partir d'un taux, exactement comme pour les polices
// Allianz.
export const LOANS = [
  {
    key: "bp_08774864",
    label: "Prêt Garanti par l'État (PGE)",
    contractNumber: "08774864",
    bank: "Banque Populaire Méditerranée",
    montantInitial: 18400.0,
    // Réalisé le 03/11/2020, amortissement sur 60 mois à partir du
    // 03/12/2021 (après 12 mois de période initiale/carence), taux 0,73 %.
    schedule: [
      { date: "2021-09-03", echeance: 0, capitalRestantDu: 18400.0 },
      { date: "2021-10-03", echeance: 0, capitalRestantDu: 18400.0 },
      { date: "2021-11-03", echeance: 0, capitalRestantDu: 18400.0 },
      { date: "2021-12-03", echeance: 318.52, capitalRestantDu: 18098.8 },
      { date: "2022-01-03", echeance: 318.52, capitalRestantDu: 17797.42 },
      { date: "2022-02-03", echeance: 318.52, capitalRestantDu: 17495.85 },
      { date: "2022-03-03", echeance: 318.52, capitalRestantDu: 17194.1 },
      { date: "2022-04-03", echeance: 318.52, capitalRestantDu: 16892.17 },
      { date: "2022-05-03", echeance: 318.52, capitalRestantDu: 16590.05 },
      { date: "2022-06-03", echeance: 318.52, capitalRestantDu: 16287.76 },
      { date: "2022-07-03", echeance: 318.52, capitalRestantDu: 15985.28 },
      { date: "2022-08-03", echeance: 318.52, capitalRestantDu: 15682.62 },
      { date: "2022-09-03", echeance: 318.52, capitalRestantDu: 15379.77 },
      { date: "2022-10-03", echeance: 318.52, capitalRestantDu: 15076.74 },
      { date: "2022-11-03", echeance: 318.52, capitalRestantDu: 14773.52 },
      { date: "2022-12-03", echeance: 318.52, capitalRestantDu: 14470.12 },
      { date: "2023-01-03", echeance: 318.52, capitalRestantDu: 14166.53 },
      { date: "2023-02-03", echeance: 318.52, capitalRestantDu: 13862.76 },
      { date: "2023-03-03", echeance: 318.52, capitalRestantDu: 13558.8 },
      { date: "2023-04-03", echeance: 318.52, capitalRestantDu: 13254.66 },
      { date: "2023-05-03", echeance: 318.52, capitalRestantDu: 12950.33 },
      { date: "2023-06-03", echeance: 318.52, capitalRestantDu: 12645.82 },
      { date: "2023-07-03", echeance: 318.52, capitalRestantDu: 12341.12 },
      { date: "2023-08-03", echeance: 318.52, capitalRestantDu: 12036.24 },
      { date: "2023-09-03", echeance: 318.52, capitalRestantDu: 11731.17 },
      { date: "2023-10-03", echeance: 318.52, capitalRestantDu: 11425.91 },
      { date: "2023-11-03", echeance: 318.52, capitalRestantDu: 11120.47 },
      { date: "2023-12-03", echeance: 318.52, capitalRestantDu: 10814.84 },
      { date: "2024-01-03", echeance: 318.52, capitalRestantDu: 10509.03 },
      { date: "2024-02-03", echeance: 318.52, capitalRestantDu: 10203.03 },
      { date: "2024-03-03", echeance: 318.52, capitalRestantDu: 9896.85 },
      { date: "2024-04-03", echeance: 318.52, capitalRestantDu: 9590.49 },
      { date: "2024-05-03", echeance: 318.52, capitalRestantDu: 9283.94 },
      { date: "2024-06-03", echeance: 318.52, capitalRestantDu: 8977.2 },
      { date: "2024-07-03", echeance: 318.52, capitalRestantDu: 8670.27 },
      { date: "2024-08-03", echeance: 318.52, capitalRestantDu: 8363.16 },
      { date: "2024-09-03", echeance: 318.52, capitalRestantDu: 8055.86 },
      { date: "2024-10-03", echeance: 318.52, capitalRestantDu: 7748.37 },
      { date: "2024-11-03", echeance: 318.52, capitalRestantDu: 7440.7 },
      { date: "2024-12-03", echeance: 318.52, capitalRestantDu: 7132.84 },
      { date: "2025-01-03", echeance: 318.52, capitalRestantDu: 6824.79 },
      { date: "2025-02-03", echeance: 318.52, capitalRestantDu: 6516.55 },
      { date: "2025-03-03", echeance: 318.52, capitalRestantDu: 6208.12 },
      { date: "2025-04-03", echeance: 318.52, capitalRestantDu: 5899.51 },
      { date: "2025-05-03", echeance: 318.52, capitalRestantDu: 5590.71 },
      { date: "2025-06-03", echeance: 318.52, capitalRestantDu: 5281.72 },
      { date: "2025-07-03", echeance: 318.52, capitalRestantDu: 4972.54 },
      { date: "2025-08-03", echeance: 318.52, capitalRestantDu: 4663.17 },
      { date: "2025-09-03", echeance: 318.52, capitalRestantDu: 4353.61 },
      { date: "2025-10-03", echeance: 318.52, capitalRestantDu: 4043.87 },
      { date: "2025-11-03", echeance: 318.52, capitalRestantDu: 3733.94 },
      { date: "2025-12-03", echeance: 318.52, capitalRestantDu: 3423.82 },
      { date: "2026-01-03", echeance: 318.52, capitalRestantDu: 3113.52 },
      { date: "2026-02-03", echeance: 318.52, capitalRestantDu: 2803.03 },
      { date: "2026-03-03", echeance: 318.52, capitalRestantDu: 2492.35 },
      { date: "2026-04-03", echeance: 318.52, capitalRestantDu: 2181.48 },
      { date: "2026-05-03", echeance: 318.52, capitalRestantDu: 1870.42 },
      { date: "2026-06-03", echeance: 318.52, capitalRestantDu: 1559.17 },
      { date: "2026-07-03", echeance: 318.52, capitalRestantDu: 1247.73 },
      { date: "2026-08-03", echeance: 318.52, capitalRestantDu: 936.09 },
      { date: "2026-09-03", echeance: 318.52, capitalRestantDu: 624.27 },
      { date: "2026-10-03", echeance: 318.52, capitalRestantDu: 312.25 },
      { date: "2026-11-03", echeance: 318.52, capitalRestantDu: 0.0 },
    ],
  },
  {
    key: "bp_08867869",
    label: "Crédit Digital Pro 40 000 €",
    contractNumber: "08867869",
    bank: "Banque Populaire Méditerranée",
    montantInitial: 40000.0,
    // Réalisé le 07/08/2026, 60 mensualités, taux 3,80 %.
    schedule: [
      { date: "2026-10-05", echeance: 855.5, capitalRestantDu: 39393.61 },
      { date: "2026-11-05", echeance: 733.06, capitalRestantDu: 38785.3 },
      { date: "2026-12-05", echeance: 733.06, capitalRestantDu: 38175.06 },
      { date: "2027-01-05", echeance: 733.06, capitalRestantDu: 37562.89 },
      { date: "2027-02-05", echeance: 733.06, capitalRestantDu: 36948.78 },
      { date: "2027-03-05", echeance: 733.06, capitalRestantDu: 36332.72 },
      { date: "2027-04-05", echeance: 733.06, capitalRestantDu: 35714.71 },
      { date: "2027-05-05", echeance: 733.06, capitalRestantDu: 35094.75 },
      { date: "2027-06-05", echeance: 733.06, capitalRestantDu: 34472.82 },
      { date: "2027-07-05", echeance: 733.06, capitalRestantDu: 33848.92 },
      { date: "2027-08-05", echeance: 733.06, capitalRestantDu: 33223.05 },
      { date: "2027-09-05", echeance: 733.06, capitalRestantDu: 32595.2 },
      { date: "2027-10-05", echeance: 733.06, capitalRestantDu: 31965.36 },
      { date: "2027-11-05", echeance: 733.06, capitalRestantDu: 31333.52 },
      { date: "2027-12-05", echeance: 733.06, capitalRestantDu: 30699.68 },
      { date: "2028-01-05", echeance: 733.06, capitalRestantDu: 30063.84 },
      { date: "2028-02-05", echeance: 733.06, capitalRestantDu: 29425.98 },
      { date: "2028-03-05", echeance: 733.06, capitalRestantDu: 28786.1 },
      { date: "2028-04-05", echeance: 733.06, capitalRestantDu: 28144.2 },
      { date: "2028-05-05", echeance: 733.06, capitalRestantDu: 27500.26 },
      { date: "2028-06-05", echeance: 733.06, capitalRestantDu: 26854.28 },
      { date: "2028-07-05", echeance: 733.06, capitalRestantDu: 26206.26 },
      { date: "2028-08-05", echeance: 733.06, capitalRestantDu: 25556.19 },
      { date: "2028-09-05", echeance: 733.06, capitalRestantDu: 24904.06 },
      { date: "2028-10-05", echeance: 733.06, capitalRestantDu: 24249.86 },
      { date: "2028-11-05", echeance: 733.06, capitalRestantDu: 23593.59 },
      { date: "2028-12-05", echeance: 733.06, capitalRestantDu: 22935.24 },
      { date: "2029-01-05", echeance: 733.06, capitalRestantDu: 22274.81 },
      { date: "2029-02-05", echeance: 733.06, capitalRestantDu: 21612.29 },
      { date: "2029-03-05", echeance: 733.06, capitalRestantDu: 20947.67 },
      { date: "2029-04-05", echeance: 733.06, capitalRestantDu: 20280.94 },
      { date: "2029-05-05", echeance: 733.06, capitalRestantDu: 19612.1 },
      { date: "2029-06-05", echeance: 733.06, capitalRestantDu: 18941.14 },
      { date: "2029-07-05", echeance: 733.06, capitalRestantDu: 18268.06 },
      { date: "2029-08-05", echeance: 733.06, capitalRestantDu: 17592.85 },
      { date: "2029-09-05", echeance: 733.06, capitalRestantDu: 16915.5 },
      { date: "2029-10-05", echeance: 733.06, capitalRestantDu: 16236.01 },
      { date: "2029-11-05", echeance: 733.06, capitalRestantDu: 15554.36 },
      { date: "2029-12-05", echeance: 733.06, capitalRestantDu: 14870.56 },
      { date: "2030-01-05", echeance: 733.06, capitalRestantDu: 14184.59 },
      { date: "2030-02-05", echeance: 733.06, capitalRestantDu: 13496.45 },
      { date: "2030-03-05", echeance: 733.06, capitalRestantDu: 12806.13 },
      { date: "2030-04-05", echeance: 733.06, capitalRestantDu: 12113.62 },
      { date: "2030-05-05", echeance: 733.06, capitalRestantDu: 11418.92 },
      { date: "2030-06-05", echeance: 733.06, capitalRestantDu: 10722.02 },
      { date: "2030-07-05", echeance: 733.06, capitalRestantDu: 10022.91 },
      { date: "2030-08-05", echeance: 733.06, capitalRestantDu: 9321.59 },
      { date: "2030-09-05", echeance: 733.06, capitalRestantDu: 8618.05 },
      { date: "2030-10-05", echeance: 733.06, capitalRestantDu: 7912.28 },
      { date: "2030-11-05", echeance: 733.06, capitalRestantDu: 7204.28 },
      { date: "2030-12-05", echeance: 733.06, capitalRestantDu: 6494.03 },
      { date: "2031-01-05", echeance: 733.06, capitalRestantDu: 5781.53 },
      { date: "2031-02-05", echeance: 733.06, capitalRestantDu: 5066.78 },
      { date: "2031-03-05", echeance: 733.06, capitalRestantDu: 4349.76 },
      { date: "2031-04-05", echeance: 733.06, capitalRestantDu: 3630.47 },
      { date: "2031-05-05", echeance: 733.06, capitalRestantDu: 2908.91 },
      { date: "2031-06-05", echeance: 733.06, capitalRestantDu: 2185.06 },
      { date: "2031-07-05", echeance: 733.06, capitalRestantDu: 1458.92 },
      { date: "2031-08-05", echeance: 733.06, capitalRestantDu: 730.48 },
      { date: "2031-09-05", echeance: 733.06, capitalRestantDu: 0.0 },
    ],
  },
  {
    key: "bp_08827757",
    label: "Crédit Digital Pro 20 000 €",
    contractNumber: "08827757",
    bank: "Banque Populaire Méditerranée",
    montantInitial: 20000.0,
    // Réalisé le 23/11/2023, 54 mensualités, taux 3,00 %.
    schedule: [
      { date: "2024-01-05", echeance: 418.06, capitalRestantDu: 19653.61 },
      { date: "2024-02-05", echeance: 396.39, capitalRestantDu: 19306.35 },
      { date: "2024-03-05", echeance: 396.39, capitalRestantDu: 18958.23 },
      { date: "2024-04-05", echeance: 396.39, capitalRestantDu: 18609.24 },
      { date: "2024-05-05", echeance: 396.39, capitalRestantDu: 18259.37 },
      { date: "2024-06-05", echeance: 396.39, capitalRestantDu: 17908.63 },
      { date: "2024-07-05", echeance: 396.39, capitalRestantDu: 17557.01 },
      { date: "2024-08-05", echeance: 396.39, capitalRestantDu: 17204.51 },
      { date: "2024-09-05", echeance: 396.39, capitalRestantDu: 16851.13 },
      { date: "2024-10-05", echeance: 396.39, capitalRestantDu: 16496.87 },
      { date: "2024-11-05", echeance: 396.39, capitalRestantDu: 16141.72 },
      { date: "2024-12-05", echeance: 396.39, capitalRestantDu: 15785.68 },
      { date: "2025-01-05", echeance: 396.39, capitalRestantDu: 15428.75 },
      { date: "2025-02-05", echeance: 396.39, capitalRestantDu: 15070.93 },
      { date: "2025-03-05", echeance: 396.39, capitalRestantDu: 14712.22 },
      { date: "2025-04-05", echeance: 396.39, capitalRestantDu: 14352.61 },
      { date: "2025-05-05", echeance: 396.39, capitalRestantDu: 13992.1 },
      { date: "2025-06-05", echeance: 396.39, capitalRestantDu: 13630.69 },
      { date: "2025-07-05", echeance: 396.39, capitalRestantDu: 13268.38 },
      { date: "2025-08-05", echeance: 396.39, capitalRestantDu: 12905.16 },
      { date: "2025-09-05", echeance: 396.39, capitalRestantDu: 12541.03 },
      { date: "2025-10-05", echeance: 396.39, capitalRestantDu: 12175.99 },
      { date: "2025-11-05", echeance: 396.39, capitalRestantDu: 11810.04 },
      { date: "2025-12-05", echeance: 396.39, capitalRestantDu: 11443.18 },
      { date: "2026-01-05", echeance: 396.39, capitalRestantDu: 11075.4 },
      { date: "2026-02-05", echeance: 396.39, capitalRestantDu: 10706.7 },
      { date: "2026-03-05", echeance: 396.39, capitalRestantDu: 10337.08 },
      { date: "2026-04-05", echeance: 396.39, capitalRestantDu: 9966.53 },
      { date: "2026-05-05", echeance: 396.39, capitalRestantDu: 9595.06 },
      { date: "2026-06-05", echeance: 396.39, capitalRestantDu: 9222.66 },
      { date: "2026-07-05", echeance: 396.39, capitalRestantDu: 8849.33 },
      { date: "2026-08-05", echeance: 396.39, capitalRestantDu: 8475.06 },
      { date: "2026-09-05", echeance: 396.39, capitalRestantDu: 8099.86 },
      { date: "2026-10-05", echeance: 396.39, capitalRestantDu: 7723.72 },
      { date: "2026-11-05", echeance: 396.39, capitalRestantDu: 7346.64 },
      { date: "2026-12-05", echeance: 396.39, capitalRestantDu: 6968.62 },
      { date: "2027-01-05", echeance: 396.39, capitalRestantDu: 6589.65 },
      { date: "2027-02-05", echeance: 396.39, capitalRestantDu: 6209.73 },
      { date: "2027-03-05", echeance: 396.39, capitalRestantDu: 5828.86 },
      { date: "2027-04-05", echeance: 396.39, capitalRestantDu: 5447.04 },
      { date: "2027-05-05", echeance: 396.39, capitalRestantDu: 5064.27 },
      { date: "2027-06-05", echeance: 396.39, capitalRestantDu: 4680.54 },
      { date: "2027-07-05", echeance: 396.39, capitalRestantDu: 4295.85 },
      { date: "2027-08-05", echeance: 396.39, capitalRestantDu: 3910.2 },
      { date: "2027-09-05", echeance: 396.39, capitalRestantDu: 3523.59 },
      { date: "2027-10-05", echeance: 396.39, capitalRestantDu: 3136.01 },
      { date: "2027-11-05", echeance: 396.39, capitalRestantDu: 2747.46 },
      { date: "2027-12-05", echeance: 396.39, capitalRestantDu: 2357.94 },
      { date: "2028-01-05", echeance: 396.39, capitalRestantDu: 1967.44 },
      { date: "2028-02-05", echeance: 396.39, capitalRestantDu: 1575.97 },
      { date: "2028-03-05", echeance: 396.39, capitalRestantDu: 1183.52 },
      { date: "2028-04-05", echeance: 396.39, capitalRestantDu: 790.09 },
      { date: "2028-05-05", echeance: 396.39, capitalRestantDu: 395.68 },
      { date: "2028-06-05", echeance: 396.39, capitalRestantDu: 0.0 },
    ],
  },
];

// Date de la toute dernière échéance du prêt (fin de remboursement) — le
// tableau d'amortissement se termine toujours par la ligne où le capital
// restant dû atteint 0.
export function getLoanEndDate(loan) {
  return loan.schedule[loan.schedule.length - 1].date;
}

export function getLoanStatus(loan, todayISO = new Date().toISOString().slice(0, 10)) {
  let remaining = loan.montantInitial;
  let next = null;
  for (const row of loan.schedule) {
    if (row.date < todayISO) {
      remaining = row.capitalRestantDu;
    } else {
      next = row;
      break;
    }
  }
  return {
    remaining,
    next: next ? { date: next.date, echeance: next.echeance } : null,
    endDate: getLoanEndDate(loan),
    paidOff: next == null,
  };
}
