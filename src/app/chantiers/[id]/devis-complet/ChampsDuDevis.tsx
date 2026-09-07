"use client";

import { useLayoutEffect, useRef } from "react";
import { colors, font } from "@/lib/design-tokens";

// **Les pièces de la feuille, sorties de l'écran qui les assemble.**
//
// `DevisCompletClient.tsx` passait 1 657 lignes, dont près de trois cents de
// champs et de mise en forme qui ne connaissent ni le devis, ni le chantier, ni
// le serveur : ils reçoivent une valeur, la rendent, et disent quand elle a
// changé. Les lire au milieu de la logique d'envoi obligeait à faire défiler
// deux cents lignes pour vérifier ce qu'un champ enregistre.
//
// **Rien n'a changé en passant** — même code, mêmes classes, mêmes commentaires.
// Le pourquoi de chacun est resté avec lui : ce sont ces paragraphes-là qui
// empêchent de « simplifier » une hauteur mesurée ou un `16px` qui évite le
// zoom d'iOS.
//
// **Le voile de saisie vient de la charte, il n'est plus écrit en clair.** Ces
// champs n'ont volontairement aucun cadre — la feuille est un document, pas un
// formulaire —, si bien que ce voile est le SEUL signe qu'on écrit dedans. Il
// valait `rgba(0,0,0,0.03)` : sur Nuit et sur Sylve, du noir à 3 % posé sur un
// fond noir ne se voit pas, et le champ en cours de saisie devenait identique
// au champ au repos. Il se lit désormais dans `--voile-champ`, que la feuille
// pose avec `voile(colors.ink, …)` (`design-tokens.ts`) : clair sur une charte
// sombre, sombre sur une charte claire.
/** Le montant d'une ligne — quantité × prix unitaire, comme sur le modèle. */
export function montantDeLaLigne(l: { quantite: string; prixUnitaire: string }): number {
  return nombre(l.quantite) * nombre(l.prixUnitaire);
}

/**
 * « 3.00 » s'écrit « 3 », « 250.00 » s'écrit « 250 ».
 *
 * La base stocke deux décimales — c'est juste pour de l'argent, et illisible
 * sur un devis : personne n'écrit « 3,00 tilleuls ». Le patron voit donc le
 * nombre tel qu'il l'aurait écrit, et reste libre de taper « 1,5 ».
 */
export function sansZerosInutiles(valeur: string): string {
  if (!valeur) return "";
  const n = Number(String(valeur).replace(",", "."));
  if (!Number.isFinite(n)) return valeur;
  return String(n).replace(".", ",");
}

/** Lit un nombre saisi à la française (« 1,5 ») comme à l'anglaise (« 1.5 »). */
export function nombre(valeur: string): number {
  const n = Number(String(valeur).replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

/** Une valeur vide vaut le défaut, jamais `NaN` en base. */
export function normaliser(valeur: string, defaut: string): string {
  const n = nombre(valeur);
  return valeur.trim() === "" ? defaut : String(n);
}

/**
 * Une zone de texte HAUTE DE CE QU'ELLE CONTIENT — jamais de ce qu'on estime.
 *
 * **Les trois zones du devis estimaient leur hauteur, et les trois estimaient
 * mal.** L'adresse comptait les caractères (`ceil(longueur / 34)`), la
 * description comptait les retours à la ligne, les conditions ne comptaient
 * rien du tout (`rows={2}`). Or un texte ne se coupe ni au caractère ni au
 * retour à la ligne : il se coupe au mot, quand il touche le bord. Deux lignes
 * estimées en font trois à l'écran, la zone se met à défiler, et le patron
 * relit un devis amputé du bas.
 *
 * C'est très exactement le défaut que la zone d'adresse existait pour
 * corriger — *« le patron lit une adresse amputée sur son propre devis »* —
 * revenu par une autre porte.
 *
 * **Trouvé le 11 août 2026 par le balayage des barres de défilement**, qui
 * cherchait tout autre chose. La barre grise était le symptôme ; le texte caché
 * était le défaut. La masquer aurait rendu la coupure silencieuse — c'eût été
 * le pire des deux.
 *
 * On mesure donc au lieu d'estimer. `scrollHeight` donne la hauteur réelle une
 * fois le texte reporté à la ligne. La remise à `auto` avant de lire est
 * indispensable : sans elle la hauteur ne redescend jamais quand on efface.
 */
export function ZoneQuiGrandit({
  valeur,
  onChange,
  onFini,
  placeholder,
  aria,
  fige,
  className,
  style,
}: {
  valeur: string;
  onChange: (v: string) => void;
  /** Reçoit ce que le CHAMP porte — voir `persisterLigne`, jamais un rendu. */
  onFini: (valeurDuChamp: string) => void;
  placeholder: string;
  aria: string;
  fige: boolean;
  className: string;
  style: React.CSSProperties;
}) {
  const zone = useRef<HTMLTextAreaElement>(null);

  // À chaque frappe ET au premier rendu : le contenu vient du serveur, il est
  // déjà long avant qu'on ait touché quoi que ce soit.
  //
  // `useLayoutEffect` et non `useEffect` : la mesure doit être posée avant que
  // le navigateur peigne, sinon la feuille sursaute au chargement.
  useLayoutEffect(() => {
    const el = zone.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [valeur]);

  return (
    <textarea
      ref={zone}
      value={valeur}
      readOnly={fige}
      placeholder={placeholder}
      aria-label={aria}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onFini(e.currentTarget.value)}
      className={className}
      style={style}
    />
  );
}

/**
 * Un champ sans cadre : le devis reste une feuille, pas un formulaire.
 * Il ne se signale qu'au moment où on écrit dedans.
 */
export function ChampNu({
  valeur,
  onChange,
  onFini,
  placeholder,
  aria,
  fige,
  grand,
  long,
  prefixe,
}: {
  valeur: string;
  onChange: (v: string) => void;
  onFini: () => void;
  placeholder: string;
  aria: string;
  fige: boolean;
  grand?: boolean;
  /**
   * Écrit devant la valeur, et **hors du champ** : c'est ce que le document
   * porte sans qu'on l'ait tapé — la civilité, aujourd'hui. Le mettre DANS le
   * champ le rendrait modifiable, et le patron enregistrerait « Mr. Roux »
   * comme nom du client : la civilité s'y retrouverait deux fois au premier
   * document suivant.
   */
  prefixe?: string;
  /**
   * Passe à plusieurs lignes plutôt que de couper. Réservé aux adresses : dans
   * un `<input>`, « 10 rue Denfert-Rochereau 78200 Mantes-la-Jolie » s'arrête
   * au bord de l'écran, et le patron lit une adresse amputée sur son propre
   * devis. Le PDF, lui, la reporte à la ligne depuis toujours — l'écran devait
   * dire la même chose que le papier.
   */
  long?: boolean;
}) {
  if (long) {
    return (
      <ZoneQuiGrandit
        valeur={valeur}
        onChange={onChange}
        onFini={onFini}
        placeholder={placeholder}
        aria={aria}
        fige={fige}
        className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 py-0.5 outline-none focus:bg-[var(--voile-champ)]"
        style={{ color: colors.ink, fontSize: "16px", lineHeight: 1.4 }}
      />
    );
  }
  const champ = (
    <input
      value={valeur}
      readOnly={fige}
      placeholder={placeholder}
      aria-label={aria}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onFini}
      className="block w-full border-0 bg-transparent p-0 py-0.5 outline-none focus:bg-[var(--voile-champ)]"
      style={{
        color: colors.ink,
        // 16 px au minimum : en dessous, iOS agrandit la page au premier appui.
        fontSize: grand ? "22px" : "16px",
        fontFamily: grand ? font.display : undefined,
      }}
    />
  );

  if (!prefixe) return champ;

  // `items-baseline` : le mot et le nom reposent sur la même ligne d'écriture,
  // comme sur le papier. Alignés par le haut, « Mr. » flotterait au-dessus du
  // nom dès que les deux n'ont pas exactement la même taille.
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        style={{
          color: colors.ink,
          fontSize: grand ? "22px" : "16px",
          fontFamily: grand ? font.display : undefined,
        }}
      >
        {prefixe}
      </span>
      {champ}
    </span>
  );
}

