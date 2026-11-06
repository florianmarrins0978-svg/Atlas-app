"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, libelleCaps, surPlein, voile } from "@/lib/design-tokens";
import { initialesDuClient, phraseDeLaDerniere, resteDuDeLaLigne } from "@/lib/ligne-du-client";
import { ChampRecherche } from "@/components/atlas/ChampRecherche";
import BoutonFiltre from "@/components/atlas/BoutonFiltre";
import BottomSheet from "@/components/atlas/BottomSheet";
import FeuilleSuppressionClients, { CaseCochee, type PieceGardee } from "@/components/atlas/FeuilleSuppressionClients";
import { oublierCetEcran } from "@/components/atlas/journal-navigateur";
import { supprimerClientAction } from "./[id]/actions";
import { apercuSuppressionClientsAction } from "./actions";
import { grouperEnBandes } from "@/lib/bandes-clients";
import {
  lignesDeLaPiece,
  rangerDuPlusRecent,
  type PieceDuClient,
  type TraceDuClient,
} from "@/lib/documents-du-client";
import {
  AIDE_DE_LA_LOUPE,
  compteDesPieces,
  estUnMontant,
  piecesQuiRepondent,
  registreDeLaPiece,
  rienNeRepond,
} from "@/lib/recherche-piece";
import { MOTS_DE_LA_CATEGORIE, type CategorieClient } from "@/lib/civilite";
import {
  CLES_TRI_CLIENTS,
  aucunePieceDuMois,
  clientsDuMois,
  moisDuJour,
  titreDuTri,
  type DateDeTri,
  type TriClients,
} from "@/lib/tri-clients";
import { filtrerClientsParNom, morceauxSurlignes } from "@/lib/recherche-client";
import { compteDesArrosages } from "@/lib/hivernage";
import Goutte from "@/components/atlas/Goutte";

/**
 * La liste des clients, et le champ qui les retrouve.
 *
 * **Sa demande du 20 août 2026 :** *« Il faut une barre de recherche où je peux
 * taper le nom d'un client pour le retrouver plus facilement »*, capture à
 * l'appui — vingt et un noms, dont quatre Martins, et le sien perdu au milieu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **REFONDU LE 3 SEPTEMBRE 2026, sur maquette qu'il a regardée puis retenue :**
 * *« tu peux coder exactement cette maquette »* (`appli/vos-clients.html`). Il
 * avait nommé trois manques, et un seul d'entre eux tenait à l'apparence :
 *
 *   1. *« quatre clients s'appellent Martins : rien ne me dit lequel c'est »* —
 *      **le lieu prend la deuxième ligne**. La colonne existait
 *      (`clients.adresse`) ; seule cette liste ne la chargeait pas ;
 *   2. *« ce qui reste dû est la seule chose qui demande un geste, et c'est
 *      écrit tout petit, en bout de ligne »* — il passe de 9,5 px en capitales
 *      à **16 px**, à hauteur du nom ;
 *   3. *« une liste longue se parcourt à l'aveugle : ni ordre annoncé, ni
 *      repère »* — **les bandes** (`src/lib/bandes-clients.ts`) nomment l'ordre
 *      que le dépôt appliquait déjà en silence.
 *
 * **DE A À Z DEPUIS LE 27 SEPTEMBRE 2026**, planche A retenue
 * (`appli/clients-a-a-z.html`) : les bandes sont des lettres, plus des mois.
 * Sa condition : *« garder le filtre qui existe aujourd'hui »*. La recherche
 * n'a donc pas bougé d'une ligne ; elle filtre la liste rangée.
 *
 * **CE QUI A ÉTÉ RETIRÉ, et il l'a tranché** : le total facturé par client
 * (« 2 940,00 € facturés ») quitte la ligne. Deux montants sur une même ligne,
 * l'un gris l'autre rouge, se confondent au premier coup d'œil — et c'est le
 * rouge qui compte. Il ne se lit plus nulle part ailleurs depuis que la fiche a
 * été allégée le 2 septembre : c'est le prix, il a été dit, et il l'a accepté.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le tri se fait au dépôt, le filtre ICI.** Vingt et un noms tiennent dans une
 * page ; les envoyer chercher à chaque lettre tapée ferait attendre un
 * aller-retour réseau par frappe, sur un téléphone en 5G au bord d'un chantier.
 * Le jour où un artisan en aura deux mille, ce choix se révisera — et les règles
 * ne bougeront pas : elles vivent dans `src/lib/`, hors de cet écran
 * (`CLAUDE.md` §3).
 */
export type FicheClientListee = {
  id: string;
  nom: string;
  /** Ce qui distingue quatre Martins. `null` : jamais renseignée. */
  adresse: string | null;
  /**
   * **La dernière chose qui s'est produite chez lui** — un devis parti, une
   * facture émise, une fiche envoyée. `null` : rien n'est encore parti.
   *
   * Elle a remplacé le compte de chantiers le 9 septembre 2026, à sa demande.
   * Le pourquoi est dans `derniereTraceDuClient`.
   */
  derniere: TraceDuClient | null;
  /** Ses devis envoyés et ses factures émises, pour le Filtre (`tri-clients.ts`). */
  joursDevis: string[];
  joursFactures: string[];
  facture: string | number | null;
  du: string | number | null;
  /** Ses devis et ses factures, ceux de sa fiche : la loupe y cherche un titre ou un montant. */
  pieces: PieceDuClient[];
  /** La goutte à côté de son nom : un arrosage à hiverner (`src/lib/hivernage.ts`). */
  aHiverner: boolean;
};

