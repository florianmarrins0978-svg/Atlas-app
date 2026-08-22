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
        /**
         * **À PARTIR DE COMBIEN DE MÈTRES IL FAUT DU Ø32** — sa demande du
         * 22 août 2026 : *« passé un certain nombre de mètres linéaires, il
         * faut passer du PEHD Ø25 au Ø32 ; j'aimerais que mon outil fasse la
         * même chose »*.
         *
         * **Ce sont des SEUILS, pas un verdict**, et c'est délibéré. Le calcul
         * sait aussi trancher sur une longueur donnée — mais cet écran ne
         * demande pas la longueur de l'amenée, et le calcul en prendrait une
         * par défaut. Un « il vous faut du Ø32 » tiré d'une longueur que
         * personne n'a saisie serait un chiffre inventé (`CLAUDE.md` §4). Le
         * seuil, lui, ne dépend d'aucune saisie : il se compare au mètre ruban
         * sur place.
         */
        tuyau: {
          /** Mètres de Ø25 admissibles. **Zéro quand le débit l'interdit** — l'eau y filerait trop vite, quelle que soit la longueur. */
          seuil25: number;
          seuil32: number;
          /** Le débit du réseau le plus gourmand : c'est lui qui dimensionne. */
          debit: number;
          /** Au-delà, même le Ø32 est en surrégime : Ø40, ou un réseau de plus. */
          insuffisantMemeEn32: boolean;
          /**
           * Qui plafonne un réseau : la source (le seau) ou le tuyau (Ø25).
           *
           * **Il faut le dire quand c'est le tuyau**, sinon un artisan qui a
           * mesuré 3 m³/h voit ses réseaux coupés plus tôt qu'il ne s'y attend
           * et croit à un défaut de calcul. C'est son Ø25, et il le lira.
           */
          limitePar: "source" | "tuyau";
          /** Ce qu'un réseau en Ø25 peut porter, en m³/h. */
          plafond: number;
        };
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
  // **Une portée réduite est une ESTIMATION, et elle se dit.** Le débit des
  // buses est ramené à la pression du chantier par la loi de l'orifice — de la
  // physique. La portée, elle, suit un exposant tiré des tables des
  // constructeurs et non de ses catalogues à lui : la taire ferait passer pour
  // acquis un chiffre qui ne l'est pas (`CLAUDE.md` §4).
  if (plan.porteeEstimee) {
    reserves.push(
      `${mesure.pression.toString().replace(".", ",")} bar : les portées sont réduites par rapport au ` +
        "catalogue, donné à plus forte pression — estimation, à confirmer sur place"
    );
  }
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
      tuyau: {
        seuil25: plan.amenee.longueurMax25,
        seuil32: plan.amenee.longueurMax32,
        debit: plan.amenee.debit,
        insuffisantMemeEn32: plan.amenee.insuffisantMemeEn32,
        // **Le calcul repris n'est pas typé** (`allowJs`, `checkJs` coupé) : il
        // rend une chaîne. On la RESSERRE ici plutôt que d'élargir le type de
        // l'écran — c'est la frontière, et c'est là qu'un « tuyeau » mal
        // orthographié doit tomber, pas trois écrans plus loin.
        limitePar: plan.limitePar === "tuyau" ? "tuyau" : "source",
        plafond: plan.limiteDuTuyau,
      },
    },
  };
}
