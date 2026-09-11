"use server";

import { exigerEcran } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireCroquis } from "@/server/ai/services/lire-croquis";
// Module JavaScript repris tel quel de `appli/` — voir l'en-tête du fichier.
import { calculerPlan } from "@/lib/arrosage/calcul.js";
import { trajetLePlusLong, poserSurLeTerrain } from "@/lib/arrosage/geometrie-croquis";
import { debitRetenu, SEAU_LITRES } from "@/lib/arrosage/mesure-debit";
import { dessinerPlan, type Dessin, type ZoneDessinee } from "@/lib/arrosage/plan-dessine";
import { piecesDuPlan, type Piece } from "@/lib/arrosage/pieces";
import { etatDuCroquis, LIBELLES, type EtatDuCroquis } from "@/lib/arrosage/croquis-complet";
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
  | {
      etat: "refus";
      raison: string;
      /**
       * **Le refus d'un croquis incomplet dit ce qui a été lu et ce qui manque,
       * un par un, et le geste qui débloque** — `CLAUDE.md` §4 bis, et sa
       * consigne du 11 septembre 2026 sur l'écran. Absent pour les autres
       * refus (photo trop lourde, cadence, lecture impossible).
       */
      croquis?: EtatDuCroquis;
      geste?: string;
    }
  | {
      etat: "lu";
      zones: { type: string; nom: string | null; L: number | null; l: number | null; ml: number | null }[];
      /**
       * Les réserves qui ne bougent pas avec les paramètres : ce que la lecture
       * n'a pas su lire, ce que la mesure suppose, le trajet du regard. Celles
       * du CALCUL (pression, portée) vivent dans `plan.reserves` et se refont à
       * chaque modification — sinon elles disparaissaient au premier message
       * de la discussion, et un plan qui ne se lève pas devenait muet.
       */
      reserves: string[];
      /**
       * LE PLAN DESSINÉ — le contour du jardin, la tranchée, les réseaux.
       *
       * *Sa demande du 21 août 2026 : « il manque la photo, le schéma avec les
       * réseaux, et l'implantation des arroseurs ».* `null` quand le croquis
       * ne permet pas de reconstituer l'AGENCEMENT — le plan, lui, existe :
       * ses trois éléments obligatoires sont les métrés, le piquage et la
       * nourrice, pas le dessin (sa correction du 23 août).
       */
      dessin: Dessin | null;
      /** De quoi refaire le plan quand il demande une modification. */
      parametres: ParametresPlan;
      plan: LePlan;
    };

export type LePlan = {
  debitDisponible: number;
  secteurs: { nom: string; debit: number; famille: string; part: string | null }[];
  voies: number;
  couleurs: string[];
  /**
   * **La liste qu'il emporte au comptoir — lue sur le tracé quand il existe.**
   *
   * Trois zones, les tés et coudes de chaque réseau tels que le plan les
   * dessine, le tuyau Ø25 mesuré, le té égal du compteur : `pieces.ts`, où
   * l'on explique pourquoi le calcul seul ne suffisait pas. `reference` ne
   * vaut que quand elle a été RELEVÉE sur un document du patron — sinon
   * `null`, et l'écran n'affiche rien (*« tu ne dois surtout pas inventer de
   * prix ni de référence »*, 22 août 2026).
   */
  pieces: Piece[];
  /**
   * **À PARTIR DE COMBIEN DE MÈTRES IL FAUT DU Ø32** — sa demande du
   * 22 août 2026. **Ce sont des SEUILS, pas un verdict** : cet écran ne
   * demande pas la longueur de l'amenée, et le calcul en prendrait une par
   * défaut. Un « il vous faut du Ø32 » tiré d'une longueur que personne n'a
   * saisie serait un chiffre inventé (`CLAUDE.md` §4). Le seuil, lui, ne
   * dépend d'aucune saisie : il se compare au mètre ruban sur place.
   */
  tuyau: {
    /** Mètres de Ø25 admissibles. **Zéro quand le débit l'interdit.** */
    seuil25: number;
    seuil32: number;
    /** Le débit du réseau le plus gourmand : c'est lui qui dimensionne. */
    debit: number;
    /** Au-delà, même le Ø32 est en surrégime : Ø40, ou un réseau de plus. */
    insuffisantMemeEn32: boolean;
    /** Qui plafonne un réseau : la source (le seau) ou le tuyau (Ø25). */
    limitePar: "source" | "tuyau";
    /** Ce qu'un réseau en Ø25 peut porter, en m³/h. */
    plafond: number;
  };
  /** Ce qui arrive au pied du DERNIER arroseur, en bar. */
  pressionAuxArroseurs: number;
  /** Ce que le calcul dit de lui-même : la pression, la portée, l'amenée supposée. */
  reserves: string[];
};

