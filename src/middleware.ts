import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";
import { estBancDEssai } from "@/profil-banc";
import { estCheminPublic } from "@/lib/chemins-publics";

const { auth } = NextAuth(authConfig);

// Routes publiques : la page de connexion elle-même, la route Auth.js, et les
// pages que le CLIENT de l'artisan atteint par un jeton. Tout le reste exige
// une session valide.
//
// **La liste vit dans `src/lib/chemins-publics.ts`, et pas ici.** Elle était
// tenue en double — le middleware d'un côté, la mise en page de l'autre pour
// décider qui porte la barre de navigation — et les deux ont divergé : la
// facture du client affichait les onglets de l'outil du patron. Une seule
// source, donc, pour que l'invariant tienne par construction (`CLAUDE.md` §3).

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
  const estPublic = estCheminPublic(pathname);
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
  // `robots.txt` y a rejoint `favicon.ico` le 25 août 2026 (constat F13) : un
  // moteur n'a pas de session, et sans cette exclusion il recevrait une
  // redirection vers `/login` au lieu de la consigne de ne rien indexer. Le
  // fichier existerait, et ne servirait à rien — un garde-fou qu'on croit en
  // place est pire qu'un garde-fou absent. Ce qu'il contient, et pourquoi il
  // n'est PAS une frontière de sécurité, est écrit dans `src/app/robots.ts`.
  // **`api/health` est ancré à la fin d'un segment** — constat de l'audit final,
  // 29 août 2026. Écrit sans ancrage, le préfixe excluait aussi tout chemin qui
  // COMMENCE par ces lettres : `/api/healthXYZ` n'aurait traversé ni la garde de
  // session, ni la pose de `x-atlas-pathname` dont dépend `exigerOuverture`.
  // Aucune route de ce nom n'existe — on ferme la porte avant qu'elle serve,
  // pour trois caractères.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|api/health(?:/|$)).*)"],
};
