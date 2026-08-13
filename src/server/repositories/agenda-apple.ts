import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { PeriodeOccupee } from "../../lib/agenda-externe";
import { DEBUT_MATIN, FIN_JOURNEE, FUSEAU_ARTISAN, MIDI } from "../../lib/agenda-externe";
import { instantDepuisLocal } from "../../lib/fuseau";
import { construireVevenement, identifiantEvenement } from "../../lib/ics";
import type { AgendaDistant } from "../../lib/caldav";
import {
  decouvrirAgendas,
  periodesOccupeesApple,
  poserEvenement,
  retirerEvenement,
  type IdentifiantsApple,
} from "../agenda/apple";
import { chiffrer, dechiffrer } from "../agenda/secret-au-repos";
import { agendasExternes, chantiers, clients } from "../db/schema";
import { creneauxDuChantier, type Moment } from "../disponibilites";
import {
  executeurDeSession,
  messageDePanne,
  type Executeur,
} from "./agenda-executeur";
import type { Ctx } from "./context";

/**
 * L'agenda iCloud d'une entreprise : le brancher, le lire, y écrire.
 *
 * **Sa demande du 12 août 2026**, capture du Calendrier d'Apple à l'appui :
 * *« je peux connecter ce calendrier à mon appli ? »* — puis *« code pour qu'on
 * puisse lire et écrire dans cet agenda »*. Le compte derrière la vitrine est
 * iCloud : le Calendrier d'Apple affiche aussi bien iCloud que Gmail, et c'est
 * le compte qu'on relie, jamais l'application.
 *
 * **Ce qui distingue ce raccordement de celui de Google, et qui commande tout
 * ce fichier :** Apple n'a pas de consentement révocable par portée. Le mot de
 * passe spécifique à l'app ouvre le compte entier, il est recopié à la main, et
 * il ne s'annule que depuis le compte Apple. Trois conséquences écrites dans le
 * code plutôt que dans un commentaire d'écran : il est chiffré au repos, il
 * n'est jamais renvoyé à l'écran, et l'écriture reste éteinte tant que
 * l'artisan ne l'a pas allumée.
 */

const FOURNISSEUR = "apple" as const;

/** Ce que l'écran des réglages a besoin de savoir. Jamais le mot de passe. */
export type EtatAgendaApple = {
  relie: boolean;
  /** L'adresse iCloud branchée, pour qu'il sache LAQUELLE. */
  compte: string | null;
  actif: boolean;
  derniereLectureAt: Date | null;
  derniereErreur: string | null;
  /** Atlas écrit-il ses chantiers dans l'agenda ? Éteint par défaut. */
  ecritureActive: boolean;
  calendrierEcriture: string | null;
  calendrierEcritureNom: string | null;
  derniereEcritureAt: Date | null;
  derniereErreurEcriture: string | null;
  /** Les agendas lus. Vide = tous ceux qu'Apple a rendus. */
  agendasLus: string[];
};

async function ligneApple(executer: Executeur, entrepriseId: string) {
  return executer(async (tx) => {
    const [l] = await tx
      .select()
      .from(agendasExternes)
      .where(
        and(
          eq(agendasExternes.entrepriseId, entrepriseId),
          eq(agendasExternes.fournisseur, FOURNISSEUR)
        )
      )
      .limit(1);
    return l ?? null;
  });
}

export async function etatAgendaApple(ctx: Ctx): Promise<EtatAgendaApple> {
  const ligne = await ligneApple(executeurDeSession(ctx), ctx.entrepriseId);
  return {
    relie: Boolean(ligne?.motDePasse),
    compte: ligne?.compte ?? null,
    actif: ligne?.actif ?? false,
    derniereLectureAt: ligne?.derniereLectureAt ?? null,
    derniereErreur: ligne?.derniereErreur ?? null,
    ecritureActive: ligne?.ecritureActive ?? false,
    calendrierEcriture: ligne?.calendrierEcriture ?? null,
    calendrierEcritureNom: ligne?.calendrierEcritureNom ?? null,
    derniereEcritureAt: ligne?.derniereEcritureAt ?? null,
    derniereErreurEcriture: ligne?.derniereErreurEcriture ?? null,
    agendasLus: ligne?.agendasLus ?? [],
  };
}

