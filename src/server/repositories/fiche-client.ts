import { and, eq, inArray, isNull } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, clients, factures, lignesPrix, paiementsFacture } from "../db/schema";
import type { Ctx } from "./context";
import { composerFicheClient, type FicheClient } from "@/lib/fiche-client";
import { resteDu, type FacturePourTva } from "@/lib/exigibilite-tva";

/**
 * Tout ce que l'application sait d'un client, en une lecture.
 *
 * *Arrangement B de `docs/maquettes/66-ce-que-je-sais-du-client.html`, retenu
 * par le patron le 16 août 2026.*
 *
 * **Ce fichier ne calcule rien** : il lit, et passe à `composerFicheClient`
 * (`src/lib/fiche-client.ts`), qui est éprouvé sans base. La séparation n'est
 * pas décorative — les totaux d'un client sont de l'argent qu'il lira sur un
 * téléphone avant de rappeler quelqu'un, et une règle testable vaut mieux
 * qu'une requête qu'on relit.
 *
 * **Rien ne sort de `withEntreprise`.** C'est ce qui pose l'isolation : une
 * requête hors de ce cadre ne rendrait rien, silencieusement (`CLAUDE.md` §3).
 * Ici l'enjeu est direct — la fiche porte le chiffre d'affaires d'un client.
 */
export type FicheClientComplete = FicheClient & {
  client: { id: string; nom: string; adresse: string | null; telephone: string | null; email: string | null };
};

export async function chargerFicheClient(ctx: Ctx, clientId: string): Promise<FicheClientComplete | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [client] = await tx.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) return null;

    // **Les chantiers supprimés ne comptent pas.** Un chantier retiré par le
    // patron n'a plus à peser dans ce qu'un client lui a rapporté — il l'a
    // retiré précisément pour qu'il disparaisse.
    const sesChantiers = await tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        datePlanifiee: chantiers.datePlanifiee,
        creeLe: chantiers.createdAt,
      })
      .from(chantiers)
      .where(and(eq(chantiers.clientId, clientId), isNull(chantiers.deletedAt)));

    if (sesChantiers.length === 0) {
      return {
        ...composerFicheClient([], []),
        client: {
          id: client.id,
          nom: client.nom,
          adresse: client.adresse,
          telephone: client.telephone,
          email: client.email,
        },
      };
    }

    const ids = sesChantiers.map((c) => c.id);

    // **Seules les factures ÉMISES comptent.** Un brouillon n'a pas été envoyé :
    // le compter dans « facturé » annoncerait de l'argent que le client ne sait
    // pas encore devoir.
    const [sesFactures, sesLignes] = await Promise.all([
      tx
        .select({
          id: factures.id,
          chantierId: factures.chantierId,
          dateEmission: factures.dateEmission,
          totalHt: factures.totalHt,
          totalTva: factures.totalTva,
          totalTtc: factures.totalTtc,
        })
        .from(factures)
        .where(and(inArray(factures.chantierId, ids), eq(factures.statut, "emise"))),
      tx
        .select({ chantierId: lignesPrix.chantierId, libelle: lignesPrix.libelle, montant: lignesPrix.montant })
        .from(lignesPrix)
        .where(inArray(lignesPrix.chantierId, ids)),
    ]);

    const paiements = sesFactures.length
      ? await tx
          .select()
          .from(paiementsFacture)
          .where(
            inArray(
              paiementsFacture.factureId,
              sesFactures.map((f) => f.id)
            )
          )
      : [];

    const parFacture = new Map<string, { date: string; montant: string }[]>();
    for (const p of paiements) {
      const liste = parFacture.get(p.factureId) ?? [];
      liste.push({ date: p.datePaiement, montant: p.montant });
      parFacture.set(p.factureId, liste);
    }

    const factureParChantier = new Map<string, { totalTtc: string; reste: string; jour: string }>();
    for (const f of sesFactures) {
      // **`resteDu` et non une soustraction écrite ici.** C'est la règle qui
      // sert déjà à l'écran des paiements et au relevé de TVA ; deux calculs du
      // même reste finiraient par se contredire, et c'est le client qui verrait
      // la différence.
      factureParChantier.set(f.chantierId, {
        totalTtc: f.totalTtc,
        reste: resteDu(f as FacturePourTva, parFacture.get(f.id) ?? []),
        jour: f.dateEmission,
      });
    }

    const composables = sesChantiers.map((c) => {
      const f = factureParChantier.get(c.id);
      return {
        id: c.id,
        nom: c.nom,
        // Le jour de la facture s'il y en a une, sinon la date posée, sinon la
        // création : on veut ranger du plus récent, pas laisser des trous.
        jour: f?.jour ?? c.datePlanifiee ?? c.creeLe.toISOString().slice(0, 10),
        totalTtc: f?.totalTtc ?? null,
        reste: f?.reste ?? null,
      };
    });

    return {
      ...composerFicheClient(composables, sesLignes),
      client: {
        id: client.id,
        nom: client.nom,
        adresse: client.adresse,
        telephone: client.telephone,
        email: client.email,
      },
    };
  });
}

