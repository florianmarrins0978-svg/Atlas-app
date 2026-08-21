/**
 * Lire la base phytosanitaire — **en lecture seule, et jamais autrement.**
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pas de `withEntreprise` ici, et ce n'est pas un oubli.** Ces tables sont
 * PARTAGÉES entre toutes les sociétés : un fait phytosanitaire n'appartient à
 * personne. Même situation que `catalogue_prestations` (migration 0007) et
 * `documents_legaux` (0014), qui lisent `db` directement pour la même raison.
 * Il n'y a aucune donnée personnelle à isoler, et rien à écrire : la migration
 * n'accorde que `SELECT` à `atlas_app`. L'import, lui, tourne sous le rôle
 * propriétaire — une faille dans l'application ne peut donc pas écrire une
 * maladie inventée dans la base commune de tout le monde.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX FILTRES, ET ILS NE SONT PAS NÉGOCIABLES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  - `niveau_validation = 'validee'` — une fiche en cours de saisie n'atteint
 *    jamais un chantier.
 *  - `origine = 'reelle'` — une fixture de test ne peut pas servir un vrai
 *    diagnostic. Sa consigne du 20 août : des données d'essai « explicitement
 *    identifiées et impossibles à exposer en production ».
 *
 * Le second filtre a une **dérogation, à double garde**, sur le modèle exact de
 * celle de `getCurrentCtx` : jamais en production, ET seulement si la suite l'a
 * elle-même demandée par une variable. Sans les deux, ce chemin n'est jamais
 * emprunté — et la base porte de son côté une contrainte CHECK qui lie
 * l'origine au préfixe du code, dans les deux sens.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  confusionsPhyto,
  fichesPhyto,
  fichesSources,
  hotesPhyto,
  imagesPhyto,
  sourcesPhyto,
  symptomesPhyto,
  taxons,
} from "../db/schema";
import type {
  Confusion,
  Couleur,
  FichePourMoteur,
  Localisation,
  Motif,
  Partie,
  Port,
} from "@/lib/diagnostic-vegetal";

/**
 * Les fixtures sont-elles autorisées à sortir ?
 *
 * **Deux conditions, et jamais un repli implicite.** `NODE_ENV` seul ne
 * suffirait pas : un banc d'essai sert une version bâtie, donc tourne en
 * `production` — mais l'inverse est vrai aussi, un environnement de
 * développement mal réglé ne doit pas servir des fixtures sans qu'on l'ait
 * demandé. La variable est posée par la suite elle-même, pour la durée du
 * processus de test.
 */
function fixturesAutorisees(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ATLAS_FIXTURES_PHYTO === "1";
}

/** Le filtre commun à toute lecture servante. Écrit une fois, jamais recopié. */
function filtreServable() {
  // **Deux conditions, et la seconde est redondante AUJOURD'HUI.** La contrainte
  // `fiches_phyto_integrite_ck` (migration 0057) interdit déjà `validee` sans
  // contrôle d'intégrité réussi. On la répète ici parce qu'une contrainte se
  // relâche d'un `ALTER TABLE` que personne ne relira, alors que cette ligne-ci
  // se lit à chaque fois qu'on touche à la lecture des fiches. Le jour où les
  // deux divergent, c'est la plus stricte qui l'emporte, et c'est voulu.
  const valide = and(
    eq(fichesPhyto.niveauValidation, "validee"),
    eq(fichesPhyto.controleIntegriteOk, true)
  );
  return fixturesAutorisees() ? valide : and(valide, eq(fichesPhyto.origine, "reelle"));
}

export type BasePourMoteur = {
  fiches: FichePourMoteur[];
  confusions: Confusion[];
  /** Vrai quand aucune fiche n'est servable — l'écran le DIT plutôt que de
   *  répondre « rien trouvé », qui ferait croire à un diagnostic négatif. */
  vide: boolean;
};

