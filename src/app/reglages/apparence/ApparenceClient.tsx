"use client";

import { useState, useTransition } from "react";
import { colors, couleursDocument, font, voile } from "@/lib/design-tokens";
import {
  CHARTES,
  charte,
  toutesLesVariables,
  variablesCharte,
  type Charte,
  type NomCharte,
} from "@/lib/chartes";
import CocheRonde from "@/components/atlas/reglages/CocheRonde";
import Paquet from "@/components/atlas/reglages/Paquet";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import Trace from "@/components/atlas/reglages/Trace";
import { choisirCharteAction } from "./actions";

/**
 * « Apparence » — les sept chartes du patron.
 *
 * *Choisies le 14 août 2026 sur la planche des seize
 * (`docs/maquettes/11-ecran-retenu-seize-couleurs.html`) :* ***« garde
 * seulement pour l'instant nuit, beurre, moka, pierre, sylve »***, *plus Prune,
 * puis* ***« oui garde Origine en défaut, fais les sept »***.
 *
 * **CHAQUE LIGNE SE MONTRE DANS SA PROPRE COULEUR**, et c'est tout l'écran.
 * « Chaleureux », « sobre », « spectaculaire » : personne ne choisit une
 * couleur sur un adjectif — c'était déjà la règle de la planche. La pastille
 * n'est donc pas une vignette décorative : c'est l'écran en réduction, fond,
 * carte, encre et accent compris.
 *
 * **Le mode sombre est DANS la liste**, il n'est pas à côté. Nuit et Sylve sont
 * sombres ; deux réglages séparés se seraient contredits dès qu'on aurait
 * choisi « Nuit » avec le sombre éteint.
 *
 * **Huit petits écrans en deux colonnes — sa planche soignée du 26 octobre
 * 2026** (`appli/soignee/reglages-apparence.html`, vue Proposé). Le principe
 * ne change pas ; la vignette de 46 px était seulement trop petite pour qu'on
 * y voie un écran. Les noms, les phrases et l'ordre sont ceux de
 * `src/lib/chartes.ts`, mot pour mot.
 */
