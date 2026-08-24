import assert from "node:assert/strict";
import {
  ALLURE_PAR_DEFAUT,
  couleurNettoyee,
  encreSurFond,
  estLAllureParDefaut,
  LOGO_HAUTEUR,
  LOGO_LARGEUR_MAX,
  normaliserAllure,
  refusDuLogo,
  taillePourLogo,
  TYPOGRAPHIES,
  typographieDe,
} from "../src/lib/allure-documents";
import { couleursDocument } from "../src/lib/design-tokens";

/**
 * L'ALLURE DE SES DOCUMENTS — la règle, sans base ni navigateur.
 *
 * *Sa demande du 23 août 2026 : « un endroit dédié à la modification de son
 * devis — s'il veut rajouter son logo, changer la typographie, changer le fond
 * de page », puis « les réglages actuels doivent être par défaut ».*
 *
 * Ce que cette suite tient fermé, et qui ne se voit pas au typage :
 *
 *   1. **le défaut est exactement le document d'avant** — un réglage neuf ne
 *      doit changer l'allure d'aucun devis tant qu'il n'y a pas touché ;
 *   2. **une couleur aberrante ne casse pas un devis**, elle retombe ;
 *   3. **l'encre suit le fond**, sans quoi un fond sombre donnerait un document
 *      illisible que personne ne verrait avant le client.
 */

let reussis = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    reussis++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  }
}

console.log("=== L'allure des documents ===");

cas("le défaut est EXACTEMENT les couleurs du document d'aujourd'hui", () => {
  // **On compare aux couleurs du DOCUMENT, pas à deux hexadécimaux retapés.**
  // La première version de ce contrôle affirmait « #ece9e1 » — une teinte lue
  // sur la maquette, que ses devis n'ont jamais portée : il aurait défendu le
  // mensonge au lieu de l'attraper.
  assert.equal(ALLURE_PAR_DEFAUT.fond, couleursDocument.papier.toLowerCase());
  assert.equal(ALLURE_PAR_DEFAUT.accent, couleursDocument.accent.toLowerCase());
  assert.equal(ALLURE_PAR_DEFAUT.typographie, "systeme");
  assert.ok(estLAllureParDefaut({ ...ALLURE_PAR_DEFAUT }));
});

cas("la première typographie n'embarque rien : c'est celle du format", () => {
  assert.equal(TYPOGRAPHIES[0].clef, ALLURE_PAR_DEFAUT.typographie);
  assert.equal(TYPOGRAPHIES[0].fichiers, null);
  assert.equal(TYPOGRAPHIES[0].pileCss, null);
});

cas("une dizaine de typographies, et les neuf autres ont leurs deux fichiers", () => {
  // « Fais-en une dizaine », le 23 août. Neuf familles plus celle d'aujourd'hui.
  assert.ok(TYPOGRAPHIES.length >= 10, `seulement ${TYPOGRAPHIES.length}`);
  for (const t of TYPOGRAPHIES.slice(1)) {
    assert.ok(t.fichiers, `${t.clef} n'a pas de fichier`);
    assert.ok(t.pileCss, `${t.clef} n'a pas de pile CSS`);
    // **La famille est écrite à part.** L'écran en fait des `@font-face` : sans
    // elle, il retomberait sur Georgia en affichant « Playfair Display ».
    assert.ok(t.famille, `${t.clef} n'a pas de famille CSS`);
    assert.ok(
      t.pileCss.startsWith(t.famille) || t.pileCss.startsWith(`"${t.famille}"`),
      `${t.clef} : la pile ne commence pas par sa famille`
    );
    // Le gras doit être un AUTRE fichier : sur une police variable, les deux
    // sont le même, et le gras du devis ne serait pas gras.
    assert.notEqual(t.fichiers.normal, t.fichiers.gras, `${t.clef} : même fichier en 400 et 700`);
  }
});

cas("aucune clef en double : un réglage posé désignerait deux polices", () => {
  const clefs = TYPOGRAPHIES.map((t) => t.clef);
  assert.equal(new Set(clefs).size, clefs.length, clefs.join(" "));
});

