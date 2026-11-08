import { and, eq, notInArray, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import type { DbOrTx } from "../db/client";
import {
  chantiers,
  clients,
  demandesUrssaf,
  devis,
  entreprises,
  factures,
  heuresDIntervention,
  inscriptionsUrssaf,
  liaisonsUrssaf,
  lignesFacture,
  paiementsFacture,
} from "../db/schema";
import { chiffrer, dechiffrer } from "../agenda/secret-au-repos";
import { clientUrssaf, type IdentifiantsUrssaf, type OptionsUrssaf } from "../urssaf/tiers-de-prestation";
import { adresseDecoupee } from "../adresses/base-adresse-nationale";
import { chercherCommuneDeNaissance } from "../adresses/communes";
import { logger } from "../logger";
import { noterPaiementDans } from "./paiements-facture";
import { jourIso } from "@/lib/jour";
import {
  demandePaiementPourUrssaf,
  etapeDeLaDemande,
  particulierPourUrssaf,
  type EtapeDemande,
  type FactureAtlas,
  type Manque,
} from "@/lib/urssaf/avance-immediate";
import {
  aRelire,
  codesSaisisLus,
  complementDesHeures,
  departementSaisi,
  ETAPES_FINALES,
  etapeValidee,
  etatDuParticulier,
  factureVersLUrssaf,
  jourDuVersement,
  lignesPourLUrssaf,
  manquesDeLaFeuille,
  naissanceDuCodeInsee,
  particulierDeLaSaisie,
  periodeDeLaFacture,
  phraseDuRefus,
  refusDeLaDateDeNaissance,
  rubriqueDuClient,
  sansAcompteAuDevis,
  type CodesUrssaf,
  type EtatInscription,
  type SaisieInscription,
} from "@/lib/urssaf/branchement";
import type { Ctx } from "./context";

/**
 * L'AVANCE IMMÉDIATE, BRANCHÉE (lot 3, migration 0180, `ARCHITECTURE.md` §577).
 *
 * La liaison de l'entreprise, l'inscription d'un client, la demande de
 * paiement d'une facture et sa relève. Les règles vivent dans
 * `@/lib/urssaf/` ; l'échange dans `../urssaf/tiers-de-prestation.ts`. Ici,
 * seulement ce qui parle à la base, toujours par `withEntreprise`.
 *
 * **Les deux codes ne sortent d'ici que déchiffrés dans le serveur**, au
 * moment d'appeler l'Urssaf. Aucune lecture rendue à un écran ne les porte,
 * pas même chiffrés ; le journal ne les voit jamais (l'échange s'y engage).
 *
 * **Une entreprise non déclarée ne lit jamais ces tables** : chaque écran
 * vérifie la déclaration avant d'appeler, pour qu'une base où 0180 manquerait
 * encore ne fasse tomber aucun écran (`.claude/rules/deployment-safety.md`).
 *
 * **Un appel réseau ne tient jamais une ligne verrouillée**, sauf un : la
 * demande de paiement part DANS la transaction qui arrête la facture, comme le
 * dépôt sur la plateforme de facture électronique (`emettreFacture`). Une
 * facture refusée par l'Urssaf reste un brouillon, numéro compris ; une
 * facture acceptée est chez elle ET arrêtée ici, jamais l'un sans l'autre.
 */

const DOMAINE = "urssaf" as const;

/** À l'ouverture d'un écran, l'Urssaf a ce temps pour répondre ; au-delà, l'écran se montre tel qu'il était. */
const DELAI_A_L_OUVERTURE_MS = 4_000;
/** Au plus autant de demandes relues par ouverture : l'Urssaf limite les appels. */
const RELUES_PAR_OUVERTURE = 20;

// ─── La liaison ──────────────────────────────────────────────────────────────

export type LiaisonUrssafLue = {
  relieeLe: Date;
  /** Les codes ne se déchiffrent plus (la clé de son espace a changé sans eux) : la liaison est à refaire. */
  aRefaire: boolean;
};

export async function liaisonUrssaf(ctx: Ctx): Promise<LiaisonUrssafLue | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [l] = await tx.select().from(liaisonsUrssaf).where(eq(liaisonsUrssaf.entrepriseId, ctx.entrepriseId)).limit(1);
    if (!l) return null;
    const lisible = dechiffrer(l.clientIdChiffre, DOMAINE) !== null && dechiffrer(l.clientSecretChiffre, DOMAINE) !== null;
    return { relieeLe: l.relieeLe, aRefaire: !lisible };
  });
}

