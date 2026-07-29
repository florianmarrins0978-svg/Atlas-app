// Décrit les étapes prévues d'un futur pipeline IA
// (audio -> transcription -> extraction -> validation -> calcul -> devis).
// Chaque étape reste indépendante ; aucune ne connaît les détails internes des
// suivantes. Ce fichier ne fait que documenter la structure — aucune logique de
// pipeline n'est implémentée dans ce lot (voir Lot IA-01.5).
export type EtapePipeline = "audio" | "transcription" | "extraction" | "validation" | "calcul" | "devis";