/** Une pièce que la loupe a trouvée, et le client chez qui elle mène. */
type PieceTrouvee = PieceDuClient & { client: { id: string; nom: string } };

/**
 * ─── POURQUOI UN CONTEXTE, POUR UN SEUL CHAMP DE SAISIE ──────────────────────
 *
 * **Le compte a quitté le bas de la liste pour l'en-tête**, et il suit la
 * frappe : « 21 clients » devient « 4 clients trouvés ». Écrit sous le dernier
 * résultat, il était hors de l'écran au moment précis où il sert — on tape, on
 * regarde le haut, et rien ne dit combien de noms restent.
 *
 * Or l'en-tête est rendu par `EnTeteEcran`, qui ne connaît pas la saisie. Deux
 * solutions : monter tout l'écran dans le navigateur, ou faire descendre la
 * saisie à deux endroits. C'est la seconde — l'en-tête reste rendu au serveur,
 * et seule la ligne du compte s'anime.
 */
type EtatRecherche = {
  saisie: string;
  poser: (valeur: string) => void;
  total: number;
  visibles: FicheClientListee[];
  /**
   * Les devis et factures qui répondent à la loupe, du plus récent au plus
   * ancien (28 octobre 2026, planche `appli/soignee/clients-importer.html`).
   * Vide quand rien n'est tapé.
   */
  piecesTrouvees: PieceTrouvee[];
  aujourdHui: string;
  /** Le Filtre (22 octobre 2026) : de A à Z, ou les pièces d'un mois. */
  tri: TriClients;
  trier: (tri: TriClients) => void;
  /**
   * Les clients cochés pour être supprimés ensemble (23 octobre 2026).
   * `null` : la liste n'est pas en train de choisir, une ligne ouvre sa fiche.
   */
  choix: Set<string> | null;
  choisir: (choix: Set<string> | null) => void;
  /**
   * « N arrosages à hiverner » (sa réponse « la B » du 6 novembre 2026) : la
   * ligne en tête de la liste rassemble ces clients, et la croix les rend tous.
   */
  hiverner: boolean;
  rassembler: (oui: boolean) => void;
  nombreAHiverner: number;
};

const Contexte = createContext<EtatRecherche | null>(null);

function useRecherche(): EtatRecherche {
  const etat = useContext(Contexte);
  // Hors du fournisseur, il n'y aurait rien à chercher : mieux vaut le dire ici
  // que de rendre un compte faux sur son écran.
  if (!etat) throw new Error("Cette pièce doit vivre dans <FournisseurClients>.");
  return etat;
}

