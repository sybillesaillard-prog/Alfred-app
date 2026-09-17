// Page "Doublons" (17/09, demande de Sybille : "il faut faire un contrôle
// des justifs en double. je suis sûre d'avoir scanné deux fois certains
// éléments. Or cela va fausser les données TVA. Comment faire ?").
//
// Règle de détection : même montant TTC + fournisseur au nom proche (voir
// src/lib/duplicates.js pour le détail et pourquoi aucune contrainte de date
// n'est nécessaire ici). Rien n'est jamais supprimé tout seul : cette page se
// contente de lister les groupes probables, avec le détail de chaque dépense
// (date, fournisseur, montants, lien vers le fichier Drive si disponible) —
// c'est Sybille qui choisit, pour chaque groupe, laquelle garder et lesquelles
// supprimer.
//
// Les groupes écartés ("Ce n'est pas un doublon, écarter") sont mémorisés
// dans Firestore (src/lib/duplicatesDismissed.js) plutôt que dans un simple
// useState — corrigé le 18/09 : Sybille avait signalé que la page "n'enregistre
// pas ce que j'ai écarté", un groupe écarté réapparaissait après un
// rechargement de page ou un changement d'onglet, faute d'être mémorisé
// ailleurs qu'en mémoire vive de la page.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, FileText, Camera, Trash2 } from "lucide-react";
import { useCollection } from "../lib/useCollection";
import { useAuth } from "../context/AuthContext";
import { categoryInfo } from "../lib/expenseCategories";
import { findDuplicateExpenses } from "../lib/duplicates";
import { getDismissedGroupKeys, setDismissedGroupKeys } from "../lib/duplicatesDismissed";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

const dateLabel = (d) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "Date inconnue";

export default function Duplicates() {
  const { user } = useAuth();
  const { items, loading, remove } = useCollection("expenses", "date");
  const [dismissed, setDismissed] = useState(() => new Set());
  const [dismissedLoaded, setDismissedLoaded] = useState(false);

  // Charge une seule fois, au montage, la liste des groupes déjà écartés par
  // Sybille lors d'une session précédente (voir le commentaire en tête de
  // fichier). Tant que ce chargement n'est pas terminé, on n'affiche rien
  // (comme pour "loading" ci-dessous) pour éviter un flash où un groupe déjà
  // écarté réapparaîtrait une fraction de seconde avant d'être re-masqué.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDismissedGroupKeys(user.uid).then((keys) => {
      if (cancelled) return;
      setDismissed(new Set(keys));
      setDismissedLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const groups = useMemo(() => findDuplicateExpenses(items), [items]);
  const visibleGroups = useMemo(
    () => groups.filter((g) => !dismissed.has(g.items.map((e) => e.id).join("-"))),
    [groups, dismissed]
  );

  const totalExtraTtc = visibleGroups.reduce((s, g) => s + g.extraTtc, 0);
  const totalExtraTva = visibleGroups.reduce((s, g) => s + g.extraTva, 0);

  const dismissGroup = (g) => {
    const key = g.items.map((e) => e.id).join("-");
    setDismissed((prev) => {
      const next = new Set(prev).add(key);
      if (user) setDismissedGroupKeys(user.uid, [...next]);
      return next;
    });
  };

  const handleDelete = (expense) => {
    const label = expense.fournisseur || expense.note || "cette dépense";
    const ok = window.confirm(
      `Supprimer définitivement "${label}" du ${dateLabel(expense.date)} (${eur.format(
        expense.ttc ?? expense.amount ?? 0
      )}) ?\n\nÇa ne touche pas au fichier sur le Drive ni sur ton PC — seulement cette écriture dans Alfred.`
    );
    if (ok) remove(expense.id);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1">Doublons</h1>
        <p className="text-slate-400 text-sm">
          Dépenses au montant identique et au fournisseur proche — probablement le même justificatif scanné
          plusieurs fois. Rien n'est supprimé automatiquement : à toi de choisir laquelle garder pour chaque
          groupe.
        </p>
      </div>

      {loading || !dismissedLoaded ? (
        <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>
      ) : visibleGroups.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
          <p className="text-slate-300 text-sm">
            {groups.length === 0
              ? "Aucun doublon probable détecté pour l'instant."
              : "Tous les groupes détectés ont été écartés."}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-4 mb-5 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-300 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-amber-200 font-medium">
                {visibleGroups.length} groupe{visibleGroups.length > 1 ? "s" : ""} de doublons probables
              </p>
              <p className="text-amber-300/80 mt-0.5">
                Si tous sont confirmés : environ {eur.format(totalExtraTtc)} de TTC et {eur.format(totalExtraTva)}{" "}
                de TVA compté{totalExtraTva > 1 ? "es" : "e"} en trop.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {visibleGroups.map((g) => {
              const key = g.items.map((e) => e.id).join("-");
              return (
                <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/60 border-b border-slate-800">
                    <p className="text-xs text-slate-400 flex items-center gap-2">
                      <span>
                        {g.items.length} occurrences · +{eur.format(g.extraTtc)} TTC en trop
                      </span>
                      {g.confidence === "élevée" ? (
                        <span className="text-emerald-300/80 bg-emerald-400/10 border border-emerald-400/20 rounded px-1.5 py-0.5">
                          rapprochées dans le temps
                        </span>
                      ) : (
                        <span className="text-amber-300/80 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5">
                          étalées sur {g.spanDays} j · peut être un abonnement payé plusieurs fois
                        </span>
                      )}
                    </p>
                    <button
                      onClick={() => dismissGroup(g)}
                      className="text-xs text-slate-500 hover:text-slate-300 transition"
                    >
                      Ce n'est pas un doublon, écarter
                    </button>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {g.items.map((e) => {
                      const cat = categoryInfo(e.category);
                      return (
                        <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                          {e.kind === "photo" ? (
                            <Camera size={15} className="text-slate-500 shrink-0" />
                          ) : (
                            <FileText size={15} className="text-slate-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-100 truncate">
                              {e.fournisseur || e.note || cat.label}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {dateLabel(e.date)} · {cat.label}
                              {e.driveViewUrl && (
                                <>
                                  {" · "}
                                  <a
                                    href={e.driveViewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-0.5"
                                  >
                                    voir le fichier <ExternalLink size={11} />
                                  </a>
                                </>
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium text-slate-100">
                              {eur.format(e.ttc ?? e.amount ?? 0)}
                            </p>
                            <p className="text-xs text-amber-300/70">TVA {eur.format(e.tva ?? 0)}</p>
                          </div>
                          <button
                            onClick={() => handleDelete(e)}
                            className="text-slate-600 hover:text-red-400 p-1.5 shrink-0"
                            title="Supprimer cette occurrence"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
