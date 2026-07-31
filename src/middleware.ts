import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Routes publiques : la page de connexion elle-même, la route Auth.js, et les
// assets Next.js. Tout le reste de l'application exige une session valide.
const CHEMINS_PUBLICS = ["/login", "/api/auth", "/api/cron"];

// Le chemin courant n'est pas accessible depuis un layout ou une page (seuls
// les paramètres de route le sont). Le middleware le transmet donc en en-tête,
// pour que la garde des documents légaux sache si elle se trouve déjà sur la
// page d'acceptation — sans quoi elle s'y redirigerait en boucle.
// En-tête posé sur la REQUÊTE (jamais sur la réponse) : il n'est lisible que
// côté serveur et ne parvient jamais au navigateur.
const ENTETE_CHEMIN = "x-atlas-pathname";

function suivantAvecChemin(pathname: string) {
  const entetes = new Headers();
  entetes.set(ENTETE_CHEMIN, pathname);
  return NextResponse.next({ request: { headers: entetes } });
}

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const estPublic = CHEMINS_PUBLICS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (estPublic) return suivantAvecChemin(pathname);

  if (!request.auth) {
    // Redirection strictement interne (pas de callbackUrl construit à partir
    // d'une entrée arbitraire non validée) — protège contre l'open redirect.
    const urlConnexion = new URL("/login", request.nextUrl.origin);
    return NextResponse.redirect(urlConnexion);
  }

  return suivantAvecChemin(pathname);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
