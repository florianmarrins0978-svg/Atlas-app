import { nomAvecForme } from "@/lib/formes-juridiques";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { avoirs, envoisFactures, factures, chantiers } from "../db/schema";
import { enregistrerObjet, lireObjet } from "../storage";
import { empreinteDesReglements, tamponAcquittee } from "@/lib/acomptes-facture";
import { pdfExemplaireAcquitte } from "./factures";
import { lireReglements } from "./paiements-facture";
import { modalitesDeLaFacture, type ModalitesPaiement } from "@/lib/modalites-paiement";
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

/**
 * Le dernier lien émis pour cette facture, pour le retrouver sans en créer un
 * second.
 *
 * **Seulement les liens de la facture d'origine.** Un lien d'exemplaire
 * acquitté (migration 0141) sert un autre fichier : le reprendre ici ferait
 * partir la mention « acquittée » sur une facture qui ne l'est peut-être plus.
 */
export async function dernierEnvoiFacture(ctx: Ctx, factureId: string): Promise<EnvoiFacture | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select()
      .from(envoisFactures)
      .where(and(eq(envoisFactures.factureId, factureId), isNull(envoisFactures.pdfStorageKey)));
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

// ─── L'EXEMPLAIRE ACQUITTÉ — sa demande du 23 octobre 2026 ──────────────────
//
// *« Lorsque j'ai déjà envoyé la facture au client et que son assurance veut
// une facture acquittée, il faut pouvoir lui renvoyer la même facture avec la
// mention acquittée. Même numéro, tout pareil. »* (`appli/facture-acquittee.html`)
//
// Le lien d'origine sert le PDF archivé à l'émission, et c'est juste : le
// client garde ce qu'il a reçu. L'exemplaire acquitté part donc sur un lien à
// lui, qui porte son propre fichier archivé (`pdf_storage_key`).

export type RefusEnvoiAcquitte = { ok: false; raison: string };

/**
 * Le lien d'exemplaire acquitté qui vaut encore : pas expiré, et préparé sur
 * les MÊMES règlements. Un règlement corrigé ou retiré depuis ferait mentir le
 * fichier archivé sur les montants versés.
 */
async function envoiAcquitteQuiVaut(tx: DbOrTx, factureId: string, empreinte: string, maintenant: Date) {
  const [envoi] = await tx
    .select()
    .from(envoisFactures)
    .where(
      and(
        eq(envoisFactures.factureId, factureId),
        isNotNull(envoisFactures.pdfStorageKey),
        eq(envoisFactures.empreinteReglements, empreinte),
        gt(envoisFactures.expireAt, maintenant)
      )
    )
    .orderBy(desc(envoisFactures.envoyeAt))
    .limit(1);
  return envoi ?? null;
}

/** Le jeton du lien d'exemplaire acquitté qui vaut encore, ou rien. */
export async function jetonAcquitteVivant(
  ctx: Ctx,
  factureId: string,
  maintenant: Date = new Date()
): Promise<string | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const empreinte = empreinteDesReglements(await lireReglements(tx, factureId));
    return (await envoiAcquitteQuiVaut(tx, factureId, empreinte, maintenant))?.jeton ?? null;
  });
}

/**
 * Prépare le lien de l'exemplaire acquitté, ou reprend celui qui vaut encore.
 *
 * **Refuse une facture qui n'est pas entièrement réglée** : le tampon ne
 * s'imprime que si plus rien n'est dû (`tamponAcquittee`), et un exemplaire
 * sans tampon serait la facture d'origine sous un autre lien.
 */
