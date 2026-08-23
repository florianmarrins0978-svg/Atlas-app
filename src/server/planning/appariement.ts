import { chercherAdresses } from "@/server/adresses/base-adresse-nationale";
import { trajetVoiture } from "@/server/itineraire/geoplateforme";
import {
  chantiersASituer,
  chantiersDemiJourneeAPlanifier,
  enregistrerCoordonneesChantier,
  lireChantierSitue,
  type ChantierSitue,
} from "@/server/repositories/chantiers";
import type { Ctx } from "@/server/repositories/context";
import {
  classer,
  communeApprochee,
  phraseDistance,
  preselectionner,
  SEUIL_OISEAU_KM,
  type CandidatClasse,
  type CandidatDemiJournee,
} from "@/lib/appariement-demi-journees";

/**
 * Quel chantier caler sur la demi-journée restée libre — la chaîne complète.
 *
 * Ce module **assemble** ; il ne décide de rien. Les règles sont dans
 * `src/lib/appariement-demi-journees.ts`, éprouvables sans base ni réseau ; le
 * trajet est dans `src/server/itineraire/geoplateforme.ts` ; les lectures sont
 * dans le dépôt de chantiers. Ici, seulement l'ordre des opérations — et cet
 * ordre est ce qui protège le service public de l'IGN d'une avalanche d'appels.
 *
 * **Rien ne se planifie ici.** L'écran propose, le patron décide : c'est la
 * règle du dépôt (`CLAUDE.md` §4) et elle vaut ici comme pour l'envoi d'un
 * devis.
 */

/**
 * Combien d'adresses on accepte de situer à l'ouverture d'un écran.
 *
 * **Le rattrapage se fait au fil de l'eau, pas en une fois.** Une entreprise
 * peut avoir trois cents chantiers sans coordonnées le jour de la migration ;
 * les situer tous d'un coup ferait trois cents appels et une page qui met une
 * minute. Huit par passe, et le stock se résorbe en quelques ouvertures — sans
 * que le patron ait rien à lancer.
 */
const MAX_SITUATION_PAR_PASSE = 8;

/** Par paquets, pour ne pas ouvrir huit connexions d'un coup vers un service public. */
const PAQUET = 4;

export type Proposition = {
  chantierId: string;
  nom: string;
  /** La commune, quand on a su la lire — sinon rien plutôt qu'une adresse entière. */
  ou: string | null;
  /** « à 12 km, 20 min de route » — ou le vol d'oiseau, DIT comme tel. */
  phrase: string;
  /** Vrai quand la phrase repose sur la route. Sert aux contrôles, pas à l'écran. */
  parLaRoute: boolean;
};

export type Appariement = {
  /** Le chantier déjà posé, celui d'où l'on part. */
  depart: { chantierId: string; nom: string; ou: string | null } | null;
  /**
   * Renseigné quand le chantier de départ n'a pas d'adresse situable : sans
   * point de départ, aucune distance n'existe. L'écran doit le DIRE et mener
   * là où l'adresse se corrige — se taire passerait pour une panne.
   */
  departNonSitue: { chantierId: string; nom: string; adresse: string | null } | null;
  propositions: Proposition[];
  /** Ce qu'on a écarté faute d'être assez proche, avec de quoi le dire. */
  ecartes: { combien: number; plusProcheKm: number | null };
  /** Ceux dont l'adresse n'a pas pu être située — nommés, jamais tus. */
  sansAdresse: { chantierId: string; nom: string }[];
  /** Le seuil appliqué, pour que l'écran écrive le bon chiffre. */
  seuilKm: number;
};

/**
 * Les chantiers proches de celui-là, pour l'autre demi-journée.
 *
 * @param sansSeuil « Voir quand même » : le patron passe outre les quarante
 *   kilomètres. Un seuil est un garde-fou, pas un interdit — c'est sa journée.
 */
