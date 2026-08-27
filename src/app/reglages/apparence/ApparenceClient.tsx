"use client";

import { useState, useTransition } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import {
  CHARTES,
  charte,
  toutesLesVariables,
  variablesCharte,
  type Charte,
  type NomCharte,
} from "@/lib/chartes";
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
        <p
          role="alert"
          className={`mx-[26px] mt-4 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}`, color: colors.alert }}
        >
          {refus}
        </p>
      )}

      <p className={`mx-[26px] mt-[26px] ${texteSituation}`} style={{ color: colors.muted }}>
        La couleur change <b style={{ color: colors.ink, fontWeight: 500 }}>toute l&apos;application</b>, tout de
        suite. Elle n&apos;appartient qu&apos;à vous : vos devis et vos factures gardent leur apparence.
      </p>

      <section className="mx-[26px] mt-[30px] border-t pt-[18px]" style={{ borderColor: colors.line }}>
        <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
          Votre charte
        </p>
        {CHARTES.map((c) => (
          <LigneCharte
            key={c.nom}
            charte={c}
            prise={choisie === c.nom}
            enCours={enCours}
            onChoisir={() => choisir(c.nom)}
          />
        ))}
      </section>

      <p
        className={`mx-[26px] mt-[30px] border-t pt-[18px] ${texteSituation}`}
        style={{ borderColor: colors.line, color: colors.muted }}
      >
        Deux d&apos;entre elles sont sombres — <b style={{ color: colors.ink, fontWeight: 500 }}>Nuit</b> et{" "}
        <b style={{ color: colors.ink, fontWeight: 500 }}>Sylve</b>. Elles se lisent mal en plein soleil : sur un
        chantier, à midi, l&apos;écran clair reste le plus sûr.
      </p>
    </div>
  );
}

/**
 * Une charte, montrée dans ses propres couleurs.
 *
 * **La pastille n'emploie PAS `colors.*`** — elle emploie les jetons de la
 * charte qu'elle représente. C'est la seule façon de la voir avant de la
 * choisir, et c'est le principe de la planche : montrer, pas décrire.
 */
function LigneCharte({
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
  const j = charte.jetons;
  return (
    <button
      type="button"
      onClick={onChoisir}
      disabled={enCours}
      aria-pressed={prise}
      aria-label={charte.libelle}
      data-charte={charte.nom}
      className="flex w-full items-center gap-[13px] border-b py-[14px] text-left last:border-b-0 disabled:opacity-60"
      style={{ borderColor: colors.line, minHeight: 60 }}
    >
      {/* L'écran en réduction : le fond, une carte posée dessus, l'encre, et le
          bouton d'action dans son plein. Quatre valeurs suffisent à reconnaître
          une charte — la planche entière tient sur ces quatre-là. */}
      <span
        aria-hidden="true"
        className="flex h-[46px] w-[46px] flex-none flex-col justify-between overflow-hidden rounded-[4px] p-[5px]"
        style={{ backgroundColor: j.cream, boxShadow: `inset 0 0 0 1px ${j.line}` }}
      >
        <span className="block h-[13px] w-full rounded-[2px]" style={{ backgroundColor: j.card }}>
          <span className="ml-[3px] block h-[3px] w-[18px] rounded-full" style={{ backgroundColor: j.ink, marginTop: 5 }} />
        </span>
        <span className="flex items-center gap-[3px]">
          <span className="block h-[10px] flex-1 rounded-[2px]" style={{ backgroundColor: j.rust }} />
          <span className="block h-[10px] w-[10px] flex-none rounded-full" style={{ backgroundColor: j.or }} />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.25, color: colors.ink }}>
            {charte.libelle}
          </span>
          {charte.sombre && (
            <span className={libelleCaps} style={{ color: colors.or }}>
              Sombre
            </span>
          )}
        </span>
        <span className={`mt-1 block ${texteSituation}`} style={{ color: colors.muted }}>
          {charte.dit}
        </span>
      </span>

      {/* La pastille du choix, comme sur l'écran du régime de TVA : pleine d'or
          quand elle est prise, un simple cercle sinon. */}
      <span
        aria-hidden="true"
        className="h-[19px] w-[19px] flex-none rounded-full"
        style={{ boxShadow: prise ? `inset 0 0 0 6px ${colors.or}` : `inset 0 0 0 1px ${colors.line}` }}
      />
    </button>
  );
}
