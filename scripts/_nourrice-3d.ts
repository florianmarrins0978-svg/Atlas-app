/**
 * L'empreinte de ce qui DESSINE la nourrice en 3D : ses pièces, leurs formes,
 * leur composition (`appli/nourrice-3d/`). Les photos de l'éclaté du PDF
 * (`rendre-nourrice-eclatee.mts`) la gardent à côté d'elles ; quand elle ne
 * correspond plus, une pièce a changé et les photos montrent l'ancienne.
 *
 * La lumière, les matières et la planche ne comptent pas : elles changent
 * l'image sans changer ce qu'on monte, et rendre les photos périmées pour un
 * reflet ferait rougir pour rien.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DOSSIER = path.resolve("appli", "nourrice-3d");
export const FICHIER_D_EMPREINTE = path.resolve("public", "arrosage-photos", "nourrice-3d", "empreinte.json");

export async function empreinteDeLaNourrice3D(): Promise<string> {
  const pieces = (await readdir(path.join(DOSSIER, "pieces"))).filter((f) => f.endsWith(".js")).sort().map((f) => path.join("pieces", f));
  const h = createHash("sha256");
  for (const f of ["composition.js", "formes.js", ...pieces]) {
    h.update(f);
    h.update(await readFile(path.join(DOSSIER, f)));
  }
  return h.digest("hex");
}
