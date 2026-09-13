import assert from "node:assert/strict";
// Module JS voisin : le diagnostic tourne sur son espace sans passer par
// TypeScript, et c'est délibéré — il doit marcher là où rien n'est compilé.
import { migrationsManquantes, ligneEtatBase, lireEtatDeLaBase } from "./_etat-de-la-base.mjs";

/**
 * SA BASE PORTE-T-ELLE CE QUE CE CODE ATTEND ? — la règle, sans base.
 *
 * **Ce qu'elle défend, et ce n'est pas du confort.** Le 13 septembre 2026, sa
 * fiche annonçait « tout concorde » pendant qu'il ne pouvait pas créer de
 * compte : elle publiait le code servi, jamais l'état de la base. Une migration
 * non appliquée fait tomber l'écriture, et rien ne le disait — ni à lui, ni à
 * nous.
 */

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function casAsync(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== L'état de sa base, publié sur sa fiche ===\n");

  cas("une base à jour ne manque de rien", () => {
    assert.deepEqual(migrationsManquantes(["0001.sql", "0002.sql"], ["0001.sql", "0002.sql"]), []);
  });

  cas("LE CAS DU 13 SEPTEMBRE : la migration de l'essai n'est pas passée", () => {
    assert.deepEqual(
      migrationsManquantes(["0088.sql", "0089_essai_gratuit.sql"], ["0088.sql"]),
      ["0089_essai_gratuit.sql"]
    );
  });

  cas("UNE BASE EN AVANCE N'EST PAS UN RETARD — revenir en arrière n'alarme personne", () => {
    // Il arrive qu'on serve une version antérieure : la base porte alors des
    // migrations que ce code ne connaît pas. Ce n'est pas ce qu'on cherche, et
    // un avertissement qui parle à tort s'apprend à être ignoré.
    assert.deepEqual(migrationsManquantes(["0001.sql"], ["0001.sql", "0002.sql"]), []);
  });

  cas("la ligne publiée dit le compte, et nomme ce qui manque", () => {
    assert.match(ligneEtatBase({ statut: "a-jour", appliquees: 105 }), /à jour \(105 migration/);
    const enRetard = ligneEtatBase({ statut: "en-retard", manquantes: ["0089.sql"], appliquees: 104 });
    assert.match(enRetard, /EN RETARD/);
    assert.match(enRetard, /0089\.sql/);
  });

  cas("cinq manquantes ne déroulent pas la liste entière sur son téléphone", () => {
    const noms = ["1.sql", "2.sql", "3.sql", "4.sql", "5.sql"];
    const ligne = ligneEtatBase({ statut: "en-retard", manquantes: noms, appliquees: 0 });
    assert.match(ligne, /\+2/);
  });

  cas("LE GESTE RESTE SÛR — jamais reconstruire, jamais supprimer", () => {
    // `CLAUDE.md` §4 septies : on ne lui propose JAMAIS un geste qui peut
    // effacer ses chantiers. La ligne ne porte aucun remède ; le verdict, lui,
    // ne connaît que le rallumage — et c'est `test-verdict-port.ts` qui tient
    // cette moitié-là pour toute la fiche.
    const ligne = ligneEtatBase({ statut: "en-retard", manquantes: ["0089.sql"], appliquees: 0 });
    for (const interdit of ["reconstru", "supprim", "seed", "amorc", "vider"]) {
      assert.ok(!ligne.toLowerCase().includes(interdit), `la ligne propose « ${interdit} » : ${ligne}`);
    }
  });

  await casAsync("SANS ADRESSE, ON DIT « INCONNU » — jamais « à jour »", async () => {
    // Un contrôle qui mesure zéro ne mesure rien (`CLAUDE.md` §5) : répondre
    // « à jour » faute d'avoir pu regarder serait le pire des deux.
    const etat = await lireEtatDeLaBase({ url: null, fichiers: ["0001.sql"] });
    assert.equal(etat.statut, "inconnu");
    assert.match(ligneEtatBase(etat), /inconnu/);
  });

  await casAsync("une base injoignable se dit, elle ne se devine pas", async () => {
    const etat = await lireEtatDeLaBase({
      url: "postgresql://personne@127.0.0.1:1/rien",
      fichiers: ["0001.sql"],
      delaiMs: 1500,
    });
    assert.equal(etat.statut, "inconnu", `on a conclu sans pouvoir lire : ${JSON.stringify(etat)}`);
  });

  await casAsync("aucune migration sur le disque : on ne conclut pas non plus", async () => {
    const etat = await lireEtatDeLaBase({ url: "postgresql://x@127.0.0.1:1/x", fichiers: [] });
    assert.equal(etat.statut, "inconnu");
  });

  console.log(`\nL'état de sa base — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main();
