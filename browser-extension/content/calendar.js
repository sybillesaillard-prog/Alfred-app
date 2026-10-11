// Deux boutons flottants sur Google Calendar :
//  - "+ Tâche Alfred"  : crée une tâche à partir de l'évènement ouvert.
//  - "↻ Reprogrammer"  : crée une tâche "Reprogrammer RDV : …" liée au
//    premier rendez-vous, pour se souvenir de reprendre date plus tard
//    (Alfred n'a pas de calendrier propre — c'est délibérément une TÂCHE,
//    au même titre que les autres, qui apparaît dans la liste "Tâches").
//
// Comme pour Gmail, pas d'injection dans l'UI native de Calendar (structure
// interne non-documentée et changeante) : détection de l'évènement ouvert
// par lecture du contenu de la boîte de dialogue visible, en best-effort —
// tout reste éditable dans le formulaire avant validation, donc une
// détection imparfaite n'empêche jamais de créer la tâche.
(function () {
  function getDialog() {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    return dialogs.find((d) => d.innerText && d.innerText.trim().length > 0) || null;
  }

  function scrapeEvent() {
    const dialog = getDialog();
    if (!dialog) return null;
    const lines = (dialog.innerText || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) return null;
    const title = lines[0];
    const details = lines.slice(1, 4).join(" · ");
    let link = location.href;
    const eidLink = dialog.querySelector('a[href*="eid="]');
    if (eidLink && eidLink.href) link = eidLink.href;
    return { title, details, link };
  }

  function buildCreatePrefill() {
    const ev = scrapeEvent();
    if (!ev) return { title: "", category: "perso", note: "", link: location.href };
    return {
      title: ev.title,
      category: "perso",
      note: ev.details || "",
      link: ev.link,
    };
  }

  function buildReschedulePrefill() {
    const ev = scrapeEvent();
    if (!ev) {
      return { title: "Reprogrammer un rendez-vous", category: "perso", note: "", link: location.href, priority: "normale" };
    }
    return {
      title: `Reprogrammer : ${ev.title}`,
      category: "perso",
      note: ev.details ? `RDV initial : ${ev.details}` : "",
      link: ev.link,
      priority: "normale",
    };
  }

  function mount() {
    const shadow = window.AlfredExt.ensureShadowRoot();
    if (shadow.querySelector(".fab-stack")) return;
    const stack = document.createElement("div");
    stack.className = "fab-stack";

    const rescheduleFab = window.AlfredExt.makeFab({
      label: "Reprogrammer",
      icon: window.AlfredExt.iconRepeat(),
      secondary: true,
      onClick: () => {
        const ev = scrapeEvent();
        window.AlfredExt.createTaskFromModal({
          heading: "Se souvenir de reprogrammer",
          sourceLabel: ev ? "Depuis ce rendez-vous" : "Aucun rendez-vous détecté — ouvre un évènement d'abord, ou remplis à la main",
          prefill: buildReschedulePrefill(),
        });
      },
    });

    const createFab = window.AlfredExt.makeFab({
      label: "Tâche Alfred",
      icon: window.AlfredExt.iconPlus(),
      onClick: () => {
        const ev = scrapeEvent();
        window.AlfredExt.createTaskFromModal({
          heading: "Nouvelle tâche Alfred",
          sourceLabel: ev ? "Depuis ce rendez-vous" : "Depuis Google Calendar",
          prefill: buildCreatePrefill(),
        });
      },
    });

    stack.appendChild(rescheduleFab);
    stack.appendChild(createFab);
    shadow.appendChild(stack);
  }

  // Même logique que Gmail (cf. content/gmail.js) : Calendar met un moment
  // à finir de se construire, donc on retente le montage pendant quelques
  // secondes plutôt que de dépendre d'un seul instant précis.
  let tries = 0;
  const timer = setInterval(() => {
    mount();
    tries++;
    if (tries > 20) clearInterval(timer);
  }, 1000);
  mount();
})();
