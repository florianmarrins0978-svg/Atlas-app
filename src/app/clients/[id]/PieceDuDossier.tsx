"use client";

import { useState } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font } from "@/lib/design-tokens";
import { nomDuFichierDeLaPiece, type PieceDuClient } from "@/lib/documents-du-client";

/**
 * Une pièce du dossier d'un client, et les trois choses qu'on peut en faire.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le patron, le 21 août 2026 :** *« Alors oui, je veux pouvoir
 * l'enregistrer, mais avant que tu codes quoi que ce soit, fais-moi une
 * maquette visuelle que je voie exactement ce que tu veux me dire. »*
 *
 * Trois dosages lui ont été dessinés (`docs/maquettes/83-enregistrer-le-pdf.html`).
 * Il a retenu **la C** : un appui ouvre une feuille — Enregistrer, Ouvrir,
 * Partager.
 *
 * **Pourquoi la C plutôt que la plus courte.** La A (la vignette enregistre)
 * coûtait un geste de moins, mais décidait à sa place : ouvrir la fiche d'un
 * client pour relire un montant lui aurait téléchargé un fichier à chaque coup
 * d'œil. La question lui a été posée telle quelle — *vient-il regarder, ou
 * garder ?* — et sa réponse est celle qui ne tranche pas pour lui.
 *
 * ── LES TROIS CONDITIONS DE « ENREGISTRER », ET AUCUNE NE SUFFIT SEULE ──────
 *
 * Le défaut du 7 août 2026 — *« quand je clique sur télécharger le PDF, ça me
 * propose pas de l'enregistrer, ça ouvre juste une page de plus »* — a coûté
 * une matinée, et son remède tient à trois choses réunies :
 *
 *   1. `?telecharger=1`, qui fait poser `attachment` par le serveur ; sans lui
 *      Chrome affiche le document ;
 *   2. l'attribut `download`, qui donne son NOM au fichier ; sans lui Safari le
 *      nomme d'après la page, sans extension ;
 *   3. **pas de `target="_blank"`** ; l'onglet neuf prive Safari de sa demande
 *      d'enregistrement.
 *
 * Les trois sont ici. « Ouvrir », lui, veut exactement l'inverse : pas de
 * `?telecharger=1`, et un onglet à part pour ne pas perdre la fiche.
 */
