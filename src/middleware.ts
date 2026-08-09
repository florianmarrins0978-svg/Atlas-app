import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";
import { estBancDEssai } from "@/profil-banc";

const { auth } = NextAuth(authConfig);

// Routes publiques : la page de connexion elle-même, la route Auth.js, et les
// assets Next.js. Tout le reste de l'application exige une session valide.
// `/devis` est la page de réponse du client : consultée sans compte, depuis un
// lien reçu par SMS ou e-mail. Elle n'est pas « ouverte » pour autant — son
// seul accès est un jeton imprévisible, contrôlé en base par une politique
// dédiée (migration 0015). Sans jeton exact, aucune ligne n'est lisible.
//
// `/factures` suit exactement la même logique depuis le 6 août 2026 : le
// patron a constaté que sa facture arrêtée ne parvenait jamais à son client,
// faute de tout chemin vers lui. Même garde-fou, migration 0024 — le jeton est
// la seule clé, et il est imprévisible.
const CHEMINS_PUBLICS = ["/login", "/api/auth", "/api/cron", "/devis", "/factures"];

// Le chemin courant n'est pas accessible depuis un layout ou une page (seuls
// les paramètres de route le sont). Le middleware le transmet donc en en-tête,
// pour que la garde des documents légaux sache si elle se trouve déjà sur la
// page d'acceptation — sans quoi elle s'y redirigerait en boucle.
// En-tête posé sur la REQUÊTE (jamais sur la réponse) : il n'est lisible que
// côté serveur et ne parvient jamais au navigateur.
const ENTETE_CHEMIN = "x-atlas-pathname";

// Jamais en production, et c'est la SEULE condition.
//
// La version précédente exigeait `ATLAS_BANC_ESSAI=1`, posé dans
// `.devcontainer/docker-compose.yml`. C'est précisément le fichier qui avait
// déjà avalé `CODESPACE_NAME` : une variable déclarée là n'existe pas dans un
// espace de travail créé avant qu'elle n'y soit écrite, et le correctif restait
// alors inerte — sans le moindre message. Deux correctifs de suite ont échoué
// chez le patron pour ce motif.
//
// `NODE_ENV` ne dépend d'aucun fichier du dépôt : `next dev` le pose lui-même.
// **Un banc d'essai reste un banc, même bâti.** Depuis que le banc sert une
// version BÂTIE (pour ne plus compiler chaque écran à l'ouverture),
// `NODE_ENV` y vaut `production` : sans cette seconde condition, l'alignement
// ci-dessous s'éteindrait, et la connexion redeviendrait « Invalid Server
// Actions request. » — le défaut qui a coûté une journée entière.
const HORS_PRODUCTION = process.env.NODE_ENV !== "production" || estBancDEssai();

// Fait voir à Next.js le même hôte que celui annoncé par le navigateur.
//
// Pourquoi : Next.js refuse une action serveur quand l'en-tête `Origin` ne
// correspond pas à l'hôte — c'est sa protection contre le CSRF. Derrière le
// proxy d'un espace de travail distant, les deux diffèrent, et TOUTE action est
// refusée : « Invalid Server Actions request. » à la connexion, sans que rien
// n'indique pourquoi. Le patron a perdu une journée entière là-dessus.
//
// **L'écart va dans le sens qu'on n'attend pas**, et c'est ce qui a coûté trois
// correctifs successifs. Le message du serveur, une fois lu, est sans ambiguïté :
//
//   x-forwarded-host … 'xxx-3000.app.github.dev' does not match
//   origin header with value 'localhost:3000'
//
// C'est l'HÔTE qui porte l'adresse publique, et l'ORIGINE qui vaut
// `localhost:3000`. Les correctifs précédents autorisaient `*.app.github.dev`
// en tant qu'origine et ne s'appliquaient qu'à ce domaine : ils ressortaient
// donc immédiatement, sans effet, quel que soit l'environnement. Ils ont été
// éprouvés contre une panne simulée à l'envers de la vraie.
//
// D'où l'alignement inconditionnel hors production : on ne présume plus de
// quel côté vient l'écart, ni de quel domaine il s'agit. Le seul fait qui
// compte est que le navigateur a annoncé une origine — c'est elle qui fait foi.
//
// Ce que cela n'affaiblit PAS : en production, `NODE_ENV` vaut `production` et
// rien de tout ceci ne s'exécute — la protection CSRF est entière. Hors
// production, il s'agit d'un serveur de développement, dont le mot de passe de
// démonstration est public et l'adresse ouverte : il n'y a rien que cette
// protection défendrait encore.
function alignerHoteSurOrigine(entetes: Headers) {
  if (!HORS_PRODUCTION) return;

  const origine = entetes.get("origin");
  if (!origine) return;

  let hote: string;
  try {
    hote = new URL(origine).host;
  } catch {
    return;
  }
  if (!hote) return;

  entetes.set("x-forwarded-host", hote);
}

// Les en-têtes passés ici REMPLACENT ceux de la requête : il faut donc partir
// d'une copie de l'existant, jamais d'un objet vide. Un `new Headers()` nu
// effacerait le cookie de session, et toute l'application se retrouverait
// déconnectée — sans la moindre erreur, ce qui rend la panne difficile à lire.
function suivantAvecChemin(request: { headers: Headers }, pathname: string) {
  const entetes = new Headers(request.headers);
  entetes.set(ENTETE_CHEMIN, pathname);
  alignerHoteSurOrigine(entetes);
  return NextResponse.next({ request: { headers: entetes } });
}

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const estPublic = CHEMINS_PUBLICS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (estPublic) return suivantAvecChemin(request, pathname);

  if (!request.auth) {
    // Redirection strictement interne (pas de callbackUrl construit à partir
    // d'une entrée arbitraire non validée) — protège contre l'open redirect.
    const urlConnexion = new URL("/login", request.nextUrl.origin);
    return NextResponse.redirect(urlConnexion);
  }

  return suivantAvecChemin(request, pathname);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
