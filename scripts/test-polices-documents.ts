import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { TYPOGRAPHIES } from "../src/lib/allure-documents";

/**
 * LES POLICES DE SES DOCUMENTS S'IMPRIMENT-ELLES VRAIMENT ?
 *
 * **Payé le 24 août 2026, et c'est un défaut MUET.** Les fichiers étaient bons,
 * l'embarquement réussissait, aucune erreur n'était levée — et le devis en EB
 * Garamond sortait avec « e e e Roc e e » à la place du texte. Le découpeur de
 * `pdf-lib` (`subset: true`) perdait les caractères en silence. Sur Archivo
 * Narrow, dans l'autre sens, c'est la police entière qui le faisait tomber.
 *
 * Un devis illisible part quand même chez le client : rien ne l'arrête. Cette
 * suite est le seul garde-fou, et elle regarde deux choses que le typage ne
 * voit pas :
 *
 *   1. **chaque caractère que ses documents savent écrire a un dessin** dans le
 *      fichier — un caractère absent ne lève rien, il laisse un blanc ;
 *   2. **la police s'embarque comme le document l'embarque**, entière, sans
 *      tomber.
 *
 * Elle sait échouer : confrontée à une police réduite aux chiffres, elle
 * refuse — et confrontée aux fichiers d'avant réduction, elle refusait Archivo.
 */

const DOSSIER = path.join(__dirname, "..", "src", "server", "pdf", "polices");

/**
 * TOUT CE QU'UN DEVIS PEUT ÉCRIRE. Ce n'est pas une liste de goût : chaque
 * caractère vient d'un endroit précis du document — le « € » des montants,
 * l'espace insécable des milliers, le tiret cadratin des intitulés, les
 * accents des noms de ses clients, les guillemets français des mentions.
 *
 * Les majuscules accentuées comptent autant que les minuscules : un client
 * s'appelle ÉMILE en en-tête de facture, et un « É » manquant ne se verrait
 * qu'une fois la facture partie.
 */
const CARACTERES =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" +
  " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~" +
  "ÀÂÄÇÈÉÊËÎÏÔÖÙÛÜŸŒÆàâäçèéêëîïñôöùûüÿœæ" +
  "€°·«»—–’‘“”… ";

let reussis = 0;
function verifier(nom: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      reussis++;
      console.log(`✓ ${nom}`);
    })
    .catch((e) => {
      console.error(`✗ ${nom}\n  ${e instanceof Error ? e.message : String(e)}`);
      process.exitCode = 1;
    });
}

const fichiers = TYPOGRAPHIES.flatMap((t) =>
  t.fichiers ? [t.fichiers.normal, t.fichiers.gras] : []
);

assert.ok(fichiers.length >= 18, "les neuf familles doivent porter deux fichiers chacune");

async function jouer(): Promise<void> {
for (const fichier of fichiers) {
  await verifier(`${fichier} — chaque caractère a un dessin`, () => {
    const police = fontkit.create(readFileSync(path.join(DOSSIER, fichier)));
    const absents: string[] = [];
    for (const c of CARACTERES) {
      // `.notdef` porte l'identifiant 0 : c'est le rectangle vide, ou rien du
      // tout. Il ne lève aucune erreur — c'est exactement ce qui rend le
      // défaut invisible sans ce contrôle.
      const glyphes = police.layout(c).glyphs;
      if (glyphes.length === 0 || glyphes.some((g: { id: number }) => g.id === 0)) absents.push(c);
    }
    assert.deepEqual(
      absents,
      [],
      `${fichier} ne sait pas dessiner : ${absents.map((c) => JSON.stringify(c)).join(" ")}`
    );
  });

  await verifier(`${fichier} — s'embarque entière et écrit`, async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    // **Entière, comme `document-commun.ts` l'embarque.** L'éprouver découpée
    // ne prouverait rien de ce que son client reçoit.
    const police = await doc.embedFont(readFileSync(path.join(DOSSIER, fichier)), {
      subset: false,
    });
    const page = doc.addPage([600, 200]);
    page.drawText(CARACTERES.slice(0, 60), { x: 20, y: 100, size: 11, font: police, color: rgb(0, 0, 0) });
    const largeur = police.widthOfTextAtSize(CARACTERES, 11);
    assert.ok(largeur > 100, `${fichier} ne mesure rien : ${largeur}`);
    const pdf = await doc.save();
    // Une police réduite au latin pèse quelques dizaines de kilo-octets. Bien
    // au-delà, c'est qu'un fichier entier de Google Fonts a été reposé ici
    // sans passer par la réduction — et le devis de son client triplerait.
    assert.ok(pdf.length > 5_000, `${fichier} : PDF trop léger, la police n'est pas dedans`);
    assert.ok(pdf.length < 120_000, `${fichier} : ${Math.round(pdf.length / 1024)} ko — police non réduite ?`);
  });
  }
}

void jouer().then(() => {
  console.log(`\n${reussis} test(s) réussi(s)`);
});