export async function preparerEnvoiAcquitte(
  ctx: Ctx,
  factureId: string,
  canal: "sms" | "email",
  maintenant: Date = new Date()
): Promise<{ ok: true; jeton: string } | RefusEnvoiAcquitte> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx.select().from(factures).where(eq(factures.id, factureId)).limit(1);
    if (!f) return { ok: false as const, raison: "Cette facture est introuvable." };
    if (f.statut !== "emise") {
      return { ok: false as const, raison: "Cette facture n'est pas encore arrêtée." };
    }
    const reglements = await lireReglements(tx, factureId);
    const tampon = tamponAcquittee(f.totalTtc, reglements);
    if (!tampon) return { ok: false as const, raison: "Cette facture n'est pas entièrement réglée." };
    const empreinte = empreinteDesReglements(reglements);

    const existant = await envoiAcquitteQuiVaut(tx, factureId, empreinte, maintenant);
    if (existant) {
      // Le canal suit ce qui part vraiment, comme pour le lien d'origine.
      if (existant.canal !== canal) {
        await tx.update(envoisFactures).set({ canal }).where(eq(envoisFactures.id, existant.id));
      }
      return { ok: true as const, jeton: existant.jeton };
    }

    const octets = await pdfExemplaireAcquitte(tx, ctx.entrepriseId, f);
    const objet = await enregistrerObjet(`chantiers/${f.chantierId}/factures`, Buffer.from(octets), ".pdf");
    const acquitteeLe = reglements.map((g) => g.date).sort().at(-1)!;
    const [envoi] = await tx
      .insert(envoisFactures)
      .values({
        entrepriseId: ctx.entrepriseId,
        factureId,
        jeton: nouveauJeton(),
        canal,
        expireAt: new Date(maintenant.getTime() + VALIDITE_LIEN_JOURS * 86400_000),
        pdfStorageKey: objet.storageKey,
        acquitteeLe,
        empreinteReglements: empreinte,
      })
      .returning({ jeton: envoisFactures.jeton });
    return { ok: true as const, jeton: envoi.jeton };
  });
}

/**
 * Le jeton du dernier lien de cette facture, **s'il vit encore** — ou rien.
 *
 * Pour l'avoir, qui part avec le lien de sa facture : un lien périmé mis dans
 * le message mènerait le client sur « ce lien n'est plus valable ». Rien, et
 * l'écran en prépare un neuf à l'appui (`preparerLienFactureAction`).
 */
export async function jetonVivantDeLaFacture(ctx: Ctx, factureId: string, maintenant: Date = new Date()): Promise<string | null> {
  const dernier = await dernierEnvoiFacture(ctx, factureId);
  return dernier && dernier.expireAt.getTime() > maintenant.getTime() ? dernier.jeton : null;
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
    if (!f) return null;
    // Un lien d'exemplaire acquitté sert SON fichier (migration 0141), archivé
    // le jour où il a été préparé ; les autres, celui de l'émission.
    const storageKey = envoi.pdfStorageKey ?? f.pdfStorageKey;
    if (!storageKey) return null;
    return { storageKey, numero: f.numeroCommercial };
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
  /**
   * **Le total ne s'affiche plus sur la page — sa demande du 8 septembre 2026 :**
   * *« le montant ne doit pas apparaître, ça incitera le client à ouvrir sa
   * facture »*. Il reste rendu ici : c'est ce qui identifie la facture derrière
   * le jeton, et les suites base s'en servent pour prouver qu'un lien mène bien
   * à la bonne pièce — une assertion sur un libellé d'écran, elle, tomberait au
   * premier remaniement (`CLAUDE.md` §5 bis).
   */
  totalTtc: string;
  echeanceLe: string | null;
  /**
   * **La confirmation déjà donnée, s'il en a donné une** (9 septembre 2026).
   *
   * Le client rouvre son lien : il doit retrouver sa case cochée et sa date.
   * Sans cela, l'écran lui proposerait de confirmer une seconde fois quelque
   * chose que la base tient déjà pour fait — et il croirait que le premier
   * appui n'avait rien produit.
   */
  accuseLe: Date | null;
  /**
   * COMMENT LE CLIENT RÈGLE — l'IBAN, l'ordre du chèque, lus sur les colonnes
   * FIGÉES de la facture (`src/lib/modalites-paiement.ts`).
   *
   * **Ce sont exactement celles du PDF archivé**, par la même fonction : le
   * client a les deux pièces sous les yeux, et deux IBAN pour un même envoi
   * seraient pires que pas d'IBAN du tout.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * **L'ALLURE A DISPARU D'ICI, ET C'EST LUI QUI L'A DEMANDÉ.** Le 8 septembre
   * 2026, capture à l'appui : *« il faut le modifier, déjà mets-le aux couleurs
   * de l'appli »*. La page portait jusqu'ici l'allure figée de la facture, si
   * bien qu'un artisan ayant réglé un accent noir voyait une page noire.
   *
   * **Cela rouvre sa décision du 4 septembre**, et il faut le dire noir sur
   * blanc plutôt que de la laisser croire encore vraie : *« mon client doit
   * retrouver en ligne exactement ce qu'il a reçu en PDF »*. Il a vu la
   * proposition en crème et vert (`appli/la-page-de-sa-facture.html`) et a
   * répondu « code-moi ça ». La règle devient : **le PDF est son document et
   * garde son allure ; la page est l'enveloppe d'Atlas et porte les couleurs
   * d'Atlas.**
   */
  modalites: ModalitesPaiement;
  /**
   * **Les avoirs de cette facture** — sa question du 24 septembre 2026 :
   * l'avoir part par SMS ou e-mail comme la facture. Il part avec le lien de la
   * facture qu'il corrige, et le client le trouve ici, sous elle. Du plus
   * ancien au plus récent, dans l'ordre de leurs numéros.
   */
  avoirs: { id: string; numero: string; dateEmission: string }[];
  /**
   * **La date du tampon, quand ce lien porte l'exemplaire acquitté**
   * (migration 0141). La page le dit à la place de l'échéance et ne montre
   * plus « Pour régler » : demander de payer une facture payée ferait douter
   * le client, et son assureur avec lui.
   */
  acquitteeLe: string | null;
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
    const sesAvoirs = await tx
      .select({ id: avoirs.id, numero: avoirs.numero, dateEmission: avoirs.dateEmission })
      .from(avoirs)
      .where(eq(avoirs.factureId, f.id))
      .orderBy(avoirs.numero);
    return {
      numeroCommercial: f.numeroCommercial,
      // « … EI » pour un entrepreneur individuel (R526-27), comme sur le PDF.
      entrepriseNom: nomAvecForme(f.entrepriseNom, f.entrepriseFormeJuridique),
      totalTtc: f.totalTtc,
      echeanceLe: f.dateEcheance ?? null,
      accuseLe: envoi.accuseAt,
      // **Les mêmes trois colonnes que le PDF archivé, par la même fonction.**
      // Le client a les deux pièces sous les yeux : un IBAN groupé autrement, ou
      // un ordre de chèque calculé deux fois, finiraient par ne plus coïncider
      // (`src/lib/modalites-paiement.ts`).
      modalites: modalitesDeLaFacture(f),
      avoirs: sesAvoirs,
      acquitteeLe: envoi.acquitteeLe,
    };
  });
}

