// Partagé entre content/gmail.js et content/calendar.js (chargé avant eux,
// cf. manifest.json). Pas de import/export ici : les content scripts
// déclarés dans le manifest sont de simples scripts classiques, donc tout
// passe par l'espace de noms global window.AlfredExt pour ne pas polluer la
// page hôte (Gmail/Calendar) avec des variables globales.
(function () {
  const STYLE = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }

    .fab-stack {
      position: fixed;
      right: 20px;
      bottom: 24px;
      z-index: 2147483000;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
    }
    .fab {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #38bdf8;
      color: #0f172a;
      border: none;
      border-radius: 999px;
      padding: 10px 16px 10px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35);
      transition: transform 0.1s ease, background 0.15s ease;
    }
    .fab:hover { background: #7dd3fc; transform: translateY(-1px); }
    .fab.secondary { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; }
    .fab.secondary:hover { background: #27364a; }
    .fab svg { flex-shrink: 0; }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 2147483600;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .modal {
      width: 100%;
      max-width: 420px;
      max-height: 90vh;
      overflow-y: auto;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 20px;
      color: #f1f5f9;
    }
    .modal h2 { margin: 0 0 14px; font-size: 17px; font-weight: 600; }
    .field { margin-bottom: 12px; }
    .field label { display: block; font-size: 12.5px; color: #94a3b8; margin-bottom: 4px; }
    .field input[type="text"],
    .field input[type="date"],
    .field textarea,
    .field select {
      width: 100%;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 8px 10px;
      color: #f1f5f9;
      font-size: 13.5px;
      outline: none;
    }
    .field input:focus, .field textarea:focus, .field select:focus { border-color: #38bdf8; }
    .field textarea { resize: vertical; min-height: 54px; }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .seg { display: flex; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 3px; }
    .seg button {
      flex: 1; border: none; background: transparent; color: #94a3b8;
      border-radius: 6px; padding: 6px 0; font-size: 13px; cursor: pointer;
    }
    .seg button.active { background: #38bdf8; color: #0f172a; font-weight: 600; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    .btn { border: none; border-radius: 8px; padding: 9px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .btn.primary { background: #38bdf8; color: #0f172a; }
    .btn.primary:disabled { opacity: 0.5; cursor: default; }
    .btn.ghost { background: transparent; color: #94a3b8; }
    .btn.ghost:hover { color: #e2e8f0; }
    .error { color: #f87171; font-size: 12.5px; margin-top: 6px; min-height: 15px; }

    .toast {
      position: fixed; right: 20px; bottom: 110px; z-index: 2147483600;
      background: #0f172a; border: 1px solid #1e293b; color: #f1f5f9;
      padding: 10px 14px; border-radius: 10px; font-size: 13px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35);
      display: flex; align-items: center; gap: 8px;
      max-width: 320px;
    }
    .toast.ok { border-color: #16a34a; }
    .toast.err { border-color: #dc2626; }
  `;

  function ensureShadowRoot() {
    let host = document.getElementById("alfred-ext-host");
    if (host && host.shadowRoot) return host.shadowRoot;
    host = document.createElement("div");
    host.id = "alfred-ext-host";
    (document.body || document.documentElement).appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    shadow.appendChild(style);
    return shadow;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "text") node.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const child of children || []) node.appendChild(child);
    return node;
  }

  function toast(message, ok) {
    const shadow = ensureShadowRoot();
    const node = el("div", { class: `toast ${ok ? "ok" : "err"}`, text: message });
    shadow.appendChild(node);
    setTimeout(() => node.remove(), 3800);
  }

  // fields: { title, category, subcategory, priority, dueDate, note, link }
  // Renvoie une Promise résolue avec les données saisies, ou rejetée (annulé)
  // si l'utilisateur ferme la fenêtre sans valider.
  function openTaskModal({ heading, prefill, sourceLabel }) {
    const shadow = ensureShadowRoot();
    return new Promise((resolve, reject) => {
      const state = {
        title: prefill?.title || "",
        category: prefill?.category === "pro" ? "pro" : "perso",
        priority: prefill?.priority || "normale",
        dueDate: prefill?.dueDate || "",
        note: prefill?.note || "",
      };

      const titleInput = el("input", { type: "text", value: state.title, placeholder: "Ex : Rappeler M. Martin" });
      const noteInput = el("textarea", { placeholder: "Détails, contexte…" });
      noteInput.value = state.note;
      const dueInput = el("input", { type: "date", value: state.dueDate });
      const errorBox = el("div", { class: "error" });

      const persoBtn = el("button", { type: "button", text: "Perso" });
      const proBtn = el("button", { type: "button", text: "Pro" });
      function paintCategory() {
        persoBtn.className = state.category === "perso" ? "active" : "";
        proBtn.className = state.category === "pro" ? "active" : "";
      }
      persoBtn.addEventListener("click", () => { state.category = "perso"; paintCategory(); });
      proBtn.addEventListener("click", () => { state.category = "pro"; paintCategory(); });
      paintCategory();
      const categorySeg = el("div", { class: "seg" }, [persoBtn, proBtn]);

      const prioritySelect = el("select", {}, ["basse", "normale", "haute"].map((p) =>
        el("option", { value: p, text: p.charAt(0).toUpperCase() + p.slice(1), ...(p === state.priority ? { selected: "selected" } : {}) })
      ));

      const submitBtn = el("button", { class: "btn primary", type: "submit", text: "Créer dans Alfred" });
      const cancelBtn = el("button", { class: "btn ghost", type: "button", text: "Annuler" });

      const form = el("form", {}, [
        el("h2", { text: heading }),
        sourceLabel ? el("div", { class: "field" }, [el("label", { text: "Source" }), el("div", { style: "color:#64748b;font-size:12.5px", text: sourceLabel })]) : null,
        el("div", { class: "field" }, [el("label", { text: "Titre" }), titleInput]),
        el("div", { class: "row2" }, [
          el("div", { class: "field" }, [el("label", { text: "Catégorie" }), categorySeg]),
          el("div", { class: "field" }, [el("label", { text: "Priorité" }), prioritySelect]),
        ]),
        el("div", { class: "field" }, [el("label", { text: "Échéance (optionnel)" }), dueInput]),
        el("div", { class: "field" }, [el("label", { text: "Notes" }), noteInput]),
        errorBox,
        el("div", { class: "actions" }, [cancelBtn, submitBtn]),
      ].filter(Boolean));

      const overlay = el("div", { class: "overlay" }, [el("div", { class: "modal" }, [form])]);

      function close() {
        overlay.remove();
      }
      overlay.addEventListener("click", (e) => { if (e.target === overlay) { close(); reject(new Error("cancelled")); } });
      cancelBtn.addEventListener("click", () => { close(); reject(new Error("cancelled")); });

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = titleInput.value.trim();
        if (!title) {
          errorBox.textContent = "Le titre est obligatoire.";
          return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = "…";
        resolve({
          title,
          category: state.category,
          priority: prioritySelect.value,
          dueDate: dueInput.value || null,
          note: noteInput.value.trim() || null,
          link: prefill?.link || null,
          _close: close,
          _fail: (msg) => {
            submitBtn.disabled = false;
            submitBtn.textContent = "Créer dans Alfred";
            errorBox.textContent = msg;
          },
        });
      });

      shadow.appendChild(overlay);
      titleInput.focus();
    });
  }

  function createTaskFromModal(opts) {
    return openTaskModal(opts).then((data) => {
      const { _close, _fail, ...payload } = data;
      chrome.runtime.sendMessage({ type: "CREATE_TASK", payload }, (resp) => {
        if (chrome.runtime.lastError) {
          _fail(chrome.runtime.lastError.message || "Erreur de communication avec l'extension.");
          return;
        }
        if (!resp?.ok) {
          _fail(resp?.error || "Échec de la création.");
          return;
        }
        _close();
        toast(`Tâche créée dans Alfred : "${payload.title}"`, true);
      });
    }).catch(() => {}); // annulation silencieuse
  }

  function iconPlus() {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
  }
  function iconRepeat() {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
  }

  function makeFab({ label, icon, secondary, onClick }) {
    const btn = document.createElement("button");
    btn.className = "fab" + (secondary ? " secondary" : "");
    btn.innerHTML = `${icon}<span>${label}</span>`;
    btn.addEventListener("click", onClick);
    return btn;
  }

  window.AlfredExt = { ensureShadowRoot, el, toast, openTaskModal, createTaskFromModal, iconPlus, iconRepeat, makeFab };
})();
