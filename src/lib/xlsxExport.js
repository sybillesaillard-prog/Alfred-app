// Export d'un tableau catégorie/mois (Charges fixes, Charges variables) au
// format .xlsx — chargé dynamiquement (import() dans downloadTableAsXlsx)
// pour ne pas alourdir le bundle principal de l'app avec une bibliothèque
// qui ne sert qu'à l'export, rarement utilisé.
import { downloadBlob } from "./pdf";

// rows: [{ label, values: [montant, ...], average }]
// months: ["2026-01", ...] déjà formatés en libellé lisible côté appelant
export async function downloadTableAsXlsx({ filename, sheetName, monthLabels, rows, totalRow }) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName || "Export");

  const header = ["", ...monthLabels, "Moyenne"];
  sheet.addRow(header).font = { bold: true };

  for (const row of rows) {
    const line = sheet.addRow([row.label, ...row.values, row.average]);
    if (row.bold) line.font = { bold: true };
  }

  if (totalRow) {
    const line = sheet.addRow([totalRow.label, ...totalRow.values, totalRow.average]);
    line.font = { bold: true };
  }

  sheet.getColumn(1).width = 42;
  for (let i = 2; i <= header.length; i++) {
    sheet.getColumn(i).width = 14;
    sheet.getColumn(i).numFmt = '#,##0.00 "€"';
  }
  sheet.getRow(1).alignment = { horizontal: "right" };
  sheet.getCell(1, 1).alignment = { horizontal: "left" };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
}

// Export du pointage justificatifs/relevé bancaire (18/09, page Pointage) —
// une ligne par opération débitée du trimestre, avec les deux colonnes de
// contrôle demandées par Sybille : saisie dans Alfred + fichier présent sur
// le PC. Forme différente du tableau catégorie×mois ci-dessus (une ligne par
// opération, pas par catégorie), d'où une fonction dédiée plutôt qu'une
// réutilisation de downloadTableAsXlsx.
//
// rows: [{ date, label, amount, saisi: bool, fichier: bool|null }]
//   fichier === null signifie "non vérifié" (dossier PC pas connecté) et pas
//   "absent" — distinction importante pour ne pas alarmer Sybille à tort.
export async function downloadPointageAsXlsx({ filename, quarterLabel, rows, fileCheckAvailable }) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pointage");

  sheet.addRow([`Pointage justificatifs — ${quarterLabel}`]).font = { bold: true, size: 13 };
  sheet.addRow([]);

  const fichierHeader = fileCheckAvailable ? "Fichier sur PC" : "Fichier sur PC (non vérifié)";
  const header = ["Date", "Libellé (relevé bancaire)", "Montant", "Saisi dans Alfred", fichierHeader];
  sheet.addRow(header).font = { bold: true };

  const WARN_ARGB = "FFB45309"; // ambre — cohérent avec les alertes de la page Doublons

  for (const row of rows) {
    const saisiLabel = row.saisi ? "Oui" : "Non";
    const fichierLabel = !fileCheckAvailable ? "" : row.fichier == null ? "?" : row.fichier ? "Oui" : "Non";
    const line = sheet.addRow([row.date, row.label, row.amount, saisiLabel, fichierLabel]);
    const alert = !row.saisi || (fileCheckAvailable && row.fichier === false);
    if (alert) {
      line.eachCell((cell) => {
        cell.font = { color: { argb: WARN_ARGB } };
      });
    }
  }

  sheet.getColumn(1).width = 14;
  sheet.getColumn(2).width = 44;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(3).numFmt = '#,##0.00 "€"';
  sheet.getColumn(4).width = 18;
  sheet.getColumn(5).width = 24;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
}