/** Les identifiants en clair, ou `null` si rien n'est relié. */
async function identifiants(
  executer: Executeur,
  entrepriseId: string
): Promise<{ id: IdentifiantsApple; ligne: typeof agendasExternes.$inferSelect } | null> {
  const ligne = await ligneApple(executer, entrepriseId);
  if (!ligne || !ligne.compte || !ligne.motDePasse) return null;
  const motDePasse = dechiffrer(ligne.motDePasse);
  // Mot de passe illisible — `AUTH_SECRET` changé, ligne abîmée. Traiter comme
  // « non relié » plutôt que jeter : l'écran montre alors le bouton pour
  // rebrancher, qui est exactement la bonne action.
  if (!motDePasse) return null;
  return { id: { compte: ligne.compte, motDePasse }, ligne };
}

/**
 * Relie le compte, et rend les agendas trouvés.
 *
 * **L'appel réseau a lieu AVANT toute écriture, et c'est le point important.**
 * Un mot de passe mal recopié — l'espace de trop, la lettre manquante — doit
 * produire un refus immédiat et lisible, pas une ligne « reliée » qui échouera
 * silencieusement à la première lecture. Ce que l'artisan a sous les yeux au
 * moment où il appuie est le seul instant où il peut corriger.
 */
export async function relierAgendaApple(
  ctx: Ctx,
  saisie: { compte: string; motDePasse: string }
): Promise<AgendaDistant[]> {
  const compte = saisie.compte.trim();
  // Apple présente le mot de passe en quatre groupes séparés par des tirets ;
  // recopié depuis un téléphone, il arrive avec des espaces. Les retirer évite
  // un refus que l'artisan ne saurait pas expliquer — et le format d'Apple ne
  // contient jamais d'espace significative.
  const motDePasse = saisie.motDePasse.replace(/\s+/g, "");
  if (!compte || !motDePasse) {
    throw new Error("Il faut l'adresse iCloud et le mot de passe pour les apps.");
  }

  const trouves = await decouvrirAgendas({ compte, motDePasse });
  if (trouves.length === 0) {
    throw new Error(
      "Ce compte a bien répondu, mais Atlas n'y a trouvé aucun agenda où lire des rendez-vous."
    );
  }

  await executeurDeSession(ctx)(async (tx) => {
    await tx
      .insert(agendasExternes)
      .values({
        entrepriseId: ctx.entrepriseId,
        fournisseur: FOURNISSEUR,
        compte,
        motDePasse: chiffrer(motDePasse),
        // Tous les agendas trouvés sont lus d'emblée : c'est ce qui protège du
        // doublon dès la première seconde. Restreindre reste possible ensuite ;
        // l'inverse — ne rien lire tant qu'il n'a pas choisi — laisserait le
        // trou ouvert en donnant l'impression qu'il est bouché.
        agendasLus: trouves.map((a) => a.href),
        actif: true,
        derniereErreur: null,
        // **L'écriture ne s'allume pas d'elle-même**, même sur un rebranchement.
        ecritureActive: false,
        derniereErreurEcriture: null,
      })
      .onConflictDoUpdate({
        target: [agendasExternes.entrepriseId, agendasExternes.fournisseur],
        set: {
          compte,
          motDePasse: chiffrer(motDePasse),
          agendasLus: trouves.map((a) => a.href),
          actif: true,
          derniereErreur: null,
          updatedAt: new Date(),
        },
      });
  });

  return trouves;
}

/** Redemande la liste des agendas à Apple, pour l'écran de choix. */
export async function listerAgendasApple(ctx: Ctx): Promise<AgendaDistant[]> {
  const ident = await identifiants(executeurDeSession(ctx), ctx.entrepriseId);
  if (!ident) throw new Error("Aucun agenda iCloud n'est relié.");
  return decouvrirAgendas(ident.id);
}

