import { z } from "zod";
import type { ErreurIA } from "../errors";

// Une prestation ou un matériel détecté dans la dictée. Seul `libelle` est
// obligatoire : tout le reste reste nul tant que le texte ne le mentionne pas
// explicitement. `aConfirmer` signale une donnée présente mais incertaine —
// jamais un moyen de combler un vide par une supposition.
export const LigneExtraiteSchema = z.object({
  libelle: z.string().min(1),
  description: z.string().nullable().default(null),
  quantite: z.string().nullable().default(null),
  unite: z.string().nullable().default(null),
  aConfirmer: z.boolean().default(false),
});

export type LigneExtraite = z.infer<typeof LigneExtraiteSchema>;

// Modèle du brouillon structuré. Volontairement plat et restreint au strict
// nécessaire du MVP : chaque champ correspond à une information que l'artisan
// dicte réellement sur un chantier. Tout champ non mentionné vaut null ou [] —
// il n'existe aucune valeur par défaut « plausible ».
export const PropositionExtractionSchema = z.object({
  prestations: z.array(LigneExtraiteSchema).default([]),
  materiel: z.array(LigneExtraiteSchema).default([]),
  dureePrevue: z.string().nullable().default(null),
  tailleEquipe: z.string().nullable().default(null),
  gestionDechets: z.string().nullable().default(null),
  contraintesAcces: z.string().nullable().default(null),
  remarques: z.string().nullable().default(null),
  ambiguites: z.array(z.string()).default([]),
  informationsManquantes: z.array(z.string()).default([]),
});

export type PropositionExtraction = z.infer<typeof PropositionExtractionSchema>;

export type ResultatExtraction = { succes: true; proposition: PropositionExtraction } | { succes: false; erreur: ErreurIA };

// Brouillon vide — état de départ explicite, jamais un objet partiellement
// rempli. Utilisé quand aucune analyse n'a encore eu lieu.
export function brouillonVide(): PropositionExtraction {
  return PropositionExtractionSchema.parse({});
}
