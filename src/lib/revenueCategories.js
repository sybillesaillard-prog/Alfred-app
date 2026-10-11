// Catégories de recettes (symétrique de expenseCategories.js, côté entrées
// d'argent plutôt que sorties) — liste volontairement courte, à étoffer si
// Sybille a besoin de plus de granularité à l'usage.
export const REVENUE_CATEGORIES = [
  { id: "honoraires", label: "Honoraires & prestations", color: "#34d399" },
  { id: "vente", label: "Vente de matériel", color: "#38bdf8" },
  { id: "autre", label: "Autre", color: "#94a3b8" },
];

export function revenueCategoryInfo(id) {
  return (
    REVENUE_CATEGORIES.find((c) => c.id === id) ||
    REVENUE_CATEGORIES[REVENUE_CATEGORIES.length - 1]
  );
}
