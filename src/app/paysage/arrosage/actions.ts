"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { lireCroquis } from "@/server/ai/services/lire-croquis";
// Module JavaScript repris tel quel de `appli/` — voir l'en-tête du fichier.
import { calculerPlan } from "@/lib/arrosage/calcul.js";
import { debitRetenu, SEAU_LITRES } from "@/lib/arrosage/mesure-debit";

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
        materiel: { ref?: string; nom: string; q: number; u: string }[];
      };
    };

export async function lireLeCroquis(_precedent: EtatPlan, formulaire: FormData): Promise<EtatPlan> {
  // La session est exigée avant tout : cet écran fait travailler l'IA, et
  // c'est un coût. Personne d'anonyme ne le déclenche.
  await getCurrentCtx();

  const photo = formulaire.get("croquis");
  if (!(photo instanceof File) || photo.size === 0) {
    return { etat: "refus", raison: "Aucune photo n’a été jointe." };
  }
  // **Une borne dure sur la taille.** Une photo de téléphone moderne pèse
  // 10 Mo ; l'envoyer entière au fournisseur coûte pour rien et fait parfois
  // tomber l'appel. Au-delà, on le dit plutôt que d'échouer sans raison.
  if (photo.size > 8 * 1024 * 1024) {
    return { etat: "refus", raison: "Cette photo dépasse 8 Mo. Reprenez-la en plus petit." };
  }

  const base64 = Buffer.from(await photo.arrayBuffer()).toString("base64");
  const lu = await lireCroquis(base64, photo.type || "image/jpeg");
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

  const plan = calculerPlan({
    // Le calcul raisonne en seau et temps : on lui rend le débit retenu sous
    // cette forme, sans repasser par la saisie — une seule source du débit.
    seau: SEAU_LITRES,
    temps: (SEAU_LITRES / mesure.debit) * 3.6,
    pression: mesure.pression,
    compteur: piquage === "compteur" ? "oui" : "non",
    zones: mesurees.map((z) => ({
      type: z.type,
      nom: z.nom ?? undefined,
      L: z.L ?? undefined,
      l: z.l ?? undefined,
      ml: z.ml ?? undefined,
    })),
  });

  const reserves = [...lu.croquis.reserves];
  if (mesure.reserve) reserves.push(mesure.reserve);
  if (mesurees.length === 0) {
    return {
      etat: "refus",
      raison: "Aucune zone du croquis n’a de mesure lisible : le plan ne peut pas se calculer.",
    };
  }

  return {
    etat: "lu",
    zones: lu.croquis.zones,
    reserves,
    plan: {
      debitDisponible: plan.debitDisponible,
      secteurs: plan.secteurs,
      voies: plan.voies,
      couleurs: plan.couleurs,
      materiel: plan.materiel,
    },
  };
}
