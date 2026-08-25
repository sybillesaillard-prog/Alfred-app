// Analyse par IA (API Claude d'Anthropic) des mails récupérés par
// mailboxAuth.js pour repérer ceux qui attendent une action de la part de
// Sybille — cadré avec elle le 25/08/2026 (cf. claude/app-alfred-notes.md) :
// détection par lecture IA plutôt que par règles/mots-clés, pour juger
// correctement le SENS d'un mail (pas juste des motifs de surface).
//
// ⚠️ La clé API est saisie une fois dans les réglages de la page (jamais
// dans le code), et stockée dans `localStorage` du navigateur — donc propre
// à cet appareil (à ressaisir sur un autre appareil), jamais envoyée à
// personne d'autre qu'à l'API Anthropic elle-même. Comme pour les jetons
// Google déjà stockés côté navigateur ailleurs dans l'app, toute personne
// ayant accès physique à ce PC/navigateur pourrait la lire — seul risque
// réel : quelqu'un pourrait consommer du crédit API en son nom, pas accéder
// à ses mails (l'appel Claude ne reçoit QUE le texte des mails déjà
// récupéré, jamais un accès direct à Gmail).
//
// Appel direct depuis le navigateur (pas de serveur intermédiaire) grâce à
// l'en-tête "anthropic-dangerous-direct-browser-access" qu'Anthropic a
// ajouté spécifiquement pour permettre ça (cf. recherche du 25/08/2026) —
// cohérent avec le reste de l'appli, déjà 100% client-side (Firebase,
// Google APIs).
const API_KEY_STORAGE = "alfred_claude_api_key";
const MODEL_STORAGE = "alfred_claude_model";

// Haiku 4.5 par défaut : largement suffisant pour ce tri (pas besoin de
// raisonnement poussé) et environ 2x moins cher que Sonnet à l'usage — coût
// estimé le 25/08/2026 avec Sybille : de l'ordre de 1 centime/jour pour une
// vingtaine de mails/jour/boîte sur 2 boîtes, donc largement sous 1€/mois
// même avec un usage plus intense.
export const CLAUDE_MODELS = {
  haiku: { id: "claude-haiku-4-5-20251001", label: "Haiku (rapide, recommandé)" },
  sonnet: { id: "claude-sonnet-5", label: "Sonnet (plus précis, plus cher)" },
};

export function getClaudeApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

export function setClaudeApiKey(key) {
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE, key);
    else localStorage.removeItem(API_KEY_STORAGE);
  } catch {
    // localStorage indisponible — tant pis, à ressaisir à chaque session.
  }
}

export function getClaudeModelKey() {
  try {
    const stored = localStorage.getItem(MODEL_STORAGE);
    return stored && CLAUDE_MODELS[stored] ? stored : "haiku";
  } catch {
    return "haiku";
  }
}

export function setClaudeModelKey(key) {
  try {
    localStorage.setItem(MODEL_STORAGE, CLAUDE_MODELS[key] ? key : "haiku");
  } catch {
    // ignore
  }
}

// --- Compteur de consommation (25/08/2026, demande de Sybille) ----------
// L'API Anthropic ne fournit pas d'endpoit accessible depuis une simple clé
// API pour lire le VRAI solde restant de son compte (ça nécessite un accès
// "Admin"/organisation séparé, pas la clé API classique utilisée ici) — donc
// pas de "combien il reste" fiable à 100 %. Ce qu'on peut faire, et qui
// couvre le besoin en pratique : additionner localement, à chaque appel, les
// tokens réellement consommés (renvoyés par l'API elle-même dans sa
// réponse — champ `usage`) et en déduire un coût estimé avec les tarifs
// publics du modèle utilisé. Si Sybille renseigne en plus le montant de
// crédit qu'elle a acheté sur la Console Anthropic, on peut alors afficher
// une estimation de crédit restant (= crédit initial - coût cumulé estimé
// ici) — une estimation propre à CET appareil/navigateur (elle ne verra pas
// une consommation faite ailleurs avec la même clé, le cas échéant).
const USAGE_STORAGE = "alfred_claude_usage";
const CREDIT_STORAGE = "alfred_claude_credit_usd";