/**
 * Relie l'Urssaf. **Les codes se vérifient AVANT de s'enregistrer** : de
 * mauvais codes gardés feraient échouer la première facture envoyée, chez le
 * client, au pire moment. Relier à nouveau remplace.
 */
export async function relierLUrssaf(
  ctx: Ctx,
  saisie: Partial<Record<keyof CodesUrssaf, unknown>>,
  options: OptionsUrssaf = {}
): Promise<{ ok: true } | { ok: false; raison: string }> {
  const lus = codesSaisisLus(saisie);
  if (!lus.ok) return lus;
  const declaree = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select({ declaree: entreprises.sapDeclaree }).from(entreprises).where(eq(entreprises.id, ctx.entrepriseId)).limit(1);
    return e?.declaree ?? false;
  });
  if (!declaree) return { ok: false, raison: "Déclarez d'abord votre entreprise aux services à la personne." };
  const { codes } = lus;
  const essai = await clientUrssaf({ clientId: codes.clientId, clientSecret: codes.clientSecret }, options).verifierCodes();
  if (!essai.ok) return { ok: false, raison: phraseDuRefus(essai) };
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const valeurs = {
      clientIdChiffre: chiffrer(codes.clientId, DOMAINE),
      clientSecretChiffre: chiffrer(codes.clientSecret, DOMAINE),
      idTiersFacturation: codes.idTiersFacturation,
      codeNature: codes.codeNature,
      relieeLe: new Date(),
      relieePar: ctx.utilisateurId,
    };
    await tx
      .insert(liaisonsUrssaf)
      .values({ entrepriseId: ctx.entrepriseId, ...valeurs })
      .onConflictDoUpdate({ target: liaisonsUrssaf.entrepriseId, set: valeurs });
  });
  return { ok: true };
}

/**
 * Délie l'Urssaf : les codes s'effacent. Les demandes déjà parties gardent
 * leur trace ; elles ne se relisent plus, faute de codes, jusqu'à ce qu'il
 * relie à nouveau.
 */
export async function delierLUrssaf(ctx: Ctx): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.delete(liaisonsUrssaf).where(eq(liaisonsUrssaf.entrepriseId, ctx.entrepriseId))
  );
}

type LiaisonPourEchanger = { ids: IdentifiantsUrssaf; idTiersFacturation: string; codeNature: string };

/** Les codes en clair, pour un appel, ou `null` : pas reliée, ou des codes qui ne se déchiffrent plus. */
async function liaisonPourEchanger(tx: DbOrTx, entrepriseId: string): Promise<LiaisonPourEchanger | null> {
  const [l] = await tx.select().from(liaisonsUrssaf).where(eq(liaisonsUrssaf.entrepriseId, entrepriseId)).limit(1);
  if (!l) return null;
  const clientId = dechiffrer(l.clientIdChiffre, DOMAINE);
  const clientSecret = dechiffrer(l.clientSecretChiffre, DOMAINE);
  if (clientId === null || clientSecret === null) return null;
  return { ids: { clientId, clientSecret }, idTiersFacturation: l.idTiersFacturation, codeNature: l.codeNature };
}

// ─── L'inscription d'un client ───────────────────────────────────────────────

export type InscriptionLue = { etat: EtatInscription; demandeeLe: string; etatLe: string };

function etatLu(etat: "en_attente" | "inscrit"): EtatInscription {
  return etat === "inscrit" ? "inscrit" : "en-attente";
}

