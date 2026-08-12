"use client";

import { useActionState } from "react";
import { connexionAction } from "./actions";
import { SceauAtlas } from "@/components/atlas/MarqueAtlas";
import { colors, font, libelleCaps } from "@/lib/design-tokens";

/**
 * La porte d'Atlas — refaite le 12 août 2026, à sa demande.
 *
 * **Pourquoi cet écran était le dernier à l'ancienne identité**, et ce n'est pas
 * un oubli de paresse : c'est le SEUL écran qu'on voit *avant* d'être connecté.
 * Chaque refonte s'est faite en parcourant l'application, donc en partant d'un
 * écran déjà franchi. La porte ne fait pas partie du couloir. Il a donc gardé
 * jusqu'ici le terre cuite `#B5502F` abandonné le 3 août, une carte blanche et
 * aucune serif.
 *
 * **Le chemin, en trois maquettes** (`docs/maquettes/`) :
 *   · 32 — l'avant et quatre après ; il retient la ligne d'imprimé, *sans* le
 *     titre « Connexion » ni la sous-ligne, avec le sceau et ATLAS au-dessus ;
 *   · 33 — six animations de la marque à l'entrée ; il retient **le tour** ;
 *   · 34 — huit gravures dans le rond d'or ; il retient **la rose des vents**.
 *
 * **Trois corrections partaient avec n'importe quel choix**, et sont ici :
 *   1. les champs passent de 15 à **16 px** — en dessous, iOS agrandit la page
 *      dès qu'un champ prend le focus, et il devait la rétablir à la main ;
 *   2. le refus quitte le rouge vif de bibliothèque (`text-red-600`) pour le
 *      `colors.alert` de la charte ;
 *   3. la place du message est **réservée en permanence**, sinon le bouton
 *      descend d'une ligne au moment précis où le doigt se pose dessus.
 *
 * **Ce qui ne doit pas changer sans regarder ailleurs :** `name="email"`,
 * `name="password"` et `type="submit"`. Vingt scripts de capture et
 * `scripts/verifier-connexion.mjs` — le seul contrôle qui éprouve une vraie
 * connexion derrière une origine étrangère — passent par ces trois-là.
 *
 * **Et le bouton reste écrit à la main** : `PrimaryButton` impose
 * `type="button"`, ce qui casserait l'envoi du formulaire en silence. Seule sa
 * FORME est partagée, et `scripts/test-boutons-arrondis.ts` la garde.
 */
export default function LoginPage() {
  const [etat, action, enCours] = useActionState(connexionAction, undefined);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6 py-10"
      style={{ backgroundColor: colors.cream, color: colors.ink }}
    >
      <form action={action} className="w-full max-w-[342px] text-center">
        {/* Le sceau tourne tant que la vérification n'a pas répondu — pas
            pendant une demi-seconde décomptée. Voir `globals.css`,
            « La porte : le sceau qui tourne pendant qu'on vérifie ». */}
        <SceauAtlas
          taille={60}
          motif="rose"
          className={`mx-auto mb-4${enCours ? " atlas-sceau-en-marche" : ""}`}
        />
        <span
          className="mb-8 block text-[21px] leading-none"
          style={{ fontFamily: font.display, letterSpacing: "0.3em" }}
        >
          ATLAS
        </span>

        <label
          htmlFor="email"
          className={`${libelleCaps} mb-2 block text-left`}
          style={{ color: colors.muted }}
        >
          Adresse
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="atlas-champ-ligne mb-[22px] text-left"
        />

        <label
          htmlFor="password"
          className={`${libelleCaps} mb-2 block text-left`}
          style={{ color: colors.muted }}
        >
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="atlas-champ-ligne mb-[22px] text-left"
        />

        {/* La hauteur est réservée qu'il y ait un refus ou non : un message qui
            apparaît pousse le bouton d'une ligne, et l'appui suivant tombe à
            côté. Même soin que sur l'écran de création. */}
        <p
          className="mb-3 min-h-[19px] text-[13px] leading-[19px]"
          style={{ color: colors.alert }}
          role="alert"
          aria-live="polite"
        >
          {etat?.erreur ?? ""}
        </p>

        <button
          type="submit"
          disabled={enCours}
          className="inline-flex items-center justify-center rounded-full px-9 py-[13px] text-[17px] transition-transform active:scale-[0.985] disabled:opacity-60"
          style={{ backgroundColor: colors.rust, color: colors.card, fontFamily: font.display }}
        >
          Entrer
        </button>
      </form>
    </div>
  );
}
