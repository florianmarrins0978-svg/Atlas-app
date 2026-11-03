"use client";

import { useMemo, useState } from "react";
import type React from "react";
import { colors, font } from "@/lib/design-tokens";
import IconeTrait from "@/components/atlas/IconeTrait";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import { CocheFaite } from "@/components/atlas/LettreDuClient";
import { jourIso, moisAbrege } from "@/lib/jour";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import VisionneusePhoto from "@/components/atlas/VisionneusePhoto";
import { ChampRecherche } from "@/components/atlas/ChampRecherche";
import FiltreDeDate from "@/components/atlas/FiltreDeDate";
import { moisEnCours } from "@/lib/periode";
import {
  compteDesTaches,
  rangerLesRetours,
  type RetourEnListe,
} from "@/lib/retour-intervention";
import { marquerLeRetourVuAction } from "./actions";

/**
 * LA LISTE DES RETOURS — rangée par client, filtrée d'un doigt.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CET ÉCRAN NE DÉCIDE DE RIEN.** Ce qui range, ce qui filtre et ce qui compte
 * vit dans `src/lib/retour-intervention.ts` et s'éprouve sans navigateur. Ici
 * on affiche, et l'on choisit où le doigt se pose.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI PAR CLIENT** — sa demande, et sa raison valait mieux que celle
 * qu'on défendait : un retour se garde des ANNÉES. Rangés par date, les deux
 * passages chez le même homme seraient à quinze mois d'écart dans la liste ;
 * rangés par client, ils se lisent côte à côte — et c'est ainsi qu'on retrouve
 * ce qu'on avait fait la dernière fois.
 *
 * **Deux filtres, et ils font deux métiers.** Le champ sert quand il sait qui
 * il cherche ; la date sert quand il sait quand. Depuis le 22 septembre 2026,
 * la date est celle des fiches de sécurité — jour, mois, année, par la roue du
 * téléphone (*« met le filtre jours mois année de la fiche de sécurité »*) —
 * et elle remplace les pastilles d'années. Un nom tapé passe par-dessus.
 */
