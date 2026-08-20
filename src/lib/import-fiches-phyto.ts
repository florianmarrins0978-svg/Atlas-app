/**
 * Le contrat d'entrée de la base phytosanitaire — et ce qu'il REFUSE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Ce fichier existe pour dire non.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sa règle du 20 août 2026 : *« Tu ne dois inventer aucune fiche
 * phytosanitaire. Les données seront constituées séparément à partir de sources
 * fiables et validées : DSF/ministère de l'Agriculture, INRAE, FREDON, Plante &
 * Cité, ONF, BSV. Prépare seulement le schéma d'import, les contrôles, le
 * versionnement et la traçabilité nécessaires. »*
 *
 * Le schéma seul ne suffirait pas : il dirait qu'un champ est une chaîne de
 * caractères, pas qu'il est vrai. Les **contrôles** en dessous du schéma sont
 * donc l'essentiel de ce fichier, et ils tiennent en une phrase : *une fiche ne
 * devient servable que si chacune de ses affirmations qui engage est reliée à
 * une source*.
 *
 * ── Les six refus, et ce que chacun évite ─────────────────────────────────
 *
 *  1. **Une fiche `validee` sans aucune source.** C'est le refus fondateur :
 *     sans lui, tout le reste de ce module n'est qu'une manière élaborée
 *     d'afficher des affirmations sans origine.
 *  2. **Un champ qui engage, sans source qui le couvre.** La conduite
 *     recommandée, la gravité, le traitement, le statut réglementaire. Une
 *     bibliographie générale ne dit pas QUI affirme quoi ; le jour où une
 *     conduite est contestée, il faut désigner la source de cette ligne-là.
 *  3. **Un traitement sans source réglementaire ou technique.** Recommander un
 *     produit phytosanitaire engage la responsabilité de l'artisan, et le cadre
 *     français pour les zones non agricoles n'est pas une opinion.
 *  4. **Un mot hors vocabulaire.** Le défaut le plus cher de cette
 *     architecture, parce qu'il est SILENCIEUX : une fiche qui écrit
 *     « moisissure » là où le modèle rend « feutrage_blanc » ne remonte jamais.
 *     Aucune erreur, aucun message — simplement une fiche qui ne sort plus.
 *  5. **Une fixture qui se fait passer pour une vraie fiche.** Sa consigne :
 *     des données de test « explicitement identifiées et impossibles à exposer
 *     en production ». Ici en amont, et en contrainte CHECK dans la base.
 *  6. **Une confusion qui promet une photo sans dire laquelle.** Une relance
 *     « prenez une autre photo » sans consigne est une impasse à l'écran.
 *
 * Aucun de ces contrôles ne touche au réseau ni à la base : ils sont éprouvés
 * seuls (`scripts/test-import-fiches-phyto.ts`), y compris **contre des fiches
 * volontairement fautives** — un contrôle qui n'a jamais échoué ne prouve rien
 * (`CLAUDE.md` §5).
 */

import { z } from "zod";
import {
  COULEURS,
  LOCALISATIONS,
  MOTIFS,
  PARTIES,
  PORTS,
  verifierVocabulaire,
} from "./diagnostic-vegetal";

/** Le préfixe qui marque une donnée d'essai. Voir la contrainte CHECK 0056. */
export const PREFIXE_FIXTURE = "zz-test-";

const jour = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date attendue au format AAAA-MM-JJ");

const code = z
  .string()
  .min(2)
  .regex(/^[a-z0-9-]+$/, "un code ne contient que des minuscules, des chiffres et des tirets");

export const SourceSchema = z.object({
  code,
  organisme: z.string().min(2),
  titre: z.string().min(2),
  url: z.string().url().nullable().default(null),
  nature: z.enum(["officielle", "scientifique", "technique", "reglementaire"]),
  publieeLe: jour.nullable().default(null),
  /** Quand on a LU. Obligatoire : sans elle, on ne sait pas si la fiche a
   *  vieilli, et une fiche périmée est pire qu'absente — on s'y fie encore. */
  consulteeLe: jour,
});
export type SourceImportee = z.infer<typeof SourceSchema>;

