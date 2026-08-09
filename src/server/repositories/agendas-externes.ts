import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import type { PeriodeOccupee } from "../../lib/agenda-externe";
import { agendasExternes } from "../db/schema";
import { withEntreprise } from "../db/with-entreprise";
import {
  adresseDuCompte,
  configurationGoogle,
  periodesOccupees,
  rafraichirJeton,
  type JetonsGoogle,
} from "../agenda/google";
import { chiffrer, dechiffrer } from "../agenda/secret-au-repos";
import type { Ctx } from "./context";

/**
 * L'agenda extérieur d'une entreprise : le brancher, le débrancher, le lire.
 *
 * **Sa décision du 9 août 2026 :** *« que l'utilisateur puisse, s'il le
 * souhaite ou non, connecter son planning à son agenda Google. »* Tout ici est
 * écrit pour que le « ou non » reste sans conséquence : un artisan qui n'a rien
 * relié n'a aucune ligne, et pas une seule des fonctions ci-dessous ne change
 * quoi que ce soit à son Atlas.
 */

/** Ce que l'écran des réglages a besoin de savoir. Jamais un jeton. */
export type EtatAgenda = {
  /** L'installation a-t-elle des identifiants Google ? Sinon, rien n'est proposé. */
  configure: boolean;
  relie: boolean;
  /** L'adresse du compte branché, pour qu'il sache LEQUEL. */
  compte: string | null;
  actif: boolean;
  derniereLectureAt: Date | null;
  /**
   * Ce qui a cessé de fonctionner, s'il y a lieu.
   *
   * **La colonne la plus importante de l'écran.** Un raccordement mort en
   * silence est pire que pas de raccordement du tout : l'artisan croit son
   * agenda pris en compte, et Atlas est revenu au comportement qui produisait
   * des doublons sans que rien ne le dise.
   */
  derniereErreur: string | null;
};

export async function etatAgenda(ctx: Ctx): Promise<EtatAgenda> {
  const configure = configurationGoogle() !== null;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select()
      .from(agendasExternes)
      .where(
        and(
          eq(agendasExternes.entrepriseId, ctx.entrepriseId),
          eq(agendasExternes.fournisseur, "google")
        )
      )
      .limit(1);

    return {
      configure,
      relie: Boolean(ligne),
      compte: ligne?.compte ?? null,
      actif: ligne?.actif ?? false,
      derniereLectureAt: ligne?.derniereLectureAt ?? null,
      derniereErreur: ligne?.derniereErreur ?? null,
    };
  });
}

/** Enregistre — ou remplace — le raccordement, jetons chiffrés. */
export async function enregistrerRaccordement(
  ctx: Ctx,
  jetons: JetonsGoogle,
  compte: string | null
): Promise<void> {
  await ecrireRaccordement(executeurDeSession(ctx), ctx.entrepriseId, jetons, compte);
}

async function ecrireRaccordement(
  executer: Executeur,
  entrepriseId: string,
  jetons: JetonsGoogle,
  compte: string | null
): Promise<void> {
  await executer(async (tx) => {
    await tx
      .insert(agendasExternes)
      .values({
        entrepriseId,
        fournisseur: "google",
        compte,
        jetonAcces: chiffrer(jetons.acces),
        jetonRafraichissement: jetons.rafraichissement ? chiffrer(jetons.rafraichissement) : null,
        expireAt: jetons.expireAt,
        actif: true,
        derniereErreur: null,
      })
      .onConflictDoUpdate({
        target: [agendasExternes.entrepriseId, agendasExternes.fournisseur],
        set: {
          compte,
          jetonAcces: chiffrer(jetons.acces),
          // Ne JAMAIS écraser par `null` : Google ne renvoie le jeton de
          // rafraîchissement qu'à la première autorisation. L'effacer sur un
          // rebranchement condamnerait le raccordement à mourir dans l'heure.
          ...(jetons.rafraichissement
            ? { jetonRafraichissement: chiffrer(jetons.rafraichissement) }
            : {}),
          expireAt: jetons.expireAt,
          actif: true,
          derniereErreur: null,
          updatedAt: new Date(),
        },
      });
  });
}

