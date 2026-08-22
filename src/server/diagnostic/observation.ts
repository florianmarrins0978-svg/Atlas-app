/**
 * Faire REGARDER une photo — et surtout, ne rien lui faire conclure.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * C'est ici que se joue la promesse « le modèle observe, la base décide ».
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Trois barrières, et il faut les trois.** Une seule aurait l'air de suffire,
 * et n'aurait tenu que jusqu'au premier modèle un peu bavard :
 *
 *  1. **Le schéma de sortie ne comporte AUCUN champ où nommer un problème.**
 *     Pas de « diagnostic », pas d'« hypothèse », pas de « maladie probable ».
 *     Un modèle ne peut pas conclure dans un formulaire qui n'a pas de case
 *     pour ça. C'est la seule barrière vraiment structurelle des trois.
 *  2. **Le vocabulaire est fermé** (`src/lib/diagnostic-vegetal.ts`). On lui
 *     donne les mots, il choisit dedans. « feutrage_blanc » se constate,
 *     « oïdium » se conclut — et le second n'est pas dans la liste.
 *  3. **Ce qui sort du vocabulaire est jeté**, silencieusement pour ce mot-là
 *     et bruyamment dans le journal. Un modèle qui invente « moisissure » perd
 *     ce signe, il ne le fait pas entrer par la porte de service.
 *
 * **Ce qui n'est PAS éprouvable ici.** Il n'y a aucune clé d'IA dans cet
 * environnement : l'appel réel au fournisseur n'y sera jamais vérifié, comme
 * pour la lecture des tickets (`lire-ticket.ts`). Ce qui l'est, et c'est là que
 * vivent les vrais pièges : `lireObservation`, fonction pure, confrontée à ce
 * qu'un modèle rend RÉELLEMENT — de la prose autour du JSON, des mots hors
 * vocabulaire, un objet vide, un tableau à la place d'un objet.
 */

import { z } from "zod";
import {
  COULEURS,
  LOCALISATIONS,
  MOTIFS,
  PARTIES,
  PORTS,
  type Observation,
  type Partie,
  type Port,
  type QualitePhoto,
  type SigneObserve,
} from "@/lib/diagnostic-vegetal";
import { lireObjetJson } from "@/lib/json-du-modele";
import { getFournisseurVision } from "../ai/providers/llm/fabrique";
import { getConfigIA } from "../ai/config";
import type { ImagePourLecture } from "../ai/providers/llm/interface";
import { logger } from "../logger";

/** L'essence telle que le modèle la nomme — résolue en taxon plus tard. */
export type EssenceObservee = {
  nomScientifique: string | null;
  nomCommun: string | null;
  port: Port | null;
  certitude: "sure" | "probable" | "incertaine";
};

export type ObservationBrute = Omit<Observation, "essence"> & {
  essence: EssenceObservee | null;
  /** Ce que la photo ne montre pas. Journalisé, jamais affiché tel quel. */
  reserves: string[];
};

// ── Le schéma de sortie ─────────────────────────────────────────────────────
//
// Tolérant à l'entrée, strict à la sortie : on accepte qu'un modèle rende une
// chaîne vide ou une casse fantaisiste, on refuse qu'il fasse entrer un mot
// inconnu. `catch` ramène chaque champ hors norme à une valeur neutre plutôt
// que de jeter l'observation entière — perdre une couleur ne doit pas coûter
// une photo au patron.

/**
 * Ramener ce que le modèle écrit à la forme du vocabulaire.
 *
 * **Les accents sont retirés, et c'est le point qui manquait.** Le vocabulaire
 * est écrit sans accent (`face_inferieure`) ; un modèle qui répond en français
 * écrit « face inférieure », ce qui est le BON mot. Sans cette normalisation,
 * il était jeté comme s'il était inventé — on aurait perdu des observations
 * justes en croyant se protéger des fausses.
 */
const normaliser = (v: unknown) =>
  typeof v === "string"
    ? v
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s'-]+/g, "_")
    : v;

const enumTolerant = <T extends string>(valeurs: readonly T[]) =>
  z.preprocess(normaliser, z.enum(valeurs as unknown as [T, ...T[]]));