export async function inscriptionDuClient(ctx: Ctx, clientId: string): Promise<InscriptionLue | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [i] = await tx.select().from(inscriptionsUrssaf).where(eq(inscriptionsUrssaf.clientId, clientId)).limit(1);
    if (!i) return null;
    return { etat: etatLu(i.etat), demandeeLe: jourIso(i.demandeeLe), etatLe: jourIso(i.etatLe) };
  });
}

export type ResultatInscription = { ok: true } | { ok: false; raison: string; manques?: Manque[] };

/**
 * Inscrit un client à l'Urssaf, depuis sa fiche.
 *
 * **Dans cet ordre** : la feuille relue par la règle de l'écran
 * (`manquesDeLaFeuille`) ; la commune de naissance cherchée par son nom chez
 * l'État ; l'adresse de la fiche découpée par la Base Adresse Nationale ; le
 * tout relu par la règle de l'envoi (`particulierPourUrssaf`) ; puis
 * l'Urssaf. Rien ne part tant qu'une case manque.
 *
 * **Ce qui se garde** : l'identifiant que l'Urssaf rend, la date de naissance
 * (chaque demande la porte) et l'état. **L'IBAN et le BIC ne se gardent pas** :
 * ils partent à l'Urssaf, qui y prélève sa moitié, et la table n'a même pas
 * de colonne pour eux.
 */
export async function inscrireLeClient(
  ctx: Ctx,
  clientId: string,
  saisie: SaisieInscription,
  options: { urssaf?: OptionsUrssaf; adresses?: { ban?: string; geo?: string } } = {},
  maintenant: Date = new Date()
): Promise<ResultatInscription> {
  const manquesFeuille = manquesDeLaFeuille(saisie);
  if (manquesFeuille.length) return { ok: false, raison: "Il manque des cases.", manques: manquesFeuille };
  const refusNaissance = refusDeLaDateDeNaissance(saisie.dateNaissance.trim(), jourIso(maintenant));
  if (refusNaissance) return { ok: false, raison: refusNaissance };

  const avant = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select({ declaree: entreprises.sapDeclaree }).from(entreprises).where(eq(entreprises.id, ctx.entrepriseId)).limit(1);
    const [c] = await tx.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    const liaison = e?.declaree ? await liaisonPourEchanger(tx, ctx.entrepriseId) : null;
    return { declaree: e?.declaree ?? false, client: c ?? null, liaison };
  });
  if (!avant.declaree) return { ok: false, raison: "Votre entreprise n'est pas déclarée aux services à la personne." };
  if (!avant.liaison) return { ok: false, raison: "Reliez d'abord l'Urssaf, dans Mon entreprise." };
  if (!avant.client || avant.client.deletedAt) return { ok: false, raison: "Ce client est introuvable." };
  // La règle de la rubrique, rejouée : une entreprise ou une mairie n'a pas de
  // crédit d'impôt, donc rien que l'Urssaf puisse lui avancer.
  if (!rubriqueDuClient({ declaree: true, reliee: true, clientNom: avant.client.nom, clientCivilite: avant.client.civilite })) {
    return { ok: false, raison: "Seul un client particulier s'inscrit à l'avance immédiate." };
  }
  const adresseDeLaFiche = avant.client.adresse?.trim() ?? "";
  if (!adresseDeLaFiche) return { ok: false, raison: "Sa fiche n'a pas d'adresse. Ajoutez-la dans ses coordonnées." };

  // La commune de naissance, par son nom, dans le département tapé.
  let communeNaissance: { departement: string; codeCommune: string; libelle: string } | null = null;
  if (saisie.neEnFrance) {
    const departement = departementSaisi(saisie.departementNaissance);
    if (!departement) return { ok: false, raison: "Ce département ne se lit pas." };
    const trouvee = await chercherCommuneDeNaissance(saisie.communeNaissance, departement, options.adresses?.geo);
    if (!trouvee.ok) return { ok: false, raison: "La liste des communes ne répond pas. Réessayez dans un instant." };
    const decoupe = trouvee.commune ? naissanceDuCodeInsee(trouvee.commune.code) : null;
    if (!trouvee.commune || !decoupe) return { ok: false, raison: "Cette commune ne se trouve pas dans ce département." };
    communeNaissance = { ...decoupe, libelle: trouvee.commune.nom };
  }
  const adresse = await adresseDecoupee(adresseDeLaFiche, options.adresses?.ban);
  if (!adresse) return { ok: false, raison: "L'adresse de sa fiche ne se trouve pas. Corrigez-la dans ses coordonnées." };

  const particulier = particulierPourUrssaf(particulierDeLaSaisie(saisie, { communeNaissance, adresse }));
  if (!particulier.ok) return { ok: false, raison: "Une case ne passe pas.", manques: particulier.manques };

  const reponse = await clientUrssaf(avant.liaison.ids, options.urssaf).inscrireParticulier(particulier.valeur);
  if (!reponse.ok) return { ok: false, raison: phraseDuRefus(reponse) };

  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const valeurs = {
      idClientUrssaf: reponse.idClient,
      dateNaissance: saisie.dateNaissance.trim(),
      etat: "en_attente" as const,
      etatLe: maintenant,
      demandeeLe: maintenant,
      lueLe: maintenant,
      inscritePar: ctx.utilisateurId,
    };
    await tx
      .insert(inscriptionsUrssaf)
      .values({ entrepriseId: ctx.entrepriseId, clientId, ...valeurs })
      .onConflictDoUpdate({ target: [inscriptionsUrssaf.entrepriseId, inscriptionsUrssaf.clientId], set: valeurs });
  });
  return { ok: true };
}

