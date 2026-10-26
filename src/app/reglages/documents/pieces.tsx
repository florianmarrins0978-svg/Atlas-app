"use client";

import Image from "next/image";
import { colors, couleursDocument, font, voile } from "@/lib/design-tokens";
import { encreSurFond, LOGO_HAUTEUR, LOGO_LARGEUR_MAX, typographieDe, type Allure } from "@/lib/allure-documents";
import { teintesDuTon, type Ton } from "@/components/atlas/reglages/PlageTon";
import Picto from "@/components/atlas/reglages/Picto";

/**
 * LES PIÈCES COMMUNES AUX QUATRE ÉCRANS DE « DEVIS & FACTURES ».
 *
 * **Elles vivaient dans `DocumentsClient.tsx`, qui portait les six blocs d'un
 * seul écran de 4 350 px.** Le 7 septembre 2026, le patron a tranché : *« on
 * coupe »* (`appli/couper-devis-et-factures.html`). L'écran est devenu un
 * sommaire de quatre lignes menant à quatre écrans courts, et ces pièces-là,
 * qui servent dans plusieurs écrans, se seraient recopiées d'un fichier à
 * l'autre. Deux copies d'un interrupteur, c'est un jour deux interrupteurs qui
 * ne se ressemblent plus (`CLAUDE.md` §3).
 *
 * **Redessinées d'après la planche des Réglages soignés** (26 octobre 2026,
 * `appli/soignee/reglages-documents.html`) : le libellé en serif, le chiffre en
 * grand avec son unité dorée, et ce qui part chez le client sur du papier.
 */

/**
 * LE PAPIER : ce que le client tient dans la main.
 *
 * **Il ne suit pas la charte, et c'est délibéré** (« Ce qui part chez le client
 * ne suit pas la charte », sa planche) : le message, ce que le devis dira, les
 * conditions générales et l'aperçu du devis se lisent sur le papier de ses
 * documents (`couleursDocument`), en Nuit comme en Origine. Un message dessiné
 * en crème sur fond noir serait un message que son client ne reçoit pas.
 */
export const ombrePapier = `0 1px 2px ${voile(couleursDocument.encre, 0.12)}, inset 0 0 0 1px ${voile(couleursDocument.encre, 0.06)}`;
export const stylePapier: React.CSSProperties = {
  backgroundColor: couleursDocument.papier,
  color: couleursDocument.encre,
  borderRadius: 10,
  boxShadow: ombrePapier,
};

/**
 * Le numéro d'exemple, montré sur l'écran du numéro et sur l'aperçu du devis.
 *
 * **L'année vient de l'HORLOGE, jamais d'un millésime écrit à la main** : c'est
 * exactement le défaut que le réglage du numéro a corrigé le 26 août 2026.
 */
export const EXEMPLE_NUMERO = {
  annee: new Date().getFullYear(),
  mois: new Date().getMonth() + 1,
  numero: 12,
};

/**
 * Un réglage : son interrupteur, et ce qu'il déplie.
 *
 * **Toute la ligne bascule, pas seulement la piste** : 64 px sous le pouce, le
 * libellé compris (sa planche).
 *
 * **Éteint, rien ne se déplie.** Un champ sous un réglage coupé invite à le
 * remplir pour rien, arrêté sur la planche du plan des réglages.
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
    <div className="relative">
      {/* Le filet se pose au-dessus de chaque réglage ; le paquet rogne le premier. */}
      <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
      <button
        type="button"
        role="switch"
        aria-checked={allume}
        onClick={() => onBascule(!allume)}
        className="flex min-h-[64px] w-full items-center gap-[14px] py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
            {nom}
          </span>
          <span className="mt-0.5 block text-[14px] leading-[1.4]" style={{ color: colors.inkSoft }}>
            {dit}
          </span>
        </span>
        {/* 52 × 32 : la piste tient la cible de 44 px avec la hauteur de sa
            ligne, et reste sous le pouce sans écraser le libellé. Allumée, elle
            prend le vert des boutons, celui de la boîte des planches soignées
            qu'il a regardée le 26 octobre 2026 ; sur Nuit et Sylve ce vert est
            clair, et la pastille sombre (`card`) s'y lit. */}
        <span
          aria-hidden="true"
          className="relative h-8 w-[52px] flex-none rounded-full transition-colors"
          style={{ backgroundColor: allume ? colors.plein : voile(colors.ink, 0.18) }}
        >
          <span
            className="absolute top-[3px] h-[26px] w-[26px] rounded-full transition-all"
            style={{ left: allume ? 23 : 3, backgroundColor: colors.card }}
          />
        </span>
      </button>
      {allume && children && <div className="pb-4">{children}</div>}
    </div>
  );
}