// Tarifs publics par million de tokens, en dollars (vérifiés le 25/08/2026,
// cf. claude/app-alfred-notes.md — à mettre à jour si Anthropic change ses
// prix). Sert uniquement à l'ESTIMATION du compteur ci-dessous, jamais à la
// facturation réelle (qui se fait directement entre Sybille et Anthropic).
const PRICING_USD_PER_MTOK = {
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-sonnet-5": { input: 2, output: 10 },
};

export function getUsageStats() {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE);
    if (!raw) return { inputTokens: 0, outputTokens: 0, costUSD: 0 };
    const parsed = JSON.parse(raw);
    return {
      inputTokens: parsed.inputTokens || 0,
      outputTokens: parsed.outputTokens || 0,
      costUSD: parsed.costUSD || 0,
    };
  } catch {
    return { inputTokens: 0, outputTokens: 0, costUSD: 0 };
  }
}

export function resetUsageStats() {
  try {
    localStorage.removeItem(USAGE_STORAGE);
  } catch {
    // ignore
  }
}

function recordUsage(modelId, usage) {
  if (!usage) return;
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const pricing = PRICING_USD_PER_MTOK[modelId];
  const cost = pricing
    ? (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
    : 0;
  try {
    const prev = getUsageStats();
    localStorage.setItem(
      USAGE_STORAGE,
      JSON.stringify({
        inputTokens: prev.inputTokens + inputTokens,
        outputTokens: prev.outputTokens + outputTokens,
        costUSD: prev.costUSD + cost,
      })
    );
  } catch {
    // ignore
  }
}

// Crédit initial (en $) que Sybille a acheté sur la Console Anthropic,
// saisi une fois dans les réglages — sert uniquement à calculer le "reste
// estimé" affiché ; `null` si jamais renseigné (affichage se limite alors
// à la consommation, sans estimation de reste).
export function getCreditBalanceUSD() {
  try {
    const raw = localStorage.getItem(CREDIT_STORAGE);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function setCreditBalanceUSD(amount) {
  try {
    if (amount === null || amount === "" || Number.isNaN(Number(amount))) {
      localStorage.removeItem(CREDIT_STORAGE);
    } else {
      localStorage.setItem(CREDIT_STORAGE, String(Number(amount)));
    }
  } catch {
    // ignore
  }
}

// Tronque l'aperçu envoyé à l'IA — un `snippet` Gmail fait déjà ~100-200
// caractères, cette limite est surtout une garde-fou si jamais un champ
// anormalement long passait au travers.
const SNIPPET_MAX_CHARS = 300;

function buildPrompt(mailboxLabel, category, messages) {
  const items = messages.map((m) => ({
    id: m.id,
    de: m.from,
    objet: m.subject,
    apercu: (m.snippet || "").slice(0, SNIPPET_MAX_CHARS),
  }));
  const contexte =
    category === "pro"
      ? "une boîte mail PROFESSIONNELLE (elle est cheffe d'entreprise dans le BTP)"
      : "une boîte mail PERSONNELLE";
  return `Voici une liste de mails reçus par Sybille sur ${mailboxLabel}, ${contexte}. Pour CHAQUE mail de la liste (identifié par son "id"), indique s'il nécessite une VRAIE action concrète de sa part : répondre à quelqu'un qui attend une réponse, payer quelque chose, remplir/signer un document, prendre rendez-vous, rappeler quelqu'un, etc.

Compte AUSSI comme une action à faire : un message écrit personnellement par une vraie personne identifiable (ex. son assureur, un client, un artisan, un contact professionnel ou personnel nommé) qui semble être le dernier échange d'une conversation avec elle, MÊME si le message ne pose pas explicitement une question et ressemble plutôt à une mise à jour ou une "confirmation" de sa part (ex. un agent d'assurance qui confirme les conditions d'un contrat, un artisan qui donne un chiffrage) — dans ce cas, penche vers "action nécessaire" (ex. "Relire/valider les conditions envoyées par l'assureur"), sauf si l'aperçu indique clairement qu'elle a déjà répondu ou que le sujet est clos.

Ne compte PAS comme une action à faire : les newsletters, les mails purement informatifs, les accusés de réception AUTOMATIQUES (générés par un système, pas écrits par une personne), les confirmations AUTOMATIQUES de commande/livraison/paiement déjà effectué (ex. reçu de paiement, notification d'expédition), les notifications de réseaux sociaux, la publicité, les mails où elle est juste en copie sans qu'on lui demande quelque chose directement, ainsi que les invitations/communications envoyées à une liste de diffusion ou un groupe (ex. "Chers Elus", "Mesdames Messieurs") plutôt qu'adressées nommément à elle seule.

EXCEPTION à cette dernière règle (liste de diffusion) : les mails provenant d'une adresse en @cciamp.com (la Chambre de Commerce et d'Industrie Aix-Marseille-Provence, où Sybille est élue) NE sont PAS à exclure automatiquement au seul motif qu'ils sont adressés à "Chers Elus" ou à un groupe — ce sont de vrais contacts professionnels de Sybille. Pour ces mails-là, juge normalement s'il y a une vraie action (ex. une invitation à un événement qui appelle une réponse/RSVP ou une décision d'y participer compte comme une action — ex. "Répondre à l'invitation CCIAMP du [date]" — mais une communication purement informative sans rien à décider, comme un compte-rendu, reste à exclure).

Si tu n'es pas sûr qu'une action soit vraiment nécessaire, penche plutôt vers "pas d'action" — mieux vaut rater un cas ambigu que noyer Sybille sous de fausses tâches. Cette prudence s'applique surtout aux mails automatiques/newsletters/listes de diffusion ci-dessus (hors exception @cciamp.com) — pas aux messages personnels d'un vrai contact identifié, où le principe inverse (ci-dessus) s'applique.

Pour chaque mail qui nécessite une action, décris la tâche en une courte phrase en français, à l'impératif ou à l'infinitif (ex. "Répondre à l'assureur au sujet du sinistre", "Payer le loyer de septembre", "Rappeler M. Martin pour le devis"), assez précise pour être comprise sans redonner l'objet du mail.

Mails à analyser :
${JSON.stringify(items, null, 2)}`;
}

const RESULTS_TOOL = {
  name: "flag_actionable_emails",
  description:
    "Retourne, pour chaque mail fourni, s'il nécessite une action concrète de la part de Sybille et, si oui, une courte description de cette tâche.",
  input_schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "L'id du mail, recopié tel quel depuis la liste fournie." },
            needsAction: { type: "boolean" },
            task: {
              type: "string",
              description: "Description courte de la tâche à faire, en français — vide/absent si needsAction est false.",
            },
          },
          required: ["id", "needsAction"],
        },
      },
    },
    required: ["results"],
  },
};