export default function ListeDesRetours({ retours }: { retours: RetourEnListe[] }) {
  const [cherche, setCherche] = useState("");
  const [periode, setPeriode] = useState(() => moisEnCours());

  const groupes = useMemo(
    () => rangerLesRetours(retours, { client: cherche, periode }),
    [retours, cherche, periode]
  );

  return (
    <div className="pb-10" data-atlas="liste-des-retours">
      <EnTeteEcran titre="Retours d'intervention" retour={{ href: "/termines", libelle: "Retour aux chantiers terminés" }}
        allure="commune" />

      {/* La date en tête et le champ dessous : l'ordre des fiches de sécurité,
          pour que les deux listes se lisent pareil. */}
      <FiltreDeDate periode={periode} choisir={setPeriode} />

      <ChampRecherche
        valeur={cherche}
        onChange={setCherche}
        placeholder="Un nom de client"
        ariaLabel="Chercher un client"
        dataAtlas="chercher-un-client"
        className="mx-[22px] mt-3"
      />

      {groupes.length === 0 ? (
        <div className="px-[30px] pt-11 pb-6 text-center">
          <span className="mx-auto mb-3.5 grid w-fit" style={{ color: colors.or }}>
            <IconeTrait nom="document" taille={40} epaisseur={1.4} />
          </span>
          <p className="mx-auto max-w-[26em] text-[15px] leading-normal" style={{ color: colors.inkSoft }}>
            {retours.length === 0
              ? "Rien encore. Un retour arrive ici quand un salarié pose « c'est fini » sur sa fiche."
              : "Aucun retour ne correspond."}
          </p>
        </div>
      ) : (
        groupes.map((groupe) => (
          <section key={groupe.client} className="mx-[22px]" data-atlas="groupe-de-retours">
            {/* **Rangés par client, avec leur nombre — sa planche du
                31 octobre 2026** (`appli/soignee/termines-retours.html`). Les
                cartes bordées deviennent une plage par client, les retours
                séparés d'un filet, comme partout dans l'appli. */}
            <div className="mt-6 mb-2 flex items-baseline justify-between gap-3">
              <b className="text-[21px] font-normal leading-[1.2]" style={{ fontFamily: font.display }}>
                {groupe.client}
              </b>
              <span className="flex-none text-[14.5px]" style={{ color: colors.inkSoft }}>
                {groupe.retours.length} retour{groupe.retours.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="rounded-md px-[18px] py-1" style={{ backgroundColor: colors.card }}>
              {groupe.retours.map((r, rang) => (
                <Carte key={r.id} retour={r} premier={rang === 0} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/**
 * UN RETOUR SUR LA LISTE — et ce qu'il contient, quand il l'ouvre.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **SA PROPOSITION A, tranchée le 9 septembre 2026** :
 * *« la A c'est bien, mais tu peux faire en sorte qu'elle s'ouvre en grand et
 * qu'elle puisse se replier »* (`appli/voir-un-retour.html`).
 *
 * **Ce qu'elle répare.** La carte annonçait « tout fait · 2 photos » : un
 * résumé qu'il ne pouvait pas vérifier, et deux photos qui n'existaient qu'en
 * chiffre. Or ce qu'il regarde ici décide s'il facture un travail qui a eu lieu.
 *
 * **CE QUI N'A PAS ÉTÉ FAIT S'ÉCRIT**, plutôt que de se déduire d'une
 * soustraction : c'est la seule ligne qui l'arrêtera avant d'envoyer une
 * facture de trop.
 *
 * **« Replier » vit au BAS de la feuille**, là où son doigt arrive une fois
 * qu'il a tout lu — en haut, il faudrait remonter pour refermer ce qu'on vient
 * de parcourir.
 */
function Carte({ retour, premier }: { retour: RetourEnListe; premier: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [lu, setLu] = useState(retour.vu);
  const [enGrand, setEnGrand] = useState<number | null>(null);
  const compte = compteDesTaches(retour.taches);
  // Le jour de SON fuseau : un retour posé à 23 h 30 appartient à ce jour-là.
  const jour = jourIso(new Date(retour.poseLe));
  const semaine = new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", timeZone: "UTC" });
  // Le mois du haut dit l'année ; elle ne se répète que si ce n'est plus celle-ci.
  const annee = jour.slice(0, 4) === jourIso(new Date()).slice(0, 4) ? null : jour.slice(0, 4);

  return (
    <div className={premier ? "" : "border-t"} style={{ borderColor: colors.line }}>
      {/* **CE N'EST NI UN BLOC MUET, NI UN LIEN.** Il ouvre ce qu'il porte, ici
          même : le chantier, lui, s'atteint par des règles d'accès qui vivent
          déjà dans `portesDuPlanning`, et les recopier ferait la seconde
          vérité que `CLAUDE.md` §3 interdit. */}
      <button
        type="button"
        onClick={() => {
          const prochain = !ouvert;
          setOuvert(prochain);
          if (prochain && !lu) {
            setLu(true);
            void marquerLeRetourVuAction(retour.id);
          }
        }}
        data-atlas="carte-de-retour"
        aria-expanded={ouvert}
        className="flex min-h-[72px] w-full items-center gap-3.5 py-3 text-left"
        style={{ color: colors.ink, WebkitTapHighlightColor: "transparent" }}
      >
        {/* **Le jour en grand à gauche**, comme les dates du mois du client :
            l'œil descend la colonne des jours avant de lire les noms. */}
        <span className="w-12 flex-none text-center leading-none" aria-hidden="true">
          <b className="block text-[25px] font-normal" style={{ fontFamily: font.display, fontVariantNumeric: "lining-nums" }}>
            {Number(jour.slice(8, 10))}
          </b>
          <span className="mt-1 block text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: colors.inkSoft }}>
            {moisAbrege(jour)}
          </span>
          {annee && (
            <span className="mt-[3px] block text-[11px] font-semibold" style={{ color: colors.inkSoft }}>
              {annee}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[17.5px] leading-[1.25]" style={{ fontFamily: font.display }}>
            {/* **LA PASTILLE DES NON-LUS — sa demande du 9 septembre 2026 :**
                *« comme pour les SMS »*. À gauche du nom, sur la colonne que
                l'œil descend. En `or` et non en `alert` : un retour non lu
                n'est pas un incident, c'est du courrier. */}
            {!lu && (
              <span
                aria-hidden="true"
                data-atlas="retour-non-lu"
                className="h-[9px] w-[9px] flex-none rounded-full"
                style={{ backgroundColor: colors.or }}
              />
            )}
            <span className={lu ? "" : "font-semibold"}>{retour.posePar}</span>
          </span>
          <span className="mt-[3px] flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[14.5px]" style={{ color: colors.inkSoft }}>
            <span className="first-letter:uppercase">{[semaine, compte].filter(Boolean).join(", ")}</span>
            {/* **Ce qui est à signaler se dit dès la liste**, sans ouvrir : un
                mot de son salarié ne doit pas attendre qu'il pense à déplier. */}
            {retour.aSignaler && <EtatEcrit ton="ambre">À signaler</EtatEcrit>}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="flex-none transition-transform duration-200"
          style={{ color: colors.chevron, transform: ouvert ? "rotate(90deg)" : "none" }}
        >
          <IconeTrait nom="suivant" taille={20} epaisseur={2} />
        </span>
      </button>
      {ouvert && (
        <div data-atlas="retour-deplie" className="pb-3.5">
          {retour.taches.length > 0 && (
            <>
              <Rubrique premiere>Ce qui a été fait</Rubrique>
              <ul className="m-0 list-none p-0">
                {retour.taches.map((t, rang) => (
                  <li
                    key={`${t.libelle}-${rang}`}
                    className="flex min-h-10 items-center gap-3 text-[16px] leading-[1.35]"
                    style={{ color: t.faite ? colors.ink : colors.inkSoft }}
                    data-atlas={t.faite ? "tache-faite" : "tache-pas-faite"}
                  >
                    {t.faite ? (
                      <CocheFaite taille={24} />
                    ) : (
                      <span aria-hidden="true" className="h-6 w-6 flex-none rounded-full" style={{ boxShadow: `inset 0 0 0 1.5px ${colors.chevron}` }} />
                    )}
                    <span className="min-w-0 flex-1">{t.libelle}</span>
                    {/* **Ce qui n'a pas été fait le DIT.** Une case vide se lit
                        comme un oubli de lecture ; ces deux mots l'arrêtent
                        avant de facturer un travail qui n'a pas eu lieu. */}
                    {!t.faite && <EtatEcrit ton="ambre">Pas fait</EtatEcrit>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {retour.photos.length > 0 && (
            <>
              <Rubrique premiere={retour.taches.length === 0}>Photos</Rubrique>
              {/* **EN GRAND, et c'est sa demande.** Des vignettes de 62 px ne
                  montrent pas si la haie est taillée ; deux colonnes le font.
                  `next/image` réécrit le `src` via `/_next/image`, or ces
                  fichiers sortent d'une route gardée qui vérifie à qui ils
                  appartiennent : les faire passer par l'optimiseur poserait un
                  second chemin vers des photos de chantier. */}
              <div className="grid grid-cols-2 gap-2">
                {retour.photos.map((photo, rang) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setEnGrand(rang)}
                    aria-label="Voir la photo en grand"
                    data-atlas="ouvrir-la-photo"
                    className="block h-[132px] w-full overflow-hidden rounded-md p-0"
                    style={{ backgroundColor: colors.rustTint, WebkitTapHighlightColor: "transparent" }}
                  >
                    <img
                      src={`/api/fichiers/${photo.storageKey}`}
                      alt=""
                      data-atlas="photo-du-retour"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </>
          )}
          {retour.aSignaler && (
            <>
              <Rubrique premiere={retour.taches.length === 0 && retour.photos.length === 0}>À signaler</Rubrique>
              <p
                className="rounded-md px-4 py-[13px] text-[14.5px] leading-[1.45]"
                style={{ backgroundColor: colors.carteAmbreFond, color: colors.carteAmbreTexte }}
              >
                « {retour.aSignaler} »
              </p>
            </>
          )}
          <div className="mt-1.5 flex justify-center">
            <button
              type="button"
              onClick={() => setOuvert(false)}
              data-atlas="replier-le-retour"
              className="min-h-12 px-1 text-[16px] font-semibold"
              style={{ color: colors.rust, WebkitTapHighlightColor: "transparent" }}
            >
              Replier
            </button>
          </div>
        </div>
      )}
      {/* **La visionneuse est celle de la pellicule des chantiers**, sortie
          dans `components/atlas/VisionneusePhoto.tsx` plutôt que recopiée : une
          seule façon de regarder une photo, une seule façon d'en sortir. Elle
          n'offre pas de supprimer : ce qu'un salarié a photographié n'est pas
          à effacer depuis l'écran qui sert à le vérifier. */}
      {enGrand !== null && (
        <VisionneusePhoto
          photos={retour.photos.map((p) => `/api/fichiers/${p.storageKey}`)}
          rang={enGrand}
          onRang={setEnGrand}
          onFermer={() => setEnGrand(null)}
        />
      )}
    </div>
  );
}

/** Le mot de rangement d'une partie dépliée : « Ce qui a été fait », « Photos ». */
function Rubrique({ premiere, children }: { premiere: boolean; children: React.ReactNode }) {
  return (
    <p
      className={`${premiere ? "mt-1.5" : "mt-5"} mb-2.5 text-[13px] font-semibold uppercase tracking-[0.12em]`}
      style={{ color: colors.inkSoft }}
    >
      {children}
    </p>
  );
}
