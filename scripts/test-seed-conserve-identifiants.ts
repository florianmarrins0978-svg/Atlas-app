import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { Client } from "pg";

// **« On avait raccordé l'agenda Google. Pourquoi il ne l'est plus ? »**
//
// Le patron, le 11 août 2026 au matin, en rouvrant « Mon agenda » : « Le
// raccordement n'est pas encore disponible ». Il l'avait pourtant relié la
// veille. La cause est dans la migration 0032 :
//
//     "entreprise_id" ... REFERENCES "entreprises"("id") ON DELETE CASCADE
//
// Ses identifiants Google vivent dans une ligne rattachée à son entreprise, et
// le seed fait `TRUNCATE ... entreprises ... CASCADE`. Refaire le jeu de
// démonstration les emportait — le même geste qui avait produit la session
// fantôme la veille au soir. Un seul `seed` a causé les deux pannes.
//
// **Ces identifiants ne sont pas une donnée de démonstration** : il est allé les
// créer chez Google et les a recopiés à la main. Le seed les conserve donc.
//
// Ce que cette suite tient :
//
//   1. les identifiants survivent au seed, et se retrouvent sur la NOUVELLE
//      entreprise — les garder sans les rattacher ne servirait à rien ;
//   2. **l'autorisation, elle, ne survit PAS.** Les jetons disent « cet artisan
//      a donné son accord pour CETTE entreprise » ; l'entreprise disparaît,
//      l'accord tombe avec elle. Conserver les jetons ferait dire à l'écran
//      « agenda relié » pour un consentement qui ne vaut plus.

// **Le seed vide puis reconstruit : il lui faut un rôle qui traverse la RLS et
// qui peut vider les tables.** Sous `atlas_app`, il échoue — et l'erreur brute
// de `tsx` ne dit rien de compréhensible. C'est écrit dans `preparer.sh`, qui
// lance le seed avec `DATABASE_SUPER_URL` ; on fait pareil, en se rabattant sur
// le rôle propriétaire, puis sur ce qu'on a.
const URL_BASE =
  process.env.DATABASE_SUPER_URL ?? process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;

let echecs = 0;

async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/**
 * Ouvre une session, en posant le contexte d'isolation quand on le connaît.
 *
 * **La RLS est en `FORCE` sur ce dépôt** : même le propriétaire des tables y est
 * soumis. Sans `app.entreprise_id`, l'insertion est refusée par un
 * `ExecWithCheckOptions` que rien ne relie à l'isolation, et la lecture rend
 * simplement zéro ligne — silencieusement, ce qui est pire. On pose donc le
 * contexte comme le fait `withEntreprise`, au lieu de contourner quoi que ce
 * soit : un essai qui affaiblirait la RLS n'éprouverait plus rien.
 */
async function avecBase<T>(fn: (c: Client) => Promise<T>, entrepriseId?: string): Promise<T> {
  const client = new Client({ connectionString: URL_BASE });
  await client.connect();
  try {
    if (entrepriseId) {
      await client.query("select set_config('app.entreprise_id', $1, false)", [entrepriseId]);
    }
    return await fn(client);
  } finally {
    await client.end();
  }
}

function rejouerLeSeed() {
  try {
    execFileSync("npx", ["--no-install", "tsx", "src/server/db/seed.ts"], {
      env: { ...process.env, DATABASE_URL: URL_BASE },
      stdio: "ignore",
    });
  } catch {
    // **Désigner le bon coupable.** L'erreur brute de `tsx` ne dit rien : elle
    // recrache une pile de transformation, pas la permission qui manque.
    throw new Error(
      "le jeu de démonstration n'a pas pu être rejoué — il lui faut un rôle qui " +
        "peut VIDER les tables (DATABASE_SUPER_URL, ou à défaut DATABASE_ADMIN_URL). " +
        "Sous « atlas_app », le TRUNCATE est refusé."
    );
  }
}