/**
 * Relit chez l'Urssaf l'état d'un client en attente, quand sa fiche s'ouvre :
 * au plus une fois par quelques minutes (`aRelire`), jamais pour un client
 * déjà inscrit. **Ne jette jamais** : une Urssaf muette laisse la fiche telle
 * qu'elle était, et l'écran s'ouvre quand même.
 */
export async function relireLInscription(
  ctx: Ctx,
  clientId: string,
  maintenant: Date = new Date(),
  options: OptionsUrssaf = {}
): Promise<void> {
  try {
    const a = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      const [i] = await tx.select().from(inscriptionsUrssaf).where(eq(inscriptionsUrssaf.clientId, clientId)).limit(1);
      if (!i || i.etat === "inscrit" || !aRelire(i.lueLe, maintenant)) return null;
      const liaison = await liaisonPourEchanger(tx, ctx.entrepriseId);
      return liaison ? { idClient: i.idClientUrssaf, liaison } : null;
    });
    if (!a) return;
    const r = await clientUrssaf(a.liaison.ids, { delaiMs: DELAI_A_L_OUVERTURE_MS, ...options }).statutParticulier(a.idClient);
    const etat = r.ok ? etatDuParticulier(r.statut) : "inconnu";
    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx
        .update(inscriptionsUrssaf)
        .set(etat === "inscrit" ? { etat: "inscrit", etatLe: maintenant, lueLe: maintenant } : { lueLe: maintenant })
        .where(and(eq(inscriptionsUrssaf.clientId, clientId), eq(inscriptionsUrssaf.etat, "en_attente")))
    );
  } catch (erreur) {
    logger.error("Inscription à l'Urssaf non relue", { erreur: erreur instanceof Error ? erreur.message : String(erreur) });
  }
}

/** L'inscription d'un client lue dans une transaction ouverte. */
async function inscriptionDans(tx: DbOrTx, clientId: string | null) {
  if (!clientId) return null;
  const [i] = await tx.select().from(inscriptionsUrssaf).where(eq(inscriptionsUrssaf.clientId, clientId)).limit(1);
  return i ?? null;
}

// ─── Le devis d'un client inscrit ────────────────────────────────────────────

