import qrcode from "qrcode-generator";

/**
 * Le code carré que l'appli d'authentification scanne, depuis un ordinateur.
 *
 * **Une forme, pas du HTML** : la liste des cases noires, en un seul chemin
 * SVG. L'écran le dessine avec React ; aucune chaîne n'est injectée telle
 * quelle dans la page.
 *
 * Niveau de correction « M » : assez pour un écran photographié de biais, sans
 * grossir le carré au point qu'il faille reculer le téléphone.
 */
export function codeCarre(texte: string): { cotes: number; chemin: string } {
  const qr = qrcode(0, "M");
  qr.addData(texte);
  qr.make();
  const cotes = qr.getModuleCount();
  const morceaux: string[] = [];
  for (let y = 0; y < cotes; y++) {
    for (let x = 0; x < cotes; x++) {
      if (qr.isDark(y, x)) morceaux.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  return { cotes, chemin: morceaux.join("") };
}