/**
 * Tout ce dont le moteur a besoin, en un seul aller-retour.
 *
 * **Pourquoi tout charger plutôt que filtrer en SQL.** À l'échelle visée —
 * quelques milliers de fiches —, l'ensemble tient largement en mémoire et le
 * rapprochement est du calcul pur, donc éprouvable sans base. Filtrer en SQL
 * aurait dispersé la règle de scoring entre du TypeScript et du SQL, c'est-à-dire
 * exactement la duplication que `CLAUDE.md` §3 interdit.
 *
 * **Ce qui devra changer, et quand.** Le jour où la base dépasse largement ces
 * ordres de grandeur, on préfiltrera en SQL sur `parties_atteintes` (l'index
 * GIN est déjà posé) avant de scorer en mémoire. Le moteur, lui, ne bougera
 * pas : il reçoit une liste de fiches, d'où qu'elle vienne.
 */
export async function lireBasePourMoteur(): Promise<BasePourMoteur> {
  const lignes = await db
    .select({
      id: fichesPhyto.id,
      code: fichesPhyto.code,
      nomCommun: fichesPhyto.nomCommun,
      gravite: fichesPhyto.gravite,
      diagnosticPhoto: fichesPhyto.diagnosticPhoto,
      partiesAtteintes: fichesPhyto.partiesAtteintes,
      periodeDebutMois: fichesPhyto.periodeDebutMois,
      periodeFinMois: fichesPhyto.periodeFinMois,
      certitudeMax: fichesPhyto.certitudeMax,
      hotesNonExhaustifs: fichesPhyto.hotesNonExhaustifs,
    })
    .from(fichesPhyto)
    .where(filtreServable())
    .orderBy(fichesPhyto.code);

  if (lignes.length === 0) return { fiches: [], confusions: [], vide: true };

  const ids = lignes.map((f) => f.id);
  const [symptomes, hotes, confusions] = await Promise.all([
    db.select().from(symptomesPhyto).where(inArray(symptomesPhyto.ficheId, ids)).orderBy(symptomesPhyto.ordre),
    db
      .select({
        ficheId: hotesPhyto.ficheId,
        taxonId: hotesPhyto.taxonId,
        specificite: hotesPhyto.specificite,
        port: taxons.port,
      })
      .from(hotesPhyto)
      .innerJoin(taxons, eq(taxons.id, hotesPhyto.taxonId))
      .where(inArray(hotesPhyto.ficheId, ids)),
    // Les deux extrémités doivent être servables : une confusion qui pointe une
    // fiche en brouillon proposerait une photo complémentaire pour départager
    // d'un problème qu'on ne saurait pas nommer ensuite.
    db
      .select()
      .from(confusionsPhyto)
      .where(and(inArray(confusionsPhyto.ficheId, ids), inArray(confusionsPhyto.ficheConfondueId, ids))),
  ]);

  const symptomesParFiche = new Map<string, FichePourMoteur["symptomes"]>();
  for (const s of symptomes) {
    const liste = symptomesParFiche.get(s.ficheId) ?? [];
    liste.push({
      nature: s.nature,
      partie: s.partie as Partie,
      motif: s.motif as Motif,
      couleurs: s.couleurs as Couleur[],
      localisations: s.localisations as Localisation[],
      poids: s.poids,
    });
    symptomesParFiche.set(s.ficheId, liste);
  }

  const hotesParFiche = new Map<string, FichePourMoteur["hotes"]>();
  for (const h of hotes) {
    const liste = hotesParFiche.get(h.ficheId) ?? [];
    liste.push({ taxonId: h.taxonId, port: (h.port as Port | null) ?? null, specificite: h.specificite });
    hotesParFiche.set(h.ficheId, liste);
  }

  return {
    fiches: lignes.map((f) => ({
      ...f,
      partiesAtteintes: f.partiesAtteintes as Partie[],
      symptomes: symptomesParFiche.get(f.id) ?? [],
      hotes: hotesParFiche.get(f.id) ?? [],
    })),
    confusions: confusions.map((c) => ({
      ficheId: c.ficheId,
      ficheConfondueId: c.ficheConfondueId,
      critereDifferenciant: c.critereDifferenciant,
      photoQuiTranche: c.photoQuiTranche,
      partieQuiTranche: (c.partieQuiTranche as Partie | null) ?? null,
    })),
    vide: false,
  };
}

