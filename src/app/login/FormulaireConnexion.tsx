"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { connexionAction } from "./actions";
import { colors, font } from "@/lib/design-tokens";
import type { Fournisseur } from "@/lib/fournisseurs-connexion";
import BoutonsFournisseurs from "./BoutonsFournisseurs";
import LigneFaceId from "./LigneFaceId";

/**
 * LA PORTE — écran 3 de `appli/la-porte-en-plein-air.html`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI A CHANGÉ LE 10 SEPTEMBRE 2026, ET POURQUOI.** Le patron a rouvert la
 * planche du 8 septembre et dit : *« ça n'a rien à voir, c'est cet écran que je
 * veux »*. L'application servait encore la porte du 12 août — crème, sceau,
 * libellés au-dessus des champs. La planche, elle, porte un titre en serif,
 * Google, Apple, et des gélules avec le mot dedans.
 *
 * Ce qui disparaît : le sceau qui tourne, le mot ATLAS, les libellés
 * « ADRESSE » et « MOT DE PASSE ». Ce dernier point demande un `aria-label` sur
 * chaque champ — un texte d'invite s'efface dès la première frappe, et un
 * lecteur d'écran n'annoncerait plus rien.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI NE DOIT PAS CHANGER SANS REGARDER AILLEURS :** `name="email"`,
 * `name="password"`, `type="submit"`, et la place réservée du refus. Vingt
 * scripts de capture, `scripts/test-porte-e2e.ts` et
 * `scripts/verifier-connexion.mjs` — le seul contrôle qui éprouve une vraie
 * connexion derrière une origine étrangère — passent par ces quatre-là.
 *
 * **Le bouton reste écrit à la main** : `PrimaryButton` impose `type="button"`,
 * ce qui casserait l'envoi du formulaire en silence.
 */
