"use client";

import FormulaireNouveauChantier from "./FormulaireNouveauChantier";

// La route reste, et c'est délibéré : les suites de bout en bout y vont
// directement, et un lien profond — celui d'un signet, celui d'une invitation —
// doit continuer d'ouvrir un écran entier. Depuis l'accueil, le même formulaire
// monte en feuille par-dessus la liste (`src/app/EcranChantiers.tsx`).
export default function NouveauChantierPage() {
  return <FormulaireNouveauChantier />;
}