export default function PieceDuDossier({ piece }: { piece: PieceDuClient }) {
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const nomFichier = nomDuFichierDeLaPiece(piece);
  // **Une fiche d'entretien n'est pas un fichier.** Elle se lit à l'adresse que
  // le client a reçue, et rien ne la fige en PDF : lui proposer « Enregistrer »
  // ferait descendre une page web nommée `.pdf`, que rien n'ouvrirait — le
  // défaut du 7 août, retourné. Absent vaut PDF (`documents-du-client.ts`).
  const estUnFichier = piece.format !== "page";

  async function partager() {
    setErreur(null);
    // Le partage emporte l'ADRESSE, pas le fichier : c'est ce que le téléphone
    // sait faire passer à WhatsApp, Signal ou n'importe quoi d'autre. Composer
    // une adresse absolue ici plutôt que côté serveur est sans risque — elle ne
    // sert qu'au partage, jamais au rendu, donc aucune divergence à craindre
    // entre ce que le serveur a écrit et ce que le navigateur affiche.
    const adresse = `${window.location.origin}${piece.href}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: piece.titre, url: adresse });
        setFeuilleOuverte(false);
      } catch (e) {
        // Un partage annulé n'est pas une panne : il a changé d'avis.
        if (e instanceof Error && e.name === "AbortError") return;
        setErreur(
          estUnFichier
            ? "Le partage n'a pas abouti. « Enregistrer » reste possible ci-dessus."
            : "Le partage n'a pas abouti. « Ouvrir » reste possible ci-dessus."
        );
      }
      return;
    }
    setErreur(
      estUnFichier
        ? "Le partage n'est pas disponible sur cet appareil. « Enregistrer » reste possible ci-dessus."
        : "Le partage n'est pas disponible sur cet appareil. « Ouvrir » reste possible ci-dessus."
    );
  }

  return (
    <>
      {/* **Un vrai bouton, pas un `<div>` qui écoute.** Il porte un nom lisible
          à voix haute et répond au clavier — et surtout, il annonce ce qui
          l'attend : « Ouvrir les actions » plutôt que le seul numéro, qui
          laisserait croire que l'appui ouvre le document.

          Les 64 px de haut viennent de la règle de cet écran : « un lien qu'il
          touche d'une main, dehors, parfois avec des gants ».

          ── LA PIÈCE EST UNE LIGNE DEPUIS LE 2 SEPTEMBRE 2026 ──────────────
          Retenu sur maquette. Elle était une vignette dans une colonne de
          118 px, et son numéro n'y tenait pas : « n° 2026-0031 » se coupait.
          Le registre porte maintenant toute la largeur, le numéro se lit en
          serif comme un nom de chantier, et la date se range à droite en
          chiffres alignés.

          **La pastille rouge « PDF » a disparu, et c'était la seule tache
          d'alerte de l'écran** — posée sur un document qui n'alerte rien. Ce
          qu'elle disait, l'onglet le dit mieux : la nature de la pièce EST son
          registre. `estUnFichier` continue de commander la feuille, où la
          différence a une conséquence (on n'enregistre pas une page). */}
      <button
        type="button"
        onClick={() => {
          setErreur(null);
          setFeuilleOuverte(true);
        }}
        data-atlas="piece"
        aria-label={`${piece.titre} — que faire de ce document ?`}
        className="grid min-h-[64px] w-full grid-cols-[1fr_auto_auto] items-center gap-x-[14px] py-[15px] text-left"
        style={{ borderTop: `1px solid ${colors.lineSoft}`, WebkitTapHighlightColor: "transparent" }}
      >
        <span data-atlas="piece-titre" className="block truncate text-[19px] leading-[1.15]" style={{ fontFamily: font.display }}>
          {piece.titre}
        </span>
        {/* **UNE DATE NE SE MET JAMAIS EN CAPITALES.** Écrite ici en petites
            capitales espacées, « 12 août 2026 » devenait « 12 AOÛT 2026 » : le
            mois cesse d'avoir une forme, et l'on épelle au lieu de lire. C'est
            l'argument même qui a fait repasser l'adresse en bas de casse dans
            l'en-tête — il vaut autant ici.

            Et cela cassait une règle qu'il avait payée : une seule façon
            d'écrire une date sur cet écran, en toutes lettres
            (`test-fiche-client-e2e`, qui l'a vu avant lui). */}
        <span
          className="text-[11.5px] leading-[1.5]"
          style={{ color: colors.muted, fontVariantNumeric: "tabular-nums" }}
        >
          {piece.precision ?? ""}
        </span>
        {/* Le chevron : seule affordance de navigation vers l'intérieur, et
            discret — il montre un sens, il ne décore pas (`CLAUDE.md` §3). */}
        <svg width="7" height="12" viewBox="0 0 8 14" fill="none" stroke={colors.chevron} strokeWidth="1.5" aria-hidden="true">
          <path d="M1.5 1l5 6-5 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <BottomSheet open={feuilleOuverte} onBackdropClick={() => setFeuilleOuverte(false)}>
        <p className="text-center text-[12px]" style={{ color: colors.muted }}>
          {piece.titre}
          {piece.precision ? ` · ${piece.precision}` : ""}
        </p>

        {/* **« Enregistrer » en tête, et c'est le geste qu'il est venu chercher.**
            Les trois conditions du 7 août sont réunies ici, et le pavé au-dessus
            dit pourquoi aucune ne se retire.

            **Sauf pour une fiche d'entretien**, qui n'est pas un fichier : elle
            n'a rien à enregistrer, et « Ouvrir » devient alors le geste
            principal. */}
        {estUnFichier && (
          <a
            href={`${piece.href}?telecharger=1`}
            download={nomFichier}
            onClick={() => setFeuilleOuverte(false)}
            data-atlas="piece-enregistrer"
            className="mt-4 block rounded-full py-4 text-center text-[16px] font-medium"
            style={{ backgroundColor: colors.rust, color: colors.cream }}
          >
            Enregistrer
          </a>
        )}

        {/* Un onglet à part : sans lui, regarder un devis ferait perdre la fiche
            du client, et il faudrait y revenir à la main. */}
        <a
          href={piece.href}
          target="_blank"
          rel="noreferrer"
          onClick={() => setFeuilleOuverte(false)}
          data-atlas="piece-ouvrir"
          className={
            estUnFichier
              ? "mt-2 block py-4 text-center text-[15px]"
              : "mt-4 block rounded-full py-4 text-center text-[16px] font-medium"
          }
          style={estUnFichier ? { color: colors.ink } : { backgroundColor: colors.rust, color: colors.cream }}
        >
          Ouvrir
        </a>

        {/* **« Partager » revient ici**, après avoir disparu de l'écran d'envoi
            le 21 août au matin. C'était le seul chemin vers WhatsApp, et sa
            place est plutôt sur le document rangé que sur le geste d'envoi. */}
        <button
          type="button"
          onClick={partager}
          data-atlas="piece-partager"
          className="mt-1 block w-full py-4 text-center text-[15px]"
          style={{ color: colors.ink }}
        >
          Partager
        </button>

        {erreur && (
          <p role="alert" className="mt-2 text-center text-[13px]" style={{ color: colors.rust }}>
            {erreur}
          </p>
        )}

        <button
          type="button"
          onClick={() => setFeuilleOuverte(false)}
          className="mt-2 block w-full py-3 text-center text-[14px]"
          style={{ color: colors.muted }}
        >
          Annuler
        </button>
      </BottomSheet>
    </>
  );
}
