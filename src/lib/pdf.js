import { jsPDF } from "jspdf";
import { categoryInfo } from "./expenseCategories";

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateFR = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

// Convertit une photo (image) en PDF A4 ; laisse un PDF déjà importé tel quel.
export async function fileToPdfBlob(file) {
  if (file.type === "application/pdf") {
    return file;
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });

  const orientation = img.width > img.height ? "l" : "p";
  const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageW / img.width, pageH / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  pdf.addImage(dataUrl, "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
  return pdf.output("blob");
}

// Prépare un document PDF A4 avec un en-tête standard (titre + date de
// génération) pour les récaps mensuels de rapprochement bancaire — usage
// interne, partagé par les deux exports ci-dessous.
function newReportPdf(title, monthLabel) {
  const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 40;
  const bottomLimit = pageH - 44;
  let y = 54;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(`${title} — ${monthLabel}`, marginX, y);
  y += 16;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(120, 120, 120);
  pdf.text(`Généré depuis Alfred le ${new Date().toLocaleDateString("fr-FR")}`, marginX, y);
  pdf.setTextColor(20, 20, 20);
  y += 30;

  const ensureSpace = (needed) => {
    if (y + needed > bottomLimit) {
      pdf.addPage();
      y = 54;
    }
  };

  const tableHeader = () => {
    ensureSpace(24);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 100, 100);
    pdf.text("DATE", marginX, y);
    pdf.text("FOURNISSEUR / LIBELLÉ", marginX + 58, y);
    pdf.text("CATÉGORIE", marginX + 300, y);
    pdf.text("MONTANT", pageW - marginX, y, { align: "right" });
    y += 5;
    pdf.setDrawColor(210, 210, 210);
    pdf.line(marginX, y, pageW - marginX, y);
    y += 12;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(20, 20, 20);
  };

  return {
    pdf,
    pageW,
    get y() { return y; },
    set y(v) { y = v; },
    marginX,
    ensureSpace,
    tableHeader,
  };
}

// Récap PDF des justificatifs enregistrés ET rapprochés d'une opération
// bancaire réelle sur le mois consulté — pensé pour être archivé avec les
// justificatifs papier/PDF du mois (ex : envoi groupé au comptable).
export function generateMatchedExpensesPdf({ monthLabel, matchedExpenses }) {
  const ctx = newReportPdf("Justificatifs rapprochés", monthLabel);
  const { pdf, pageW, marginX } = ctx;

  ctx.tableHeader();
  let total = 0;
  if (matchedExpenses.length === 0) {
    pdf.setTextColor(140, 140, 140);
    pdf.text("Aucun justificatif rapproché ce mois-ci.", marginX, ctx.y);
    pdf.setTextColor(20, 20, 20);
    ctx.y += 16;
  }
  for (const e of matchedExpenses) {
    ctx.ensureSpace(15);
    const amt = e.ttc ?? e.amount ?? 0;
    total += amt;
    pdf.text(dateFR(e.date), marginX, ctx.y);
    pdf.text(truncate(e.fournisseur || e.note || "—", 42), marginX + 58, ctx.y);
    pdf.text(truncate(categoryInfo(e.category).label, 26), marginX + 300, ctx.y);
    pdf.text(euro.format(amt), pageW - marginX, ctx.y, { align: "right" });
    ctx.y += 14;
  }
  ctx.ensureSpace(20);
  pdf.setDrawColor(210, 210, 210);
  pdf.line(pageW - marginX - 140, ctx.y, pageW - marginX, ctx.y);
  ctx.y += 12;
  pdf.setFont("helvetica", "bold");
  pdf.text(`Total : ${euro.format(total)}  (${matchedExpenses.length} justificatif${matchedExpenses.length > 1 ? "s" : ""})`, pageW - marginX, ctx.y, { align: "right" });

  return pdf.output("blob");
}

// Récap PDF des opérations bancaires débitées sur le mois consulté qui n'ont
// encore aucun justificatif enregistré en face — la liste "à réclamer" du
// mois, à archiver ou transmettre au comptable pour suivi.
export function generateMissingTransactionsPdf({ monthLabel, missingTransactions }) {
  const ctx = newReportPdf("Opérations sans justificatif", monthLabel);
  const { pdf, pageW, marginX } = ctx;

  ctx.tableHeader();
  let total = 0;
  if (missingTransactions.length === 0) {
    pdf.setTextColor(140, 140, 140);
    pdf.text("Aucune opération sans justificatif ce mois-ci — tout est couvert.", marginX, ctx.y);
    pdf.setTextColor(20, 20, 20);
    ctx.y += 16;
  }
  for (const t of missingTransactions) {
    ctx.ensureSpace(15);
    const amt = Math.abs(t.amount);
    total += amt;
    pdf.text(dateFR(t.date), marginX, ctx.y);
    pdf.text(truncate(t.label || "Opération", 42), marginX + 58, ctx.y);
    pdf.text("—", marginX + 300, ctx.y);
    pdf.text(euro.format(amt), pageW - marginX, ctx.y, { align: "right" });
    ctx.y += 14;
  }
  ctx.ensureSpace(20);
  pdf.setDrawColor(210, 210, 210);
  pdf.line(pageW - marginX - 140, ctx.y, pageW - marginX, ctx.y);
  ctx.y += 12;
  pdf.setFont("helvetica", "bold");
  pdf.text(`Total : ${euro.format(total)}  (${missingTransactions.length} opération${missingTransactions.length > 1 ? "s" : ""})`, pageW - marginX, ctx.y, { align: "right" });

  return pdf.output("blob");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
