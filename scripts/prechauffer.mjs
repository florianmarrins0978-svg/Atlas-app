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
 * Les écrans que le patron ouvre, dans l'ordre où il les rencontre.
 *
 * Volontairement court. Les quarante-neuf routes de l'application prendraient
 * vingt minutes à compiler sur deux cœurs ; celles-ci couvrent ce qu'il
 * traverse réellement, et le reste garde son coût d'origine — une fois.
 */
export const ECRANS_A_PRECHAUFFER = [
  "/login",
  "/",
  "/planning",
  "/termines",
  "/reglages",
  "/reglages/agenda",
  "/reglages/prix",
  "/reglages/vocabulaire",
  "/catalogue",
  "/chantiers/nouveau",
  "/documents-legaux",
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
export async function cookieDeSession({ databaseUrl, authSecret, nodeEnv }) {
  // **Le refus qui compte.** Voir l'en-tête : fabriquer une session sans mot de
  // passe est légitime sur un banc, et ne l'est nulle part ailleurs.
  if (nodeEnv === "production") return null;
  if (!databaseUrl || !authSecret) return null;

  const { Client } = await import("pg");
  const client = new Client({ connectionString: databaseUrl });
  let utilisateur;
  try {
    await client.connect();
    // Le compte du banc, celui dont le mot de passe est public dans le dépôt.
    const { rows } = await client.query(
      "select id, email from users order by created_at asc limit 1"
    );
    utilisateur = rows[0];
  } catch {
    return null;
  } finally {
    await client.end().catch(() => undefined);
  }
  if (!utilisateur) return null;

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
export async function prechauffer({ base, cookie, ecrans, ecrire = () => {}, fetchImpl = fetch }) {
  let reussis = 0;
  let echoues = 0;
  const debut = Date.now();

  for (const chemin of ecrans) {
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
        ecrire(`préchauffage ${chemin} — redirigé vers ${reponse.headers?.get?.("location") ?? "?"}, rien compilé`);
      } else {
        echoues++;
        ecrire(`préchauffage ${chemin} — HTTP ${reponse.status} après ${duree} ms`);
      }
    } catch (e) {
      echoues++;
      ecrire(`préchauffage ${chemin} — ${e instanceof Error ? e.message : e}`);
    }
  }

  return { reussis, echoues, secondes: Math.round((Date.now() - debut) / 1000) };
}