/** Ce que le devis sait de l'avance immédiate : la liaison, et l'inscription de son client. */
export type UrssafDuDevis = {
  reliee: boolean;
  inscription: EtatInscription | null;
  coche: boolean;
  clientNom: string | null;
  clientCivilite: "mr" | "mme" | "entreprise" | "public" | null;
};

/**
 * L'avance immédiate vue du devis, ou `null` pour une entreprise non déclarée
 * (les tables du lot 3 ne se lisent alors pas). L'écran en tire, avec la case
 * qu'il tient, s'il montre l'acompte (`sansAcompteAuDevis`).
 */
export async function urssafDuDevis(ctx: Ctx, devisId: string): Promise<UrssafDuDevis | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select({ declaree: entreprises.sapDeclaree }).from(entreprises).where(eq(entreprises.id, ctx.entrepriseId)).limit(1);
    if (!e?.declaree) return null;
    const [d] = await tx
      .select({ coche: devis.servicesALaPersonne, clientNom: devis.clientNom, clientCivilite: devis.clientCivilite, chantierId: devis.chantierId })
      .from(devis)
      .where(eq(devis.id, devisId))
      .limit(1);
    if (!d) return null;
    const [c] = await tx.select({ clientId: chantiers.clientId }).from(chantiers).where(eq(chantiers.id, d.chantierId)).limit(1);
    const [l] = await tx.select({ id: liaisonsUrssaf.id }).from(liaisonsUrssaf).where(eq(liaisonsUrssaf.entrepriseId, ctx.entrepriseId)).limit(1);
    const i = await inscriptionDans(tx, c?.clientId ?? null);
    return { reliee: !!l, inscription: i ? etatLu(i.etat) : null, coche: d.coche, clientNom: d.clientNom, clientCivilite: d.clientCivilite };
  });
}

/**
 * Le devis d'un client inscrit perd son acompte (`sansAcompteAuDevis`), lu
 * sur la case ENREGISTRÉE : c'est l'action qui pose un acompte qui le
 * demande. L'écran cache le geste, le serveur le refuse, par la même règle.
 */
export async function devisSansAcompte(ctx: Ctx, devisId: string): Promise<boolean> {
  const u = await urssafDuDevis(ctx, devisId);
  return u !== null && sansAcompteAuDevis({ declaree: true, ...u });
}

// ─── La facture, devenue une demande ─────────────────────────────────────────

/**
 * La facture telle que la règle de l'envoi la lit (`demandePaiementPourUrssaf`),
 * bâtie UNE fois pour la vérification de l'écran et pour l'envoi : deux
 * constructions finiraient par ne plus décrire la même demande.
 */
async function factureAtlasDans(
  tx: DbOrTx,
  entrepriseId: string,
  facture: typeof factures.$inferSelect,
  liaison: { idTiersFacturation: string; codeNature: string },
  inscription: { idClientUrssaf: string; dateNaissance: string },
  dateFacture: string
): Promise<FactureAtlas> {
  const [e] = await tx.select({ numero: entreprises.sapNumero }).from(entreprises).where(eq(entreprises.id, entrepriseId)).limit(1);
  const lignes = await tx.select().from(lignesFacture).where(eq(lignesFacture.factureId, facture.id));
  const heures = await tx
    .select({ jour: heuresDIntervention.jour, minutes: heuresDIntervention.minutes })
    .from(heuresDIntervention)
    .where(eq(heuresDIntervention.chantierId, facture.chantierId));
  const [regle] = await tx
    .select({ total: sql<string>`COALESCE(SUM(${paiementsFacture.montant}), 0)` })
    .from(paiementsFacture)
    .where(eq(paiementsFacture.factureId, facture.id));
  const periode = periodeDeLaFacture(heures.map((h) => h.jour), facture.dateTravaux);
  return {
    idTiersFacturation: liaison.idTiersFacturation,
    numeroOrganisme: e?.numero ?? null,
    idClient: inscription.idClientUrssaf,
    dateNaissanceClient: inscription.dateNaissance,
    numero: facture.numeroCommercial,
    dateFacture,
    debutEmploi: periode.debut,
    finEmploi: periode.fin,
    lignes: lignesPourLUrssaf({
      lignes: lignes.map((l) => ({
        montant: l.montant,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        unite: l.unite,
        tauxTva: l.tauxTva,
        supplement: l.supplement,
      })),
      tauxTva: facture.tauxTva,
      reductionPourcent: facture.reductionPourcent,
      codeNature: liaison.codeNature,
      complement1: complementDesHeures(heures),
    }),
    dejaRegleCentimes: Math.round(Number(regle?.total ?? 0) * 100),
  };
}