/** Coupe la lecture sans supprimer le raccordement. */
export async function basculerAgenda(ctx: Ctx, actif: boolean): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(agendasExternes)
      .set({ actif, updatedAt: new Date() })
      .where(
        and(
          eq(agendasExternes.entrepriseId, ctx.entrepriseId),
          eq(agendasExternes.fournisseur, "google")
        )
      );
  });
}

/** Efface le raccordement et les jetons. Le geste par défaut à l'écran. */
export async function debrancherAgenda(ctx: Ctx): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .delete(agendasExternes)
      .where(
        and(
          eq(agendasExternes.entrepriseId, ctx.entrepriseId),
          eq(agendasExternes.fournisseur, "google")
        )
      );
  });
}

/**
 * Comment ouvrir la base pour une entreprise donnée.
 *
 * **Deux chemins mènent ici, et ils n'ont pas la même porte d'entrée.** L'écran
 * du patron a une session : `withEntreprise` pose son contexte. La page
 * publique du client n'en a pas — elle dérive l'entreprise **du jeton** et pose
 * le contexte à la main, exactement comme `lireParJeton`.
 *
 * Cette petite abstraction existe pour que la logique qui suit — jeton expiré,
 * renouvellement, écriture de l'erreur — soit écrite **une seule fois**. Deux
 * copies finiraient par diverger, et l'une des deux oublierait un jour de
 * consulter l'agenda : le client se verrait alors proposer un jour où le patron
 * est pris, c'est-à-dire précisément le défaut que tout ce lot répare.
 */
type Executeur = <T>(fn: (tx: Parameters<Parameters<typeof withEntreprise>[2]>[0]) => Promise<T>) => Promise<T>;

function executeurDeSession(ctx: Ctx): Executeur {
  return (fn) => withEntreprise(ctx.utilisateurId, ctx.entrepriseId, fn);
}

/**
 * L'exécuteur de la page publique : le contexte vient du jeton, jamais d'une
 * donnée envoyée par le client.
 */
function executeurParEntreprise(entrepriseId: string): Executeur {
  return (fn) =>
    db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.entreprise_id', ${entrepriseId}, true)`);
      return fn(tx);
    });
}

/**
 * Les périodes occupées de l'artisan sur une fenêtre, ou une liste vide.
 *
 * **Cette fonction ne jette jamais, et c'est un choix qui se défend.** Une
 * panne de Google — réseau coupé, accès révoqué, quota — ne doit pas empêcher
 * le patron de préparer un envoi ni le client d'ouvrir son devis : le parcours
 * entier s'arrêterait sur une dépendance extérieure que personne ne maîtrise.
 *
 * **Mais l'échec n'est pas avalé** : il est écrit dans `derniere_erreur`, et
 * l'écran des réglages le montre. C'est la seule façon honnête de tenir les
 * deux bouts — Atlas continue de fonctionner, en étant revenu à son ancien
 * comportement, et il le dit plutôt que de laisser croire que l'agenda compte.
 */
export async function periodesOccupeesExterieures(
  ctx: Ctx,
  debut: Date,
  fin: Date
): Promise<PeriodeOccupee[]> {
  return periodes(executeurDeSession(ctx), ctx.entrepriseId, debut, fin);
}

/**
 * La même chose, pour la page publique du client.
 *
 * **Pourquoi le client aussi, alors qu'il ne voit jamais l'agenda.** Parce que
 * c'est LUI qui retient la date. Ne consulter l'agenda que du côté du patron
 * laisserait le trou ouvert par l'autre bout : le patron propose une bande de
 * jours, le client en choisit un où le patron est chez le médecin, et le
 * doublon arrive quand même — avec, en plus, une date acceptée noir sur blanc.
 */
