"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { lireCroquis } from "@/server/ai/services/lire-croquis";
// Module JavaScript repris tel quel de `appli/` — voir l'en-tête du fichier.
import { calculerPlan } from "@/lib/arrosage/calcul.js";
import { trajetLePlusLong, poserSurLeTerrain } from "@/lib/arrosage/geometrie-croquis";
import { debitRetenu, SEAU_LITRES } from "@/lib/arrosage/mesure-debit";
import { dessinerPlan, type Dessin, type ZoneDessinee } from "@/lib/arrosage/plan-dessine";
import { MESSAGE_PHOTO_REFUSEE, photoAcceptee } from "@/lib/exif";
import { verifierLimite, LIMITES } from "@/server/rate-limit";

/**
 * Les gestes de l'écran « Plan d'arrosage ».
 *
 * *Sa demande du 20 août 2026 : « code le tout dans l'appli ».*
 *
 * **Un seul geste, et il fait tout** : la photo part à la lecture, ce qui en
 * revient nourrit le calcul, et le plan revient. C'est ce qu'il a demandé —
 * « une fois qu'on a mis la photo et que tu as analysé ce qu'il faut, tu fais
 * apparaître un plan ».
 *
 * **Rien n'est enregistré.** Un plan d'arrosage se refait à chaque client,
 * comme un devis : il n'a pas de raison de vivre en base tant qu'il n'est pas
 * rattaché à un chantier. Le jour où il le sera, ce sera une décision, pas un
 * effet de bord.
 */

export type EtatPlan =
  | { etat: "vide" }
  | { etat: "refus"; raison: string }
  | {
      etat: "lu";
      zones: { type: string; nom: string | null; L: number | null; l: number | null; ml: number | null }[];
      reserves: string[];
      /**
       * LE PLAN DESSINÉ — le contour du jardin, la tranchée, les réseaux.
       *
       * *Sa demande du 21 août 2026 : « il manque la photo, le schéma avec les
       * réseaux, et l'implantation des arroseurs ».* Il ne peut exister que si
       * le croquis porte les trois éléments obligatoires ; sinon l'écran
       * n'arrive jamais ici, il refuse (`CLAUDE.md` §4 bis).
       */
      /** `null` quand le croquis ne permet pas de reconstituer l'agencement. */
      dessin: Dessin | null;
      plan: {
        debitDisponible: number;
        secteurs: { nom: string; debit: number; famille: string; part: string | null }[];
        voies: number;
        couleurs: string[];
        /**
         * `ref` est FACULTATIVE, et c'est le typage qui l'a appris : certaines
         * lignes du calcul n'en portent pas — un assemblage de nourrice, une
         * longueur de tuyau à mesurer. Les forcer à en avoir une aurait obligé
         * à en inventer, ce que ce dépôt interdit.
         */
        /**
         * **`reference` est la SEULE qu'on montre.**
         *
         * `ref` est une clé interne du catalogue (`te-taraude-25-34-25`) : elle
         * sert à identifier une ligne, elle ne se commande pas. `reference` ne
         * vaut que quand elle a été relevée sur un document du patron
         * (« Aqua Plus 2026, p. 11 ») — sinon `null`, et l'écran n'affiche
         * rien. Sa consigne du 22 août 2026 : *« tu ne dois surtout pas
         * inventer de prix ni de référence »*.
         */
        materiel: { ref?: string; reference?: string | null; nom: string; q: number; u: string }[];
        /**
         * **À PARTIR DE COMBIEN DE MÈTRES IL FAUT DU Ø32** — sa demande du
         * 22 août 2026 : *« passé un certain nombre de mètres linéaires, il
         * faut passer du PEHD Ø25 au Ø32 ; j'aimerais que mon outil fasse la
         * même chose »*.
         *
         * **Ce sont des SEUILS, pas un verdict**, et c'est délibéré. Le calcul
         * sait aussi trancher sur une longueur donnée — mais cet écran ne
         * demande pas la longueur de l'amenée, et le calcul en prendrait une
         * par défaut. Un « il vous faut du Ø32 » tiré d'une longueur que
         * personne n'a saisie serait un chiffre inventé (`CLAUDE.md` §4). Le
         * seuil, lui, ne dépend d'aucune saisie : il se compare au mètre ruban
         * sur place.
         */
        tuyau: {
          /** Mètres de Ø25 admissibles. **Zéro quand le débit l'interdit** — l'eau y filerait trop vite, quelle que soit la longueur. */
          seuil25: number;
          seuil32: number;
          /** Le débit du réseau le plus gourmand : c'est lui qui dimensionne. */
          debit: number;
          /** Au-delà, même le Ø32 est en surrégime : Ø40, ou un réseau de plus. */
          insuffisantMemeEn32: boolean;
          /**
           * Qui plafonne un réseau : la source (le seau) ou le tuyau (Ø25).
           *
           * **Il faut le dire quand c'est le tuyau**, sinon un artisan qui a
           * mesuré 3 m³/h voit ses réseaux coupés plus tôt qu'il ne s'y attend
           * et croit à un défaut de calcul. C'est son Ø25, et il le lira.
           */
          limitePar: "source" | "tuyau";
          /** Ce qu'un réseau en Ø25 peut porter, en m³/h. */
          plafond: number;
        };
        /**
         * Ce qui arrive au pied du DERNIER arroseur, en bar.
         *
         * **C'est lui qui décide de la portée**, pas le compteur : entre les
         * deux se perdent l'amenée, l'électrovanne, la ligne, ses raccords et
         * l'antenne Ø16. Le trajet du regard à la première tête n'est PAS
         * compté — il dépend de l'endroit où la nourrice est posée.
         */
        pressionAuxArroseurs: number;
      };
    };