export async function propositionsPourDemiJournee(
  ctx: Ctx,
  chantierEnPlaceId: string,
  sansSeuil = false
): Promise<Appariement> {
  // Le rattrapage d'abord : sans coordonnées, tout le reste rend une liste vide
  // et l'écran accuserait le voisinage alors que c'est la donnée qui manque.
  await situerQuelquesChantiers(ctx);

  const depart = await lireChantierSitue(ctx, chantierEnPlaceId);
  const seuilKm = sansSeuil ? Number.POSITIVE_INFINITY : SEUIL_OISEAU_KM;
  const vide: Appariement = {
    depart: null,
    departNonSitue: null,
    propositions: [],
    ecartes: { combien: 0, plusProcheKm: null },
    sansAdresse: [],
    seuilKm,
  };

  if (!depart) return vide;
  if (depart.latitude === null || depart.longitude === null) {
    return {
      ...vide,
      departNonSitue: {
        chantierId: depart.id,
        nom: depart.nom,
        adresse: depart.adresseChantier,
      },
    };
  }

  const position = { latitude: depart.latitude, longitude: depart.longitude };
  const candidats = (await chantiersDemiJourneeAPlanifier(ctx))
    .filter((c) => c.id !== chantierEnPlaceId)
    .map(enCandidat);

  const tri = preselectionner(position, candidats, seuilKm);

  // **Les appels partent ici, et seulement ici** — trois au plus, et en
  // parallèle : le service répond en 186 ms, trois d'affilée feraient une
  // demi-seconde d'attente pour rien.
  const avecRoute: CandidatClasse[] = await Promise.all(
    tri.aInterroger.map(async (c) => {
      const r = c.position ? await trajetVoiture(position, c.position) : null;
      return {
        ...c,
        kmRoute: r?.ok ? r.trajet.km : null,
        minutesRoute: r?.ok ? r.trajet.minutes : null,
      };
    })
  );

  return {
    depart: {
      chantierId: depart.id,
      nom: intitule(depart),
      ou: communeApprochee(depart.adresseChantier),
    },
    departNonSitue: null,
    propositions: classer(avecRoute).map((c) => ({
      chantierId: c.chantierId,
      nom: c.nom,
      ou: c.ou,
      phrase: phraseDistance(c),
      parLaRoute: c.minutesRoute !== null || c.kmRoute !== null,
    })),
    ecartes: tri.ecartes,
    sansAdresse: tri.sansPosition.map((c) => ({ chantierId: c.chantierId, nom: c.nom })),
    seuilKm,
  };
}

function intitule(c: ChantierSitue): string {
  return c.clientNom ? `${c.nom} — ${c.clientNom}` : c.nom;
}

function enCandidat(c: ChantierSitue): CandidatDemiJournee {
  return {
    chantierId: c.id,
    nom: intitule(c),
    ou: communeApprochee(c.adresseChantier),
    position:
      c.latitude !== null && c.longitude !== null
        ? { latitude: c.latitude, longitude: c.longitude }
        : null,
  };
}

/**
 * Pose les coordonnées manquantes de quelques chantiers.
 *
 * **Ne lève jamais et ne bloque rien.** Une panne de la Base Adresse Nationale
 * doit coûter une proposition en moins, pas un planning qui refuse de
 * s'afficher. Ce qui n'a pas pu être situé le sera à la prochaine ouverture.
 *
 * Exporté pour être éprouvé seul : c'est la seule partie qui écrit en base.
 */
export async function situerQuelquesChantiers(ctx: Ctx, limite = MAX_SITUATION_PAR_PASSE): Promise<number> {
  let situes = 0;
  let aFaire: { id: string; adresseChantier: string }[];
  try {
    aFaire = await chantiersASituer(ctx, limite);
  } catch {
    return 0;
  }

  for (let i = 0; i < aFaire.length; i += PAQUET) {
    const paquet = aFaire.slice(i, i + PAQUET);
    await Promise.all(
      paquet.map(async (c) => {
        try {
          const r = await chercherAdresses(c.adresseChantier);
          const premiere = r.ok
            ? r.suggestions.find((s) => s.latitude !== null && s.longitude !== null)
            : undefined;

          // **Une panne du service ne s'écrit PAS en base.** Marquer
          // `adresseSituee` alors que le réseau était coupé condamnerait
          // l'adresse à ne plus jamais être retentée : le chantier resterait
          // « non situé » pour toujours, sans que rien ne l'explique.
          if (!r.ok && r.raison !== "trop-court") return;

          if (premiere && premiere.latitude !== null && premiere.longitude !== null) {
            await enregistrerCoordonneesChantier(
              ctx,
              c.id,
              { latitude: premiere.latitude, longitude: premiere.longitude },
              c.adresseChantier
            );
            situes++;
          } else {
            // Adresse trop courte, ou que le service ne reconnaît pas
            // (« derrière l'église ») : on garde la trace de l'essai, sinon la
            // même adresse repartirait à chaque ouverture du planning.
            await enregistrerCoordonneesChantier(ctx, c.id, null, c.adresseChantier);
          }
        } catch {
          // Une adresse qui casse ne doit pas emporter les sept autres.
        }
      })
    );
  }
  return situes;
}