export const TaxonSchema = z.object({
  code,
  nomScientifique: z.string().min(2).nullable().default(null),
  nomCommun: z.string().min(2),
  synonymes: z.array(z.string().min(2)).default([]),
  rang: z.enum(["genre", "espece", "famille", "groupe"]).default("espece"),
  port: z.enum(PORTS).nullable().default(null),
});
export type TaxonImporte = z.infer<typeof TaxonSchema>;

export const SymptomeSchema = z.object({
  nature: z.enum(["symptome", "signe"]),
  partie: z.enum(PARTIES),
  motif: z.enum(MOTIFS),
  couleurs: z.array(z.enum(COULEURS)).default([]),
  localisations: z.array(z.enum(LOCALISATIONS)).default([]),
  poids: z.enum(["cardinal", "frequent", "possible"]).default("frequent"),
  /** Ce que la source en dit, en français. Sert aux détails, jamais au score. */
  libelle: z.string().nullable().default(null),
});

export const ReferenceSourceSchema = z.object({
  source: code,
  /** Les champs de la fiche que cette source appuie. Vide = la fiche en général. */
  champs: z.array(z.string().min(2)).default([]),
});

export const FicheSchema = z.object({
  code,
  nomCommun: z.string().min(2),
  nomScientifique: z.string().min(2).nullable().default(null),
  categorie: z.enum([
    "maladie",
    "champignon_lignivore",
    "champignon_autre",
    "ravageur",
    "carence",
    "stress_abiotique",
    "degat_mecanique",
  ]),
  agentCausal: z.string().min(2).nullable().default(null),
  agentType: z
    .enum(["champignon", "bacterie", "virus", "insecte", "acarien", "nematode", "abiotique", "inconnu"])
    .default("inconnu"),
  partiesAtteintes: z.array(z.enum(PARTIES)).default([]),
  periodeDebutMois: z.number().int().min(1).max(12).nullable().default(null),
  periodeFinMois: z.number().int().min(1).max(12).nullable().default(null),
  explicationCourte: z.string().min(10),
  gravite: z.enum(["faible", "vigilance", "importante"]),
  impactMecanique: z.enum(["aucun", "possible", "avere", "inconnu"]).default("inconnu"),
  impactMecaniqueNote: z.string().nullable().default(null),
  risqueHumainAnimal: z.enum(["aucun", "irritant", "toxique", "allergisant", "inconnu"]).default("inconnu"),
  risqueHumainAnimalNote: z.string().nullable().default(null),
  statutReglementaire: z.enum(["aucun", "quarantaine", "lutte_obligatoire", "liste_alerte"]).default("aucun"),
  referenceReglementaire: z.string().nullable().default(null),
  diagnosticPhoto: z.enum(["possible", "indicatif", "impossible"]),
  photosUtiles: z.array(z.enum(PARTIES)).default([]),
  conduiteRecommandee: z.string().min(10),
  prevention: z.string().nullable().default(null),
  gestion: z.string().nullable().default(null),
  traitement: z.string().nullable().default(null),
  niveauValidation: z.enum(["brouillon", "en_revue", "validee"]).default("brouillon"),
  origine: z.enum(["reelle", "fixture_test"]).default("reelle"),
  version: z.number().int().min(1).default(1),
  sourcesAJourLe: jour.nullable().default(null),
  symptomes: z.array(SymptomeSchema).default([]),
  hotes: z
    .array(
      z.object({
        taxon: code,
        specificite: z.enum(["strict", "frequent", "occasionnel"]).default("frequent"),
      })
    )
    .default([]),
  confusions: z
    .array(
      z.object({
        fiche: code,
        critereDifferenciant: z.string().min(5),
        photoQuiTranche: z.string().min(5).nullable().default(null),
        partieQuiTranche: z.enum(PARTIES).nullable().default(null),
      })
    )
    .default([]),
  sources: z.array(ReferenceSourceSchema).default([]),
  images: z
    .array(
      z.object({
        url: z.string().url().nullable().default(null),
        storageKey: z.string().nullable().default(null),
        /** NOT NULL en base : une image d'organisme reprise sans droit est un
         *  risque qui ne se voit qu'à la mise en demeure. */
        licence: z.string().min(2),
        credit: z.string().min(2),
        partie: z.enum(PARTIES).nullable().default(null),
        legende: z.string().nullable().default(null),
      })
    )
    .default([]),
});
export type FicheImportee = z.infer<typeof FicheSchema>;

