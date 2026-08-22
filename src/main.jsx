import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

// Le service worker (mis à jour à chaque déploiement) ne rafraîchissait pas
// automatiquement une page déjà ouverte : le navigateur pouvait continuer à
// servir une ancienne version en cache pendant longtemps, obligeant à
// vider manuellement le cache après chaque mise à jour. On force un
// rechargement dès qu'un nouveau service worker prend le contrôle, et on
// pousse activement la vérification de mise à jour (au chargement et
// quand l'app redevient visible) plutôt que d'attendre le rythme par
// défaut du navigateur.
if ("serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker.ready.then((registration) => {
    registration.update();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registration.update();
    });
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
