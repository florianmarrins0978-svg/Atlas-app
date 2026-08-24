import { getFournisseurLLM } from "../providers/llm/fabrique";
import { lireConsigne, type Consigne, type ParametresPlan } from "@/lib/arrosage/consignes";
import { CATALOGUE } from "@/lib/arrosage/catalogue.js";

/**
 * DISCUTER LE PLAN — sa demande du 21 août 2026.
 *
 * *« J'ai besoin que si l'utilisateur a besoin de te demander de faire une
 * modification, qu'il puisse le faire. Donc il faut qu'il y ait une petite
 * interface pour qu'il puisse discuter avec toi. »*
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **ATLAS NE DESSINE PAS LE PLAN. IL POSE UN PARAMÈTRE.**
 *
 * C'est la phrase de la maquette qu'il a validée, et c'est toute
 * l'architecture. Le modèle ne rend jamais un tracé, jamais un métré, jamais
 * une liste de pièces — il rend **une réponse en français** et, s'il y a lieu,
 * **une consigne** prise dans une liste fermée (`consignes.ts`). C'est le
 * calcul qui refait le plan ensuite, comme il l'aurait fait d'un croquis.
 *
 * **Pourquoi cette borne tient tout.** Un plan retouché à la main ne se
 * recalcule plus : la fois d'après, le tracé, les métrés et les pièces ne
 * viennent plus de la même source, et deux d'entre eux finissent par se
 * contredire (`CLAUDE.md` §3). En passant par les paramètres, ce qui s'affiche
 * reste issu du même calcul — y compris ce que sa demande casse ailleurs.
 *
 * **Les chiffres ne viennent JAMAIS du modèle** (`CLAUDE.md` §4). Il a le droit
 * de citer ceux qu'on lui donne — ils sortent du calcul et du catalogue — et
 * rien d'autre. C'est la leçon du 21 août : laissé libre, il a inventé
 * « 5004 buse 3.0, portée 6 m », qui n'existe pas, et tout le maillage en
 * dépendait.
 */

/** Un tour de la conversation, tel que l'écran le garde. */
export type Tour = { role: "lui" | "atlas"; texte: string };

export type ReponseDiscussion = {
  /** Ce qu'Atlas répond, en français. */
  texte: string;
  /** Les chiffres derrière la réponse, ou rien. Ils viennent du calcul. */
  chiffres: string | null;
  /** La modification à poser sur le calcul, ou rien quand il ne fait qu'expliquer. */
  consigne: Consigne | null;
};

export type ResultatDiscussion =
  | { ok: true; reponse: ReponseDiscussion }
  | { ok: false; raison: string };

/**
 * Ce que le modèle a le droit de savoir : l'état du plan, en clair.
 *
 * **On lui donne les chiffres pour qu'il n'ait pas à les inventer.** Un modèle
 * à qui l'on demande « pourquoi deux réseaux ? » sans lui dire le débit
 * disponible répondra quand même — avec un nombre plausible.
 */
export function etatDuPlanEnClair(
  parametres: ParametresPlan,
  plan: {
    debitDisponible: number;
    limite: number;
    secteurs: { nom: string; debit: number }[];
    dessin: { id: number; nom: string; cle: string; modele: string | null; buse: string | null; portee: number; points: unknown[] }[];
  }
): string {
  const lignes: string[] = [];
  lignes.push(`Débit disponible : ${plan.debitDisponible.toFixed(2)} m³/h. Une voie porte au plus ${plan.limite.toFixed(2)} m³/h.`);
  lignes.push(`Réseaux actuels : ${plan.secteurs.length}.`);
  for (const s of plan.secteurs) lignes.push(`  - ${s.nom} : ${s.debit.toFixed(2)} m³/h`);
  lignes.push("Zones :");
  for (const z of plan.dessin) {
    const impose = parametres.zones.find((x) => x.id === z.id);
    lignes.push(
      `  - zone ${z.id} « ${z.nom} » : ${z.points.length} × ${z.modele ?? "?"} ${z.buse ?? ""} ` +
        `(portée ${z.portee} m)${impose?.materiel ? ` — matériel imposé : ${impose.materiel}` : ""}` +
        `${impose?.buse ? ` — buse imposée : ${impose.buse}` : ""}`
    );
  }
  lignes.push(`Marque : ${parametres.marque ?? "Rain Bird (défaut)"}.`);
  return lignes.join("\n");
}

/** Les buses du catalogue, pour que le modèle n'en invente aucune. */
function busesEnClair(): string {
  return CATALOGUE.buses
    .filter((b) => (b as { source?: string }).source === "patron")
    .map((b) => {
      const x = b as unknown as {
        ref: string; nom: string; marqueCle: string; pourType: string;
        rayon: number; debit: Record<string, number>;
      };
      return `${x.ref} · ${x.nom} · ${x.marqueCle} · ${x.pourType} · portée ${x.rayon} m · ${x.debit[360]} m³/h à 360°`;
    })
    .join("\n");
}

