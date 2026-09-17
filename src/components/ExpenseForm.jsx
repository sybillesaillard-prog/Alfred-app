import { useEffect, useState } from "react";
import { X, Camera, FileText, Download, Cloud, CloudCheck, ScanLine } from "lucide-react";
import { EXPENSE_CATEGORIES } from "../lib/expenseCategories";
import {
  VAT_RATES,
  isStandardRate,
  computeFromHT,
  computeFromTVA,
  computeFromTTC,
  buildFilename,
} from "../lib/vat";
import { fileToPdfBlob, downloadBlob } from "../lib/pdf";
import { recognizeReceiptText, extractPdfText, extractReceiptFields } from "../lib/ocr";
import { isDriveConnected, connectDrive, uploadReceiptToDrive } from "../lib/googleDrive";
import {
  isLikelyDesktop,
  isRelayRunning,
  discoverScanners,
  getSavedScanner,
  saveScanner,
  scanDocument,
} from "../lib/scanRelay";

const todayISO = () => new Date().toISOString().slice(0, 10);

// Un ancien enregistrement n'a qu'un "amount" (pas de ht/tva/ttc) : on le
// traite comme TTC connu, TVA inconnue (0), pour ne rien casser à l'édition.
function initialFieldsFrom(initial, initialFournisseur) {
  if (!initial) {
    return {
      fournisseur: initialFournisseur || "",
      date: todayISO(),
      category: EXPENSE_CATEGORIES[0].id,
      rate: 0.2,
      customRate: "",
      ht: "",
      tva: "",
      ttc: "",
      note: "",
    };
  }
  const ttc = initial.ttc ?? initial.amount ?? 0;
  const ht = initial.ht ?? ttc;
  const tva = initial.tva ?? 0;
  const rate = initial.vatRate ?? 0;
  return {
    fournisseur: initial.fournisseur ?? "",
    date: initial.date ?? todayISO(),
    category: initial.category ?? EXPENSE_CATEGORIES[0].id,
    rate: isStandardRate(rate) ? rate : "custom",
    customRate: isStandardRate(rate) ? "" : String(round1(rate * 100)),
    ht: ht ? String(ht) : "",
    tva: tva ? String(tva) : "",
    ttc: ttc ? String(ttc) : "",
    note: initial.note ?? "",
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// initialFournisseur/initialFile : utilisés pour pré-remplir une NOUVELLE
// dépense (jamais en édition, initial doit rester null dans ce cas) à
// partir d'une pièce jointe déjà récupérée ailleurs — ex. une facture PDF
// téléchargée depuis Gmail (cf. src/pages/GmailInvoices.jsx). Le fichier
// suit exactement le même chemin (aperçu, OCR si image, upload Drive) qu'un
// fichier choisi via "Photographier"/"Importer"/"Scanner".
export default function ExpenseForm({
  initial,
  existingFilenames = [],
  initialFournisseur,
  initialFile,
  onSubmit,
  onClose,
}) {
  const f0 = initialFieldsFrom(initial, initialFournisseur);
  const [fournisseur, setFournisseur] = useState(f0.fournisseur);
  const [date, setDate] = useState(f0.date);
  const [category, setCategory] = useState(f0.category);
  const [rateSel, setRateSel] = useState(f0.rate);
  const [customRate, setCustomRate] = useState(f0.customRate);
  const [ht, setHt] = useState(f0.ht);
  const [tva, setTva] = useState(f0.tva);
  const [ttc, setTtc] = useState(f0.ttc);
  const [note, setNote] = useState(f0.note);
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [savedDownload, setSavedDownload] = useState(null); // [{ blob, filename, driveViewUrl }, ...]

  // Ventilation d'un débit sur 2 factures (18/09, demande de Sybille :
  // "ajoute la possibilité de ventiler un débit avec 2 factures") — pour un
  // paiement bancaire unique qui correspond en réalité à deux factures
  // distinctes (fournisseurs/catégories/taux de TVA potentiellement
  // différents). Uniquement proposé à la création (jamais en édition) : les
  // deux factures deviennent deux dépenses Firestore séparées, liées par un
  // même `splitGroupId` pour que le rapprochement bancaire (bankTx.js) les
  // reconnaisse comme UN SEUL débit une fois les deux montants additionnés,
  // au lieu de chercher (en vain) une dépense seule au montant du débit.
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [fournisseur2, setFournisseur2] = useState("");
  const [date2, setDate2] = useState(f0.date);
  const [category2, setCategory2] = useState(EXPENSE_CATEGORIES[0].id);
  const [rateSel2, setRateSel2] = useState(0.2);
  const [customRate2, setCustomRate2] = useState("");
  const [ht2, setHt2] = useState("");
  const [tva2, setTva2] = useState("");
  const [ttc2, setTtc2] = useState("");
  const [note2, setNote2] = useState("");
  const [file2, setFile2] = useState(null);
  const [filePreviewUrl2, setFilePreviewUrl2] = useState(null);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrFound, setOcrFound] = useState(false);
  const [driveConnected, setDriveConnected] = useState(isDriveConnected());
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveError, setDriveError] = useState("");

  // État du bouton "Scanner" (relais local vers l'imprimante réseau eSCL) —
  // cf. src/lib/scanRelay.js. "idle" = pas encore essayé, "checking" = on
  // vérifie que le relais tourne, "need-ip" = relais trouvé mais aucune
  // imprimante détectée automatiquement (saisie manuelle de l'IP), "scanning"
  // = numérisation en cours, "error"/"no-relay" = messages à afficher.
  const [scanPhase, setScanPhase] = useState("idle");
  const [scanError, setScanError] = useState("");
  const [manualIp, setManualIp] = useState("");

  const effectiveRate = () => {
    if (rateSel === "custom") return (parseFloat(customRate) || 0) / 100;
    return parseFloat(rateSel) || 0;
  };

  const onHtChange = (v) => {
    setHt(v);
    const parsed = parseFloat(String(v).replace(",", ".")) || 0;
    const { tva: t, ttc: tt } = computeFromHT(parsed, effectiveRate());
    setTva(t ? String(t) : "");
    setTtc(tt ? String(tt) : "");
  };
  const onTvaChange = (v) => {
    setTva(v);
    const parsedHt = parseFloat(String(ht).replace(",", ".")) || 0;
    const parsedTva = parseFloat(String(v).replace(",", ".")) || 0;
    const { ttc: tt } = computeFromTVA(parsedHt, parsedTva);
    setTtc(tt ? String(tt) : "");
  };
  const onTtcChange = (v) => {
    setTtc(v);
    const parsed = parseFloat(String(v).replace(",", ".")) || 0;
    const { ht: h, tva: t } = computeFromTTC(parsed, effectiveRate());
    setHt(h ? String(h) : "");
    setTva(t ? String(t) : "");
  };
  const onRateChange = (v) => {
    setRateSel(v);
    // Recalcule TVA/TTC à partir du HT actuel avec le nouveau taux.
    const parsed = parseFloat(String(ht).replace(",", ".")) || 0;
    const rate = v === "custom" ? (parseFloat(customRate) || 0) / 100 : parseFloat(v) || 0;
    const { tva: t, ttc: tt } = computeFromHT(parsed, rate);
    setTva(t ? String(t) : "");
    setTtc(tt ? String(tt) : "");
  };
  const onCustomRateChange = (v) => {
    setCustomRate(v);
    const parsed = parseFloat(String(ht).replace(",", ".")) || 0;
    const rate = (parseFloat(v) || 0) / 100;
    const { tva: t, ttc: tt } = computeFromHT(parsed, rate);
    setTva(t ? String(t) : "");
    setTtc(tt ? String(tt) : "");
  };

  // Sous-traitance : taux de TVA par défaut à 0 % (18/09), appliqué au choix
  // de la catégorie — reste modifiable ensuite via le sélecteur de taux si
  // une facture donnée précise a un taux différent.
  const onCategoryChange = (id) => {
    setCategory(id);
    if (id === "soustraitance") onRateChange(0);
  };

  // --- Facture 2 (ventilation d'un débit sur 2 factures) — mêmes calculs
  // HT/TVA/TTC que la facture 1, sur des champs séparés. Pas de lecture
  // automatique (OCR/PDF) ni de scanner réseau pour cette 2e facture, pour
  // garder le formulaire simple : les montants se saisissent à la main.
  const effectiveRate2 = () => {
    if (rateSel2 === "custom") return (parseFloat(customRate2) || 0) / 100;
    return parseFloat(rateSel2) || 0;
  };
  const onHt2Change = (v) => {
    setHt2(v);
    const parsed = parseFloat(String(v).replace(",", ".")) || 0;
    const { tva: t, ttc: tt } = computeFromHT(parsed, effectiveRate2());
    setTva2(t ? String(t) : "");
    setTtc2(tt ? String(tt) : "");
  };
  const onTva2Change = (v) => {
    setTva2(v);
    const parsedHt = parseFloat(String(ht2).replace(",", ".")) || 0;
    const parsedTva = parseFloat(String(v).replace(",", ".")) || 0;
    const { ttc: tt } = computeFromTVA(parsedHt, parsedTva);
    setTtc2(tt ? String(tt) : "");
  };
  const onTtc2Change = (v) => {
    setTtc2(v);
    const parsed = parseFloat(String(v).replace(",", ".")) || 0;
    const { ht: h, tva: t } = computeFromTTC(parsed, effectiveRate2());
    setHt2(h ? String(h) : "");
    setTva2(t ? String(t) : "");
  };
  const onRate2Change = (v) => {
    setRateSel2(v);
    const parsed = parseFloat(String(ht2).replace(",", ".")) || 0;
    const rate = v === "custom" ? (parseFloat(customRate2) || 0) / 100 : parseFloat(v) || 0;
    const { tva: t, ttc: tt } = computeFromHT(parsed, rate);
    setTva2(t ? String(t) : "");
    setTtc2(tt ? String(tt) : "");
  };
  const onCustomRate2Change = (v) => {
    setCustomRate2(v);
    const parsed = parseFloat(String(ht2).replace(",", ".")) || 0;
    const rate = (parseFloat(v) || 0) / 100;
    const { tva: t, ttc: tt } = computeFromHT(parsed, rate);
    setTva2(t ? String(t) : "");
    setTtc2(tt ? String(tt) : "");
  };
  const onCategory2Change = (id) => {
    setCategory2(id);
    if (id === "soustraitance") onRate2Change(0);
  };
  const onFile2Change = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile2(f);
    setFilePreviewUrl2(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  // Applique les champs détectés (par OCR image ou lecture directe de PDF)
  // au formulaire — logique partagée entre les deux modes de lecture
  // automatique, seul le message de statut en cas d'échec diffère.
  const applyExtractedFields = (fields, sourceLabel) => {
    if (fields.fournisseur) setFournisseur(fields.fournisseur);
    if (fields.date) setDate(fields.date);
    if (fields.rate != null) {
      const asFraction = fields.rate / 100;
      if (isStandardRate(asFraction)) {
        setRateSel(asFraction);
      } else {
        setRateSel("custom");
        setCustomRate(String(fields.rate));
      }
    }
    if (fields.ht != null) setHt(String(fields.ht));
    if (fields.tva != null) setTva(String(fields.tva));
    if (fields.ttc != null) setTtc(String(fields.ttc));

    if (fields.ttc != null) {
      setOcrFound(true);
      setOcrStatus("Champs détectés automatiquement — vérifie avant d'enregistrer.");
    } else {
      setOcrStatus(`Lecture automatique incomplète pour ${sourceLabel} — complète les champs ci-dessous.`);
    }
  };

  // Point d'entrée commun une fois qu'on a un fichier — qu'il vienne du
  // sélecteur "Photographier"/"Importer" (téléphone/PC) ou du scanner réseau
  // (PC uniquement, cf. handleScanClick ci-dessous). Deux modes de lecture
  // automatique selon le type de fichier : OCR (reconnaissance, donc
  // approximative) pour une image, ou lecture directe du calque de texte
  // (exacte, aucune reconnaissance) pour un PDF généré numériquement — bien
  // plus fiable, comme le texte n'est jamais "deviné".
  const processAcquiredFile = (f) => {
    if (!f) return;
    setFile(f);
    setOcrFound(false);
    const isImage = f.type.startsWith("image/");
    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name || "");
    setFilePreviewUrl(isImage ? URL.createObjectURL(f) : null);

    if (isImage) {
      setOcrStatus("Lecture automatique en cours…");
      recognizeReceiptText(f, (m) => {
        const pct = Math.round((m.progress || 0) * 100);
        setOcrStatus(`${m.status === "recognizing text" ? "Lecture" : "Préparation"}… ${pct}%`);
      })
        .then((text) => applyExtractedFields(extractReceiptFields(text), "cette photo"))
        .catch(() => {
          setOcrStatus("Lecture automatique impossible pour cette photo — remplis les champs ci-dessous.");
        });
      return;
    }

    if (isPdf) {
      setOcrStatus("Lecture du PDF en cours…");
      extractPdfText(f)
        .then((text) => {
          // Un PDF scanné (une image, sans calque de texte réel) renvoie un
          // texte vide ou quasi vide — inutile d'essayer d'en extraire des
          // champs, on prévient juste que la saisie sera manuelle.
          if (!text || text.trim().length < 5) {
            setOcrStatus(
              "Ce PDF semble être une image scannée (pas de texte détecté) — remplis les champs ci-dessous."
            );
            return;
          }
          applyExtractedFields(extractReceiptFields(text), "ce PDF");
        })
        .catch(() => {
          setOcrStatus("Lecture automatique impossible pour ce PDF — remplis les champs ci-dessous.");
        });
      return;
    }

    setOcrStatus("");
  };

  const onFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    processAcquiredFile(f);
  };

  // Charge automatiquement le fichier fourni par l'appelant (ex. facture
  // PDF Gmail) une seule fois, dès l'ouverture du formulaire — sans que
  // l'utilisatrice ait besoin de re-choisir un fichier qu'elle a déjà
  // sélectionné en amont.
  useEffect(() => {
    if (initialFile) processAcquiredFile(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lance un scan via le relais local (src/lib/scanRelay.js). Enchaîne :
  // relais lancé ? imprimante déjà connue (mémorisée) ou découverte
  // automatique (mDNS) ? sinon demande l'IP à la main. Chaque étape peut
  // échouer sans casser le formulaire — l'utilisatrice garde toujours la
  // solution de repli "Importer PDF/image" (scan via l'appli Windows, puis
  // import du fichier).
  const runScan = async (target) => {
    setScanPhase("scanning");
    setScanError("");
    try {
      const f = await scanDocument(target);
      saveScanner(target);
      setScanPhase("idle");
      processAcquiredFile(f);
    } catch (err) {
      setScanPhase("error");
      setScanError(err.message || "Le scan a échoué.");
    }
  };

  const handleScanClick = async () => {
    setScanError("");
    setScanPhase("checking");
    const running = await isRelayRunning();
    if (!running) {
      setScanPhase("no-relay");
      return;
    }

    const saved = getSavedScanner();
    if (saved) {
      runScan(saved);
      return;
    }

    setScanPhase("checking");
    try {
      const scanners = await discoverScanners();
      if (scanners.length > 0) {
        runScan(scanners[0]);
      } else {
        setScanPhase("need-ip");
      }
    } catch {
      setScanPhase("need-ip");
    }
  };

  const submitManualIp = () => {
    const host = manualIp.trim();
    if (!host) return;
    runScan({ host, port: 80, https: false, root: "eSCL" });
  };

  const onConnectDrive = async () => {
    setDriveBusy(true);
    setDriveError("");
    try {
      await connectDrive();
      setDriveConnected(true);
    } catch (err) {
      setDriveError("Connexion à Google Drive refusée ou impossible.");
    } finally {
      setDriveBusy(false);
    }
  };

  const filenamePreview = file
    ? buildFilename(fournisseur, parseFloat(String(ttc).replace(",", ".")) || 0, existingFilenames)
    : null;
  const filenamePreview2 = file2
    ? buildFilename(fournisseur2, parseFloat(String(ttc2).replace(",", ".")) || 0, existingFilenames)
    : null;

  // Convertit un fichier en PDF puis l'envoie sur Drive si connecté — logique
  // partagée entre la facture 1 (toujours) et la facture 2 (seulement si
  // "Ventiler ce débit sur 2 factures" est actif et qu'un fichier y est joint).
  const buildAndUpload = async (f, filename, dateVal) => {
    if (!f) return { pdfBlob: null, driveFileId: null, driveViewUrl: null };
    const pdfBlob = await fileToPdfBlob(f);
    let driveFileId = null;
    let driveViewUrl = null;
    if (driveConnected) {
      try {
        const uploaded = await uploadReceiptToDrive(pdfBlob, filename, dateVal);
        driveFileId = uploaded.id;
        driveViewUrl = uploaded.webViewLink;
      } catch (err) {
        setDriveError("L'envoi vers Drive a échoué — le fichier reste à télécharger manuellement.");
      }
    }
    return { pdfBlob, driveFileId, driveViewUrl };
  };

  const submit = async (e) => {
    e.preventDefault();
    const parsedHt = parseFloat(String(ht).replace(",", ".")) || 0;
    const parsedTva = parseFloat(String(tva).replace(",", ".")) || 0;
    const parsedTtc = parseFloat(String(ttc).replace(",", ".")) || 0;
    if (!parsedTtc || parsedTtc <= 0) return;

    let parsedHt2 = 0;
    let parsedTva2 = 0;
    let parsedTtc2 = 0;
    if (splitEnabled) {
      parsedHt2 = parseFloat(String(ht2).replace(",", ".")) || 0;
      parsedTva2 = parseFloat(String(tva2).replace(",", ".")) || 0;
      parsedTtc2 = parseFloat(String(ttc2).replace(",", ".")) || 0;
      if (!parsedTtc2 || parsedTtc2 <= 0) return;
    }

    setBusy(true);
    try {
      // Identifiant partagé par les deux factures d'un même débit ventilé —
      // cf. matchTransactions dans bankTx.js, qui reconnaît le groupe complet
      // dès que la somme des deux correspond au montant réellement débité.
      const splitGroupId = splitEnabled
        ? `split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        : null;

      const filename1 = file ? filenamePreview : (initial?.filename ?? null);
      const kind1 = file ? (file.type.startsWith("image/") ? "photo" : "pdf") : (initial?.kind ?? "manuel");
      const up1 = await buildAndUpload(file, filename1, date);

      await onSubmit({
        fournisseur: fournisseur.trim(),
        date,
        category,
        vatRate: effectiveRate(),
        ht: parsedHt,
        tva: parsedTva,
        ttc: parsedTtc,
        amount: parsedTtc, // compat avec l'ancien champ "amount"
        note: note.trim(),
        filename: filename1,
        kind: kind1,
        driveFileId: up1.driveFileId,
        driveViewUrl: up1.driveViewUrl,
        ...(splitGroupId ? { splitGroupId } : {}),
      });

      let filename2 = null;
      let up2 = null;
      if (splitEnabled) {
        filename2 = file2
          ? buildFilename(fournisseur2, parsedTtc2, [...existingFilenames, filename1].filter(Boolean))
          : null;
        const kind2 = file2 ? (file2.type.startsWith("image/") ? "photo" : "pdf") : "manuel";
        up2 = await buildAndUpload(file2, filename2, date2);

        await onSubmit({
          fournisseur: fournisseur2.trim(),
          date: date2,
          category: category2,
          vatRate: effectiveRate2(),
          ht: parsedHt2,
          tva: parsedTva2,
          ttc: parsedTtc2,
          amount: parsedTtc2,
          note: note2.trim(),
          filename: filename2,
          kind: kind2,
          driveFileId: up2.driveFileId,
          driveViewUrl: up2.driveViewUrl,
          splitGroupId,
        });
      }

      const downloads = [];
      if (file) downloads.push({ blob: up1.pdfBlob, filename: filename1, driveViewUrl: up1.driveViewUrl });
      if (splitEnabled && file2) downloads.push({ blob: up2.pdfBlob, filename: filename2, driveViewUrl: up2.driveViewUrl });

      if (downloads.length > 0) {
        setSavedDownload(downloads);
      } else {
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  // Écran de confirmation après enregistrement d'un ou deux documents (2 en
  // cas de ventilation sur 2 factures, chacune avec son propre fichier) : si
  // Google Drive est connecté le fichier y est déjà sauvegardé, sinon (pas
  // d'abonnement Firebase Storage actif) on propose de le télécharger tout
  // de suite sur cet appareil.
  if (savedDownload) {
    return (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full md:max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl p-5 space-y-4 safe-bottom">
          <h2 className="text-lg font-semibold">
            {savedDownload.length > 1 ? "Dépenses enregistrées ✅" : "Dépense enregistrée ✅"}
          </h2>
          {savedDownload.map((d, i) => (
            <div key={i} className="space-y-2.5 border-t border-slate-800 first:border-0 first:pt-0 pt-3">
              {savedDownload.length > 1 && (
                <p className="text-xs text-slate-500 font-medium">Facture {i + 1}</p>
              )}
              {d.driveViewUrl ? (
                <p className="text-sm text-emerald-300">
                  Le fichier a été sauvegardé dans ton Google Drive (dossier "Alfred - Justificatifs").
                </p>
              ) : (
                <p className="text-sm text-slate-400">
                  Le fichier n'est pas sauvegardé dans le cloud — télécharge-le sur cet appareil si tu veux le garder.
                </p>
              )}
              {d.driveViewUrl && (
                <a
                  href={d.driveViewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 font-medium py-2.5 hover:bg-emerald-400/20 transition"
                >
                  <CloudCheck size={16} />
                  Ouvrir dans Google Drive
                </a>
              )}
              <button
                onClick={() => downloadBlob(d.blob, d.filename)}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-sky-400 text-slate-950 font-medium py-2.5 hover:bg-sky-300 transition"
              >
                <Download size={16} />
                Télécharger {d.filename}
              </button>
            </div>
          ))}
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-slate-700 text-slate-300 py-2.5 hover:bg-slate-800 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full md:max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl p-5 space-y-4 safe-bottom"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {initial ? "Modifier la dépense" : "Nouvelle dépense"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1"
          >
            <X size={20} />
          </button>
        </div>

        {!initial && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Ticket ou facture (optionnel)
            </label>
            {!file ? (
              <div className="grid grid-cols-2 gap-2">
                {isLikelyDesktop() ? (
                  <button
                    type="button"
                    onClick={handleScanClick}
                    disabled={scanPhase === "checking" || scanPhase === "scanning"}
                    className="cursor-pointer flex flex-col items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-800/70 transition px-3 py-3 text-center disabled:opacity-60"
                  >
                    <ScanLine size={18} className="text-slate-300" />
                    <span className="text-xs text-slate-300">
                      {scanPhase === "checking" && "Recherche…"}
                      {scanPhase === "scanning" && "Numérisation…"}
                      {(scanPhase === "idle" || scanPhase === "error" || scanPhase === "no-relay" || scanPhase === "need-ip") &&
                        "Scanner (imprimante réseau)"}
                    </span>
                  </button>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-800/70 transition px-3 py-3 text-center">
                    <Camera size={18} className="text-slate-300" />
                    <span className="text-xs text-slate-300">Photographier</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
                  </label>
                )}
                <label className="cursor-pointer flex flex-col items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-800/70 transition px-3 py-3 text-center">
                  <FileText size={18} className="text-slate-300" />
                  <span className="text-xs text-slate-300">Importer PDF/image</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={onFileChange} />
                </label>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5">
                {filePreviewUrl ? (
                  <img src={filePreviewUrl} className="h-10 w-10 object-cover rounded" />
                ) : (
                  <FileText size={20} className="text-slate-300" />
                )}
                <span className="text-sm text-slate-300 flex-1 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setFilePreviewUrl(null);
                  }}
                  className="text-slate-500 hover:text-red-400 p-1"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {!file && isLikelyDesktop() && scanPhase === "no-relay" && (
              <div className="mt-2 rounded-lg bg-amber-400/10 border border-amber-400/30 px-3 py-2">
                <p className="text-xs text-amber-300">
                  Relais scanner introuvable. Vérifie que "AlfredScanRelay" tourne sur ce PC (une fenêtre de
                  console doit être ouverte), puis réessaie. Sinon, scanne via l'appli Windows et utilise
                  "Importer PDF/image".
                </p>
                <button
                  type="button"
                  onClick={handleScanClick}
                  className="mt-1.5 text-xs text-sky-300 hover:text-sky-200"
                >
                  Réessayer
                </button>
              </div>
            )}

            {!file && isLikelyDesktop() && scanPhase === "need-ip" && (
              <div className="mt-2 rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2 space-y-1.5">
                <p className="text-xs text-slate-400">
                  Imprimante non trouvée automatiquement sur le réseau. Saisis son adresse IP (visible dans les
                  paramètres réseau de l'imprimante) :
                </p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={manualIp}
                    onChange={(e) => setManualIp(e.target.value)}
                    placeholder="Ex : 192.168.1.42"
                    className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400"
                  />
                  <button
                    type="button"
                    onClick={submitManualIp}
                    className="rounded-lg bg-sky-400 text-slate-950 text-xs font-medium px-3 py-1.5 hover:bg-sky-300 transition"
                  >
                    Scanner
                  </button>
                </div>
              </div>
            )}

            {!file && isLikelyDesktop() && scanPhase === "error" && (
              <div className="mt-2 rounded-lg bg-red-400/10 border border-red-400/30 px-3 py-2 space-y-1">
                <p className="text-xs text-red-300">{scanError}</p>
                <button
                  type="button"
                  onClick={() => setScanPhase("need-ip")}
                  className="text-xs text-sky-300 hover:text-sky-200"
                >
                  Changer d'adresse imprimante
                </button>
              </div>
            )}

            {ocrStatus && (
              <p className={`text-xs mt-1.5 ${ocrFound ? "text-emerald-400" : "text-slate-500"}`}>
                {ocrStatus}
              </p>
            )}
            {!ocrStatus && (
              <p className="text-xs text-slate-500 mt-1.5">
                La lecture automatique calcule la TVA et le TTC pour toi — vérifie toujours avant d'enregistrer.
              </p>
            )}

            {file && (
              <div className="mt-2">
                {driveConnected ? (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <CloudCheck size={14} />
                    Connecté à Google Drive — le fichier y sera sauvegardé automatiquement.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={onConnectDrive}
                    disabled={driveBusy}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-sky-400/40 bg-sky-400/10 text-sky-300 text-sm font-medium px-3 py-2.5 hover:bg-sky-400/20 transition disabled:opacity-60"
                  >
                    <Cloud size={16} />
                    {driveBusy ? "Connexion…" : "Connecter Google Drive pour sauvegarder ce fichier"}
                  </button>
                )}
                {driveError && <p className="text-xs text-red-400 mt-1">{driveError}</p>}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm text-slate-400 mb-1">Fournisseur</label>
          <input
            type="text"
            value={fournisseur}
            onChange={(e) => setFournisseur(e.target.value)}
            placeholder="Ex : Amazon Business"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Catégorie</label>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Taux de TVA</label>
          <select
            value={rateSel}
            onChange={(e) => onRateChange(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
          >
            {VAT_RATES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
            <option value="custom">Autre taux (achat à l'étranger…)</option>
          </select>
          {rateSel === "custom" && (
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={customRate}
              onChange={(e) => onCustomRateChange(e.target.value)}
              placeholder="Taux en %, ex : 19"
              className="w-full mt-2 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
            />
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-sm text-slate-400 mb-1">HT (€)</label>
            <input
              type="text"
              inputMode="decimal"
              value={ht}
              onChange={(e) => onHtChange(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">TVA (€)</label>
            <input
              type="text"
              inputMode="decimal"
              value={tva}
              onChange={(e) => onTvaChange(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">TTC (€)</label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={ttc}
              onChange={(e) => onTtcChange(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 font-semibold outline-none focus:border-sky-400"
            />
          </div>
        </div>

        {file && filenamePreview && (
          <div className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2">
            <p className="text-xs text-slate-500">Nom du fichier généré</p>
            <p className="text-sm text-sky-300 font-mono break-all">{filenamePreview}</p>
          </div>
        )}

        <div>
          <label className="block text-sm text-slate-400 mb-1">
            Note (optionnel)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex : facture fournisseur X"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
          />
        </div>

        {/* Ventilation d'un débit sur 2 factures (18/09) — seulement à la
            création : deux paiements réunis dans un seul débit bancaire
            deviennent ici deux dépenses distinctes, reliées pour que le
            rapprochement bancaire les reconnaisse ensemble (bankTx.js). */}
        {!initial && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2.5">
            <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={splitEnabled}
                onChange={(e) => setSplitEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-sky-400 focus:ring-sky-400 focus:ring-offset-0"
              />
              Ce débit correspond à 2 factures (les ventiler)
            </label>
            {!splitEnabled && (
              <p className="text-xs text-slate-500 mt-1 ml-6">
                Ex : un seul virement qui règle deux factures d'un coup — coche pour saisir la 2ᵉ facture.
              </p>
            )}
          </div>
        )}

        {!initial && splitEnabled && (
          <div className="rounded-lg border border-sky-400/30 bg-sky-400/5 p-3.5 space-y-3.5">
            <p className="text-sm font-medium text-sky-300">Facture 2</p>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Fournisseur</label>
              <input
                type="text"
                value={fournisseur2}
                onChange={(e) => setFournisseur2(e.target.value)}
                placeholder="Ex : Amazon Business"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Catégorie</label>
                <select
                  value={category2}
                  onChange={(e) => onCategory2Change(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  required={splitEnabled}
                  value={date2}
                  onChange={(e) => setDate2(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Taux de TVA</label>
              <select
                value={rateSel2}
                onChange={(e) => onRate2Change(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
              >
                {VAT_RATES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
                <option value="custom">Autre taux (achat à l'étranger…)</option>
              </select>
              {rateSel2 === "custom" && (
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={customRate2}
                  onChange={(e) => onCustomRate2Change(e.target.value)}
                  placeholder="Taux en %, ex : 19"
                  className="w-full mt-2 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
                />
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-sm text-slate-400 mb-1">HT (€)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ht2}
                  onChange={(e) => onHt2Change(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">TVA (€)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={tva2}
                  onChange={(e) => onTva2Change(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">TTC (€)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  required={splitEnabled}
                  value={ttc2}
                  onChange={(e) => onTtc2Change(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 font-semibold outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Ticket ou facture (optionnel)
              </label>
              {!file2 ? (
                <label className="cursor-pointer flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-800/70 transition px-3 py-2.5">
                  <FileText size={18} className="text-slate-300 shrink-0" />
                  <span className="text-sm text-slate-300">Importer PDF/image</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={onFile2Change} />
                </label>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5">
                  {filePreviewUrl2 ? (
                    <img src={filePreviewUrl2} className="h-10 w-10 object-cover rounded" />
                  ) : (
                    <FileText size={20} className="text-slate-300" />
                  )}
                  <span className="text-sm text-slate-300 flex-1 truncate">{file2.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile2(null);
                      setFilePreviewUrl2(null);
                    }}
                    className="text-slate-500 hover:text-red-400 p-1"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-500 mt-1.5">
                Pas de lecture automatique pour cette 2ᵉ facture — remplis les montants à la main.
              </p>
              {file2 && filenamePreview2 && (
                <div className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2 mt-2">
                  <p className="text-xs text-slate-500">Nom du fichier généré</p>
                  <p className="text-sm text-sky-300 font-mono break-all">{filenamePreview2}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Note (optionnel)</label>
              <input
                type="text"
                value={note2}
                onChange={(e) => setNote2(e.target.value)}
                placeholder="Ex : 2e facture du même paiement"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-sky-400"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-sky-400 text-slate-950 font-medium py-2.5 hover:bg-sky-300 transition disabled:opacity-60"
        >
          {busy ? "…" : initial ? "Enregistrer" : "Ajouter"}
        </button>
      </form>
    </div>
  );
}
