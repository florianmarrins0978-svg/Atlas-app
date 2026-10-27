"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import CarteChoix from "@/components/atlas/reglages/CarteChoix";
import { colors, font, voile } from "@/lib/design-tokens";
import {
  ALLURE_PAR_DEFAUT,
  estLAllureParDefaut,
  LOGOS_ACCEPTES,
  refusDuLogo,
  TEINTES_ACCENT,
  TEINTES_FOND,
  TYPOGRAPHIES,
  type Allure,
} from "@/lib/allure-documents";
import { ecrireNumero } from "@/lib/numero-documents";
import {
  majAllureAction,
  poserLogoAction,
  reprendreAllurePhotoAction,
  retirerLogoAction,
} from "../actions";
import Paquet from "@/components/atlas/reglages/Paquet";
import PlageTon, { teintesDuTon } from "@/components/atlas/reglages/PlageTon";
import { Couleur } from "@/components/atlas/Couleur";
import { Enregistre, EXEMPLE_NUMERO, Feuille } from "../pieces";
import Picto from "@/components/atlas/reglages/Picto";

/**
 * « L'ALLURE DE MES DEVIS » — sa demande du 23 août 2026.
 *
 * *« Il faudrait que l'utilisateur puisse avoir un endroit dédié à la
 * modification de son devis. S'il veut rajouter son logo, changer la
 * typographie, changer le fond de page. »*
 *
 * **Ici, et pas dans une rubrique à part** : sa réponse B devant la planche
 * `appli/allure-de-mes-devis.html`. Le découpage du 7 septembre 2026 ne l'en
 * sort pas : cet écran vit SOUS « Devis & factures ». **Le devis et la facture
 * seulement** : la feuille de chantier est interne, et il ne l'a pas demandée.
 *
 * **L'allure s'enregistre SEULE, dès qu'il touche une couleur.** Les conditions
 * engagent l'entreprise ; une couleur ne lie personne. Les faire attendre le
 * même bouton obligerait à valider des conditions pour changer un fond de page.
 *
 * **Rangée d'après la planche des Réglages soignés** (26 octobre 2026) : les
 * deux photos côte à côte, chacune sa couleur ; les polices écrites dans leur
 * police ; les couleurs en pastilles, le nom de celle prise écrit au-dessus.
 * Le libellé « L'allure de la page » au-dessus de l'aperçu est parti : la
 * feuille se reconnaît seule.
 */

/**
 * Les `@font-face` des familles retenues, écrits DEPUIS la liste, jamais à la
 * main.
 *
 * Une famille ajoutée à `TYPOGRAPHIES` doit s'afficher sans qu'on y pense :
 * une seconde liste ici finirait par en oublier une, et le patron aurait un
 * choix qui ne montre rien.
 */
const FACES = TYPOGRAPHIES.flatMap((t) =>
  t.famille && t.fichiers
    ? [
        `@font-face{font-family:"${t.famille}";font-weight:400;font-display:swap;src:url("/api/polices/${t.fichiers.normal}") format("truetype")}`,
        `@font-face{font-family:"${t.famille}";font-weight:700;font-display:swap;src:url("/api/polices/${t.fichiers.gras}") format("truetype")}`,
      ]
    : []
).join("");

/** Les deux gestes de la photo : le même calcul, deux mots et deux tons. */
const PHOTOS = [
  { quoi: "devis", libelle: "Photographier mon devis", ton: "bleu" },
  { quoi: "facture", libelle: "Photographier ma facture", ton: "vert" },
] as const;