export async function lireLeCroquis(_precedent: EtatPlan, formulaire: FormData): Promise<EtatPlan> {
  // La session est exigée avant tout : cet écran fait travailler l'IA, et
  // c'est un coût. Personne d'anonyme ne le déclenche — et l'entreprise sert
  // désormais à compter la cadence, plus bas.
  const ctx = await getCurrentCtx();

  const photo = formulaire.get("croquis");
  if (!(photo instanceof File) || photo.size === 0) {
    return { etat: "refus", raison: "Aucune photo n’a été jointe." };
  }
  /**
   * **Une liste blanche, et une cadence** — hors du brief du lot 2, mais de la
   * même famille (audit du 23 août 2026). Ce chemin-ci envoie la photo à un
   * fournisseur d'IA : il bornait la taille et rien d'autre.
   *
   * Ce que chacune arrête : la liste blanche empêche d'envoyer autre chose
   * qu'une image à un service qu'on paie ; la cadence borne **une facture**,
   * comme sur le diagnostic végétal — personne ne lit dix croquis à la minute.
   */
  if (!photoAcceptee(photo.type)) {
    return { etat: "refus", raison: MESSAGE_PHOTO_REFUSEE };
  }
  // **Une borne dure sur la taille.** Une photo de téléphone moderne pèse
  // 10 Mo ; l'envoyer entière au fournisseur coûte pour rien et fait parfois
  // tomber l'appel. Au-delà, on le dit plutôt que d'échouer sans raison.
  if (photo.size > 8 * 1024 * 1024) {
    return { etat: "refus", raison: "Cette photo dépasse 8 Mo. Reprenez-la en plus petit." };
  }

  const limite = await verifierLimite(`croquis:${ctx.entrepriseId}`, LIMITES.diagnosticVegetal);
  if (!limite.autorise) return { etat: "refus", raison: limite.message };

  const base64 = Buffer.from(await photo.arrayBuffer()).toString("base64");
  const lu = await lireCroquis(base64, photo.type || "image/jpeg");
  if (!lu.ok) return { etat: "refus", raison: lu.raison };

  // **Les zones sans cote ne partent PAS au calcul.** Une pelouse dont on
  // ignore les dimensions ne peut pas recevoir d'arroseurs : la compter pour
  // zéro donnerait un plan qui l'oublie en silence. Elle reste affichée, avec
  // sa réserve, et c'est au patron de la compléter.
  const mesurees = lu.croquis.zones.filter((z) =>
    z.type === "haie" || z.type === "massif" ? z.ml !== null : z.L !== null && z.l !== null
  );

  // **D'où vient le débit, et ce qu'on en sait** — `src/lib/arrosage/mesure-debit.ts`.
  // La pression NE DONNE PAS le débit : la règle refuse plutôt que d'inventer,
  // et toute estimation porte sa réserve jusque sous le plan.
  const piquage = String(formulaire.get("piquage") ?? "compteur");
  const nombre = (cle: string) => {
    const brut = formulaire.get(cle);
    if (brut === null || String(brut).trim() === "") return null;
    const n = Number(brut);
    return Number.isFinite(n) ? n : null;
  };
  const mesure = debitRetenu({
    piquage,
    secondes: nombre("secondes"),
    barStatique: nombre("barStatique"),
    barDynamique: nombre("barDynamique"),
  });
  if (!mesure.ok) return { etat: "refus", raison: mesure.raison };

  /* ══ LE TRAJET DU REGARD À LA PREMIÈRE TÊTE ═══════════════════════════════

     **Sa demande du 22 août 2026 : « oui fais-le lire les proportions ».**

     Je lui avais dit qu'aucune saisie ne donnait cette distance. Il a répondu
     qu'il n'avait pas à la donner — le croquis porte la nourrice et les zones,
     et les cotes donnent l'échelle. Il avait raison : c'est la lecture qui ne
     relevait pas les places.

     **Une lecture ratée n'arrête pas le plan, elle se DIT.** Le trajet vaut
     alors zéro et la réserve l'annonce : c'est ce que le calcul faisait déjà
     hier pour tout le monde, donc ce n'est pas une régression — mais le taire
     ferait croire que le trajet est compté. */
  //
  // **Les places se lisent EN FRACTION, et se convertissent ici** — une seule
  // fois, par un seul chemin (`geometrie-croquis.ts`). Le trajet et le dessin
  // partent donc des mêmes mètres : deux conversions finiraient par poser la
  // même pelouse à deux endroits (`CLAUDE.md` §3).
  const places = mesurees.map((z) => ({
    position: z.x !== null && z.y !== null ? { x: z.x, y: z.y } : null,
    largeurFraction: z.largeurFraction,
    hauteurFraction: z.hauteurFraction,
    L: z.L,
    l: z.l,
    // **La haie aussi donne l'échelle** (23 août 2026). Sur son croquis, elle
    // longe tout le haut du terrain et porte sa longueur : la lui refuser
    // jetait la moitié de ce que le dessin disait.
    ml: z.ml,
  }));
  const trajet = trajetLePlusLong(lu.croquis.nourrice, places);
  const terrain = poserSurLeTerrain(lu.croquis.nourrice, places);

  const plan = calculerPlan({
    regardVersZone: trajet.ok ? trajet.metres : 0,
    // Le calcul raisonne en seau et temps : on lui rend le débit retenu sous
    // cette forme, sans repasser par la saisie — une seule source du débit.
    seau: SEAU_LITRES,
    temps: (SEAU_LITRES / mesure.debit) * 3.6,
    pression: mesure.pression,
    compteur: piquage === "compteur" ? "oui" : "non",
    zones: mesurees.map((z, i) => ({
      type: z.type,
      nom: z.nom ?? undefined,
      L: z.L ?? undefined,
      l: z.l ?? undefined,
      ml: z.ml ?? undefined,
      // **Où la zone se trouve, EN MÈTRES** — sans quoi le plan se compte mais
      // ne se dessine pas. Ce n'est pas la fraction lue : c'est elle passée à
      // l'échelle du croquis. `undefined` traverse jusqu'au dessin, qui refuse
      // alors — c'est là que la règle vit, pas ici.
      x: terrain.ok ? terrain.terrain.zones[i].x : undefined,
      y: terrain.ok ? terrain.terrain.zones[i].y : undefined,
    })),
  });

  const reserves = [...lu.croquis.reserves];
  if (mesure.reserve) reserves.push(mesure.reserve);
  if (!trajet.ok) {
    reserves.push(
      `${trajet.raison} : le trajet du regard jusqu'au premier arroseur n'est pas compté`
    );
  }
  // **Une portée réduite est une ESTIMATION, et elle se dit.** Le débit des
  // buses est ramené à la pression du chantier par la loi de l'orifice — de la
  // physique. La portée, elle, suit un exposant tiré des tables des
  // constructeurs et non de ses catalogues à lui : la taire ferait passer pour
  // acquis un chiffre qui ne l'est pas (`CLAUDE.md` §4).
  // **CE QUI ARRIVE AU DERNIER ARROSEUR, ET CE QUI N'EST PAS COMPTÉ.**
  //
  // Le calcul retire maintenant l'amenée, l'électrovanne, la ligne, ses
  // raccords et l'antenne Ø16 — mais PAS le trajet du regard jusqu'à la
  // première tête, qui dépend de l'endroit où la nourrice est posée et
  // qu'aucune saisie ne donne. La pression annoncée est donc un plafond, et le
  // dire vaut mieux qu'un chiffre qu'on croit exact (`CLAUDE.md` §4 ter).
  if (plan.pressionTropBasse) {
    reserves.push(
      `Il ne resterait que ${plan.pressionAuxArroseurs.toFixed(1).replace(".", ",")} bar au dernier ` +
        "arroseur : trop peu pour qu'il se lève correctement. Raccourcissez les lignes, " +
        "ajoutez une vanne, ou piquez plus en amont."
    );
  } else if (plan.pressionRaffinee) {
    reserves.push(
      `${plan.pressionAuxArroseurs.toFixed(1).replace(".", ",")} bar au dernier arroseur ` +
        `(${plan.perteReseau.toFixed(2).replace(".", ",")} bar perdus dans le réseau, ` +
        `${plan.perteAmenee.toFixed(2).replace(".", ",")} dans l'amenée` +
        (trajet.ok ? `, trajet du regard ${trajet.metres.toFixed(0)} m lu sur le croquis` : "") +
        ")"
    );
  }
  if (plan.porteeEstimee) {
    reserves.push(
      `${mesure.pression.toString().replace(".", ",")} bar : les portées sont réduites par rapport au ` +
        "catalogue, donné à plus forte pression — estimation, à confirmer sur place"
    );
  }
  if (mesurees.length === 0) {
    return {
      etat: "refus",
      raison: "Aucune zone du croquis n’a de mesure lisible : le plan ne peut pas se calculer.",
    };
  }

  // ── SANS CROQUIS COMPLET, AUCUN PLAN — `CLAUDE.md` §4 bis ────────────────
  //
  // *« L'outil doit fonctionner avec un plan avec toutes les métrées,
  // l'emplacement du piquage et l'endroit définitif de la nourrice — sans ça il
  // ne doit rien proposer. »* Ce n'est pas le DESSIN qu'on retire, c'est le
  // plan entier : une liste de pièces sans tracé se commande quand même, et
  // c'est ce qu'il a refusé le 21 août (« il n'est pas valable avec cette
  // nouvelle règle »). On dit lequel des trois manque, et l'on s'arrête.
  // **LE DESSIN PEUT MANQUER SANS QUE LE PLAN TOMBE** — sa correction du
  // 23 août 2026. Ses trois éléments obligatoires sont les métrés, le piquage
  // et l'endroit de la nourrice ; l'AGENCEMENT n'en fait pas partie. Un croquis
  // qui les porte tous les trois donne un plan juste — le compte d'arroseurs,
  // les réseaux, les pièces — même si le dessin ne peut pas être reconstitué.
  //
  // Refuser tout dans ce cas, c'est ce qu'il a vu : *« il n'arrive pas à me
  // lire mon croquis... là, il y a tous les métrés »*. Il avait raison.
  if (!terrain.ok) {
    reserves.push(`${terrain.raison} : le plan est calculé, mais il n’est pas dessiné`);
    return { etat: "lu", zones: lu.croquis.zones, reserves, dessin: null, plan: leCalcul(plan) };
  }
  if (terrain.terrain.reserve) reserves.push(terrain.terrain.reserve);
  const dessine = dessinerPlan(
    plan.dessin as ZoneDessinee[],
    // **La nourrice EN MÈTRES**, sur le même repère que les zones. Lui passer
    // la fraction lue dessinerait un jardin d'un mètre de large : le défaut
    // aurait été muet, puisque tout resterait cohérent entre soi.
    terrain.terrain.nourrice,
    plan.couleurs as string[]
  );
  // Idem si le tracé lui-même n'aboutit pas : c'est le dessin qui manque, pas
  // le plan. Seule l'absence de nourrice retire tout (`CLAUDE.md` §4 bis), et
  // elle est refusée plus haut, à la lecture.
  if (!dessine.ok) {
    reserves.push(`${dessine.raison} Le plan est calculé, mais il n’est pas dessiné.`);
    return { etat: "lu", zones: lu.croquis.zones, reserves, dessin: null, plan: leCalcul(plan) };
  }
  reserves.push(...dessine.reserves);

  return {
    etat: "lu",
    zones: lu.croquis.zones,
    reserves,
    dessin: dessine.dessin,
    plan: leCalcul(plan),
  };
}

