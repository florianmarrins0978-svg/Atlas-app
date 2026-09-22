"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { colors, font, surPlein } from "@/lib/design-tokens";
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
 * facturation »*. L'œil ouvert ignore donc le mois affiché — un chantier de
 * juillet jamais facturé se voit encore en août, sinon il faudrait déjà savoir
 * qu'il existe pour aller le chercher. C'était la règle de l'onglet
 * « À facturer » ; l'onglet est parti le 13 septembre 2026, la règle reste.
 */
export default function ListeTermines({
  lignes,
  retoursNonLus,
  moisCourant,
}: {
  lignes: LigneAffichee[];
  /**
   * Combien de retours d'intervention l'entreprise porte — TOUS mois confondus.
   *
   * Sa règle du 8 septembre 2026 : *« il faut pouvoir les garder longtemps »*.
   * Le compte ignore donc le mois affiché, exactement comme « À facturer »
   * l'ignore déjà : un retour de 2024 compte toujours.
   */
  /**
   * Combien il n’a pas encore ouverts — c’est ce que la pastille montre.
   *
   * **Sa correction du 9 septembre 2026** : *« il faut que le nombre qui
   * s’affiche soit celui-là, et pas combien il y en a à l’intérieur »*. Un
   * total ne descend jamais à zéro, et une pastille qui ne s’éteint pas
   * s’apprend à être ignorée — le jour où un retour compte vraiment, elle
   * ressemble à celle de la veille.
   */
  retoursNonLus: number;
  /**
   * `AAAA-MM` du jour, calculé sur le SERVEUR.
   *
   * Le lire dans le navigateur ferait rendre au serveur un mois et au client un
   * autre pour qui n'est pas au même fuseau — React refuse alors l'hydratation,
   * et l'écran fige à ce qu'il était.
   */
  moisCourant: string;
}) {
  /**
   * L'œil : fermé (barré), on voit tout — c'est le mode d'origine ; ouvert, on
   * ne voit que ce qui attend. Sa demande du 13 septembre 2026 : *« par défaut
   * on doit tout voir et on clique pour voir seulement les à facturer »*.
   */
  const [oeilOuvert, setOeilOuvert] = useState(false);

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
  // Un œil ouvert sur rien ne montre rien : dès que la dernière facture part,
  // on revient à tout — sans quoi l'écran resterait vide sous un bouton parti.
  const montrerCeQuiAttend = oeilOuvert && attente.length > 0;

  return (
    <div data-atlas="liste-termines">
      {/* ─── DEUX PORTES, ET PLUS AUCUN ONGLET — sa demande du 13 septembre 2026
          *« Sous la TVA, garde que deux boutons : Retours d'intervention et
          Créer une facture. Je voudrais qu'on supprime le bouton Tout, que ça
          soit le mode par défaut, et qu'on garde que le bouton À facturer. »*
          Planche `appli/termines-l-oeil.html`, retenue le soir même :
          *« Très bien, et par défaut on doit tout voir et on clique pour voir
          seulement les à facturer. »*

          **« Tout » et « À facturer » ont quitté cette rangée**, et le filtre
          vit désormais dans la phrase de comptes, sous le mois : c'est l'ŒIL,
          plus bas. Il ne reste ici que ce qui OUVRE une page — les deux
          portes —, et elles tiennent sur une seule rangée : 44 px de haut, le
          bord droit sur la marge de 26 px, comme le 11 septembre. À 360 px la
          rangée se replie, et « Créer une facture » passe dessous, à droite.

          **28 px sous la carte — « le calme », sa proposition A du 2 septembre
          2026** (`appli/termines-elegance.html`). */}
      <div
        className="mx-[26px] mt-7 flex flex-wrap justify-between gap-2"
        data-atlas="portes-termines"
      >
        {/* ─── LES RETOURS D'INTERVENTION — sa décision du 8 septembre 2026 ───
            *« Dans la catégorie terminé il faut rajouter une sous-catégorie,
            comme tu as fait, à côté de "à facturer" : mettre la sous-catégorie
            retour d'intervention. On clique dessus et on arrive sur une page
            où seront listés tous les retours par client. »*

            **IL EST TOUJOURS LÀ, même quand il n'y a aucun retour — sa
            correction du 9 septembre 2026 :** *« l'onglet retour
            d'intervention doit exister même s'il n'y a aucun retour qui
            existe ! »*

            Je l'avais caché tant que la liste était vide, au motif qu'un
            onglet qui n'ouvre rien s'apprend à ne plus être touché. Il a
            raison contre ça : un onglet qui apparaît un jour et pas l'autre
            se cherche, et le premier retour de son salarié arriverait dans un
            endroit dont il ignore l'existence. **La page vide, elle, dit ce
            qui l'attend** — c'est ce que fait `ListeDesRetours`. */}
        <Link
          href="/termines/retours"
          data-atlas="onglet-retours"
          className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] no-underline"
          style={{
            backgroundColor: colors.card,
            color: colors.inkSoft,
            boxShadow: `inset 0 0 0 1px ${colors.line}`,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Retours d&apos;intervention
          {/* **La pastille ne compte QUE ce qu’il n’a pas lu, et disparaît
              quand il a tout vu** — sa correction du 9 septembre 2026. Un
              nombre qui reste allumé pour toujours ne dit plus rien : le
              jour où un retour compte vraiment, il ressemble à la veille.

              **L’onglet, lui, reste** tant qu’il existe des retours : sans
              quoi la page devient inatteignable le soir où il a tout lu. */}
          {retoursNonLus > 0 && (
            <span
              data-atlas="compte-des-non-lus"
              className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold"
              style={{ backgroundColor: colors.or, color: colors.cream }}
            >
              {retoursNonLus}
            </span>
          )}
        </Link>

        {/* ─── CRÉER UNE FACTURE SANS DEVIS — sa demande du 11 septembre 2026 ──
            *« Sous retour d'intervention, collé à droite, tu mets créer une
            facture en doré, comme tu as fait le bouton vide contour doré. »*

            **Pourquoi ici, et pas sur l'accueil.** Il l'avait d'abord posée sur
            l'écran des chantiers, puis s'est ravisé le lendemain : *« est-ce que
            c'est pas plus logique de mettre la porte dans la catégorie
            Terminés ? »* — et il a raison. Un dépannage réglé sur place est du
            travail FINI ; « Vos chantiers » liste ce qui est en cours, et le
            chantier créé par ce bouton part de toute façon droit dans Terminés.

            **Sur la même rangée depuis le 13 septembre 2026.** Elle vivait sur
            une seconde rangée parce que les trois onglets prenaient 300 px sur
            les 306 d'un écran de 360 ; deux d'entre eux partis, la place est
            là — et `ml-auto` la garde à droite même quand la rangée se replie.

            **À DROITE ET EN OR, et ce n'est pas de l'ornement.** Le contour
            vide plutôt qu'un aplat : le vert plein dit « c'est ce que vous
            regardez », ce qui n'est pas ce qu'on veut dire ici.

            **C'est un LIEN, comme « Vos clients ».** Il mène à la fiche client,
            qui prépare la facture au lieu du devis — le même écran, le même
            geste, `?facture=1` en décidant (`chantiers/nouveau/page.tsx`). */}
        <Link
          href="/chantiers/nouveau?facture=1"
          data-atlas="creer-une-facture"
          className="ml-auto flex min-h-11 flex-none items-center justify-center whitespace-nowrap rounded-full px-3.5 text-[12.5px] no-underline"
          style={{
            color: colors.or,
            boxShadow: `inset 0 0 0 1px ${colors.or}`,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Créer une facture
        </Link>
      </div>

      {/* ─── AUCUN CHANTIER TERMINÉ, ET LES PORTES RESTENT — 11 septembre 2026
          Cet état vivait dans `page.tsx`, À LA PLACE de cette liste entière :
          sans un seul chantier terminé, ni les onglets, ni « Retours
          d'intervention », ni « Créer une facture » n'existaient. Vu à la
          capture, sur une base neuve — c'est-à-dire chez tout artisan qui ouvre
          Atlas pour la première fois, et dont le premier geste est justement un
          dépannage réglé sur place, sans devis.

          Un écran qui cache sa porte tant qu'on n'a jamais rien fini est un
          cul-de-sac : c'est la règle qu'il a posée le 9 septembre pour les
          retours (*« l'onglet doit exister même s'il n'y a aucun retour »*),
          appliquée ici pour la même raison. La phrase, elle, ne change pas. */}
      {lignes.length === 0 ? (
        <p className="mt-8 px-[26px] text-[13px] leading-[1.7]" style={{ color: colors.muted }}>
          Vos chantiers apparaîtront ici une fois leur date d&apos;intervention passée.
        </p>
      ) : (
        <section
          className="mx-[26px] mt-8"
          // Le repère change avec ce que la section MONTRE : les suites qui
          // attendent « tout ce qui attend » le trouvent au même endroit que du
          // temps de l'onglet, sans dépendre d'un libellé (`CLAUDE.md` §5 bis).
          data-atlas={montrerCeQuiAttend ? "tout-ce-qui-attend" : "le-mois"}
        >
          {/* **Le mois est CENTRÉ — sa demande du 13 septembre 2026.** Et il se
              met EN VEILLE quand l'œil est ouvert : ce qu'on voit alors ignore
              le mois (règle du 22 août, en tête de fichier), et des flèches qui
              feuilletteraient une liste qui ne bouge pas feraient croire
              l'écran cassé. Le nom reste à sa place, en retrait : une ligne qui
              disparaît se cherche, une ligne qui s'éteint se comprend. */}
          <NavigationMois
            cle={cle}
            peutReculer={cle > plancher}
            peutAvancer={cle < borne}
            enVeille={montrerCeQuiAttend}
            surMois={setCle}
          />
          {/* **Sa phrase, ici — 23 août 2026 —, réduite à ses DEUX
              COMPTES le soir même** : *« là où il y a écrit trois à
              facturer et huit facturés, supprime les montants qu'il y a
              avec »*.

              **Elle compte TOUS les mois**, pas seulement celui qu'on
              regarde : c'est ainsi qu'elle a été demandée. Ses montants
              disaient donc des sommes que la liste en dessous ne montrait
              pas — trois chiffres d'origines différentes sur deux lignes.

              **ET DEPUIS LE 13 SEPTEMBRE 2026, C'EST ELLE QUI FILTRE.** Sa
              demande, planche `appli/termines-l-oeil.html` : *« laisser
              14 facturés en gras et 3 à facturer en gras doré, mais à côté
              tu mets le signe œil barré ; on clique dessus, ça montre les
              à facturer ; on reclique, il disparaît, on revient sur le mode
              tout par défaut »*. L'onglet « À facturer » disait la même
              chose que « 3 à facturer », à trois centimètres d'écart — il
              est parti, et le geste vit sur le chiffre lui-même.

              **17 px au lieu de 14 — « mets-les en plus gros », le même
              soir.** Et la phrase ne se montre que s'il y a quelque chose
              à compter : *« quand il n'y a rien à facturer ou de facturé,
              supprime la phrase »*. Sans rien qui attend, l'œil part avec
              son compte — il n'aurait rien à montrer.

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

              **ET ELLE SE MONTRE MÊME SUR UN MOIS VIDE.** Elle compte tous les
              mois ; la poser sous « Rien en septembre » l'aurait fait taire —
              et l'œil avec — précisément quand un chantier d'août attend encore
              sa facture : c'est le retard de facturation de sa règle du
              22 août, et un mois neuf l'aurait caché. Trouvé par la suite
              jouée seule, sur un septembre sans chantier (13 septembre 2026). */}
          {(attente.length > 0 || faites.length > 0) && (
            <p
              className="mb-3 mt-3.5 flex items-center gap-1.5 text-[17px] font-bold leading-[1.5]"
              style={{ color: colors.ink }}
              data-atlas="compte-du-mois"
            >
              {attente.length > 0 && (
                <>
                  {/* **« À facturer » en or — sa correction du 23 août au
                      soir.** L'or porte ici ce qui attend un geste de lui.
                      Deux comptes du même noir se lisaient comme un seul
                      chiffre coupé en deux. */}
                  <span style={{ color: colors.or }}>{attente.length} à facturer</span>
                  <Oeil ouvert={montrerCeQuiAttend} onClick={() => setOeilOuvert((o) => !o)} />
                </>
              )}
              {/* Les facturés s'éteignent quand l'œil est ouvert : ils ne
                  sont plus dans la liste, mais le chiffre reste à sa place
                  pour dire qu'ils existent. `muted` plutôt qu'une opacité :
                  c'est le jeton du retrait, lisible sur les huit chartes. */}
              {faites.length > 0 && (
                <span style={{ color: montrerCeQuiAttend ? colors.muted : colors.ink }}>
                  {faites.length} facturé{faites.length > 1 ? "s" : ""}
                </span>
              )}
            </p>
          )}
          {!montrerCeQuiAttend && mois.lignes.length === 0 ? (
            <p className="mt-4 text-[13.5px] leading-[1.65]" style={{ color: colors.muted }}>
              Rien en {nomDuMois(cle).toLowerCase()}.
            </p>
          ) : (
            (montrerCeQuiAttend ? attente : mois.lignes).map((l) => (
              <Ligne key={l.id} ligne={l} annee={annee} />
            ))
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
  enVeille,
  surMois,
}: {
  cle: string;
  peutReculer: boolean;
  peutAvancer: boolean;
  /** L'œil est ouvert : la liste ignore le mois, les flèches se ferment. */
  enVeille: boolean;
  surMois: (cle: string) => void;
}) {
  return (
    // Centré — sa demande du 13 septembre 2026 : *« Septembre 2026, centre-le »*.
    <div className="flex items-center justify-center gap-0.5" data-atlas="navigation-mois">
      <Fleche
        sens="passe"
        desactivee={enVeille || !peutReculer}
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
          color: enVeille ? colors.muted : colors.ink,
        }}
      >
        {nomDuMois(cle)}
      </span>
      <Fleche
        sens="futur"
        desactivee={enVeille || !peutAvancer}
        onClick={() => surMois(decalerMois(cle, -1))}
      />
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
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {sens === "passe" ? "‹" : "›"}
    </button>
  );
}

/**
 * L'œil à côté de « 3 à facturer » — sa demande du 13 septembre 2026.
 *
 * **Barré, on voit tout ; ouvert, on ne voit que ce qui attend.** C'est le
 * sens qu'il a donné : *« on clique dessus, ça montre les à facturer ; on
 * reclique, il disparaît, on revient sur le mode tout par défaut »*.
 *
 * **44 × 44 posés sur une ligne de 17 px, sans la grandir** : les marges
 * négatives absorbent le bouton, et le doigt garde sa mesure — la même que
 * tout ce qu'on appuie ici. Le dessin fait 22 px, en or comme le chiffre
 * qu'il accompagne.
 *
 * **Rien autour de lui, ni ouvert ni fermé** — sa correction du même soir
 * devant la planche : *« quand on clique sur l'œil il y a une sorte de fond
 * qui se met autour en forme de rond, supprime ça, garde vraiment que
 * l'œil »*. L'état se lit au dessin seul : la barre, ou la pupille pleine.
 */
function Oeil({ ouvert, onClick }: { ouvert: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ouvert}
      aria-label={ouvert ? "Tout montrer" : "Ne montrer que ce qui attend"}
      data-atlas="oeil-a-facturer"
      className="-my-[10px] -ml-1 -mr-1 grid h-11 w-11 place-items-center rounded-full"
      style={{ color: colors.or, WebkitTapHighlightColor: "transparent" }}
    >
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M2.2 10s2.8-5 7.8-5 7.8 5 7.8 5-2.8 5-7.8 5-7.8-5-7.8-5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {ouvert ? (
          <circle cx="10" cy="10" r="2.4" fill="currentColor" />
        ) : (
          <>
            <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3.6 16.4 16.4 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </>
        )}
      </svg>
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
            capture de l'écran, avec de vrais montants : « 12 août,
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
          // **ELLE A PORTÉ LE GALET DU 2 AU 4 SEPTEMBRE 2026**, puis il l'a
          // ramenée au vert des boutons : *« oui, vert clair partout »*. Le
          // dégradé et son filet d'or sont partis avec — voir la pierre tombale
          // dans `globals.css`.
          //
          // **`surPlein` et jamais un blanc écrit en clair** (`CLAUDE.md` §3) :
          // `plein` devient clair sur Nuit et Sylve, où du blanc dessus ne se
          // lirait plus.
          className="atlas-plein flex min-h-11 flex-none items-center rounded-full px-[17px] text-[12.5px] font-semibold uppercase"
          style={{ letterSpacing: "0.12em", backgroundColor: colors.plein, color: surPlein }}
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
