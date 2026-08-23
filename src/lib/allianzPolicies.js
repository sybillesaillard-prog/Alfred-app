// Ventilation du prélèvement mensuel Allianz par police d'assurance.
//
// Sybille règle 4 contrats Allianz (auto, local professionnel, "transport
// privé" et protection juridique) via le MÊME mandat SEPA (Référence Unique
// de Mandat NM41AG20170900000104956766, identique sur les 4 avis
// d'échéance) — ce qui veut dire qu'ils sont très probablement prélevés en
// UNE SEULE fois groupée sur son compte bancaire chaque mois, sous un seul
// libellé "ALLIANZ". Il est donc impossible de les distinguer par simple
// recherche de mot-clé dans le libellé bancaire (matchChargeByMonth) : les
// 4 lignes verraient toutes le même montant total.
//
// À la place, ce fichier encode le calendrier de prélèvement OFFICIEL de
// chaque police, tel que communiqué par Allianz dans ses avis d'échéance
// (trouvés sur le PC de Sybille, dossier Cabinet ISRAEL/2026, et lus par
// OCR le 23/08/2026 — cf. claude/app-alfred-notes.md pour le détail complet
// de la lecture). fixedCharges.js utilise ce calendrier à la place du
// rapprochement bancaire dès qu'une charge porte l'un des libellés
// ci-dessous (correspondance exacte sur `label`).
//
// ⚠️ Limites connues, à vérifier avec Sybille :
// - Les 4 contrats se renouvellent à des dates différentes en 2026 ; les
//   montants ci-dessous ne sont connus qu'À PARTIR de la date de
//   renouvellement lue sur chaque avis. Pour les mois antérieurs (ex.
//   janvier-mars 2026 pour l'auto), le montant exact n'est pas connu ici
//   (l'avis de la période précédente n'a pas été trouvé dans le dossier) —
//   ces mois n'apparaissent donc pas dans le calendrier et la charge
//   affichera "—" plutôt qu'un montant supposé.
// - "Echénacier contenu privé.pdf" et "Echéancier contenu camion.pdf" sont
//   DEUX fichiers différents sur le PC de Sybille mais contiennent le même
//   contrat n°59174115 avec les mêmes montants (probable doublon de scan,
//   ou un document manquant pour une autre police) — à vérifier avec elle ;
//   une seule ligne "Allianz Transport Privé" est créée en attendant.
export const ALLIANZ_POLICIES = [
  {
    key: "allianz_auto",
    label: "Allianz Auto (Ford Transit Custom EF-945-ER)",
    contractNumber: "59173526",
    // Période d'assurance 13/04/2026 → 12/04/2027, prélèvement le 15 de
    // chaque mois. Le premier prélèvement (45,52 €) inclut 6,50 € de
    // contribution réglementaire Attentats, non répétée ensuite.
    scheduleByMonth: {
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
    key: "allianz_profilpro",
    label: "Allianz ProfilPro (local pro, Peyrolles)",
    contractNumber: "61062373",
    // Période d'assurance 25/03/2026 → 24/03/2027, prélèvement le 15.
    // Premier prélèvement (35,96 €) inclut 6,50 € Attentats.
    scheduleByMonth: {
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
    key: "allianz_transport_prive",
    label: "Allianz Transport Privé (contrat 59174115)",
    contractNumber: "59174115",
    // Période d'assurance 13/04/2026 → 12/04/2027, prélèvement le 15.
    // Premier prélèvement (22,15 €) inclut 6,50 € Attentats.
    scheduleByMonth: {
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
    // Période d'assurance 25/06/2026 → 24/06/2027, prélèvement le 15.
    // Pas de supplément Attentats sur le premier prélèvement pour cette
    // garantie (absent du calendrier lu sur l'avis).
    scheduleByMonth: {
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
];

export function findAllianzPolicy(label) {
  return ALLIANZ_POLICIES.find((p) => p.label === label) || null;
}