async function main() {
  console.log("=== Le seed conserve ce que l'artisan a tapé à la main ===\n");

  // On part d'un état connu : le jeu de démonstration, puis des identifiants
  // posés comme le patron les pose — à la main, dans l'écran « Mon agenda ».
  rejouerLeSeed();

  const AVANT = {
    clientId: "1234-essai.apps.googleusercontent.com",
    clientSecret: "GOCSPX-secret-chiffre-d-essai",
    redirection: "https://exemple-espace-3000.app.github.dev/api/agenda/google/retour",
  };

  const entrepriseAvant = await avecBase(async (c) => {
    const { rows } = await c.query("select id from entreprises limit 1");
    assert.ok(rows[0], "aucune entreprise après le seed : la base est-elle montée ?");
    return rows[0].id as string;
  });

  // Le raccordement, posé exactement comme le patron le pose : à la main, dans
  // l'écran « Mon agenda », sous le contexte de SON entreprise.
  await avecBase(
    (c) =>
      c.query(
        `insert into agendas_externes
           (entreprise_id, fournisseur, client_id, client_secret, redirection,
            compte, jeton_acces, jeton_rafraichissement)
         values ($1, 'google', $2, $3, $4, 'patron@exemple.fr', 'jeton-acces', 'jeton-rafraichissement')`,
        [entrepriseAvant, AVANT.clientId, AVANT.clientSecret, AVANT.redirection]
      ),
    entrepriseAvant
  );

  // Et c'est là que tout se jouait : on refait le jeu de démonstration.
  rejouerLeSeed();

  const entrepriseApres = await avecBase(async (c) => {
    const { rows } = await c.query("select id from entreprises limit 1");
    assert.ok(rows[0], "aucune entreprise après le second seed");
    return rows[0].id as string;
  });

  const apres = await avecBase(async (c) => {
    const { rows } = await c.query(
      `select a.client_id, a.client_secret, a.redirection, a.compte,
              a.jeton_acces, a.jeton_rafraichissement, a.entreprise_id
         from agendas_externes a`
    );
    return rows;
  }, entrepriseApres);

  await cas("les identifiants Google survivent au jeu de démonstration", async () => {
    assert.equal(
      apres.length,
      1,
      apres.length === 0
        ? "les identifiants ont été emportés par le TRUNCATE CASCADE — le patron doit tout recoller"
        : `${apres.length} lignes au lieu d'une`
    );
    assert.equal(apres[0].client_id, AVANT.clientId, "l'identifiant client a changé");
    assert.equal(apres[0].client_secret, AVANT.clientSecret, "le secret client a changé");
    assert.equal(apres[0].redirection, AVANT.redirection, "l'adresse de retour a changé");
  });

  await cas("ils sont rattachés à la NOUVELLE entreprise, pas à une disparue", async () => {
    assert.notEqual(
      apres[0].entreprise_id,
      entrepriseAvant,
      "l'entreprise n'a pas été recréée : ce contrôle n'éprouve plus rien"
    );
    assert.equal(
      apres[0].entreprise_id,
      entrepriseApres,
      "les identifiants pendent dans le vide : l'écran ne les verra jamais"
    );
  });

  // **Le contrôle qui protège du remède.** Garder l'autorisation ferait dire à
  // l'écran « agenda relié » pour un consentement donné à une entreprise qui
  // n'existe plus.
  await cas("l'autorisation, elle, ne survit pas — seuls les identifiants", async () => {
    assert.equal(apres[0].jeton_acces, null, "le jeton d'accès a survécu à la disparition de l'entreprise");
    assert.equal(
      apres[0].jeton_rafraichissement,
      null,
      "le jeton de rafraîchissement a survécu : l'écran annoncerait un raccordement qui ne vaut plus"
    );
    assert.equal(apres[0].compte, null, "le compte relié a survécu");
  });

  // On ne laisse pas derrière nous ce qu'on a posé : la suite suivante doit
  // retrouver une base propre, sans quoi c'est ce test qui casserait les autres.
  await avecBase((c) => c.query("delete from agendas_externes"), entrepriseApres);

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Identifiants conservés — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
