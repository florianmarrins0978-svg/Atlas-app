import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import {
  chantiers,
  clients,
  devis,
  factures,
  lignesPassage,
  lignesPrix,
  paiementsFacture,
  passagesEntretien,
  prestations,
} from "../db/schema";
import type { Ctx } from "./context";
import { composerFicheClient, type FicheClient } from "@/lib/fiche-client";
import { resteDu, type FacturePourTva } from "@/lib/exigibilite-tva";
import {
  dernierePrestation,
  jourCourt,
  rangerDuPlusRecent,
  type DerniereePrestation,
  type PieceDuClient,
} from "@/lib/documents-du-client";

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
  /**
   * La dernière chose qu'on a faite chez lui, et ce qu'elle comprenait.
   *
   * *Sa demande du 20 août 2026 :* « en dessous de l'adresse, en titre noir
   * gras, dernière prestation avec ce qu'elle comprend ».
   */
  derniere: DerniereePrestation | null;
  /**
   * Les trois colonnes de PDF — devis, fiches de chantier, factures —, chacune
   * du plus récent au plus ancien.
   *
   * *Le 20 août 2026 :* « pas trois encadrés, seulement deux », puis, le même
   * jour : « tu peux rajouter une colonne facture et ranger les factures dans
   * le même ordre ».
   */
  pieces: { devis: PieceDuClient[]; fiches: PieceDuClient[]; factures: PieceDuClient[] };
};