/** Quels agendas Atlas consulte. Le vide vaut « tous ceux qu'on trouvera ». */
export async function choisirAgendasLus(ctx: Ctx, adresses: string[]): Promise<void> {
  await executeurDeSession(ctx)(async (tx) => {
    await tx
      .update(agendasExternes)
      .set({ agendasLus: adresses, updatedAt: new Date() })
      .where(clauseApple(ctx.entrepriseId));
  });
}

/**
 * Où Atlas écrit, et s'il écrit.
 *
 * **Allumer l'écriture sans agenda désigné est refusé**, plutôt que d'en
 * choisir un au hasard. Poser les chantiers de quelqu'un dans son calendrier
 * familial parce qu'il était premier dans la liste est exactement le genre de
 * décision qu'un logiciel ne prend pas à la place de son utilisateur.
 */
export async function reglerEcritureApple(
  ctx: Ctx,
  reglage: { active: boolean; calendrier?: { href: string; nom: string } | null }
): Promise<void> {
  const executer = executeurDeSession(ctx);
  const ligne = await ligneApple(executer, ctx.entrepriseId);
  if (!ligne) throw new Error("Aucun agenda iCloud n'est relié.");

  const calendrier =
    reglage.calendrier === undefined
      ? { href: ligne.calendrierEcriture, nom: ligne.calendrierEcritureNom }
      : reglage.calendrier === null
        ? { href: null, nom: null }
        : { href: reglage.calendrier.href, nom: reglage.calendrier.nom };

  if (reglage.active && !calendrier.href) {
    throw new Error("Choisissez d'abord dans quel calendrier Atlas doit écrire.");
  }

  await executer(async (tx) => {
    await tx
      .update(agendasExternes)
      .set({
        ecritureActive: reglage.active,
        calendrierEcriture: calendrier.href,
        calendrierEcritureNom: calendrier.nom,
        derniereErreurEcriture: null,
        updatedAt: new Date(),
      })
      .where(clauseApple(ctx.entrepriseId));
  });

  // Allumer l'écriture ne vaut rien si les chantiers déjà posés n'y montent
  // pas : l'artisan verrait un agenda vide et croirait le raccordement mort.
  if (reglage.active) {
    await resynchroniserAgendaApple(ctx);
    return;
  }

  // **Éteindre RETIRE ce qui a été posé, et ce n'est pas du zèle.** Laisser les
  // rendez-vous en place ferait vieillir son agenda en silence : il replanifie,
  // Atlas n'écrit plus, et le Calendrier continue d'afficher des dates qui
  // n'existent plus. Un agenda qui ment est pire qu'un agenda vide — c'est
  // exactement le défaut que tout ce raccordement existe pour supprimer.
  if (ligne.calendrierEcriture) {
    await retirerToutCeQuAtlasAPose(ctx, ligne.calendrierEcriture);
  }
}

/**
 * Retire de l'agenda tous les rendez-vous posés par Atlas.
 *
 * Ne jette pas : ce qui n'a pas pu être retiré est inscrit et l'écran le montre.
 * Faire échouer l'extinction parce qu'Apple ne répond pas laisserait l'artisan
 * avec un réglage qu'il ne peut pas couper.
 */
async function retirerToutCeQuAtlasAPose(ctx: Ctx, calendrier: string): Promise<void> {
  const executer = executeurDeSession(ctx);
  const ident = await identifiants(executer, ctx.entrepriseId);
  if (!ident) return;
  try {
    for (const c of await chantiersPlanifies(executer, ctx.entrepriseId)) {
      await retirerEvenement(ident.id, calendrier, identifiantEvenement(c.id));
    }
    await noterEcriture(executer, ctx.entrepriseId, null);
  } catch (e) {
    await noterEcriture(
      executer,
      ctx.entrepriseId,
      `L'écriture est coupée, mais des rendez-vous posés par Atlas sont restés dans votre agenda : ${messageDePanne(e)}`
    );
  }
}