/** Un nombre en grand et son unité dorée, sur une plage crème. */
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
    <label
      className="flex min-h-[56px] items-center gap-2.5 rounded-[10px] px-3.5 focus-within:shadow-[inset_0_0_0_2px_var(--atlas-or,#B98B47)]"
      style={{ backgroundColor: colors.cream }}
    >
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`${unite === "%" ? "Pourcentage" : "Nombre de jours"}, entre ${bornes.min} et ${bornes.max}`}
        value={valeur ?? ""}
        onChange={(e) => onEcrire(Number(e.target.value.replace(/\D/g, "")) || 0)}
        onBlur={(e) => onFini(Number(e.target.value.replace(/\D/g, "")) || 0)}
        className="w-[3.4ch] border-0 bg-transparent p-0 outline-none"
        style={{
          fontFamily: font.display,
          fontSize: 24,
          lineHeight: 1,
          color: colors.ink,
          fontVariantNumeric: "tabular-nums lining-nums",
        }}
      />
      <span style={{ fontFamily: font.display, fontSize: 20, lineHeight: 1, color: colors.or }}>{unite}</span>
      {/* **Aucun montant ici.** Un « soit 1 044 € » se contredirait au premier
          chiffre changé, vu sur la planche le 13 août, jamais par un test. */}
      <span className="ml-auto text-right text-[14.5px] leading-[1.3]" style={{ color: colors.inkSoft }}>
        {apres}
      </span>
    </label>
  );
}

/**
 * Un texte libre, sur plusieurs lignes.
 *
 * **Il n'a plus de forme courte depuis le 18 septembre 2026** : la seule case
 * d'une ligne, les moyens de paiement, est devenue trois choix
 * (`MOYENS_ACCEPTES`), et une branche que plus rien n'emprunte ne reste pas
 * (`CLAUDE.md` §4 quinquies).
 *
 * `papier` : le texte part tel quel chez le client (les conditions générales),
 * il s'écrit donc sur son papier.
 */
export function Libre({
  valeur,
  exemple,
  lignes = 2,
  aria,
  papier = false,
  onEcrire,
  onFini,
}: {
  valeur: string;
  exemple: string;
  /** Hauteur du champ, en lignes. Deux pour un texte de pied ; bien plus pour des conditions générales. */
  lignes?: number;
  /** Le nom du champ pour qui ne le voit pas. Sans lui, celui du réglage historique. */
  aria?: string;
  papier?: boolean;
  onEcrire: (t: string) => void;
  onFini: (t: string) => void;
}) {
  return (
    <textarea
      value={valeur}
      placeholder={exemple}
      rows={lignes}
      aria-label={aria ?? "Texte ajouté en bas de chaque document"}
      onChange={(e) => onEcrire(e.target.value)}
      onBlur={(e) => onFini(e.target.value)}
      className="block w-full resize-none rounded-[10px] border-0 px-4 py-3.5 outline-none focus:shadow-[inset_0_0_0_2px_var(--atlas-or,#B98B47)]"
      // 16 px, jamais moins : en dessous, iOS agrandit la page à la mise au point.
      style={
        papier
          ? { ...stylePapier, fontSize: 16, lineHeight: 1.55 }
          : { backgroundColor: colors.cream, color: colors.ink, fontSize: 16, lineHeight: 1.5 }
      }
    />
  );
}

/**
 * L'état d'une chose, un point ET un mot, jamais la couleur seule (la boîte
 * des planches soignées). Sans ton, il est neutre : « Le vôtre ».
 */
export function Etat({ ton, children, dataAtlas }: { ton?: Ton; children: React.ReactNode; dataAtlas?: string }) {
  // L'or n'est pas une plage teintée ici mais un liseré : un chiffre à retenir
  // se cerne, il ne se remplit pas (`.etat[data-ton="or"]` de la boîte).
  const style: React.CSSProperties =
    ton === "or"
      ? { color: colors.or, boxShadow: `inset 0 0 0 1px ${voile(colors.or, 0.6)}` }
      : ton
        ? { backgroundColor: teintesDuTon(ton).fond, color: teintesDuTon(ton).texte }
        : { backgroundColor: voile(colors.ink, 0.06), color: colors.inkSoft };
  return (
    <span
      data-atlas={dataAtlas}
      className="inline-flex min-h-[28px] items-center gap-[7px] whitespace-nowrap rounded-full px-[11px] text-[13.5px] font-semibold leading-none"
      style={style}
    >
      <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full" style={{ backgroundColor: "currentColor" }} />
      {children}
    </span>
  );
}