/**
 * La fiche complète, pour composer le résultat affiché.
 *
 * **Chargée SÉPARÉMENT du rapprochement, et volontairement après lui.** Le
 * moteur n'a pas besoin de la conduite à tenir pour scorer, et la lui donner
 * l'aurait exposée à un classeur sémantique — qui n'a rien à faire près des
 * textes affichés. Ici, la fiche est déjà choisie : plus rien ne peut la
 * changer.
 */
export async function lireFicheComplete(ficheId: string) {
  const [fiche] = await db.select().from(fichesPhyto).where(eq(fichesPhyto.id, ficheId)).limit(1);
  if (!fiche) return null;

  const sources = await db
    .select({
      organisme: sourcesPhyto.organisme,
      titre: sourcesPhyto.titre,
      url: sourcesPhyto.url,
      consulteeLe: sourcesPhyto.consulteeLe,
      champs: fichesSources.champs,
    })
    .from(fichesSources)
    .innerJoin(sourcesPhyto, eq(sourcesPhyto.id, fichesSources.sourceId))
    .where(eq(fichesSources.ficheId, ficheId))
    .orderBy(sourcesPhyto.organisme);

  return { fiche, sources };
}

export async function lireImagesFiche(ficheId: string) {
  return db.select().from(imagesPhyto).where(eq(imagesPhyto.ficheId, ficheId)).orderBy(imagesPhyto.ordre);
}

/**
 * Retrouver l'essence nommée par le modèle.
 *
 * **Indulgent sur la forme, strict sur le fond.** Le modèle rend « Quercus
 * robur », « chêne pédonculé » ou « Chene » ; la comparaison ignore la casse et
 * les espaces superflus, mais **ne rapproche jamais deux noms différents**. Un
 * appariement approximatif ferait entrer une essence fausse — et une essence
 * fausse écarte la bonne fiche par exclusion d'hôte, ce qui est le pire des
 * effets possibles : un diagnostic manqué sans le moindre message.
 *
 * Rend `null` plutôt que de deviner. Le moteur travaille alors sans essence, et
 * la confiance en tient compte.
 */
export async function trouverTaxon(nomScientifique: string | null, nomCommun: string | null) {
  const candidats = [nomScientifique, nomCommun]
    .map((n) => n?.trim().toLowerCase())
    .filter((n): n is string => !!n && n.length >= 3);
  if (candidats.length === 0) return null;

  for (const nom of candidats) {
    const [trouve] = await db
      .select({ id: taxons.id, port: taxons.port })
      .from(taxons)
      .where(
        sql`lower(${taxons.nomScientifique}) = ${nom}
            OR lower(${taxons.nomCommun}) = ${nom}
            OR EXISTS (SELECT 1 FROM unnest(${taxons.synonymes}) AS s WHERE lower(s) = ${nom})`
      )
      .limit(1);
    if (trouve) return trouve;
  }

  // Le genre seul, quand le modèle a rendu une espèce que la base ne porte pas :
  // « Quercus robur » retombe sur « Quercus ». C'est la seule tolérance admise,
  // et elle ne se trompe pas de végétal — elle en dit simplement moins.
  const scientifique = nomScientifique?.trim().toLowerCase();
  const genre = scientifique?.split(/\s+/)[0];
  if (genre && genre.length >= 3 && genre !== scientifique) {
    const [trouve] = await db
      .select({ id: taxons.id, port: taxons.port })
      .from(taxons)
      .where(and(eq(taxons.rang, "genre"), sql`lower(${taxons.nomScientifique}) = ${genre}`))
      .limit(1);
    if (trouve) return trouve;
  }

  return null;
}

/**
 * La version de la base, reportée sur chaque diagnostic rendu.
 *
 * Un diagnostic douteux doit pouvoir se rattacher à l'état de la base ce
 * jour-là. Le compte des fiches servables et la date de mise à jour la plus
 * récente suffisent à le situer, sans table de versions à tenir à jour — donc
 * sans rien qui puisse diverger de la réalité.
 */
export async function versionBase(): Promise<string> {
  const [ligne] = await db
    .select({
      nombre: sql<number>`count(*)::int`,
      maj: sql<string | null>`max(${fichesPhyto.sourcesAJourLe})::text`,
    })
    .from(fichesPhyto)
    .where(filtreServable());
  return `${ligne?.nombre ?? 0} fiches · ${ligne?.maj ?? "sans date"}`;
}
