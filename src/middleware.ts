import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Routes publiques : la page de connexion elle-même, la route Auth.js, et les
// assets Next.js. Tout le reste de l'application exige une session valide.
// `/devis` est la page de réponse du client : consultée sans compte, depuis un
// lien reçu par SMS ou e-mail. Elle n'est pas « ouverte » pour autant — son
// seul accès est un jeton imprévisible, contrôlé en base par une politique
// dédiée (migration 0015). Sans jeton exact, aucune ligne n'est lisible.
const CHEMINS_PUBLICS = ["/login", "/api/auth", "/api/cron", "/devis"];

// Le chemin courant n'est pas accessible depuis un layout ou une page (seuls
// les paramètres de route le sont). Le middleware le transmet donc en en-tête,
// pour que la garde des documents légaux sache si elle se trouve déjà sur la
// page d'acceptation — sans quoi elle s'y redirigerait en boucle.
// En-tête posé sur la REQUÊTE (jamais sur la réponse) : il n'est lisible que
// côté serveur et ne parvient jamais au navigateur.
const ENTETE_CHEMIN = "x-atlas-pathname";

// Uniquement sur le banc d'essai, jamais ailleurs : la variable n'est posée que
// par .devcontainer/docker-compose.yml.
const BANC_ESSAI = process.env.ATLAS_BANC_ESSAI === "1";

// Domaines de redirection de GitHub Codespaces. Rien d'autre n'est accepté.
const DOMAINES_BANC_ESSAI = [".app.github.dev", ".github.dev"];

// Fait voir à Next.js le même hôte que celui de la barre d'adresse.
//
// Pourquoi : Next.js refuse une action serveur quand l'en-tête `Origin` ne
// correspond pas à l'hôte — c'est sa protection contre le CSRF. Derrière le
// proxy de Codespaces, le navigateur annonce `xxx-3000.app.github.dev` tandis
// que le serveur reçoit `localhost:3000`. Résultat : « Invalid Server Actions
// request. » à la connexion, et le patron ne peut pas entrer. Cela lui a coûté
// une journée.
//
// `allowedOrigins` (next.config.ts) est censé couvrir ce cas et le fait en
// local. Il ne suffisait pourtant pas dans un vrai Codespace, sans qu'on
// puisse le reproduire ailleurs. Plutôt que d'ajouter une hypothèse de plus,
// on supprime l'écart à la source : l'hôte transmis devient celui de l'origine.
//
// Ce que cela n'affaiblit PAS : la protection reste entière partout ailleurs.
// Elle n'est levée que si `ATLAS_BANC_ESSAI` vaut 1 — posé par le seul
// docker-compose du banc d'essai, jamais en production — et seulement pour un
// domaine de Codespaces. Sur ce banc, le mot de passe est public et l'adresse
// ouverte : il n'y a rien que le CSRF protégerait encore.
function alignerHoteSurOrigine(entetes: Headers) {
  if (!BANC_ESSAI) return;
  const origine = entetes.get("origin");
  if (!origine) return;

  let hote: string;
  try {
    hote = new URL(origine).host;
  } catch {
    return;
  }

  if (!DOMAINES_BANC_ESSAI.some((d) => hote.endsWith(d))) return;
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