const SYSTEME = `Tu es Atlas, l'outil de plans d'arrosage d'un paysagiste français. Il te parle de SON plan, déjà calculé, et te demande une modification ou une explication.

TU NE DESSINES JAMAIS LE PLAN. Tu ne rends ni tracé, ni métré, ni liste de pièces, ni nombre de réseaux : tu poses au plus UNE consigne, et c'est le calcul qui refait tout.

Tu réponds UNIQUEMENT par un objet JSON, sans phrase avant ni après, sans balises de code :
{"texte":string,"chiffres":string|null,"consigne":{"quoi":"marque|corps|materiel|buse|sonde","zone":number|null,"valeur":string|boolean}|null}

Les seules consignes possibles :
- {"quoi":"marque","valeur":"rainbird|toro|hunter"}
- {"quoi":"corps","valeur":"<référence de corps du catalogue>"}
- {"quoi":"materiel","zone":<numéro>,"valeur":"turbine|tuyere|auto"}
- {"quoi":"buse","zone":<numéro>,"valeur":"<référence de buse du catalogue>"}
- {"quoi":"sonde","valeur":true|false}

Règles :
- N'INVENTE AUCUN CHIFFRE. Tu ne cites que les valeurs de l'état du plan et du catalogue qui te sont donnés. Si tu n'as pas un chiffre, tu ne le donnes pas.
- N'INVENTE AUCUNE RÉFÉRENCE. Une buse ou un corps hors catalogue sera refusé, et il perdra son temps.
- S'il pose une QUESTION sans demander de changement, rends "consigne":null et explique.
- S'il demande quelque chose que tu déconseilles, POSE quand même la consigne s'il l'a clairement demandée, et dis la réserve dans "texte". C'est lui qui décide sur son chantier.
- S'il demande quelque chose qui sort de cette liste (déplacer la nourrice, changer un métré, imposer un nombre de réseaux), rends "consigne":null et dis-lui ce qu'il faut faire à la place : corriger le croquis et le renvoyer.
- "chiffres" est une ligne courte de valeurs à l'appui, ou null. Jamais de phrase.
- Tu écris en français, à la deuxième personne, sans jargon. Deux ou trois phrases.`;

/**
 * Lire ce que le modèle a rendu — ou refuser.
 *
 * **Pure, donc éprouvable sans clé et sans réseau** (`test-discussion-plan.ts`).
 * C'est là que vivent les pièges : un modèle qui répond en prose, qui pose une
 * consigne hors catalogue, ou qui rend un texte vide en croyant avoir répondu.
 */
export function lireReponseDiscussion(texte: string, parametres: ParametresPlan): ResultatDiscussion {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut === -1 || fin <= debut) return { ok: false, raison: "La réponse n’a rien rendu d’exploitable." };

  let brut: Record<string, unknown>;
  try {
    brut = JSON.parse(texte.slice(debut, fin + 1)) as Record<string, unknown>;
  } catch {
    return { ok: false, raison: "La réponse n’a rien rendu d’exploitable." };
  }

  const propos = typeof brut.texte === "string" ? brut.texte.trim() : "";
  if (propos === "") return { ok: false, raison: "La réponse est arrivée vide." };

  const chiffres = typeof brut.chiffres === "string" && brut.chiffres.trim() !== "" ? brut.chiffres.trim() : null;

  if (brut.consigne === null || brut.consigne === undefined) {
    return { ok: true, reponse: { texte: propos, chiffres, consigne: null } };
  }

  const lue = lireConsigne(brut.consigne, parametres);
  if (!lue.ok) {
    // **Le refus ne remplace pas sa réponse : il s'y ajoute.** Ce que le modèle
    // a expliqué reste utile ; ce qui est faux, c'est la modification. Jeter
    // les deux lui ferait relire une question à laquelle on avait répondu.
    return {
      ok: true,
      reponse: {
        texte: `${propos}\n\n(La modification n’a pas été appliquée : ${lue.raison}.)`,
        chiffres,
        consigne: null,
      },
    };
  }
  return { ok: true, reponse: { texte: propos, chiffres, consigne: lue.consigne } };
}

/** Poser une demande, et rendre la réponse d'Atlas. */
export async function discuterLePlan(
  demande: string,
  parametres: ParametresPlan,
  etatEnClair: string,
  historique: Tour[]
): Promise<ResultatDiscussion> {
  const fournisseur = getFournisseurLLM();
  if (!fournisseur.genererTexte) return { ok: false, raison: "La discussion n’est pas disponible ici." };

  const conversation = historique
    .slice(-8)
    .map((t) => `${t.role === "lui" ? "Lui" : "Atlas"} : ${t.texte}`)
    .join("\n");

  const consigne =
    `ÉTAT DU PLAN\n${etatEnClair}\n\n` +
    `BUSES DU CATALOGUE\n${busesEnClair()}\n\n` +
    (conversation ? `CONVERSATION\n${conversation}\n\n` : "") +
    `SA DEMANDE\n${demande}`;

  const r = await fournisseur.genererTexte(SYSTEME, consigne);
  if (!r.succes) return { ok: false, raison: r.erreur.message };
  return lireReponseDiscussion(r.texte, parametres);
}