/** Ce que la liste des clients montre de chacun : son nom, et deux chiffres. */
export type ClientEnListe = {
  id: string;
  nom: string;
  chantiers: number;
  /** `null` : rien n'a encore été facturé — ce n'est pas « zéro euro ». */
  facture: string | null;
  /** Ce qui reste dû. `null` quand rien n'est facturé. */
  du: string | null;
  /** Le jour du chantier le plus récent : c'est l'ordre de la liste. */
  dernierJour: string | null;
};

/**
 * Tous ses clients, du plus récent au plus ancien.
 *
 * **Sa remarque du 17 août 2026 au soir :** *« la catégorie client n'a pas été
 * créée »*. La fiche d'un client existait depuis la veille — mais **seulement
 * atteinte depuis un chantier** (arrangement B de la planche 66). Il n'y avait
 * donc aucun endroit d'où voir SES clients, ni chercher celui qu'on a en tête
 * sans se rappeler pour quel chantier on l'avait noté.
 *
 * **En quatre requêtes, pas en une par client.** Charger la fiche complète de
 * chaque client à tour de rôle donnerait cinq requêtes par ligne : sur un
 * téléphone, la liste s'ouvrirait d'autant plus lentement qu'il a de clients —
 * exactement l'inverse de ce qu'on veut d'un écran d'accueil.
 *
 * **Et le calcul reste celui de la fiche** (`composerFicheClient`) : deux façons
 * d'additionner ce qu'un client doit finiraient par se contredire, et c'est LUI
 * qui verrait la différence, d'un écran à l'autre.
 */
export async function listerFichesClients(ctx: Ctx): Promise<ClientEnListe[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [sesClients, sesChantiers] = await Promise.all([
      tx
        .select({ id: clients.id, nom: clients.nom })
        .from(clients)
        .where(eq(clients.entrepriseId, ctx.entrepriseId)),
      tx
        .select({
          id: chantiers.id,
          clientId: chantiers.clientId,
          nom: chantiers.nom,
          datePlanifiee: chantiers.datePlanifiee,
          creeLe: chantiers.createdAt,
        })
        .from(chantiers)
        .where(and(eq(chantiers.entrepriseId, ctx.entrepriseId), isNull(chantiers.deletedAt))),
    ]);

    if (sesClients.length === 0) return [];

    const ids = sesChantiers.map((c) => c.id);
    const [sesFactures, sesLignes] = ids.length
      ? await Promise.all([
          tx
            .select({
              id: factures.id,
              chantierId: factures.chantierId,
              dateEmission: factures.dateEmission,
              totalHt: factures.totalHt,
              totalTva: factures.totalTva,
              totalTtc: factures.totalTtc,
            })
            .from(factures)
            .where(and(inArray(factures.chantierId, ids), eq(factures.statut, "emise"))),
          tx
            .select({ chantierId: lignesPrix.chantierId, libelle: lignesPrix.libelle, montant: lignesPrix.montant })
            .from(lignesPrix)
            .where(inArray(lignesPrix.chantierId, ids)),
        ])
      : [[], []];

    const paiements = sesFactures.length
      ? await tx
          .select()
          .from(paiementsFacture)
          .where(
            inArray(
              paiementsFacture.factureId,
              sesFactures.map((f) => f.id)
            )
          )
      : [];

    const parFacture = new Map<string, { date: string; montant: string }[]>();
    for (const p of paiements) {
      const liste = parFacture.get(p.factureId) ?? [];
      liste.push({ date: p.datePaiement, montant: p.montant });
      parFacture.set(p.factureId, liste);
    }

    const factureParChantier = new Map<string, { totalTtc: string; reste: string; jour: string }>();
    for (const f of sesFactures) {
      factureParChantier.set(f.chantierId, {
        totalTtc: f.totalTtc,
        reste: resteDu(f as FacturePourTva, parFacture.get(f.id) ?? []),
        jour: f.dateEmission,
      });
    }

    const lignesParChantier = new Map<string, { chantierId: string; libelle: string; montant: string }[]>();
    for (const l of sesLignes) {
      const liste = lignesParChantier.get(l.chantierId) ?? [];
      liste.push(l);
      lignesParChantier.set(l.chantierId, liste);
    }

    const liste = sesClients.map((client) => {
      const aLui = sesChantiers.filter((c) => c.clientId === client.id);
      const composables = aLui.map((c) => {
        const f = factureParChantier.get(c.id);
        return {
          id: c.id,
          nom: c.nom,
          jour: f?.jour ?? c.datePlanifiee ?? c.creeLe.toISOString().slice(0, 10),
          totalTtc: f?.totalTtc ?? null,
          reste: f?.reste ?? null,
        };
      });
      const fiche = composerFicheClient(
        composables,
        aLui.flatMap((c) => lignesParChantier.get(c.id) ?? [])
      );
      return {
        id: client.id,
        nom: client.nom,
        chantiers: fiche.chantiers,
        facture: fiche.facture,
        du: fiche.du,
        dernierJour: fiche.liste[0]?.jour ?? null,
      };
    });

    // Le plus récent d'abord — c'est celui qu'il cherche neuf fois sur dix. Un
    // client sans aucun chantier passe en dernier, jamais au milieu.
    return liste.sort((a, b) => (b.dernierJour ?? "").localeCompare(a.dernierJour ?? ""));
  });
}
