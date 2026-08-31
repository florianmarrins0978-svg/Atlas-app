import { and, eq, gte, isNull, isNotNull, or, sql, desc } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { NOTE_MAX } from "../../lib/note-chantier";
import { equipesParChantier } from "./occupation-chantiers";
import { chantiers, clients, entreprises, equipesDuChantier, factures } from "../db/schema";
import {
  compterOccupation,
  departPossible,
  dureeEnDemiJournees,
  DUREE_PAR_DEFAUT_DEMI_JOURNEES,
  type Moment,
} from "../disponibilites";
import { absencesEquipe, equipes } from "../db/schema";
import { fusionnerAbsences } from "../../lib/absences-equipe";
import { departEtDuree, type QuandChantier } from "../../lib/planning-jour";
import { seuilMemoireCalendrier } from "../../lib/onglet-chantier";
import type { Ctx } from "./context";

/**
 * L'identifiant de l'équipe de ce rang, créée au besoin.
 *
 * Créée ICI et pas à l'affichage : c'est le seul instant où l'on a besoin
 * d'une clé étrangère. Le `nom` reste `null` — on enregistre qu'une équipe de
 * rang N existe, jamais qu'elle s'appelle « Équipe B ».
 */
async function idEquipeDeRang(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  entrepriseId: string,
  rang: number
): Promise<string> {
  const borne = Math.min(20, Math.max(1, Math.trunc(rang)));
  const [existante] = await tx
    .select({ id: equipes.id })
    .from(equipes)
    .where(and(eq(equipes.entrepriseId, entrepriseId), eq(equipes.rang, borne)))
    .limit(1);
  if (existante) return existante.id;
  const [creee] = await tx
    .insert(equipes)
    .values({ entrepriseId, rang: borne })
    .returning({ id: equipes.id });
  return creee.id;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Le dernier envoi d'un chantier, en sous-requêtes corrélées plutôt qu'en
// jointure : un chantier refusé puis renvoyé porte plusieurs envois, et une
// jointure les remonterait tous, dupliquant la ligne du chantier. Seul le
// dernier décrit où en est le devis aujourd'hui — les précédents sont de
// l'histoire.
const DERNIER_ENVOI = {
  envoiEnvoyeAt: sql<Date | null>`(
    SELECT e.envoye_at FROM envois_devis e
    WHERE e.chantier_id = ${chantiers.id}
    ORDER BY e.envoye_at DESC LIMIT 1
  )`,
  envoiExpireAt: sql<Date | null>`(
    SELECT e.expire_at FROM envois_devis e
    WHERE e.chantier_id = ${chantiers.id}
    ORDER BY e.envoye_at DESC LIMIT 1
  )`,
  envoiReponse: sql<"acceptee" | "refusee" | null>`(
    SELECT e.reponse FROM envois_devis e
    WHERE e.chantier_id = ${chantiers.id}
    ORDER BY e.envoye_at DESC LIMIT 1
  )`,
} as const;

export async function listerChantiers(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(chantiers).where(isNull(chantiers.deletedAt))
  );
}

// Pour l'écran Liste des chantiers : chantier + nom du client + compteur de
// photos + présence d'une note vocale, en une seule requête (sous-requêtes
// corrélées plutôt que N+1). Tri : plus récent en premier — aucun tri métier
// n'existait auparavant pour cet écran (les données simulées n'étaient pas
// triées) ; choix par défaut raisonnable, documenté dans le compte rendu.
export async function listerChantiersPourAffichage(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        adresseChantier: chantiers.adresseChantier,
        clientNom: clients.nom,
        // Sert la date relative des cartes de l'écran d'accueil
        // (« Aujourd'hui », « Hier »). `updatedAt` et non `createdAt` : ce que
        // l'artisan cherche, c'est le chantier qu'il a touché en dernier, pas
        // celui qu'il a ouvert en premier.
        majAt: chantiers.updatedAt,
        informationsVerifieesAt: chantiers.informationsVerifieesAt,
        // **Le jalon qui manquait à la LISTE (13 août 2026).** Sans lui,
        // `getStatutAffiche` ne pouvait pas savoir qu'un devis était écrit, et
        // annonçait « Brouillon » sur un chantier qui n'attendait plus que son
        // envoi. C'est ce que le patron a lu sur sa propre liste.
        // `prixValideAt` sert la REPRISE : sans lui, un chantier chiffré mais
        // sans devis ramènerait le patron à la dictée au lieu de l'écran du
        // prix (`lienDeReprise`).
        prixValideAt: chantiers.prixValideAt,
        devisGenereAt: chantiers.devisGenereAt,
        devisEnvoyeAt: chantiers.devisEnvoyeAt,
        datePlanifiee: chantiers.datePlanifiee,
        termineAt: chantiers.termineAt,
        factureEnvoyeeAt: chantiers.factureEnvoyeeAt,
        photosCount: sql<number>`(
          SELECT COUNT(*)::int FROM photos p
          WHERE p.chantier_id = ${chantiers.id} AND p.deleted_at IS NULL
        )`,
        aUneNoteVocale: sql<boolean>`EXISTS (
          SELECT 1 FROM notes_vocales n WHERE n.chantier_id = ${chantiers.id}
        )`,
        ...DERNIER_ENVOI,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .where(isNull(chantiers.deletedAt))
      .orderBy(desc(chantiers.createdAt))
  );
}

