"use server";

import { exigerEcran, exigerFonction } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireCroquis, type CroquisLu } from "@/server/ai/services/lire-croquis";
// Module JavaScript repris tel quel de `appli/` — voir l'en-tête du fichier.
import { calculerPlan } from "@/lib/arrosage/calcul.js";
import { trajetLePlusLong, poserSurLeTerrain, longueurDeLAmenee } from "@/lib/arrosage/geometrie-croquis";
import { debitRetenu, SEAU_LITRES } from "@/lib/arrosage/mesure-debit";
import type { Dessin } from "@/lib/arrosage/plan-dessine";
import { calculerEtDessiner, type LePlan } from "@/lib/arrosage/le-plan";
import { etatDuCroquis, LIBELLES, zoneMesuree, type EtatDuCroquis } from "@/lib/arrosage/croquis-complet";
import { croquisDuDessin, lireLeDessin } from "@/lib/arrosage/dessin-du-plan";
import { planLuDuCroquis, type PlanLu } from "@/lib/arrosage/plan-lu";
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
  /**
   * **LA PHOTO DONNE UN PLAN À VÉRIFIER, PAS UN PLAN** — sa planche du
   * 21 octobre 2026. Ce que l'IA a lu s'ouvre dans « Dessiner le plan » ; il
   * corrige, puis « Faire le plan » repart par le chemin du dessin.
   */
  | { etat: "a-verifier"; plan: PlanLu }
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
      /**
       * Pourquoi le dessin manque quand il manque, ou `null`. L'écran refait le
       * calcul en place (sonde, couronne, ligne ou boucle) : il lui faut la même
       * raison pour rendre le même plan.
       */
      sansDessin: string | null;
      /** De quoi refaire le plan quand il demande une modification. */
      parametres: ParametresPlan;
      plan: LePlan;
    };

// Le plan lui-même, son dessin et ses pièces se composent dans `le-plan.ts`,
// que l'écran rejoue sans serveur pour ses gestes : une seule règle.

/** Au-delà, ce n'est plus un dessin de jardin : c'est un envoi qui a dérapé. */
const DESSIN_MAX_CARACTERES = 100_000;

export async function lireLeCroquis(_precedent: EtatPlan, formulaire: FormData): Promise<EtatPlan> {
  // La session est exigée avant tout : cet écran fait travailler l'IA, et
  // c'est un coût. Personne d'anonyme ne le déclenche — et l'entreprise sert
  // désormais à compter la cadence, plus bas.
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/paysage", "lire un croquis d'arrosage");
  await exigerFonction(ctx, "arrosage", "lire un croquis d'arrosage");

  // **LE PLAN DESSINÉ AU DOIGT** — sa planche B, choisie le 18 octobre 2026.
  // Il ne passe pas par l'IA : tout y est déjà en mètres. Il rejoint la photo
  // juste après la lecture, et tout le reste est le même chemin.
  const dessin = formulaire.get("dessin");
  if (typeof dessin === "string" && dessin !== "") {
    if (dessin.length > DESSIN_MAX_CARACTERES) return { etat: "refus", raison: "Ce dessin est trop lourd. Reprenez-le." };
    let brut: unknown;
    try {
      brut = JSON.parse(dessin);
    } catch {
      // Un envoi illisible se dit, comme un dessin faux : jamais un plan supposé.
      return { etat: "refus", raison: "Ce dessin n’est pas lisible. Reprenez-le." };
    }
    const relu = lireLeDessin(brut);
    if (!relu.ok) return { etat: "refus", raison: relu.raison };
    const branchement = String(formulaire.get("piquage") ?? "compteur");
    return planDuCroquis(croquisDuDessin(relu.dessin, branchement === "compteur" ? "compteur" : "robinet"), formulaire);
  }

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
  return { etat: "a-verifier", plan: planLuDuCroquis(lu.croquis) };
}

/**
 * Du croquis lu au plan. **Le dessin seul y arrive** depuis le 22 octobre
 * 2026 : la photo passe d'abord par le plan lu à vérifier, qui repart en
 * dessin. Un seul chemin, donc une seule façon de poser une pelouse
 * (`CLAUDE.md` §3).
 */