/** Coupe la lecture sans effacer le raccordement. */
export async function basculerAgendaApple(ctx: Ctx, actif: boolean): Promise<void> {
  await executeurDeSession(ctx)(async (tx) => {
    await tx
      .update(agendasExternes)
      .set({ actif, updatedAt: new Date() })
      .where(clauseApple(ctx.entrepriseId));
  });
}

/**
 * Débranche : retire d'abord ce qu'Atlas a posé, puis oublie le compte.
 *
 * **Le ménage vient EN PREMIER, et il n'est pas facultatif.** C'est la promesse
 * faite à l'écran : « ce qu'Atlas a écrit se retire d'un geste ». Effacer la
 * ligne d'abord perdrait le mot de passe, donc le seul moyen d'aller reprendre
 * les rendez-vous — et l'artisan les retrouverait un par un, à la main, dans
 * son téléphone.
 *
 * **Un ménage qui échoue n'empêche PAS de débrancher.** Le raccordement doit
 * pouvoir être coupé même quand Apple ne répond plus : ce qui est resté est
 * dit, ce n'est pas une raison de garder un mot de passe dont l'artisan ne veut
 * plus.
 */
export async function debrancherAgendaApple(ctx: Ctx): Promise<{ restes: string | null }> {
  const executer = executeurDeSession(ctx);
  const ident = await identifiants(executer, ctx.entrepriseId);
  let restes: string | null = null;

  if (ident && ident.ligne.calendrierEcriture) {
    try {
      const poses = await chantiersPlanifies(executer, ctx.entrepriseId);
      for (const c of poses) {
        await retirerEvenement(ident.id, ident.ligne.calendrierEcriture, identifiantEvenement(c.id));
      }
    } catch (e) {
      restes = messageDePanne(e);
    }
  }

  await executer(async (tx) => {
    await tx.delete(agendasExternes).where(clauseApple(ctx.entrepriseId));
  });

  return { restes };
}

function clauseApple(entrepriseId: string) {
  return and(
    eq(agendasExternes.entrepriseId, entrepriseId),
    eq(agendasExternes.fournisseur, FOURNISSEUR)
  );
}

/**
 * Les périodes occupées de l'agenda iCloud, ou une liste vide.
 *
 * **Ne jette jamais**, exactement comme son équivalent Google : une panne
 * d'Apple ne doit empêcher ni le patron de préparer un envoi ni le client
 * d'ouvrir son devis. Mais l'échec n'est pas avalé — il est écrit dans
 * `derniere_erreur`, et l'écran des réglages le montre. C'est la seule façon
 * honnête de tenir les deux bouts : Atlas continue de fonctionner, revenu à son
 * ancien comportement, **et il le dit**.
 */
export async function periodesApple(
  executer: Executeur,
  entrepriseId: string,
  debut: Date,
  fin: Date
): Promise<PeriodeOccupee[]> {
  const ident = await identifiants(executer, entrepriseId);
  if (!ident || !ident.ligne.actif) return [];

  try {
    // Le tableau vide vaut « tous ceux qu'on trouvera » : c'est l'état d'un
    // compte relié dont l'artisan n'a rien restreint.
    const adresses =
      ident.ligne.agendasLus.length > 0
        ? ident.ligne.agendasLus
        : (await decouvrirAgendas(ident.id)).map((a) => a.href);

    const periodes = await periodesOccupeesApple(ident.id, adresses, debut, fin);
    await noterLectureApple(executer, entrepriseId, null);
    return periodes;
  } catch (e) {
    await noterLectureApple(executer, entrepriseId, messageDePanne(e));
    return [];
  }
}

async function noterLectureApple(
  executer: Executeur,
  entrepriseId: string,
  erreur: string | null
): Promise<void> {
  await executer(async (tx) => {
    await tx
      .update(agendasExternes)
      .set({ derniereLectureAt: new Date(), derniereErreur: erreur, updatedAt: new Date() })
      .where(clauseApple(entrepriseId));
  });
}

// ─── L'autre sens : écrire les chantiers dans l'agenda ─────────────────────