export async function getChantier(ctx: Ctx, id: string) {
  if (!UUID_RE.test(id)) return null; // format invalide : traité comme introuvable, aucune requête inutile
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select()
      .from(chantiers)
      .where(and(eq(chantiers.id, id), isNull(chantiers.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  });
}

// Pour la fiche chantier (hub) : chantier + client + agrégats photos/note vocale
// en une seule requête (même motif que listerChantiersPourAffichage — pas de
// requêtes en cascade). Retourne null si le chantier n'existe pas, est supprimé,
// ou n'appartient pas à l'entreprise du contexte (jamais distingué de "inexistant"
// pour l'appelant — notFound() dans les deux cas, voir la route).
export async function getChantierPourHub(ctx: Ctx, id: string) {
  if (!UUID_RE.test(id)) return null; // format invalide : traité comme introuvable, aucune requête inutile
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        adresseChantier: chantiers.adresseChantier,
        clientNom: clients.nom,
        // La fiche du chantier ouvre celle du client depuis le 16 août 2026 :
        // il lui faut donc l'identifiant, pas seulement le nom.
        clientId: chantiers.clientId,
        informationsVerifieesAt: chantiers.informationsVerifieesAt,
        prixValideAt: chantiers.prixValideAt,
        devisGenereAt: chantiers.devisGenereAt,
        devisEnvoyeAt: chantiers.devisEnvoyeAt,
        datePlanifiee: chantiers.datePlanifiee,
        photosCount: sql<number>`(
          SELECT COUNT(*)::int FROM photos p
          WHERE p.chantier_id = ${chantiers.id} AND p.deleted_at IS NULL
        )`,
        aUneNoteVocale: sql<boolean>`EXISTS (
          SELECT 1 FROM notes_vocales n WHERE n.chantier_id = ${chantiers.id}
        )`,
        ...DERNIER_ENVOI,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .where(and(eq(chantiers.id, id), isNull(chantiers.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  });
}

/**
 * Un chantier et les coordonnées de son client — pour rouvrir l'écran de saisie.
 *
 * **Une requête à part, et non un élargissement de `getChantierPourHub`.**
 * Celui-là sert la fiche du chantier, appelée à chaque ouverture : lui ajouter
 * cinq colonnes dont elle n'affiche aucune les ferait voyager pour rien, et la
 * prochaine session ne saurait plus lesquelles servent vraiment.
 *
 * `clientId` est rendu tel quel : l'action a besoin de savoir s'il y a un client
 * à corriger ou un client à créer — c'est le cas de sa capture du 17 août, un
 * chantier qui n'en a aucun.
 */
export async function getChantierPourCoordonnees(ctx: Ctx, id: string) {
  if (!UUID_RE.test(id)) return null;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        adresseChantier: chantiers.adresseChantier,
        clientId: chantiers.clientId,
        clientNom: clients.nom,
        clientCivilite: clients.civilite,
        clientTelephone: clients.telephone,
        clientEmail: clients.email,
        clientAdresse: clients.adresse,
        clientCanal: clients.canalCommunication,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .where(and(eq(chantiers.id, id), isNull(chantiers.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function creerChantier(
  ctx: Ctx,
  data: { nom: string; adresseChantier?: string; clientId?: string | null }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(chantiers)
      .values({
        entrepriseId: ctx.entrepriseId,
        nom: data.nom,
        adresseChantier: data.adresseChantier,
        clientId: data.clientId ?? null,
        createdBy: ctx.utilisateurId,
        updatedBy: ctx.utilisateurId,
      })
      .returning();
    return row;
  });
}

/**
 * Reprendre un chantier existant : son adresse, son client, et son nom.
 *
 * **Née de sa demande du 17 août 2026** — *« lorsque s'affiche Adresse non
 * renseignée, je puisse cliquer dessus et que ça m'amène sur la page […] rien
 * de plus, rien de moins »*. L'écran d'arrivée est celui de la création, rouvert
 * sur un chantier qui existe : il lui fallait un second chemin, puisque
 * `creerChantier` ne sait qu'insérer.
 *
 * **LE NOM SE RECALCULE, ET C'EST TOUT L'INTÉRÊT.** `chantiers.nom` n'est pas
 * saisi : il se déduit du client, sinon de l'adresse, sinon de la date
 * (`nom-chantier.ts` — le champ « nom du chantier » a été retiré le 5 août 2026,
 * parce qu'un élagueur ne baptise pas ses chantiers). Sans ce recalcul, remplir
 * « Martins » laisserait la ligne afficher « Chantier du lundi 17 août » pour
 * toujours — c'est-à-dire exactement le défaut qu'il vient de signaler, corrigé
 * partout sauf là où il l'a vu.
 *
 * Le nom est donc passé par l'appelant, qui applique la MÊME règle qu'à la
 * création : une seconde règle de nommage ici finirait par diverger de l'autre
 * (`CLAUDE.md` §3).
 */
export async function reprendreChantier(
  ctx: Ctx,
  chantierId: string,
  data: { nom: string; adresseChantier?: string | null; clientId?: string | null }
) {
  if (!UUID_RE.test(chantierId)) return null;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(chantiers)
      .set({
        nom: data.nom,
        adresseChantier: data.adresseChantier?.trim() || null,
        // **Un client déjà rattaché ne se détache jamais ici.** L'écran ne
        // propose pas de le retirer ; `undefined` veut donc dire « n'y touche
        // pas », et non « efface ». Les confondre ferait perdre un client au
        // premier enregistrement où le nom n'aurait pas changé.
        ...(data.clientId === undefined ? {} : { clientId: data.clientId }),
        updatedBy: ctx.utilisateurId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(chantiers.id, chantierId),
          eq(chantiers.entrepriseId, ctx.entrepriseId),
          isNull(chantiers.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  });
}

async function marquerJalon(ctx: Ctx, chantierId: string, colonne: "informationsVerifieesAt" | "prixValideAt") {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(chantiers)
      .set({ [colonne]: new Date(), updatedBy: ctx.utilisateurId, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row;
  });
}

export const marquerInformationsVerifiees = (ctx: Ctx, chantierId: string) =>
  marquerJalon(ctx, chantierId, "informationsVerifieesAt");

export const marquerPrixValide = (ctx: Ctx, chantierId: string) => marquerJalon(ctx, chantierId, "prixValideAt");

/**
 * Pose une date à la main, depuis l'écran Planning.
 *
 * **Le créneau est choisi ici, comme il l'est quand un client répond.** Sans
 * cela, un chantier planifié à la main n'aurait ni moment ni durée, donc
 * occuperait la journée entière — et le patron, qui vient justement de gagner
 * la demi-journée, la reperdrait dès qu'il cale un chantier lui-même.
 *
 * Aucun refus ici, délibérément : le patron peut surcharger sa journée s'il le
 * décide. Ce sont ses clients qu'on protège d'une date impossible, pas lui de
 * lui-même. Le créneau retombe alors sur le matin, faute de place.
 */
/**
 * Ce que le patron a choisi en posant un chantier : quand, et par qui.
 *
 * **D'abord QUI, ensuite QUAND — et l'équipe vient encore après.** Sa demande
 * du 21 août 2026 : *« le "+ Ajouter un chantier" [...] le moment se choisit
 * après »*. Poser demandait autrefois l'équipe dans le même geste ; on se
 * trompait alors de client et il fallait tout reprendre. L'équipe se coche
 * ensuite, sur la ligne de la demi-journée, où elle est indépendante du matin
 * et de l'après-midi (`basculerEquipeDuChantier`).
 *
 * **Le moment est l'un des TROIS de l'écran** — matin, après-midi, journée — et
 * non un simple départ : « Matin » réserve une demi-journée, « Journée » en
 * réserve deux. C'est `departEtDuree` qui traduit, une fois pour toutes, et qui
 * protège au passage les chantiers de plusieurs jours (voir plus bas).
 */
export type ChoixDePose = { quand: QuandChantier };

/**
 * Coche ou décoche une équipe sur UNE demi-journée d'un chantier.
 *
 * **Ses deux demandes du 21 août 2026**, éprouvées sur la planche 84 puis
 * retenues : *« je dois pouvoir mettre toutes les équipes si je le souhaite,
 * sur la même demi-journée »*, et *« Paul le matin, Julien et Paul
 * l'après-midi : il faut que tout soit indépendant »*.
 *
 * **On coche, on ne choisit pas une seule fois.** C'est le geste de l'écran :
 * la liste reste ouverte, chaque appui bascule un nom, et le calendrier se
 * repeint derrière. Une fonction « poser l'équipe X » aurait obligé l'écran à
 * calculer la liste finale avant d'appeler — donc à porter la règle, ce que
 * `CLAUDE.md` §3 interdit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **RIEN N'EST REFUSÉ, ET C'EST SA RÈGLE.** L'ancienne version levait
 * `EquipeIndisponible` dès que l'équipe visée travaillait ailleurs au même
 * moment. Il l'a tranché le 21 août : *« il ne doit pas y avoir de limite
 * d'ajout de chantier par jour, ni même de gars du coup [...] nous, on prévient
 * juste »*. Le dépassement se VOIT — la barre du calendrier passe au bordeaux —
 * et il ne s'interdit pas : c'est lui qui sait qu'une taille de haie prend une
 * heure, et qu'une équipe peut enchaîner deux petits chantiers.
 *
 * **Ce que cela ne relâche PAS** : le chemin par lequel le CLIENT choisit sa
 * date garde ses limites (`jourRetenable`, `premiersJoursLibres`). Un client
 * n'a pas à savoir qu'une journée peut être forcée, et surtout pas à la forcer.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function basculerEquipeDuChantier(
  ctx: Ctx,
  chantierId: string,
  demi: Moment,
  rangEquipe: number
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // Le chantier doit exister DANS cette entreprise. Sans ce contrôle, la
    // seule barrière serait la FK composite — qui protège, mais rendrait une
    // erreur de base là où une ligne ignorée suffit.
    const [le] = await tx
      .select({ id: chantiers.id })
      .from(chantiers)
      .where(
        and(
          eq(chantiers.id, chantierId),
          eq(chantiers.entrepriseId, ctx.entrepriseId),
          isNull(chantiers.deletedAt)
        )
      )
      .limit(1);
    if (!le) return null;

    const equipeId = await idEquipeDeRang(tx, ctx.entrepriseId, rangEquipe);
    if (!equipeId) return null;

    const [deja] = await tx
      .select({ id: equipesDuChantier.id })
      .from(equipesDuChantier)
      .where(
        and(
          eq(equipesDuChantier.entrepriseId, ctx.entrepriseId),
          eq(equipesDuChantier.chantierId, chantierId),
          eq(equipesDuChantier.demi, demi),
          eq(equipesDuChantier.equipeId, equipeId)
        )
      )
      .limit(1);

    if (deja) {
      await tx.delete(equipesDuChantier).where(eq(equipesDuChantier.id, deja.id));
    } else {
      await tx
        .insert(equipesDuChantier)
        .values({ entrepriseId: ctx.entrepriseId, chantierId, demi, equipeId });
    }
    return lireEquipesDuChantier(tx, ctx.entrepriseId, chantierId);
  });
}

/**
 * Les équipes d'un chantier, demi-journée par demi-journée, en RANGS.
 *
 * Le rang et jamais l'identifiant : c'est le rang qui porte la lettre de repli
 * et l'ordre d'affichage, et un écran n'a rien à faire d'une clé étrangère
 * (`ARCHITECTURE.md` §51).
 */
export type EquipesParDemi = { matin: number[]; apres_midi: number[] };

async function lireEquipesDuChantier(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  entrepriseId: string,
  chantierId: string
): Promise<EquipesParDemi> {
  const lignes = await tx
    .select({ demi: equipesDuChantier.demi, rang: equipes.rang })
    .from(equipesDuChantier)
    .innerJoin(equipes, eq(equipesDuChantier.equipeId, equipes.id))
    .where(
      and(
        eq(equipesDuChantier.entrepriseId, entrepriseId),
        eq(equipesDuChantier.chantierId, chantierId)
      )
    );
  return rangerParDemi(lignes);
}

/**
 * Ranger des lignes plates en deux listes de rangs, TRIÉES.
 *
 * Le tri n'est pas cosmétique : sans lui, « Julien, Paul » deviendrait « Paul,
 * Julien » au prochain rechargement, selon l'ordre où les lignes sont revenues.
 * Un écran qui change tout seul entre deux visites fait douter d'un geste qu'on
 * n'a pas fait.
 */
export function rangerParDemi(
  lignes: readonly { demi: string; rang: number }[]
): EquipesParDemi {
  const par: EquipesParDemi = { matin: [], apres_midi: [] };
  for (const l of lignes) {
    if (l.demi === "matin") par.matin.push(l.rang);
    else if (l.demi === "apres_midi") par.apres_midi.push(l.rang);
  }
  par.matin.sort((a, b) => a - b);
  par.apres_midi.sort((a, b) => a - b);
  return par;
}

/**
 * Déplace un chantier posé : matin, après-midi, ou la journée.
 *
 * **Le jour ne bouge pas**, et c'est ce que l'écran promet — « Déplacer » vit
 * dans la fiche d'UN jour. Changer de jour se fait en retirant puis en reposant
 * ailleurs, ce qui est le même nombre de gestes et ne ment pas.
 *
 * **Un chantier plus long qu'une journée garde sa durée** (`departEtDuree`) :
 * « Journée » sur un chantier de trois jours le raccourcirait à deux
 * demi-journées, en silence, et il perdrait deux jours de travail sans qu'un
 * mot le lui dise.
 */
export async function deplacerChantier(
  ctx: Ctx,
  chantierId: string,
  quand: QuandChantier
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [courant] = await tx
      .select({ jour: chantiers.datePlanifiee, duree: chantiers.dureeDemiJournees })
      .from(chantiers)
      .where(
        and(
          eq(chantiers.id, chantierId),
          eq(chantiers.entrepriseId, ctx.entrepriseId),
          isNull(chantiers.deletedAt)
        )
      )
      .limit(1);
    // Déplacer ce qui n'est pas posé n'a pas de sens : il n'y a pas de jour où
    // le mettre. On rend `null` plutôt que d'inventer une date.
    if (!courant?.jour) return null;

    const { moment, duree } = departEtDuree(
      quand,
      courant.duree ?? DUREE_PAR_DEFAUT_DEMI_JOURNEES
    );

    const [row] = await tx
      .update(chantiers)
      .set({
        creneauDebut: moment,
        dureeDemiJournees: duree,
        updatedBy: ctx.utilisateurId,
        updatedAt: new Date(),
      })
      .where(and(eq(chantiers.id, chantierId), eq(chantiers.entrepriseId, ctx.entrepriseId)))
      .returning();
    return row ?? null;
  });
}


export async function planifierChantier(
  ctx: Ctx,
  chantierId: string,
  datePlanifiee: string,
  choix?: ChoixDePose
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const autres = await tx
      .select({
        id: chantiers.id,
        jour: chantiers.datePlanifiee,
        moment: chantiers.creneauDebut,
        duree: chantiers.dureeDemiJournees,
      })
      .from(chantiers)
      .where(
        and(
          eq(chantiers.entrepriseId, ctx.entrepriseId),
          isNull(chantiers.deletedAt),
          isNotNull(chantiers.datePlanifiee)
        )
      );

    const [entreprise] = await tx
      .select({ nombreEquipes: entreprises.nombreEquipes })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);

    const [courant] = await tx
      .select({ duree: chantiers.dureeDemiJournees, dureePrevue: chantiers.dureePrevue })
      .from(chantiers)
      .where(eq(chantiers.id, chantierId))
      .limit(1);
    const duree =
      courant?.duree ??
      dureeEnDemiJournees(courant?.dureePrevue ?? null) ??
      DUREE_PAR_DEFAUT_DEMI_JOURNEES;

    const nombreEquipes = entreprise?.nombreEquipes ?? 1;

    // **Les équipes absentes comptent ici aussi.** C'est le chemin par lequel
    // le patron POSE une date lui-même, sans passer par le client. L'oublier
    // aurait laissé poser un chantier le jour où l'équipe est en déplacement,
    // pendant que l'écran d'envoi refusait ce même jour : deux vérités sur la
    // place disponible (`CLAUDE.md` §3).
    //
    // Non borné à une fenêtre : cette requête-ci ne l'est pas non plus pour les
    // chantiers, et une absence lointaine ne coûte qu'une ligne.
    const absences = await tx
      .select({
        equipeId: absencesEquipe.equipeId,
        premierJour: absencesEquipe.premierJour,
        dernierJour: absencesEquipe.dernierJour,
      })
      .from(absencesEquipe)
      .where(
        and(
          eq(absencesEquipe.entrepriseId, ctx.entrepriseId),
          isNull(absencesEquipe.deletedAt)
        )
      );

    // La quatrième lecture de la même règle, et la dernière : elle choisit le
    // créneau quand le patron pose une date lui-même. Sans les équipes, elle
    // rangerait un chantier sur un matin que les trois autres tiennent pour
    // plein (`CLAUDE.md` §3).
    const equipesPosees = await equipesParChantier(tx, ctx.entrepriseId);
    const occupation = fusionnerAbsences(
      compterOccupation(
        autres
          .filter((a) => a.id !== chantierId && a.jour !== null)
          .map((a) => ({
            jour: a.jour as string,
            moment: a.moment === "matin" || a.moment === "apres_midi" ? a.moment : null,
            dureeDemiJournees: a.duree,
            equipesParDemi: equipesPosees.get(a.id) ?? null,
          })),
        nombreEquipes
      ),
      absences,
      nombreEquipes
    );
    const automatique = departPossible(datePlanifiee, duree, occupation, nombreEquipes) ?? "matin";

    // **Le moment choisi décide AUSSI de la durée réservée.** « Matin » réserve
    // une demi-journée, « Journée » en réserve deux — sans quoi les trois
    // boutons de l'écran feraient tous la même chose, et poser « Matin »
    // bloquerait l'après-midi sans qu'un mot le dise.
    //
    // **Sauf sur un chantier plus long qu'une journée**, qui garde la sienne :
    // elle vient de la dictée (« 3 jours » → six demi-journées), et la
    // raccourcir ici lui ferait perdre deux jours de travail en silence.
    const choisi = choix ? departEtDuree(choix.quand, duree) : null;

    // ═══════════════════════════════════════════════════════════════════
    // **LE CHOIX DU PATRON N'EST PLUS REFUSÉ.** Il le posait, ce créneau était
    // revalidé, et une demi-journée déjà pleine faisait échouer le geste.
    //
    // Sa décision du 21 août 2026 : *« il ne doit pas y avoir de limite d'ajout
    // de chantier par jour, ni même de gars du coup [...] nous, on prévient
    // juste »*. Le dépassement se VOIT — la barre du calendrier passe au
    // bordeaux, la fiche du jour écrit « 150 % de vos équipes » — et il ne
    // s'interdit pas : c'est lui qui sait qu'une taille de haie prend une heure.
    //
    // **Ce que cela ne relâche PAS** : le chemin par lequel le CLIENT choisit
    // sa date garde ses limites (`jourRetenable`, `premiersJoursLibres`). Un
    // client n'a pas à forcer une journée, ni même à savoir qu'on le peut.
    // ═══════════════════════════════════════════════════════════════════
    const creneauDebut: Moment = choisi ? choisi.moment : automatique;

    const [row] = await tx
      .update(chantiers)
      .set({
        datePlanifiee,
        creneauDebut,
        dureeDemiJournees: choisi ? choisi.duree : duree,
        updatedBy: ctx.utilisateurId,
        updatedAt: new Date(),
      })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row;
  });
}

