import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Routes publiques : la page de connexion elle-même, la route Auth.js, et les
// assets Next.js. Tout le reste de l'application exige une session valide.
const CHEMINS_PUBLICS = ["/login", "/api/auth", "/api/cron"];

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const estPublic = CHEMINS_PUBLICS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (estPublic) return NextResponse.next();

  if (!request.auth) {
    // Redirection strictement interne (pas de callbackUrl construit à partir
    // d'une entrée arbitraire non validée) — protège contre l'open redirect.
    const urlConnexion = new URL("/login", request.nextUrl.origin);
    return NextResponse.redirect(urlConnexion);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
