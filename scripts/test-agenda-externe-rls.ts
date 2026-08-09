import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  basculerAgenda,
  configurationDeLEntreprise,
  enregistrerIdentifiants,
  debrancherAgenda,
  enregistrerRaccordement,
  etatAgenda,
  periodesOccupeesExterieures,
  periodesOccupeesPourEntreprise,
} from "../src/server/repositories/agendas-externes";
import { chiffrer, dechiffrer } from "../src/server/agenda/secret-au-repos";
import { fermerLimiteur } from "../src/server/rate-limit";
import { exporterEntreprise } from "../src/server/repositories/export-entreprise";
import { nettoyerBase } from "./_test-db";

// **Le raccordement à un agenda, éprouvé SOUS LE RÔLE APPLICATIF.**
//
// Le raccordement à Google lui-même ne peut pas être joué ici : cet
// environnement n'a pas de compte, et son mandataire réseau refuse Google. Tout
// ce qui l'entoure, en revanche, se vérifie — et c'est là que se trouvent les
// deux risques qui comptent :
//
//   1. **l'isolation.** Un agenda relié appartient à UNE entreprise. Si la
//      lecture traversait, Atlas barrerait les journées d'un artisan à cause
//      des rendez-vous d'un autre — et lui livrerait au passage l'occupation
//      d'un confrère ;
//   2. **les jetons au repos.** Un jeton de rafraîchissement ouvre le compte
//      Google entier, durablement. Le trouver en clair dans une sauvegarde
//      n'est pas la même fuite qu'un nom de client.
//
// `CLAUDE.md` §5 : les suites navigateur tournent sous un rôle qui traverse la
// RLS, donc elles ne peuvent pas voir le point 1. Cette suite-ci le peut.

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Élagage ${suffixe}` },
    { email: `agenda-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}


/**
 * Les octets réellement stockés, lus au plus près de la base.
 *
 * **Le premier essai de ce contrôle interrogeait `pool` directement, et rendait
 * zéro ligne.** Ce n'était pas un défaut : c'était la RLS qui faisait son
 * travail — sans contexte d'entreprise posé, `atlas_app` ne voit rien. Le
 * contrôle accusait le chiffrement alors qu'il mesurait l'isolation.
 *
 * On pose donc le contexte à la main, sur une connexion à nous, pour regarder
 * la colonne telle qu'elle est écrite.
 */
async function ligneBrute(ctx: Ctx): Promise<{ acces: string; rafraichissement: string } | null> {
  const client = await pool.connect();
  try {
    // **Dans une transaction, et avec `true`.** Le premier jet posait le
    // contexte avec `false` — portée SESSION. La connexion étant mutualisée, le
    // contexte survivait à la requête et se retrouvait sur la suivante : le cas
    // « sans contexte, la table ne rend rien » lisait alors une ligne et
    // accusait l'isolation d'être cassée. Elle ne l'était pas ; c'est le
    // contrôle qui polluait ce qu'il mesurait.
    //
    // Tout le code de production emploie `true` (portée transaction), et cet
    // incident dit pourquoi cela n'est pas une préférence de style.
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [ctx.entrepriseId]);
    const { rows } = await client.query(
      `SELECT jeton_acces, jeton_rafraichissement FROM agendas_externes WHERE entreprise_id = $1`,
      [ctx.entrepriseId]
    );
    await client.query("COMMIT");
    if (rows.length === 0) return null;
    return {
      acces: String(rows[0].jeton_acces),
      rafraichissement: String(rows[0].jeton_rafraichissement),
    };
  } finally {
    client.release();
  }
}

const JETONS = {
  acces: "ya29.faux-jeton-acces-pour-les-controles",
  rafraichissement: "1//faux-jeton-de-rafraichissement",
  expireAt: new Date(Date.now() + 3600_000),
};