export const LotSchema = z.object({
  /** Version du lot, reportée sur les diagnostics rendus (traçabilité). */
  version: z.string().min(1),
  sources: z.array(SourceSchema).default([]),
  taxons: z.array(TaxonSchema).default([]),
  fiches: z.array(FicheSchema).default([]),
});
export type LotImporte = z.infer<typeof LotSchema>;

/**
 * Les champs qui ENGAGENT — ceux qu'une source doit couvrir nommément.
 *
 * La liste est courte à dessein : exiger une source pour chaque champ rendrait
 * la saisie intenable et pousserait à citer n'importe quoi pour passer le
 * contrôle — c'est-à-dire à le vider de son sens. Ces quatre-là sont ceux dont
 * une erreur coûte de l'argent, du végétal, ou une mise en cause.
 */
export const CHAMPS_QUI_ENGAGENT = [
  "conduite_recommandee",
  "gravite",
  "traitement",
  "statut_reglementaire",
] as const;

export type ProblemeImport = { fiche: string | null; message: string };

export type VerdictImport =
  | { ok: true; lot: LotImporte; avertissements: ProblemeImport[] }
  | { ok: false; problemes: ProblemeImport[]; avertissements: ProblemeImport[] };

/**
 * Valider un lot avant qu'il n'approche de la base.
 *
 * **Les avertissements ne bloquent pas, et c'est un choix.** Une fiche en
 * brouillon incomplète doit pouvoir entrer : c'est ainsi qu'on la travaille. Ce
 * qui ne doit jamais passer, c'est une fiche `validee` incomplète — parce que
 * celle-là sera servie à un chantier.
 */