// Retire la date de planification (« suppression » d'une intervention) — le
// chantier redevient "à planifier" si un devis a déjà été envoyé.
export async function deplanifierChantier(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(chantiers)
      .set({ datePlanifiee: null, updatedBy: ctx.utilisateurId, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row;
  });
}

/**
 * Pour l'écran Planning : les chantiers concernés par la planification (devis
 * déjà envoyé), avec le nom du client — même motif que
 * `listerChantiersPourAffichage`.
 *
 * **Les équipes descendent AVEC la liste**, en une requête de plus et non une
 * par chantier : la fiche du jour, le calendrier et la liste des planifiés les
 * lisent toutes les trois, et un aller-retour par pastille ferait attendre
 * l'écran là où il doit se lire d'un coup d'œil.
 */
export async function listerChantiersPourPlanning(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        clientNom: clients.nom,
        devisEnvoyeAt: chantiers.devisEnvoyeAt,
        datePlanifiee: chantiers.datePlanifiee,
        // Le créneau et la durée réservée : lisibles par le patron seul. Deux
        // chantiers peuvent désormais tomber le même jour, et sans cette
        // précision son planning ne lui dirait plus lequel passe en premier.
        creneauDebut: chantiers.creneauDebut,
        dureeDemiJournees: chantiers.dureeDemiJournees,
        // Les deux jalons de fin : sans eux, le planning ne peut pas savoir
        // qu'un chantier a été clôturé et continue de l'afficher comme à venir.
        // C'est ce qui est arrivé jusqu'au 8 août 2026 — voir
        // `src/lib/onglet-chantier.ts`.
        termineAt: chantiers.termineAt,
        factureEnvoyeeAt: chantiers.factureEnvoyeeAt,
        // La durée dictée sert à savoir combien de demi-journées poser quand le
        // chantier n'a pas encore de durée réservée.
        dureePrevue: chantiers.dureePrevue,
        // L'adresse et le téléphone descendent avec la liste, et non derrière un
        // second aller-retour au moment du geste : le patron ouvre « Y aller »
        // sur un chantier, en voiture, souvent sans réseau. Une feuille qui doit
        // aller chercher l'adresse arrive vide exactement là où elle sert.
        adresseChantier: chantiers.adresseChantier,
        clientTelephone: clients.telephone,
        // Le pense-bête, lu sur la feuille de chantier. Il descend avec la
        // liste plutôt qu'au moment du geste : le patron ouvre sa feuille en
        // voiture, souvent sans réseau — la même raison que l'adresse.
        note: chantiers.note,
        ...DERNIER_ENVOI,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      // **UN CHANTIER QUI PORTE UNE DATE EST TOUJOURS MONTRÉ.**
      //
      // *Sa panne du 22 août 2026 :* « tu vois bien que le chantier de Bernard
      // n'est pas indiqué [...] juste le chantier n'apparaît pas sur le
      // calendrier » — capture du 24 à l'appui, matin libre, après-midi libre.
      //
      // Cette liste n'admettait que les chantiers dont le devis est PARTI. Or
      // le calcul de capacité, lui, compte **tous** les chantiers datés
      // (`contrainteDuPlanning`, `compterOccupation`) : un chantier daté sans
      // devis envoyé prenait donc la place — l'écran d'envoi refusait ce jour
      // au client — pendant que le planning l'affichait vide. Deux vérités sur
      // la même journée, à deux écrans d'écart, et c'est précisément ce que
      // `CLAUDE.md` §3 interdit.
      //
      // Le devis envoyé reste un motif d'affichage — un chantier en attente de
      // date doit se voir dans « Sans date » —, mais il n'en est plus le SEUL :
      // une date posée suffit. Rien de ce qui occupe une journée ne peut plus
      // rester invisible.
      //
      // **ET UNE BORNE BASSE, DEPUIS LE 31 AOÛT 2026.** Cette liste n'en avait
      // AUCUNE : tous les chantiers datés depuis la création de l'entreprise
      // descendaient dans son téléphone à chaque ouverture du planning, et
      // l'écran les jetait aussitôt sans rien en montrer. Un poids qui grossit
      // pour toujours, au service de rien.
      //
      // Le calendrier garde désormais deux ans (`MEMOIRE_CALENDRIER_JOURS`,
      // son choix du 31 août) : la requête s'arrête au même jour que l'écran,
      // et pas un jour plus tôt — sinon un chantier serait chargé sans être
      // peint, ou peint sans être chargé. Au-delà, la mémoire longue est
      // « Terminés », qui a sa propre requête.
      //
      // **Un chantier SANS date passe toujours** : c'est « Sans date » et
      // « En attente du client », qui ne dépendent d'aucun jour.
      .where(
        and(
          isNull(chantiers.deletedAt),
          or(isNotNull(chantiers.devisEnvoyeAt), isNotNull(chantiers.datePlanifiee)),
          or(
            isNull(chantiers.datePlanifiee),
            gte(chantiers.datePlanifiee, seuilMemoireCalendrier())
          )
        )
      );

    // **Les rangs, jamais les identifiants** : c'est le rang qui porte la
    // lettre de repli et l'ordre d'affichage, et ce qui part vers un composant
    // client part vers le navigateur (`docs/AGENT.md` §2.2 bis).
    const attributions = await tx
      .select({
        chantierId: equipesDuChantier.chantierId,
        demi: equipesDuChantier.demi,
        rang: equipes.rang,
      })
      .from(equipesDuChantier)
      .innerJoin(equipes, eq(equipesDuChantier.equipeId, equipes.id))
      .where(eq(equipesDuChantier.entrepriseId, ctx.entrepriseId));

    const parChantier = new Map<string, { demi: string; rang: number }[]>();
    for (const a of attributions) {
      const siennes = parChantier.get(a.chantierId) ?? [];
      siennes.push({ demi: a.demi, rang: a.rang });
      parChantier.set(a.chantierId, siennes);
    }

    return lignes.map((l) => ({
      ...l,
      equipes: rangerParDemi(parChantier.get(l.id) ?? []),
    }));
  });
}

