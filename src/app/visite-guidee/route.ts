import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * LA VISITE GUIDÉE, SERVIE PAR L'APPLI ELLE-MÊME — sa règle du 23 novembre
 * 2026 : *« pour les personnes déjà dans l'application, s'ils quittent la
 * visite, ils reviennent à la page Chantiers »*, et depuis le site, au site.
 *
 * **Le fichier du site, et lui seul** (`appli/visite-guidee.html`) : une copie
 * dans `public/` finirait par diverger de celle qu'il retouche sur le site.
 * Servie d'ici, la visite est de la même origine que l'appli ; « Quitter la
 * visite » rouvre la page d'où l'on vient (`quitter`, dans le fichier), donc
 * l'accueil. Ouverte sur le site, elle ramène au site. Une page d'un AUTRE
 * site, elle, ne saurait pas revenir dans l'appli installée sur l'écran
 * d'accueil : le téléphone l'ouvre dans un navigateur à part.
 *
 * Rien de l'entreprise n'y passe : ce sont des écrans figés sur des données
 * d'essai. La route n'a donc pas de garde à elle ; la session reste celle de
 * l'appli, que `middleware.ts` exige comme partout.
 */
const FICHIER = path.join(process.cwd(), "appli", "visite-guidee.html");

export async function GET(): Promise<Response> {
  const page = await readFile(FICHIER, "utf8");
  return new Response(page, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Sept mégaoctets : le téléphone la garde cinq minutes, le temps d'une
      // visite interrompue puis reprise.
      "Cache-Control": "private, max-age=300",
    },
  });
}
