import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { envoisFactures, factures, chantiers } from "../db/schema";
import { lireObjet } from "../storage";
import type { Ctx } from "./context";

// **Transmettre la facture, puisque personne ne le fait à la place du patron.**
//
// Le 6 août 2026, il regarde sa facture arrêtée : « la facture s'affiche
// partie, mais le client ne la reçoit pas ». Rien ne la portait jusqu'à lui —
// l'écran disait « arrêtée », ce qui est vrai comptablement, et ne disait rien
// du reste. Aucun prestataire n'envoie de SMS ni d'e-mail (`docs/A-FAIRE.md`
// §5, tranché le 4 août) : la facture part de SA messagerie, et le lien qu'il
// colle dedans est celui que ce module fabrique.
//
// Volontairement plus simple qu'`envois-devis` : une facture ne se négocie pas.
// Ni dates proposées, ni réponse, ni acceptation à tracer.

/**
 * Trente jours pour régler, et le lien vit plus longtemps que le délai — mais
 * pas éternellement : un lien qui traîne dans un téléphone est une fuite qui
 * attend son heure.
 */
const VALIDITE_LIEN_JOURS = 60;

/** 256 bits d'aléa. Jamais dérivé d'un identifiant : sinon un seul lien rendrait les autres devinables. */
function nouveauJeton(): string {
  return randomBytes(32).toString("base64url");
}

export type EnvoiFacture = {
  id: string;
  jeton: string;
  canal: "sms" | "email";
  expireAt: Date;
  envoyeAt: Date;
};

/**
 * Prépare le lien que le patron transmettra lui-même.
 *
 * **Refuse une facture qui n'est pas arrêtée** : un brouillon peut encore
 * changer, et un client qui aurait reçu la version d'avant n'aurait aucun moyen
 * de le savoir. Refuse aussi une facture sans PDF archivé — le lien mènerait à
 * une page d'erreur, ce que le client interprète comme un piège.
 */
export async function creerEnvoiFacture(
  ctx: Ctx,
  factureId: string,
  canal: "sms" | "email",
  maintenant: Date = new Date()
): Promise<EnvoiFacture> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx.select().from(factures).where(eq(factures.id, factureId)).limit(1);
    if (!f) throw new Error("Facture introuvable");
    if (f.statut !== "emise") {
      throw new Error("Cette facture n'est pas encore arrêtée : rien ne doit partir avant.");
    }
    if (!f.pdfStorageKey) {
      throw new Error("Cette facture n'a pas de PDF archivé : le lien mènerait dans le vide.");
    }

    const [envoi] = await tx
      .insert(envoisFactures)
      .values({
        entrepriseId: ctx.entrepriseId,
        factureId,
        jeton: nouveauJeton(),
        canal,
        expireAt: new Date(maintenant.getTime() + VALIDITE_LIEN_JOURS * 86400_000),
      })
      .returning();

    // Le jalon du chantier suit ce qui est réellement parti, pas ce qui a été
    // arrêté : c'est la distinction que le patron avait relevée.
    await tx
      .update(chantiers)
      .set({ factureEnvoyeeAt: maintenant })
      .where(eq(chantiers.id, f.chantierId));

    return {
      id: envoi.id,
      jeton: envoi.jeton,
      canal: envoi.canal as "sms" | "email",
      expireAt: envoi.expireAt,
      envoyeAt: envoi.envoyeAt,
    };
  });
}

/** Le dernier lien émis pour cette facture, pour le retrouver sans en créer un second. */
export async function dernierEnvoiFacture(ctx: Ctx, factureId: string): Promise<EnvoiFacture | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx.select().from(envoisFactures).where(eq(envoisFactures.factureId, factureId));
    if (lignes.length === 0) return null;
    const dernier = lignes.sort((a, b) => b.envoyeAt.getTime() - a.envoyeAt.getTime())[0];
    return {
      id: dernier.id,
      jeton: dernier.jeton,
      canal: dernier.canal as "sms" | "email",
      expireAt: dernier.expireAt,
      envoyeAt: dernier.envoyeAt,
    };
  });
}

/**
 * Le PDF de la facture, ouvert par le client depuis son lien — sans compte.
 *
 * Sert le fichier ARCHIVÉ au moment de l'arrêt, jamais un document régénéré :
 * ce que le client garde doit être exactement ce qui lui a été transmis.
 */
export async function pdfFactureParJeton(
  jeton: string,
  maintenant: Date = new Date()
): Promise<{ octets: Buffer; nom: string } | null> {
  if (!jeton) return null;

  const cle = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_envoi', ${jeton}, true)`);
    const [envoi] = await tx.select().from(envoisFactures).where(eq(envoisFactures.jeton, jeton)).limit(1);
    if (!envoi) return null;
    if (envoi.expireAt.getTime() <= maintenant.getTime()) return null;

    const [f] = await tx.select().from(factures).where(eq(factures.id, envoi.factureId)).limit(1);
    if (!f?.pdfStorageKey) return null;
    return { storageKey: f.pdfStorageKey, numero: f.numeroCommercial };
  });

  if (!cle) return null;
  try {
    return { octets: await lireObjet(cle.storageKey), nom: `facture-${cle.numero}.pdf` };
  } catch {
    // Fichier disparu du stockage : un 404, jamais un document reconstruit qui
    // ne serait plus celui que le client a reçu.
    return null;
  }
}

/**
 * Ce que le client voit sur sa page, sans compte : de quoi reconnaître sa
 * facture et la télécharger. Rien de plus — ni coordonnées d'autres clients,
 * ni détail interne.
 */
export type FacturePourClient = {
  numeroCommercial: string;
  entrepriseNom: string;
  totalTtc: string;
  echeanceLe: string | null;
};

export async function factureParJeton(
  jeton: string,
  maintenant: Date = new Date()
): Promise<FacturePourClient | null> {
  if (!jeton) return null;

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_envoi', ${jeton}, true)`);
    const [envoi] = await tx.select().from(envoisFactures).where(eq(envoisFactures.jeton, jeton)).limit(1);
    if (!envoi) return null;
    if (envoi.expireAt.getTime() <= maintenant.getTime()) return null;

    const [f] = await tx.select().from(factures).where(eq(factures.id, envoi.factureId)).limit(1);
    if (!f) return null;
    return {
      numeroCommercial: f.numeroCommercial,
      entrepriseNom: f.entrepriseNom,
      totalTtc: f.totalTtc,
      echeanceLe: f.dateEcheance ?? null,
    };
  });
}