/**
 * Écrit le pense-bête d'un chantier.
 *
 * **Sa demande du 23 août 2026** : *« un petit encadré où l'utilisateur peut
 * marquer quelque chose — penser à prendre le broyeur, client plus disponible à
 * partir de neuf heures »*.
 *
 * **Le vide efface**, il ne stocke pas une chaîne creuse : une note effacée doit
 * redevenir absente, sans quoi l'écran afficherait un cadre « rempli de rien »
 * qu'on ne saurait plus distinguer d'une note oubliée.
 *
 * **Tronquée ici plutôt que refusée.** La borne en base ferait rougir une
 * écriture faite au doigt, et il perdrait ce qu'il vient d'écrire — alors qu'il
 * n'a aucun moyen de compter ses caractères. Deux mille caractères, c'est déjà
 * une page : personne n'y arrive en notant un broyeur.
 */
export async function ecrireNoteChantier(ctx: Ctx, chantierId: string, note: string | null) {
  if (!UUID_RE.test(chantierId)) return null;
  const propre = (note ?? "").trim();
  const valeur = propre ? propre.slice(0, NOTE_MAX) : null;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(chantiers)
      .set({ note: valeur, updatedBy: ctx.utilisateurId, updatedAt: new Date() })
      .where(
        and(
          eq(chantiers.id, chantierId),
          eq(chantiers.entrepriseId, ctx.entrepriseId),
          isNull(chantiers.deletedAt)
        )
      )
      .returning({ note: chantiers.note });
    return row ?? null;
  });
}