/** Les trois colonnes vides — un client sans aucun chantier. */
const AUCUNE_PIECE = { devis: [], fiches: [], factures: [] };

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
        termineAt: chantiers.termineAt,
        creeLe: chantiers.createdAt,
      })
      .from(chantiers)
      .where(and(eq(chantiers.clientId, clientId), isNull(chantiers.deletedAt)));

    // ─── La colonne « Fiche chantier » ───────────────────────────────────
    //
    // **Elle ne porte QUE les fiches d'entretien qu'il a remplies lui-même**,
    // et envoyées — sa règle du 23 août 2026 : *« cette catégorie est réservée
    // lorsque les paysagistes créent une fiche chantier avec les informations
    // type la tonte, la taille, ce qu'ils ont fait. À aucun moment, lorsqu'une
    // facture doit être envoyée, une fiche chantier doit être créée. »*
    //
    // **CE QU'ELLE PORTAIT AVANT, ET POURQUOI C'ÉTAIT FAUX.** Elle listait les
    // chantiers `termineAt IS NOT NULL`. Or facturer POSE cette date
    // (`factures.ts` : `COALESCE(termine_at, now())`) : émettre une facture
    // fabriquait donc une pièce que personne n'avait écrite. Pire, le document
    // qu'elle ouvrait est la feuille INTERNE — équipe, créneau, note vocale,
    // adresse du chantier —, celle que ses salariés ouvrent dans la camionnette.
    // Rangée dans le dossier d'un client, elle donnait à croire qu'il l'avait
    // reçue.
    //
    // **Envoyées seulement**, comme les devis et les factures de cette même
    // rangée : un brouillon n'est pas une pièce, et il n'a d'ailleurs pas
    // d'adresse publique tant qu'il n'est pas figé (`passages_entretien`).
    const sesFiches = await tx
      .select({
        id: passagesEntretien.id,
        jour: passagesEntretien.jour,
        jeton: passagesEntretien.jeton,
        // **`passages_entretien.id` écrit EN TOUTES LETTRES, et c'est
        // indispensable.** `${passagesEntretien.id}` se rend en `"id"` NU dès
        // qu'aucune jointure n'oblige Drizzle à qualifier ses colonnes : la
        // sous-requête devenait `l.passage_id = l.id`, jamais vraie, et chaque
        // fiche s'annonçait « 0 prestation » sur une base qui en portait deux ou
        // trois. Aucun test ne l'a vu — c'est la CAPTURE qui l'a montré, la
        // cinquième fois dans ce dépôt (`CLAUDE.md` §5).
        //
        // Le voisin `listerPassages` écrit la même chose et fonctionne : il
        // porte un `leftJoin`, qui force la qualification. Le défaut n'apparaît
        // donc que dans la requête SANS jointure — d'où l'illusion que le motif
        // était éprouvé.
        faites: sql<number>`(
          select count(*)::int from ${lignesPassage} l
           where l.passage_id = passages_entretien.id and l.faite
        )`,
      })
      .from(passagesEntretien)
      .where(
        and(
          eq(passagesEntretien.clientId, clientId),
          isNotNull(passagesEntretien.envoyeLe),
          isNotNull(passagesEntretien.jeton)
        )
      )
      .orderBy(desc(passagesEntretien.jour));

    const piecesFiches = rangerDuPlusRecent(
      sesFiches.map((f) => ({
        id: f.id,
        // Le jour en titre : à l'inverse des devis et des factures, une fiche
        // n'a pas de numéro — c'est sa date qui la désigne.
        titre: jourCourt(f.jour),
        jour: f.jour,
        // Ce qu'elle porte, en un chiffre. « 6 prestations » distingue deux
        // passages du même mois mieux que ne le ferait le nom du client, qui
        // est déjà celui de la fiche qu'on regarde.
        precision: `${f.faites} prestation${f.faites > 1 ? "s" : ""}`,
        // **L'adresse que le client a reçue**, et non un PDF : ce rapport n'est
        // figé nulle part en fichier. `format` le dit à la vignette.
        href: `/entretien/${f.jeton}`,
        format: "page" as const,
      }))
    );

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
        derniere: null,
        // **Un client peut n'avoir AUCUN chantier et une fiche d'entretien.**
        // La fiche s'ouvre depuis Paysage, se nomme, s'envoie — sans qu'aucun
        // chantier n'existe. Rendre `AUCUNE_PIECE` ici l'aurait fait
        // disparaître de son dossier.
        pieces: { ...AUCUNE_PIECE, fiches: piecesFiches },
      };
    }

    const ids = sesChantiers.map((c) => c.id);

    // **Seules les factures ÉMISES comptent.** Un brouillon n'a pas été envoyé :
    // le compter dans « facturé » annoncerait de l'argent que le client ne sait
    // pas encore devoir.
    const [sesFactures, sesLignes, sesDevis] = await Promise.all([
      tx
        .select({
          id: factures.id,
          chantierId: factures.chantierId,
          numeroCommercial: factures.numeroCommercial,
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
      // **Seuls les devis ENVOYÉS entrent dans la colonne.** Un brouillon n'est
      // pas une pièce : le client ne l'a jamais reçu, son numéro peut encore
      // changer de version, et le patron chercherait dans sa colonne un
      // document que personne n'a. Même raison que pour les factures émises.
      tx
        .select({
          id: devis.id,
          chantierId: devis.chantierId,
          numero: devis.numeroCommercial,
          version: devis.numeroVersion,
          jour: devis.dateEmission,
        })
        .from(devis)
        .where(and(inArray(devis.chantierId, ids), eq(devis.statut, "envoye"))),
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

    // ─── Les trois colonnes de pièces ────────────────────────────────────
    //
    // Les trois passent par `rangerDuPlusRecent` — une seule règle de tri, pas
    // trois. Il a dit « le même ordre » : trois tris écrits séparément
    // finiraient par diverger, et c'est lui qui verrait une colonne remonter le
    // temps pendant que les deux autres la descendent (`CLAUDE.md` §3).
    // **UNE pièce par devis, sa dernière version envoyée.**
    //
    // Trouvé par `test-fiche-client-e2e.ts`, et invisible à la lecture : le
    // numéro commercial est STABLE à travers les versions (`schema.ts`). Un
    // devis révisé puis renvoyé produisait donc deux lignes portant le même
    // « n° 2026-0003 », à la même date, impossibles à distinguer — le patron
    // aurait dû ouvrir les deux pour savoir laquelle il tenait.
    //
    // La dernière version est celle qui vaut : c'est le devis, pour lui comme
    // pour son client. Les révisions restent en base, et l'écran du chantier
    // les porte.
    const dernierParNumero = new Map<string, (typeof sesDevis)[number]>();
    for (const d of sesDevis) {
      const connu = dernierParNumero.get(d.numero);
      if (!connu || d.version > connu.version) dernierParNumero.set(d.numero, d);
    }

    const piecesDevis = rangerDuPlusRecent(
      [...dernierParNumero.values()].map((d) => ({
        id: d.id,
        titre: `n° ${d.numero}`,
        // **La date, et non le nom du chantier.** Sur 97 px de colonne, un
        // « Rénovation de la salle de bain » se coupe à « Rénovation de… » et
        // n'apprend rien ; la date, elle, tient en entier et c'est par elle
        // qu'il cherche. Le nom du chantier reste sur la fiche de chantier,
        // dont la colonne porte déjà la date en titre.
        precision: jourCourt(d.jour),
        jour: d.jour,
        href: `/api/devis/${d.id}/pdf`,
      }))
    );

    const piecesFactures = rangerDuPlusRecent(
      sesFactures.map((f) => ({
        id: f.id,
        titre: `n° ${f.numeroCommercial}`,
        precision: jourCourt(f.dateEmission),
        jour: f.dateEmission,
        href: `/api/factures/${f.id}/pdf`,
      }))
    );

    // ─── La dernière prestation ──────────────────────────────────────────
    //
    // **Seuls les chantiers TERMINÉS comptent**, et cela s'est appris à
    // l'écran. La première version prenait les chantiers « dont la date est
    // passée » — or un chantier créé le matin même, sans devis ni date posée,
    // porte la date du jour : il devenait « la dernière prestation » alors que
    // personne n'y était encore allé, et l'écran annonçait un travail qui
    // n'avait pas eu lieu (`CLAUDE.md` §4). Trouvé par
    // `test-fiche-client-e2e.ts`, invisible à la lecture.
    //
    // C'est aussi ce qui aligne cet endroit sur la colonne « Fiche chantier »,
    // qui n'existe que pour les chantiers terminés : les deux disent la même
    // chose du même chantier.
    const termines = new Set(
      sesChantiers.filter((c) => c.termineAt !== null).map((c) => c.id)
    );
    const faits = composables.filter((c) => termines.has(c.id));
    const idDernier = rangerDuPlusRecent(faits)[0]?.id;
    // Les prestations du SEUL dernier chantier : les charger toutes ferait
    // voyager la liste entière d'un client fidèle pour n'en afficher que trois.
    const prestationsDuDernier = idDernier
      ? await tx
          .select({ libelle: prestations.libelle })
          .from(prestations)
          .where(eq(prestations.chantierId, idDernier))
          .orderBy(asc(prestations.ordre))
      : [];

    return {
      ...composerFicheClient(composables, sesLignes),
      client: {
        id: client.id,
        nom: client.nom,
        adresse: client.adresse,
        telephone: client.telephone,
        email: client.email,
      },
      derniere: dernierePrestation(
        faits,
        new Map(idDernier ? [[idDernier, prestationsDuDernier.map((p) => p.libelle)]] : [])
      ),
      pieces: { devis: piecesDevis, fiches: piecesFiches, factures: piecesFactures },
    };
  });
}


/** Ce que la liste des clients montre de chacun : son nom, son lieu, ses chiffres. */
export type ClientEnListe = {
  id: string;
  nom: string;
  /**
   * Là où il habite — **ce qui distingue quatre clients du même nom**.
   *
   * *Sa remarque du 3 septembre 2026 :* « j'ai vingt et un clients, dont QUATRE
   * qui s'appellent Martins. Aujourd'hui la ligne ne montre que le nom et des
   * comptes : rien ne me dit lequel c'est. »
   *
   * La colonne existait déjà (`clients.adresse`, migration 0038) et la fiche
   * l'affichait ; seule cette liste-ci ne la chargeait pas. `null` est un état
   * normal — un client saisi à la volée n'a pas toujours eu droit à un appui de
   * plus —, et la ligne se contente alors de ses chantiers.
   */
  adresse: string | null;
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
        .select({ id: clients.id, nom: clients.nom, adresse: clients.adresse })
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
        adresse: client.adresse,
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
