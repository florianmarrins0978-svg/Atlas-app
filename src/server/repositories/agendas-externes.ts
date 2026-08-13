import { and, eq } from "drizzle-orm";
import type { PeriodeOccupee } from "../../lib/agenda-externe";
import { agendasExternes } from "../db/schema";
import { withEntreprise } from "../db/with-entreprise";
import { periodesApple } from "./agenda-apple";
import {
  executeurDeSession,
  executeurParEntreprise,
  messageDePanne,
  type Executeur,
} from "./agenda-executeur";
import {
  adresseDuCompte,
  configurationGoogle,
  periodesOccupees,
  rafraichirJeton,
  type ConfigurationGoogle,
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
  /** Des identifiants Google existent-ils ? Sinon, rien n'est proposé à cliquer. */
  configure: boolean;
  /** Le `client_id` déjà posé, pour que l'écran le rappelle. Jamais le secret. */
  clientId: string | null;
  /** L'adresse de retour à recopier dans la console Google, au caractère près. */
  redirection: string | null;
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

    const config = configurationDe(ligne ?? null);
    return {
      configure: config !== null,
      clientId: ligne?.clientId ?? configurationGoogle()?.clientId ?? null,
      redirection: config?.redirection ?? null,
      // **Relié ne veut pas dire configuré.** Une ligne peut exister avec les
      // seuls identifiants, entre le moment où il les colle et son retour de
      // chez Google. L'écran doit distinguer les deux, sinon il annonce
      // « agenda relié » à quelqu'un qui n'a encore rien autorisé.
      relie: Boolean(ligne?.jetonAcces || ligne?.jetonRafraichissement),
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
 * Les identifiants à employer pour cette entreprise.
 *
 * **Ceux qu'elle a saisis priment sur ceux de l'installation**, et l'ordre est
 * le bon : sa demande du 9 août 2026 est de pouvoir relier son agenda *seul*,
 * sans dépendre de ce que quelqu'un a posé sur le serveur. Les variables
 * d'environnement restent en repli — elles servent au banc d'essai et à une
 * installation qui voudrait fournir les identifiants pour tous ses artisans.
 *
 * Rend `null` si rien n'est complet des deux côtés : **le défaut de
 * configuration refuse, il n'accorde pas.** Une configuration à moitié posée
 * enverrait l'artisan chez Google avec un client vide, et il lirait un message
 * d'erreur en anglais en croyant qu'Atlas est cassé.
 */
export function configurationDe(
  ligne: typeof agendasExternes.$inferSelect | null
): ConfigurationGoogle | null {
  const clientId = (ligne?.clientId ?? "").trim();
  const secretChiffre = ligne?.clientSecret ?? null;
  const redirection = (ligne?.redirection ?? "").trim();
  if (clientId && secretChiffre && redirection) {
    const clientSecret = dechiffrer(secretChiffre);
    if (clientSecret) return { clientId, clientSecret, redirection };
    // Secret illisible — `AUTH_SECRET` changé, ligne abîmée. On ne bascule pas
    // en silence sur les variables d'installation : elles appartiennent à
    // quelqu'un d'autre, et brancher l'artisan sur un projet Google qu'il n'a
    // pas choisi serait pire que de lui dire de recoller son secret.
    return null;
  }
  return configurationGoogle();
}

/** La configuration de CETTE entreprise, telle que les actions en ont besoin. */
export async function configurationDeLEntreprise(ctx: Ctx): Promise<ConfigurationGoogle | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select()
      .from(agendasExternes)
      .where(
        and(eq(agendasExternes.entrepriseId, ctx.entrepriseId), eq(agendasExternes.fournisseur, "google"))
      )
      .limit(1);
    return configurationDe(ligne ?? null);
  });
}

/**
 * Enregistre les identifiants que l'artisan a collés, sans toucher aux jetons.
 *
 * Change-t-il d'identifiants ? Les jetons obtenus avec les précédents ne valent
 * plus rien — ils appartiennent à l'autre projet Google. On les efface, et
 * l'écran redemandera l'autorisation. Les garder afficherait « relié » sur un
 * raccordement mort.
 */