export default function AllureClient({
  allureInitiale,
  logoInitial,
  entrepriseNom,
  formatNumero,
}: {
  allureInitiale: Allure;
  /** La clef de son logo dans le stockage, ou `null`. */
  logoInitial: string | null;
  entrepriseNom: string;
  /** Le format de ses numéros : l'aperçu le montre à droite du titre. */
  formatNumero: string | null;
}) {
  const [allure, setAllure] = useState<Allure>(allureInitiale);
  const [logo, setLogo] = useState<string | null>(logoInitial);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const choixImage = useRef<HTMLInputElement | null>(null);
  const choixPhoto = useRef<HTMLInputElement | null>(null);
  // Le geste qui a ouvert le choix de la photo : c'est lui qui dit « Lecture… ».
  const photoVoulue = useRef<"devis" | "facture">("devis");
  const [lecture, setLecture] = useState<"devis" | "facture" | null>(null);

  // ── Reprendre l'allure d'un document PHOTOGRAPHIÉ, sa demande du 25 août ──
  // Ce que la photo a repris (couleurs, police, mentions) et ce qu'elle n'a pas
  // su faire (réserve). Le même geste, la même transition que le réglage à la
  // main juste dessous : photographier n'est qu'une autre façon de le remplir.
  const [reprise, setReprise] = useState<{ repris: string[]; reserve: string | null } | null>(null);

  function reprendrePhoto(f: File) {
    setRefus(null);
    setReprise(null);
    setLecture(photoVoulue.current);
    const formulaire = new FormData();
    formulaire.append("fichier", f);
    demarrer(async () => {
      const r = await reprendreAllurePhotoAction(formulaire);
      setLecture(null);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      // On affiche ce que la base porte (l'allure et les mentions relues),
      // jamais ce que la photo a cru voir : c'est ce qui s'imprimera.
      setAllure(r.allure);
      // **Les mentions relues, elles, ne sont plus affichées ICI** : elles
      // vivent dans « Ce qui s'imprime » depuis le découpage. L'action les a
      // écrites en base, et la réserve ci-dessous dit ce que la photo n'a pas
      // su faire : c'est tout ce que cet écran a le droit d'en montrer.
      setReprise({ repris: r.repris, reserve: r.reserve });
    });
  }

  function poserAllure(partiel: Partial<Allure>) {
    const prochaine = { ...allure, ...partiel };
    setAllure(prochaine);
    demarrer(async () => {
      // **On envoie `null` quand c'est le défaut** : la base garde alors ses
      // colonnes vides, et ses documents suivront la charte si elle bouge.
      const r = await majAllureAction(estLAllureParDefaut(prochaine) ? null : prochaine);
      setRefus(r.ok ? null : r.raison);
      // On réaffiche ce que la base porte : une couleur mal formée y est
      // retombée sur le défaut, et l'écran doit montrer ce qui s'imprimera.
      if (r.ok) setAllure(r.allure);
    });
  }

  return (
    <div className="pb-10">
      {/* **Les vraies polices, servies depuis les fichiers du PDF.** Sans elles,
          ce choix est un mensonge : le navigateur ne connaît aucune des
          familles, et « Merriweather » s'afficherait en Georgia. Vu à la
          capture le 24 août 2026, jamais par un test. */}
      <style>{FACES}</style>

      <p className="mx-6 mt-4 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
        Elle habille votre devis et votre facture. La feuille de chantier, elle, ne change pas : personne
        d&apos;autre que vous ne la lit.
      </p>

      {/* ── PHOTOGRAPHIER UN DEVIS, sa demande du 25 août 2026 ──────────────
          *« faut que l'utilisateur puisse prendre la photo de son devis […]
          pareil pour sa facture »*, après *« on comprend rien, trop compliqué
          pour modifier »*. Dessiné d'abord (`appli/photographier-mon-devis.html`)
          et tranché ainsi : la photo reprend l'ALLURE (couleurs, police) et les
          MENTIONS, jamais les lignes ni les prix, jamais le logo.

          **La photo d'abord, le réglage à la main dessous** : son choix devant
          la question du 25 août. Un seul champ, sans `capture` : le navigateur
          offre alors l'appareil photo OU la photothèque, son devis est parfois
          déjà une image dans sa galerie. */}
      <input
        ref={choixPhoto}
        type="file"
        accept="image/*"
        className="hidden"
        data-atlas="photo-fichier"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) reprendrePhoto(f);
        }}
      />
      {/* Deux gestes côte à côte, un pour chaque document, chacun sa couleur
          (sa planche). La lecture est la même : ce sont ses mots qui changent,
          pas le calcul. */}
      <div className="mx-[22px] mt-4 grid grid-cols-2 gap-2.5">
        {PHOTOS.map((p) => (
          <button
            key={p.quoi}
            type="button"
            data-atlas={`photo-${p.quoi}`}
            disabled={enCours}
            onClick={() => {
              photoVoulue.current = p.quoi;
              choixPhoto.current?.click();
            }}
            className="flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-full px-5 py-3 text-center text-[15px] font-semibold leading-[1.25]"
            style={{
              backgroundColor: teintesDuTon(p.ton).fond,
              color: teintesDuTon(p.ton).texte,
              opacity: enCours ? 0.6 : 1,
            }}
          >
            <Picto nom="photo" taille={22} />
            <span>{lecture === p.quoi ? "Lecture…" : p.libelle}</span>
          </button>
        ))}
      </div>
      <p className="mx-6 mt-2.5 text-[14px] leading-[1.45]" style={{ color: colors.inkSoft }}>
        Les couleurs, la police et les mentions. Ni les lignes, ni les prix.
      </p>

      {reprise && (
        <div data-atlas="photo-repris" role="status" className="mx-[22px] mt-2.5">
          <PlageTon ton={reprise.repris.length > 0 ? "vert" : "ambre"}>
            {reprise.repris.length > 0
              ? `Repris : ${reprise.repris.join(", ")}.`
              : "Rien n'a pu être repris de cette photo."}
            {reprise.reserve && <span className="mt-1 block text-[14px]">{reprise.reserve}</span>}
          </PlageTon>
        </div>
      )}

      {refus && (
        <p
          role="alert"
          data-atlas="allure-refus"
          className="mx-6 mt-2.5 text-[14.5px] leading-[1.4]"
          style={{ color: colors.alert }}
        >
          {refus}
        </p>
      )}

      {/* ── L'APERÇU EN TÊTE, ET IL RESTE COLLÉ, sa proposition B, 24 août 2026
          ────────────────────────────────────────────────────────────────────
          *« Lorsque je modifie mon devis, je suis obligé de descendre pour
          voir les modifications. »* Trois rangements lui ont été dessinés
          (planche 96, `appli/allure-mieux-rangee.html`), et il a répondu
          **« la B »**.

          **Pourquoi COLLÉ et pas seulement remonté** (la proposition A, qu'il
          n'a pas retenue) : posé en tête sans collage, l'aperçu se voit en
          arrivant puis ressort de l'écran dès qu'on descend aux polices. La
          moitié du problème seulement, et la planche le mesurait.

          **`sticky` et non `fixed`** : la feuille suit tant que CET écran est
          à l'écran. Fixée, elle recouvrirait le bas de page.

          **Il reste collé même après le découpage du 7 septembre 2026.** On
          aurait pu croire l'aperçu inutile sur un écran devenu court : il ne
          l'est pas, six polices et deux nuanciers font toujours plus d'un
          écran de téléphone, et c'est justement en descendant qu'on a besoin
          de voir ce qu'on change. */}
      <div
        data-atlas="allure-apercu-colle"
        className="sticky top-0 z-10 mt-[18px] px-[22px] pb-3.5 pt-3"
        // **Une ombre courte sous le bord**, et rien de plus : sans elle, les
        // pastilles qui défilent semblent s'effacer au milieu de nulle part.
        // `voile` la fait suivre l'encre de la charte (`CLAUDE.md` §3).
        style={{ backgroundColor: colors.cream, boxShadow: `0 10px 14px -14px ${voile(colors.ink, 0.6)}` }}
      >
        {/* **Un aperçu d'APPARENCE, et rien d'autre.** Il ne porte aucun
            montant calculé, aucune condition : ce serait une seconde écriture
            du devis, qui finirait par ne plus dire ce que le PDF dit. */}
        <Feuille
          allure={allure}
          logo={logo}
          nom={entrepriseNom}
          numero={ecrireNumero(formatNumero, "devis", EXEMPLE_NUMERO)}
        />
      </div>

      <Paquet titre="Mon logo">
        <div className="py-[18px]">
          <div className="flex flex-wrap items-center gap-3">
            <span
              data-atlas="logo-case"
              className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-[10px] text-[13px]"
              style={{ backgroundColor: colors.cream, color: colors.inkSoft, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            >
              {logo ? (
                <Image
                  src={`/api/fichiers/${logo}`}
                  alt="Votre logo"
                  width={64}
                  height={64}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              ) : (
                "Aucun"
              )}
            </span>
            <input
              ref={choixImage}
              type="file"
              accept={LOGOS_ACCEPTES.join(",")}
              className="hidden"
              data-atlas="logo-fichier"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                // **Refusé ici avec la MÊME fonction que le serveur.** Le laisser
                // partir pour se le voir refuser après le téléversement lui ferait
                // attendre pour rien, sur un forfait de chantier.
                const refusLogo = refusDuLogo(f.type, f.size);
                if (refusLogo) {
                  setRefus(refusLogo);
                  return;
                }
                setRefus(null);
                const formulaire = new FormData();
                formulaire.append("fichier", f);
                demarrer(async () => {
                  const r = await poserLogoAction(formulaire);
                  if (r.ok) setLogo(r.logo);
                  else setRefus(r.raison);
                });
              }}
            />
            <span className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                data-atlas="logo-choisir"
                onClick={() => choixImage.current?.click()}
                className="min-h-[44px] rounded-full px-4 text-[15px] font-semibold"
                style={{ color: colors.or, boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.7)}` }}
              >
                {logo ? "Changer" : "Choisir une image"}
              </button>
              {logo && (
                <button
                  type="button"
                  data-atlas="logo-retirer"
                  onClick={() =>
                    demarrer(async () => {
                      const r = await retirerLogoAction();
                      if (r.ok) setLogo(null);
                      else setRefus(r.raison);
                    })
                  }
                  className="min-h-[44px] rounded-full px-3 text-[16px] font-semibold"
                  style={{ color: colors.ink }}
                >
                  Retirer
                </button>
              )}
            </span>
          </div>
          <p className="mt-2.5 text-[14px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            En haut à gauche, au-dessus de vos coordonnées. PNG ou JPEG, 1,5 Mo au plus.
          </p>
        </div>
      </Paquet>

      <Paquet titre="Typographie" sansPlage>
        <div className="grid grid-cols-2 gap-2.5">
          {TYPOGRAPHIES.map((t) => {
            const choisie = allure.typographie === t.clef;
            return (
              // **Le nom s'écrit DANS la police qu'il nomme** : une liste de
              // noms en linéale ne montre rien de ce qu'on choisit, et c'est la
              // seule chose qu'il regarde ici.
              <CarteChoix
                key={t.clef}
                dataAtlas={`typo-${t.clef}`}
                pris={choisie}
                onChoix={() => poserAllure({ typographie: t.clef })}
                titre={t.nom}
                police={t.pileCss ?? font.body}
                detail={t.clef === ALLURE_PAR_DEFAUT.typographie ? `${t.dit}, par défaut` : t.dit}
              />
            );
          })}
        </div>
      </Paquet>

      <Paquet titre="Fond de page">
        <div className="py-[18px]">
          <Couleur
            allure="soignee"
            titre="Fond de page"
            valeur={allure.fond}
            clef="fond"
            aide="N'importe quelle couleur. Un fond sombre éclaircit le texte tout seul."
            // **Les raccourcis viennent de la liste nommée** (`TEINTES_FOND`), dont
            // le premier est le défaut, jamais un hexa retapé.
            rapides={TEINTES_FOND.map((t) => [t.teinte, t.nom])}
            onChoisir={(v) => poserAllure({ fond: v })}
          />
        </div>
      </Paquet>

      <Paquet titre="Couleur d'accent">
        <div className="py-[18px]">
          <Couleur
            allure="soignee"
            titre="Couleur d'accent"
            valeur={allure.accent}
            clef="accent"
            // **CETTE PHRASE A PROMIS DEUX FOIS CE QUE LE PDF NE FAIT PAS.** Le
            // total d'abord (corrigé le 7 septembre 2026), puis « le trait sous
            // le titre » : `document-commun.ts` le trace à l'encre claire. Seuls
            // les intitulés « Émetteur » et « Client » et la remise prennent
            // l'accent (`titrePartie`). Une aide qui annonce ce que le document
            // ne fait pas se paie à la première capture : il change l'accent,
            // regarde son devis, et croit à une panne (sa planche du
            // 26 octobre 2026).
            aide="Les intitulés « Émetteur » et « Client », et la remise quand il y en a une."
            rapides={TEINTES_ACCENT.map((t) => [t.teinte, t.nom])}
            onChoisir={(v) => poserAllure({ accent: v })}
          />
        </div>
      </Paquet>

      {!estLAllureParDefaut(allure) && (
        <div className="mx-[22px] mt-[18px]">
          <button
            type="button"
            data-atlas="allure-defaut"
            onClick={() => poserAllure({ ...ALLURE_PAR_DEFAUT })}
            className="min-h-[52px] w-full rounded-full text-[16px] font-semibold"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
          >
            Revenir aux réglages d&apos;aujourd&apos;hui
          </button>
        </div>
      )}

      <Enregistre enCours={enCours} />
    </div>
  );
}
