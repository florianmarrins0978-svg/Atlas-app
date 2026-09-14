import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { montantDeLaLigne } from "../src/lib/montant-de-ligne";
import { totauxAvecReduction } from "../src/lib/reduction-devis";

/**
 * CE QU'UNE LIGNE PÈSE — et le fait qu'une seule fonction le décide.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa demande du 13 septembre 2026 :** *« vérifie tous les calculs ; si les
 * lignes ne s'additionnent pas ou mal, c'est hyper grave et ça ne doit jamais
 * arriver »*.
 *
 * La multiplication était écrite deux fois — dans le dépôt des lignes de devis
 * et dans celui des factures, dont le commentaire affirmait pourtant appeler
 * celle du devis. Elle décide de ce que le client paie.
 *
 * Ni base, ni réseau, ni navigateur.
 */

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Ce qu'une ligne pèse ===\n");

cas("trois tilleuls à 250 € font 750 €", () => {
  assert.equal(montantDeLaLigne("3", "250"), "750.00");
  assert.equal(montantDeLaLigne("2", "450"), "900.00");
  // Et le chiffre qu'il a vu partir chez son client, quand la quantité était
  // douze : le calcul était juste, c'est la saisie qui ne l'était pas.
  assert.equal(montantDeLaLigne("12", "450"), "5400.00");
});

cas("les centimes ne dérivent pas — c'est là que les nombres du langage mentent", () => {
  // 0.1 + 0.2 vaut 0.30000000000000004 en virgule flottante. Sur trois lignes
  // et une TVA, le total cesse de tomber juste.
  assert.equal(montantDeLaLigne("3", "0.1"), "0.30");
  assert.equal(montantDeLaLigne("1.15", "100"), "115.00");
  assert.equal(montantDeLaLigne("0.1", "0.2"), "0.02");
});

cas("l'arrondi tombe UNE fois, à la fin", () => {
  // 1,005 × 3 = 3,015 → 3,02. Arrondir la quantité d'abord donnerait 3,00 :
  // l'arrondi se paierait deux fois.
  assert.equal(montantDeLaLigne("1.005", "3"), "3.02");
  assert.equal(montantDeLaLigne("0.333", "3"), "1.00");
});

cas("une virgule décimale ne passe PAS pour un nombre — elle vaut zéro, elle n'invente rien", () => {
  // Le champ est en `inputMode="decimal"` : sur un clavier français, le doigt
  // tombe sur la virgule. `Decimal` ne la lit pas, et un devis qui compterait
  // « 2,5 » comme 25 serait pire que muet.
  assert.equal(montantDeLaLigne("2,5", "100"), "0.00");
});

cas("ce qui est vide ou absent pèse zéro, et ne lève jamais", () => {
  assert.equal(montantDeLaLigne("", "250"), "0.00");
  assert.equal(montantDeLaLigne("3", ""), "0.00");
  assert.equal(montantDeLaLigne(null, null), "0.00");
  assert.equal(montantDeLaLigne(undefined, "10"), "0.00");
  assert.equal(montantDeLaLigne("  ", " "), "0.00");
  // Une exception ici remonterait à l'écran en identifiant opaque, et il
  // lirait « une erreur est survenue » en écrivant son devis (`AGENTS.md`).
  assert.equal(montantDeLaLigne("trois", "250"), "0.00");
});

cas("un montant négatif reste négatif : c'est un avoir, pas une erreur à masquer", () => {
  assert.equal(montantDeLaLigne("1", "-120"), "-120.00");
});

// ─── ET PERSONNE D'AUTRE NE MULTIPLIE ──────────────────────────────────────