/**
 * Le PDF d'un avoir, ouvert par le client depuis le lien de SA facture.
 *
 * **L'avoir doit appartenir à la facture du jeton**, et la condition est dans
 * la requête, pas après : un lien de facture ne doit ouvrir aucun autre avoir de
 * la même entreprise, même si quelqu'un devine son identifiant. Comme pour la
 * facture, c'est le fichier ARCHIVÉ qui part, jamais un document refait.
 */
const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function pdfAvoirParJeton(
  jeton: string,
  avoirId: string,
  maintenant: Date = new Date()
): Promise<{ octets: Buffer; nom: string } | null> {
  // Un identifiant qui n'en est pas un ferait lever PostgreSQL (« invalid input
  // syntax for type uuid ») : le client verrait une erreur brute au lieu de la
  // page qui dit que le lien n'est plus valable.
  if (!jeton || !FORMAT_UUID.test(avoirId)) return null;

  const cle = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_envoi', ${jeton}, true)`);
    const [envoi] = await tx.select().from(envoisFactures).where(eq(envoisFactures.jeton, jeton)).limit(1);
    if (!envoi) return null;
    if (envoi.expireAt.getTime() <= maintenant.getTime()) return null;
    // Même contexte que `factureParJeton`, déduit du jeton et de lui seul.
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${envoi.entrepriseId}, true)`);
    const [a] = await tx
      .select({ storageKey: avoirs.pdfStorageKey, numero: avoirs.numero })
      .from(avoirs)
      .where(and(eq(avoirs.id, avoirId), eq(avoirs.factureId, envoi.factureId)))
      .limit(1);
    return a ?? null;
  });

  if (!cle) return null;
  try {
    return { octets: await lireObjet(cle.storageKey), nom: `avoir-${cle.numero}.pdf` };
  } catch (e) {
    // Même règle que la facture : un 404, jamais un avoir reconstruit. Mais
    // journalisé, pour qu'un fichier disparu ne reste pas une panne muette.
    console.error("[avoir] PDF introuvable au stockage", { avoirId, erreur: e });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LA RÉCEPTION — « ah ouais mais j'ai pas vu votre facture », 9 septembre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// Deux dates, et elles ne se valent pas :
//   · l'OUVERTURE, qu'Atlas note tout seul — celle qu'on oppose au client,
//     parce qu'elle ne dépend pas de sa bonne volonté ;
//   · l'ACCUSÉ, la case qu'il coche — plus parlant, et facultatif.
//
// La case NE CONDITIONNE RIEN : le patron l'a tranché le jour où il l'a
// proposée. « Ça ne l'empêche pas de télécharger la facture s'il ne coche
// pas ! » Une facture se donne.

/** Ce que le client dit de lui en écrivant — le même trio que la réponse au devis. */
export type EmpreinteClient = { adresseIp: string | null; agentUtilisateur: string | null };

/**
 * Note que le client a OUVERT sa facture. Sans lui rien demander.
 *
 * **Écrite une seule fois**, et c'est ce qui la rend citable : ce qu'on oppose
 * à « je ne l'ai jamais reçue », c'est la PREMIÈRE ouverture. Le garde
 * `IS NULL` rend aussi l'appel idempotent — un rendu qui se répète n'avance pas
 * la date, et l'on n'a donc pas à parier sur le nombre de fois qu'une page est
 * rendue.
 *
 * **Elle ne s'appelle PAS pendant le rendu du serveur, et c'est délibéré.**
 * Une messagerie qui déplie l'aperçu d'un lien, un antivirus qui le vérifie,
 * un robot d'indexation : tous ouvrent l'adresse sans qu'aucun client ne l'ait
 * lue. Une date née là serait fausse le jour précis où elle sert de preuve.
 * L'appel part donc du NAVIGATEUR, une fois la page affichée (`OuvertureNotee`)
 * — ces trois-là n'exécutent pas de JavaScript.
 */
export async function noterOuvertureDeLaFacture(
  jeton: string,
  empreinte: EmpreinteClient,
  maintenant: Date = new Date()
): Promise<void> {
  if (!jeton) return;

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_envoi', ${jeton}, true)`);
    await tx
      .update(envoisFactures)
      .set({
        ouverteAt: maintenant,
        adresseIp: empreinte.adresseIp,
        agentUtilisateur: empreinte.agentUtilisateur,
      })
      .where(
        and(
          eq(envoisFactures.jeton, jeton),
          isNull(envoisFactures.ouverteAt),
          // Un lien périmé ne s'ouvre plus : la page refuse déjà de s'afficher,
          // et une trace posée après l'expiration ne correspondrait à rien de
          // ce que le client a pu voir.
          sql`${envoisFactures.expireAt} > ${maintenant}`
        )
      );
  });
}