export async function lireLeCroquis(_precedent: EtatPlan, formulaire: FormData): Promise<EtatPlan> {
  // La session est exigée avant tout : cet écran fait travailler l'IA, et
  // c'est un coût. Personne d'anonyme ne le déclenche — et l'entreprise sert
  // désormais à compter la cadence, plus bas.
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/paysage", "lire un croquis d'arrosage");

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
  const piquage = String(formulaire.get("piquage") ?? "compteur");

  // ── SANS CROQUIS COMPLET, AUCUN PLAN — `CLAUDE.md` §4 bis ────────────────
  //
  // *« L'outil doit fonctionner avec un plan avec toutes les métrées,
  // l'emplacement du piquage et l'endroit définitif de la nourrice — sans ça il
  // ne doit rien proposer. »* Ce n'est pas le DESSIN qu'on retire, c'est le
  // plan entier : une liste de pièces sans tracé se commande quand même, et
  // c'est ce qu'il a refusé le 21 août (« il n'est pas valable avec cette
  // nouvelle règle »).
  //
  // **Jusqu'au 11 septembre 2026, ce refus n'existait pas** : le commentaire
  // le promettait « à la lecture », et la lecture ne faisait qu'une réserve.
  // La règle vit désormais dans `croquis-complet.ts`, et l'écran du refus dit
  // ce qui a été lu, ce qui manque, et le geste qui débloque.
  const croquis = etatDuCroquis({
    zonesMesurees: mesurees.length,
    nourrice: lu.croquis.nourrice !== null,
    piquage,
  });
  if (!croquis.complet) {
    const premier = LIBELLES[croquis.manque[0]];
    return { etat: "refus", raison: premier.titre, geste: premier.geste, croquis };
  }

  // **D'où vient le débit, et ce qu'on en sait** — `src/lib/arrosage/mesure-debit.ts`.
  // La pression NE DONNE PAS le débit : la règle refuse plutôt que d'inventer,
  // et toute estimation porte sa réserve jusque sous le plan.
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

  // **Ce qui ne bouge plus une fois le croquis lu** : la lecture, la mesure, le
  // trajet. Les réserves du calcul, elles, vivent avec le plan (`lePlan`).
  const reserves = [...lu.croquis.reserves];
  if (mesure.reserve) reserves.push(mesure.reserve);
  if (!trajet.ok) {
    reserves.push(`${trajet.raison} : le trajet du regard jusqu'au premier arroseur n'est pas compté`);
  }
  if (terrain.ok && terrain.terrain.reserve) reserves.push(terrain.terrain.reserve);

  // **LE DESSIN PEUT MANQUER SANS QUE LE PLAN TOMBE** — sa correction du
  // 23 août 2026. Ses trois éléments obligatoires sont les métrés, le piquage
  // et l'endroit de la nourrice ; l'AGENCEMENT n'en fait pas partie. Un croquis
  // qui les porte tous les trois donne un plan juste — le compte d'arroseurs,
  // les réseaux, les pièces — même si le dessin ne peut pas être reconstitué.
  //
  // Refuser tout dans ce cas, c'est ce qu'il a vu : *« il n'arrive pas à me
  // lire mon croquis... là, il y a tous les métrés »*. Il avait raison.
  const calcule = calculerEtDessiner(parametres, terrain.ok ? null : `${terrain.raison} : le plan est calculé, mais il n’est pas dessiné`);
  return { etat: "lu", zones: lu.croquis.zones, reserves, ...calcule };
}

/**
 * Le calcul, son dessin, et ce que le calcul dit de lui-même — la MÊME
 * fonction pour la lecture du croquis et pour la discussion.
 *
 * **Sortie en fonction le 11 septembre 2026**, parce que la discussion ne
 * gardait que les réserves du dessin : « il ne resterait que 1,8 bar au
 * dernier arroseur » disparaissait au premier message, et un plan qui ne se
 * lève pas devenait muet (`CLAUDE.md` §4 ter). Deux chemins, une seule règle.
 */
