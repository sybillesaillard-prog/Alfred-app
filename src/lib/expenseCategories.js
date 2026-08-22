export const EXPENSE_CATEGORIES = [
  { id: "fournitures", label: "Fournitures", color: "#38bdf8" },
  { id: "deplacements", label: "Déplacements", color: "#a78bfa" },
  { id: "repas", label: "Repas & réceptions", color: "#f472b6" },
  { id: "logiciels", label: "Logiciels & abonnements", color: "#34d399" },
  { id: "marketing", label: "Marketing", color: "#fbbf24" },
  { id: "services", label: "Services pro (compta, juridique…)", color: "#fb923c" },
  { id: "materiel", label: "Matériel & équipement", color: "#60a5fa" },
  { id: "autre", label: "Autre", color: "#94a3b8" },
];

export function categoryInfo(id) {
  return (
    EXPENSE_CATEGORIES.find((c) => c.id === id) ||
    EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
  );
}
