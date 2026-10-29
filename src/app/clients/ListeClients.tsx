"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, libelleCaps, surPlein, voile } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { ChampRecherche } from "@/components/atlas/ChampRecherche";
import BoutonFiltre from "@/components/atlas/BoutonFiltre";
import BottomSheet from "@/components/atlas/BottomSheet";
import FeuilleSuppressionClients, { CaseCochee, type PieceGardee } from "@/components/atlas/FeuilleSuppressionClients";
import { oublierCetEcran } from "@/components/atlas/journal-navigateur";
import { supprimerClientAction } from "./[id]/actions";
import { apercuSuppressionClientsAction } from "./actions";
import { grouperEnBandes } from "@/lib/bandes-clients";
import {
  jourDeLaLigne,
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
  // **Trié par date, la ligne montre la pièce DU MOIS** (`clientsDuMois`),
  // pas sa plus récente : un titre qui dit juin 2017 au-dessus d'une ligne qui
  // dit 2024 se lirait comme une erreur.
  const dansLeTri = useMemo(
    () =>
      tri.cle === "nom"
        ? clients
        : clientsDuMois(clients, tri.cle, tri.mois).map((c) => ({ ...c, derniere: c.piece })),
    [clients, tri]
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
    () => ({ saisie, poser, total: dansLeTri.length, visibles, piecesTrouvees, aujourdHui, tri, trier, choix, choisir }),
    [saisie, dansLeTri.length, visibles, piecesTrouvees, aujourdHui, tri, choix]
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
      <span className="block min-h-[14px]" data-atlas="compte-clients" style={{ color: colors.ink }}>
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
    <span className="block min-h-[14px]" data-atlas="compte-clients">
      {texte}
    </span>
  );
}

