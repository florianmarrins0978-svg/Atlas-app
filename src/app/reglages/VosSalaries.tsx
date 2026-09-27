"use client";

import { useRef, useState } from "react";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { ACCEPT_PHOTOS } from "@/lib/exif";
import { MAX_SALARIES, phraseDesSalaries, salariesAffiches } from "@/lib/equipes";
import BottomSheet from "@/components/atlas/BottomSheet";
import TeteSalarie from "@/components/atlas/TeteSalarie";
import {
  mettreAJourNombreSalariesAction,
  nommerEquipeAction,
  poserPhotoSalarieAction,
  retirerPhotoSalarieAction,
} from "./actions";
import CompteurRond from "./CompteurRond";

/**
 * « Combien de salariés ? » — combien ils sont, et comment ils s'appellent.
 *
 * *Sa demande du 26 août 2026, arrêtée sur la planche 97
 * (`appli/salaries-et-equipes.html`), à laquelle il a répondu **A**.*
 *
 *   *« Il faut avoir un curseur + ou − qui définit le nombre de salariés que
 *     possède l'entreprise et pouvoir affilier des noms. Ceux-là permettront
 *     d'ajouter ces noms au chantier, et plus les équipes A ou B. »*
 *
 * **La règle tient en une phrase : on n'invente jamais un nom, et on ne laisse
 * jamais deux lignes indiscernables.** À zéro salarié il n'y a personne à
 * distinguer — le bloc des noms n'existe pas, et le planning n'écrira rien. Dès
 * un, chaque ligne porte son champ, et un champ vide affiche déjà en gris ce
 * qui sera écrit à sa place.
 *
 * **Le bloc des noms disparaît à zéro, il ne se grise pas.** Le laisser serait
 * un piège : le patron y écrirait un prénom qui n'apparaîtrait nulle part.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE LA PLANCHE 97 LUI A MONTRÉ, ET QU'IL A CHOISI QUAND MÊME.** Un
 * curseur à côté d'une liste de noms crée deux vérités sur la même question :
 * le curseur dit 3, il a écrit 2 noms. La proposition C supprimait le curseur ;
 * il a retenu la A, qui le garde — c'est son appel, et il a été posé.
 *
 * **Ce qui reste de la C, parce qu'il ne faut pas qu'il le découvre au chantier :**
 * l'écart est ÉCRIT sous le compteur. Un salarié annoncé sans nom apparaît
 * quand même sur les chantiers, sous son rang — « Salarié 3 » —, sans quoi
 * ceux qui n'ont pas encore tapé les prénoms de leurs gars ne pourraient plus
 * attribuer un seul chantier.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function VosSalaries({
  initialNombreSalaries,
  initialNoms,
}: {
  initialNombreSalaries: number;
  /** Ce que la base porte, par rang. Un rang absent est un cas ordinaire. */
  initialNoms: { rang: number; nom: string | null; photo: string | null }[];
}) {
  const [nombre, setNombre] = useState(initialNombreSalaries);
  // Les noms vivent ici par RANG, pas par identifiant : l'écran montre des
  // lignes qui n'existent pas encore en base, et exiger un identifiant
  // obligerait à créer vingt lignes vides d'avance.
  const [noms, setNoms] = useState<Record<number, string>>(() =>
    Object.fromEntries(initialNoms.map((e) => [e.rang, e.nom ?? ""]))
  );
  const [photos, setPhotos] = useState<Record<number, string | null>>(() =>
    Object.fromEntries(initialNoms.map((e) => [e.rang, e.photo]))
  );
  // Le rang dont la fiche est ouverte : une seule à la fois.
  const [fiche, setFiche] = useState<number | null>(null);

  async function changerNombre(valeur: number) {
    // Borné ici comme au serveur. **Le plancher est zéro**, contrairement aux
    // équipes : un artisan seul n'a personne à cocher.
    const borne = Math.min(MAX_SALARIES, Math.max(0, valeur));
    if (borne === nombre) return;
    setNombre(borne);
    const r = await mettreAJourNombreSalariesAction(borne);
    setNombre(r.nombreSalaries);
  }

  const lignes = salariesAffiches(
    Object.entries(noms).map(([rang, nom]) => ({ rang: Number(rang), nom })),
    nombre
  );
  const sansNom = lignes.filter((e) => !(noms[e.rang] ?? "").trim()).length;

  return (
    <section
      className="mt-[30px] px-[26px] pt-[26px]"
      style={{ borderTop: `1px solid ${colors.line}` }}
      data-atlas="vos-salaries"
    >
      {/* **LE TITRE POSE LA QUESTION — sa réponse A du 8 septembre 2026**
          (planche `appli/deux-compteurs-de-l-equipe.html`), et c'est le même
          geste que sur le compteur du dessus.

          **Ce qu'il répare :** les deux compteurs se suivaient, au dessin
          identique, avec le même chiffre — « 2 » et « 2 ». Deux étiquettes en
          capitales ne les distinguaient pas ; deux questions, si. */}
      <p className="mb-1.5 text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
        Combien de salariés&nbsp;?
      </p>

      <CompteurRond
        valeur={nombre}
        plancher={0}
        plafond={MAX_SALARIES}
        libelleMoins="Un salarié de moins"
        libellePlus="Un salarié de plus"
        onChanger={changerNombre}
      />

      <p className="mt-2 text-center text-[12.5px] leading-[1.6]" style={{ color: colors.muted }}>
        {phraseDesSalaries(nombre)}
      </p>

      {nombre > 0 ? (
        <div className="mt-[26px]">
          {lignes.map((e) => (
            <LigneNom
              key={e.rang}
              rang={e.rang}
              valeur={noms[e.rang] ?? ""}
              photo={photos[e.rang] ?? null}
              onOuvrirFiche={() => setFiche(e.rang)}
              onEcrire={(v) => setNoms((cur) => ({ ...cur, [e.rang]: v }))}
              onPoser={(v) => nommerEquipeAction(e.rang, v)}
            />
          ))}
          {/* **L'écart est écrit, et seulement quand il existe.** C'est ce que
              la planche 97 lui a fait toucher du doigt : un compteur qui annonce
              plus de gens qu'il n'y a de noms. Une phrase permanente sous la
              liste serait du bruit ; celle-ci ne parle que lorsqu'il y a
              quelque chose à dire (`CLAUDE.md` §4 ter). */}
          {sansNom > 0 ? (
            <p className="mt-3 text-[12.5px] leading-[1.6]" style={{ color: colors.muted }}>
              {sansNom === 1 ? (
                <>
                  Un salarié n&apos;a pas de nom :{" "}
                  <span style={{ color: colors.ink }}>le chantier le montrera sous son numéro</span>.
                </>
              ) : (
                <>
                  {sansNom} salariés n&apos;ont pas de nom :{" "}
                  <span style={{ color: colors.ink }}>le chantier les montrera sous leur numéro</span>.
                </>
              )}
            </p>
          ) : null}
        </div>
      ) : null}

      {fiche !== null ? (
        <FicheSalarie
          rang={fiche}
          nom={(noms[fiche] ?? "").trim() || `Salarié ${fiche}`}
          photo={photos[fiche] ?? null}
          onPhoto={(cle) => setPhotos((cur) => ({ ...cur, [fiche]: cle }))}
          onFermer={() => setFiche(null)}
        />
      ) : null}
    </section>
  );
}

