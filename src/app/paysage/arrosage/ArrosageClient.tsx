"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { lireLeCroquis, type EtatPlan } from "./actions";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import LePlanDuJardin, { type SesPrix } from "./LePlanDuJardin";
import { prixDesFournisseursAction } from "./actions-fournisseurs";
import DiscuterLePlan from "./DiscuterLePlan";
import DessinerLePlan from "./DessinerLePlan";
import DepuisUnDevis from "./DepuisUnDevis";
import type { ParametresPlan } from "@/lib/arrosage/consignes";
import type { PlanLu as LePlanLu } from "@/lib/arrosage/plan-lu";
import { ACCEPT_PHOTOS } from "@/lib/exif";
import Icone from "./Icones";

/**
 * L'écran « Plan d'arrosage » — deux gestes, et le plan sort.
 *
 * **Sa demande du 20 août 2026**, en trois temps, chacun plus court que le
 * précédent :
 *
 *   1. *« Garde le piquage se fait… avec le bandeau déroulant. Ensuite : le
 *      croquis et ses métrés, avec la possibilité de mettre la photo. Je veux
 *      rien d'autre. »*
 *   2. *« Le titre plan d'arrosage, et en dessous le piquage — tout ce qu'il y a
 *      entre les deux, tu me le supprimes. Tous les autres mots, tu me les
 *      supprimes. Et je ne veux pas qu'il y ait marqué un et deux. »*
 *   3. *« Remets la mesure du débit, mais minimaliste, sans mots qui servent à
 *      rien. »*
 *
 * **Ce qui reste à l'écran : un titre, un déroulant, trois cases, un bouton.**
 * La maquette qui l'a arrêté est `appli/arrosage-simple.html`, et un contrôle y
 * compte les mots pour qu'il n'en regagne pas (`CLAUDE.md` §3 bis).
 *
 * **Le débit s'affiche dès qu'il est calculable, et rien avant.** Trois cases
 * vides n'annoncent pas « 0,00 m³/h » — un zéro se lirait comme une mesure, et
 * c'est la règle du dépôt sur les montants absents (`CLAUDE.md` §4).
 */