function planDuCroquis(lu: CroquisLu, formulaire: FormData): EtatPlan {
  // **Les zones sans cote ne partent PAS au calcul.** Une pelouse dont on
  // ignore les dimensions ne peut pas recevoir d'arroseurs : la compter pour
  // zéro donnerait un plan qui l'oublie en silence. Elle reste affichée, avec
  // sa réserve, et c'est au patron de la compléter.
  //
  // **Le massif est une surface**, comme le calcul le mesure : la règle vit
  // dans `zoneMesuree`, une seule pour la photo, le dessin et ce filtre.
  const mesurees = lu.zones.filter(zoneMesuree);
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
    nourrice: lu.nourrice !== null,
    piquage: lu.piquage !== null,
    branchement: piquage,
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
  const trajet = trajetLePlusLong(lu.nourrice, places);
  // Le piquage se place comme la nourrice : au nez de robinet, les réseaux partent de lui.
  const terrain = poserSurLeTerrain(lu.nourrice, places, lu.piquage);
  // **L'AMENÉE SE CALCULE, NI LUE NI SUPPOSÉE** — sa règle du 11 septembre
  // 2026. Du piquage à la nourrice, à l'échelle des cotes. Quand l'échelle ne
  // se déduit pas, elle n'est pas comptée — et l'écran le dit, comme pour le
  // trajet du regard : un zéro annoncé vaut mieux que 30 m tus.
  const amenee = longueurDeLAmenee(lu.piquage, lu.nourrice, places);

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
    amenee: amenee.ok ? amenee.metres : 0,
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
      // Le nombre de lignes d'une haie, quand le dessin le donne.
      lignes: z.lignes,
      ecartLignes: z.ecartLignes,
      ecartBord: z.ecartBord,
      sensLignes: z.sensLignes,
      // **Où la zone se trouve, EN MÈTRES** — sans quoi le plan se compte mais
      // ne se dessine pas. Ce n'est pas la fraction lue : c'est elle passée à
      // l'échelle du croquis. `undefined` traverse jusqu'au dessin, qui refuse
      // alors — c'est là que la règle vit, pas ici.
      x: terrain.ok ? terrain.terrain.zones[i].x : undefined,
      y: terrain.ok ? terrain.terrain.zones[i].y : undefined,
    })),
    nourrice: terrain.ok ? terrain.terrain.nourrice : null,
    piquage: terrain.ok ? terrain.terrain.piquage : null,
  };

  // **Ce qui ne bouge plus une fois le croquis lu** : la lecture, la mesure, le
  // trajet. Les réserves du calcul, elles, vivent avec le plan (`lePlan`).
  const reserves = [...lu.reserves];
  if (mesure.reserve) reserves.push(mesure.reserve);
  if (!trajet.ok) {
    reserves.push(`${trajet.raison} : le trajet du regard jusqu'au premier arroseur n'est pas compté`);
  }
  if (!amenee.ok) {
    reserves.push(`${amenee.raison} : l'amenée du piquage à la nourrice n'est pas comptée`);
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
  const sansDessin = terrain.ok ? null : `${terrain.raison} : le plan est calculé, mais il n’est pas dessiné`;
  const calcule = calculerEtDessiner(parametres, sansDessin);
  return { etat: "lu", zones: lu.zones, reserves, sansDessin, ...calcule };
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
  await exigerFonction(ctx, "arrosage", "discuter du plan d'arrosage");

  // **La cadence manquait ici, et elle est posée partout ailleurs** — audit
  // final, 29 août 2026. C'était la seule porte d'IA du produit sans compteur :
  // `lireLeCroquis`, juste au-dessus, en a une depuis le premier jour. Les clés
  // sont celles du patron, donc c'est sa facture.
  const limite = await verifierLimite(`plan:${ctx.entrepriseId}`, LIMITES.diagnosticVegetal);
  if (!limite.autorise) return { etat: "refus", raison: limite.message };

  const propos = demande.trim();
  if (propos === "") return { etat: "refus", raison: "Écrivez ce que vous voulez changer." };
  if (propos.length > 2000) {
    return { etat: "refus", raison: "Votre message est trop long. Dites-le en quelques phrases." };
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