/**
 * Ce que le calcul rend à l'écran — la même forme, que le plan soit dessiné ou
 * non.
 *
 * **Sortie en fonction le 23 août 2026**, quand le dessin est devenu facultatif :
 * trois sorties le construisaient, et trois copies d'une même mise en forme
 * finissent toujours par diverger (`CLAUDE.md` §3). Ici, le risque était
 * concret : un croquis non dessinable aurait rendu un plan aux champs
 * légèrement différents de celui d'un croquis dessinable.
 */
function leCalcul(plan: ReturnType<typeof calculerPlan>) {
  return {
    debitDisponible: plan.debitDisponible,
    secteurs: plan.secteurs,
    voies: plan.voies,
    couleurs: plan.couleurs,
    materiel: plan.materiel,
    tuyau: {
      seuil25: plan.amenee.longueurMax25,
      seuil32: plan.amenee.longueurMax32,
      debit: plan.amenee.debit,
      insuffisantMemeEn32: plan.amenee.insuffisantMemeEn32,
      // **Le calcul repris n'est pas typé** (`allowJs`, `checkJs` coupé) : il
      // rend une chaîne. On la RESSERRE ici plutôt que d'élargir le type de
      // l'écran — c'est la frontière, et c'est là qu'un « tuyeau » mal
      // orthographié doit tomber, pas trois écrans plus loin.
      limitePar: (plan.limitePar === "tuyau" ? "tuyau" : "source") as "tuyau" | "source",
      plafond: plan.limiteDuTuyau,
    },
    pressionAuxArroseurs: plan.pressionAuxArroseurs,
  };
}