export type DemandeLue = {
  etape: EtapeDemande;
  libelleUrssaf: string | null;
  envoyeeLe: string;
  valideeLe: string | null;
  etapeLe: string;
  versement: { montant: string; le: string } | null;
};

export type SituationUrssafDeLaFacture = {
  /** Reliée, client inscrit, case retenue : l'addition paraît, et l'envoi passe par l'Urssaf. */
  versLUrssaf: boolean;
  /** Ce que la règle de l'envoi refuse aujourd'hui (une facture par mois, déjà réglée…). Vide : elle peut partir. */
  manques: Manque[];
  /** La demande partie, et où elle en est. */
  demande: DemandeLue | null;
};

/**
 * Ce que l'écran de la facture montre de l'avance immédiate. `null` pour une
 * entreprise non déclarée : les tables du lot 3 ne se lisent alors pas.
 */
export async function situationUrssafDeLaFacture(
  ctx: Ctx,
  factureId: string,
  maintenant: Date = new Date()
): Promise<SituationUrssafDeLaFacture | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select({ declaree: entreprises.sapDeclaree }).from(entreprises).where(eq(entreprises.id, ctx.entrepriseId)).limit(1);
    if (!e?.declaree) return null;
    const [f] = await tx.select().from(factures).where(eq(factures.id, factureId)).limit(1);
    if (!f) return null;
    const [d] = await tx.select().from(demandesUrssaf).where(eq(demandesUrssaf.factureId, factureId)).limit(1);
    const demande: DemandeLue | null = d
      ? {
          etape: d.etape,
          libelleUrssaf: d.libelleUrssaf,
          envoyeeLe: jourIso(d.envoyeeLe),
          valideeLe: d.valideeLe,
          etapeLe: jourIso(d.etapeLe),
          versement: d.montantVerse && d.verseeLe ? { montant: d.montantVerse, le: d.verseeLe } : null,
        }
      : null;
    const [c] = await tx.select({ clientId: chantiers.clientId }).from(chantiers).where(eq(chantiers.id, f.chantierId)).limit(1);
    const i = await inscriptionDans(tx, c?.clientId ?? null);
    const [l] = await tx.select().from(liaisonsUrssaf).where(eq(liaisonsUrssaf.entrepriseId, ctx.entrepriseId)).limit(1);
    const versLUrssaf = factureVersLUrssaf({
      declaree: true,
      clientNom: f.clientNom,
      clientCivilite: f.clientCivilite,
      coche: f.servicesALaPersonne,
      reliee: !!l,
      inscription: i ? etatLu(i.etat) : null,
    });
    let manques: Manque[] = [];
    if (versLUrssaf && f.statut === "brouillon" && l && i) {
      const verdict = demandePaiementPourUrssaf(await factureAtlasDans(tx, ctx.entrepriseId, f, l, i, jourIso(maintenant)));
      if (!verdict.ok) manques = verdict.manques;
    }
    return { versLUrssaf, manques, demande };
  });
}

/**
 * Envoie la demande de paiement d'une facture, DANS la transaction qui
 * l'arrête (`emettreFacture`) : appelée après l'écriture de la facture émise,
 * elle relit tout (la case, l'inscription, la liaison, la règle) et ne croit
 * rien de l'écran. Un refus se rend en valeur ; l'appelant défait l'émission.
 */
