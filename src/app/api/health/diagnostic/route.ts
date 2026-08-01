import { NextResponse } from "next/server";

// Page de diagnostic du banc d'essai : ce que le serveur voit RÉELLEMENT.
//
// Pourquoi elle existe : « Invalid Server Actions request. » a bloqué le patron
// une journée entière. Next.js compare l'en-tête `Origin` à l'hôte et refuse
// toute action serveur quand ils diffèrent, sauf si `allowedOrigins` couvre
// l'origine. Impossible de savoir laquelle des trois valeurs est en cause
// depuis un téléphone : elles ne s'affichent nulle part.
//
// Placée sous /api/health/ à dessein — le middleware laisse ce préfixe passer
// sans session (voir `matcher` dans src/middleware.ts). Il faut pouvoir
// diagnostiquer précisément quand on n'arrive pas à se connecter.
//
// Elle n'expose aucune donnée d'entreprise : uniquement des en-têtes de la
// requête en cours et trois variables d'environnement non secrètes.

export const dynamic = "force-dynamic";

/** Reproduit exactement le calcul de next.config.ts, pour le rendre visible. */
function originesAutorisees(): string[] {
  if (process.env.NODE_ENV === "production") return [];
  const nom = process.env.CODESPACE_NAME;
  const domaine = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev";
  return ["*.app.github.dev", "*.github.dev", ...(nom ? [`${nom}-3000.${domaine}`] : [])];
}

/** Même algorithme que Next.js : le joker ne couvre que des sous-domaines. */
function jokerCorrespond(domaine: string, motif: string): boolean {
  const d = domaine.toLowerCase().split(".");
  const m = motif.toLowerCase().split(".");
  if (m.length < 1 || d.length < m.length) return false;
  if (m.length === 1 && (m[0] === "*" || m[0] === "**")) return false;
  while (m.length) {
    const partieMotif = m.pop();
    const partieDomaine = d.pop();
    if (partieMotif === "*") {
      if (!partieDomaine) return false;
      continue;
    }
    if (partieMotif !== partieDomaine) return false;
  }
  return d.length === 0;
}

export async function GET(requete: Request) {
  const entetes = requete.headers;
  const origine = entetes.get("origin");
  const hote = entetes.get("host");
  const hoteTransmis = entetes.get("x-forwarded-host");

  // Next.js retient `x-forwarded-host` s'il existe, sinon `host`.
  const hoteRetenu = hoteTransmis?.split(",")[0]?.trim() ?? hote ?? null;

  // Next.js ne compare que le NOM D'HÔTE de l'origine, jamais l'URL entière :
  // afficher `https://…` ici donnerait une valeur qui ne correspond à rien de
  // ce que le serveur compare, et enverrait chercher au mauvais endroit.
  const hoteDe = (url: string | null): string | null => {
    if (!url) return null;
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  };

  // L'en-tête `Origin` n'est pas envoyé sur une simple visite de page : on le
  // reconstitue depuis le référent, sinon depuis l'hôte transmis.
  const referent = entetes.get("referer");
  const origineProbable = hoteDe(origine) ?? hoteDe(referent) ?? hoteTransmis ?? hote;

  const autorisees = originesAutorisees();
  const couverte = origineProbable
    ? autorisees.some((a) => a === origineProbable || jokerCorrespond(origineProbable, a))
    : false;

  const memeHote = origineProbable !== null && origineProbable === hoteRetenu;
  const connexionPossible = memeHote || couverte;

  return NextResponse.json(
    {
      connexion_possible: connexionPossible,
      pourquoi: connexionPossible
        ? memeHote
          ? "L'origine et l'hôte coïncident : aucune autorisation supplémentaire n'est nécessaire."
          : "L'origine diffère de l'hôte, mais elle figure dans les origines autorisées."
        : "L'origine diffère de l'hôte ET n'est couverte par aucune origine autorisée. " +
          "C'est exactement ce qui produit « Invalid Server Actions request. » à la connexion.",
      ce_que_le_serveur_voit: {
        origine_probable: origineProbable,
        hote_retenu_par_next: hoteRetenu,
        entete_host: hote,
        entete_x_forwarded_host: hoteTransmis,
        entete_origin: origine,
      },
      origines_autorisees: autorisees,
      environnement: {
        NODE_ENV: process.env.NODE_ENV ?? null,
        CODESPACE_NAME: process.env.CODESPACE_NAME ?? null,
        GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:
          process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? null,
      },
    },
    { headers: { "cache-control": "no-store" } }
  );
}