export default function ArrosageClient({
  iaPrete,
  motifIA,
}: {
  iaPrete: boolean;
  /** Pourquoi la lecture ne se fera pas, en français. `null` quand elle se fera. */
  motifIA: string | null;
}) {
  const [etat, agir, enCours] = useActionState<EtatPlan, FormData>(lireLeCroquis, { etat: "vide" });
  /**
   * **Les mesures n'apparaissent QUE si le piquage n'est pas au compteur.**
   *
   * *Sa correction du 20 août au soir, sur capture :* « quand je choisis le
   * piquage, qu'il se fait après le compteur d'eau, rien ne doit s'afficher. Il
   * ne doit pas y avoir marqué dix litres, vingt, trois bars. Or, quand je
   * choisis piquage après robinet, là un encart doit s'ouvrir. »
   *
   * Et il a raison sur le fond : après le compteur, la pression du réseau de
   * ville est connue — c'est ailleurs qu'elle ne l'est pas.
   */
  const [piquage, setPiquage] = useState("compteur");
  const formulaire = useRef<HTMLFormElement>(null);
  /**
   * **DESSINER LE PLAN, AU LIEU DE LE PHOTOGRAPHIER** — sa planche B, choisie le
   * 18 octobre 2026. Le dessin part par le MÊME formulaire que la photo, dans
   * un champ caché : le serveur le relit et le fait rejoindre la photo juste
   * après la lecture (`actions.ts`). Un seul envoi, un seul état, un seul plan.
   */
  const [dessiner, setDessiner] = useState(false);
  const [parDessin, setParDessin] = useState(false);
  const champDessin = useRef<HTMLInputElement>(null);
  /**
   * **LE PLAN LU S'OUVRE DANS LE DESSIN** — sa planche du 21 octobre 2026. La
   * photo lue ne donne plus le plan d'un coup : il le vérifie, le corrige, puis
   * « Faire le plan ». Chaque lecture rouvre un dessin neuf (`lecture`).
   */
  const [planLu, setPlanLu] = useState<LePlanLu | null>(null);
  const [lecture, setLecture] = useState(0);
  const [apercu, setApercu] = useState<string | null>(null);
  /**
   * **UNE FOIS LE PLAN FAIT, CE QUI L'A PRODUIT SE REPLIE EN UNE LIGNE** — sa
   * planche soignée du 26 octobre 2026 (« code ça ») : le plan commence en
   * haut de l'écran, et « Modifier » rouvre le piquage, le croquis et le
   * dessin. Replié, rien n'est démonté : le dessin garde ce qu'il a posé.
   */
  const [replie, setReplie] = useState(false);
  // Une lecture neuve se reçoit pendant le rendu, comme React le recommande
  // pour un état qui suit une valeur reçue : un effet la rendrait en deux temps.
  const [etatVu, setEtatVu] = useState(etat);
  if (etat !== etatVu) {
    setEtatVu(etat);
    if (etat.etat === "lu") setReplie(true);
    if (etat.etat === "a-verifier") {
      setReplie(false);
      setPlanLu(etat.plan);
      setLecture((n) => n + 1);
      setDessiner(true);
      // Le croquis dit d'où vient l'eau : le dessin pose le bon repère.
      if (etat.plan.pointDEau === "compteur") setPiquage("compteur");
      else if (etat.plan.pointDEau === "robinet") setPiquage("ailleurs");
    }
  }
  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);

  /**
   * **La photo choisie PART toute seule.**
   *
   * *Sa correction du 20 août au soir :* « quand je clique sur croquis et que
   * j'ajoute une photo, rien ne se passe ».
   *
   * Il avait raison, et c'était un défaut de parcours, pas de code : le bouton
   * ouvrait bien l'appareil, mais rien ne soumettait le formulaire ensuite. Il
   * aurait fallu toucher un second bouton — que l'écran ne montrait pas, à sa
   * demande. **Ma suite ne l'a pas vu parce qu'elle ne posait jamais de
   * photo** : elle vérifiait que le bouton existe, jamais que le geste aboutit
   * (`AGENTS.md` — parcourir en entier ce qu'on transmet).
   */
  function photoChoisie(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      // La photo part seule : un dessin laissé dans le champ caché passerait devant.
      if (champDessin.current) champDessin.current.value = "";
      setParDessin(false);
      setApercu(URL.createObjectURL(e.target.files[0]));
      formulaire.current?.requestSubmit();
    }
  }

  function dessinPret(dessin: string) {
    if (!champDessin.current) return;
    champDessin.current.value = dessin;
    setParDessin(true);
    formulaire.current?.requestSubmit();
  }

  return (
    // 170 px sous la page : la barre du bas ET le geste collé au-dessus d'elle.
    <form ref={formulaire} action={agir} className="pb-[170px]">
      {/* Le titre vient de `EnTeteEcran`, comme sur tous les autres écrans. */}

      {etat.etat === "lu" && replie && (
        <div data-atlas="croquis-replie" className="mx-[22px] mt-2 flex items-center gap-[14px] rounded-[6px] py-3 pl-3 pr-[14px]" style={{ backgroundColor: colors.card }}>
          {apercu && !parDessin && (
            <span aria-hidden="true" className="h-[44px] w-[64px] flex-none rounded-[4px] bg-cover bg-center" style={{ backgroundImage: `url(${apercu})`, boxShadow: `inset 0 0 0 1px ${colors.line}` }} />
          )}
          <span className="min-w-0 flex-1">
            <b className="block" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 18, lineHeight: 1.25 }}>{parDessin ? "Plan dessiné" : "Croquis lu"}</b>
            <span className="mt-[2px] block text-[14px]" style={{ color: colors.inkSoft }}>
              {`${etat.zones.length} zone${etat.zones.length > 1 ? "s" : ""}${parDessin ? "" : ` lue${etat.zones.length > 1 ? "s" : ""}`}, ${piquage === "compteur" ? "au compteur" : "au robinet"}`}
            </span>
          </span>
          <button type="button" onClick={() => setReplie(false)} data-atlas="rouvrir-le-dessin" className="min-h-[44px] bg-transparent text-[16px] font-semibold" style={{ color: colors.or }}>
            Modifier
          </button>
        </div>
      )}

      <div hidden={etat.etat === "lu" && replie}>

      {/* ─── Le piquage, et la mesure ─────────────────────────────────────── */}
      <div className="mx-[22px] mt-2 rounded-[6px] px-[18px] pb-[18px] pt-4" style={{ backgroundColor: colors.card }}>
        <label className="block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }} htmlFor="piquage">
          Le piquage se fait…
        </label>
        <span className="relative mt-2 block">
        {/* 16 px au moins : en dessous, iOS agrandit la page à la mise au point. */}
        <select
          id="piquage"
          name="piquage"
          value={piquage}
          onChange={(e) => setPiquage(e.target.value)}
          className="block w-full appearance-none rounded-[12px] border-0 py-0 pl-4 pr-12 text-[18px]"
          style={{ fontFamily: font.display, backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}`, minHeight: 56 }}
        >
          <option value="compteur">Juste après le compteur d’eau</option>
          {/* Le puits et la cuve sont retirés sur sa demande du 20 août au soir :
              « tu peux retirer le piquage sur une pompe ».

              **Le libellé dit « Robinet de jardin », la valeur reste
              `ailleurs`** — sa dernière correction du même soir. Le mot est ce
              qu'il lit ; la valeur porte la RÈGLE (ici : mesurer plutôt que
              supposer). Les renommer ensemble obligerait à toucher
              `mesure-debit.ts` et sa suite pour un mot d'écran. */}
          <option value="ailleurs">Robinet de jardin</option>
        </select>
        <span className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2" style={{ color: colors.or }}>
          <Icone nom="bas" />
        </span>
        </span>

        {/* **Deux façons de connaître le débit, et il n'en fait qu'une.** Le
            seau donne le débit directement ; le manomètre donne la pression, et
            le débit s'en déduit. Le seau vaut 10 L — c'est ce qu'il a dit, et
            un seau de maçon en fait dix : le demander serait une case de plus
            pour une réponse toujours pareille.

            Rien n'est prérempli : une valeur posée d'avance se prend pour une
            mesure, et il calculerait sur un chiffre que personne n'a relevé
            (`CLAUDE.md` §4). */}
        {/* **DEUX MESURES, DEUX ENCARTS — sa correction du 21 août :** « la
            mesure au seau ne doit pas rentrer dans le kit débit/pression ».
            Elle avait raison de le gêner : ce sont deux gestes, deux outils et
            deux fiabilités. Les ranger sous un même titre laissait croire que
            le seau se relève AVEC le kit, et qu'un chiffre tiré du seau vaut
            celui du manomètre.

            **L'ordre suit le geste sur le chantier** : le seau se fait à mains
            nues, tout de suite ; le kit se visse et se lit. Le premier donne le
            DÉBIT — la seule grandeur qu'aucune pression ne donne. Les deux
            suivants disent ce qui arrivera aux arroseurs (la dynamique décide,
            sous 2,5 bar ils sortent mal) et d'où vient le manque (l'écart avec
            la statique accuse la conduite, pas le réseau).

            Rien n'est prérempli — une valeur posée d'avance se prend pour une
            mesure (`CLAUDE.md` §4). */}
        {piquage !== "compteur" && (
          <div data-atlas="mesures" className="mt-4">
            <div data-atlas="seau">
              <p className="block text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.or }}>
                Mesure au seau
              </p>
              <label className="mt-3 block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }} htmlFor="secondes">
                Un seau de 10 L rempli en… secondes
              </label>
              <input
                id="secondes"
                name="secondes"
                type="number"
                inputMode="decimal"
                min="1"
                step="any"
                placeholder="20"
                className="mt-[5px] block w-full rounded-[10px] border-0 px-[12px] py-3 text-[16px]"
                style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
              />
              {/* **Le seau se dédouane, et il dit QUOI FAIRE À LA PLACE.** Sa
                  correction du 21 août : « peu précis, ordre de grandeur, ça ne
                  va rien dire — qu'on comprenne tout de suite qu'en gros ce
                  n'est pas une bonne idée de calculer au seau pour son arrosage
                  automatique ».

                  Une réserve qui qualifie le chiffre (« approximatif ») se lit
                  comme une nuance et se franchit sans y penser. Une réserve qui
                  DÉCONSEILLE le geste et désigne l'outil juste ferme la
                  question — c'est la différence entre un avertissement qu'on
                  ignore et un avertissement qui change ce qu'on fait. */}
              <p className="mt-[6px] text-[13.5px] font-semibold" style={{ color: colors.carteAmbreTexte }}>
                Trop approximatif pour calculer un arrosage : prenez le kit.
              </p>
            </div>

            <div data-atlas="kit" className="mt-5">
              <p className="block text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.or }}>
                Kit débit / pression, buse 5
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <span className="min-w-0">
                  <label className="block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }} htmlFor="barStatique">
                    Bar statique
                  </label>
                  <input
                    id="barStatique"
                    name="barStatique"
                    type="number"
                    inputMode="decimal"
                    min="0.5"
                    step="any"
                    placeholder="3,5"
                    className="mt-[5px] block w-full min-w-0 rounded-[10px] border-0 px-[12px] py-3 text-[16px]"
                    style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
                  />
                </span>
                <span className="min-w-0">
                  <label className="block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }} htmlFor="barDynamique">
                    Bar dynamique
                  </label>
                  <input
                    id="barDynamique"
                    name="barDynamique"
                    type="number"
                    inputMode="decimal"
                    min="0.5"
                    step="any"
                    placeholder="3"
                    className="mt-[5px] block w-full min-w-0 rounded-[10px] border-0 px-[12px] py-3 text-[16px]"
                    style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
                  />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Le croquis ───────────────────────────────────────────────────── */}
      <div className="mx-[22px]">
        <h2 className="mb-3 mt-7" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 24, lineHeight: 1.15 }}>
          Le croquis et ses métrés
        </h2>

        {/* **L'AVERTISSEMENT SE LIT AVANT DE PHOTOGRAPHIER** — sa demande du
            22 août 2026 : *« c'est un petit message qu'il faut mettre
            au-dessus du croquis, en noir gras »*.

            **Au-dessus du bouton, pas en dessous.** Placé après, il se lirait
            une fois la photo partie — donc trop tard, et il faudrait retourner
            au jardin refaire le croquis. Les trois éléments sont ceux sans
            lesquels l'outil ne propose rien (`CLAUDE.md` §4 bis) : ce texte
            n'est pas une recommandation, c'est la condition d'existence du
            plan. */}
        <p
          data-atlas="avertissement-croquis"
          className="rounded-[6px] px-4 py-[14px] text-[15.5px] font-bold leading-[1.45]"
          style={{ color: colors.ink, backgroundColor: voile(colors.or, 0.13) }}
        >
          Votre croquis doit impérativement contenir les métrés, l’endroit définitif de la
          nourrice, et l’endroit où le piquage se fait (noter l’emplacement du compteur
          d’eau ou du robinet de jardin).
        </p>

        {/* Le bouton plein, 56 px : c'est le geste de l'écran, qu'il fait dehors, avec des gants. */}
        {planLu && !enCours ? (
          <div data-atlas="croquis-lu" className="mt-[14px] flex items-center gap-[14px] rounded-[6px] py-3 pl-3 pr-[14px]" style={{ backgroundColor: colors.card }}>
            {apercu ? (
              <span aria-hidden="true" className="h-[44px] w-[64px] flex-none rounded-[4px] bg-cover bg-center" style={{ backgroundImage: `url(${apercu})`, boxShadow: `inset 0 0 0 1px ${colors.line}` }} />
            ) : null}
            <span className="min-w-0 flex-1">
              <b className="block" style={{ fontFamily: font.display, fontWeight: 400, fontSize: 18, lineHeight: 1.25 }}>Croquis lu</b>
              <span className="mt-[2px] block text-[14px]" style={{ color: colors.inkSoft }}>Vérifiez le plan.</span>
            </span>
            <label htmlFor="croquis" className="flex min-h-[44px] cursor-pointer items-center text-[16px] font-semibold" style={{ color: colors.or }}>
              Reprendre
            </label>
          </div>
        ) : enCours && !parDessin ? (
          <LectureDuCroquis apercu={apercu} />
        ) : (
          <label
            htmlFor="croquis"
            data-atlas="ajouter-croquis"
            className="atlas-plein mt-[14px] flex min-h-[56px] cursor-pointer items-center justify-center gap-[10px] rounded-full text-[17px] font-semibold"
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            <Icone nom="photo" />
            Ajouter la photo du croquis
          </label>
        )}
        {/* `capture` ouvre l'appareil photo du téléphone plutôt que la pellicule :
            le croquis est sous ses yeux, il le photographie. */}
        <input
          id="croquis"
          name="croquis"
          type="file"
          accept={ACCEPT_PHOTOS}
          // **PAS de `capture` — sa demande du 21 août 2026 :** « soit je peux
          // mettre une photo de ma bibliothèque, soit prendre une photo ; le
          // même schéma que pour ajouter des photos à la fiche client ».
          //
          // `capture="environment"` n'est pas une préférence, c'est un ORDRE :
          // le téléphone saute directement à l'appareil et le menu ne s'ouvre
          // jamais. Un croquis se dessine souvent la veille, au bureau — le
          // forcer à le rephotographier depuis son écran est une photo de photo,
          // floue et de travers, que le modèle lira mal.
          //
          // La pellicule du chantier (`Pellicule.tsx`) ne porte pas non plus cet
          // attribut, et c'est bien pour ça que son menu s'ouvre là-bas.
          hidden
          onChange={photoChoisie}
        />
        {/* **Sous la photo, sans la déplacer** : il reconnaît son écran par la
            place de ce qu'il lit (`CLAUDE.md` §3). */}
        <input ref={champDessin} type="hidden" name="dessin" defaultValue="" />
        {!dessiner && (
          <button
            type="button"
            data-atlas="ouvrir-dessin"
            onClick={() => setDessiner(true)}
            className="mt-[10px] flex min-h-[56px] w-full items-center justify-center gap-[10px] rounded-full bg-transparent text-[17px] font-semibold"
            style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
          >
            <Icone nom="crayon" />
            Dessiner le plan
          </button>
        )}
      </div>

      {dessiner && (
        <DessinerLePlan
          key={lecture}
          depart={planLu ?? undefined}
          piquage={piquage}
          onPiquage={setPiquage}
          onFaire={dessinPret}
          enCours={enCours && parDessin}
        />
      )}

      {/* **L'IA indisponible se DIT, et avant le geste.** Sans lecture, le
          laisser photographier pour rien serait le troisième bouton qui ne
          répond pas.

          **Le motif vient du serveur, il n'est pas rédigé ici** — corrigé le
          21 août 2026. L'écran affirmait « aucune clé d'IA n'est posée sur ce
          serveur » quelle que soit la cause : c'est faux quand la clé est là
          mais que le fournisseur choisi ne sait pas lire une image, et cela
          envoie coller une clé qui ne changera rien (`CLAUDE.md` §5). */}
      {!iaPrete && motifIA && (
        <p
          data-atlas="alerte"
          className="mx-[22px] mt-4 text-[13px] leading-relaxed"
          style={{ color: colors.alert }}
        >
          {motifIA} Le croquis ne sera pas lu.
        </p>
      )}

      {/* ─── Un devis déjà fait, sous le croquis (sa décision du 21 octobre 2026) ─── */}
      <DepuisUnDevis />

      {etat.etat === "refus" && etat.croquis ? (
        /* **LE REFUS COMPTE AUTANT QUE LE PLAN** — sa consigne du 11 septembre
           2026, et la maquette `appli/arrosage-plan-et-pieces.html`. Un croquis
           incomplet ne donne AUCUN plan (`CLAUDE.md` §4 bis) : l'écran coche ce
           qui a été lu, barre ce qui manque, et ne propose qu'un geste. */
        <div
          data-atlas="refus-croquis"
          className="mx-[22px] mt-5 rounded-[14px] px-4 pb-4 pt-[18px]"
          style={{ backgroundColor: colors.card }}
        >
          <h3 style={{ fontFamily: font.display, fontWeight: 400, fontSize: 22, lineHeight: 1.2 }}>{etat.raison}</h3>
          <ul className="mt-[14px] list-none p-0">
            <Element
              ok={etat.croquis.lu.zonesMesurees > 0}
              quoi="Les métrés"
              lu={etat.croquis.lu.zonesMesurees > 0 ? `${etat.croquis.lu.zonesMesurees} zone${etat.croquis.lu.zonesMesurees > 1 ? "s" : ""} lue${etat.croquis.lu.zonesMesurees > 1 ? "s" : ""}` : null}
            />
            <Element ok={etat.croquis.lu.piquage} quoi="Le piquage" lu={etat.croquis.lu.piquage ? (etat.croquis.lu.branchement === "compteur" ? "au compteur" : "au robinet") : null} />
            <Element ok={etat.croquis.lu.nourrice} quoi="La nourrice" lu={null} />
          </ul>
          <p className="mt-4 text-[15px] leading-[1.5]" style={{ color: colors.inkSoft }}>
            {etat.geste}
          </p>
          <label
            htmlFor="croquis"
            className="atlas-plein mt-[14px] flex min-h-[56px] cursor-pointer items-center justify-center rounded-[12px] text-[15px] font-semibold"
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            Reprendre la photo
          </label>
        </div>
      ) : etat.etat === "refus" ? (
        <p
          data-atlas="alerte"
          className="mx-[22px] mt-4 text-[13px] leading-relaxed"
          style={{ color: colors.alert }}
        >
          {etat.raison}
        </p>
      ) : null}

      {/* **La `key` repart de zéro à chaque croquis lu.** Garder la discussion
          d'un jardin sur le plan d'un autre ferait répondre Atlas à côté. */}
      {/* **L'écran qu'il a validé le 18 octobre 2026** : le piquage, la nourrice
          éclatée, les réseaux sur le plan, les pièces posées, la liste. La `key`
          repart de zéro à chaque croquis lu : garder la discussion d'un jardin
          sur le plan d'un autre ferait répondre Atlas à côté. */}
      </div>

      {etat.etat === "lu" && <PlanLu key={etat.zones.map((z) => z.nom ?? z.type).join("|")} etat={etat} actionVisible={replie} />}
    </form>
  );
}

/**
 * Le plan et sa discussion partagent les PARAMÈTRES : la discussion les refait,
 * les cases du plan les touchent, et le plan se recalcule des deux côtés par la
 * même fonction. La discussion se pose APRÈS le plan, et seulement avec lui :
 * sa borne du 21 août, *« la discussion ne doit jamais créer un plan »*.
 */
function PlanLu({ etat, actionVisible }: { etat: Extract<EtatPlan, { etat: "lu" }>; actionVisible: boolean }) {
  const [parametres, setParametres] = useState<ParametresPlan>(etat.parametres);
  // Ses prix d'achat (Réglages, Fournisseurs et partenaires), pour la colonne
  // et le total de la liste. Le patron seul les reçoit ; sinon, aucun prix.
  const [sesPrix, setSesPrix] = useState<SesPrix | undefined>(undefined);
  useEffect(() => {
    let vivant = true;
    prixDesFournisseursAction().then(
      (d) => vivant && d && setSesPrix(d),
      () => undefined
    );
    return () => {
      vivant = false;
    };
  }, []);
  return (
    <>
      <LePlanDuJardin
        etat={etat}
        parametres={parametres}
        onParametres={setParametres}
        actionVisible={actionVisible}
        sesPrix={sesPrix}
        surMessageGarde={(id, champs) =>
          setSesPrix((d) => d && { ...d, fournisseurs: d.fournisseurs.map((f) => (f.id === id ? { ...f, ...champs } : f)) })
        }
      />
      <DiscuterLePlan parametres={parametres} surNouveauPlan={(refait) => setParametres(refait.parametres)} />
    </>
  );
}

/** Une ligne du refus : coché quand c'est lu, barré quand ça manque. */
function Element({ ok, quoi, lu }: { ok: boolean; quoi: string; lu: string | null }) {
  return (
    <li className="flex items-center gap-3 py-[9px] text-[15px]" style={{ borderTop: `1px solid ${colors.line}` }}>
      <span
        aria-hidden="true"
        className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full"
        style={{ backgroundColor: ok ? colors.rustTint : colors.alert }}
      >
        {ok ? (
          <span
            className="mt-[-3px] h-[10px] w-[6px] rotate-45"
            style={{ borderRight: `2px solid ${colors.ink}`, borderBottom: `2px solid ${colors.ink}` }}
          />
        ) : (
          <span className="h-[2px] w-[9px]" style={{ backgroundColor: surPlein }} />
        )}
      </span>
      <span className="flex-1" style={ok ? undefined : { color: colors.alert, fontWeight: 600 }}>
        {quoi}
        {lu && (
          <span className="text-[13px]" style={{ color: colors.muted }}>
            {" "}{lu}
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * **LA LECTURE SE VOIT** — sa planche soignée du 26 octobre 2026 : la photo
 * envoyée, balayée d'un trait d'or, et les trois points qui soufflent (sa
 * demande du 23 août, *« mets les trois petits points qui bougent »* : jamais
 * un « … » immobile, `PointsQuiSoufflent`, partagé, `ARCHITECTURE.md` §66).
 * La lecture d'un croquis est la plus longue attente de l'application : on
 * montre ce qui est lu.
 *
 * Le balayage passe par l'animation du navigateur, pas par la feuille de
 * style : il ne sert qu'ici, et qui demande moins de mouvement ne le voit pas.
 */
function LectureDuCroquis({ apercu }: { apercu: string | null }) {
  const trait = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = trait.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const balayage = el.animate([{ transform: "translateY(-100%)" }, { transform: "translateY(355%)" }], {
      duration: 2600,
      iterations: Infinity,
      direction: "alternate",
      easing: "cubic-bezier(0.45, 0, 0.25, 1)",
    });
    return () => balayage.cancel();
  }, []);
  return (
    <div data-atlas="ajouter-croquis" role="status" className="mt-[14px]">
      {apercu && (
        <div
          className="relative h-[220px] overflow-hidden rounded-[6px] bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${apercu})`, backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
        >
          <span
            ref={trait}
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[22%]"
            style={{ borderBottom: `2px solid ${colors.or}`, backgroundImage: `linear-gradient(to bottom, ${voile(colors.or, 0)}, ${voile(colors.or, 0.12)})` }}
          />
        </div>
      )}
      <p className="mt-[14px] flex min-h-[28px] items-center justify-center gap-[10px] text-[16px] font-semibold" style={{ color: colors.inkSoft }}>
        Lecture du croquis
        <span style={{ color: colors.or }}>
          <PointsQuiSoufflent />
        </span>
      </p>
    </div>
  );
}
