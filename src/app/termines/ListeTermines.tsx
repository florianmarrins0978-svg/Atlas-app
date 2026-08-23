"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import {
  aFacturerPartout,
  bornesDuFeuilletage,
  decalerMois,
  factureesPartout,
  formatEuros,
  libelleFacturee,
  nomDuMois,
  resumeDuMois,
  type LigneAffichee,
} from "@/lib/termines-par-mois";

/**
 * « Terminés » — un mois à la fois, et l'état écrit en toutes lettres.
 *
 * *Planche 90, proposition B (`appli/termines-simple.html`), retenue par le
 * patron le 22 août 2026 : « je choisis la B avec les modifications que je
 * viens de te demander ».*
 *
 * **Ce que l'écran d'avant ne disait pas, relevé sur sa capture.** Le seul
 * travail qui restait — quatre chantiers à facturer — vivait REPLIÉ derrière
 * une ligne en petites capitales, sans rien qui dise qu'on pouvait appuyer.
 * « 3 828,00 € » s'écrivait deux fois sans qu'on sache pourquoi c'était le même
 * chiffre. Et trois codes que personne n'avait appris décidaient du sens : la
 * pastille dorée, les points pleins ou creux, l'or contre le noir.
 *
 * **Ils sont remplacés par des mots.** « Pas encore facturé », « Facturé le
 * 20 août ». Un signe qu'il faut apprendre est un signe qu'on lit de travers le
 * jour où l'on est pressé.
 *
 * **CE QUI RESTE À FACTURER NE SUIT PAS LE MOIS.** Sa demande du 22 août :
 * *« il faut pouvoir revenir dans le passé si jamais on a du retard sur la
 * facturation »*. L'onglet « À facturer » ignore donc le mois affiché — un
 * chantier de juillet jamais facturé se voit encore en août, sinon il faudrait
 * déjà savoir qu'il existe pour aller le chercher.
 */