/**
 * Le client coche « J'ai bien reçu cette facture ».
 *
 * **Ne se décoche pas** : une confirmation retirée ne veut rien dire, et
 * laisserait croire qu'une trace s'efface. Le garde `IS NULL` le tient en base
 * plutôt qu'à l'écran — un second appel ne repousse pas la date.
 *
 * Pose aussi l'ouverture si elle manque : cocher, c'est avoir ouvert. Sans
 * cela, une facture confirmée pourrait s'afficher « pas encore ouverte », et
 * deux lignes qui se contredisent font douter des deux.
 */
export async function accuserReceptionDeLaFacture(
  jeton: string,
  empreinte: EmpreinteClient,
  maintenant: Date = new Date()
): Promise<{ ok: true; accuseLe: Date } | { ok: false; raison: string }> {
  if (!jeton) return { ok: false, raison: "Ce lien n'est plus valable." };

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_envoi', ${jeton}, true)`);

    const [envoi] = await tx
      .select()
      .from(envoisFactures)
      .where(eq(envoisFactures.jeton, jeton))
      .limit(1);
    if (!envoi) return { ok: false as const, raison: "Ce lien n'est plus valable." };
    if (envoi.expireAt.getTime() <= maintenant.getTime()) {
      return { ok: false as const, raison: "Ce lien n'est plus valable." };
    }
    // Déjà confirmée : on rend la PREMIÈRE date, celle qui est écrite. Rendre
    // « aujourd'hui » ferait afficher au client une date que la base ne porte
    // pas — deux vérités pour un même geste.
    if (envoi.accuseAt) return { ok: true as const, accuseLe: envoi.accuseAt };

    const [ecrit] = await tx
      .update(envoisFactures)
      .set({
        accuseAt: maintenant,
        ouverteAt: envoi.ouverteAt ?? maintenant,
        adresseIp: empreinte.adresseIp,
        agentUtilisateur: empreinte.agentUtilisateur,
      })
      .where(and(eq(envoisFactures.jeton, jeton), isNull(envoisFactures.accuseAt)))
      .returning();

    // Deux appuis au même instant : l'autre a gagné, et sa date fait foi.
    return { ok: true as const, accuseLe: ecrit?.accuseAt ?? maintenant };
  });
}

