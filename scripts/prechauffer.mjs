// Compile les écrans du banc d'essai AVANT que le patron ne les ouvre.
//
// **Le défaut, vécu le 9 août 2026.** Il clique « Connecter » sur le Planning.
// Rien ne se passe pendant plus d'une minute, puis le mandataire de GitHub
// abandonne : « HTTP ERROR 504 ». Son terminal disait pourquoi :
//
//     o Compiling /reglages/agenda ...
//     GET /termines 200 in 38.7s
//     GET /planning 200 in 373ms
//
// `next dev` ne compile RIEN d'avance : il attend qu'on ouvre un écran, et le
// compile à cet instant. Trente à cent secondes la première fois, moins d'une
// demi-seconde ensuite — le même écran, le même code, la même machine. Le
// mandataire, lui, abandonne bien avant. Chaque écran neuf était donc une page
// d'erreur, et il en concluait, légitimement, que l'application était cassée.
//
// Ce module compile ces écrans au démarrage, pendant qu'il ne regarde pas.
//
// **Pourquoi il faut une session, et pourquoi elle n'est pas volée à personne.**
// Le middleware redirige toute requête sans session vers `/login` AVANT que la
// page ne soit compilée — vérifié, pas supposé : une requête anonyme sur
// `/planning` rend un 307 en 147 ms et ne compile rien. Préchauffer exige donc
// d'être connecté.
//
// Se connecter pour de bon était le premier réflexe, et c'était un piège : le
// limiteur autorise cinq tentatives par quart d'heure et par adresse IP
// (`rate-limit/types.ts`, seuil posé le 6 août 2026 après que les parents du
// patron se soient vu refuser le bon mot de passe). Sur un banc, tout arrive
// par la même adresse ; quelques redémarrages auraient suffi à VERROUILLER le
// patron hors de sa propre application — le remède aurait créé une panne pire
// que celle qu'il répare.
//
// Le jeton est donc fabriqué directement, avec la même clé et la même fonction
// que le serveur lui-même. Il ne consomme aucune tentative, ne quitte jamais ce
// processus, et n'est jamais écrit nulle part.
//
// **Et cela ne s'exécute JAMAIS en production** — refus en tête de fonction,
// éprouvé par `scripts/test-prechauffage.ts`. Une application qui sert de vrais
// clients n'a pas à savoir fabriquer une session sans mot de passe.

/** Le nom du cookie de session d'Auth.js hors HTTPS. Sert aussi de sel. */
const NOM_COOKIE = "authjs.session-token";

/**
 * Où l'avancement est déposé, pour que l'application puisse le montrer.
 *
 * Dans `/tmp` et jamais à la racine : un fichier neuf dans le dépôt salirait
 * l'arbre git, et `mettre-a-jour.sh` refuserait alors TOUTES les mises à jour
 * suivantes — le remède créerait la panne. Le même piège est déjà documenté et
 * éprouvé pour le journal de mise à jour (`test-issue-mise-a-jour.ts`).
 */
export const ETAT_PRECHAUFFAGE = "/tmp/atlas-prechauffage.json";

/**
 * Le rapporteur par défaut : il ne dit rien.
 *
 * Nommé et typé plutôt qu'écrit en ligne, sinon TypeScript déduit `() => void`
 * des valeurs par défaut et refuse tout appelant qui veut LIRE le message —
 * c'est-à-dire la suite de contrôles, celle qui vérifie que l'échec accuse le
 * bon coupable.
 *
 * @type {(ligne: string) => void}
 */
const NE_RIEN_DIRE = () => {};