export async function mettreAJourDureeEquipe(
  ctx: Ctx,
  chantierId: string,
  data: { dureePrevue?: string; tailleEquipe?: string }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(chantiers)
      .set({ ...data, updatedBy: ctx.utilisateurId, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row;
  });
}

/**
 * L'adresse du chantier, corrigée depuis le devis.
 *
 * C'est la seule adresse que le client lit sur son devis — et jusqu'ici elle ne
 * se saisissait qu'à la création, une fois pour toutes. Un chiffre de rue faux
 * ne se rattrapait plus.
 */
export async function mettreAJourAdresseChantier(ctx: Ctx, chantierId: string, adresse: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(chantiers)
      .set({ adresseChantier: adresse.trim() || null, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row ?? null;
  });
}

/**
 * Retire un chantier de la vue du patron — sans effacer quoi que ce soit.
 *
 * Le patron, le 6 août 2026 : « je veux pouvoir supprimer un chantier mis au
 * planning ». Un essai raté, un doublon, un client qui se désiste : sans ce
 * geste, sa liste se remplit de choses mortes qu'il ne peut plus enlever.
 *
 * **Suppression douce**, comme pour les photos : `deleted_at` est posé, les
 * lignes restent. Une suppression physique emporterait le devis, ses envois et
 * la réponse du client — des traces qui ont valeur de preuve.
 *
 * **Refusée dès qu'une facture est émise.** Une facture est une pièce
 * comptable numérotée : elle figure au relevé de TVA, et rien ne doit pouvoir
 * la faire disparaître d'un glissement du doigt. La correction passe par un
 * avoir, jamais par un effacement (`docs/AGENT.md` §2.3).
 */
