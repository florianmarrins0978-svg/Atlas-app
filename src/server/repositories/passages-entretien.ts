// Le passage d'entretien — ouvrir, cocher, nommer le client, envoyer.
//
// **Tout passe par `withEntreprise`** (`CLAUDE.md` §3). Aucune fonction d'ici
// n'appelle `db` en direct.
//
// **La fiche s'ouvre SANS client** (sa décision du 17 août), et le client se
// nomme quand il veut — arrangement C. Le récit et les règles pures sont en
// tête de `src/lib/passage-entretien.ts`.

import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { lignesPassage, passagesEntretien, clients, entreprises } from "../db/schema";
import type { Ctx } from "./context";
import { listerPrestations } from "./prestations-entretien";
import {
  empechementEnvoi,
  minutesValides,
  cocherCommeLaDerniereFois,
  type LignePassage,
  type RefusPassage,
} from "@/lib/passage-entretien";

export type Passage = {
  id: string;
  clientId: string | null;
  clientNom: string | null;
  clientTelephone: string | null;
  clientEmail: string | null;
  /** Sert au « Bonjour Mr. Martins » du message — la même que sur son devis. */
  clientCivilite: string | null;
  /** Le canal convenu sur SA fiche — un défaut proposé, jamais une contrainte. */
  clientCanal: "sms" | "email" | null;
  jour: string;
  minutes: number | null;
  /** Le temps paraît-il sur le retour d'intervention du client ? Vrai par défaut. */
  tempsVisible: boolean;
  observations: string | null;
  envoyeLe: Date | null;
  jeton: string | null;
  lignes: (LignePassage & { id: string })[];
};

export type { RefusPassage };

/**
 * Ouvre une fiche neuve, **copiée du modèle**.
 *
 * La copie n'est pas une commodité : c'est ce qui garantit qu'un rapport parti
 * chez un client ne changera plus jamais quand le modèle bougera (l'invariant
 * du 16 août). Le récit est dans la migration `0055`.
 *
 * **Refuse si le modèle est vide**, et le dit : ouvrir une fiche sans une seule
 * ligne à cocher donnerait un écran blanc dont il ne saurait pas quoi faire.
 */
export async function ouvrirPassage(
  ctx: Ctx,
  jour: string
): Promise<{ ok: true; id: string } | { ok: false; refus: RefusPassage }> {
  const modele = await listerPrestations(ctx);
  if (modele.length === 0) return { ok: false, refus: "modele_vide" };

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [passage] = await tx
      .insert(passagesEntretien)
      .values({ entrepriseId: ctx.entrepriseId, jour })
      .returning({ id: passagesEntretien.id });

    await tx.insert(lignesPassage).values(
      modele.map((p) => ({
        entrepriseId: ctx.entrepriseId,
        passageId: passage.id,
        famille: p.famille,
        libelle: p.libelle,
        ordre: p.ordre,
        faite: false,
      }))
    );
    return { ok: true as const, id: passage.id };
  });
}

export async function lirePassage(ctx: Ctx, id: string): Promise<Passage | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [p] = await tx
      .select({
        id: passagesEntretien.id,
        clientId: passagesEntretien.clientId,
        jour: passagesEntretien.jour,
        minutes: passagesEntretien.minutes,
        tempsVisible: passagesEntretien.tempsVisible,
        observations: passagesEntretien.observations,
        envoyeLe: passagesEntretien.envoyeLe,
        jeton: passagesEntretien.jeton,
        clientNom: clients.nom,
        clientTelephone: clients.telephone,
        clientEmail: clients.email,
        clientCivilite: clients.civilite,
        clientCanal: clients.canalCommunication,
      })
      .from(passagesEntretien)
      .leftJoin(clients, eq(clients.id, passagesEntretien.clientId))
      .where(
        and(
          eq(passagesEntretien.id, id),
          eq(passagesEntretien.entrepriseId, ctx.entrepriseId)
        )
      )
      .limit(1);
    if (!p) return null;

    const lignes = await tx
      .select({
        id: lignesPassage.id,
        famille: lignesPassage.famille,
        libelle: lignesPassage.libelle,
        ordre: lignesPassage.ordre,
        faite: lignesPassage.faite,
      })
      .from(lignesPassage)
      .where(eq(lignesPassage.passageId, id))
      .orderBy(asc(lignesPassage.ordre), asc(lignesPassage.libelle));

    return {
      ...p,
      clientNom: p.clientNom ?? null,
      clientTelephone: p.clientTelephone ?? null,
      clientEmail: p.clientEmail ?? null,
      clientCivilite: p.clientCivilite ?? null,
      clientCanal: p.clientCanal ?? null,
      lignes,
    };
  });
}