cas("une typographie inconnue retombe sur celle d'aujourd'hui", () => {
  // Une clef écrite par une version d'avant, ou une famille retirée du dépôt :
  // le devis doit sortir, pas refuser de se composer.
  assert.equal(typographieDe("une-police-retiree").clef, "systeme");
  assert.equal(typographieDe(null).clef, "systeme");
});

cas("une couleur se normalise plutôt que de se refuser", () => {
  // Un nuancier rend « #ECE9E1 » ici et « #ece9e1 » là : refuser l'un des deux
  // ferait un réglage qui marche sur son téléphone et pas sur son ordinateur.
  assert.equal(couleurNettoyee("#ECE9E1"), "#ece9e1");
  assert.equal(couleurNettoyee("  #ffffff  "), "#ffffff");
  assert.equal(couleurNettoyee("#abc"), "#aabbcc");
  assert.equal(couleurNettoyee("rouge"), null);
  assert.equal(couleurNettoyee("#12345"), null);
  assert.equal(couleurNettoyee(undefined), null);
});

cas("une saisie aberrante retombe sur le défaut, elle ne casse rien", () => {
  const a = normaliserAllure({ typographie: "n'existe pas", fond: "bleu", accent: "" });
  assert.deepEqual(a, { ...ALLURE_PAR_DEFAUT });
});

cas("l'encre suit le fond — clair sur sombre, sombre sur clair", () => {
  // **C'est la règle qui empêche un devis illisible.** Il peut mettre
  // n'importe quelle couleur ; lui laisser choisir l'encre en plus ne ferait
  // que déplacer le piège, et il ne le verrait qu'à l'impression, chez le client.
  const surCreme = encreSurFond("#ece9e1");
  const surNuit = encreSurFond("#1c2b1c");
  assert.ok(surCreme.encre < surNuit.encre, "l'encre ne s'inverse pas sur un fond sombre");
  const lisible = (fond: string, encre: string) => {
    const l = (c: string) => {
      const [r, v, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
      return 0.299 * r + 0.587 * v + 0.114 * b;
    };
    return Math.abs(l(fond) - l(encre)) > 90;
  };
  for (const fond of ["#ffffff", "#ece9e1", "#1c2b1c", "#000000", "#6e2433", "#f0e2c8"]) {
    const { encre, encreDouce } = encreSurFond(fond);
    assert.ok(lisible(fond, encre), `encre illisible sur ${fond}`);
    assert.ok(lisible(fond, encreDouce), `encre douce illisible sur ${fond}`);
  }
});

cas("un logo dans un format que le PDF ne sait pas embarquer est refusé", () => {
  // Un HEIC de téléphone ou un SVG se choisiraient sans un mot, et c'est le
  // devis parti chez le client qui n'aurait pas de logo.
  assert.equal(refusDuLogo("image/png", 40_000), null);
  assert.equal(refusDuLogo("image/jpeg", 40_000), null);
  assert.ok(refusDuLogo("image/svg+xml", 4_000));
  assert.ok(refusDuLogo("image/heic", 4_000));
  assert.ok(refusDuLogo("image/webp", 4_000));
  assert.ok(refusDuLogo("image/png", 9_000_000), "une photo de téléphone doit être refusée");
  assert.ok(refusDuLogo("image/png", 0), "une image vide doit être refusée");
});

cas("le logo garde ses proportions, et n'est jamais agrandi hors de sa place", () => {
  // Un logo en bandeau et un logo carré n'ont rien à voir : une boîte carrée
  // écraserait le premier.
  const carre = taillePourLogo(200, 200);
  assert.ok(Math.abs(carre.largeur - carre.hauteur) < 0.01, "un carré est sorti rectangle");
  assert.ok(carre.hauteur <= LOGO_HAUTEUR + 0.01);

  const bandeau = taillePourLogo(1200, 100);
  assert.ok(bandeau.largeur <= LOGO_LARGEUR_MAX + 0.01, `${bandeau.largeur} > ${LOGO_LARGEUR_MAX}`);
  assert.ok(
    Math.abs(bandeau.largeur / bandeau.hauteur - 12) < 0.01,
    "les proportions du bandeau ont bougé"
  );

  // Une image sans dimension ne doit rien dessiner plutôt qu'un infini.
  assert.deepEqual(taillePourLogo(0, 0), { largeur: 0, hauteur: 0 });
});

console.log(`\n${reussis} test(s) réussi(s)`);