export class SuppressionChantierRefusee extends Error {
  constructor(readonly motif: "facture_emise" | "introuvable") {
    super(motif);
    this.name = "SuppressionChantierRefusee";
  }
}

export async function supprimerChantier(ctx: Ctx, chantierId: string): Promise<void> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [chantier] = await tx
      .select()
      .from(chantiers)
      .where(and(eq(chantiers.id, chantierId), isNull(chantiers.deletedAt)))
      .limit(1);
    if (!chantier) throw new SuppressionChantierRefusee("introuvable");

    const [factureEmise] = await tx
      .select({ id: factures.id })
      .from(factures)
      .where(and(eq(factures.chantierId, chantierId), eq(factures.statut, "emise")))
      .limit(1);
    if (factureEmise) throw new SuppressionChantierRefusee("facture_emise");

    await tx
      .update(chantiers)
      .set({ deletedAt: new Date(), updatedBy: ctx.utilisateurId, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId));
  });
}

/**
 * Ce qu'il faut savoir d'un chantier pour le situer sur la carte.
 *
 * `adresseSituee` porte l'adresse qui a produit les coordonnées : c'est elle,
 * et non leur seule présence, qui dit si elles sont encore valables.
 */
export type ChantierASituer = {
  id: string;
  adresseChantier: string;
  adresseSituee: string | null;
};