async function main() {
  await nettoyerBase();

  console.log("=== Le chiffrement au repos ===");

  await test("un secret chiffré se relit à l'identique", async () => {
    const clair = "1//0gAbCdEf-jeton-de-rafraichissement";
    assert.equal(dechiffrer(chiffrer(clair)), clair);
  });

  await test("deux chiffrements du même secret ne se ressemblent pas", async () => {
    // Sinon deux artisans ayant le même jeton produiraient la même ligne, et
    // une base volée dirait « ces deux-là sont branchés au même compte ».
    assert.notEqual(chiffrer("meme-secret"), chiffrer("meme-secret"));
  });

  await test("un chiffré abîmé rend null, il ne fait pas tomber l'écran", async () => {
    assert.equal(dechiffrer("n'importe quoi"), null);
    assert.equal(dechiffrer("v1.aaa.bbb.ccc"), null);
    assert.equal(dechiffrer(""), null);
  });

  await test("un chiffré modifié d'un caractère est refusé, pas déchiffré à moitié", async () => {
    // C'est ce qu'apporte GCM : la marque d'authenticité. Sans elle, un octet
    // retourné en base rendrait un jeton silencieusement faux.
    const bon = chiffrer("jeton-authentique");
    const morceaux = bon.split(".");
    const corps = Buffer.from(morceaux[3], "base64");
    corps[0] = corps[0] ^ 0x01;
    morceaux[3] = corps.toString("base64");
    assert.equal(dechiffrer(morceaux.join(".")), null);
  });

  console.log("\n=== Ce que la base contient réellement ===");

  const ctxA = await contexte("a");
  const ctxB = await contexte("b");

  await test("les jetons ne sont JAMAIS écrits en clair", async () => {
    await enregistrerRaccordement(ctxA, JETONS, "patron@exemple.test");

    const brut = await ligneBrute(ctxA);
    assert.ok(brut, "aucune ligne écrite");
    assert.ok(!brut.acces.includes(JETONS.acces), "le jeton d'accès dort en clair dans la base");
    assert.ok(
      !brut.rafraichissement.includes(JETONS.rafraichissement),
      "le jeton de rafraîchissement dort en clair — il ouvre le compte Google entier"
    );
    assert.ok(brut.acces.startsWith("v1."), "le format attendu a changé sans le dire");
    // Et ce qui est écrit se relit : un chiffrement qu'on ne sait pas défaire
    // serait une perte de données déguisée en sécurité.
    assert.equal(dechiffrer(brut.rafraichissement), JETONS.rafraichissement);
  });

  await test("sans contexte d'entreprise, la table ne rend RIEN", async () => {
    // Le premier essai du contrôle ci-dessus est tombé ici par accident, et le
    // constat mérite son propre cas : `atlas_app` sans contexte ne voit pas une
    // seule ligne. C'est ce qui empêche un chemin oublié de lire les
    // raccordements de tout le monde.
    const { rows } = await pool.query(`SELECT 1 FROM agendas_externes`);
    assert.equal(rows.length, 0, "la table s'ouvre sans contexte d'entreprise : l'isolation ne tient pas");
  });

  await test("l'export téléchargeable n'emporte AUCUN jeton", async () => {
    // **Ce fichier se télécharge et s'envoie par courriel.** Y joindre les
    // jetons d'un compte Google reviendrait à faire circuler l'accès à l'agenda
    // de l'artisan en pièce jointe — chiffrés ou non, la clé se dérivant d'une
    // configuration serveur.
    //
    // Le contrôle porte sur le fichier ENTIER, jamais sur une table choisie :
    // c'est le fichier que le patron enverra.
    const rendu = JSON.stringify(await exporterEntreprise(ctxA));
    assert.ok(!rendu.includes(JETONS.acces), "le jeton d'accès part dans l'export");
    assert.ok(
      !rendu.includes(JETONS.rafraichissement),
      "le jeton de rafraîchissement part dans l'export : quiconque reçoit le fichier ouvre l'agenda"
    );
    assert.ok(!rendu.includes("jetonAcces"), "la colonne des jetons figure dans l'export");
    assert.ok(!rendu.includes("clientSecret"), "le secret client figure dans l'export");
    assert.ok(!/"v1\.[A-Za-z0-9+/=]{10}/.test(rendu), "un secret chiffré figure dans l'export");

    // Mais ce qui EST sa donnée doit bien y être : quel compte, depuis quand.
    assert.ok(rendu.includes("patron@exemple.test"), "l'export a perdu le compte relié, qui est sa donnée");
  });

  console.log("\n=== Ses identifiants Google, saisis dans l'application ===");

  // **Sa demande du 9 août 2026 :** *« un petit bouton connecter son agenda
  // Google cliquable pour rentrer ses identifiants. »* La veille, le
  // raccordement attendait des variables d'environnement : il créait son projet
  // chez Google, obtenait ses identifiants, et devait ensuite les faire poser
  // par quelqu'un. Le point restait bloqué chez moi alors qu'il avait fait sa
  // part.

  const ctxC = await contexte("c");
  const IDENTIFIANTS = {
    clientId: "1234-abcd.apps.googleusercontent.com",
    clientSecret: "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es",
    redirection: "https://atlas.exemple.test/api/agenda/google/retour",
  };

  await test("des identifiants collés rendent l'entreprise configurée, sans la relier", async () => {
    assert.equal(await configurationDeLEntreprise(ctxC), null, "configurée avant d'avoir rien saisi");
    await enregistrerIdentifiants(ctxC, IDENTIFIANTS);

    const config = await configurationDeLEntreprise(ctxC);
    assert.ok(config, "les identifiants saisis ne sont pas relus");
    assert.equal(config.clientId, IDENTIFIANTS.clientId);
    assert.equal(config.clientSecret, IDENTIFIANTS.clientSecret, "le secret ne se déchiffre pas");
    assert.equal(config.redirection, IDENTIFIANTS.redirection);

    // **Configuré n'est pas relié.** Entre le collage des identifiants et le
    // retour de chez Google, il n'a encore rien autorisé. Confondre les deux
    // afficherait « agenda relié » à quelqu'un qui n'a rien fait.
    const etat = await etatAgenda(ctxC);
    assert.equal(etat.configure, true);
    assert.equal(etat.relie, false, "l'écran annonce un agenda relié alors que rien n'est autorisé");
  });

  await test("le secret client ne dort pas en clair", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [ctxC.entrepriseId]);
      const { rows } = await client.query(
        `SELECT client_id, client_secret FROM agendas_externes WHERE entreprise_id = $1`,
        [ctxC.entrepriseId]
      );
      await client.query("COMMIT");
      assert.ok(
        !String(rows[0].client_secret).includes(IDENTIFIANTS.clientSecret),
        "le secret client dort en clair : il permet d'usurper l'application auprès de Google"
      );
      // L'identifiant, lui, reste en clair : il figure dans l'adresse de
      // consentement que le navigateur affiche. Le chiffrer donnerait
      // l'illusion de protéger une donnée publique par construction.
      assert.equal(rows[0].client_id, IDENTIFIANTS.clientId);
    } finally {
      client.release();
    }
  });

  await test("le secret peut rester vide pour corriger l'adresse de retour", async () => {
    // Google ne remontre JAMAIS le secret après l'avoir créé. Exiger de le
    // ressaisir pour corriger une faute de frappe dans l'adresse serait une
    // impasse dont on ne sort qu'en refaisant un projet Google.
    await enregistrerIdentifiants(ctxC, {
      clientId: IDENTIFIANTS.clientId,
      clientSecret: null,
      redirection: "https://atlas.exemple.test/api/agenda/google/retour?corrige=1",
    });
    const config = await configurationDeLEntreprise(ctxC);
    assert.equal(config?.clientSecret, IDENTIFIANTS.clientSecret, "le secret a été effacé");
    assert.match(config?.redirection ?? "", /corrige=1/, "l'adresse n'a pas été corrigée");
  });

  await test("changer d'identifiants efface les jetons de l'ancien projet", async () => {
    // Des jetons obtenus avec un autre client Google ne valent plus rien. Les
    // garder afficherait « relié » sur un raccordement mort, et le doublon
    // reviendrait sans que rien ne le dise.
    await enregistrerRaccordement(ctxC, JETONS, "patron@exemple.test");
    assert.equal((await etatAgenda(ctxC)).relie, true);

    await enregistrerIdentifiants(ctxC, {
      clientId: "autre-projet.apps.googleusercontent.com",
      clientSecret: "GOCSPX-autre",
      redirection: IDENTIFIANTS.redirection,
    });
    assert.equal(
      (await etatAgenda(ctxC)).relie,
      false,
      "les jetons de l'ancien projet survivent au changement d'identifiants"
    );
  });

  await test("les identifiants d'un artisan restent invisibles pour un autre", async () => {
    assert.equal(
      await configurationDeLEntreprise(ctxB),
      null,
      "B lit les identifiants de C, et pourrait se brancher sur son projet Google"
    );
  });

  console.log("\n=== L'isolation entre artisans ===");

  await test("l'agenda d'un artisan est invisible pour un autre", async () => {
    const chezA = await etatAgenda(ctxA);
    assert.equal(chezA.relie, true, "le raccordement de A n'est pas lu chez A");
    assert.equal(chezA.compte, "patron@exemple.test");

    const chezB = await etatAgenda(ctxB);
    assert.equal(
      chezB.relie,
      false,
      "B voit le raccordement de A : Atlas barrerait ses journées à cause des rendez-vous d'un confrère"
    );
    assert.equal(chezB.compte, null, "l'adresse du compte de A a fuité chez B");
  });

  await test("débrancher chez B n'efface pas le raccordement de A", async () => {
    await debrancherAgenda(ctxB);
    assert.equal((await etatAgenda(ctxA)).relie, true, "B a effacé l'agenda de A");
  });

  await test("la lecture des périodes ne traverse pas non plus", async () => {
    // Sans identifiants Google, la fonction rend une liste vide par le chemin
    // le plus court. Le contrôle porte donc sur ce qui compte ici : elle ne
    // JETTE pas, et ne rend jamais les rendez-vous d'un autre.
    const debut = new Date("2026-09-01T00:00:00Z");
    const fin = new Date("2026-09-30T23:59:59Z");
    assert.deepEqual(await periodesOccupeesExterieures(ctxB, debut, fin), []);
    assert.deepEqual(await periodesOccupeesPourEntreprise(ctxB.entrepriseId, debut, fin), []);
  });

  console.log("\n=== Brancher, mettre en pause, débrancher ===");

  await test("la mise en pause coupe la lecture sans effacer le compte", async () => {
    await basculerAgenda(ctxA, false);
    const etat = await etatAgenda(ctxA);
    assert.equal(etat.relie, true, "la pause a effacé le raccordement");
    assert.equal(etat.actif, false, "la pause n'a pas pris");
    assert.equal(etat.compte, "patron@exemple.test", "le compte a été perdu en route");
  });

  await test("reprendre la lecture remet l'agenda en service", async () => {
    await basculerAgenda(ctxA, true);
    assert.equal((await etatAgenda(ctxA)).actif, true);
  });

  await test("rebrancher ne perd pas le jeton de rafraîchissement", async () => {
    // **Le piège de ce parcours.** Google ne renvoie le jeton de
    // rafraîchissement qu'à la PREMIÈRE autorisation. Un rebranchement qui
    // l'écraserait par `null` condamnerait le raccordement à mourir dans
    // l'heure, sans que rien ne le dise sur le moment.
    await enregistrerRaccordement(
      ctxA,
      { acces: "ya29.nouveau", rafraichissement: null, expireAt: new Date(Date.now() + 3600_000) },
      "patron@exemple.test"
    );
    const brut = await ligneBrute(ctxA);
    assert.equal(
      dechiffrer(brut?.rafraichissement ?? ""),
      JETONS.rafraichissement,
      "le jeton de rafraîchissement a été effacé : le raccordement mourra dans une heure, en silence"
    );
  });

  await test("débrancher efface la ligne et ses jetons", async () => {
    await debrancherAgenda(ctxA);
    const etat = await etatAgenda(ctxA);
    assert.equal(etat.relie, false);
    assert.equal(await ligneBrute(ctxA), null, "les jetons survivent au débranchement");
  });

  await test("sans rien relié, l'écran le dit sans se plaindre", async () => {
    const etat = await etatAgenda(ctxB);
    assert.equal(etat.relie, false);
    assert.equal(etat.actif, false);
    assert.equal(etat.derniereErreur, null);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