export async function transmettreALUrssafDansLaTransaction(
  tx: DbOrTx,
  ctx: Ctx,
  factureId: string,
  maintenant: Date,
  options: OptionsUrssaf = {}
): Promise<{ ok: true } | { ok: false; raison: string }> {
  const [e] = await tx.select({ declaree: entreprises.sapDeclaree }).from(entreprises).where(eq(entreprises.id, ctx.entrepriseId)).limit(1);
  const [f] = await tx.select().from(factures).where(eq(factures.id, factureId)).limit(1);
  if (!f) return { ok: false, raison: "Cette facture est introuvable." };
  const [deja] = await tx.select({ id: demandesUrssaf.id }).from(demandesUrssaf).where(eq(demandesUrssaf.factureId, factureId)).limit(1);
  if (deja) return { ok: false, raison: "Cette facture est déjà partie à l'Urssaf." };
  const [c] = await tx.select({ clientId: chantiers.clientId }).from(chantiers).where(eq(chantiers.id, f.chantierId)).limit(1);
  const i = await inscriptionDans(tx, c?.clientId ?? null);
  const liaison = await liaisonPourEchanger(tx, ctx.entrepriseId);
  if (!liaison) return { ok: false, raison: "La liaison avec l'Urssaf est à refaire, dans Mon entreprise." };
  const voie = factureVersLUrssaf({
    declaree: e?.declaree ?? false,
    clientNom: f.clientNom,
    clientCivilite: f.clientCivilite,
    coche: f.servicesALaPersonne,
    reliee: true,
    inscription: i ? etatLu(i.etat) : null,
  });
  if (!voie || !i) return { ok: false, raison: "Ce client n'est pas inscrit à l'Urssaf, ou la case Services à la personne n'est pas cochée." };

  const verdict = demandePaiementPourUrssaf(await factureAtlasDans(tx, ctx.entrepriseId, f, liaison, i, f.dateEmission));
  if (!verdict.ok) return { ok: false, raison: verdict.manques.map((m) => m.libelle).join(". ") + "." };

  const r = await clientUrssaf(liaison.ids, options).transmettreDemande(verdict.valeur);
  if (!r.ok) return { ok: false, raison: phraseDuRefus(r) };
  const idDemande = r.demande.idDemandePaiement?.trim();
  if (!idDemande) {
    return { ok: false, raison: phraseDuRefus({ raison: "refuse", erreurs: r.demande.errors ?? [] }) };
  }
  await tx.insert(demandesUrssaf).values({
    entrepriseId: ctx.entrepriseId,
    factureId,
    idDemandePaiement: idDemande,
    etape: "integree",
    envoyeeLe: maintenant,
    etapeLe: maintenant,
    envoyeePar: ctx.utilisateurId,
  });
  return { ok: true };
}

// ─── La relève ───────────────────────────────────────────────────────────────

/**
 * Relit chez l'Urssaf où en sont les demandes encore en cours, à l'ouverture
 * de la facture et de Terminés : au plus une fois par quelques minutes
 * chacune, jamais celles qui ne changeront plus (`ETAPES_FINALES`).
 *
 * **Versée, la facture s'acquitte par le chemin ordinaire des règlements**
 * (`noterPaiementDans`), moyen « avance immédiate », montant de la facture,
 * daté du virement : c'est ce qui la fait entrer au relevé de TVA et sortir de
 * l'attente de paiement, comme n'importe quel règlement. La ligne de la
 * demande est verrouillée pendant ce temps, et `paiement_id` dit qu'il est
 * noté : deux ouvertures simultanées ne le notent jamais deux fois.
 *
 * **L'appel réseau se fait hors transaction**, et une Urssaf muette laisse
 * tout tel quel. **Ne jette jamais** : l'écran s'ouvre quoi qu'il arrive.
 */
