// Bouton "Signer & transférer" sur Gmail, pour les mails avec une pièce
// jointe PDF. S'appuie sur window.AlfredExt (content/common.js, chargé avant
// ce fichier) pour le shadow DOM / boutons / toasts, et sur window.PDFLib
// (vendor/pdf-lib.min.js, chargé avant ce fichier) pour lire et modifier le
// PDF — tout se passe dans le navigateur, rien n'est envoyé à un serveur
// (ni Alfred/Firebase, ni ailleurs) : seul Gmail lui-même voit le fichier,
// exactement comme si Sybille l'avait signé et joint à la main.
//
// 11/10 : deux signatures mémorisées séparément (pro / perso), chacune
// IMPORTÉE depuis un fichier image sur le PC (plus de pad de dessin à la
// souris — Sybille a choisi d'importer directement un fichier existant de
// sa vraie signature). Au clic sur "Signer & transférer", elle choisit
// Pro ou Perso dans une petite fenêtre avant de signer. Le clic droit sur
// le bouton ouvre la même fenêtre en mode "gestion" pour importer/remplacer
// les fichiers sans déclencher de signature.
(function () {
  const SIG_KEYS = { pro: "alfred_saved_signature_pro_png", perso: "alfred_saved_signature_perso_png" };
  const SIG_LABELS = { pro: "Pro", perso: "Perso" };

  // --- Repérer une pièce jointe PDF sur le mail actuellement ouvert --------
  //
  // Gmail pose un attribut `download_url` ("mime:nom-de-fichier:url") sur les
  // vignettes de pièces jointes du mail ouvert — un détail non documenté mais
  // stable depuis des années (de nombreuses extensions s'appuient dessus),
  // bien plus fiable qu'une classe CSS interne de Gmail qui change souvent.
  function findPdfAttachment() {
    const nodes = document.querySelectorAll("[download_url]");
    for (const node of nodes) {
      const raw = node.getAttribute("download_url") || "";
      const sep1 = raw.indexOf(":");
      const sep2 = raw.indexOf(":", sep1 + 1);
      if (sep1 === -1 || sep2 === -1) continue;
      const mime = raw.slice(0, sep1);
      const filename = raw.slice(sep1 + 1, sep2);
      const url = raw.slice(sep2 + 1);
      if (!url) continue;
      if (mime === "application/pdf" || /\.pdf$/i.test(filename)) {
        return { filename: filename || "document.pdf", url };
      }
    }
    return null;
  }

  async function fetchAttachmentBytes(url) {
    // Même origine que la page Gmail ouverte : le fetch part avec les
    // cookies de session, pas besoin de permission supplémentaire ni de
    // passer par le service worker.
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("Téléchargement de la pièce jointe impossible (" + res.status + ").");
    return new Uint8Array(await res.arrayBuffer());
  }

  function dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(",")[1] || "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // --- Mémorisation des 2 signatures (pro / perso) --------------------------
  async function getSavedSignature(slot) {
    const key = SIG_KEYS[slot];
    const stored = await chrome.storage.local.get(key);
    return stored[key] || null;
  }

  async function setSavedSignature(slot, dataUrl) {
    await chrome.storage.local.set({ [SIG_KEYS[slot]]: dataUrl });
  }

  // Ouvre le sélecteur de fichier natif du navigateur et renvoie le fichier
  // choisi — rejette (silencieusement) si Sybille annule.
  function pickImageFile() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/jpg,image/webp";
      input.style.display = "none";
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        input.remove();
        if (file) resolve(file);
        else reject(new Error("cancelled"));
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  // Redimensionne l'image importée (max 500px de côté, pour rester léger en
  // mémoire) et la convertit en PNG — garde la transparence si le fichier en
  // a une (ex. export d'une appli de signature avec fond transparent) ;
  // sinon le fond du fichier (souvent blanc) restera visible une fois posé
  // sur le PDF, à savoir pour bien choisir le fichier source.
  async function fileToSignatureDataUrl(file) {
    const bitmap = await createImageBitmap(file);
    const maxDim = 500;
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  }

  async function importSignatureFile(slot) {
    const file = await pickImageFile(); // peut lever "cancelled"
    const dataUrl = await fileToSignatureDataUrl(file);
    await setSavedSignature(slot, dataUrl);
    return dataUrl;
  }

  // --- Fenêtre de choix / gestion des signatures ----------------------------
  // mode "sign"   : un clic sur "Utiliser celle-ci" (Pro ou Perso) résout la
  //                 Promise avec la bonne dataURL, pour signer immédiatement.
  //                 Si le créneau n'a encore aucun fichier, le bouton importe
  //                 le fichier au clic sur "Importer".
  // mode "manage" : ouvert via le clic droit sur le bouton flottant — permet
  //                 juste d'importer/remplacer les 2 fichiers, sans jamais
  //                 déclencher de signature (pas de bouton "Utiliser").
  function openSignatureDialog(mode) {
    const shadow = window.AlfredExt.ensureShadowRoot();
    const { el } = window.AlfredExt;
    return new Promise((resolve, reject) => {
      const refreshers = [];

      function buildRow(slot) {
        const preview = el("div", {
          style:
            "height:54px;border:1px solid #334155;border-radius:8px;background:#1e293b;display:flex;align-items:center;justify-content:center;overflow:hidden;margin:6px 0;",
        });
        const useBtn = mode === "sign" ? el("button", { class: "btn primary", type: "button", text: "Utiliser celle-ci" }) : null;
        const importBtn = el("button", { class: "btn ghost", type: "button", text: "Importer un fichier…" });

        async function refresh() {
          const dataUrl = await getSavedSignature(slot);
          preview.innerHTML = "";
          if (dataUrl) {
            preview.appendChild(el("img", { src: dataUrl, style: "max-height:50px;max-width:100%;" }));
            importBtn.textContent = "Changer le fichier…";
          } else {
            preview.appendChild(el("span", { style: "color:#64748b;font-size:12px", text: "Aucun fichier importé" }));
            importBtn.textContent = "Importer un fichier…";
          }
          if (useBtn) useBtn.disabled = !dataUrl;
        }

        importBtn.addEventListener("click", async () => {
          importBtn.disabled = true;
          try {
            await importSignatureFile(slot);
            await refresh();
          } catch {
            // annulation du sélecteur de fichier : rien à faire
          }
          importBtn.disabled = false;
        });

        if (useBtn) {
          useBtn.addEventListener("click", async () => {
            const dataUrl = await getSavedSignature(slot);
            if (!dataUrl) return;
            close();
            resolve(dataUrl);
          });
        }

        refreshers.push(refresh);

        return el("div", { style: "margin-bottom:14px" }, [
          el("div", { style: "font-size:13px;font-weight:600;margin-bottom:2px", text: SIG_LABELS[slot] }),
          preview,
          el("div", { class: "actions", style: "justify-content:space-between;margin:0" }, [importBtn, useBtn].filter(Boolean)),
        ]);
      }

      const proRow = buildRow("pro");
      const persoRow = buildRow("perso");
      const closeBtn = el("button", { class: "btn ghost", type: "button", text: mode === "sign" ? "Annuler" : "Fermer" });

      const overlay = el("div", { class: "overlay" }, [
        el("div", { class: "modal" }, [
          el("h2", { text: mode === "sign" ? "Quelle signature utiliser ?" : "Gérer mes signatures" }),
          el("div", {
            style: "color:#64748b;font-size:12px;margin-bottom:10px",
            text:
              "Idéalement une image au fond transparent (ex. export d'une appli de signature) — sinon le fond du fichier (souvent blanc) restera visible sur le PDF.",
          }),
          proRow,
          persoRow,
          el("div", { class: "actions" }, [closeBtn]),
        ]),
      ]);

      function close() {
        overlay.remove();
      }
      closeBtn.addEventListener("click", () => {
        close();
        reject(new Error("cancelled"));
      });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          close();
          reject(new Error("cancelled"));
        }
      });

      shadow.appendChild(overlay);
      Promise.all(refreshers.map((r) => r()));
    });
  }

  // --- Appose la signature sur la dernière page du PDF ----------------------
  async function signPdfBytes(pdfBytes, signatureDataUrl) {
    const { PDFDocument } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pngImage = await pdfDoc.embedPng(dataUrlToBytes(signatureDataUrl));
    const pages = pdfDoc.getPages();
    const page = pages[pages.length - 1];
    const { width } = page.getSize();
    const sigWidth = Math.min(170, width * 0.32);
    const sigHeight = (pngImage.height / pngImage.width) * sigWidth;
    const margin = 40;
    page.drawImage(pngImage, {
      x: width - sigWidth - margin,
      y: margin,
      width: sigWidth,
      height: sigHeight,
    });
    return await pdfDoc.save();
  }

  function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  // --- Best-effort : joindre directement à un "Transférer" Gmail -----------
  // Fragile par nature (dépend de l'interface interne de Gmail, qui change de
  // temps en temps) — volontairement isolé dans sa propre fonction, qui
  // peut échouer proprement : le PDF signé est de toute façon déjà
  // téléchargé par signAndSend() avant d'en arriver là, donc rien n'est
  // jamais perdu si cette partie ne marche pas sur un Gmail mis à jour.
  function findForwardButton() {
    const candidates = document.querySelectorAll('[role="button"], span[aria-label]');
    for (const c of candidates) {
      const label = (c.getAttribute("aria-label") || c.textContent || "").trim().toLowerCase();
      if (label === "transférer" || label === "forward") return c;
    }
    return null;
  }

  function findComposeDropTarget() {
    // Zone de corps de message du compose actif le plus récent (le dernier
    // ouvert, donc celui du transfert qu'on vient de déclencher).
    const bodies = document.querySelectorAll('div[aria-label="Corps du message"], div[aria-label="Message Body"], div[g_editable="true"]');
    return bodies.length ? bodies[bodies.length - 1] : null;
  }

  function dispatchDrop(target, file) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    for (const type of ["dragenter", "dragover", "drop"]) {
      const evt = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer });
      target.dispatchEvent(evt);
    }
  }

  async function tryAttachToForward(bytes, filename) {
    const fwdBtn = findForwardButton();
    if (!fwdBtn) return false;
    fwdBtn.click();
    // Gmail construit la fenêtre de compose de façon asynchrone.
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const target = findComposeDropTarget();
      if (target) {
        const file = new File([bytes], filename, { type: "application/pdf" });
        dispatchDrop(target, file);
        return true;
      }
    }
    return false;
  }

  // --- Bouton flottant + orchestration --------------------------------------
  async function signAndSend() {
    const attachment = findPdfAttachment();
    if (!attachment) return;
    try {
      const signatureDataUrl = await openSignatureDialog("sign");
      window.AlfredExt.toast("Lecture du PDF…", true);
      const pdfBytes = await fetchAttachmentBytes(attachment.url);
      const signedBytes = await signPdfBytes(pdfBytes, signatureDataUrl);
      const signedFilename = attachment.filename.replace(/\.pdf$/i, "") + " - signé.pdf";

      // Le téléchargement est le filet de sécurité : il réussit toujours,
      // indépendamment de la suite.
      downloadBytes(signedBytes, signedFilename);

      const attached = await tryAttachToForward(signedBytes, signedFilename);
      if (attached) {
        window.AlfredExt.toast("PDF signé et joint au transfert — vérifie puis clique Envoyer.", true);
      } else {
        window.AlfredExt.toast("PDF signé téléchargé — ouvre Transférer et joins-le toi-même (le document n'a pas pu être attaché automatiquement).", true);
      }
    } catch (err) {
      if (err && err.message === "cancelled") return; // annulation silencieuse
      window.AlfredExt.toast(err.message || "Échec de la signature.", false);
    }
  }

  async function manageSignatures() {
    try {
      await openSignatureDialog("manage");
    } catch {
      // fermeture normale de la fenêtre de gestion (pas une vraie erreur)
    }
  }

  let mounted = false;
  function mount() {
    const hasPdf = !!findPdfAttachment();
    const shadow = window.AlfredExt.ensureShadowRoot();
    let stack = shadow.querySelector(".fab-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "fab-stack";
      shadow.appendChild(stack);
    }
    let signBtn = stack.querySelector(".alfred-sign-fab");
    if (hasPdf && !signBtn) {
      signBtn = window.AlfredExt.makeFab({
        label: "Signer & transférer",
        icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-7"/><path d="M14 4h6v6"/></svg>`,
        secondary: true,
        onClick: signAndSend,
      });
      signBtn.className += " alfred-sign-fab";
      signBtn.title = "Clic droit (ou garder appuyé) pour gérer tes signatures (pro/perso)";
      signBtn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        manageSignatures();
      });
      stack.insertBefore(signBtn, stack.firstChild);
    } else if (!hasPdf && signBtn) {
      signBtn.remove();
    }
    mounted = true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    mount();
    tries++;
    // Contrairement au bouton "+ Tâche" (gmail.js), celui-ci doit réagir à
    // chaque changement de mail ouvert (apparition/disparition de pièce
    // jointe PDF) — le polling continue donc sans limite de tentatives,
    // à un rythme peu coûteux.
  }, 1200);
  mount();
})();
