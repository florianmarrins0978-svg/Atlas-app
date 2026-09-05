import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { envoisFactures, factures, chantiers } from "../db/schema";
import { lireObjet } from "../storage";
import { allureSeuleDesDocuments } from "./entreprises";
import { allureDepuisColonnes, type Allure } from "@/lib/allure-documents";
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

/**
 * Corrige le canal d'un lien déjà émis.
 *
 * Le patron choisit SMS ou e-mail **au moment d'envoyer**, et il change d'avis
 * après avoir préparé le lien — c'est même le cas courant : il prépare, voit
 * que le client n'a pas de portable, bascule sur l'e-mail. Fabriquer un second
 * envoi serait le pire des deux mondes (deux adresses pour une même facture,
 * et lui ne saurait plus laquelle il a transmise) ; laisser le registre dire
 * « SMS » alors que la facture est partie par courriel serait un mensonge
 * tranquille, celui qu'on découvre six mois plus tard en cherchant une preuve
 * d'envoi. On garde donc le jeton, et on corrige ce que le registre affirme.
 */
export async function corrigerCanalEnvoiFacture(
  ctx: Ctx,
  envoiId: string,
  canal: "sms" | "email"
): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.update(envoisFactures).set({ canal }).where(eq(envoisFactures.id, envoiId));
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

    // Voir `factureParJeton` : sans ce contexte, la lecture de `factures` ne
    // rend rien sous le rôle applicatif, et le client reçoit un 303 vers « ce
    // lien n'est plus valable » au lieu de son PDF.
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${envoi.entrepriseId}, true)`);

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
  /**
   * L'allure de SES documents — typographie, fond, accent —, **FIGÉE au moment
   * de l'envoi** (migration 0074).
   *
   * **Sa décision du 4 septembre 2026 :** *« une facture partie ne change plus
   * d'aspect : mon client doit retrouver en ligne exactement ce qu'il a reçu en
   * PDF, y compris six mois plus tard. Un changement de réglage ne rattrape pas
   * les anciennes, c'est voulu. »* C'est la même règle que les montants,
   * l'identité (0039) et les mentions légales (0072) : l'aspect était le dernier
   * à ne pas l'être.
   *
   * **Ce n'est PAS sa charte d'écran**, et les deux ne doivent jamais se
   * confondre : une facture ne part pas en noir chez le client parce qu'il a
   * choisi « Nuit » (`layout.tsx`, `estPageDuClient`).
   *
   * **`null` rend la page d'aujourd'hui, au pixel près** — soit qu'il n'avait
   * rien réglé (l'écran le reconnaît par `estLAllureParDefaut`), soit que la
   * facture soit antérieure à 0074 et retombe alors sur l'allure vivante de
   * l'entreprise.
   */
  allure: Allure | null;
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

    // **Le contexte d'entreprise, DÉDUIT DU JETON — jamais d'une entrée du
    // client.** Sans cette ligne, la lecture de `factures` ne rend rien sous le
    // rôle applicatif : `envois_factures` a bien une politique par jeton,
    // `factures` n'en a pas et reste protégée par l'isolation d'entreprise. Le
    // client lisait donc « ce lien n'est plus valable » sur une facture
    // parfaitement valide — toute la branche « envoi de la facture » était
    // morte en production.
    //
    // Ce n'est pas un affaiblissement de la RLS (`CLAUDE.md` §4) : l'entreprise
    // vient de l'envoi retrouvé par un jeton secret, exactement comme le fait
    // déjà `lireParJeton` pour le devis (`envois-devis.ts`).
    //
    // **Pourquoi personne ne l'avait vu :** les suites navigateur démarrent
    // leur serveur sous un rôle qui TRAVERSE la RLS, parce qu'elles inspectent
    // la base. Elles ne peuvent donc pas, par construction, voir un défaut
    // d'isolation. Tout chemin public par jeton doit être éprouvé par une suite
    // base, sous le rôle applicatif — c'est ce que fait désormais
    // `test-facture-jeton-rls.ts`.
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${envoi.entrepriseId}, true)`);

    const [f] = await tx.select().from(factures).where(eq(factures.id, envoi.factureId)).limit(1);
    if (!f) return null;
    return {
      numeroCommercial: f.numeroCommercial,
      entrepriseNom: f.entrepriseNom,
      totalTtc: f.totalTtc,
      echeanceLe: f.dateEcheance ?? null,
      // **L'allure FIGÉE de cette facture-là**, celle qui a servi à composer le
      // PDF archivé : la page et le papier montrent donc la même chose, quoi
      // qu'il règle ensuite (migration 0074).
      //
      // **Le repli porte l'historique, et rien d'autre.** Les trois colonnes
      // nulles ensemble ne veulent pas dire « aucune allure » — cela s'écrit en
      // clair depuis 0074 — mais « facture antérieure à la migration, son aspect
      // n'a jamais été relevé ». On rend alors ce que la page rendait avant ce
      // lot : l'allure vivante de l'entreprise, lue par le jeton et jamais par
      // une entrée du client.
      allure:
        allureDepuisColonnes({
          typographie: f.docTypographie,
          fond: f.docFond,
          accent: f.docAccent,
        }) ?? (await allureSeuleDesDocuments(tx, envoi.entrepriseId)),
    };
  });
}