export default function ApparenceClient({ initiale }: { initiale: NomCharte }) {
  const [choisie, setChoisie] = useState<NomCharte>(initiale);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  /**
   * **Repeindre `<html>` À LA MAIN, tout de suite — le correctif du 16 août 2026.**
   *
   * Le patron, capture de cet écran à l'appui, la pastille « Nuit » cochée :
   * *« l'apparence ne change pas »*. C'était exact, et mesuré avant d'être
   * réparé (`ARCHITECTURE.md` §115) : le choix partait bien en base, mais
   * l'écran restait dans l'ancienne charte **jusqu'au prochain rechargement
   * complet** — sur l'écran même, puis sur « Chantiers », puis sur
   * « Planning ». Il ne recharge jamais : il touche les onglets du bas.
   *
   * **Pourquoi ni `revalidatePath` ni `router.refresh()`.** Les variables sont
   * posées par le gabarit RACINE, sur l'élément `<html>`. Or ce gabarit est
   * partagé par tous les écrans : une navigation côté client ne le rejoue pas,
   * elle ne remplace que le contenu — l'attribut `style` de `<html>` reste donc
   * celui du document initial, quoi qu'on invalide au serveur. Et
   * `revalidatePath("/", "layout")` avait déjà été retiré pour une bonne
   * raison : il vidait le cache de toute l'application à chaque appui.
   *
   * **C'est le même élément pendant toute la visite**, et c'est ce qui rend ce
   * geste juste plutôt que rustique : on écrit sur `<html>` exactement ce que le
   * serveur y aurait écrit, avec les mêmes jetons (`src/lib/chartes.ts`), donc
   * la couleur suit le doigt sans aller-retour et survit à toutes les
   * navigations qui suivent.
   *
   * **Le serveur garde son rôle**, et il ne fait pas double emploi : c'est lui
   * qui pose la charte au PREMIER rendu, sans quoi l'écran s'afficherait en
   * couleurs d'origine avant de se repeindre — un clignotement à chaque page.
   */
  function repeindre(nom: NomCharte) {
    // **`variablesCharte`, et NON `c.jetons` — corrigé le 27 août 2026.**
    //
    // Le patron : *« quand je sélectionne Brume, le dessin des catégories en bas
    // ne change pas automatiquement, je dois recharger la page »*. Il avait
    // raison, et la cause est une troisième occurrence de la même faute : cette
    // fonction reparcourait `c.jetons` de son côté, c'est-à-dire les seules
    // COULEURS. Tout ce qu'une charte pose d'autre — la police des titres, et
    // les cinq variables du marqueur d'onglet — n'arrivait qu'au rendu suivant,
    // celui du serveur. D'où : les couleurs suivaient le doigt, le reste
    // attendait un rechargement.
    //
    // La règle du §3 vaut aussi pour un parcours d'objet : deux façons de dire
    // « ce que la charte écrit » divergent au premier ajout, et c'est
    // exactement ce qui s'est produit — deux fois avant celle-ci
    // (`src/lib/chartes.ts`).
    //
    // **ON RETIRE AVANT DE POSER**, et c'est la moitié qui manque toujours. Les
    // variables vivent sur `<html>` : venant de Brume, ses cinq variables
    // d'onglet y sont encore. Une charte qui ne les pose pas doit les EFFACER,
    // sans quoi sa pastille survivrait sur Origine — un état qu'aucun
    // rechargement ne produit, donc que personne ne verrait en essayant.
    const voulues = variablesCharte(charte(nom));
    const racine = document.documentElement;
    for (const cle of toutesLesVariables()) {
      if (cle in voulues) racine.style.setProperty(cle, voulues[cle]);
      else racine.style.removeProperty(cle);
    }
  }

  function choisir(nom: NomCharte) {
    const avant = choisie;
    // Prise à l'écran sans attendre le serveur : le doigt a fait son geste, et
    // une pastille qui met une seconde à se remplir se touche deux fois.
    setChoisie(nom);
    repeindre(nom);
    demarrer(async () => {
      const r = await choisirCharteAction(nom);
      if (!r.ok) {
        // La couleur revient AVEC la pastille : laisser l'écran repeint alors
        // que rien n'est enregistré lui ferait croire au contraire de ce que
        // dit le message de refus juste au-dessus.
        setChoisie(avant);
        repeindre(avant);
        setRefus(r.raison);
        return;
      }
      setRefus(null);
    });
  }

  return (
    <div className="pb-24">
      {refus && (
        <div role="alert" className="mx-[22px] mt-4">
          <PlageTon ton="rouge">{refus}</PlageTon>
        </div>
      )}

      {/* **Une ligne, et elle dit les deux choses qui comptent** — sa validation
          du 9 septembre. La version d'avant en disait trois : que ça change tout,
          que c'est immédiat, que ça n'appartient qu'à lui, et que ses documents
          ne bougent pas. « Tout de suite » se VOIT au premier appui ; « elle
          n'appartient qu'à vous » ne veut rien dire pour un artisan seul. Ce
          qu'il ne peut PAS deviner, en revanche, c'est que ses devis gardent
          leur allure — cela reste (`CLAUDE.md` §3, le moins de mots possible).

          **La feuille blanche à côté le montre** (sa planche soignée) : elle
          reste blanche quand tout le reste change de couleur, et c'est
          exactement ce que dit la phrase. */}
      <div
        className="mx-[22px] mt-[18px] flex items-center gap-4 rounded-[6px] py-3.5 pl-[18px] pr-4"
        style={{ backgroundColor: colors.card }}
      >
        <p className="min-w-0 flex-1 text-[15.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
          Change <b style={{ color: colors.ink, fontWeight: 600 }}>toute l&apos;application</b>. Vos devis et vos
          factures ne bougent pas.
        </p>
        <FeuilleDeDevis />
      </div>

      <Paquet titre="Votre charte" sansPlage>
        <div className="grid grid-cols-2 gap-2.5">
          {CHARTES.map((c) => (
            <CarteCharte
              key={c.nom}
              charte={c}
              prise={choisie === c.nom}
              enCours={enCours}
              onChoisir={() => choisir(c.nom)}
            />
          ))}
        </div>
      </Paquet>

      {/* **RETIRÉ le 9 septembre 2026 : le paragraphe qui redisait « sombre ».**
          Il nommait Nuit et Sylve et prévenait qu'elles se lisent mal au soleil.
          Or l'étiquette « Sombre » est déjà posée à côté de ces deux-là, et leur
          petit écran le montre — c'est trois lignes pour répéter ce que l'écran
          affiche deux centimètres plus haut. Un écran ne s'explique pas, il se
          montre. Le risque réel n'a pas disparu pour autant : la lisibilité de
          chaque charte reste tenue par `test-chartes-lisibles.ts`. */}
    </div>
  );
}

/**
 * Le devis en miniature : du papier, quelle que soit la charte.
 *
 * **Les couleurs du DOCUMENT, pas celles de l'écran** (`couleursDocument`) :
 * c'est la pièce que le client reçoit, et elle garde l'allure d'Origine. Sur
 * Nuit, la plage devient noire autour d'elle ; la feuille, non.
 */
function FeuilleDeDevis() {
  const ligne = (largeur: string, couleur: string, hauteur = 3) => (
    <span className="block flex-none rounded-full" style={{ width: largeur, height: hauteur, backgroundColor: couleur }} />
  );
  return (
    <span
      aria-hidden="true"
      className="flex h-[60px] w-[46px] flex-none flex-col gap-1 rounded-[3px] px-1.5 py-[7px]"
      style={{
        backgroundColor: couleursDocument.papier,
        boxShadow: `0 1px 2px ${voile(couleursDocument.encre, 0.14)}, inset 0 0 0 1px ${voile(couleursDocument.encre, 0.06)}`,
      }}
    >
      {ligne("70%", voile(couleursDocument.encre, 0.6), 4)}
      {ligne("40%", couleursDocument.accent)}
      <span className="flex-1" />
      {ligne("100%", voile(couleursDocument.encre, 0.16))}
      {ligne("55%", voile(couleursDocument.encre, 0.16))}
      {ligne("100%", voile(couleursDocument.encre, 0.16))}
    </span>
  );
}