/**
 * Les chantiers dont les coordonnées manquent — ou ne valent plus rien.
 *
 * **Deux cas, un seul traitement.** Un chantier créé avant la migration 0049
 * n'a jamais eu de coordonnées ; un chantier dont le patron a corrigé l'adresse
 * en a de fausses, ce qui est pire — elles ne se signalent pas. Comparer
 * `adresse_situee` à `adresse_chantier` attrape les deux d'un coup, et rend le
 * rattrapage automatique plutôt que déclenché à la main.
 *
 * **Borné, toujours.** Chaque ligne rendue coûtera un appel à la Base Adresse
 * Nationale. Une liste sans limite, sur une entreprise qui a trois cents
 * chantiers, ferait trois cents appels à l'ouverture d'un écran.
 */
export async function chantiersASituer(ctx: Ctx, limite: number): Promise<ChantierASituer[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select({
        id: chantiers.id,
        adresseChantier: chantiers.adresseChantier,
        adresseSituee: chantiers.adresseSituee,
      })
      .from(chantiers)
      .where(
        and(
          isNull(chantiers.deletedAt),
          isNotNull(chantiers.adresseChantier),
          sql`btrim(${chantiers.adresseChantier}) <> ''`,
          sql`${chantiers.adresseSituee} IS DISTINCT FROM ${chantiers.adresseChantier}`
        )
      )
      .limit(limite);
    return rows.filter((r): r is ChantierASituer => r.adresseChantier !== null);
  });
}

