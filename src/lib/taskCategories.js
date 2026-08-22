// Sous-catégories de départ proposées dans le formulaire de tâche, distinctes
// selon perso/pro (choix confirmé par Sybille le 21/08/2026). La liste
// affichée s'enrichit ensuite automatiquement de toute sous-catégorie déjà
// utilisée sur une autre tâche (cf. TaskForm.jsx) — pas besoin d'un écran de
// gestion séparé pour en ajouter de nouvelles au fil de l'eau.
export const SUBCATEGORIES_BY_CATEGORY = {
  perso: ["Maison", "Santé", "Famille", "Administratif"],
  pro: ["Client", "Chantier", "Administratif", "Comptabilité"],
};