export function validerLot(brut: unknown, options: { autoriserFixtures: boolean }): VerdictImport {
  const analyse = LotSchema.safeParse(brut);
  if (!analyse.success) {
    return {
      ok: false,
      avertissements: [],
      problemes: analyse.error.issues.map((i) => ({
        fiche: null,
        message: `${i.path.join(".") || "(racine)"} : ${i.message}`,
      })),
    };
  }

  const lot = analyse.data;
  const problemes: ProblemeImport[] = [];
  const avertissements: ProblemeImport[] = [];

  const codesSources = new Set(lot.sources.map((s) => s.code));
  const codesTaxons = new Set(lot.taxons.map((t) => t.code));
  const codesFiches = new Set(lot.fiches.map((f) => f.code));
  const naturesSources = new Map(lot.sources.map((s) => [s.code, s.nature]));

  // Doublons — une même fiche deux fois dans un lot laisserait la dernière
  // écraser la première sans un mot, et personne ne saurait laquelle a gagné.
  for (const [nom, liste] of [
    ["source", lot.sources.map((s) => s.code)],
    ["taxon", lot.taxons.map((t) => t.code)],
    ["fiche", lot.fiches.map((f) => f.code)],
  ] as const) {
    const vus = new Set<string>();
    for (const c of liste) {
      if (vus.has(c)) problemes.push({ fiche: null, message: `${nom} « ${c} » déclaré deux fois dans le lot` });
      vus.add(c);
    }
  }

  for (const fiche of lot.fiches) {
    const ici = (message: string) => ({ fiche: fiche.code, message });
    const estFixture = fiche.origine === "fixture_test";
    const porteLePrefixe = fiche.code.startsWith(PREFIXE_FIXTURE);

    // ── 5. Fixtures ────────────────────────────────────────────────────────
    if (estFixture !== porteLePrefixe) {
      problemes.push(
        ici(
          estFixture
            ? `déclarée fixture de test mais son code ne commence pas par « ${PREFIXE_FIXTURE} »`
            : `son code commence par « ${PREFIXE_FIXTURE} » mais elle se déclare réelle`
        )
      );
    }
    if (estFixture && !options.autoriserFixtures) {
      problemes.push(ici("fixture de test refusée : cet import n’accepte que des fiches réelles"));
    }

    // ── 4. Vocabulaire ─────────────────────────────────────────────────────
    for (const message of verifierVocabulaire(fiche.symptomes)) problemes.push(ici(message));

    // ── Renvois ────────────────────────────────────────────────────────────
    for (const hote of fiche.hotes) {
      if (!codesTaxons.has(hote.taxon)) problemes.push(ici(`hôte « ${hote.taxon} » inconnu dans ce lot`));
    }
    for (const ref of fiche.sources) {
      if (!codesSources.has(ref.source)) problemes.push(ici(`source « ${ref.source} » inconnue dans ce lot`));
    }
    for (const confusion of fiche.confusions) {
      if (!codesFiches.has(confusion.fiche)) {
        problemes.push(ici(`confusion avec « ${confusion.fiche} », qui n’est pas dans ce lot`));
      }
      if (confusion.fiche === fiche.code) problemes.push(ici("une fiche ne se confond pas avec elle-même"));
      // ── 6. Une relance doit dire QUOI photographier ──────────────────────
      if (confusion.photoQuiTranche !== null && confusion.partieQuiTranche === null) {
        avertissements.push(
          ici(`la confusion avec « ${confusion.fiche} » demande une photo sans dire de quelle partie`)
        );
      }
    }

    // Une période se donne entière ou pas du tout : un début sans fin ne se lit
    // pas, et le rapprochement l'ignorerait en silence.
    if ((fiche.periodeDebutMois === null) !== (fiche.periodeFinMois === null)) {
      problemes.push(ici("période d’observation incomplète : donnez le mois de début ET celui de fin, ou aucun"));
    }

    const champsCouverts = new Set(fiche.sources.flatMap((s) => s.champs));

    // ── 3. Un traitement engage plus que le reste ──────────────────────────
    if (fiche.traitement !== null) {
      const appuis = fiche.sources.filter((s) => s.champs.includes("traitement"));
      const naturesAppuis = appuis.map((s) => naturesSources.get(s.source));
      if (!naturesAppuis.some((n) => n === "reglementaire" || n === "officielle" || n === "technique")) {
        problemes.push(
          ici(
            "un traitement doit être appuyé par une source réglementaire, officielle ou technique — " +
              "recommander un produit engage l’artisan, et le cadre applicable n’est pas une opinion"
          )
        );
      }
    }

    // ── 1 et 2. Ce qu'une fiche SERVABLE doit prouver ──────────────────────
    if (fiche.niveauValidation === "validee") {
      if (fiche.sources.length === 0) {
        problemes.push(ici("fiche validée sans aucune source — refusée"));
      }
      for (const champ of CHAMPS_QUI_ENGAGENT) {
        // Un champ vide n'a rien à prouver : `statut_reglementaire = aucun` et
        // `traitement = null` sont des non-affirmations.
        if (champ === "traitement" && fiche.traitement === null) continue;
        if (champ === "statut_reglementaire" && fiche.statutReglementaire === "aucun") continue;
        if (!champsCouverts.has(champ)) {
          problemes.push(ici(`fiche validée : le champ « ${champ} » n’est rattaché à aucune source`));
        }
      }
      if (fiche.symptomes.length === 0) {
        problemes.push(ici("fiche validée sans aucun symptôme — elle ne pourrait jamais être rapprochée d’une photo"));
      }
      if (fiche.sourcesAJourLe === null) {
        avertissements.push(ici("fiche validée sans date de mise à jour des sources"));
      }
    } else if (fiche.sources.length === 0) {
      avertissements.push(ici("aucune source — cette fiche ne pourra pas être validée en l’état"));
    }

    // Une fiche dont la photo ne peut rien prouver n'a pas à être servable :
    // elle occuperait le classement sans jamais pouvoir conclure.
    if (fiche.diagnosticPhoto === "impossible" && fiche.niveauValidation === "validee") {
      avertissements.push(
        ici("diagnostic photographique déclaré impossible : cette fiche ne sera jamais rendue comme conclusion")
      );
    }
  }

  if (problemes.length > 0) return { ok: false, problemes, avertissements };
  return { ok: true, lot, avertissements };
}