const SigneSchema = z.object({
  partie: enumTolerant(PARTIES),
  motif: enumTolerant(MOTIFS),
  couleurs: z.array(enumTolerant(COULEURS).catch(undefined as never)).default([]),
  localisation: enumTolerant(LOCALISATIONS).nullable().catch(null).default(null),
});

const ObservationSchema = z.object({
  partie: enumTolerant(PARTIES).nullable().catch(null).default(null),
  signes: z.array(SigneSchema.nullable().catch(null)).default([]),
  essence: z
    .object({
      nom_scientifique: z.string().nullable().catch(null).default(null),
      nom_commun: z.string().nullable().catch(null).default(null),
      port: enumTolerant(PORTS).nullable().catch(null).default(null),
      certitude: z.enum(["sure", "probable", "incertaine"]).catch("incertaine").default("incertaine"),
    })
    .nullable()
    .catch(null)
    .default(null),
  qualite_photo: z.enum(["bonne", "moyenne", "mauvaise"]).catch("moyenne").default("moyenne"),
  reserves: z.array(z.string()).default([]),
});

// ── La consigne ─────────────────────────────────────────────────────────────
//
// **Le vocabulaire est INJECTÉ depuis `diagnostic-vegetal.ts`, jamais recopié
// ici.** Recopié, il aurait divergé au premier mot ajouté — et la divergence
// serait silencieuse : le modèle rendrait un mot que la base ne connaît pas, ou
// ignorerait un mot que les fiches emploient. Aucune erreur, simplement des
// fiches qui ne sortent plus jamais. C'est le défaut le plus cher de cette
// architecture, et c'est cette ligne qui l'empêche.

const liste = (mots: readonly string[]) => mots.join(", ");

export const SYSTEME_OBSERVATION = `Tu es un assistant qui DÉCRIT des photographies de végétaux pour un professionnel du paysage.

TU NE POSES AUCUN DIAGNOSTIC. Tu ne nommes jamais une maladie, un champignon, un ravageur ni une carence.
Tu décris uniquement CE QUI EST VISIBLE, avec les mots imposés ci-dessous. Un autre système se charge d'identifier.

Tu réponds UNIQUEMENT par un objet JSON, sans phrase avant ni après, sans balises de code.

Champs attendus :
- "partie" : la partie du végétal photographiée, parmi [${liste(PARTIES)}], ou null si ce n'est pas identifiable.
- "signes" : un tableau de ce qui est visible. Chaque entrée :
    - "partie"  : parmi [${liste(PARTIES)}]
    - "motif"   : parmi [${liste(MOTIFS)}]
    - "couleurs": tableau parmi [${liste(COULEURS)}]
    - "localisation" : parmi [${liste(LOCALISATIONS)}], ou null
- "essence" : { "nom_scientifique", "nom_commun", "port" parmi [${liste(PORTS)}], "certitude" parmi [sure, probable, incertaine] }, ou null.
- "qualite_photo" : "bonne", "moyenne" ou "mauvaise".
- "reserves" : tableau de phrases courtes disant ce que la photo NE montre pas.

Règles absolues :
- N'emploie QUE les mots des listes. Un mot hors liste est ignoré : ne l'invente pas, choisis le plus proche ou n'écris rien.
- Ne devine jamais. Une partie non identifiable vaut null, une essence non reconnaissable vaut null.
- Si la photo est floue, sombre, ou trop éloignée pour distinguer un détail, dis-le dans "qualite_photo" et laisse "signes" vide plutôt que de supposer.
- Ne rends aucun nom de maladie, de champignon, de ravageur ou de carence, même si tu le reconnais, et même dans "reserves".`;

const CONSIGNE_UNE = "Décris cette photo en respectant strictement le format demandé.";
const CONSIGNE_DEUX =
  "Voici deux photos du même végétal : la première est la vue d'ensemble déjà fournie, " +
  "la seconde est le détail demandé. Décris ce que montrent les DEUX, dans un seul objet JSON.";

export type ResultatObservation =
  | { ok: true; observation: ObservationBrute; modele: string; moteur: string }
  | { ok: false; raison: string; indisponible: boolean };

