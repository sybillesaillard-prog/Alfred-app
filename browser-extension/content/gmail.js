// Bouton flottant "+ Tâche Alfred" sur Gmail. Volontairement PAS injecté
// dans la barre d'outils native de Gmail (ses classes sont non-documentées
// et changent régulièrement, un point d'ancrage y est fragile) : un bouton
// flottant fixe est beaucoup plus robuste aux mises à jour de Gmail, au prix
// d'être toujours visible plutôt qu'intégré dans la barre.
(function () {
  const KNOWN_MAILBOXES = {
    "sybille.saillard@gmail.com": "perso",
    "sybil.com@gmail.com": "pro",
  };

  function currentSubject() {
    const h2 = document.querySelector("h2.hP");
    if (h2 && h2.textContent.trim()) return h2.textContent.trim();
    const title = document.title || "";
    const cleaned = title.replace(/^\(\d+\)\s*/, "");
    const parts = cleaned.split(" - ");
    if (parts.length > 1) return parts[0].trim();
    return "";
  }

  function currentSender() {
    const span = document.querySelector(".gD");
    if (!span) return "";
    return span.getAttribute("email") || span.getAttribute("name") || span.textContent.trim() || "";
  }

  function currentAccountEmail() {
    const candidates = document.querySelectorAll('a[aria-label*="@"], a[href*="SignOutOptions"], div[aria-label*="@"]');
    for (const c of candidates) {
      const label = c.getAttribute("aria-label") || "";
      const match = label.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (match) return match[0];
    }
    const titleMatch = (document.title || "").match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    return titleMatch ? titleMatch[0] : "";
  }

  function isMessageOpen() {
    return !!document.querySelector("h2.hP");
  }

  function buildPrefill() {
    if (!isMessageOpen()) {
      return { title: "", category: "perso", note: "", link: "" };
    }
    const subject = currentSubject();
    const sender = currentSender();
    const account = currentAccountEmail();
    const category = KNOWN_MAILBOXES[account] || "perso";
    return {
      title: subject || "",
      category,
      note: sender ? `Mail de ${sender}` : "",
      link: location.href,
    };
  }

  function mount() {
    const shadow = window.AlfredExt.ensureShadowRoot();
    if (shadow.querySelector(".fab-stack")) return;
    const stack = document.createElement("div");
    stack.className = "fab-stack";
    const fab = window.AlfredExt.makeFab({
      label: "Tâche Alfred",
      icon: window.AlfredExt.iconPlus(),
      onClick: () => {
        const prefill = buildPrefill();
        window.AlfredExt.createTaskFromModal({
          heading: "Nouvelle tâche Alfred",
          sourceLabel: isMessageOpen() ? "Depuis cet email" : "Depuis Gmail",
          prefill,
        });
      },
    });
    stack.appendChild(fab);
    shadow.appendChild(stack);
  }

  // Gmail est une SPA lourde qui finit de se construire après le
  // chargement de la page : on retente le montage pendant quelques
  // secondes plutôt que de dépendre d'un seul instant précis. mount() est
  // sans effet s'il a déjà réussi, donc ce polling est sans risque.
  let tries = 0;
  const timer = setInterval(() => {
    mount();
    tries++;
    if (tries > 20) clearInterval(timer);
  }, 1000);
  mount();
})();