/**
 * Range les coordonnées trouvées, avec l'adresse qui les a produites.
 *
 * **`adresseSituee` s'écrit MÊME quand on n'a rien trouvé** (coordonnées à
 * `null`) : sans cela, une adresse introuvable serait resoumise à chaque
 * ouverture du planning, indéfiniment, pour le même échec. C'est la trace de
 * l'essai, pas seulement celle du succès.
 */
export async function enregistrerCoordonneesChantier(
  ctx: Ctx,
  chantierId: string,
  coord: { latitude: number; longitude: number } | null,
  adresseSituee: string
): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(chantiers)
      .set({
        latitude: coord ? String(coord.latitude) : null,
        longitude: coord ? String(coord.longitude) : null,
        adresseSituee,
        updatedAt: new Date(),
      })
      .where(eq(chantiers.id, chantierId));
  });
}

export type ChantierSitue = {
  id: string;
  nom: string;
  clientNom: string | null;
  adresseChantier: string | null;
  latitude: number | null;
  longitude: number | null;
};

/** Un chantier posé sur une demi-journée, avec ce qu'il faut pour mesurer. */
export async function lireChantierSitue(ctx: Ctx, chantierId: string): Promise<ChantierSitue | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        clientNom: clients.nom,
        adresseChantier: chantiers.adresseChantier,
        latitude: chantiers.latitude,
        longitude: chantiers.longitude,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .where(and(eq(chantiers.id, chantierId), isNull(chantiers.deletedAt)))
      .limit(1);
    const r = rows[0];
    return r ? { ...r, latitude: enNombre(r.latitude), longitude: enNombre(r.longitude) } : null;
  });
}

/**
 * Les chantiers d'une demi-journée qui attendent une date.
 *
 * **Ce que « d'une demi-journée » veut dire ici.** Pas `dureeDemiJournees` —
 * cette colonne ne se remplit qu'à la pose, et ces chantiers-là ne sont
 * justement pas posés. C'est la durée dictée (`dureePrevue`) qui le dit, lue par
 * `dureeEnDemiJournees` : la même fonction que partout ailleurs, jamais une
 * seconde règle qui finirait par diverger (`CLAUDE.md` §3).
 *
 * Le filtre se fait en TypeScript et non en SQL parce que cette lecture est du
 * langage — « une demi-journée », « ½ journée », « 0,5 jour ». La réécrire en
 * SQL serait la dupliquer.
 */
export async function chantiersDemiJourneeAPlanifier(ctx: Ctx): Promise<ChantierSitue[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        clientNom: clients.nom,
        adresseChantier: chantiers.adresseChantier,
        latitude: chantiers.latitude,
        longitude: chantiers.longitude,
        dureePrevue: chantiers.dureePrevue,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .where(
        and(
          isNull(chantiers.deletedAt),
          // Un devis parti : avant cela, le chantier n'a rien à faire dans un
          // planning — c'est la règle que suit déjà `listerChantiersPourPlanning`.
          isNotNull(chantiers.devisEnvoyeAt),
          isNull(chantiers.datePlanifiee),
          isNull(chantiers.termineAt)
        )
      );

    return rows
      .filter((r) => dureeEnDemiJournees(r.dureePrevue) === 1)
      .map((r) => ({
        id: r.id,
        nom: r.nom,
        clientNom: r.clientNom,
        adresseChantier: r.adresseChantier,
        latitude: enNombre(r.latitude),
        longitude: enNombre(r.longitude),
      }));
  });
}

/**
 * `numeric` revient en texte du pilote PostgreSQL — et c'est voulu de sa part :
 * un `numeric` peut dépasser ce qu'un nombre JavaScript sait porter. Pour des
 * degrés à six décimales, la conversion est sûre ; ailleurs elle ne le serait
 * pas, d'où cette fonction plutôt qu'un `Number()` semé dans les requêtes.
 */
function enNombre(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}


/**
 * LES CHANTIERS D'UNE FILE DU PLANNING — pour la portée resserrée d'un salarié.
 *
 * Sa règle du 13 août 2026 : *« Accès à tout, mais le patron choisira s'il a
 * accès qu'à ses chantiers ou à tout. »*
 *
 * **Rend les identifiants, pas les chantiers.** Le planning charge déjà sa
 * liste ; refaire ici une seconde requête complète en produirait deux versions,
 * qui divergeraient au premier champ ajouté d'un seul côté (`CLAUDE.md` §3). Ce
 * qu'on cherche est un TAMIS, pas une liste.
 *
 * **Une demi-journée suffit.** Un chantier tenu par l'équipe B le mardi matin et
 * par l'équipe A l'après-midi est un chantier de l'équipe B : le salarié doit
 * le voir, sans quoi il ne saurait pas où aller mardi matin.
 */
export async function chantiersDeLEquipe(ctx: Ctx, equipeId: string): Promise<Set<string>> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .selectDistinct({ chantierId: equipesDuChantier.chantierId })
      .from(equipesDuChantier)
      .where(
        and(eq(equipesDuChantier.entrepriseId, ctx.entrepriseId), eq(equipesDuChantier.equipeId, equipeId))
      );
    return new Set(lignes.map((l) => l.chantierId));
  });
}