export default function ListeClients({
  sousLaRecherche = null,
}: {
  /** Ce qui se pose sous la recherche, et ne colle pas avec elle : la porte de l'import. */
  sousLaRecherche?: React.ReactNode;
}) {
  const { saisie, poser, visibles, piecesTrouvees, aujourdHui, tri, trier, choix, choisir, total } = useRecherche();
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
        className="sticky top-0 z-[5] px-[26px] pb-[14px] pt-[18px]"
        style={{
          backgroundColor: colors.cream,
          boxShadow: posee ? `0 1px 0 ${colors.line}` : "none",
          transition: "box-shadow 180ms ease-out",
        }}
      >
        <ChampRecherche
          valeur={saisie}
          onChange={poser}
          placeholder={AIDE_DE_LA_LOUPE}
          ariaLabel={AIDE_DE_LA_LOUPE}
          dataAtlas="chercher-client"
        />
        {/* **LE FILTRE DE TERMINÉS, sa demande du 22 octobre 2026**
            (`appli/facture-mairie-chorus.html`) : retrouver un devis de 2017
            dans dix ans de dossiers. Sous la recherche, à droite, comme sur
            Terminés ; ses couleurs ne changent pas quand il agit (*« pas
            vert »*) : c'est le titre du mois qui le dit. */}
        {/* **« Tout » n'existe que pendant le choix** — sa demande du
            23 octobre 2026. Sur la liste normale, rien ne permet de tout cocher
            d'un doigt : il faut d'abord rester appuyé sur un client. */}
        <div className="mt-[10px] flex justify-end">
          <BoutonFiltre onClick={() => setVolet(true)} />
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
          className="mx-[26px] mt-[6px] flex min-h-11 items-center gap-[14px] text-[15px]"
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
          className="mx-[26px] mt-[22px] max-w-[31ch] text-[13px] leading-[1.6]"
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
        <ul className="mx-[26px] mt-[6px] flex flex-col">
          {visibles.map((c, i) => (
            <li key={c.id}>
              <LigneClient client={c} saisie={saisie} aujourdHui={aujourdHui} dernier={i === visibles.length - 1} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-[6px]">
          {bandes.map((groupe, iBande) => (
            <section key={groupe.bande}>
              {/* **Pendant une recherche, aucune bande.** Sur quatre lignes
                  trouvées, un titre de lettre au-dessus de chacune serait le
                  bruit que le repère devait réduire. */}
              {!cherche && (
                <p
                  className={`mx-[26px] mb-[2px] ${iBande === 0 ? "mt-[14px]" : "mt-[24px]"} ${libelleCaps}`}
                  style={{ color: colors.muted }}
                >
                  {groupe.bande}
                </p>
              )}
              <ul className="mx-[26px] flex flex-col">
                {groupe.clients.map((c) => (
                  <li key={c.id}>
                    <LigneClient
                      client={c}
                      saisie={saisie}
                      aujourdHui={aujourdHui}
                      // Le filet ferme chaque ligne sauf la toute dernière de
                      // l'écran : un trait au ras du vide n'y sépare rien.
                      dernier={
                        iBande === bandes.length - 1 &&
                        c.id === groupe.clients[groupe.clients.length - 1].id
                      }
                    />
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
    <section className="mx-[26px] mt-[18px]" data-atlas="pieces-trouvees">
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
  dernier,
}: {
  client: FicheClientListee;
  saisie: string;
  /** Le jour tel que le SERVEUR le compte — voir `FournisseurClients`. */
  aujourdHui: string;
  dernier: boolean;
}) {
  const { choix, choisir } = useRecherche();
  const appui = useAppuiLong(() => choisir(new Set([client.id])));
  // **Le compte de chantiers a quitté cette ligne le 9 septembre 2026.** Il
  // était juste — tous les chantiers ouverts — et c'est ce qui le rendait
  // trompeur : *« certains clients ont 8 chantiers, on s'attend à avoir 8 devis
  // alors qu'il y en a 0 »*. Un chantier naît d'une dictée, bien avant le
  // moindre document. Ce qui le remplace annonce ce que la fiche CONTIENT.
  //
  // Le lieu d'abord, parce que c'est lui qu'on cherche du regard quand quatre
  // clients s'appellent Martins ; ce qui s'est passé ensuite. **L'un ou l'autre
  // peut manquer** — un client saisi à la volée n'a pas d'adresse, un client
  // tout neuf n'a rien envoyé —, et la ligne se tait alors plutôt que
  // d'annoncer un manque qu'il n'a pas demandé à combler.
  const quandQuoi = client.derniere
    ? `${client.derniere.quoi} ${jourDeLaLigne(client.derniere.jour, aujourdHui)}`
    : null;
  const du = client.du !== null && Number(client.du) > 0 ? client.du : null;

  const contenu = (
    <>
      {/* **L'appui long se VOIT pendant qu'il dure** : un voile monte sous le
          doigt en une demi-seconde. Sans lui, on ne sait pas s'il faut tenir
          encore, et l'on lâche trop tôt. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-[26px] -right-[26px] -z-10 origin-left"
        style={{
          backgroundColor: colors.rustTint,
          transform: appui.tenu ? "scaleX(1)" : "scaleX(0)",
          transition: appui.tenu ? `transform ${DUREE_APPUI_LONG}ms linear` : "none",
        }}
      />
      {choix && <CaseCochee cochee={choix.has(client.id)} />}
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[17.5px] leading-[1.25]"
          data-atlas="nom-client"
          style={{ fontFamily: font.display, color: colors.ink }}
        >
          {/* **Ce qui a été trouvé se voit.** Sur quatre clients qui
              s'appellent Martins, une recherche sans marque ressemble à une
              recherche qui n'a pas filtré. */}
          <Surligne texte={client.nom} saisie={saisie} />
        </span>
        {/* **Rien à dire, rien à l'écran — et pas même la place.** Un client
            sans adresse ET sans document laissait une seconde ligne VIDE sous
            son nom : un trou de dix-huit pixels qui se lit comme un défaut
            d'affichage. Trouvé à la capture le 9 septembre 2026, jamais par un
            test — la cinquième fois dans ce dépôt (`CLAUDE.md` §5). */}
        {(client.adresse || quandQuoi) && (
          <span
            className="mt-[3px] flex items-baseline text-[12.5px] leading-[1.45]"
            data-atlas="situation-client"
            // Voir plus haut : `muted` ne tient pas la lecture au soleil, et
            // c'est cette ligne-ci qui répond à « lequel des quatre Martins ? ».
            style={{ color: colors.inkSoft }}
          >
            {/* **C'EST L'ADRESSE QUI SE ROGNE, JAMAIS LA DATE — mesuré, pas
                supposé.** Sur les 316 px de sa ligne, « 10 Rue de Nantes 77400
                Lagny-sur-Marne, Devis 7 sept. » déborde de trois caractères.
                Écrits d'un seul tenant, ce sont les DERNIERS mots qui tombent :
                la date disparaîtrait exactement chez les clients dont l'adresse
                est longue, c'est-à-dire là où l'on ajoutait quelque chose.
                Séparés, l'adresse perd sa fin — sa ville — et garde son numéro
                et sa rue, qui sont ce qui distingue quatre Martins. */}
            {client.adresse && <span className="min-w-0 truncate">{client.adresse}</span>}
            {quandQuoi && (
              // **La virgule se COLLE à l'adresse, donc plus aucune marge.**
              // Le point du milieu portait une marge de 5 px, parce qu'une
              // boîte flexible mange le blanc qui la commence et qu'on lisait
              // « 44300 Nantes· Devis 5 sept. ». Une virgule, elle, ne se
              // décolle pas du mot qu'elle suit : la marge la ferait flotter.
              <span className="flex-none whitespace-nowrap">
                {client.adresse ? `, ${quandQuoi}` : quandQuoi}
              </span>
            )}
          </span>
        )}
      </span>

      {/* Ce qui reste dû passe avant tout le reste : c'est la seule chose qui
          demande un geste. Absent quand rien n'est dû — un « 0 € » en face de
          chaque nom ferait un tableau de bord, exactement ce qu'il refuse. */}
      {du !== null && (
        <span className="flex-none text-right" data-atlas="reste-du">
          <span
            className="block text-[16px] font-medium leading-[1.15]"
            style={{
              color: colors.alert,
              // Les chiffres d'une colonne s'alignent : « 740,00 € » et
              // « 1 260,00 € » doivent tomber sur la même virgule.
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {enEuros(du)}
          </span>
          <span className={`mt-[3px] block ${libelleCaps}`} style={{ color: colors.alert }}>
            dus
          </span>
        </span>
      )}

      {/* Pendant le choix, la ligne ne mène plus nulle part : le chevron
          qui promet une fiche s'efface. */}
      {!choix && (
        <span
          aria-hidden="true"
          className="h-2 w-2 rotate-45"
          style={{
            flex: "none",
            borderRight: `1.5px solid ${colors.chevron}`,
            borderTop: `1.5px solid ${colors.chevron}`,
          }}
        />
      )}
    </>
  );
  const forme = "relative isolate flex min-h-[64px] w-full items-center gap-[14px] py-[13px] text-left";
  const trait = { borderBottom: dernier ? undefined : `1px solid ${colors.line}` };

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
        style={{ ...trait, WebkitTapHighlightColor: "transparent" }}
      >
        {contenu}
      </button>
    );
  }

  return (
    <Link href={`/clients/${client.id}`} className={forme} style={{ ...trait, ...APPUI_SANS_MENU }} {...appui.gestes}>
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
