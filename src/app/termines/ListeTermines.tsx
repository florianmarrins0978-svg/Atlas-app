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
  libelleEtatLigne,
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

  /**
   * L'année du jour, tirée du mois que le SERVEUR a décidé.
   *
   * C'est elle qui dit si la date d'un chantier s'écrit avec son année
   * (`libelleDateChantier`). La relire d'un `new Date()` ici rendrait une année
   * au serveur et une autre au client au passage de minuit, et React refuserait
   * l'hydratation — le même piège que `moisCourant` juste en dessous.
   */
  const annee = moisCourant.slice(0, 4);

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
      {/* **28 px au lieu de 22, et 44 px de haut au lieu de 40 — « le calme »,
          sa proposition A du 2 septembre 2026** (`appli/termines-elegance.html`).
          Les 44 px ne sont pas un goût : c'est la mesure que tout le reste de
          l'application tient déjà pour un pouce, sur un chantier, parfois avec
          des gants. Ces onglets étaient les seuls à 40. */}
      <div className="mx-[26px] mt-7 flex gap-2">
        <Onglet repere="tout" actif={onglet === "tout"} onClick={() => setOnglet("tout")}>
          Tout
        </Onglet>
        <Onglet repere="attente" actif={onglet === "attente"} onClick={() => setOnglet("attente")}>
          À facturer
        </Onglet>
      </div>

      {onglet === "attente" ? (
        <section className="mx-[26px] mt-8" data-atlas="tout-ce-qui-attend">
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
                <Ligne key={l.id} ligne={l} annee={annee} />
              ))}
            </>
          )}
        </section>
      ) : (
        <section className="mx-[26px] mt-8" data-atlas="le-mois">
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

                  **Le trait sous elle était la démarcation qu'il a demandée**
                  le 23 août — *« essaye de laisser un peu d'espace entre cette
                  phrase-là et le premier client, histoire qu'on fasse bien la
                  démarcation »*. **Il est parti le 26** : *« tous les traits
                  supprimés entre chaque ligne »*.

                  **C'est l'espace qui le remplace, et c'est ce qu'il avait
                  demandé au départ** — le trait avait été préféré parce que de
                  l'espace seul se mange au premier ajout de contenu. La
                  démarcation tient donc maintenant sur les 22 px de la première
                  ligne, et c'est à surveiller : une ligne qui reviendrait à 19
                  la ferait disparaître sans que rien ne rougisse.

                  **Toute la phrase est en noir gras** — c'était déjà sa demande
                  du 22 août pour le compte des factures, et les montants partis,
                  il ne reste plus rien à mettre en retrait : deux graisses pour
                  deux mots feraient une hiérarchie sans objet. */}
              <p
                className="mb-3 mt-3.5 text-[14px] font-bold leading-[1.6]"
                style={{ color: colors.ink }}
                data-atlas="compte-du-mois"
              >
                {attente.length > 0 && (
                  <>
                    {/* **« À facturer » en or — sa correction du 23 août au
                        soir.** L'or porte ici ce qu'il porte déjà sur les lignes
                        en dessous (« Pas encore facturé · 360,00 € prévus ») :
                        ce qui attend un geste de lui. Deux comptes du même noir
                        se lisaient comme un seul chiffre coupé en deux. */}
                    <span style={{ color: colors.or }}>{attente.length} à facturer</span>
                    {" · "}
                  </>
                )}
                {faites.length} facturé{faites.length > 1 ? "s" : ""}
              </p>
              {mois.lignes.map((l) => (
                <Ligne key={l.id} ligne={l} annee={annee} />
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
      {/* **26 px au lieu de 21 — « le calme », sa proposition A du 2 septembre
          2026** (`appli/termines-elegance.html`). C'est ce nom qui dit où l'on
          est dans la page ; à 21 px il avait exactement le corps d'un nom de
          client — 17 px de serif, à trois centimètres en dessous —, et l'écran
          n'avait plus de repère. Les deux pixels de marge resserrent
          « ‹ Août 2026 › » en UN objet, au lieu de trois signes qui se suivent. */}
      <span
        style={{
          fontFamily: font.display,
          fontSize: 26,
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          marginInline: 2,
        }}
      >
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
      className="flex h-11 w-[34px] items-center justify-center text-[22px] leading-none"
      style={{
        fontFamily: font.display,
        color: desactivee ? colors.line : colors.or,
        marginLeft: sens === "passe" ? -9 : 0,
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
      className="mb-3 mt-0.5 text-[13px] font-bold leading-[1.55]"
      style={{ color: colors.ink }}
      data-atlas="compte-du-mois"
    >
      {children}
    </p>
  );
}

function Onglet({
  repere,
  actif,
  onClick,
  children,
}: {
  /**
   * Ce que vise un contrôle, plutôt que le libellé.
   *
   * **Posé le 26 août 2026.** Une suite cherchait l'onglet par son texte —
   * « À facturer » — et le jour où il le fera changer, elle rougira sur du code
   * juste (`CLAUDE.md` §5 bis). Un repère survit au mot.
   */
  repere: "tout" | "attente";
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-atlas={`onglet-${repere}`}
      aria-pressed={actif}
      // **L'onglet actif est un galet — sa demande du 2 septembre 2026** :
      // *« code l'idée du galet aussi pour le bouton Tout et À facturer »*.
      //
      // **Seul l'ACTIF le prend, et c'est ce qui garde l'écran lisible.** Deux
      // galets côte à côte ne diraient plus lequel des deux on regarde : un
      // onglet ne se distingue que de son voisin. L'éteint garde donc son
      // cheveu et son gris.
      //
      // **Il perd son fond noir au passage.** Ce n'est pas une perte : le noir
      // était le seul aplat d'encre de l'écran, et il ne se rattachait à rien —
      // ni au vert des actions, ni à l'or de ce qu'on lit.
      className={`min-h-11 rounded-full px-[18px] text-[13px] ${
        actif ? "atlas-plein atlas-galet" : ""
      }`}
      style={
        actif
          ? { WebkitTapHighlightColor: "transparent" }
          : {
              backgroundColor: "transparent",
              color: colors.muted,
              boxShadow: `inset 0 0 0 1px ${colors.line}`,
              WebkitTapHighlightColor: "transparent",
            }
      }
    >
      {children}
    </button>
  );
}

/**
 * Une ligne : le nom, la date du chantier, et le montant — ou le bouton.
 *
 * **La date est arrivée le 31 août 2026**, à sa demande : *« à côté du nom du
 * client il faudrait inscrire la date à laquelle le chantier a été réalisé »*.
 * Quatre places lui ont été dessinées (`appli/termines-date-du-chantier.html`,
 * essayables au doigt) ; il a retenu la **B** — la date ouvre la deuxième ligne,
 * devant le montant. Elle y coûte zéro pixel de hauteur, et laisse au nom toute
 * sa largeur : sur la ligne du nom, un nom long se serait coupé pour elle.
 *
 * **« Pas encore facturé » est parti le même soir**, à sa demande devant la
 * planche. La capsule « À FACTURER », à trois centimètres sur la même ligne,
 * disait déjà exactement cela. **Une rangée peut donc n'avoir PLUS DE DEUXIÈME
 * LIGNE du tout** — pas de date, pas de devis envoyé : on n'écrit rien plutôt
 * que d'inventer.
 *
 * **Toute la ligne mène à la facture, et il n'y a qu'UN lien.** La capsule
 * « Facturer » est un `span` à l'intérieur : deux liens superposés dans la même
 * rangée se disputent le pouce, et le contrôle qui compte les liens de la
 * rangée ne saurait plus lequel viser.
 *
 * **« Facturer » ouvre l'écran de facture, il ne facture pas.** Rien ne part
 * chez un client sans un geste du patron (`docs/AGENT.md` §6).
 */
function Ligne({ ligne, annee }: { ligne: LigneAffichee; annee: string }) {
  const etat = libelleEtatLigne(ligne, annee);
  return (
    <Link
      href={`/chantiers/${ligne.id}/facture`}
      data-atlas="ligne-terminee"
      // **Aéré le 23 août 2026, à sa demande** : *« il faut aérer un peu la
      // page parce qu'il y a énormément d'informations »*. Une ligne porte deux
      // étages de texte et parfois une capsule de 44 px ; à 14 px de marge, le
      // trait du dessous touchait presque le second étage, et douze lignes se
      // lisaient comme un bloc.
      //
      // **LE TRAIT EST PARTI LE 26 AOÛT 2026** — *« tous les traits supprimés
      // entre chaque ligne »*, planche `appli/termines-sans-traits.html`.
      //
      // **Et l'espace a dû grandir avec, ce n'est pas un retrait sec.** Le
      // trait faisait la moitié du travail : c'est lui qui séparait le second
      // étage d'une ligne du nom de la suivante. Retiré à marge égale, deux
      // rangées voisines se lisent comme une seule — le nom du chantier suivant
      // paraît appartenir à l'état du précédent. 19 px de respiration deviennent
      // donc 24, et la PREMIÈRE ligne en garde 22 pour tenir la démarcation
      // qu'il avait demandée le 23 août sous la phrase de compte.
      //
      // **L'ALIGNEMENT CHANGE LE 2 SEPTEMBRE 2026 — « le calme », sa
      // proposition A** (`appli/termines-elegance.html`). `items-center`
      // centrait le montant sur la HAUTEUR de la rangée : sur une rangée à deux
      // étages — le nom, puis la date et l'état — il se posait à mi-chemin
      // entre les deux, aligné sur rien. Douze montants d'affilée ne faisaient
      // donc pas une colonne, alors que c'est exactement ce qu'on vient lire.
      // En ligne de base, le montant se pose sur le NOM.
      //
      // **Sauf quand la rangée porte la capsule**, qui garde le centrage : une
      // pastille de 44 px n'a pas de ligne d'écriture, et l'aligner sur une
      // lettre la ferait descendre sous la rangée.
      className={`flex ${
        ligne.aFacturer ? "items-center" : "items-baseline"
      } gap-3.5 py-[24px] first:pt-[22px]`}
      style={{ minWidth: 0 }}
    >
      <span className="min-w-0 flex-1">
        <b
          className="block truncate font-normal"
          style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.2, color: colors.ink }}
        >
          {ligne.nom}
        </b>
        {/* **La ligne d'état s'enroule, elle ne se coupe pas.** Vu sur une
            capture de l'écran, avec de vrais montants : « 12 août ·
            1 764,00 € prévus » perdrait « prévus », et parfois le montant
            lui-même. Le NOM, lui, reste sur une ligne — un nom se reconnaît
            tronqué, un chiffre coupé ne se devine pas.

            **Vide, elle n'existe pas.** Un `span` vide laisserait ses 5 px de
            marge et un interligne : la rangée paraîtrait porter une information
            qu'on n'arrive pas à lire. */}
        {/* **CETTE LIGNE PASSE À L'ENCRE DOUCE LE 2 SEPTEMBRE 2026 — « le
              calme », sa proposition A.** Elle s'écrivait en or quand la rangée
              attendait, en gris quand elle était facturée. Mesuré sur le crème
              d'Origine : l'or tient **2,8** de contraste et le gris **3,4** ; il
              en faut 4,5 pour un texte de 13 px. `inkSoft` en tient **8,0**.

              **Sa scène d'usage tranche** (`PRODUCT.md`) : debout, une main, en
              plein soleil. Ces deux lignes-là étaient les premières à
              disparaître, et ce sont elles qui portent la date et le montant
              prévu.

              **Ce qui remplace l'or n'est pas rien.** Le signal « ça attend »
              ne repose plus sur une nuance de couleur mais sur la CAPSULE, à
              trois centimètres sur la même rangée — un objet vert de 44 px qui
              se voit de loin, là où une teinte se devine. L'or n'a pas quitté
              l'écran : il porte toujours « 3 à facturer » au-dessus de la
              liste, en gras, où il a la place de se voir. */}
        {etat !== "" && (
          <span
            className="mt-[5px] block text-[13px] leading-[1.5]"
            style={{ color: colors.inkSoft, fontVariantNumeric: "tabular-nums" }}
            data-atlas="etat-ligne"
          >
            {etat}
          </span>
        )}
      </span>
      {ligne.aFacturer ? (
        <span
          // **Il l'a demandée dedans le 31 août**, après avoir vu la liste des
          // écartés : elle prend le vert des boutons pleins et leur geste. Elle
          // vit à l'intérieur du lien de la ligne — l'appuyer active donc bien
          // l'étiquette elle-même, et le geste se voit.
          // **ELLE PREND LE GALET LE 2 SEPTEMBRE 2026 — sa déclinaison 4**
          // (`appli/facturer-note-vocale.html`), après sa demande de la mettre
          // « de la même couleur que la note vocale ».
          //
          // **Le fond et le mot ne s'écrivent plus ici**, et c'est la règle du
          // dépôt : la matière du galet est FIXE sur les huit chartes — elle ne
          // suit pas `rust`, qui devient clair sur Nuit et Sylve —, donc elle
          // vit dans `globals.css` avec le blanc qui va dessus, comme celle du
          // micro. Un `backgroundColor` laissé ici l'écraserait sur cinq
          // chartes et la casserait sur deux.
          className="atlas-plein atlas-galet flex min-h-11 flex-none items-center rounded-full px-[17px] text-[12.5px] font-semibold uppercase"
          style={{ letterSpacing: "0.12em" }}
          // **Un repère plutôt que son texte** (`CLAUDE.md` §5 bis) : la capsule
          // s'appelait « Facturer » jusqu'au 31 août 2026, et les contrôles qui
          // la cherchaient par son libellé ont rougi sur du code juste le jour
          // où il l'a fait changer.
          data-atlas="capsule-a-facturer"
        >
          À facturer
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