type ChantierAEcrire = {
  id: string;
  nom: string;
  adresse: string | null;
  clientNom: string | null;
  jour: string;
  moment: Moment;
  duree: number;
};

async function chantiersPlanifies(
  executer: Executeur,
  entrepriseId: string,
  chantierId?: string
): Promise<ChantierAEcrire[]> {
  const lignes = await executer(async (tx) =>
    tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        adresse: chantiers.adresseChantier,
        clientNom: clients.nom,
        jour: chantiers.datePlanifiee,
        moment: chantiers.creneauDebut,
        duree: chantiers.dureeDemiJournees,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .where(
        and(
          eq(chantiers.entrepriseId, entrepriseId),
          isNull(chantiers.deletedAt),
          isNotNull(chantiers.datePlanifiee),
          ...(chantierId ? [eq(chantiers.id, chantierId)] : [])
        )
      )
  );

  return lignes
    .filter((l): l is typeof l & { jour: string } => typeof l.jour === "string")
    .map((l) => ({
      id: l.id,
      nom: l.nom,
      adresse: l.adresse,
      clientNom: l.clientNom,
      jour: l.jour,
      // Un chantier planifié avant l'existence des créneaux n'a pas de moment :
      // il occupe la journée, donc il commence le matin.
      moment: l.moment === "apres_midi" ? "apres_midi" : "matin",
      duree: Math.max(1, l.duree ?? 2),
    }));
}

/**
 * Les deux instants que couvre un chantier, en UTC.
 *
 * **Les bornes viennent de `agenda-externe.ts`, jamais réécrites ici.** Ce sont
 * les mêmes qui servent à décider qu'un rendez-vous de 10 h occupe la matinée :
 * si l'écriture employait ses propres heures, Atlas poserait un chantier de 9 h
 * à midi tout en considérant que la matinée va de 8 h à 13 h. Deux vérités pour
 * une même journée, et la divergence se découvrirait sur un doublon.
 */
export function bornesDuChantier(
  jour: string,
  moment: Moment,
  dureeDemiJournees: number,
  fuseau: string = FUSEAU_ARTISAN
): { debut: Date; fin: Date } | null {
  const creneaux = creneauxDuChantier({ jour, moment }, dureeDemiJournees);
  const premier = creneaux[0];
  const dernier = creneaux[creneaux.length - 1];
  if (!premier || !dernier) return null;

  const [a1, m1, j1] = premier.jour.split("-").map(Number);
  const [a2, m2, j2] = dernier.jour.split("-").map(Number);
  if (!a1 || !a2) return null;

  const debut = instantDepuisLocal(
    { annee: a1, mois: m1, jour: j1, heure: premier.moment === "matin" ? DEBUT_MATIN : MIDI },
    fuseau
  );
  const fin = instantDepuisLocal(
    { annee: a2, mois: m2, jour: j2, heure: dernier.moment === "matin" ? MIDI : FIN_JOURNEE },
    fuseau
  );
  if (fin.getTime() <= debut.getTime()) return null;
  return { debut, fin };
}

/**
 * L'intitulé que l'artisan lira dans son Calendrier.
 *
 * **Le nom du client y figure, et c'est voulu** : c'est SON agenda, sur SON
 * téléphone. La règle qui protège la vie privée des clients vise ce qui part
 * chez un TIERS — la page publique du devis ne reçoit que des dates
 * (`docs/AGENT.md` §2.2 bis). Ici, l'artisan lit ce qu'il sait déjà, et un
 * rendez-vous sans nom ne lui servirait à rien.
 *
 * **Rien n'est inventé** : un chantier sans client garde son seul nom.
 */
export function intituleChantier(c: { nom: string; clientNom: string | null }): string {
  return c.clientNom ? `${c.nom} — ${c.clientNom}` : c.nom;
}

/**
 * Porte un chantier dans l'agenda, ou l'en retire s'il n'est plus planifié.
 *
 * **Ne jette jamais, et note ce qui a échoué.** Poser un chantier au planning
 * ne doit pas échouer parce qu'Apple ne répond pas : le patron perdrait son
 * geste pour une panne qui ne le concerne pas. Ce qui n'a pas pu être écrit est
 * inscrit dans `derniere_erreur_ecriture`, l'écran le montre, et
 * « Renvoyer mes chantiers » le rattrape.
 */