function calculerEtDessiner(parametres: ParametresPlan, sansDessin: string | null) {
  const plan = calculerPlan(parametres as never);
  let dessin: Dessin | null = null;
  const reservesDuDessin: string[] = [];
  if (sansDessin) {
    reservesDuDessin.push(sansDessin);
  } else {
    const dessine = dessinerPlan(
      plan.dessin as ZoneDessinee[],
      // **La nourrice EN MÈTRES**, sur le même repère que les zones. Lui passer
      // la fraction lue dessinerait un jardin d'un mètre de large : le défaut
      // aurait été muet, puisque tout resterait cohérent entre soi.
      parametres.nourrice,
      plan.couleurs as string[]
    );
    // Si le tracé lui-même n'aboutit pas, c'est le dessin qui manque, pas le
    // plan. Seule l'absence de nourrice retire tout (`croquis-complet.ts`).
    if (dessine.ok) {
      dessin = dessine.dessin;
      reservesDuDessin.push(...dessine.reserves);
    } else {
      reservesDuDessin.push(`${dessine.raison} Le plan est calculé, mais il n’est pas dessiné.`);
    }
  }
  return { dessin, parametres, plan: lePlan(plan, dessin, parametres, reservesDuDessin) };
}

/**
 * Ce que le calcul rend à l'écran — la même forme, que le plan soit dessiné ou
 * non, et pour les deux chemins qui y mènent.
 */
function lePlan(
  plan: ReturnType<typeof calculerPlan>,
  dessin: Dessin | null,
  parametres: ParametresPlan,
  reservesDuDessin: string[]
): LePlan {
  const reserves: string[] = [];
  const bar = (x: number, d = 1) => x.toFixed(d).replace(".", ",");
  // **CE QUI ARRIVE AU DERNIER ARROSEUR, ET CE QUI N'EST PAS COMPTÉ.** Le
  // calcul retire l'amenée, l'électrovanne, la ligne, ses raccords et l'antenne
  // Ø16 — mais PAS le trajet du regard jusqu'à la première tête quand le
  // croquis ne l'a pas donné. La pression annoncée est alors un plafond.
  if (plan.pressionTropBasse) {
    reserves.push(
      `Il ne resterait que ${bar(plan.pressionAuxArroseurs)} bar au dernier arroseur : trop peu pour ` +
        "qu'il se lève correctement. Raccourcissez les lignes, ajoutez une vanne, ou piquez plus en amont."
    );
  } else if (plan.pressionRaffinee) {
    reserves.push(
      `${bar(plan.pressionAuxArroseurs)} bar au dernier arroseur — ${bar(plan.perteReseau, 2)} bar perdus ` +
        `dans le réseau, ${bar(plan.perteAmenee, 2)} dans l’amenée` +
        (parametres.regardVersZone > 0 ? `, trajet du regard ${parametres.regardVersZone.toFixed(0)} m lu sur le croquis` : "") +
        "."
    );
  }
  // **L'AMENÉE EST COMPTÉE POUR 30 M, ET CELA SE DIT — 11 septembre 2026.** Le
  // calcul prend cette longueur par défaut faute de saisie ; elle entrait dans
  // la pression au dernier arroseur sans qu'un mot ne le dise. Un chiffre
  // muet se croit ; un chiffre annoncé se mesure (`CLAUDE.md` §4 ter).
  if (plan.pressionRaffinee || plan.pressionTropBasse) {
    reserves.push(`L’amenée est comptée pour ${plan.amenee.longueur} m : mesurez-la du compteur à la nourrice.`);
  }
  // **Une portée réduite est une ESTIMATION, et elle se dit.** Le débit des
  // buses est ramené à la pression du chantier par la loi de l'orifice — de la
  // physique. La portée, elle, suit un exposant tiré des tables des
  // constructeurs et non de ses catalogues à lui (`CLAUDE.md` §4).
  if (plan.porteeEstimee) {
    reserves.push(
      `${String(plan.pression).replace(".", ",")} bar : les portées sont réduites par rapport au ` +
        "catalogue, donné à plus forte pression — estimation, à confirmer sur place."
    );
  }
  reserves.push(...reservesDuDessin);

  return {
    debitDisponible: plan.debitDisponible,
    secteurs: plan.secteurs,
    voies: plan.voies,
    couleurs: plan.couleurs,
    pieces: piecesDuPlan(plan.materiel, dessin, {
      compteur: parametres.compteur === "oui",
      seuil25: plan.amenee.longueurMax25,
    }),
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
    reserves,
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
      plan: LePlan;
    };

export async function discuterDuPlan(
  parametres: ParametresPlan,
  historique: Tour[],
  demande: string
): Promise<EtatDiscussion> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/paysage", "discuter du plan d'arrosage");

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
  const refait = calculerEtDessiner(suivants, null);

  return {
    etat: "repondu",
    texte: lu.reponse.texte,
    chiffres: lu.reponse.chiffres,
    modifie: lu.reponse.consigne !== null,
    ...refait,
  };
}