/** Coche ou décoche une ligne. Refusé une fois le rapport parti. */
export async function cocherLigne(
  ctx: Ctx,
  passageId: string,
  ligneId: string,
  faite: boolean
): Promise<{ ok: true } | { ok: false; refus: RefusPassage }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [p] = await tx
      .select({ envoyeLe: passagesEntretien.envoyeLe })
      .from(passagesEntretien)
      .where(
        and(eq(passagesEntretien.id, passageId), eq(passagesEntretien.entrepriseId, ctx.entrepriseId))
      )
      .limit(1);
    if (!p) return { ok: false as const, refus: "introuvable" as const };
    if (p.envoyeLe !== null) return { ok: false as const, refus: "deja_envoye" as const };

    const touchees = await tx
      .update(lignesPassage)
      .set({ faite })
      .where(and(eq(lignesPassage.id, ligneId), eq(lignesPassage.passageId, passageId)))
      .returning({ id: lignesPassage.id });
    if (touchees.length === 0) return { ok: false as const, refus: "introuvable" as const };
    return { ok: true as const };
  });
}

/**
 * Le temps passé, sa visibilité, et les observations.
 *
 * **`tempsVisible` ne touche PAS `minutes`**, et c'est délibéré : masquer n'est
 * pas effacer (migration `0060`). Les remettre à NULL ensemble ferait perdre au
 * patron le chiffre qui lui dit ce qu'a coûté un chantier, pour la seule raison
 * qu'il ne veut pas le facturer sous les yeux de son client.
 */
export async function majPassage(
  ctx: Ctx,
  passageId: string,
  champs: { minutes?: number | null; tempsVisible?: boolean; observations?: string | null }
): Promise<{ ok: true } | { ok: false; refus: RefusPassage }> {
  let minutes: number | null | undefined;
  if (champs.minutes !== undefined) {
    minutes = minutesValides(champs.minutes);
    // **Le refus plutôt que la correction silencieuse** : une durée aberrante
    // vient d'une saisie, et corriger sans le dire ferait partir chez le client
    // un chiffre que personne n'a voulu.
    if (champs.minutes !== null && minutes === null) {
      return { ok: false, refus: "duree_invalide" };
    }
  }

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [p] = await tx
      .select({ envoyeLe: passagesEntretien.envoyeLe })
      .from(passagesEntretien)
      .where(
        and(eq(passagesEntretien.id, passageId), eq(passagesEntretien.entrepriseId, ctx.entrepriseId))
      )
      .limit(1);
    if (!p) return { ok: false as const, refus: "introuvable" as const };
    if (p.envoyeLe !== null) return { ok: false as const, refus: "deja_envoye" as const };

    await tx
      .update(passagesEntretien)
      .set({
        ...(minutes !== undefined ? { minutes } : {}),
        ...(champs.tempsVisible !== undefined ? { tempsVisible: champs.tempsVisible } : {}),
        ...(champs.observations !== undefined ? { observations: champs.observations } : {}),
        updatedAt: new Date(),
      })
      .where(eq(passagesEntretien.id, passageId));
    return { ok: true as const };
  });
}

/**
 * Nomme le client — **et recoche ce que son dernier rapport portait**.
 *
 * Sa règle du 22 septembre 2026 : toutes les lignes de la fiche restent, pour
 * qu'il coche ce qu'il fait en plus ce jour-là ; seules les coches viennent du
 * passé. La règle vit dans `cocherCommeLaDerniereFois`, éprouvée sans base.
 */
export async function nommerClient(
  ctx: Ctx,
  passageId: string,
  clientId: string
): Promise<
  | { ok: true; cochees: number; lignes: (LignePassage & { id: string })[] }
  | { ok: false; refus: RefusPassage }
> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [p] = await tx
      .select({ envoyeLe: passagesEntretien.envoyeLe })
      .from(passagesEntretien)
      .where(
        and(eq(passagesEntretien.id, passageId), eq(passagesEntretien.entrepriseId, ctx.entrepriseId))
      )
      .limit(1);
    if (!p) return { ok: false as const, refus: "introuvable" as const };
    if (p.envoyeLe !== null) return { ok: false as const, refus: "deja_envoye" as const };

    const [leClient] = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (!leClient) return { ok: false as const, refus: "client_inconnu" as const };

    // **Son DERNIER rapport envoyé**, et lui seul (le pourquoi est sur
    // `cocherCommeLaDerniereFois`). Envoyé seulement : un brouillon ouvert par
    // erreur puis abandonné ne dit rien de ce qui a été fait chez lui.
    const [dernier] = await tx
      .select({ id: passagesEntretien.id })
      .from(passagesEntretien)
      .where(
        and(
          eq(passagesEntretien.entrepriseId, ctx.entrepriseId),
          eq(passagesEntretien.clientId, clientId),
          isNotNull(passagesEntretien.envoyeLe)
        )
      )
      .orderBy(desc(passagesEntretien.jour), desc(passagesEntretien.envoyeLe))
      .limit(1);
    const derniere = dernier
      ? await tx
          .select({ libelle: lignesPassage.libelle })
          .from(lignesPassage)
          .where(and(eq(lignesPassage.passageId, dernier.id), eq(lignesPassage.faite, true)))
      : [];

    const actuelles = await tx
      .select({
        id: lignesPassage.id,
        famille: lignesPassage.famille,
        libelle: lignesPassage.libelle,
        ordre: lignesPassage.ordre,
        faite: lignesPassage.faite,
      })
      .from(lignesPassage)
      .where(eq(lignesPassage.passageId, passageId));

    const lignes = cocherCommeLaDerniereFois(actuelles, derniere);
    const aCocher = lignes.filter((l, i) => l.faite && !actuelles[i].faite);
    for (const l of aCocher) {
      await tx.update(lignesPassage).set({ faite: true }).where(eq(lignesPassage.id, l.id));
    }

    await tx
      .update(passagesEntretien)
      .set({ clientId, updatedAt: new Date() })
      .where(eq(passagesEntretien.id, passageId));

    // **Les lignes partent avec la réponse.** L'écran ne refait pas les
    // coches de son côté : deux implémentations de la même règle finissent
    // toujours par diverger (`CLAUDE.md` §3).
    return {
      ok: true as const,
      cochees: aCocher.length,
      lignes: [...lignes].sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle)),
    };
  });
}

/**
 * Fige le rapport et l'horodate.
 *
 * **Ce qui remplace les signatures** (décision du 16 août) : la date, l'heure,
 * et l'empreinte du contenu exact. C'est la même mécanique que l'acceptation
 * d'un devis, et c'est plus solide qu'un trait au doigt.
 *
 * **N'ENVOIE RIEN.** Le message part de SA messagerie, comme le devis et la
 * facture — sa décision du 3 août (`docs/A-FAIRE.md` §5). Cette fonction fige,
 * l'écran ouvre ensuite le SMS ou le courriel.
 */
export async function figerPassage(
  ctx: Ctx,
  passageId: string,
  maintenant: Date = new Date()
): Promise<{ ok: true; empreinte: string; jeton: string } | { ok: false; phrase: string }> {
  const passage = await lirePassage(ctx, passageId);
  if (!passage) return { ok: false, phrase: "Cette fiche n'existe plus." };

  const empechement = empechementEnvoi(passage);
  if (empechement) return { ok: false, phrase: empechement };

  // L'empreinte porte ce que le client lira : les prestations faites, le temps,
  // les observations, le jour. Y mettre l'identifiant du passage ne prouverait
  // rien du CONTENU.
  //
  // **Et le temps masqué n'y entre pas.** L'empreinte prouve ce que le client a
  // reçu : y sceller une durée qu'il n'a jamais vue la rendrait indéfendable le
  // jour où il conteste le passage — on lui opposerait un chiffre absent de sa
  // page. Un temps caché est, pour cette preuve, un temps qui n'existe pas.
  const contenu = JSON.stringify({
    jour: passage.jour,
    minutes: passage.tempsVisible ? passage.minutes : null,
    observations: passage.observations ?? "",
    faites: passage.lignes.filter((l) => l.faite).map((l) => l.libelle).sort(),
  });
  const empreinte = createHash("sha256").update(contenu, "utf8").digest("hex");

  // 256 bits d'aléa, comme le devis (migration 0015) : **jamais dérivé de
  // l'identifiant du passage**, sinon un seul lien reçu rendrait tous les
  // autres devinables — y compris ceux des voisins du client.
  const jeton = randomBytes(32).toString("base64url");

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(passagesEntretien)
      .set({
        envoyeLe: maintenant,
        empreinte,
        jeton,
        // Le nom part avec le rapport : voir la migration 0055. Le relire à la
        // lecture le ferait changer sous les yeux du client.
        clientNomFige: passage.clientNom,
        updatedAt: maintenant,
      })
      .where(eq(passagesEntretien.id, passageId));
    return { ok: true as const, empreinte, jeton };
  });
}