/**
 * Ce que le modèle a répondu, transformé en observation — ou refusé.
 *
 * Fonction **pure** : c'est elle que les suites éprouvent, sans clé et sans
 * réseau. Elle porte les trois défenses habituelles contre ce que les modèles
 * font réellement (`lire-ticket.ts` les avait déjà rencontrées) : l'emballage
 * autour du JSON, les valeurs hors énumération, et la réponse vide déguisée en
 * réponse.
 */
export function lireObservation(texte: string): { ok: true; observation: ObservationBrute } | { ok: false; raison: string } {
  const brut = lireObjetJson(texte);
  if (brut === null) return { ok: false, raison: "La lecture n’a rien rendu d’exploitable." };

  const analyse = ObservationSchema.safeParse(brut);
  if (!analyse.success) {
    return { ok: false, raison: "La lecture n’a rien rendu d’exploitable." };
  }
  const d = analyse.data;

  // Les signes que le schéma a ramenés à `null` sont ceux dont la partie ou le
  // motif sortaient du vocabulaire. Ils sont JETÉS, pas rattrapés : un motif
  // inventé n'a aucun équivalent dans les fiches, et le faire entrer sous un
  // autre nom serait interpréter à la place du modèle.
  const signesLus = d.signes.filter((s): s is NonNullable<typeof s> => s !== null);
  const jetes = d.signes.length - signesLus.length;
  if (jetes > 0) {
    logger.warn("Diagnostic végétal : signes hors vocabulaire écartés", { nombre: jetes });
  }

  const signes: SigneObserve[] = signesLus.map((s) => ({
    partie: s.partie as Partie,
    motif: s.motif,
    couleurs: (s.couleurs ?? []).filter((c): c is NonNullable<typeof c> => c != null),
    localisation: s.localisation ?? null,
  }));

  const essence: EssenceObservee | null =
    d.essence && (d.essence.nom_scientifique || d.essence.nom_commun || d.essence.port)
      ? {
          nomScientifique: vide(d.essence.nom_scientifique),
          nomCommun: vide(d.essence.nom_commun),
          port: d.essence.port,
          certitude: d.essence.certitude,
        }
      : null;

  return {
    ok: true,
    observation: {
      partie: d.partie,
      signes,
      essence,
      qualitePhoto: d.qualite_photo as QualitePhoto,
      reserves: d.reserves.slice(0, 5),
    },
  };
}

function vide(v: string | null): string | null {
  if (v === null) return null;
  const p = v.trim();
  return p === "" || p.toLowerCase() === "null" ? null : p;
}

/**
 * Regarder une ou deux photos.
 *
 * **Sans fournisseur de vision, on refuse PROPREMENT** — et `indisponible`
 * distingue les deux refus qui ne se réparent pas au même endroit : « aucun
 * fournisseur n'est branché ici » se règle dans la configuration, « le
 * fournisseur a refusé » se règle chez le fournisseur. Une seule phrase pour
 * les deux enverrait chercher au mauvais endroit (`AGENTS.md`).
 */
export async function observer(images: ImagePourLecture[]): Promise<ResultatObservation> {
  const fournisseur = getFournisseurVision();
  if (!fournisseur.lireImages) {
    return {
      ok: false,
      indisponible: true,
      raison: "L’analyse automatique n’est pas disponible sur cette installation.",
    };
  }

  const consigne = images.length > 1 ? CONSIGNE_DEUX : CONSIGNE_UNE;
  const reponse = await fournisseur.lireImages(SYSTEME_OBSERVATION, consigne, images, { maxTokens: 1500 });
  if (!reponse.succes) {
    // Le message du fournisseur est repris tel quel : « clé refusée » et
    // « quota dépassé » ne se réparent pas de la même façon.
    return { ok: false, indisponible: false, raison: reponse.erreur.message };
  }

  const lue = lireObservation(reponse.texte);
  if (!lue.ok) return { ok: false, indisponible: false, raison: lue.raison };

  return {
    ok: true,
    observation: lue.observation,
    moteur: fournisseur.nom,
    modele: getConfigIA().visionModele ?? "(défaut du fournisseur)",
  };
}