export async function periodesOccupeesPourEntreprise(
  entrepriseId: string,
  debut: Date,
  fin: Date
): Promise<PeriodeOccupee[]> {
  return periodes(executeurParEntreprise(entrepriseId), entrepriseId, debut, fin);
}

async function periodes(
  executer: Executeur,
  entrepriseId: string,
  debut: Date,
  fin: Date
): Promise<PeriodeOccupee[]> {
  const config = configurationGoogle();
  if (!config) return [];

  // **Lue puis relâchée avant l'appel réseau.** Tenir une transaction
  // PostgreSQL ouverte pendant un appel HTTP immobilise une connexion du pool
  // pour la durée d'un service qu'on ne maîtrise pas.
  const ligne = await executer(async (tx) => {
    const [l] = await tx
      .select()
      .from(agendasExternes)
      .where(
        and(eq(agendasExternes.entrepriseId, entrepriseId), eq(agendasExternes.fournisseur, "google"))
      )
      .limit(1);
    return l ?? null;
  });

  // Rien de relié, ou coupé par l'artisan : le cas ordinaire, et il ne coûte
  // pas un appel réseau.
  if (!ligne || !ligne.actif) return [];

  try {
    const jetonAcces = await jetonUtilisable(executer, entrepriseId, ligne, config);
    if (!jetonAcces) return [];
    const occupees = await periodesOccupees(jetonAcces, debut, fin);
    await noterLecture(executer, entrepriseId, null);
    return occupees;
  } catch (e) {
    await noterLecture(executer, entrepriseId, message(e));
    return [];
  }
}

/**
 * Un jeton d'accès valable, renouvelé si besoin.
 *
 * Le renouvellement est écrit en base au passage : sans cela, chaque
 * préparation d'envoi redemanderait un jeton à Google, et l'artisan finirait
 * par heurter les quotas pour rien.
 */
async function jetonUtilisable(
  executer: Executeur,
  entrepriseId: string,
  ligne: typeof agendasExternes.$inferSelect,
  config: NonNullable<ReturnType<typeof configurationGoogle>>
): Promise<string | null> {
  const encoreValable = ligne.expireAt !== null && ligne.expireAt.getTime() > Date.now();
  if (encoreValable && ligne.jetonAcces) {
    const clair = dechiffrer(ligne.jetonAcces);
    if (clair) return clair;
    // Jeton illisible — `AUTH_SECRET` changé, ligne tronquée. On tente le
    // renouvellement plutôt que d'abandonner : c'est récupérable.
  }

  const rafraichissement = ligne.jetonRafraichissement
    ? dechiffrer(ligne.jetonRafraichissement)
    : null;
  if (!rafraichissement) {
    throw new Error(
      "Le raccordement n'a plus de jeton de renouvellement : il faut rebrancher l'agenda."
    );
  }

  const jetons = await rafraichirJeton(config, rafraichissement);
  const compte = ligne.compte ?? (await adresseDuCompte(jetons.acces));
  await ecrireRaccordement(executer, entrepriseId, jetons, compte);
  return jetons.acces;
}

async function noterLecture(
  executer: Executeur,
  entrepriseId: string,
  erreur: string | null
): Promise<void> {
  await executer(async (tx) => {
    await tx
      .update(agendasExternes)
      .set({ derniereLectureAt: new Date(), derniereErreur: erreur, updatedAt: new Date() })
      .where(
        and(eq(agendasExternes.entrepriseId, entrepriseId), eq(agendasExternes.fournisseur, "google"))
      );
  });
}

/**
 * Le message d'une panne, tronqué, tel que le service l'a écrit.
 *
 * Reproduire le message du serveur plutôt que l'idée qu'on s'en fait est une
 * règle du dépôt payée d'une demi-journée (`AGENTS.md`) : trois correctifs
 * d'affilée sont passés au vert en réparant une panne imaginée.
 */
function message(e: unknown): string {
  const texte = e instanceof Error ? e.message : String(e);
  return texte.slice(0, 500);
}