export async function porterChantierDansAgenda(ctx: Ctx, chantierId: string): Promise<void> {
  const executer = executeurDeSession(ctx);
  const ident = await identifiants(executer, ctx.entrepriseId);
  if (!ident || !ident.ligne.ecritureActive || !ident.ligne.calendrierEcriture) return;
  const calendrier = ident.ligne.calendrierEcriture;

  try {
    const [chantier] = await chantiersPlanifies(executer, ctx.entrepriseId, chantierId);
    if (!chantier) {
      // Plus planifié, ou supprimé : ce qu'Atlas avait posé n'a plus lieu
      // d'être. Le retrait est le pendant obligatoire de l'écriture — sans
      // lui, un chantier déplanifié resterait dans son téléphone pour toujours.
      await retirerEvenement(ident.id, calendrier, identifiantEvenement(chantierId));
    } else {
      await poserEvenement(
        ident.id,
        calendrier,
        identifiantEvenement(chantier.id),
        veveneementDe(chantier)
      );
    }
    await noterEcriture(executer, ctx.entrepriseId, null);
  } catch (e) {
    await noterEcriture(executer, ctx.entrepriseId, messageDePanne(e));
  }
}

function veveneementDe(c: ChantierAEcrire): string {
  const bornes = bornesDuChantier(c.jour, c.moment, c.duree);
  if (!bornes) throw new Error(`Le chantier « ${c.nom} » n'a pas de créneau lisible.`);
  return construireVevenement({
    uid: identifiantEvenement(c.id),
    debut: bornes.debut,
    fin: bornes.fin,
    intitule: intituleChantier(c),
    lieu: c.adresse,
    description: "Posé par Atlas. Modifier ici ne change rien dans Atlas.",
    ecritLe: new Date(),
  });
}

/**
 * Renvoie tous les chantiers planifiés dans l'agenda.
 *
 * **Ce que ce bouton rattrape**, et pourquoi il ne fait pas double emploi avec
 * l'écriture au fil de l'eau : une écriture ratée pendant une coupure réseau ne
 * se rejoue pas toute seule. Sans cette reprise, l'artisan devrait replanifier
 * chaque chantier à la main pour les faire remonter — c'est-à-dire toucher à
 * son planning pour réparer son agenda.
 */
export async function resynchroniserAgendaApple(ctx: Ctx): Promise<{ poses: number; erreur: string | null }> {
  const executer = executeurDeSession(ctx);
  const ident = await identifiants(executer, ctx.entrepriseId);
  if (!ident || !ident.ligne.ecritureActive || !ident.ligne.calendrierEcriture) {
    return { poses: 0, erreur: null };
  }
  const calendrier = ident.ligne.calendrierEcriture;

  let poses = 0;
  try {
    for (const c of await chantiersPlanifies(executer, ctx.entrepriseId)) {
      await poserEvenement(ident.id, calendrier, identifiantEvenement(c.id), veveneementDe(c));
      poses++;
    }
    await noterEcriture(executer, ctx.entrepriseId, null);
    return { poses, erreur: null };
  } catch (e) {
    const erreur = messageDePanne(e);
    await noterEcriture(executer, ctx.entrepriseId, erreur);
    // Le nombre déjà posé est rendu quand même : « 7 sur 12, puis Apple a
    // refusé » se corrige, « ça n'a pas marché » n'apprend rien.
    return { poses, erreur };
  }
}

async function noterEcriture(
  executer: Executeur,
  entrepriseId: string,
  erreur: string | null
): Promise<void> {
  await executer(async (tx) => {
    await tx
      .update(agendasExternes)
      .set({
        derniereEcritureAt: new Date(),
        derniereErreurEcriture: erreur,
        updatedAt: new Date(),
      })
      .where(clauseApple(entrepriseId));
  });
}
