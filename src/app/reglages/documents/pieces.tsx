"use client";

import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { encreSurFond, typographieDe, type Allure } from "@/lib/allure-documents";

/**
 * LES PIÈCES COMMUNES AUX QUATRE ÉCRANS DE « DEVIS & FACTURES ».
 *
 * **Elles vivaient dans `DocumentsClient.tsx`, qui portait les six blocs d'un
 * seul écran de 4 350 px.** Le 7 septembre 2026, le patron a tranché : *« on
 * coupe »* (`appli/couper-devis-et-factures.html`). L'écran est devenu un
 * sommaire de quatre lignes menant à quatre écrans courts — et ces pièces-là,
 * qui servaient dans plusieurs blocs, se seraient recopiées d'un fichier à
 * l'autre. Deux copies d'un interrupteur, c'est un jour deux interrupteurs qui
 * ne se ressemblent plus (`CLAUDE.md` §3).
 *
 * Rien n'a changé dans leur dessin : ce sont les mêmes, déplacées.
 */

/** Un bloc de réglages, avec son intertitre. */
export function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section
      className="mx-[26px] mt-[30px] border-t pt-[18px] first-of-type:mt-[26px] first-of-type:border-t-0 first-of-type:pt-0 [&>*:last-child]:border-b-0"
      style={{ borderColor: colors.line }}
    >
      <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
        {titre}
      </p>
      {children}
    </section>
  );
}

/**
 * Un réglage : son interrupteur, et ce qu'il déplie.
 *
 * **Éteint, rien ne se déplie.** Un champ sous un réglage coupé invite à le
 * remplir pour rien — arrêté sur la planche du plan des réglages.
 */
export function Reglage({
  nom,
  dit,
  allume,
  onBascule,
  children,
}: {
  nom: string;
  dit: string;
  allume: boolean;
  onBascule: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b" style={{ borderColor: colors.line }}>
      <button
        type="button"
        role="switch"
        aria-checked={allume}
        onClick={() => onBascule(!allume)}
        className="flex w-full items-center gap-[14px] py-[15px] text-left"
        style={{ minHeight: 56 }}
      >
        <span className="min-w-0 flex-1">
          <span className="block" style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.25 }}>
            {nom}
          </span>
          <span className={`mt-1 block ${texteSituation}`} style={{ color: colors.inkSoft }}>
            {dit}
          </span>
        </span>
        {/* 52 × 32 : la piste tient la cible de 44 px avec la hauteur de sa
            ligne, et reste sous le pouce sans écraser le libellé. */}
        <span
          aria-hidden="true"
          className="relative h-8 w-[52px] flex-none rounded-full transition-colors"
          style={{ backgroundColor: allume ? colors.rust : colors.line }}
        >
          <span
            className="absolute top-[3px] h-[26px] w-[26px] rounded-full transition-all"
            style={{
              left: allume ? 23 : 3,
              backgroundColor: colors.card,
              boxShadow: allume ? "none" : `inset 0 0 0 1px ${colors.line}`,
            }}
          />
        </span>
      </button>
      {allume && children && <div className="pb-4">{children}</div>}
    </div>
  );
}

/** Un nombre et son unité, sur une plage crème. */
export function Chiffre({
  valeur,
  unite,
  apres,
  bornes,
  onEcrire,
  onFini,
}: {
  valeur: number | null;
  unite: string;
  apres: string;
  bornes: { min: number; max: number };
  onEcrire: (n: number) => void;
  onFini: (n: number) => void;
}) {
  return (
    <span className="flex items-center gap-2.5 rounded-[4px] px-[15px] py-3" style={{ backgroundColor: colors.card }}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`${unite === "%" ? "Pourcentage" : "Nombre de jours"}, entre ${bornes.min} et ${bornes.max}`}
        value={valeur ?? ""}
        onChange={(e) => onEcrire(Number(e.target.value.replace(/\D/g, "")) || 0)}
        onBlur={(e) => onFini(Number(e.target.value.replace(/\D/g, "")) || 0)}
        className="w-[4ch] border-0 bg-transparent p-0 outline-none"
        // 17 px : en dessous de 16, iOS agrandit la page à la mise au point.
        style={{ fontFamily: font.display, fontSize: 17, color: colors.ink, fontVariantNumeric: "tabular-nums" }}
      />
      <span style={{ fontFamily: font.display, fontSize: 17, color: colors.or }}>{unite}</span>
      {/* **Aucun montant ici.** Un « soit 1 044 € » se contredirait au premier
          chiffre changé — vu sur la planche le 13 août, jamais par un test. */}
      <span className={`flex-1 text-right ${texteSituation}`} style={{ color: colors.inkSoft }}>
        {apres}
      </span>
    </span>
  );
}

/** Un texte libre, court ou long. */
export function Libre({
  valeur,
  exemple,
  long,
  onEcrire,
  onFini,
}: {
  valeur: string;
  exemple: string;
  long?: boolean;
  onEcrire: (t: string) => void;
  onFini: (t: string) => void;
}) {
  const commun = {
    value: valeur,
    placeholder: exemple,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onEcrire(e.target.value),
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => onFini(e.target.value),
    className: "block w-full rounded-[4px] border-0 px-[15px] py-3 outline-none",
    style: { backgroundColor: colors.card, color: colors.ink, fontSize: 16, lineHeight: 1.5 },
  } as const;
  return long ? (
    <textarea {...commun} rows={2} aria-label="Texte ajouté en bas de chaque document" className={`${commun.className} resize-none`} />
  ) : (
    <input {...commun} type="text" aria-label="Moyens de paiement acceptés" autoComplete="off" />
  );
}