/**
 * La fiche d'un salarié : sa tête en grand, et trois gestes.
 *
 * *Sa réponse B du 27 septembre 2026*, planche `appli/photo-des-salaries.html`.
 *
 * **Deux champs de fichier, et c'est voulu.** « Prendre une photo » porte
 * `capture` et ouvre l'appareil au dos : le patron photographie un de ses gars.
 * « Choisir dans la galerie » ne le porte pas, pour reprendre une photo reçue
 * par message. Un seul champ sans `capture` laisserait iOS proposer les deux,
 * mais Android ouvrirait la galerie seule, et le geste le plus fréquent
 * coûterait un détour.
 *
 * **La photo affichée est celle que le serveur a rangée**, jamais l'aperçu
 * local : un fichier refusé (format, taille) ne doit pas paraître posé.
 */
function FicheSalarie({
  rang,
  nom,
  photo,
  onPhoto,
  onFermer,
}: {
  rang: number;
  nom: string;
  photo: string | null;
  onPhoto: (cle: string | null) => void;
  onFermer: () => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const appareil = useRef<HTMLInputElement>(null);
  const galerie = useRef<HTMLInputElement>(null);

  async function envoyer(fichier: File | undefined) {
    if (!fichier) return;
    setEnCours(true);
    setRefus(null);
    const fd = new FormData();
    fd.set("rang", String(rang));
    fd.set("fichier", fichier);
    const r = await poserPhotoSalarieAction(fd);
    setEnCours(false);
    if (r.ok) onPhoto(r.photo);
    else setRefus(r.raison);
  }

  async function retirer() {
    setEnCours(true);
    setRefus(null);
    const r = await retirerPhotoSalarieAction(rang);
    setEnCours(false);
    if (r.ok) onPhoto(null);
    else setRefus(r.raison);
  }

  return (
    <BottomSheet open onBackdropClick={enCours ? undefined : onFermer}>
      <div data-atlas="fiche-salarie" className="flex flex-col items-center">
        <TeteSalarie rang={rang} photo={photo} taille={132} />
        <p className="mt-3 text-[22px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
          {nom}
        </p>

        <input
          ref={appareil}
          type="file"
          accept={ACCEPT_PHOTOS}
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void envoyer(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={galerie}
          type="file"
          accept={ACCEPT_PHOTOS}
          className="hidden"
          onChange={(e) => {
            void envoyer(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          disabled={enCours}
          onClick={() => appareil.current?.click()}
          className="atlas-plein mt-5 w-full rounded-full py-[15px] text-[15px]"
          style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display }}
        >
          {enCours ? "Un instant…" : "Prendre une photo"}
        </button>
        <button
          type="button"
          disabled={enCours}
          onClick={() => galerie.current?.click()}
          className="mt-2.5 w-full rounded-full py-[15px] text-[15px]"
          style={{ color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
        >
          Choisir dans la galerie
        </button>
        {photo ? (
          <button
            type="button"
            data-atlas="retirer-photo-salarie"
            disabled={enCours}
            onClick={() => void retirer()}
            className="mt-1.5 w-full rounded-full py-3 text-[14.5px]"
            style={{ color: colors.alert }}
          >
            Retirer la photo
          </button>
        ) : null}
        {refus ? (
          <p role="alert" className="mt-3 text-center text-[13px] leading-[1.5]" style={{ color: colors.alert }}>
            {refus}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}

/**
 * Une ligne : le rond du rang (ou sa photo), puis le champ qui occupe tout le
 * reste.
 *
 * **Le champ fait 17 px, jamais moins.** En dessous de 16, Safari zoome à la
 * mise au point et l'écran saute sous le doigt — le patron le vit à chaque
 * saisie sur son téléphone.
 *
 * Le placeholder EST le repli : ce qui sera écrit à sa place est sous les yeux
 * avant d'être subi.
 */
function LigneNom({
  rang,
  valeur,
  photo,
  onOuvrirFiche,
  onEcrire,
  onPoser,
}: {
  rang: number;
  valeur: string;
  photo: string | null;
  onOuvrirFiche: () => void;
  onEcrire: (v: string) => void;
  onPoser: (v: string) => Promise<unknown>;
}) {
  const [aLaMain, setALaMain] = useState(false);
  // Un `div`, plus un `label` : le rond est devenu un bouton, et un `label`
  // qui contient deux commandes envoie l'appui à la PREMIÈRE, donc toucher le
  // nom aurait ouvert la fiche au lieu du champ.
  return (
    <div
      className="flex items-center gap-3.5 py-[9px]"
      style={{
        borderBottom: `1px solid ${aLaMain ? colors.or : colors.line}`,
        transition: "border-color .26s",
      }}
    >
      {/* **Le rond du rang ouvre la fiche** (sa réponse B du 27 septembre
          2026). Il reste à la place du numéro : sans photo, il montre le même
          chiffre en or qu'avant. 44 px, la taille d'un doigt. */}
      <button
        type="button"
        data-atlas="ouvrir-fiche-salarie"
        aria-label={`Photo du salarié ${rang}`}
        onClick={onOuvrirFiche}
        className="flex-none rounded-full"
      >
        <TeteSalarie rang={rang} photo={photo} taille={44} />
      </button>
      <input
        type="text"
        value={valeur}
        placeholder={`Salarié ${rang}`}
        aria-label={`Nom du salarié ${rang}`}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint={rang >= MAX_SALARIES ? "done" : "next"}
        onChange={(e) => onEcrire(e.target.value)}
        onFocus={() => setALaMain(true)}
        onBlur={(e) => {
          setALaMain(false);
          void onPoser(e.target.value);
        }}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 outline-none"
        style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.3, color: colors.ink }}
      />
    </div>
  );
}