/**
 * Les écrans que le patron ouvre, dans l'ordre où il les rencontre.
 *
 * Volontairement court. Les quarante-neuf routes de l'application prendraient
 * vingt minutes à compiler sur deux cœurs ; celles-ci couvrent ce qu'il
 * traverse réellement, et le reste garde son coût d'origine — une fois.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le 14 août 2026, cette liste avait pris du retard sur l'application — et
 * le patron l'a trouvé avant nous.** Son signalement : *« Les nouvelles pages
 * ne chargent mal ou pas du tout »*, puis, précis : ***« Surtout la page
 * équipe. »***
 *
 * Réglages avait été découpé en sept sous-écrans entre-temps. Cette liste, elle,
 * nommait encore l'ancienne organisation : `/reglages/equipe` n'y figurait pas,
 * ni `identite`, `tarifs`, `planning`, `ia`, `documents`, `donnees`. **Aucun des
 * sept n'était donc compilé d'avance** : il les ouvrait à froid, pendant que la
 * construction occupait ses deux cœurs, et le relais de GitHub abandonnait avant
 * que la page n'arrive. Sa phrase désignait exactement le bon écran.
 *
 * **La leçon, et c'est elle qui compte :** une liste écrite à la main vieillit
 * en silence. Un écran ajouté ailleurs ne s'y ajoute pas tout seul, rien ne
 * rougit, et le seul symptôme est une page qui ne s'ouvre pas — chez lui.
 * `scripts/test-prechauffage.ts` la confronte donc désormais aux routes
 * réellement présentes dans `src/app`, et refuse qu'un écran de premier rang y
 * manque.
 */
export const ECRANS_A_PRECHAUFFER = [
  "/login",
  "/",
  "/planning",
  "/termines",
  "/termines/tva",
  "/reglages",
  // Les sous-écrans de Réglages, dans l'ordre du sommaire. Ils sont courts à
  // compiler et c'est là qu'il va vérifier ce que sert son banc.
  //
  // **Les deux derniers sont arrivés le 14 août au soir**, et la suite les a
  // réclamés avant qu'ils ne manquent chez lui : c'est précisément ce que ce
  // contrôle sert à empêcher — une liste écrite à la main qui vieillit en
  // silence pendant qu'un écran naît ailleurs.
  "/reglages/compte",
  "/reglages/notifications",
  "/reglages/connexion",
  "/reglages/apparence",
  "/reglages/identite",
  "/reglages/equipe",
  "/reglages/tarifs",
  "/reglages/documents",
  "/reglages/fiche-entretien",
  "/reglages/ia",
  "/reglages/donnees",
  "/reglages/agenda",
  "/reglages/abonnement",
  "/reglages/prix",
  "/reglages/vocabulaire",
  // L'onglet « Paysage » et son premier outil interne (18 août 2026). La fiche
  // de chantier s'ouvre sur un chantier, souvent en 4G : c'est exactement le
  // cas où une compilation à froid ne passe pas.
  "/paysage",
  "/paysage/fiche",
  "/catalogue",
  "/chantiers/nouveau",
  "/documents-legaux",
  // Celui qui répond quand plus rien ne répond : il doit être prêt en premier.
  "/api/health/banc",
];

/**
 * Les écrans d'un chantier, ajoutés seulement si un chantier existe.
 *
 * Ce sont les plus lourds — et ceux qu'il ouvre en premier, puisque
 * l'application s'ouvre sur la liste des chantiers.
 */
export const ECRANS_DE_CHANTIER = ["", "/informations", "/note-vocale", "/prix", "/devis-complet"];

/**
 * Fabrique le cookie de session du compte de démonstration.
 *
 * Rend `null` — jamais une exception — quand quoi que ce soit manque : le
 * préchauffage est un confort, et un confort ne doit pas empêcher un serveur
 * de démarrer.
 */
