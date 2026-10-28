"use client";

import { useState } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, surPlein } from "@/lib/design-tokens";
import {
  adresseOuvrirLaPiece,
  lignesDeLaPiece,
  nomDuFichierDeLaPiece,
  type PieceDuClient,
} from "@/lib/documents-du-client";
import BoutonTelechargerDocument from "@/components/atlas/BoutonTelechargerDocument";

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
 * ── « ENREGISTRER » NE PASSE PLUS PAR UN LIEN ──────────────────────────────
 *
 * Le défaut du 7 août 2026 — *« quand je clique sur télécharger le PDF, ça me
 * propose pas de l'enregistrer, ça ouvre juste une page de plus »* — revenait
 * le 12 septembre sur la facture, et pour de bon : un lien remet le fichier au
 * navigateur, et iOS PEINT un PDF au lieu de le ranger. La page récupère donc
 * le document et le remet à la feuille de partage, qui, elle, sait
 * l'enregistrer (`BoutonTelechargerDocument`, et ses raisons).
 *
 * « Ouvrir » veut exactement l'inverse : pas de
 * `?telecharger=1` — et, depuis le 11 septembre 2026, **plus d'onglet à part**
 * pour un PDF : *« j'ai pas de touche retour »*. Le fichier se peint dans la
 * visionneuse de l'application, dont la flèche ramène à cette fiche
 * (`src/lib/visionneuse-pdf.ts`). Le rapport d'entretien, qui est une page,
 * a suivi le 24 septembre 2026 : il se relit dans l'application
 * (`src/lib/rapport-dans-l-appli.ts`), jamais sur la page du client.
 */