export function Intertitre({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: colors.rust }}
    >
      {children}
    </p>
  );
}

export function Colonne({ children, droite }: { children: React.ReactNode; droite?: boolean }) {
  return (
    <span
      className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${droite ? "text-right" : ""}`}
      style={{ color: colors.muted }}
    >
      {children}
    </span>
  );
}

/** Sur téléphone, chaque cellule porte son libellé — comme le modèle d'origine. */
/**
 * Un chiffre qu'on saisit — et qu'on VOIT qu'on peut saisir.
 *
 * Le 6 août 2026, le patron : « quand j'essaye de cliquer pour mettre un prix,
 * ce n'est pas cliquable ». Il l'était pourtant. Mais le champ était vide, sans
 * repère, sans placeholder, et haut de 24 pixels dans un coin de l'écran —
 * mesuré : 96 × 24. Apple recommande 44 pixels pour une cible tactile, et un
 * champ invisible n'invite personne à le toucher. Un contrôle automatique
 * répondait « éditable : oui » et n'y voyait donc rien.
 *
 * D'où les trois changements, tous nécessaires ensemble : une hauteur de doigt,
 * un trait sous le champ tant qu'il est vide, et un exemple en gris. Le trait
 * disparaît dès qu'un chiffre est écrit — sur le papier, un devis rempli n'a
 * pas de cases.
 */
export function ChiffreSaisi({
  valeur,
  onChange,
  onFini,
  placeholder,
  aria,
  fige,
  marqueLigne,
}: {
  valeur: string;
  onChange: (v: string) => void;
  /** Reçoit ce que le CHAMP porte — voir `persisterLigne`, jamais un rendu. */
  onFini: (valeurDuChamp: string) => void;
  placeholder: string;
  aria: string;
  fige: boolean;
  /**
   * L'identifiant de la ligne dont ce champ porte le PRIX — et rien d'autre.
   *
   * Il sert au refus « à chiffrer » à emmener le doigt sur le bon champ. Une
   * référence React aurait demandé de tenir une table d'identifiants vivante à
   * travers les catégories de TVA, les retraits et les déplacements ; le DOM,
   * lui, porte déjà la réponse au moment où l'on appuie.
   */
  marqueLigne?: string;
}) {
  const vide = valeur.trim() === "";
  return (
    <input
      value={valeur}
      readOnly={fige}
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={aria}
      data-prix-ligne={marqueLigne}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onFini(e.currentTarget.value)}
      className="w-24 border-0 bg-transparent px-1 text-right outline-none focus:bg-[var(--voile-champ)] sm:w-full"
      style={{
        color: colors.ink,
        fontSize: "16px",
        minHeight: 44,
        borderBottom: vide && !fige ? `1px solid ${colors.lineSoft}` : "1px solid transparent",
      }}
    />
  );
}

export function Cellule({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:block sm:text-right">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.1em] sm:hidden"
        style={{ color: colors.muted }}
      >
        {libelle}
      </span>
      {children}
    </div>
  );
}

export function Reference({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-1"
      style={{ borderBottom: `1px solid ${colors.lineSoft}` }}
    >
      <span className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: colors.muted }}>
        {libelle}
      </span>
      <span className="text-[14px]">{valeur}</span>
    </div>
  );
}