// Envoie un LOT de mails en UN SEUL appel API (pas un appel par mail) —
// c'est ce qui garde le coût négligeable (cf. commentaire de coût
// plus haut). Renvoie uniquement les mails jugés actionnables, avec leur
// tâche associée : { id, task }[].
export async function analyzeMailsForTasks(mailboxLabel, category, messages) {
  if (messages.length === 0) return [];
  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    throw new Error(
      "Clé API Claude manquante — renseigne-la dans les réglages de cette page (icône ⚙️)."
    );
  }
  const modelId = CLAUDE_MODELS[getClaudeModelKey()].id;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 4096,
      tools: [RESULTS_TOOL],
      tool_choice: { type: "tool", name: "flag_actionable_emails" },
      messages: [{ role: "user", content: buildPrompt(mailboxLabel, category, messages) }],
    }),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("Clé API Claude invalide ou expirée.");
    if (res.status === 429) throw new Error("Limite de l'API Claude atteinte — réessaie dans un instant.");
    throw new Error(`L'analyse par l'IA a échoué (erreur ${res.status}).`);
  }
  const data = await res.json();
  recordUsage(modelId, data.usage);
  const toolUse = (data.content || []).find((b) => b.type === "tool_use" && b.name === "flag_actionable_emails");
  const results = toolUse?.input?.results || [];
  return results.filter((r) => r.needsAction && r.task).map((r) => ({ id: r.id, task: r.task }));
}