export async function enregistrerIdentifiants(
  ctx: Ctx,
  identifiants: { clientId: string; clientSecret: string | null; redirection: string }
): Promise<void> {
  const clientId = identifiants.clientId.trim();
  const redirection = identifiants.redirection.trim();
  // Vide = « garde celui que tu as ». L'écran l'annonce, et il faut que ce soit
  // vrai : un artisan qui revient corriger son adresse de retour n'a pas son
  // secret sous la main, Google ne le remontre jamais après l'avoir créé.
  const secret = identifiants.clientSecret?.trim() || null;

  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [existant] = await tx
      .select({ clientId: agendasExternes.clientId })
      .from(agendasExternes)
      .where(
        and(eq(agendasExternes.entrepriseId, ctx.entrepriseId), eq(agendasExternes.fournisseur, "google"))
      )
      .limit(1);

    const changement = existant !== undefined && existant.clientId !== clientId;
    const jetonsRemisAZero = changement
      ? { jetonAcces: null, jetonRafraichissement: null, expireAt: null }
      : {};

    await tx
      .insert(agendasExternes)
      .values({
        entrepriseId: ctx.entrepriseId,
        fournisseur: "google",
        clientId,
        clientSecret: secret ? chiffrer(secret) : null,
        redirection,
        actif: true,
      })
      .onConflictDoUpdate({
        target: [agendasExternes.entrepriseId, agendasExternes.fournisseur],
        set: {
          clientId,
          ...(secret ? { clientSecret: chiffrer(secret) } : {}),
          redirection,
          derniereErreur: null,
          updatedAt: new Date(),
          ...jetonsRemisAZero,
        },
      });
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
// Sorti dans `./agenda-executeur` le 12 août 2026, quand l'agenda iCloud est
// venu s'ajouter : les deux raccordements en ont besoin, et le laisser ici
// aurait fait dépendre Apple de Google — ou produit une seconde copie.

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
  return tousLesAgendas(executeurDeSession(ctx), ctx.entrepriseId, debut, fin);
}

/**
 * Les périodes de TOUS les agendas reliés, fondues en une seule liste.
 *
 * **Le point de fusion est ici, et nulle part ailleurs.** Un artisan peut avoir
 * relié Google *et* iCloud — le premier pour son agenda professionnel, le
 * second pour sa vie. Laisser chaque appelant décider lesquels consulter
 * garantirait qu'un écran en oublie un : le planning tiendrait compte des deux,
 * la page du client d'un seul, et le doublon reviendrait par la porte qu'on
 * croyait fermée.
 *
 * **Les deux lectures sont menées de front** : elles interrogent deux services
 * qui ne se connaissent pas, et les enchaîner ferait attendre le patron deux
 * fois. Aucune des deux ne jette — chacune note sa propre panne — donc
 * l'absence d'un agenda ne fait pas taire l'autre.
 */
async function tousLesAgendas(
  executer: Executeur,
  entrepriseId: string,
  debut: Date,
  fin: Date
): Promise<PeriodeOccupee[]> {
  const [google, apple] = await Promise.all([
    periodes(executer, entrepriseId, debut, fin),
    periodesApple(executer, entrepriseId, debut, fin),
  ]);
  return [...google, ...apple];
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
  return tousLesAgendas(executeurParEntreprise(entrepriseId), entrepriseId, debut, fin);
}

async function periodes(
  executer: Executeur,
  entrepriseId: string,
  debut: Date,
  fin: Date
): Promise<PeriodeOccupee[]> {
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

  // Les identifiants viennent de la ligne qu'on vient de lire, ou de
  // l'installation à défaut. Une ligne qui n'a que des identifiants et pas
  // encore de jetons n'a rien à consulter.
  const config = configurationDe(ligne);
  if (!config) return [];

  try {
    const jetonAcces = await jetonUtilisable(executer, entrepriseId, ligne, config);
    if (!jetonAcces) return [];
    const occupees = await periodesOccupees(jetonAcces, debut, fin);
    await noterLecture(executer, entrepriseId, null);
    return occupees;
  } catch (e) {
    await noterLecture(executer, entrepriseId, messageDePanne(e));
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
  config: ConfigurationGoogle
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

// `messageDePanne` vit dans `./agenda-executeur` : les deux fournisseurs
// tronquent leurs pannes de la même façon, et deux copies finiraient par
// diverger sur la longueur — donc sur ce que l'artisan lit.
