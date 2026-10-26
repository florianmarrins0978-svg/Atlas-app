"use client";

import { useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import { MAX_SALARIES, phraseDesSalaries, salariesAffiches } from "@/lib/equipes";
import FichePhoto from "@/components/atlas/FichePhoto";
import TeteRonde from "@/components/atlas/TeteRonde";
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
    <section className="mx-[22px]" data-atlas="vos-salaries">
      {/* **LE TITRE POSE LA QUESTION — sa réponse A du 8 septembre 2026**
          (planche `appli/deux-compteurs-de-l-equipe.html`), et c'est le même
          geste que sur le compteur du dessus.

          **Ce qu'il répare :** les deux compteurs se suivaient, au dessin
          identique, avec le même chiffre — « 2 » et « 2 ». Deux étiquettes en
          capitales ne les distinguaient pas ; deux questions, si.

          **Les noms vivent dans la plage du compteur** (planche du 26 octobre
          2026) : ce sont ses gens, et la plage dit qu'ils vont ensemble. */}
      <h2
        className="mb-2.5 mt-8 text-[22px] leading-[1.25]"
        style={{ fontFamily: font.display, color: colors.ink, letterSpacing: "-0.005em" }}
      >
        Combien de salariés&nbsp;?
      </h2>

      <div className="rounded-[6px] px-[18px] pb-4 pt-5" style={{ backgroundColor: colors.card }}>
        <CompteurRond
          valeur={nombre}
          plancher={0}
          plafond={MAX_SALARIES}
          libelleMoins="Un salarié de moins"
          libellePlus="Un salarié de plus"
          onChanger={changerNombre}
        />

        <p className="mt-3.5 text-balance text-center text-[15px] leading-[1.5]" style={{ color: colors.inkSoft }}>
          {phraseDesSalaries(nombre)}
        </p>

        {nombre > 0 ? (
          <div className="mt-3">
            {lignes.map((e, i) => (
              <LigneNom
                key={e.rang}
                rang={e.rang}
                premiere={i === 0}
                valeur={noms[e.rang] ?? ""}
                photo={photos[e.rang] ?? null}
                onOuvrirFiche={() => setFiche(e.rang)}
                onEcrire={(v) => setNoms((cur) => ({ ...cur, [e.rang]: v }))}
                onPoser={(v) => nommerEquipeAction(e.rang, v)}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* **L'écart est écrit, et seulement quand il existe.** C'est ce que la
          planche 97 lui a fait toucher du doigt : un compteur qui annonce plus
          de gens qu'il n'y a de noms. Une phrase permanente sous la liste
          serait du bruit ; celle-ci ne parle que lorsqu'il y a quelque chose à
          dire (`CLAUDE.md` §4 ter). */}
      {nombre > 0 && sansNom > 0 ? (
        <p className="mx-0.5 mt-3 text-[14.5px] leading-[1.5]" style={{ color: colors.inkSoft }}>
          {sansNom === 1 ? (
            <>
              Un salarié n&apos;a pas de nom :{" "}
              <span className="font-semibold" style={{ color: colors.ink }}>le chantier le montrera sous son numéro</span>.
            </>
          ) : (
            <>
              {sansNom} salariés n&apos;ont pas de nom :{" "}
              <span className="font-semibold" style={{ color: colors.ink }}>le chantier les montrera sous leur numéro</span>.
            </>
          )}
        </p>
      ) : null}

      {fiche !== null ? (
        <FichePhoto
          repli={fiche}
          nom={(noms[fiche] ?? "").trim() || `Salarié ${fiche}`}
          photo={photos[fiche] ?? null}
          envoyer={(fichier) => {
            const fd = new FormData();
            fd.set("rang", String(fiche));
            fd.set("fichier", fichier);
            return poserPhotoSalarieAction(fd);
          }}
          retirer={() => retirerPhotoSalarieAction(fiche)}
          onPhoto={(cle) => setPhotos((cur) => ({ ...cur, [fiche]: cle }))}
          onFermer={() => setFiche(null)}
        />
      ) : null}
    </section>
  );
}

/**
 * Une ligne : le rond du rang (ou sa photo), puis le champ qui occupe tout le
 * reste.
 *
 * **Le champ fait 18 px, jamais moins de 16.** En dessous de 16, Safari zoome à la
 * mise au point et l'écran saute sous le doigt — le patron le vit à chaque
 * saisie sur son téléphone.
 *
 * Le placeholder EST le repli : ce qui sera écrit à sa place est sous les yeux
 * avant d'être subi.
 */
function LigneNom({
  rang,
  premiere,
  valeur,
  photo,
  onOuvrirFiche,
  onEcrire,
  onPoser,
}: {
  rang: number;
  premiere: boolean;
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
    <div className="relative flex min-h-[64px] items-center gap-3.5">
      {/* Le filet part du nom, pas du rond (planche du 26 octobre 2026) : les
          ronds se lisent comme une colonne de numéros. */}
      {!premiere && (
        <span aria-hidden className="absolute left-[58px] right-0 top-0 h-px" style={{ backgroundColor: colors.line }} />
      )}
      {/* **Le rond du rang ouvre la fiche** (sa réponse B du 27 septembre
          2026). Il reste à la place du numéro : sans photo, il montre le même
          chiffre en or qu'avant. 44 px, la taille d'un doigt. **Le champ en
          main l'entoure d'or** : on voit quelle ligne on écrit. */}
      <button
        type="button"
        data-atlas="ouvrir-fiche-salarie"
        aria-label={`Photo du salarié ${rang}`}
        onClick={onOuvrirFiche}
        className="flex-none rounded-full"
        style={{ boxShadow: aLaMain ? `0 0 0 2px ${colors.or}` : "none", transition: "box-shadow .26s" }}
      >
        <TeteRonde repli={rang} photo={photo} taille={44} />
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
        style={{ fontFamily: font.display, fontSize: 18, lineHeight: 1.3, color: colors.ink }}
      />
    </div>
  );
}