/**
 * « Enregistré au fur et à mesure. », la coche verte devant : le numéro et
 * l'allure s'enregistrent seuls, sans bouton, et il doit le lire.
 */
export function Enregistre({ enCours }: { enCours: boolean }) {
  return (
    <p className="mx-6 mt-[18px] flex items-center gap-2 text-[14.5px]" style={{ color: colors.inkSoft }}>
      <span style={{ color: colors.carteVertTexte }}>
        <Picto nom="coche" taille={18} epaisseur={2.2} />
      </span>
      {enCours ? "Enregistrement…" : "Enregistré au fur et à mesure."}
    </p>
  );
}

/**
 * L'allure de la page, en petit, sans un seul chiffre calculé.
 *
 * **L'encre vient de `encreSurFond`, la MÊME fonction que le PDF.** L'écrire
 * une seconde fois ici donnerait, tôt ou tard, un aperçu lisible et un devis
 * qui ne l'est pas, et c'est le devis que le client reçoit (`CLAUDE.md` §3).
 *
 * **Le titre à gauche, le numéro à droite, comme le PDF** (`document-commun.ts`,
 * sa planche du 14 septembre 2026). L'aperçu centrait « DEVIS » depuis le
 * 23 août : il montrait une mise en page que le document n'a plus.
 */
export function Feuille({
  allure,
  logo,
  nom,
  numero,
}: {
  allure: Allure;
  logo: string | null;
  nom: string;
  /** Le numéro d'exemple, au format qu'il a choisi. */
  numero: string;
}) {
  const { encre, encreDouce } = encreSurFond(allure.fond);
  const typo = typographieDe(allure.typographie);
  return (
    <div
      data-atlas="allure-feuille"
      aria-label="L'allure de la page"
      className="rounded-[8px] px-4 pb-3.5 pt-4"
      style={{
        backgroundColor: allure.fond,
        color: encre,
        fontFamily: typo.pileCss ?? undefined,
        boxShadow: ombrePapier,
      }}
    >
      {/* `unoptimized` : le logo vient de sa route de fichiers, derrière sa
          session ; l'optimiseur d'images de Next ne la traverserait pas. */}
      {logo && (
        <Image
          src={`/api/fichiers/${logo}`}
          alt=""
          width={LOGO_LARGEUR_MAX}
          height={LOGO_HAUTEUR}
          unoptimized
          className="mb-1.5 h-[30px] w-auto object-contain"
        />
      )}
      <p className="text-[19px] leading-[1.15]">{nom || "Votre entreprise"}</p>
      <p className="mt-[3px] text-[13px]" style={{ color: encreDouce }}>
        Adresse, SIRET, téléphone
      </p>
      <div className="mb-[9px] mt-2.5 h-[1.5px]" style={{ backgroundColor: encre }} />
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] tracking-[0.2em]">DEVIS</span>
        <span className="text-[13px]" style={{ color: encreDouce, fontVariantNumeric: "tabular-nums" }}>
          n° {numero}
        </span>
      </p>
      <p className="mb-1 mt-[9px] text-[13px] font-bold tracking-[0.1em]" style={{ color: allure.accent }}>
        ÉMETTEUR et CLIENT
      </p>
      {["Taille de haie", "Évacuation des déchets"].map((l) => (
        <div
          key={l}
          className="flex items-center justify-between py-1 text-[13.5px]"
          style={{ boxShadow: `inset 0 -1px 0 ${voile(encreDouce, 0.45)}` }}
        >
          <span>{l}</span>
          {/* Un trait, pas un montant : l'aperçu ne porte aucun prix. */}
          <span aria-hidden className="block h-[2px] w-[14px]" style={{ backgroundColor: encreDouce }} />
        </div>
      ))}
      {/* **Le total reste à l'ENCRE, et c'est ce que le PDF fait.** Il a été
          dessiné en accent sur la planche du 7 septembre 2026, à tort : la
          fabrique (`document-commun.ts`) ne colore que les intitulés de parties
          et la remise. Un aperçu qui colore ce que le document ne colore pas
          est un aperçu qui ment. */}
      <p className="mt-2 text-right text-[14px]" style={{ color: encre }}>
        Total TTC
      </p>
    </div>
  );
}