/**
 * Supprime une fiche **encore en cours**, et ses lignes avec elle.
 *
 * **Sa demande du 24 août 2026** : *« Je ne peux pas supprimer les fiches en
 * cours. Il faut pouvoir les supprimer. »* Elles s'accumulaient sans issue —
 * une fiche ouverte sur le mauvais jour, une autre pour un jardin qu'il n'a
 * finalement pas fait, et rien pour les faire disparaître de l'écran qu'il
 * ouvre chaque matin.
 *
 * **UN RAPPORT PARTI NE SE SUPPRIME PAS**, et le refus est le cœur de cette
 * fonction. Son lien vit chez le client, dans un SMS qu'il a peut-être gardé :
 * effacer la fiche transformerait cette adresse en page morte, sans que
 * personne ne l'ait voulu ni ne puisse le savoir. C'est le même invariant que
 * le 16 août — un rapport parti ne change plus —, poussé jusqu'à sa
 * conséquence : il ne disparaît pas non plus.
 *
 * **Les lignes se suppriment ICI, explicitement**, plutôt que de s'en remettre
 * au `ON DELETE CASCADE` de la migration 0055. La cascade tient, mais elle
 * s'exécute hors de la politique d'isolation : la faire porter une suppression
 * revient à retirer la RLS du chemin le plus destructeur de cette table
 * (`CLAUDE.md` §4). Deux `delete` sous contexte coûtent une ligne de code et
 * gardent le garde-fou.
 */
export async function supprimerPassage(
  ctx: Ctx,
  passageId: string
): Promise<{ ok: true } | { ok: false; refus: RefusPassage }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [p] = await tx
      .select({ envoyeLe: passagesEntretien.envoyeLe })
      .from(passagesEntretien)
      .where(
        and(eq(passagesEntretien.id, passageId), eq(passagesEntretien.entrepriseId, ctx.entrepriseId))
      )
      .limit(1);
    if (!p) return { ok: false as const, refus: "introuvable" as const };
    if (p.envoyeLe !== null) return { ok: false as const, refus: "deja_envoye" as const };

    await tx.delete(lignesPassage).where(eq(lignesPassage.passageId, passageId));
    await tx
      .delete(passagesEntretien)
      .where(
        and(eq(passagesEntretien.id, passageId), eq(passagesEntretien.entrepriseId, ctx.entrepriseId))
      );
    return { ok: true as const };
  });
}

/**
 * Ce qu'il retrouve en ouvrant l'outil : ses brouillons, puis ses rapports.
 *
 * **Les brouillons d'abord, et c'est le sens de l'écran** : une fiche laissée
 * en plan hier est ce qu'il vient chercher. Les rapports partis viennent
 * ensuite, du plus récent — ils ne se modifient plus, ils se consultent.
 *
 * **TOUS, sans plafond — depuis le 22 septembre 2026.** Il en rendait trente,
 * brouillons compris : un nom tapé dans « Rapports envoyés » (*« que ça nous
 * sorte toutes les fiches liées au client »*) n'aurait jamais trouvé le
 * trente et unième, et le mois choisi aurait paru vide. Le filtre se fait à
 * l'écran (`rapportsAMontrer`), sur la liste entière, comme les fiches de
 * sécurité.
 */
export async function listerPassages(
  ctx: Ctx
): Promise<
  {
    id: string;
    jour: string;
    clientNom: string | null;
    envoyeLe: Date | null;
    minutes: number | null;
    faites: number;
  }[]
> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    return tx
      .select({
        id: passagesEntretien.id,
        jour: passagesEntretien.jour,
        clientNom: clients.nom,
        envoyeLe: passagesEntretien.envoyeLe,
        minutes: passagesEntretien.minutes,
        faites: sql<number>`(
          select count(*)::int from ${lignesPassage} l
           where l.passage_id = ${passagesEntretien.id} and l.faite
        )`,
      })
      .from(passagesEntretien)
      .leftJoin(clients, eq(clients.id, passagesEntretien.clientId))
      .where(eq(passagesEntretien.entrepriseId, ctx.entrepriseId))
      // Les brouillons en tête : `envoye_le` nul d'abord, puis du plus récent.
      .orderBy(
        asc(sql`${passagesEntretien.envoyeLe} is not null`),
        desc(passagesEntretien.jour),
        desc(passagesEntretien.createdAt)
      );
  });
}