export default function PieceDuDossier({
  piece,
  premiere = false,
  enRecherche = false,
}: {
  piece: PieceDuClient;
  /** La première pièce du registre : pas de filet, les onglets en ont déjà un. */
  premiere?: boolean;
  /** La loupe est tapée : les onglets sont partis, la ligne dit sa nature. */
  enRecherche?: boolean;
}) {
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
            ? "Le partage n'a pas abouti. « Télécharger » reste possible ci-dessus."
            : "Le partage n'a pas abouti. « Ouvrir » reste possible ci-dessus."
        );
      }
      return;
    }
    setErreur(
      estUnFichier
        ? "Le partage n'est pas disponible sur cet appareil. « Télécharger » reste possible ci-dessus."
        : "Le partage n'est pas disponible sur cet appareil. « Ouvrir » reste possible ci-dessus."
    );
  }

  // L'adresse que « Ouvrir » sert : la visionneuse pour un PDF, l'application
  // pour un rapport d'entretien. **Plus d'onglet neuf, 24 septembre 2026** :
  // il y tombait sur la page de son client, sans flèche, *« j'ai aucun moyen
  // de faire retour ! »*. La règle vit dans `documents-du-client.ts`, que
  // l'assistant emploie aussi.
  const adresseOuvrir = adresseOuvrirLaPiece(piece);
  const lignes = lignesDeLaPiece(piece);

  return (
    <>
      {/* **Un vrai bouton, pas un `<div>` qui écoute.** Il porte un nom lisible
          à voix haute et répond au clavier — et surtout, il annonce ce qui
          l'attend : « Ouvrir les actions » plutôt que le seul numéro, qui
          laisserait croire que l'appui ouvre le document.

          ── LA DATE PASSE SOUS LE NUMÉRO — 25 octobre 2026, sur sa planche ──
          Elle était à droite en 11,5 px gris. Sous le numéro, à 14 px, elle se
          lit, et le numéro prend toute la largeur : il ne se coupe jamais. Ni
          icône devant la pièce (*« les icônes à côté de devis, factures et
          fiches, tu me les enlèves »*), ni pastille : la nature de la pièce EST
          son registre. Un filet sépare deux pièces, jamais la première de ses
          onglets, qui ont déjà le leur. */}
      <button
        type="button"
        onClick={() => {
          setErreur(null);
          setFeuilleOuverte(true);
        }}
        data-atlas="piece"
        aria-label={`${piece.titre}, que faire de ce document ?`}
        className="flex min-h-[68px] w-full items-center gap-3 py-2.5 text-left"
        style={{
          borderTop: premiere ? "none" : `1px solid ${colors.line}`,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span className="min-w-0 flex-1">
          {/* **LE TITRE ET LE MONTANT — 28 octobre 2026**, sur sa planche
              `appli/soignee/client.html` : *« le titre du devis visible, le
              montant »*. Le titre en gras, le TTC à droite, le numéro descend
              avec la date (`lignesDeLaPiece`). Un titre long passe à la ligne
              plutôt que de se couper : il est ce qu'il vient lire. */}
          <span className="flex items-baseline justify-between gap-3">
            <span
              data-atlas="piece-titre"
              className="block min-w-0 break-words text-[18.5px] leading-[1.25]"
              style={{ fontFamily: font.display, fontVariantNumeric: "lining-nums" }}
            >
              {lignes.gras}
            </span>
            {lignes.montant && (
              <span
                data-atlas="piece-montant"
                className="flex-none whitespace-nowrap text-[15.5px] font-semibold"
                style={{ color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}
              >
                {lignes.montant}
              </span>
            )}
          </span>
          {/* **UNE DATE NE SE MET JAMAIS EN CAPITALES**, et elle s'écrit d'une
              seule façon sur cet écran (`test-fiche-client-e2e`). Pendant une
              recherche, le mot doré devant dit de quoi il s'agit : les onglets
              ne sont plus là pour le dire. */}
          {(lignes.dessous || enRecherche) && (
            <span
              className="mt-0.5 block text-[14px] leading-[1.4]"
              style={{ color: colors.inkSoft, fontVariantNumeric: "tabular-nums" }}
            >
              {enRecherche && (
                <span data-atlas="piece-nature" style={{ color: colors.or, fontWeight: 600 }}>
                  {lignes.mot}{" "}
                </span>
              )}
              {lignes.dessous}
            </span>
          )}
          {/* **CE QUE LE CLIENT A FAIT DE SA FACTURE — sa réponse du 9 septembre
              2026** : *« je vais dans mes clients sur la catégorie facture »*.
              « Pas encore ouverte » s'écrit : c'est justement ce qu'il vient
              vérifier quand un client prétend n'avoir rien reçu. La phrase se
              décide dans `src/lib/reception-facture.ts`, pas ici ; la date est
              en gras, sa demande du 11 septembre. */}
          {piece.reception && (
            <span data-atlas="piece-reception" className="mt-[3px] block text-[14px] leading-[1.4]" style={{ color: colors.inkSoft }}>
              {piece.reception.avant}
              {piece.reception.date && <strong style={{ color: colors.ink }}>{piece.reception.date}</strong>}
            </span>
          )}
        </span>
        {/* Le chevron : seule affordance de navigation vers l'intérieur, et
            discret — il montre un sens, il ne décore pas (`CLAUDE.md` §3). */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.chevron} strokeWidth="2" aria-hidden="true" className="flex-none">
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <BottomSheet open={feuilleOuverte} onBackdropClick={() => setFeuilleOuverte(false)}>
        <p className="text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
          {piece.titre}
        </p>
        {piece.precision && (
          <p className="mt-1 text-[15px]" style={{ color: colors.inkSoft }}>
            {piece.precision}
          </p>
        )}

        {/* **« Télécharger » en tête, et c'est le geste qu'il est venu chercher.**
            Le mot était « Enregistrer » ; il a demandé « Télécharger » le
            23 octobre 2026, capture à l'appui. La feuille ne se referme qu'une
            fois le document parti : refermée à l'appui, elle emportait le
            message d'un refus.

            **Sauf pour une fiche d'entretien**, qui n'est pas un fichier : elle
            n'a rien à enregistrer, et « Ouvrir » devient alors le geste plein. */}
        {estUnFichier && (
          <BoutonTelechargerDocument
            fichier={piece.href}
            nom={nomFichier}
            onFini={() => setFeuilleOuverte(false)}
            dataAtlas="piece-enregistrer"
            className={`atlas-plein mt-5 ${GESTE_DE_LA_FEUILLE}`}
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            <IconeDeLaFeuille d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />
            Télécharger
          </BoutonTelechargerDocument>
        )}

        {/* **Ouvrir et Partager côte à côte, creux** quand Télécharger porte
            l'aplat ; pour une fiche, Ouvrir le prend et Partager suit dessous.
            « Surtout pas ceux qui sont creux » (31 août) : un bouton creux ne
            reçoit jamais la classe de l'aplat. */}
        <div className={estUnFichier ? "mt-2.5 flex gap-2.5" : "mt-5"}>
          <a
            href={adresseOuvrir}
            onClick={() => setFeuilleOuverte(false)}
            data-atlas="piece-ouvrir"
            className={estUnFichier ? `flex-1 ${GESTE_DE_LA_FEUILLE}` : `atlas-plein ${GESTE_DE_LA_FEUILLE}`}
            style={
              estUnFichier
                ? { color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }
                : { backgroundColor: colors.plein, color: surPlein }
            }
          >
            <IconeDeLaFeuille d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            Ouvrir
          </a>

          {/* **« Partager » vit ici**, après avoir disparu de l'écran d'envoi le
              21 août au matin : c'est le seul chemin vers WhatsApp. */}
          <button
            type="button"
            onClick={partager}
            data-atlas="piece-partager"
            className={estUnFichier ? `flex-1 ${GESTE_DE_LA_FEUILLE}` : `mt-2.5 ${GESTE_DE_LA_FEUILLE}`}
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
          >
            <IconeDeLaFeuille d="M12 15V4M8 7.5L12 3.5l4 4M6 11.5H5v9h14v-9h-1" />
            Partager
          </button>
        </div>

        {/* Un refus se lit dans le rouge des refus, et non plus dans le vert pin
            de la charte, qui est la voix de ce qu'on fait. */}
        {erreur && (
          <p role="alert" className="mt-3 text-center text-[14px]" style={{ color: colors.alert }}>
            {erreur}
          </p>
        )}

        <button
          type="button"
          onClick={() => setFeuilleOuverte(false)}
          className="mt-2 block min-h-[48px] w-full text-center text-[15px]"
          style={{ color: colors.inkSoft }}
        >
          Annuler
        </button>
      </BottomSheet>
    </>
  );
}

/** Les gestes de la feuille : 56 px de haut, le dessin devant le mot. */
const GESTE_DE_LA_FEUILLE =
  "flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-[14px] px-3 text-center text-[16.5px] font-semibold";

function IconeDeLaFeuille({ d }: { d: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-none"
    >
      <path d={d} />
    </svg>
  );
}
