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