cas("la règle n'est écrite qu'à UN endroit", () => {
  /**
   * **C'est la moitié qui empêche que ça se reproduise.** Une fonction juste
   * ne protège de rien si un écran, un dépôt ou un PDF refait la
   * multiplication chez lui : c'est précisément ainsi que les deux copies
   * étaient nées.
   */
  const racine = path.join(__dirname, "..", "src");
  const coupables: string[] = [];
  const lire = (dossier: string) => {
    for (const entree of readdirSync(dossier)) {
      const complet = path.join(dossier, entree);
      if (statSync(complet).isDirectory()) lire(complet);
      else if (/\.tsx?$/.test(complet) && !complet.endsWith(path.join("lib", "montant-de-ligne.ts"))) {
        const source = readFileSync(complet, "utf8");
        // Une multiplication dont les deux bouts sont une quantité et un prix.
        for (const m of source.matchAll(/(quantite|quantité)[^\n]{0,60}\.times\(|\.times\([^)\n]{0,40}(prixUnitaire|prix_unitaire)/gi)) {
          const avant = source.slice(0, m.index ?? 0);
          coupables.push(`${path.relative(racine, complet)}:${avant.split("\n").length}`);
        }
      }
    }
  };
  lire(racine);
  assert.deepEqual(
    coupables,
    [],
    "une seconde multiplication quantité × prix : deux écritures d'une règle qui " +
      "décide de ce que le client paie —\n      " + coupables.join("\n      ")
  );
});

// ─── ET LE TOTAL EST TOUJOURS LA SOMME DES LIGNES ──────────────────────────

cas("sur mille devis tirés au hasard, le total HT est EXACTEMENT la somme des lignes", () => {
  /**
   * **C'est la question qu'il a posée, prise au mot :** *« si les lignes ne
   * s'additionnent pas ou mal, c'est hyper grave et ça ne doit jamais
   * arriver »*.
   *
   * On ne se contente donc pas de quelques exemples choisis : on tire mille
   * devis — nombres de lignes, quantités, prix et taux variés, avec des
   * décimales qui font mentir la virgule flottante — et l'on vérifie que le
   * total rendu par `totauxAvecReduction` tombe au centime sur la somme des
   * montants que `montantDeLaLigne` a produits.
   *
   * **Le tirage est REPRODUCTIBLE** (graine fixe) : un rouge se rejoue à
   * l'identique, au lieu de disparaître au contrôle suivant.
   */
  let graine = 20260913;
  const suivant = () => {
    // Générateur simple et stable — on ne veut pas d'une dépendance pour ça.
    graine = (graine * 1103515245 + 12345) % 2147483648;
    return graine / 2147483648;
  };
  const centimes = (v: string) => Math.round(Number(v) * 100);

  for (let devis = 0; devis < 1000; devis++) {
    const combien = 1 + Math.floor(suivant() * 12);
    const lignes = Array.from({ length: combien }, () => {
      const quantite = (suivant() * 40).toFixed(suivant() < 0.5 ? 0 : 2);
      const prix = (suivant() * 2000).toFixed(2);
      return { montant: montantDeLaLigne(quantite, prix), tauxTva: null as string | null };
    });
    const attendu = lignes.reduce((somme, l) => somme + centimes(l.montant), 0);
    const rendu = totauxAvecReduction(lignes, "20");
    assert.equal(
      centimes(rendu.brutHt),
      attendu,
      `devis n° ${devis} : ${combien} ligne(s) font ${(attendu / 100).toFixed(2)} €, le total dit ${rendu.brutHt} €`
    );
    // Sans remise, le net est le brut — un écart ici ferait payer une remise
    // que personne n'a accordée.
    assert.equal(rendu.totalHt, rendu.brutHt, `devis n° ${devis} : un écart entre brut et net sans remise`);
  }
});

cas("la TVA et le TTC suivent le HT, au centime", () => {
  const lignes = [{ montant: montantDeLaLigne("3", "250"), tauxTva: null }];
  const t = totauxAvecReduction(lignes, "20");
  assert.equal(t.totalHt, "750.00");
  assert.equal(t.totalTva, "150.00");
  assert.equal(t.totalTtc, "900.00");
  // Et avec une remise de 10 % : 750 − 75 = 675, TVA 135, TTC 810.
  const r = totauxAvecReduction(lignes, "20", "10");
  assert.equal(r.reductionMontant, "75.00");
  assert.equal(r.totalHt, "675.00");
  assert.equal(r.totalTva, "135.00");
  assert.equal(r.totalTtc, "810.00");
});

console.log(echecs === 0 ? "\n✅ Une ligne pèse ce qu'elle doit, et une seule règle le dit." : `\n❌ ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