export default function ListeTermines({
  lignes,
  moisCourant,
}: {
  lignes: LigneAffichee[];
  /**
   * `AAAA-MM` du jour, calculé sur le SERVEUR.
   *
   * Le lire dans le navigateur ferait rendre au serveur un mois et au client un
   * autre pour qui n'est pas au même fuseau — React refuse alors l'hydratation,
   * et l'écran fige à ce qu'il était.
   */
  moisCourant: string;
}) {
  const [onglet, setOnglet] = useState<"tout" | "attente">("tout");

  const attente = useMemo(() => aFacturerPartout(lignes), [lignes]);
  const faites = useMemo(() => factureesPartout(lignes), [lignes]);

  const { entree, borne } = useMemo(
    () => bornesDuFeuilletage(lignes, moisCourant),
    [lignes, moisCourant]
  );
  // Le mois affiché se garde en clair — un décalage relatif se recalculait à
  // chaque rendu, et le jour où l'entrée bouge il ne veut plus rien dire.
  const [cle, setCle] = useState(entree);
  const plancher = decalerMois(entree, RECUL_MAX);
  const mois = useMemo(() => resumeDuMois(lignes, cle), [lignes, cle]);

  return (
    <div data-atlas="liste-termines">
      {/* **La phrase des deux chiffres a QUITTÉ cette place le 23 août 2026**,
          à sa demande : *« supprime ce qui est marqué sous le mois d'août et à
          la place tu écris la phrase qui est marquée sous Terminés. Et tu
          enlèves la phrase qui est marquée sous Terminés. »*

          Elle vit maintenant sous le mois, où elle remplace un décompte qui
          disait la même chose en d'autres mots. Deux phrases pour un seul état,
          à trois centimètres l'une de l'autre, faisaient hésiter — est-ce le
          même chiffre ? */}
      <div className="mx-[26px] mt-[22px] flex gap-2">
        <Onglet actif={onglet === "tout"} onClick={() => setOnglet("tout")}>
          Tout
        </Onglet>
        <Onglet actif={onglet === "attente"} onClick={() => setOnglet("attente")}>
          À facturer
        </Onglet>
      </div>

      {onglet === "attente" ? (
        <section className="mx-[26px] mt-[30px]" data-atlas="tout-ce-qui-attend">
          {attente.length === 0 ? (
            <p className="text-[13.5px] leading-[1.65]" style={{ color: colors.muted }}>
              Rien n&apos;attend. Vous êtes à jour.
            </p>
          ) : (
            <>
              <Compte>
                {attente.length} chantier{attente.length > 1 ? "s" : ""} à facturer, tous mois
                confondus.
              </Compte>
              {attente.map((l) => (
                <Ligne key={l.id} ligne={l} />
              ))}
            </>
          )}
        </section>
      ) : (
        <section className="mx-[26px] mt-[30px]" data-atlas="le-mois">
          <NavigationMois
            cle={cle}
            peutReculer={cle > plancher}
            peutAvancer={cle < borne}
            surMois={setCle}
          />
          {mois.lignes.length === 0 ? (
            <p className="mt-4 text-[13.5px] leading-[1.65]" style={{ color: colors.muted }}>
              Rien en {nomDuMois(cle).toLowerCase()}.
            </p>
          ) : (
            <>
              {/* **Sa phrase, ici — 23 août 2026 —, réduite à ses DEUX
                  COMPTES le soir même** : *« là où il y a écrit trois à
                  facturer et huit facturés, supprime les montants qu'il y a
                  avec »*.

                  **Elle compte TOUS les mois**, pas seulement celui qu'on
                  regarde : c'est ainsi qu'elle a été demandée. Ses montants
                  disaient donc des sommes que la liste en dessous ne montrait
                  pas — trois chiffres d'origines différentes sur deux lignes.

                  **Le trait sous elle est la démarcation qu'il a demandée** —
                  *« essaye de laisser un peu d'espace entre cette phrase-là et
                  le premier client, histoire qu'on fasse bien la démarcation »*.
                  De l'espace seul se serait mangé au premier ajout de contenu ;
                  un trait tient.

                  **Toute la phrase est en noir gras** — c'était déjà sa demande
                  du 22 août pour le compte des factures, et les montants partis,
                  il ne reste plus rien à mettre en retrait : deux graisses pour
                  deux mots feraient une hiérarchie sans objet. */}
              <p
                className="mb-[9px] mt-3.5 pb-[15px] text-[14px] font-bold leading-[1.6]"
                style={{ color: colors.ink, borderBottom: `1px solid ${colors.line}` }}
                data-atlas="compte-du-mois"
              >
                {attente.length > 0 && <>{attente.length} à facturer{" · "}</>}
                {faites.length} facturé{faites.length > 1 ? "s" : ""}
              </p>
              {mois.lignes.map((l) => (
                <Ligne key={l.id} ligne={l} />
              ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}

/** Dix-huit mois en arrière : au-delà, il n'y a rien à aller chercher. */
const RECUL_MAX = 18;

/**
 * ‹ Août 2026 › — sa demande du 22 août 2026.
 *
 * **La flèche du futur se ferme sur le mois le plus récent.** Un bouton qui ne
 * fait rien s'appuie deux fois, puis on croit l'écran cassé.
 *
 * **44 px de haut**, comme partout : c'est un pouce, sur un chantier, parfois
 * avec des gants.
 *
 * **Le total du mois a quitté cette ligne le 23 août 2026, à sa demande** :
 * *« le montant 5 028,00 € qui est sur la même ligne qu'août 2026, celui-là tu
 * peux le supprimer »*. Il n'avait pas la même portée que les deux comptes en
 * dessous — lui ne comptait que le mois affiché, eux comptent tous les mois —
 * et deux chiffres voisins de portées différentes se lisent comme une
 * contradiction. Le nom du mois se déplace ; ce qu'on additionne se lit dans
 * les lignes.
 */
function NavigationMois({
  cle,
  peutReculer,
  peutAvancer,
  surMois,
}: {
  cle: string;
  peutReculer: boolean;
  peutAvancer: boolean;
  surMois: (cle: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5" data-atlas="navigation-mois">
      <Fleche
        sens="passe"
        desactivee={!peutReculer}
        onClick={() => surMois(decalerMois(cle, 1))}
      />
      <span style={{ fontFamily: font.display, fontSize: 21, lineHeight: 1.2, whiteSpace: "nowrap" }}>
        {nomDuMois(cle)}
      </span>
      <Fleche sens="futur" desactivee={!peutAvancer} onClick={() => surMois(decalerMois(cle, -1))} />
    </div>
  );
}

function Fleche({
  sens,
  desactivee,
  onClick,
}: {
  sens: "passe" | "futur";
  desactivee: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivee}
      aria-label={sens === "passe" ? "Mois précédent" : "Mois suivant"}
      data-atlas={sens === "passe" ? "mois-precedent" : "mois-suivant"}
      className="flex h-11 w-[38px] items-center justify-center text-[22px] leading-none"
      style={{
        fontFamily: font.display,
        color: desactivee ? colors.line : colors.or,
        marginLeft: sens === "passe" ? -10 : 0,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {sens === "passe" ? "‹" : "›"}
    </button>
  );
}

/**
 * Le compte des factures — **en noir gras**, sa demande du 22 août 2026 :
 * *« cinq factures envoyées et tant qui attendent leur facturation, ça tu peux
 * le mettre en noir gras »*. C'est ce qu'il vient chercher ; ce n'était pas une
 * note de bas de page.
 */
function Compte({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-[9px] mt-1.5 pb-[15px] text-[13px] font-bold leading-[1.55]"
      style={{ color: colors.ink, borderBottom: `1px solid ${colors.line}` }}
      data-atlas="compte-du-mois"
    >
      {children}
    </p>
  );
}

function Onglet({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className="min-h-10 rounded-full px-4 text-[13px]"
      style={{
        backgroundColor: actif ? colors.ink : "transparent",
        color: actif ? colors.card : colors.muted,
        boxShadow: actif ? "none" : `inset 0 0 0 1px ${colors.line}`,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}

/**
 * Une ligne : le nom, ce qu'elle en est, et le montant — ou le bouton.
 *
 * **Toute la ligne mène à la facture, et il n'y a qu'UN lien.** La capsule
 * « Facturer » est un `span` à l'intérieur : deux liens superposés dans la même
 * rangée se disputent le pouce, et le contrôle qui compte les liens de la
 * rangée ne saurait plus lequel viser.
 *
 * **« Facturer » ouvre l'écran de facture, il ne facture pas.** Rien ne part
 * chez un client sans un geste du patron (`docs/AGENT.md` §6).
 */
function Ligne({ ligne }: { ligne: LigneAffichee }) {
  return (
    <Link
      href={`/chantiers/${ligne.id}/facture`}
      data-atlas="ligne-terminee"
      // **Aéré le 23 août 2026, à sa demande** : *« il faut aérer un peu la
      // page parce qu'il y a énormément d'informations »*. Une ligne porte deux
      // étages de texte et parfois une capsule de 44 px ; à 14 px de marge, le
      // trait du dessous touchait presque le second étage, et douze lignes se
      // lisaient comme un bloc.
      className="flex items-center gap-3.5 py-[19px]"
      style={{ borderBottom: `1px solid ${colors.line}`, minWidth: 0 }}
    >
      <span className="min-w-0 flex-1">
        <b
          className="block truncate font-normal"
          style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.2, color: colors.ink }}
        >
          {ligne.nom}
        </b>
        {/* **La ligne d'état s'enroule, elle ne se coupe pas.** Vu sur une
            capture de l'écran, avec de vrais montants : « Pas encore facturé ·
            1 764,00 € prévus » perdait « prévus », et parfois le montant
            lui-même. Le NOM, lui, reste sur une ligne — un nom se reconnaît
            tronqué, un chiffre coupé ne se devine pas. */}
        <span
          className="mt-[5px] block text-[13px] leading-[1.5]"
          style={{ color: ligne.aFacturer ? colors.or : colors.muted }}
        >
          {ligne.aFacturer
            ? ligne.montant === null
              ? "Pas encore facturé"
              : `Pas encore facturé · ${formatEuros(ligne.montant)} prévus`
            : libelleFacturee(ligne)}
        </span>
      </span>
      {ligne.aFacturer ? (
        <span
          className="flex min-h-11 flex-none items-center rounded-full px-[17px] text-[12.5px] font-semibold uppercase"
          style={{ backgroundColor: colors.rust, color: colors.card, letterSpacing: "0.12em" }}
        >
          Facturer
        </span>
      ) : (
        <span
          className="flex-none"
          style={{
            fontFamily: font.display,
            fontSize: 16,
            lineHeight: 1.2,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            color: colors.ink,
          }}
        >
          {ligne.montant === null ? "—" : formatEuros(ligne.montant)}
        </span>
      )}
    </Link>
  );
}