/**
 * Une couleur : le nuancier de l'appareil, et trois ou quatre raccourcis.
 *
 * **Le nuancier libre est le réglage, les pastilles ne sont qu'un raccourci.**
 * Sa règle du 23 août : *« le fond teinté fait-le modifiable »*. Une liste
 * fermée de trois teintes n'est pas modifiable — c'est un choix, pas une
 * couleur.
 */
export function Couleur({
  titre,
  valeur,
  clef,
  aide,
  rapides,
  onChoisir,
}: {
  titre: string;
  valeur: string;
  clef: string;
  aide: string;
  rapides: [string, string][];
  onChoisir: (v: string) => void;
}) {
  return (
    <div className="mb-5">
      <p className={`mb-2 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
        {titre}
      </p>
      <div className="flex items-center gap-2.5">
        <input
          type="color"
          value={valeur}
          data-atlas={`couleur-${clef}`}
          aria-label={titre}
          onChange={(e) => onChoisir(e.target.value)}
          // 44 px : la cible du pouce. Un nuancier plus petit se rate.
          className="h-[44px] w-[54px] flex-none cursor-pointer rounded-[8px] border-0 bg-transparent p-0"
        />
        <span
          data-atlas={`couleur-${clef}-valeur`}
          className="text-[13px]"
          style={{ color: colors.muted, fontVariantNumeric: "tabular-nums" }}
        >
          {valeur.toUpperCase()}
        </span>
        <span className="ml-auto flex gap-1.5">
          {rapides.map(([teinte, nom]) => (
            <button
              key={teinte}
              type="button"
              aria-label={nom}
              aria-pressed={valeur === teinte}
              data-atlas={`rapide-${clef}-${teinte.slice(1)}`}
              onClick={() => onChoisir(teinte)}
              className="h-[34px] w-[34px] rounded-full"
              style={{
                backgroundColor: teinte,
                boxShadow:
                  valeur === teinte
                    ? `0 0 0 2px ${colors.cream}, 0 0 0 4px ${colors.or}`
                    : `inset 0 0 0 1px ${colors.line}`,
              }}
            />
          ))}
        </span>
      </div>
      <p className={`mt-1.5 ${texteSituation}`} style={{ color: colors.inkSoft }}>
        {aide}
      </p>
    </div>
  );
}

/**
 * L'allure de la page, en petit — sans un seul chiffre calculé.
 *
 * **L'encre vient de `encreSurFond`, la MÊME fonction que le PDF.** L'écrire
 * une seconde fois ici donnerait, tôt ou tard, un aperçu lisible et un devis
 * qui ne l'est pas — et c'est le devis que le client reçoit (`CLAUDE.md` §3).
 */
export function Feuille({ allure, logo, nom }: { allure: Allure; logo: string | null; nom: string }) {
  const { encre, encreDouce } = encreSurFond(allure.fond);
  const typo = typographieDe(allure.typographie);
  return (
    <div
      data-atlas="allure-feuille"
      className="rounded-[6px] px-4 py-4"
      style={{
        backgroundColor: allure.fond,
        color: encre,
        fontFamily: typo.pileCss ?? undefined,
        boxShadow: `inset 0 0 0 1px ${colors.line}`,
      }}
    >
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/fichiers/${logo}`} alt="" className="mb-2 h-[26px] w-auto object-contain" />
      )}
      <p className="text-[17px] leading-tight">{nom || "Votre entreprise"}</p>
      <p className="mt-1 text-[10px]" style={{ color: encreDouce }}>
        Adresse · SIRET · téléphone
      </p>
      <div className="my-2.5 h-px" style={{ backgroundColor: encre }} />
      <p className="text-center text-[13px] tracking-[0.2em]">DEVIS</p>
      <p className="mt-2.5 text-[9px] tracking-[0.14em]" style={{ color: allure.accent }}>
        ÉMETTEUR · CLIENT
      </p>
      <div className="mt-1.5 space-y-1">
        {["Taille de haie", "Évacuation des déchets"].map((l) => (
          <div key={l} className="flex justify-between border-b pb-1 text-[11px]"
               style={{ borderColor: encreDouce, color: encre }}>
            <span>{l}</span>
            <span style={{ color: encreDouce }}>—</span>
          </div>
        ))}
      </div>
      {/* **Le total reste à l'ENCRE, et c'est ce que le PDF fait.** Il a été
          dessiné en accent sur la planche du 7 septembre 2026, à tort : la
          fabrique (`document-commun.ts`) ne colore que les intitulés de parties
          et le trait sous le titre. Un aperçu qui colore ce que le document
          n'colore pas est un aperçu qui ment. */}
      <p className="mt-2 text-right text-[13px]" style={{ color: encre }}>
        Total TTC
      </p>
    </div>
  );
}