export async function cookieDeSession({ databaseUrl, authSecret, nodeEnv, ecrire = NE_RIEN_DIRE }) {
  // **Le refus qui compte.** Voir l'en-tête : fabriquer une session sans mot de
  // passe est légitime sur un banc, et ne l'est nulle part ailleurs.
  if (nodeEnv === "production") {
    ecrire("préchauffage écarté : on est en production, et une session ne s'y fabrique pas");
    return null;
  }
  if (!databaseUrl) {
    ecrire("préchauffage impossible : DATABASE_URL est absente");
    return null;
  }
  if (!authSecret) {
    ecrire("préchauffage impossible : AUTH_SECRET est absent");
    return null;
  }

  const { Client } = await import("pg");
  const client = new Client({ connectionString: databaseUrl });
  let utilisateur;
  try {
    await client.connect();
    // **Le compte du banc nommément, pas « le plus ancien ».**
    //
    // Le premier jet prenait `order by created_at asc limit 1`. Sur une base
    // qui a servi aux suites de tests, ce n'est PAS le compte de démonstration :
    // c'est un compte d'essai qui n'a ni chantier ni acceptation des documents
    // légaux. Le préchauffage compilait alors deux écrans sur onze, et les neuf
    // autres partaient en redirection. Constaté en jouant le démarrage pour de
    // bon, jamais en le relisant.
    const { rows } = await client.query(
      `select id, email from users
        order by (email = 'demo@atlas.local') desc, created_at asc
        limit 1`
    );
    utilisateur = rows[0];
  } catch (e) {
    // **Ce `catch` était muet, et il a menti.** Le 9 août 2026, PostgreSQL
    // s'était arrêté sur la machine ; le démarrage annonçait « Préchauffage
    // impossible : pas de session », ce qui envoyait chercher du côté des
    // comptes et des jetons. La vraie phrase était `ECONNREFUSED 127.0.0.1:5432`
    // — la base ne répondait pas, et **l'application entière était donc morte**,
    // pas seulement le préchauffage. Une erreur qui accuse à tort coûte plus
    // cher que pas d'erreur du tout (`CLAUDE.md` §5).
    const raison = e instanceof Error ? e.message : String(e);
    ecrire(
      /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/.test(raison)
        ? `LA BASE DE DONNÉES NE RÉPOND PAS (${raison}). Ce n'est pas le préchauffage : ` +
            "aucun écran ne fonctionnera. Remonter la base avant tout le reste."
        : `préchauffage impossible, la base a répondu : ${raison}`
    );
    return null;
  } finally {
    await client.end().catch(() => undefined);
  }
  if (!utilisateur) {
    ecrire("préchauffage impossible : aucun compte dans la base (le jeu de démonstration a-t-il été posé ?)");
    return null;
  }

  const { encode } = await import("next-auth/jwt");
  const jeton = await encode({
    // Exactement ce que pose le rappel `jwt` de `src/auth.ts` : l'identifiant,
    // et rien d'autre. L'entreprise et le rôle sont toujours relus en base.
    token: { sub: utilisateur.id, utilisateurId: utilisateur.id, email: utilisateur.email },
    secret: authSecret,
    salt: NOM_COOKIE,
    maxAge: 15 * 60,
  });
  return `${NOM_COOKIE}=${jeton}`;
}

/**
 * Les écrans d'un chantier réel, s'il y en a un. Liste vide sinon.
 *
 * **L'identifiant est lu sur l'écran d'accueil, pas en base — et c'est la RLS
 * qui l'impose.** Le premier jet demandait `select id from chantiers` sous le
 * rôle applicatif : la requête a rendu **zéro ligne, sans la moindre erreur**,
 * et le préchauffage a annoncé « 11 écrans prêts » en sautant en silence les
 * plus lourds — ceux que le patron ouvre en premier. C'est exactement le piège
 * que `CLAUDE.md` §3 décrit : hors de `withEntreprise`, une requête ne renvoie
 * rien, *silencieusement*.
 *
 * Passer par l'application respecte l'isolation au lieu de la contourner :
 * l'accueil ne montre que les chantiers de l'entreprise de la session.
 */