/**
 * Une fiche du jour **encore VIERGE** — ou `null`.
 *
 * **Elle existe pour une seule raison : ne pas empiler des fiches vides.** Deux
 * appuis sur « Ouvrir » — le premier n'a pas eu l'air de répondre, il rappuie —
 * laisseraient sinon deux fiches identiques, et il cocherait la moitié de
 * chacune sans savoir laquelle envoyer.
 *
 * **VIERGE, et pas « du jour » : c'est tout le sujet.** La première version
 * rendait le dernier brouillon du jour, quel qu'il soit. Or **il fait quatre ou
 * cinq jardins dans une journée** : au deuxième, l'écran lui aurait rendu la
 * fiche du premier — client nommé, cases cochées — et il aurait envoyé chez
 * Martin ce qu'il a fait chez Durand. Une fiche déjà touchée appartient à son
 * chantier ; seule une fiche que personne n'a ouverte se reprend.
 */
export async function brouillonVierge(ctx: Ctx, jour: string): Promise<string | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const candidats = await tx
      .select({ id: passagesEntretien.id })
      .from(passagesEntretien)
      .where(
        and(
          eq(passagesEntretien.entrepriseId, ctx.entrepriseId),
          eq(passagesEntretien.jour, jour),
          isNull(passagesEntretien.envoyeLe),
          isNull(passagesEntretien.clientId),
          isNull(passagesEntretien.minutes),
          isNull(passagesEntretien.observations)
        )
      )
      .orderBy(desc(passagesEntretien.createdAt));

    for (const c of candidats) {
      const [{ cochees }] = await tx
        .select({ cochees: sql<number>`count(*)::int` })
        .from(lignesPassage)
        .where(and(eq(lignesPassage.passageId, c.id), eq(lignesPassage.faite, true)));
      if (cochees === 0) return c.id;
    }
    return null;
  });
}

/** Le rapport tel que le CLIENT le reçoit. */
export type RapportPublic = {
  jour: string;
  /** `null` s'il n'a rien chronométré — **ou s'il a masqué le temps** (§0060). */
  minutes: number | null;
  observations: string | null;
  envoyeLe: Date;
  clientNom: string | null;
  entrepriseNom: string;
  /** **Ce qui a été FAIT, et rien d'autre** — voir plus bas. */
  faites: { famille: string; libelle: string }[];
};

/**
 * Lecture du rapport par son jeton — **la page du client**.
 *
 * **Contourne `withEntreprise` à dessein**, comme le devis : le client n'a pas
 * de session, donc pas de contexte d'entreprise. Ce n'est pas un
 * contournement de l'isolation mais une autre porte, gardée par la politique
 * `passages_entretien_lecture_par_jeton` (migration 0055) : sans le jeton
 * exact, la requête ne rend rien. Le filtre n'est pas dans ce code, il est
 * dans la base — et c'est ce qui le rend sûr.
 *
 * **Seules les prestations FAITES sont rendues**, et c'est sa décision du
 * 16 août (« B ») : le client lit ce qui a été fait chez lui, pas la liste de
 * ce qui ne l'a pas été. Le tri se fait ICI plutôt qu'à l'écran — une page qui
 * recevrait tout et n'en montrerait qu'une part laisserait le reste dans le
 * HTML, à portée d'un clic droit.
 */
export async function lireRapportParJeton(jeton: string): Promise<RapportPublic | null> {
  if (!jeton) return null;
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_passage', ${jeton}, true)`);

    const [p] = await tx
      .select({
        id: passagesEntretien.id,
        jour: passagesEntretien.jour,
        minutes: passagesEntretien.minutes,
        tempsVisible: passagesEntretien.tempsVisible,
        observations: passagesEntretien.observations,
        envoyeLe: passagesEntretien.envoyeLe,
        clientNom: passagesEntretien.clientNomFige,
        entrepriseNom: entreprises.nom,
      })
      .from(passagesEntretien)
      .innerJoin(entreprises, eq(entreprises.id, passagesEntretien.entrepriseId))
      .where(eq(passagesEntretien.jeton, jeton))
      .limit(1);
    if (!p || p.envoyeLe === null) return null;

    const faites = await tx
      .select({ famille: lignesPassage.famille, libelle: lignesPassage.libelle })
      .from(lignesPassage)
      .where(and(eq(lignesPassage.passageId, p.id), eq(lignesPassage.faite, true)))
      .orderBy(asc(lignesPassage.ordre), asc(lignesPassage.libelle));

    return {
      jour: p.jour,
      // **Le masquage se décide ICI, pas à l'écran.** Rendre la durée puis la
      // cacher au rendu la laisserait dans le HTML de la page, à portée d'un
      // clic droit — exactement ce que le tri des prestations faites évite
      // juste en dessous. Ce qui est masqué ne quitte pas le serveur.
      minutes: p.tempsVisible ? p.minutes : null,
      observations: p.observations,
      envoyeLe: p.envoyeLe,
      clientNom: p.clientNom ?? null,
      entrepriseNom: p.entrepriseNom,
      faites,
    };
  });
}