export default function FormulaireConnexion({ fournisseurs }: { fournisseurs: Fournisseur[] }) {
  const [etat, action, enCours] = useActionState(connexionAction, undefined);

  /**
   * **L'adresse survit à un refus, et il a fallu la regarder pour le voir.**
   *
   * React vide de lui-même les champs non contrôlés d'un `<form action={…}>`
   * après chaque envoi. Sur un mot de passe faux, l'écran répondait donc
   * « Email ou mot de passe incorrect » **et effaçait l'adresse** : il fallait
   * la retaper entièrement, sur un téléphone, pour un caractère raté sur le mot
   * de passe.
   *
   * Ce qui tient, c'est de se servir de la remise à zéro au lieu de lutter
   * contre elle : `reset()` ne vide pas un champ, il le ramène à sa valeur PAR
   * DÉFAUT. En gardant celle-ci à jour à chaque frappe, l'effacement restitue
   * exactement ce qu'il venait de taper. La propriété du DOM est écrite à la
   * main parce que React ne pose `defaultValue` qu'au MONTAGE, et `cle` remonte
   * le champ à chaque envoi — ce qui rend la réparation indifférente à l'ORDRE
   * des opérations de React, ce qui manquait aux essais précédents.
   *
   * **Le mot de passe, lui, reste effacé** — c'est celui qu'on vient de rater.
   */
  const [adresse, setAdresse] = useState("");
  const [cle, setCle] = useState(0);

  return (
    <form
      action={action}
      onSubmit={() => setCle((n) => n + 1)}
      className="flex w-full max-w-[342px] flex-1 flex-col self-center"
    >
      {/* Le chevron du retour montre un SENS : ce n'est pas une flèche
          décorative au bout d'un libellé (`CLAUDE.md` §3). Sans lui,
          `/bienvenue` est un aller simple pour qui découvre qu'il n'a pas de
          compte — le bouton « précédent » n'existe pas sur un écran installé. */}
      <Link
        href="/bienvenue"
        className="flex flex-shrink-0 items-center gap-[6px] self-start py-2 pr-[10px] pt-[10px] text-[14px]"
        style={{ color: colors.muted }}
        aria-label="Revenir en arrière"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5 8 12l7 7" />
        </svg>
        Retour
      </Link>

      {/* **LE VIDE VA SOUS « ENTRER », PAS AU MILIEU — 11 septembre 2026.**

          Première version fausse, et c'est lui qui l'a redressé, sa maquette en
          photo : *« c'est ça que je veux »*. J'avais lu « aère » comme « étire
          le bloc », et posé trois parts de vide qui écartaient « Entrer » des
          champs de cent pixels. Sur sa planche, « Entrer » est **collé sous le
          mot de passe** — c'est le même geste, on le lit d'un trait — et tout
          le vide est DESSOUS.

          Les écarts ci-dessous sont relevés sur sa planche (390 × 664) :
          32 au-dessus du titre, 21 dessous, 28 de part et d'autre du « ou »,
          24 sous Face ID, 23 entre les champs. Rien n'est inventé.

          Une seule part flexible reste, **après le bouton** : c'est elle qui
          absorbe toute la place libre et tient le pied en bas, quelle que soit
          la hauteur de l'écran. */}
      <div className="h-[32px] flex-none" aria-hidden="true" />

      <h1
        className="mb-[21px] text-center text-[34px] leading-[1.1]"
        style={{ ...({ fontFamily: "ui-serif, Georgia, serif" } as const), letterSpacing: "-0.01em" }}
      >
        Connexion
      </h1>

      {/* Ni l'un ni l'autre ne s'affiche s'il ne peut pas aboutir : Google et
          Apple tant que leurs clés ne sont pas posées, Face ID tant que
          l'appareil ne sait pas le faire. */}
      <BoutonsFournisseurs fournisseurs={fournisseurs} />
      <LigneFaceId />

      <input
        key={cle}
        id="email"
        name="email"
        type="email"
        required
        placeholder="Adresse"
        aria-label="Adresse"
        autoComplete="username"
        ref={(champ) => {
          if (champ) champ.defaultValue = adresse;
        }}
        onChange={(e) => setAdresse(e.target.value)}
        className="atlas-champ-gelule mb-[23px]"
      />

      <input
        id="password"
        name="password"
        type="password"
        required
        placeholder="Mot de passe"
        aria-label="Mot de passe"
        autoComplete="current-password"
        className="atlas-champ-gelule"
      />

      {/* La hauteur est réservée qu'il y ait un refus ou non : un message qui
          apparaît pousse le bouton d'une ligne, et l'appui suivant tombe à
          côté. `test-porte-e2e.ts` exige au moins 15 px. */}
      <p
        className="mb-[6px] mt-[8px] min-h-[19px] text-[13px] leading-[19px]"
        style={{ color: colors.alert }}
        role="alert"
        aria-live="polite"
      >
        {etat?.erreur ?? ""}
      </p>

      <button
        type="submit"
        disabled={enCours}
        className="atlas-plein w-full rounded-full py-[18px] text-[17px] transition-transform active:scale-[0.985] disabled:opacity-60"
        /**
         * **Le dégradé de la planche, en jetons.** Elle va du crème au doré
         * (#e9e8de → #d9cba8) ; la seconde valeur n'existe dans aucune charte,
         * et la recopier en ferait une neuvième. On mélange donc l'or à
         * l'aplat des boutons — 35 % tombe sur sa teinte, et suit la charte.
         *
         * `backgroundColor` reste posé DESSOUS : un navigateur qui ignore
         * `color-mix` garde un bouton plein, jamais un bouton transparent.
         */
        style={{
          backgroundColor: colors.plein,
          backgroundImage: `linear-gradient(100deg, ${colors.plein}, color-mix(in srgb, ${colors.or} 35%, ${colors.plein}))`,
          color: colors.card,
          fontFamily: font.display,
        }}
      >
        {enCours ? "Ouverture…" : "Entrer"}
      </button>

      <div className="min-h-[24px] flex-1" aria-hidden="true" />

      <div className="pb-[6px] text-center">
        <Link href="/creer-un-compte" className="inline-block py-[10px] text-[13.5px]" style={{ color: colors.muted }}>
          Pas de compte&nbsp;? <b style={{ color: colors.or, fontWeight: 600 }}>Créer un compte</b>
        </Link>
      </div>
    </form>
  );
}
