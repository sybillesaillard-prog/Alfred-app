// Ventilation du prélèvement mensuel Allianz par police d'assurance.
//
// Sybille règle 7 contrats Allianz (2 véhicules, 2 locaux professionnels
// Peyrolles, "transport privé", protection juridique, et RC Pro/Décennale
// BTP) via le MÊME mandat SEPA (Référence Unique de Mandat
// NM41AG20170900000104956766, identique sur les 7 avis d'échéance/appels de
// cotisation) — ce qui veut dire qu'ils sont très probablement prélevés en
// UNE SEULE fois groupée sur son compte bancaire chaque mois, sous un seul
// libellé "ALLIANZ". Il est donc impossible de les distinguer par simple
// recherche de mot-clé dans le libellé bancaire (matchChargeByMonth) : les
// 7 lignes verraient toutes le même montant total.
//
// À la place, ce fichier encode le calendrier de prélèvement OFFICIEL de
// chaque police, tel que communiqué par Allianz dans ses avis d'échéance/
// appels de cotisation (trouvés sur le PC de Sybille, dossiers Cabinet
// ISRAEL/2025 ET 2026, lus par OCR le 23/08/2026 — cf. claude/app-alfred-
// notes.md pour le détail complet de la lecture). fixedCharges.js utilise ce
// calendrier à la place du rapprochement bancaire dès qu'une charge porte
// l'un des libellés ci-dessous (correspondance exacte sur `label`).
//
// ✅ Réconciliation confirmée le 23/08/2026 : la somme des 7 polices ci-
// dessous pour un mois où toutes sont actives (ex. juin 2026 : 39,02 +
// 29,46 + 15,65 + 37,66 + 147,42 + 36,23 + 109,37 = 414,81 €) correspond
// EXACTEMENT au total "Assurances" réellement débité en banque sous le
// libellé "ALLIANZ" (414,81 € observé pour plusieurs mois consécutifs dans
// l'app) — les 3 polices découvertes le 23/08/2026 (2 véhicule GB-038-QF,
// box pro, et surtout Solution BTP à 109,37 €/mois) expliquaient la quasi-
// totalité de l'écart constaté initialement (~415 € réels vs ~122 € pour
// les 4 premières polices seules). Ventilation désormais complète et
// vérifiée, plus d'écart résiduel connu.
//
// ⚠️ Limites connues, à vérifier avec Sybille :
// - Chaque contrat se renouvelle à une date différente dans l'année ; les
//   mois postérieurs au dernier renouvellement connu ne sont pas encore
//   dans le calendrier (l'avis du prochain renouvellement n'a pas encore
//   été émis/trouvé) — ces mois affichent "—" plutôt qu'un montant supposé.
//   C'est le cas de fin d'année 2026 pour Auto GB-038-QF (renouvelle vers
//   le 24/11), ProfilPro box (renouvelle vers le 06/12) et, à partir de
//   janvier 2027, pour Solution BTP (contrat calé sur l'année civile).
// - "Echénacier contenu privé.pdf" et "Echéancier contenu camion.pdf" sont
//   DEUX fichiers différents sur le PC de Sybille mais contiennent le même
//   contrat n°59174115 avec les mêmes montants — confirmé par Sybille le
//   23/08/2026 qu'il s'agit bien d'un doublon (un seul vrai contrat) : une
//   seule ligne "Allianz Transport Privé" est donc conservée, à bon droit.
export const ALLIANZ_POLICIES = [
  {
    key: "allianz_auto_ef945er",
    label: "Allianz Auto (Ford Transit Custom EF-945-ER)",
    contractNumber: "59173526",
    // 2025 : période 13/04/2025 → 12/04/2026, 35,37 €/mois (avis du
    // 02/03/2025, complète janvier-mars 2026 avant le renouvellement).
    // 2026 : période 13/04/2026 → 12/04/2027, prélèvement le 15 de chaque
    // mois. Le premier prélèvement du renouvellement (45,52 €) inclut
    // 6,50 € de contribution réglementaire Attentats, non répétée ensuite.
    scheduleByMonth: {
      "2026-01": 35.37,
      "2026-02": 35.37,
      "2026-03": 35.37,
      "2026-04": 45.52,
      "2026-05": 39.02,
      "2026-06": 39.02,
      "2026-07": 39.02,
      "2026-08": 39.02,
      "2026-09": 39.02,
      "2026-10": 39.02,
      "2026-11": 39.02,
      "2026-12": 39.02,
      "2027-01": 39.02,
      "2027-02": 39.02,
      "2027-03": 39.02,
    },
  },
  {
    key: "allianz_auto_gb038qf",
    label: "Allianz Auto (Ford Transit Custom GB-038-QF)",
    contractNumber: "AF413254581",
    // Découvert le 23/08/2026 (dossier 2025, "Mémo assuré GB 038 QF.pdf" +
    // avis d'échéance du 05/10/2025) — 2e véhicule assuré, absent du
    // dossier 2026 consulté initialement. Période 24/11/2025 → 28/11/2026,
    // prélèvement le 15, 147,42 €/mois (153,92 € au 15/11/2025, incl.
    // 6,50 € Attentats). Renouvellement suivant (~24/11/2026) pas encore
    // dans le dossier — novembre/décembre 2026 inconnus pour l'instant.
    scheduleByMonth: {
      "2026-01": 147.42,
      "2026-02": 147.42,
      "2026-03": 147.42,
      "2026-04": 147.42,
      "2026-05": 147.42,
      "2026-06": 147.42,
      "2026-07": 147.42,
      "2026-08": 147.42,
      "2026-09": 147.42,
      "2026-10": 147.42,
    },
  },
  {
    key: "allianz_profilpro_local",
    label: "Allianz ProfilPro (local pro, Peyrolles)",
    contractNumber: "61062373",
    // 2025 : période 25/03/2025 → 24/03/2026, 28,86 €/mois (appel du
    // 07/02/2025, complète janvier-février 2026 avant le renouvellement).
    // 2026 : période 25/03/2026 → 24/03/2027, prélèvement le 15. Premier
    // prélèvement du renouvellement (35,96 €) inclut 6,50 € Attentats.
    scheduleByMonth: {
      "2026-01": 28.86,
      "2026-02": 28.86,
      "2026-03": 35.96,
      "2026-04": 29.46,
      "2026-05": 29.46,
      "2026-06": 29.46,
      "2026-07": 29.46,
      "2026-08": 29.46,
      "2026-09": 29.46,
      "2026-10": 29.46,
      "2026-11": 29.46,
      "2026-12": 29.46,
      "2027-01": 29.46,
      "2027-02": 29.46,
    },
  },
  {
    key: "allianz_profilpro_box",
    label: "Allianz ProfilPro (box pro, Peyrolles)",
    contractNumber: "62900775",
    // Découvert le 23/08/2026 (dossier 2025, "Echeancier box.pdf") — 2e
    // local professionnel assuré à Peyrolles (BAT B - PARTIE OUEST N°30,
    // QUA SAINT JOSEPH LE HAUT), distinct du "local pro" ci-dessus (adresse
    // et n° de contrat différents). Période 06/12/2025 → 05/12/2026,
    // prélèvement le 15, 36,23 €/mois (42,13 € au 15/12/2025, incl. 6,50 €
    // Attentats). Renouvellement suivant (~06/12/2026) pas encore dans le
    // dossier — décembre 2026 inconnu pour l'instant.
    scheduleByMonth: {
      "2026-01": 36.23,
      "2026-02": 36.23,
      "2026-03": 36.23,
      "2026-04": 36.23,
      "2026-05": 36.23,
      "2026-06": 36.23,
      "2026-07": 36.23,
      "2026-08": 36.23,
      "2026-09": 36.23,
      "2026-10": 36.23,
      "2026-11": 36.23,
    },
  },
  {
    key: "allianz_transport_prive",
    label: "Allianz Transport Privé (contrat 59174115)",
    contractNumber: "59174115",
    // 2025 : période 13/04/2025 → 12/04/2026, 14,98 €/mois (appel du
    // 08/03/2025, complète janvier-mars 2026 avant le renouvellement).
    // 2026 : période 13/04/2026 → 12/04/2027, prélèvement le 15. Premier
    // prélèvement du renouvellement (22,15 €) inclut 6,50 € Attentats.
    scheduleByMonth: {
      "2026-01": 14.98,
      "2026-02": 14.98,
      "2026-03": 14.98,
      "2026-04": 22.15,
      "2026-05": 15.65,
      "2026-06": 15.65,
      "2026-07": 15.65,
      "2026-08": 15.65,
      "2026-09": 15.65,
      "2026-10": 15.65,
      "2026-11": 15.65,
      "2026-12": 15.65,
      "2027-01": 15.65,
      "2027-02": 15.65,
      "2027-03": 15.65,
    },
  },
  {
    key: "allianz_pj",
    label: "Allianz Protection Juridique (PJ)",
    contractNumber: "61213009",
    // 2025 : période 25/06/2025 → 24/06/2026, 36,92 €/mois flat (appel du
    // 09/05/2025, pas de supplément Attentats sur cette garantie — complète
    // janvier-mai 2026 avant le renouvellement).
    // 2026 : période 25/06/2026 → 24/06/2027, prélèvement le 15, 37,66 €/
    // mois flat (toujours pas de supplément Attentats sur ce contrat).
    scheduleByMonth: {
      "2026-01": 36.92,
      "2026-02": 36.92,
      "2026-03": 36.92,
      "2026-04": 36.92,
      "2026-05": 36.92,
      "2026-06": 37.66,
      "2026-07": 37.66,
      "2026-08": 37.66,
      "2026-09": 37.66,
      "2026-10": 37.66,
      "2026-11": 37.66,
      "2026-12": 37.66,
      "2027-01": 37.66,
      "2027-02": 37.66,
      "2027-03": 37.66,
      "2027-04": 37.66,
      "2027-05": 37.66,
    },
  },
  {
    key: "allianz_solution_btp",
    label: "Allianz Solution BTP (RC Pro + Décennale)",
    contractNumber: "61213515",
    // Découvert le 23/08/2026 (dossier 2025, "Echénacier Décennale.pdf",
    // appel de cotisation du 12/12/2025) — assurance responsabilité civile
    // professionnelle + garantie décennale (obligatoire pour l'activité de
    // constructeur/électricité). À elle seule, cette police explique la
    // majeure partie de l'écart initialement constaté entre la somme des
    // polices connues et le vrai débit bancaire "ALLIANZ". Contrat calé sur
    // l'année civile : période 01/01/2026 → 31/12/2026, prélèvement le 15,
    // 109,37 €/mois (115,87 € au 15/01/2026, incl. 6,50 € Attentats) —
    // calendrier connu pour la totalité de l'année 2026. Renouvellement
    // suivant (~01/01/2027) pas encore dans le dossier.
    scheduleByMonth: {
      "2026-01": 115.87,
      "2026-02": 109.37,
      "2026-03": 109.37,
      "2026-04": 109.37,
      "2026-05": 109.37,
      "2026-06": 109.37,
      "2026-07": 109.37,
      "2026-08": 109.37,
      "2026-09": 109.37,
      "2026-10": 109.37,
      "2026-11": 109.37,
      "2026-12": 109.37,
    },
  },
];

export function findAllianzPolicy(label) {
  return ALLIANZ_POLICIES.find((p) => p.label === label) || null;
}