export async function releverLesDemandes(
  ctx: Ctx,
  maintenant: Date = new Date(),
  options: { factureId?: string; urssaf?: OptionsUrssaf } = {}
): Promise<void> {
  try {
    const a = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      // Une entreprise non déclarée ne lit pas les tables du lot 3 : Terminés
      // s'ouvre sur une base où 0180 manquerait encore.
      const [e] = await tx.select({ declaree: entreprises.sapDeclaree }).from(entreprises).where(eq(entreprises.id, ctx.entrepriseId)).limit(1);
      if (!e?.declaree) return null;
      const enCours = await tx
        .select({ id: demandesUrssaf.id, idDemande: demandesUrssaf.idDemandePaiement, lueLe: demandesUrssaf.lueLe })
        .from(demandesUrssaf)
        .where(
          and(
            eq(demandesUrssaf.entrepriseId, ctx.entrepriseId),
            notInArray(demandesUrssaf.etape, [...ETAPES_FINALES]),
            ...(options.factureId ? [eq(demandesUrssaf.factureId, options.factureId)] : [])
          )
        );
      const aLire = enCours.filter((d) => aRelire(d.lueLe, maintenant)).slice(0, RELUES_PAR_OUVERTURE);
      if (!aLire.length) return null;
      const liaison = await liaisonPourEchanger(tx, ctx.entrepriseId);
      return liaison ? { aLire, liaison } : null;
    });
    if (!a) return;

    const r = await clientUrssaf(a.liaison.ids, { delaiMs: DELAI_A_L_OUVERTURE_MS, ...options.urssaf }).rechercherDemandes({
      idDemandePaiements: a.aLire.map((d) => d.idDemande),
    });
    if (!r.ok) {
      logger.error("Demandes de l'Urssaf non relues", { raison: r.raison });
      return;
    }
    const lues = new Map(r.demandes.filter((d) => d.idDemandePaiement).map((d) => [d.idDemandePaiement as string, d]));
    const aujourdHui = jourIso(maintenant);

    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      for (const { id, idDemande } of a.aLire) {
        const [d] = await tx.select().from(demandesUrssaf).where(eq(demandesUrssaf.id, id)).limit(1).for("update");
        if (!d) continue;
        const suivie = lues.get(idDemande);
        if (!suivie) {
          await tx.update(demandesUrssaf).set({ lueLe: maintenant }).where(eq(demandesUrssaf.id, id));
          continue;
        }
        const etape = etapeDeLaDemande(suivie.statut);
        const change = etape !== d.etape;
        const maj: Partial<typeof demandesUrssaf.$inferInsert> = {
          lueLe: maintenant,
          libelleUrssaf: suivie.statut?.libelle?.trim() || d.libelleUrssaf,
          ...(change ? { etape, etapeLe: maintenant } : {}),
          ...(etapeValidee(etape) && !d.valideeLe ? { valideeLe: aujourdHui } : {}),
        };
        if (etape === "versee" && !d.paiementId) {
          const [f] = await tx
            .select({ totalTtc: factures.totalTtc, dateEmission: factures.dateEmission })
            .from(factures)
            .where(eq(factures.id, d.factureId))
            .limit(1);
          if (f) {
            const le = jourDuVersement(suivie.infoVirement?.dateVirement, aujourdHui, f.dateEmission);
            const note = await noterPaiementDans(tx, ctx, d.factureId, { date: le, montant: f.totalTtc, moyen: "avance_immediate" });
            if (note.ok && note.paiementId) {
              Object.assign(maj, { paiementId: note.paiementId, montantVerse: f.totalTtc, verseeLe: le });
            } else {
              // Le versement est vu, le règlement refusé (un avoir fait entre-temps) :
              // la demande dit « versée », et il reste à le noter à la main.
              logger.error("Versement de l'Urssaf vu, règlement non noté", { raison: note.ok ? "sans identifiant" : note.raison });
              Object.assign(maj, { verseeLe: le });
            }
          }
        }
        await tx.update(demandesUrssaf).set(maj).where(eq(demandesUrssaf.id, id));
      }
    });
  } catch (erreur) {
    logger.error("Relève de l'Urssaf interrompue", { erreur: erreur instanceof Error ? erreur.message : String(erreur) });
  }
}
