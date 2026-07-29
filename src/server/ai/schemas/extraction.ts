import { z } from "zod";
import type { ErreurIA } from "../errors";

export const PropositionExtractionSchema = z.object({
  prestations: z.array(z.string()).default([]),
  dureePrevue: z.string().nullable().default(null),
  tailleEquipe: z.string().nullable().default(null),
  materiel: z.array(z.string()).default([]),
  remarques: z.string().nullable().default(null),
  ambiguites: z.array(z.string()).default([]),
  informationsManquantes: z.array(z.string()).default([]),
});

export type PropositionExtraction = z.infer<typeof PropositionExtractionSchema>;

export type ResultatExtraction = { succes: true; proposition: PropositionExtraction } | { succes: false; erreur: ErreurIA };