export function FournisseurClients({
  clients,
  aujourdHui,
  children,
}: {
  clients: FicheClientListee[];
  /**
   * Le jour tel que l'application le compte, **posé au serveur**.
   *
   * Le lire ici avec `new Date()` donnerait l'horloge du téléphone : entre
   * minuit et deux heures du matin, l'heure d'été sépare les deux, et le serveur
   * et le navigateur ne compteraient pas la même année : le 31 décembre, une
   * date perdrait ou gagnerait son « 2026 ». React s'en plaindrait, et lui la
   * verrait clignoter.
   */
  aujourdHui: string;
  children: React.ReactNode;
}) {
  const [saisie, poser] = useState("");
  const [tri, trier] = useState<TriClients>({ cle: "nom" });
  const [choix, choisir] = useState<Set<string> | null>(null);
  const [rassembles, rassembler] = useState(false);
  const nombreAHiverner = useMemo(() => clients.filter((c) => c.aHiverner).length, [clients]);
  // Le dernier hivernage noté ailleurs vide le rassemblement : il se défait de
  // lui-même plutôt que de montrer une liste vide sous une croix.
  const hiverner = rassembles && nombreAHiverner > 0;
  const deDepart = useMemo(() => (hiverner ? clients.filter((c) => c.aHiverner) : clients), [clients, hiverner]);
  // **Trié par date, la ligne montre la pièce DU MOIS** (`clientsDuMois`),
  // pas sa plus récente : un titre qui dit juin 2017 au-dessus d'une ligne qui
  // dit 2024 se lirait comme une erreur.
  const dansLeTri = useMemo(
    () =>
      tri.cle === "nom"
        ? deDepart
        : clientsDuMois(deDepart, tri.cle, tri.mois).map((c) => ({ ...c, derniere: c.piece })),
    [deDepart, tri]
  );
  const visibles = useMemo(() => filtrerClientsParNom(dansLeTri, saisie), [dansLeTri, saisie]);
  // **Le nom ne fait pas sortir de pièce ici** (`""` pour le nom) : le client
  // sort déjà dans la liste, et ses quarante pièces derrière lui la noieraient.
  // Sur sa fiche, au contraire, taper son nom rend tout son dossier.
  const piecesTrouvees = useMemo(
    () =>
      saisie.trim()
        ? rangerDuPlusRecent(
            dansLeTri.flatMap((c) =>
              piecesQuiRepondent(c.pieces, saisie, "").map((p) => ({ ...p, client: { id: c.id, nom: c.nom } }))
            )
          )
        : [],
    [dansLeTri, saisie]
  );
  const valeur = useMemo(
    () => ({
      saisie,
      poser,
      total: dansLeTri.length,
      visibles,
      piecesTrouvees,
      aujourdHui,
      tri,
      trier,
      choix,
      choisir,
      hiverner,
      rassembler,
      nombreAHiverner,
    }),
    [saisie, dansLeTri.length, visibles, piecesTrouvees, aujourdHui, tri, choix, hiverner, nombreAHiverner]
  );
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

/**
 * Le compte, sous le titre de l'écran.
 *
 * **La place est gardée même quand il n'y a rien à dire** — trouvé en regardant
 * une capture, jamais par un contrôle : quand une recherche ne rend rien, cette
 * ligne se vidait, disparaissait, et le champ de saisie remontait de vingt-
 * quatre pixels sous le doigt. À chaque frappe qui ne trouve pas.
 */
export function CompteClients({ categorie = "particulier" }: { categorie?: CategorieClient }) {
  const { saisie, total, visibles, choix } = useRecherche();
  const cherche = saisie.trim().length > 0;
  // Pendant le choix, le compte dit ce qui est coché : c'est la seule chose
  // qu'on a besoin de lire en haut, avant d'appuyer sur le rouge.
  if (choix) {
    return (
      <span className="block min-h-[1.45em]" data-atlas="compte-clients" style={{ color: colors.ink }}>
        {choix.size === 0 ? "Aucun choisi" : choix.size === 1 ? "1 choisi" : `${choix.size} choisis`}
      </span>
    );
  }
  const n = cherche ? visibles.length : total;
  const mots = MOTS_DE_LA_CATEGORIE[categorie];
  const mot = n === 1 ? `1 ${mots.un}` : `${n} ${mots.des}`;
  // Rien trouvé : la phrase juste en dessous le dit déjà, en citant sa frappe.
  // Le redire ici en capitales serait la redite qu'il nous reproche.
  const accord = mots.trouve;
  const texte = cherche && n === 0 ? "" : cherche ? `${mot} ${accord}${n > 1 ? "s" : ""}` : mot;
  return (
    <span className="block min-h-[1.45em]" data-atlas="compte-clients">
      {texte}
    </span>
  );
}

/**
 * Ce qui s'efface le temps du choix ou d'un mois filtré : les portes, et
 * l'import au bout de la liste (sa planche soignée du 25 octobre 2026). On y
 * fait autre chose qu'aller ailleurs, et la liste remonte d'autant sous le doigt.
 */
export function HorsDuChoix({ children }: { children: React.ReactNode }) {
  const { choix, tri } = useRecherche();
  return choix || tri.cle !== "nom" ? null : <>{children}</>;
}

export default function ListeClients({
  sousLaRecherche = null,
  auBout = null,
}: {
  /** Ce qui se pose sous la recherche, et ne colle pas avec elle : la bande d'un import en cours. */
  sousLaRecherche?: React.ReactNode;
  /** Ce qui se pose au bout de la liste : la porte de l'import, geste rare. */
  auBout?: React.ReactNode;
}) {
  const { saisie, poser, visibles, piecesTrouvees, aujourdHui, tri, trier, choix, choisir, total, hiverner, rassembler, nombreAHiverner } =
    useRecherche();
  const cherche = saisie.trim().length > 0;
  const [volet, setVolet] = useState(false);
  // « Tout » ne coche que ce qui est À L'ÉCRAN : une recherche ou un
  // mois filtré bornent le geste à ce qu'il voit, jamais à des noms cachés.
  const toutCoche = choix !== null && visibles.length > 0 && visibles.every((c) => choix.has(c.id));
  const titre = titreDuTri(tri);

  // **Le filet sous la barre collante n'apparaît qu'une fois qu'elle colle.**
  // Un repère posé en permanence serait un trait de plus sur un écran qui n'en
  // porte aucun ; il ne sert qu'à séparer la barre des lignes qui passent
  // dessous. La sentinelle mesure la page plutôt qu'un seuil écrit en dur, qui
  // serait faux dès qu'un mot du titre passe à la ligne.
  const sentinelle = useRef<HTMLDivElement>(null);
  const [posee, setPosee] = useState(false);
  useEffect(() => {
    const cible = sentinelle.current;
    if (!cible || typeof IntersectionObserver === "undefined") return;
    const veille = new IntersectionObserver(([e]) => setPosee(!e.isIntersecting), {
      threshold: 0,
    });
    veille.observe(cible);
    return () => veille.disconnect();
  }, []);

  const bandes = useMemo(
    () => grouperEnBandes(visibles),
    [visibles]
  );

  return (
    <>
      <div ref={sentinelle} aria-hidden="true" className="h-px" />

      {/* **Le champ est TOUJOURS là, et c'est un choix.** Une première version
          ne le montrait qu'à partir de cinq clients — moins de meuble sur un
          écran presque vide. Mais une barre qui apparaît et disparaît est une
          règle de plus à deviner : le jour où il en a quatre, il la cherche et
          conclut qu'elle a été retirée. Un champ vide ne coûte rien à lire ;
          une règle invisible coûte un message.

          **Et il COLLE en haut depuis le 3 septembre 2026.** Sur vingt et un
          noms on descend ; l'outil qui sert à remonter ne doit pas être resté
          en haut de la page. */}
      <div
        className="sticky top-0 z-[5] px-[22px] pb-[14px] pt-[14px]"
        style={{
          backgroundColor: colors.cream,
          boxShadow: posee ? `0 1px 0 ${colors.line}` : "none",
          transition: "box-shadow 180ms ease-out",
        }}
      >
        {/* **LE FILTRE DE TERMINÉS, sa demande du 22 octobre 2026**
            (`appli/facture-mairie-chorus.html`) : retrouver un devis de 2017
            dans dix ans de dossiers. Ses couleurs ne changent pas quand il
            agit (*« pas vert »*) : c'est le titre du mois qui le dit.

            **Sur la ligne de la recherche, comme sa planche soignée** (sa
            demande du 31 octobre 2026 : *« j'aimais bien que l'icône du filtre
            soit sur la même ligne »*). Son signe seul : avec le mot, la phrase
            de la loupe se coupait à « un titre, u » sur 390 px. */}
        <div className="flex items-end gap-2.5">
          <div className="min-w-0 flex-1">
            <ChampRecherche
              valeur={saisie}
              onChange={poser}
              placeholder={AIDE_DE_LA_LOUPE}
              ariaLabel={AIDE_DE_LA_LOUPE}
              dataAtlas="chercher-client"
              // Mesuré : la phrase fait 252 px à 14 px, la case en offre 259 à
              // 390 px de large, et 229 à 360 px, d'où 12,5 px en dessous de 380.
              className="[&_input::placeholder]:text-[14px] max-[380px]:[&_input::placeholder]:text-[12.5px]"
            />
          </div>
          <BoutonFiltre signeSeul onClick={() => setVolet(true)} />
        </div>
        {tri.cle !== "nom" && titre && (
          <OuvrirLeCalendrier
            jour={`${tri.mois}-01`}
            choisir={(jour) => {
              const mois = moisDuJour(jour);
              if (mois) trier({ cle: tri.cle, mois });
            }}
            dataAtlas="periode-du-filtre"
            className="mt-[8px] flex min-h-11 w-full items-center justify-center gap-2"
          >
            <span className="text-[22px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
              {titre}
            </span>
            <SigneCalendrier />
          </OuvrirLeCalendrier>
        )}
      </div>
      {sousLaRecherche}

      {/* **« N arrosages à hiverner », sous la recherche — « la B », sa
          réponse du 6 novembre 2026.** Hors du choix et d'un mois filtré : on
          y fait autre chose que rassembler. Rassemblés, la ligne cède sa place
          au titre « À hiverner » et à sa croix, qui rend tous les clients. */}
      {!choix && tri.cle === "nom" && hiverner && (
        <div className="mx-[22px] mb-[4px] mt-[4px] flex items-center justify-center gap-[10px]" data-atlas="a-hiverner-rassembles">
          <Goutte taille={28} />
          <span className="text-[22px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
            À hiverner
          </span>
          <button
            type="button"
            onClick={() => rassembler(false)}
            aria-label="Revenir à tous les clients"
            data-atlas="defaire-a-hiverner"
            className="grid h-10 w-10 place-items-center rounded-full"
            style={{ color: colors.inkSoft, boxShadow: `inset 0 0 0 1px ${colors.line}`, WebkitTapHighlightColor: "transparent" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
            </svg>
          </button>
        </div>
      )}
      {!choix && tri.cle === "nom" && !hiverner && nombreAHiverner > 0 && !cherche && (
        <button
          type="button"
          onClick={() => rassembler(true)}
          data-atlas="rassembler-a-hiverner"
          className="mx-[22px] mb-[14px] flex min-h-[60px] w-[calc(100%-44px)] items-center gap-3 rounded-[6px] py-2 pl-[10px] pr-[14px] text-left"
          style={{ backgroundColor: colors.carteBleuFond, color: colors.carteBleuTexte, WebkitTapHighlightColor: "transparent" }}
        >
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full" style={{ backgroundColor: colors.card }}>
            <Goutte taille={28} />
          </span>
          <span className="min-w-0 flex-1 text-[16px] font-bold">{compteDesArrosages(nombreAHiverner)}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="flex-none">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      <VoletTriClients
        ouvert={volet}
        tri={tri}
        aujourdHui={aujourdHui}
        fermer={() => setVolet(false)}
        trier={(t) => {
          trier(t);
          setVolet(false);
        }}
      />

      {/* **« Tout » se pose au-dessus de la première lettre, à gauche** —
          sa planche du 28 octobre 2026 (`appli/supprimer-plusieurs-clients.html`) :
          le rond est dans la colonne des noms, avant le A. Au-dessus des deux
          listes, pour rester là quand un mois filtré remplace les lettres. */}
      {choix && visibles.length > 0 && (
        <button
          type="button"
          data-atlas="tout-cocher"
          aria-pressed={toutCoche}
          onClick={() => choisir(toutCoche ? new Set() : new Set(visibles.map((c) => c.id)))}
          className="mx-[32px] mb-[4px] mt-[6px] flex min-h-11 items-center gap-[8px] text-[15px] font-semibold"
          style={{ background: "transparent", color: colors.ink, WebkitTapHighlightColor: "transparent" }}
        >
          <CaseCochee cochee={toutCoche} />
          Tout
        </button>
      )}
      {/* **Des pièces trouvées, et aucun nom** (« 640 ») : la liste se tait, les
          pièces parlent juste en dessous. */}
      {visibles.length === 0 && cherche && !choix && piecesTrouvees.length > 0 ? null : visibles.length === 0 ? (
        <p
          className="mx-[22px] px-1 py-[26px] text-center text-[15.5px] leading-[1.5]"
          // **`inkSoft`, et non le gris des méta.** Mesuré : `muted` tient 3,32
          // de contraste sur le fond crème — sous le seuil de lecture, et c'est
          // la première chose qui s'efface au soleil. C'est la seule phrase de
          // l'écran, et elle doit se lire.
          style={{ color: colors.inkSoft }}
        >
          {cherche || tri.cle === "nom" ? rienNeRepond(saisie) : aucunePieceDuMois(tri)}
        </p>
      ) : tri.cle !== "nom" ? (
        // Trié par date, aucune bande de lettre : la liste suit les jours.
        <ul className="mx-[22px] mt-[14px] flex flex-col rounded-[6px] px-4 py-[2px]" style={{ backgroundColor: colors.card }}>
          {visibles.map((c, i) => (
            <li key={c.id} style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}>
              <LigneClient client={c} saisie={saisie} aujourdHui={aujourdHui} />
            </li>
          ))}
        </ul>
      ) : (
        // **Chaque lettre range ses clients dans UNE plage** (sa planche
        // soignée) : la carte claire porte la liste, la lettre en serif ouvre
        // chaque groupe, un filet sépare les lettres et les clients.
        <div className="mx-[22px] rounded-[6px] px-4 py-[2px]" style={{ backgroundColor: colors.card }} data-atlas="plage-des-clients">
          {bandes.map((groupe, iBande) => (
            <section key={groupe.bande} style={iBande > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}>
              {/* **Pendant une recherche, aucune lettre.** Sur quatre lignes
                  trouvées, une lettre au-dessus de chacune serait le bruit que
                  le repère devait réduire. */}
              {!cherche && (
                <p
                  className="pb-[2px] pt-[14px] text-[17px] leading-none"
                  style={{ fontFamily: font.display, color: colors.inkSoft }}
                >
                  {groupe.bande}
                </p>
              )}
              <ul className="flex flex-col">
                {groupe.clients.map((c, i) => (
                  <li key={c.id} style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}>
                    <LigneClient client={c} saisie={saisie} aujourdHui={aujourdHui} dansUneLettre={!cherche} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Le temps du choix, une ligne coche un client : une pièce, elle, ne se
          coche pas, elle se tait. */}
      {cherche && !choix && piecesTrouvees.length > 0 && (
        <PiecesTrouvees pieces={piecesTrouvees} saisie={saisie} />
      )}

      {auBout}

      {choix && <BarreDuChoix choix={choix} choisir={choisir} total={total} />}
    </>
  );
}

/**
 * LES DEVIS ET FACTURES QUE LA LOUPE A TROUVÉS — sa demande du 28 octobre 2026.
 *
 * *« Il faut rajouter la loupe pour faire une recherche par nom ou montant »*,
 * planche `appli/soignee/clients-importer.html` : sous les clients trouvés, les
 * pièces, chacune avec son titre, son montant, sa référence et son client. Un
 * appui ouvre la fiche du client sur l'onglet de la pièce.
 */
function PiecesTrouvees({ pieces, saisie }: { pieces: PieceTrouvee[]; saisie: string }) {
  const montant = estUnMontant(saisie);
  return (
    <section className="mx-[22px] mt-[18px]" data-atlas="pieces-trouvees">
      <p className="mb-[6px] text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.or }}>
        {compteDesPieces(pieces)}
      </p>
      <ul className="flex flex-col">
        {pieces.map((p, i) => {
          const lignes = lignesDeLaPiece(p);
          return (
            <li key={p.id}>
              <Link
                href={`/clients/${p.client.id}?registre=${registreDeLaPiece(p)}`}
                data-atlas="piece-trouvee"
                className="flex min-h-[68px] items-center gap-3 py-2.5"
                style={{ borderTop: i === 0 ? "none" : `1px solid ${colors.line}`, WebkitTapHighlightColor: "transparent" }}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span
                      className="block min-w-0 break-words text-[18.5px] leading-[1.25]"
                      style={{ fontFamily: font.display, color: colors.ink, fontVariantNumeric: "lining-nums" }}
                    >
                      {montant ? lignes.gras : <Surligne texte={lignes.gras} saisie={saisie} />}
                    </span>
                    {lignes.montant && (
                      <span
                        className="flex-none whitespace-nowrap text-[15.5px] font-semibold"
                        style={{ color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}
                      >
                        {montant ? <mark style={STYLE_MARQUE}>{lignes.montant}</mark> : lignes.montant}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[14px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                    {lignes.mot} {lignes.dessous}
                  </span>
                  <span className="mt-0.5 block truncate text-[14px] font-semibold leading-[1.4]" style={{ color: colors.ink }}>
                    {p.client.nom}
                  </span>
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.chevron} strokeWidth="2" aria-hidden="true" className="flex-none">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Ce qui a été trouvé, marqué de la même encre que le nom d'un client. */
function Surligne({ texte, saisie }: { texte: string; saisie: string }) {
  return (
    <>
      {morceauxSurlignes(texte, saisie).map((m, i) =>
        m.trouve ? (
          <mark key={i} style={STYLE_MARQUE}>
            {m.texte}
          </mark>
        ) : (
          <span key={i}>{m.texte}</span>
        )
      )}
    </>
  );
}

const STYLE_MARQUE = {
  backgroundColor: voile(colors.or, 0.24),
  color: "inherit",
  borderRadius: 2,
  padding: "0 1px",
} as const;

/**
 * Le bouton rouge et sa sortie, au-dessus des onglets, le temps du choix.
 *
 * **La suppression se rejoue client par client**, par la même action que la
 * fiche (`supprimerClientAction`) : un refus pour l'un n'empêche pas les
 * autres, et il se nomme dans la feuille au lieu de tout annuler en silence.
 */
function BarreDuChoix({
  choix,
  choisir,
  total,
}: {
  choix: Set<string>;
  choisir: (choix: Set<string> | null) => void;
  /** Combien de clients la liste porte : tous cochés, la feuille le dit en titre. */
  total: number;
}) {
  const router = useRouter();
  const [vises, setVises] = useState<{ id: string; nom: string; documents: number; conserve: PieceGardee[] }[] | null>(
    null
  );
  const [sauvegarde, setSauvegarde] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [prepare, preparer] = useTransition();
  const [enCours, demarrer] = useTransition();
  const n = choix.size;

  function ouvrir() {
    setRefus(null);
    setSauvegarde(false);
    preparer(async () => {
      const apercu = await apercuSuppressionClientsAction([...choix]);
      if (!apercu.ok) {
        setRefus(apercu.message);
        setVises([]);
        return;
      }
      setVises(
        apercu.clients.map((c) => ({ ...c, conserve: c.conserve.map((p) => ({ ...p, nom: c.nom })) }))
      );
    });
  }

  function fermer() {
    setVises(null);
    setSauvegarde(false);
    setRefus(null);
  }

  function supprimer() {
    if (!vises) return;
    setRefus(null);
    demarrer(async () => {
      const restent: { id: string; nom: string; message: string }[] = [];
      for (const c of vises) {
        const issue = await supprimerClientAction(c.id);
        if (!issue.ok) {
          restent.push({ id: c.id, nom: c.nom, message: issue.message });
          continue;
        }
        // **Sa fiche disparaît DU JOURNAL** : la flèche de retour ramène à la
        // page d'où l'on vient, et une fiche effacée y serait une destination
        // promise qui ne mène plus à rien (`SupprimerCeClient`).
        oublierCetEcran(`/clients/${c.id}`);
      }
      router.refresh();
      if (restent.length === 0) {
        fermer();
        choisir(null);
        return;
      }
      // Ceux qui sont partis quittent la feuille ; ceux qui restent y sont
      // nommés, avec la raison que le serveur a donnée.
      setVises(vises.filter((c) => restent.some((r) => r.id === c.id)));
      choisir(new Set(restent.map((r) => r.id)));
      setRefus(restent.map((r) => `${r.nom} : ${r.message}`).join(" "));
    });
  }

  const documents = (vises ?? []).reduce((total, c) => total + c.documents, 0);
  const tous = vises !== null && vises.length > 1;

  return (
    <>
      {/* La place que la barre prend en bas : sans elle, les derniers clients
          resteraient cachés dessous, impossibles à cocher. */}
      <div aria-hidden="true" className="h-[124px]" />
      <div
        data-atlas="barre-du-choix"
        className="atlas-colonne-fixe z-10 border-t px-[26px] pb-2 pt-3"
        style={{ bottom: "var(--atlas-barre)", backgroundColor: colors.cream, borderColor: colors.line }}
      >
        <button
          type="button"
          data-atlas="supprimer-les-clients"
          disabled={n === 0 || prepare}
          onClick={ouvrir}
          className="h-[52px] w-full rounded-full text-[15px] font-semibold"
          style={{
            background: n === 0 ? colors.line : colors.alert,
            color: n === 0 ? colors.muted : surPlein,
            cursor: n === 0 ? "default" : "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {prepare ? "Un instant…" : n === 0 ? "Supprimer" : n === 1 ? "Supprimer 1 client" : `Supprimer ${n} clients`}
        </button>
        <button
          type="button"
          data-atlas="sortir-du-choix"
          onClick={() => choisir(null)}
          className="mt-0.5 h-[40px] w-full cursor-pointer text-[14px]"
          style={{ background: "transparent", color: colors.muted }}
        >
          Annuler
        </button>
      </div>

      <FeuilleSuppressionClients
        ouverte={vises !== null}
        titre={
          vises === null || vises.length === 0
            ? "Aucun client"
            : vises.length === 1
              ? vises[0].nom
              : vises.length === total
                ? `Tous vos clients (${total})`
                : `${vises.length} clients`
        }
        noms={tous ? vises.map((c) => c.nom) : null}
        documents={documents}
        conserve={(vises ?? []).flatMap((c) => c.conserve)}
        sauvegarde={sauvegarde}
        basculerSauvegarde={() => setSauvegarde((v) => !v)}
        refus={refus}
        enCours={enCours}
        libelleConfirmer={tous ? `Supprimer les ${vises.length}` : "Supprimer"}
        confirmer={supprimer}
        fermer={fermer}
      />
    </>
  );
}

function LigneClient({
  client,
  saisie,
  aujourdHui,
  dansUneLettre = false,
}: {
  client: FicheClientListee;
  saisie: string;
  /** Le jour tel que le SERVEUR le compte — voir `FournisseurClients`. */
  aujourdHui: string;
  /** Sous une lettre, la ligne se resserre : la lettre lui prend déjà sa marge du haut. */
  dansUneLettre?: boolean;
}) {
  const { choix, choisir } = useRecherche();
  const appui = useAppuiLong(() => choisir(new Set([client.id])));
  // **Le compte de chantiers a quitté cette ligne le 9 septembre 2026.** Il
  // était juste — tous les chantiers ouverts — et c'est ce qui le rendait
  // trompeur : *« certains clients ont 8 chantiers, on s'attend à avoir 8 devis
  // alors qu'il y en a 0 »*. Un chantier naît d'une dictée, bien avant le
  // moindre document. Ce qui le remplace annonce ce que la fiche CONTIENT.
  //
  // **L'adresse et la pièce ont chacune LEUR ligne depuis la planche soignée.**
  // Collées sur une seule, il fallait choisir laquelle rogner (c'était
  // l'adresse, jamais la date) ; séparées, seule l'adresse peut encore se
  // rogner, et la pièce ne se coupe plus. **L'une ou l'autre peut manquer** :
  // la ligne se tait plutôt que d'annoncer un manque.
  const piece = phraseDeLaDerniere(client.derniere, aujourdHui);
  const du = resteDuDeLaLigne(client.du);

  const contenu = (
    <>
      {/* **L'appui long se VOIT pendant qu'il dure** : un voile monte sous le
          doigt en une demi-seconde. Sans lui, on ne sait pas s'il faut tenir
          encore, et l'on lâche trop tôt. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-4 -right-4 -z-10 origin-left"
        style={{
          backgroundColor: colors.rustTint,
          transform: appui.tenu ? "scaleX(1)" : "scaleX(0)",
          transition: appui.tenu ? `transform ${DUREE_APPUI_LONG}ms linear` : "none",
        }}
      />
      {choix && <CaseCochee cochee={choix.has(client.id)} />}
      {/* Les initiales : un visage pour chaque nom, dans le ton des plages. */}
      <span
        aria-hidden="true"
        className="grid h-11 w-11 flex-none place-items-center rounded-full text-[17px]"
        style={{ fontFamily: font.display, backgroundColor: colors.rustTint, color: colors.rust }}
      >
        {initialesDuClient(client.nom)}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-[18.5px] leading-[1.25] [overflow-wrap:anywhere]"
          data-atlas="nom-client"
          style={{ fontFamily: font.display, color: colors.ink }}
        >
          {/* **Ce qui a été trouvé se voit.** Sur quatre clients qui
              s'appellent Martins, une recherche sans marque ressemble à une
              recherche qui n'a pas filtré. */}
          <Surligne texte={client.nom} saisie={saisie} />
          {/* La goutte, collée au nom : un arrosage à hiverner (sa planche
              du 5 novembre 2026). Le nom reste ce qui se lit d'abord. */}
          {client.aHiverner && (
            <span className="ml-2 inline-block align-[-3px]">
              <Goutte libelle="Arrosage à hiverner" />
            </span>
          )}
        </span>
        {/* `inkSoft`, et non le gris des méta : `muted` tient 3,32 de
            contraste sur le fond crème, et c'est cette ligne-ci qui répond à
            « lequel des quatre Martins ? ». */}
        {client.adresse && (
          <span
            className="mt-[2px] block truncate text-[14px]"
            data-atlas="adresse-client"
            style={{ color: colors.inkSoft }}
          >
            {client.adresse}
          </span>
        )}
        {(piece || du) && (
          <span className="mt-[4px] flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            {piece && (
              <span className="whitespace-nowrap text-[14px]" data-atlas="piece-client" style={{ color: colors.inkSoft }}>
                {piece}
              </span>
            )}
            {/* Ce qui reste dû, d'un seul tenant et en rouge : c'est la seule
                chose qui demande un geste. Absent quand rien n'est dû. */}
            {du && (
              <span
                className="inline-flex min-h-[26px] flex-none items-center whitespace-nowrap rounded-full px-[10px] text-[14px] font-bold"
                data-atlas="reste-du"
                style={{
                  backgroundColor: colors.carteRougeFond,
                  color: colors.carteRougeTexte,
                  // Les chiffres d'une colonne s'alignent : « 740,00 € » et
                  // « 1 260,00 € » doivent tomber sur la même virgule.
                  fontVariantNumeric: "tabular-nums lining-nums",
                }}
              >
                {du}
              </span>
            )}
          </span>
        )}
      </span>

      {/* Pendant le choix, la ligne ne mène plus nulle part : le chevron
          qui promet une fiche s'efface. */}
      {!choix && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.chevron} strokeWidth="2" aria-hidden="true" className="flex-none">
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </>
  );
  const forme = `relative isolate flex w-full items-center gap-3 text-left ${
    dansUneLettre ? "min-h-[66px] pb-3 pt-2" : "min-h-[72px] py-3"
  }`;

  // **Pendant le choix, toucher une ligne la coche.** Elle devient un bouton :
  // un lien qui ne mènerait nulle part tromperait le lecteur d'écran.
  if (choix) {
    const coche = choix.has(client.id);
    return (
      <button
        type="button"
        aria-pressed={coche}
        data-atlas="cocher-client"
        onClick={() => {
          const suivant = new Set(choix);
          if (coche) suivant.delete(client.id);
          else suivant.add(client.id);
          choisir(suivant);
        }}
        className={forme}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {contenu}
      </button>
    );
  }

  return (
    <Link href={`/clients/${client.id}`} className={forme} style={APPUI_SANS_MENU} {...appui.gestes}>
      {contenu}
    </Link>
  );
}

/**
 * 480 ms : le délai d'un appui long sur iPhone, celui que son pouce connaît.
 */
const DUREE_APPUI_LONG = 480;

/**
 * Sans cela, iOS ouvre son propre menu sur un lien tenu (aperçu, copier,
 * partager) et sélectionne le nom : le choix ne s'ouvrirait jamais.
 */
const APPUI_SANS_MENU: React.CSSProperties = {
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  userSelect: "none",
};

/**
 * L'APPUI LONG SUR UN CLIENT OUVRE LE CHOIX — sa correction du 23 octobre
 * 2026 : *« on peut rester appuyé sur un client et ça met la même fonction »*,
 * plutôt qu'un bouton « Choisir » de plus à l'écran.
 *
 * **Un doigt qui glisse de plus de 10 px fait défiler la liste** : l'appui
 * s'annule, sinon chaque défilement lent cocherait un client. **Le clic qui
 * suit l'appui est avalé**, sans quoi le lien ouvrirait la fiche du client
 * qu'on vient de cocher.
 */
function useAppuiLong(declencher: () => void) {
  const [tenu, setTenu] = useState(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const avaler = useRef(false);

  function lacher() {
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = null;
    setTenu(false);
  }

  useEffect(() => lacher, []);

  return {
    tenu,
    gestes: {
      onPointerDown: (e: React.PointerEvent) => {
        // Un nouvel appui remet le compteur à zéro : le clic d'un appui long
        // peut ne jamais venir si la liste se redessine sous le doigt.
        avaler.current = false;
        if (e.button !== 0) return;
        depart.current = { x: e.clientX, y: e.clientY };
        setTenu(true);
        minuterie.current = setTimeout(() => {
          minuterie.current = null;
          setTenu(false);
          avaler.current = true;
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
          declencher();
        }, DUREE_APPUI_LONG);
      },
      onPointerMove: (e: React.PointerEvent) => {
        const d = depart.current;
        if (minuterie.current && d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) lacher();
      },
      onPointerUp: lacher,
      onPointerCancel: lacher,
      onPointerLeave: lacher,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      onClick: (e: React.MouseEvent) => {
        if (avaler.current) {
          avaler.current = false;
          e.preventDefault();
        }
      },
    },
  };
}

/**
 * Le volet « Trier par », aux mots de Terminés. Une date n'a pas de sens à
 * choisir : la toucher OUVRE le calendrier, tout de suite (sa correction du
 * 22 octobre 2026 : *« quand c'est marqué par date, que je puisse cliquer et
 * que le calendrier s'ouvre et que je puisse voyager dans le temps »*).
 *
 * La clé choisie se remplit du plein de la charte, pas d'encre : ses boutons
 * ne sont jamais noirs (sa planche du 22 octobre).
 */
function VoletTriClients({
  ouvert,
  tri,
  aujourdHui,
  fermer,
  trier,
}: {
  ouvert: boolean;
  tri: TriClients;
  aujourdHui: string;
  fermer: () => void;
  trier: (tri: TriClients) => void;
}) {
  const dessin = (pris: boolean): React.CSSProperties => ({
    fontFamily: font.display,
    fontSize: 19,
    color: pris ? surPlein : colors.ink,
    backgroundColor: pris ? colors.plein : colors.card,
    boxShadow: pris ? "none" : `inset 0 0 0 1px ${colors.line}`,
  });
  const forme = "mt-2 flex min-h-[54px] w-full items-center justify-center gap-[10px] rounded-full";
  return (
    <BottomSheet open={ouvert} onBackdropClick={fermer}>
      <div data-atlas="volet-tri-clients">
        <p className={`mb-2 text-center ${libelleCaps}`} style={{ color: colors.muted }}>
          Trier par
        </p>
        {CLES_TRI_CLIENTS.map(({ cle, libelle }) => {
          const pris = tri.cle === cle;
          if (cle === "nom") {
            return (
              <button
                key={cle}
                type="button"
                aria-pressed={pris}
                data-atlas="tri-clients-nom"
                onClick={() => trier({ cle: "nom" })}
                className={forme}
                style={dessin(pris)}
              >
                {libelle}
              </button>
            );
          }
          const date = cle as DateDeTri;
          return (
            <OuvrirLeCalendrier
              key={cle}
              jour={tri.cle === date ? `${tri.mois}-01` : aujourdHui}
              choisir={(jour) => {
                const mois = moisDuJour(jour);
                if (mois) trier({ cle: date, mois });
              }}
              dataAtlas={`tri-clients-${cle}`}
              className={forme}
              style={dessin(pris)}
            >
              {libelle}
              <SigneCalendrier couleur={pris ? surPlein : colors.plein} />
            </OuvrirLeCalendrier>
          );
        })}
        <button type="button" onClick={fermer} className="mt-3 w-full py-3 text-[14px]" style={{ color: colors.muted }}>
          Fermer
        </button>
      </div>
    </BottomSheet>
  );
}

/**
 * Ce qui ouvre le calendrier du téléphone : la case de date elle-même, rendue
 * invisible et posée sur ce qu'on touche. Le doigt la touche donc directement,
 * et iOS ouvre son calendrier : un bouton qui l'ouvrirait « à distance » peut
 * être refusé sans un mot. Le même geste que le mois de `FiltreDeDate`.
 */
function OuvrirLeCalendrier({
  jour,
  choisir,
  dataAtlas,
  className,
  style,
  children,
}: {
  jour: string;
  choisir: (jour: string) => void;
  dataAtlas: string;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <label className={`relative cursor-pointer ${className}`} style={style} data-atlas={dataAtlas}>
      {children}
      {/* `fontSize: 16` : en dessous, iOS agrandit la page à l'ouverture. */}
      <input
        type="date"
        aria-label="Choisir un jour"
        value={jour}
        onChange={(e) => {
          if (e.target.value) choisir(e.target.value);
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        style={{ fontSize: 16 }}
      />
    </label>
  );
}

/** Le signe du calendrier, à côté d'une date qui l'ouvre. */
function SigneCalendrier({ couleur = colors.plein }: { couleur?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke={couleur} strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
      <path d="M3 8.5h14M7 2.5v4M13 2.5v4" strokeLinecap="round" />
    </svg>
  );
}
