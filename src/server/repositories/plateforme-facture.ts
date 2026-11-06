import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import type { DbOrTx } from "../db/client";
import { factures, liaisonsPlateformes, transmissionsFactures } from "../db/schema";
import { chiffrer, dechiffrer } from "../agenda/secret-au-repos";
import { adressesDe, estUnePlateforme, PLATEFORMES, plateformesOffertes, type ClePlateforme } from "../plateformes/catalogue";
import {
  deposerLaFactureX,
  etatDuFlux,
  verifierLaLiaison,
  type AdressesPlateforme,
  type EtatDuFlux,
  type Identifiants,
  type Refus,
} from "../plateformes/api-commune";
import type { Ctx } from "./context";

/**
 * LA PLATEFORME DE FACTURE ÉLECTRONIQUE DE L'ENTREPRISE (migration 0169).
 *
 * **Sa décision du 26 septembre, puis ses choix du 5 novembre 2026**
 * (`ARCHITECTURE.md` §424 et §555) : chaque entreprise relie SON compte, une
 * fois ; à l'émission d'une facture d'entreprise, Atlas y dépose la Factur-X,
 * et rien ne part chez le client si la plateforme ne l'a pas prise (3 B).
 *
 * **Le secret ne sort d'ici qu'au moment de déposer**, déchiffré dans le
 * serveur. Aucune lecture rendue à un écran ne le porte, pas même chiffré.
 */

const DOMAINE = "plateforme-facture" as const;

export type LiaisonLue = {
  plateforme: ClePlateforme;
  nom: string;
  etat: "reliee" | "coupee";
  depuis: Date;
  coupeeLe: Date | null;
};

export async function liaisonPlateforme(ctx: Ctx): Promise<LiaisonLue | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [l] = await tx.select().from(liaisonsPlateformes).where(eq(liaisonsPlateformes.entrepriseId, ctx.entrepriseId)).limit(1);
    if (!l) return null;
    return { plateforme: l.plateforme, nom: PLATEFORMES[l.plateforme].nom, etat: l.etat, depuis: l.createdAt, coupeeLe: l.coupeeLe };
  });
}

export async function relierPlateforme(
  ctx: Ctx,
  saisie: { plateforme: string; identifiant: string; secret: string },
  recuperer: typeof fetch = fetch
): Promise<{ ok: true } | { ok: false; raison: string }> {
  if (!estUnePlateforme(saisie.plateforme) || !plateformesOffertes().includes(saisie.plateforme)) {
    return { ok: false, raison: "Cette plateforme ne se relie pas encore à Atlas." };
  }
  const secret = saisie.secret.trim();
  if (!secret) return { ok: false, raison: "Collez le secret de votre compte." };
  const ids: Identifiants = { identifiant: saisie.identifiant.trim() || null, secret };
  const cle = saisie.plateforme;
  const nom = PLATEFORMES[cle].nom;
  // **On vérifie AVANT d'enregistrer** : des identifiants faux enregistrés
  // bloqueraient sa prochaine facture d'entreprise (3 B), au pire moment.
  const essai = await verifierLaLiaison(nom, adressesDe(cle)!, ids, recuperer);
  // Sur l'écran même où il les tape, « remplacez-les dans Réglages » ne dit
  // rien : la phrase d'ici nomme seulement ce qui ne va pas.
  if (!essai.ok) return { ok: false, raison: essai.famille === "coupee" ? `${nom} refuse ces identifiants.` : essai.raison };
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const valeurs = {
      plateforme: cle,
      identifiant: ids.identifiant,
      secretChiffre: chiffrer(secret, DOMAINE),
      etat: "reliee" as const,
      coupeeLe: null,
      createdBy: ctx.utilisateurId,
      createdAt: new Date(),
    };
    await tx
      .insert(liaisonsPlateformes)
      .values({ entrepriseId: ctx.entrepriseId, ...valeurs })
      .onConflictDoUpdate({ target: liaisonsPlateformes.entrepriseId, set: valeurs });
  });
  return { ok: true };
}

export async function delierPlateforme(ctx: Ctx): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.delete(liaisonsPlateformes).where(eq(liaisonsPlateformes.entrepriseId, ctx.entrepriseId))
  );
}

/**
 * Ce qu'il faut pour déposer, lu DANS la transaction de l'émission.
 *
 * `null` : aucune plateforme reliée, la facture part comme avant. Une liaison
 * coupée, ou dont l'adresse n'est plus connue, se rend en refus : avec une
 * plateforme reliée, rien ne part sans elle (son choix 3 B).
 */
export async function plateformePourDeposer(
  tx: DbOrTx,
  entrepriseId: string
): Promise<null | Refus | { ok: true; cle: ClePlateforme; nom: string; adresses: AdressesPlateforme; ids: Identifiants }> {
  const [l] = await tx.select().from(liaisonsPlateformes).where(eq(liaisonsPlateformes.entrepriseId, entrepriseId)).limit(1);
  if (!l) return null;
  const nom = PLATEFORMES[l.plateforme].nom;
  if (l.etat === "coupee") {
    return { ok: false, famille: "coupee", raison: `${nom} refuse vos identifiants. Remplacez-les dans Réglages, Facture électronique.` };
  }
  const adresses = adressesDe(l.plateforme);
  const secret = dechiffrer(l.secretChiffre, DOMAINE);
  if (!adresses || secret === null) {
    // Un secret qui ne se déchiffre plus (la clé de l'espace a changé sans lui)
    // vaut des identifiants à remplacer : le dire, jamais déposer à l'aveugle.
    return { ok: false, famille: "coupee", raison: `La liaison à ${nom} est à refaire dans Réglages, Facture électronique.` };
  }
  return { ok: true, cle: l.plateforme, nom, adresses, ids: { identifiant: l.identifiant, secret } };
}