export async function ecransDeChantier({ base, cookie, fetchImpl = fetch }) {
  try {
    const reponse = await fetchImpl(`${base}/`, {
      headers: cookie ? { cookie } : {},
      signal: AbortSignal.timeout(180_000),
    });
    if (reponse.status !== 200) return [];
    const html = await reponse.text();
    const trouve = html.match(/\/chantiers\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
    if (!trouve) return [];
    return ECRANS_DE_CHANTIER.map((suffixe) => `/chantiers/${trouve[1]}${suffixe}`);
  } catch {
    return [];
  }
}

/**
 * Ouvre chaque écran une fois, à la file.
 *
 * **À la file, jamais en parallèle**, et c'est délibéré : la machine du banc a
 * deux cœurs. Dix compilations concurrentes les mettraient à genoux et
 * rendraient l'application injoignable pendant tout le préchauffage — soit
 * exactement le symptôme qu'on répare.
 *
 * Rend le compte de ce qui a été compilé, pour que le démarrage puisse le dire.
 */
export async function prechauffer({
  base,
  cookie,
  ecrans,
  ecrire = NE_RIEN_DIRE,
  // **Appelé après chaque écran, pour que quelqu'un d'autre puisse le DIRE.**
  //
  // Le patron travaille depuis son téléphone. Le 9 août 2026 il a attendu trois
  // minutes devant un écran qui ne s'ouvrait pas, et la seule façon de savoir
  // pourquoi était de lire un terminal — qu'il ne pouvait ni consulter ni
  // photographier. « Va regarder toi-même, je peux pas te l'envoyer. » Je n'ai
  // aucun accès à son espace : l'information devait donc venir à lui.
  avancer = () => {},
  fetchImpl = fetch,
}) {
  let reussis = 0;
  let echoues = 0;
  /** Vers où l'application a renvoyé, et combien de fois. Voir le bilan. */
  const renvois = new Map();
  const debut = Date.now();

  for (const [rang, chemin] of ecrans.entries()) {
    avancer({ faits: rang, total: ecrans.length, reussis, echoues, encours: chemin });
    const t = Date.now();
    try {
      const reponse = await fetchImpl(`${base}${chemin}`, {
        headers: cookie ? { cookie } : {},
        redirect: "manual",
        // Large : c'est précisément la première compilation qu'on absorbe ici,
        // pour que le patron ne l'absorbe pas à sa place.
        signal: AbortSignal.timeout(180_000),
      });
      const duree = Date.now() - t;
      if (reponse.status >= 200 && reponse.status < 300) {
        reussis++;
        ecrire(`préchauffé ${chemin} — ${duree} ms`);
      } else if (reponse.status >= 300 && reponse.status < 400) {
        // **Une redirection n'a RIEN compilé, et doit être comptée comme telle.**
        //
        // Le middleware renvoie un 307 vers `/login` avant même de toucher à la
        // page. Compter ce 307 comme une réussite ferait annoncer « 15 écrans
        // prêts » alors qu'aucun ne l'est — un contrôle qui affirme au lieu de
        // vérifier, exactement ce que le dépôt s'interdit.
        echoues++;
        const vers = reponse.headers?.get?.("location") ?? "?";
        renvois.set(vers, (renvois.get(vers) ?? 0) + 1);
        ecrire(`préchauffage ${chemin} — redirigé vers ${vers}, rien compilé`);
      } else {
        echoues++;
        ecrire(`préchauffage ${chemin} — HTTP ${reponse.status} après ${duree} ms`);
      }
    } catch (e) {
      echoues++;
      ecrire(`préchauffage ${chemin} — ${e instanceof Error ? e.message : e}`);
    }
  }

  avancer({ faits: ecrans.length, total: ecrans.length, reussis, echoues, encours: null });

  return {
    reussis,
    echoues,
    secondes: Math.round((Date.now() - debut) / 1000),
    // **Dire POURQUOI rien ne s'est compilé, pas seulement que rien ne l'est.**
    //
    // Neuf écrans sur onze renvoyés vers `/documents-legaux` ne veut pas dire
    // « le préchauffage est cassé » : cela veut dire que le compte n'a pas
    // encore accepté les documents. Une ligne d'échec qui laisse chercher la
    // cause coûte plus cher que pas de ligne du tout (`AGENTS.md`).
    renvoiDominant: obstacle(renvois, ecrans.length),
  };
}

/** Le renvoi qui explique le gros des échecs, s'il y en a un. */
function obstacle(renvois, total) {
  let pire = null;
  for (const [vers, combien] of renvois) {
    if (!pire || combien > pire.combien) pire = { vers, combien };
  }
  if (!pire || pire.combien < Math.max(2, total / 2)) return null;
  return pire;
}

/** Ce qu'il faut lire à l'écran quand un renvoi a tout bloqué. */
export function expliquerObstacle(renvoiDominant) {
  if (!renvoiDominant) return null;
  if (renvoiDominant.vers.startsWith("/documents-legaux")) {
    return (
      "Les écrans n'ont pas pu être compilés : le compte doit d'abord accepter " +
      "les documents légaux, à la première connexion. Ils se compileront alors " +
      "à l'ouverture, une fois chacun."
    );
  }
  if (renvoiDominant.vers.startsWith("/login")) {
    return (
      "Les écrans n'ont pas pu être compilés : la session du préchauffage a été " +
      "refusée. Vérifier qu'AUTH_SECRET est bien le même que celui du serveur."
    );
  }
  return `Les écrans n'ont pas pu être compilés : l'application renvoie vers ${renvoiDominant.vers}.`;
}