/** Les deux dates d'un envoi, telles qu'elles se lisent chez le patron. */
export type ReceptionDeFacture = {
  factureId: string;
  ouverteLe: Date | null;
  accuseLe: Date | null;
};

/**
 * Ce que les clients ont fait des factures qu'on leur a envoyées.
 *
 * **Le DERNIER envoi de chaque facture, et lui seul.** Une facture peut partir
 * deux fois — le premier lien expire, le client redemande. Mêler les deux
 * ferait afficher l'ouverture d'un lien mort à côté d'un lien vivant jamais
 * ouvert, c'est-à-dire une preuve pour une facture qui n'en a pas.
 */
export async function receptionsDesFactures(
  ctx: Ctx,
  factureIds: string[]
): Promise<Map<string, ReceptionDeFacture>> {
  if (factureIds.length === 0) return new Map();

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select()
      .from(envoisFactures)
      .where(inArray(envoisFactures.factureId, factureIds));

    // `envoyeAt` départage, jamais l'ordre rendu par la base : sans `ORDER BY`,
    // PostgreSQL n'en promet aucun, et le « dernier » changerait d'un
    // affichage à l'autre.
    const par = new Map<string, ReceptionDeFacture & { envoyeLe: Date }>();
    for (const l of lignes) {
      const deja = par.get(l.factureId);
      if (deja && deja.envoyeLe.getTime() >= l.envoyeAt.getTime()) continue;
      par.set(l.factureId, {
        factureId: l.factureId,
        ouverteLe: l.ouverteAt,
        accuseLe: l.accuseAt,
        envoyeLe: l.envoyeAt,
      });
    }
    return new Map(
      [...par].map(([id, r]) => [
        id,
        { factureId: r.factureId, ouverteLe: r.ouverteLe, accuseLe: r.accuseLe },
      ])
    );
  });
}

/** Une confirmation que le patron n'a pas encore acquittée — pour la carte de l'accueil. */
export type ReceptionASignaler = {
  envoiId: string;
  factureId: string;
  chantierId: string;
  numeroCommercial: string;
  clientNom: string | null;
  chantierNom: string;
  accuseLe: Date;
};

/**
 * Les réceptions confirmées dont le patron n'a pas encore dit « J'ai vu ».
 *
 * Une carte, pas un journal : ce qui est acquitté disparaît d'ici, et les deux
 * dates restent sur la facture. C'est exactement la coupure que sa question du
 * 9 septembre imposait — *« en cas de litige, où est-ce que l'utilisateur va
 * rechercher cette info ? »*
 */
export async function receptionsASignaler(ctx: Ctx): Promise<ReceptionASignaler[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({
        envoiId: envoisFactures.id,
        factureId: envoisFactures.factureId,
        accuseLe: envoisFactures.accuseAt,
        chantierId: factures.chantierId,
        numeroCommercial: factures.numeroCommercial,
        clientNom: factures.clientNom,
        chantierNom: chantiers.nom,
      })
      .from(envoisFactures)
      .innerJoin(factures, eq(factures.id, envoisFactures.factureId))
      .innerJoin(chantiers, eq(chantiers.id, factures.chantierId))
      .where(and(isNotNull(envoisFactures.accuseAt), isNull(envoisFactures.vuParPatronAt)));

    return lignes
      .filter((l): l is typeof l & { accuseLe: Date } => l.accuseLe !== null)
      .sort((a, b) => b.accuseLe.getTime() - a.accuseLe.getTime());
  });
}

/**
 * « J'ai vu » : la carte s'en va, la trace reste.
 *
 * Le même mot et le même geste que pour une réponse au devis
 * (`Notifications.tsx`) : nommer ce geste autrement ici ferait chercher une
 * différence là où il n'y en a pas.
 */
export async function marquerReceptionVue(
  ctx: Ctx,
  envoiId: string,
  maintenant: Date = new Date()
): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(envoisFactures)
      .set({ vuParPatronAt: maintenant })
      .where(and(eq(envoisFactures.id, envoiId), isNull(envoisFactures.vuParPatronAt)));
  });
}
