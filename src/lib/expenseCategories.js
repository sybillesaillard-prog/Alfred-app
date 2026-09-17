export const EXPENSE_CATEGORIES = [
  { id: "fournitures", label: "Fournitures", color: "#38bdf8" },
  { id: "deplacements", label: "Déplacements", color: "#a78bfa" },
  { id: "repas", label: "Repas & réceptions", color: "#f472b6" },
  { id: "logiciels", label: "Logiciels & abonnements", color: "#34d399" },
  { id: "marketing", label: "Marketing", color: "#fbbf24" },
  { id: "services", label: "Services pro (compta, juridique…)", color: "#fb923c" },
  // Ajoutée le 18/09 à la demande de Sybille — taux de TVA par défaut à 0 %
  // (facture de sous-traitant souvent en franchise de TVA/autoliquidation),
  // appliqué automatiquement à la sélection de cette catégorie dans
  // ExpenseForm.jsx (reste modifiable comme n'importe quel taux si besoin).
  { id: "soustraitance", label: "Sous-traitance", color: "#f87171" },
  { id: "materiel", label: "Matériel & équipement", color: "#60a5fa" },
  { id: "autre", label: "Autre", color: "#94a3b8" },
];

export function categoryInfo(id) {
  return (
    EXPENSE_CATEGORIES.find((c) => c.id === id) ||
    EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
  );
}