export async function deposerDansLaTransaction(
  tx: DbOrTx,
  entrepriseId: string,
  plateforme: { cle: ClePlateforme; nom: string; adresses: AdressesPlateforme; ids: Identifiants },
  facture: { id: string; numero: string; pdf: Uint8Array },
  recuperer: typeof fetch = fetch
): Promise<{ ok: true } | Refus> {
  const depot = await deposerLaFactureX(
    plateforme.nom,
    plateforme.adresses,
    plateforme.ids,
    { fichier: `facture-${facture.numero}.pdf`, pdf: facture.pdf, suivi: facture.id },
    recuperer
  );
  if (!depot.ok) return depot;
  await tx.insert(transmissionsFactures).values({
    entrepriseId,
    factureId: facture.id,
    plateforme: plateforme.cle,
    fluxId: depot.fluxId,
  });
  return { ok: true };
}

/** Ses identifiants ne valent plus : la liaison le porte jusqu'à ce qu'il les remplace. */
export async function marquerLaPlateformeCoupee(ctx: Ctx, maintenant: Date = new Date()): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .update(liaisonsPlateformes)
      .set({ etat: "coupee", coupeeLe: maintenant })
      .where(eq(liaisonsPlateformes.entrepriseId, ctx.entrepriseId))
  );
}

export type TransmissionLue = {
  factureId: string;
  chantierId: string;
  numero: string;
  client: string | null;
  totalTtc: string;
  deposeeLe: Date;
  etat: EtatDuFlux;
  raison: string | null;
};

/** Au plus autant de flux relus par ouverture de l'écran : la plateforme limite les appels. */
const RELUS_PAR_OUVERTURE = 10;

/**
 * Les factures déposées ces derniers jours, et leur état relu chez la
 * plateforme pour celles qui attendent encore son contrôle.
 *
 * **La relecture se fait hors transaction** : un appel réseau ne tient pas une
 * ligne verrouillée. Une plateforme muette laisse l'état tel qu'il était.
 */
export async function transmissionsRecentes(
  ctx: Ctx,
  maintenant: Date = new Date(),
  jours = 30,
  recuperer: typeof fetch = fetch
): Promise<TransmissionLue[]> {
  const depuis = new Date(maintenant.getTime() - jours * 24 * 3600 * 1000);
  const lire = () =>
    withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx
        .select({
          id: transmissionsFactures.id,
          factureId: transmissionsFactures.factureId,
          fluxId: transmissionsFactures.fluxId,
          etat: transmissionsFactures.etat,
          raison: transmissionsFactures.raison,
          deposeeLe: transmissionsFactures.deposeeLe,
          numero: factures.numeroCommercial,
          chantierId: factures.chantierId,
          client: factures.clientNom,
          totalTtc: factures.totalTtc,
        })
        .from(transmissionsFactures)
        .innerJoin(factures, eq(factures.id, transmissionsFactures.factureId))
        .where(and(eq(transmissionsFactures.entrepriseId, ctx.entrepriseId), gte(transmissionsFactures.deposeeLe, depuis)))
        .orderBy(desc(transmissionsFactures.deposeeLe))
    );
  const lignes = await lire();
  const enCours = lignes.filter((l) => l.etat === "en_cours").slice(0, RELUS_PAR_OUVERTURE);
  if (enCours.length) {
    const plateforme = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => plateformePourDeposer(tx, ctx.entrepriseId));
    if (plateforme && plateforme.ok) {
      const nouveaux: { id: string; etat: EtatDuFlux; raison: string | null }[] = [];
      for (const l of enCours) {
        const e = await etatDuFlux(plateforme.nom, plateforme.adresses, plateforme.ids, l.fluxId, recuperer);
        if (e.ok && e.etat !== "en_cours") nouveaux.push({ id: l.id, etat: e.etat, raison: e.raison });
      }
      if (nouveaux.length) {
        await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
          for (const n of nouveaux) {
            await tx
              .update(transmissionsFactures)
              .set({ etat: n.etat, raison: n.raison, lueLe: maintenant })
              .where(and(eq(transmissionsFactures.id, n.id), inArray(transmissionsFactures.etat, ["en_cours"])));
          }
        });
        for (const n of nouveaux) {
          const l = lignes.find((x) => x.id === n.id)!;
          l.etat = n.etat;
          l.raison = n.raison;
        }
      }
    }
  }
  return lignes.map((l) => ({
    factureId: l.factureId,
    chantierId: l.chantierId,
    numero: l.numero,
    client: l.client,
    totalTtc: l.totalTtc,
    deposeeLe: l.deposeeLe,
    etat: l.etat,
    raison: l.raison,
  }));
}
