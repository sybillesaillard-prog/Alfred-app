export default function SetupNeeded() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-950 px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-amber-400 flex items-center justify-center text-2xl font-bold text-slate-950">
          !
        </div>
        <h1 className="text-xl font-semibold text-slate-50 mb-2">
          Configuration Firebase manquante
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Pour que l'app puisse synchroniser tes données, complète le fichier{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-200">
            .env
          </code>{" "}
          à la racine du projet avec les clés de ton projet Firebase (voir{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-200">
            GUIDE_DEMARRAGE.md
          </code>
          ), puis relance l'app.
        </p>
      </div>
    </div>
  );
}
