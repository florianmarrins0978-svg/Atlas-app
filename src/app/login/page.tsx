"use client";

import { useActionState, useState } from "react";
import { connexionAction } from "./actions";
import { SceauAtlas } from "@/components/atlas/MarqueAtlas";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import LigneFaceId from "./LigneFaceId";

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
 *   · 35 — l'avant et quatre après ; il retient la ligne d'imprimé, *sans* le
 *     titre « Connexion » ni la sous-ligne, avec le sceau et ATLAS au-dessus ;
 *   · 36 — six animations de la marque à l'entrée ; il retient **le tour** ;
 *   · 37 — huit gravures dans le rond d'or ; il retient **la rose des vents**.
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

  /**
   * **L'adresse survit à un refus, et il a fallu la regarder pour le voir.**
   *
   * React vide de lui-même les champs non contrôlés d'un `<form action={…}>`
   * après chaque envoi. Sur un mot de passe faux, l'écran répondait donc
   * « Email ou mot de passe incorrect » **et effaçait l'adresse** : il fallait
   * la retaper entièrement, sur un téléphone, pour un caractère raté sur le mot
   * de passe. Et s'il appuyait de nouveau sans la retaper, le navigateur lui
   * opposait un « Please fill out this field » en anglais.
   *
   * Le défaut existait avant cette refonte et n'a jamais été signalé par
   * personne : aucune suite ne se trompe deux fois de mot de passe. Il a été vu
   * sur une capture, ce qui est la troisième fois dans ce projet.
   *
   * **Le mot de passe, lui, reste effacé** — c'est celui qu'on vient de rater,
   * et le garder à l'écran n'aide personne.
   *
   * **Deux correctifs ont été essayés et rejetés par le contrôle avant celui-ci,
   * et c'est la raison qui compte :** la remise à zéro de React arrive APRÈS le
   * rendu qui suit l'action. Un champ contrôlé n'y survit pas (la propriété
   * `value` n'ayant pas changé d'un rendu à l'autre, React n'écrit rien), et
   * une remise en place dans un effet non plus (elle passe avant l'effacement).
   *
   * Ce qui tient, c'est de se servir de la remise à zéro au lieu de lutter
   * contre elle : `reset()` ne vide pas un champ, il le ramène à sa valeur
   * PAR DÉFAUT. En gardant celle-ci à jour à chaque frappe, l'effacement
   * restitue exactement ce qu'il venait de taper.
   *
   * **L'attribut `defaultValue` de React ne suffit pas non plus**, et c'est
   * pour cela qu'on écrit la propriété du DOM à la main : React ne pose cette
   * valeur qu'au MONTAGE et ignore ses changements ensuite. Une sonde l'a
   * montré — le champ portait « demo@atlas.local » à l'écran et une valeur par
   * défaut vide dessous. C'est d'être allé lire l'état réel du navigateur,
   * plutôt que de raisonner sur ce qu'il aurait dû faire, qui l'a montré.
   *
   * **Et `cle` remonte le champ à chaque envoi**, ce qui rend la réparation
   * indifférente à l'ORDRE des opérations de React — c'est ce qui manquait aux
   * essais précédents, verts sur la version bâtie et rouges en développement.
   * Un champ neuf naît avec la bonne valeur par défaut ; qu'une remise à zéro
   * arrive avant ou après ne change alors plus rien.
   */
  const [adresse, setAdresse] = useState("");
  const [cle, setCle] = useState(0);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6 py-10"
      style={{ backgroundColor: colors.cream, color: colors.ink }}
    >
      <form
        action={action}
        onSubmit={() => setCle((n) => n + 1)}
        className="w-full max-w-[342px] text-center"
      >
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

        {/* **Sa proposition B, tranchée le 24 août 2026** (planche 94,
            `appli/face-id.html`) : « ta porte d'aujourd'hui, plus une ligne
            au-dessus. Rien ne change de place. » Tout ce qui suit est
            inchangé — y compris `name="email"`, `name="password"` et
            `type="submit"`, dont vingt scripts de capture dépendent. */}
        <LigneFaceId />

        <label
          htmlFor="email"
          className={`${libelleCaps} mb-2 block text-left`}
          style={{ color: colors.muted }}
        >
          Adresse
        </label>
        <input
          key={cle}
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          ref={(champ) => {
            if (champ) champ.defaultValue = adresse;
          }}
          onChange={(e) => setAdresse(e.target.value)}
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
