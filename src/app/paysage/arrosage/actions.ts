"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { lireCroquis } from "@/server/ai/services/lire-croquis";
// Module JavaScript repris tel quel de `appli/` — voir l'en-tête du fichier.
import { calculerPlan } from "@/lib/arrosage/calcul.js";
import { trajetLePlusLong, poserSurLeTerrain } from "@/lib/arrosage/geometrie-croquis";
import { debitRetenu, SEAU_LITRES } from "@/lib/arrosage/mesure-debit";
import { dessinerPlan, type Dessin, type ZoneDessinee } from "@/lib/arrosage/plan-dessine";
import { appliquer, cotesDuPlanTiennentDebout, type ParametresPlan } from "@/lib/arrosage/consignes";
import { discuterLePlan, etatDuPlanEnClair, type Tour } from "@/server/ai/services/discuter-plan";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
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
      /** De quoi refaire le plan quand il demande une modification. */
      parametres: ParametresPlan;
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

  const limite = await verifierLimite(`croquis:${ctx.entrepriseId}`, LIMITES.diagnosticVegetal);
  if (!limite.autorise) return { etat: "refus", raison: limite.message };

  /**
   * **LE CROQUIS EST NETTOYÉ AVANT DE PARTIR CHEZ LE FOURNISSEUR** — constat
   * M3, resserré le 24 août 2026.
   *
   * Ce chemin ne range rien, et c'est ce qui l'avait fait oublier : il
   * **envoie**. Un croquis photographié dans le jardin d'un client porte les
   * coordonnées GPS de ce jardin, et elles partaient telles quelles chez un
   * tiers — ce qui est pire que de les ranger chez nous.
   *
   * `preparerPhotoEntrante` refuse quand elle ne sait pas nettoyer : l'original
   * ne part donc jamais. C'est la même porte que les photos de chantier et les
   * tickets, une seule implémentation (`CLAUDE.md` §3).
   */
  const prete = await preparerPhotoEntrante(formulaire.get("croquis"), "croquis d'arrosage", {
    // **La borne à 8 Mo reste**, plus serrée que le téléversement ordinaire :
    // elle ne protège pas la mémoire, elle borne une facture de vision et évite
    // un appel qui tombe. Passer par la porte commune ne doit pas la perdre.
    octets: 8 * 1024 * 1024,
    message: "Cette photo dépasse 8 Mo. Reprenez-la en plus petit.",
  });
  if (!prete.ok) return { etat: "refus", raison: prete.raison };

  const lu = await lireCroquis(prete.photo.octets.toString("base64"), prete.photo.mimeType);
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

  // **LES PARAMÈTRES SONT UNE VALEUR, ET ILS REPARTENT VERS L'ÉCRAN.**
  //
  // *Sa demande du 21 août : une interface pour discuter du plan.* La
  // discussion refait le plan en posant un paramètre — il lui faut donc ceux-ci,
  // au message suivant. **Rien n'est enregistré pour autant** : ils voyagent
  // avec l'écran, comme le plan lui-même. Un plan d'arrosage se refait à chaque
  // client ; le jour où il vivra en base, ce sera une décision, pas un effet de
  // bord.
  const parametres: ParametresPlan = {
    regardVersZone: trajet.ok ? trajet.metres : 0,
    // Le calcul raisonne en seau et temps : on lui rend le débit retenu sous
    // cette forme, sans repasser par la saisie — une seule source du débit.
    seau: SEAU_LITRES,
    temps: (SEAU_LITRES / mesure.debit) * 3.6,
    pression: mesure.pression,
    compteur: piquage === "compteur" ? "oui" : "non",
    zones: mesurees.map((z, i) => ({
      // **Un identifiant STABLE**, parce que la discussion désigne les zones par
      // lui : « passe la zone 2 en tuyères ». Le laisser au calcul le ferait
      // dépendre de l'ordre de lecture, et un message d'hier viserait demain
      // une autre pelouse.
      id: i + 1,
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
    nourrice: terrain.ok ? terrain.terrain.nourrice : null,
  };
  const plan = calculerPlan(parametres as never);

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
    return { etat: "lu", zones: lu.croquis.zones, reserves, dessin: null, parametres, plan: leCalcul(plan) };
  }
  if (terrain.terrain.reserve) reserves.push(terrain.terrain.reserve);
  const dessine = dessinerPlan(
    plan.dessin as ZoneDessinee[],
    // **La nourrice EN MÈTRES**, sur le même repère que les zones. Lui passer
    // la fraction lue dessinerait un jardin d'un mètre de large : le défaut
    // aurait été muet, puisque tout resterait cohérent entre soi.
    parametres.nourrice,
    plan.couleurs as string[]
  );
  // Idem si le tracé lui-même n'aboutit pas : c'est le dessin qui manque, pas
  // le plan. Seule l'absence de nourrice retire tout (`CLAUDE.md` §4 bis), et
  // elle est refusée plus haut, à la lecture.
  if (!dessine.ok) {
    reserves.push(`${dessine.raison} Le plan est calculé, mais il n’est pas dessiné.`);
    return { etat: "lu", zones: lu.croquis.zones, reserves, dessin: null, parametres, plan: leCalcul(plan) };
  }
  reserves.push(...dessine.reserves);

  return {
    etat: "lu",
    zones: lu.croquis.zones,
    reserves,
    dessin: dessine.dessin,
    parametres,
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

/* ═══════════════════════════════════════════════════════════════════════════
   DISCUTER LE PLAN — sa demande du 21 août 2026.

   *« J'ai besoin que si l'utilisateur a besoin de te demander de faire une
   modification, qu'il puisse le faire. »*

   **Atlas ne dessine pas : il pose un paramètre, et le calcul refait tout.**
   C'est la phrase de la maquette qu'il a validée, et c'est ce que cette action
   exécute — `discuterLePlan` lit sa demande et rend au plus UNE consigne prise
   dans une liste fermée (`consignes.ts`) ; le plan qui revient sort du même
   calcul que celui du croquis, tracé compris.

   **LA DISCUSSION NE CRÉE JAMAIS UN PLAN**, sa borne du 21 août : elle part
   toujours de paramètres existants, donc d'un croquis déjà complet. Sans plan à
   l'écran, il n'y a rien à discuter — et l'écran ne montre pas la saisie.
   ═══════════════════════════════════════════════════════════════════════════ */

export type EtatDiscussion =
  | { etat: "vide" }
  | { etat: "refus"; raison: string }
  | {
      etat: "repondu";
      texte: string;
      chiffres: string | null;
      /** Vrai quand le plan a été refait — l'écran remplace alors ce qu'il montre. */
      modifie: boolean;
      parametres: ParametresPlan;
      dessin: Dessin | null;
      plan: ReturnType<typeof leCalcul>;
      reserves: string[];
    };

export async function discuterDuPlan(
  parametres: ParametresPlan,
  historique: Tour[],
  demande: string
): Promise<EtatDiscussion> {
  const ctx = await getCurrentCtx();

  // **La cadence manquait ici, et elle est posée partout ailleurs** — audit
  // final, 29 août 2026. C'était la seule porte d'IA du produit sans compteur :
  // `lireLeCroquis`, juste au-dessus, en a une depuis le premier jour. Les clés
  // sont celles du patron, donc c'est sa facture.
  const limite = await verifierLimite(`plan:${ctx.entrepriseId}`, LIMITES.diagnosticVegetal);
  if (!limite.autorise) return { etat: "refus", raison: limite.message };

  const propos = demande.trim();
  if (propos === "") return { etat: "refus", raison: "Écrivez ce que vous voulez changer." };
  if (propos.length > 2000) {
    return { etat: "refus", raison: "Votre message est trop long — dites-le en quelques phrases." };
  }

  // **Les cotes viennent du NAVIGATEUR, et elles passaient au calcul sans être
  // regardées** — avec un `as never` qui retirait jusqu'au typage. Une zone de
  // cent mille mètres de côté faisait empiler des centaines de millions de
  // points sur le fil de l'événement, et le processus emportait les requêtes de
  // toutes les entreprises. La borne vit dans une fonction pure, aux mêmes
  // valeurs que la lecture de croquis (`consignes.ts`).
  const cotes = cotesDuPlanTiennentDebout(parametres);
  if (!cotes.ok) return { etat: "refus", raison: cotes.raison };

  // **On recalcule le plan AVANT de lui parler.** Le modèle a besoin des vrais
  // chiffres — débit disponible, plafond d'une voie, débit de chaque réseau —
  // sinon il répond quand même, avec des nombres plausibles (`CLAUDE.md` §4).
  const avant = calculerPlan(parametres as never);
  const lu = await discuterLePlan(
    propos,
    parametres,
    etatDuPlanEnClair(parametres, avant as never),
    historique
  );
  if (!lu.ok) return { etat: "refus", raison: lu.raison };

  // Sans consigne, il n'a fait qu'expliquer : le plan à l'écran ne bouge pas.
  const suivants = lu.reponse.consigne ? appliquer(parametres, lu.reponse.consigne) : parametres;
  const plan = lu.reponse.consigne ? calculerPlan(suivants as never) : avant;

  const reserves: string[] = [];
  const dessine = dessinerPlan(
    plan.dessin as ZoneDessinee[],
    suivants.nourrice,
    plan.couleurs as string[]
  );
  if (dessine.ok) reserves.push(...dessine.reserves);
  else reserves.push(`${dessine.raison} Le plan est calculé, mais il n’est pas dessiné.`);

  return {
    etat: "repondu",
    texte: lu.reponse.texte,
    chiffres: lu.reponse.chiffres,
    modifie: lu.reponse.consigne !== null,
    parametres: suivants,
    dessin: dessine.ok ? dessine.dessin : null,
    plan: leCalcul(plan),
    reserves,
  };
}