/**
 * Une charte, montrée dans ses propres couleurs.
 *
 * **Le petit écran pose les variables de SA charte** (`variablesCharte`) et ses
 * dessins lisent `colors.*` à l'intérieur : la carte, le titre, le bouton et
 * la barre prennent ainsi les valeurs de `src/lib/chartes.ts`, jamais celles
 * de la charte prise, et rien n'est recopié ici. C'est la seule façon de voir
 * une charte avant de la choisir — le principe de la planche : montrer, pas
 * décrire.
 *
 * **Le nom, la pastille et la phrase restent dans la charte prise** : ce sont
 * des mots qu'il lit, pas une couleur qu'il essaie.
 */
function CarteCharte({
  charte,
  prise,
  enCours,
  onChoisir,
}: {
  charte: Charte;
  prise: boolean;
  enCours: boolean;
  onChoisir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChoisir}
      disabled={enCours}
      aria-pressed={prise}
      aria-label={charte.libelle}
      data-charte={charte.nom}
      className="flex flex-col rounded-[14px] px-2 pb-3 pt-2 text-left transition-shadow duration-200 disabled:opacity-60"
      // La charte prise se cerne de l'encre d'action, comme les cartes de
      // choix (`CarteChoix`) : un cadre doré autour d'un bloc, il l'a retiré.
      style={{
        backgroundColor: colors.card,
        boxShadow: prise ? `inset 0 0 0 2px ${colors.rust}` : `inset 0 0 0 1px ${colors.lineSoft}`,
      }}
    >
      <PetitEcran charte={charte} />
      <span className="mx-1 mt-2.5 flex items-center justify-between gap-1.5">
        <span style={{ fontFamily: font.display, fontSize: 18, lineHeight: 1.2, color: colors.ink }}>
          {charte.libelle}
        </span>
        <CocheRonde pris={prise} />
      </span>
      {charte.sombre && (
        // « Sombre » en toutes lettres, avec sa petite lune, au lieu des
        // capitales espacées (sa planche soignée).
        <span
          className="mx-1 mt-1.5 inline-flex min-h-[24px] items-center gap-1.5 self-start rounded-full px-[9px] text-[13px] font-semibold"
          style={{ backgroundColor: voile(colors.ink, 0.06), color: colors.inkSoft }}
        >
          <span className="flex" style={{ color: colors.or }}>
            <Trace taille={14} epaisseur={2}>
              <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />
            </Trace>
          </span>
          Sombre
        </span>
      )}
      <span className="mx-1 mt-1 text-[13.5px] leading-[1.35]" style={{ color: colors.inkSoft }}>
        {charte.dit}
      </span>
    </button>
  );
}

/**
 * Le petit écran : le fond, le titre dans sa police, une carte, le bouton de la
 * charte, la barre et son trait d'or.
 */
function PetitEcran({ charte }: { charte: Charte }) {
  return (
    <span
      aria-hidden="true"
      className="relative block h-[104px] overflow-hidden rounded-[9px] px-[9px] pt-[9px]"
      // Des variables CSS dans un style en ligne : le type de React ne les
      // connaît pas, d'où la conversion, la même que celle de `PorteDeNuit`.
      style={
        {
          ...variablesCharte(charte),
          backgroundColor: colors.cream,
          boxShadow: `inset 0 0 0 1px ${colors.line}`,
        } as React.CSSProperties
      }
    >
      <span
        className="block text-[17px] leading-none"
        style={{
          // **Pas `font.display`** : `--font-display` se calcule à la racine,
          // dans la charte PRISE. Sur Brume, les huit petits écrans auraient
          // tous perdu leur empattement. La police vient donc de la charte
          // elle-même, et la serif du système à défaut, comme le repli de
          // `globals.css`.
          fontFamily: charte.formes?.policeTitres ?? "ui-serif, Georgia, serif",
          letterSpacing: "-0.01em",
          color: colors.ink,
        }}
      >
        Aa
      </span>
      <span className="mt-[7px] block rounded-[4px] px-[7px] py-1.5" style={{ backgroundColor: colors.card }}>
        <span className="block h-[3px] rounded-full" style={{ backgroundColor: voile(colors.ink, 0.7) }} />
        <span className="mt-1 block h-[3px] w-[62%] rounded-full" style={{ backgroundColor: colors.or }} />
      </span>
      <span className="mt-[7px] block h-[13px] rounded-full" style={{ backgroundColor: colors.plein }} />
      <span
        className="absolute inset-x-0 bottom-0 h-[15px]"
        style={{ backgroundColor: colors.cream, boxShadow: `inset 0 1px 0 ${colors.line}` }}
      >
        <span className="absolute bottom-1 right-[12%] h-0.5 w-[16%] rounded-full" style={{ backgroundColor: colors.or }} />
      </span>
    </span>
  );
}
