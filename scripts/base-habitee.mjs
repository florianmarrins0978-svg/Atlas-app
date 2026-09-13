// La base porte-t-elle DÉJÀ du travail ? — la question qu'il faut poser avant
// de la vider.
//
// ───────────────────────────────────────────────────────────────────────────
// **Sa question du 13 septembre 2026 : « ça va pas supprimer toutes mes
// données ? »** — posée devant un « Rebuild Container » que je venais de lui
// conseiller pour réparer son port. La réponse était OUI, et c'est lui qui l'a
// vue.
//
// **C'est la DEUXIÈME fois.** Le 10 août 2026, je lui conseillais de supprimer
// son espace ; il avait répondu *« ça va effacer tout ce qu'il y a en
// mémoire »*, et `scripts/sauvegarder-banc.sh` est né de cette correction-là.
// Un an de leçons plus tard, le même conseil repartait sous un autre nom.
//
// **La racine n'est pas le conseil, c'est le script.** `preparer.sh` est le
// `postCreateCommand` : il tourne à chaque CRÉATION de conteneur, donc à chaque
// reconstruction — et il appelait le seed sans rien demander. Or le seed VIDE
// la base (`TRUNCATE … CASCADE`, `src/server/db/seed.ts`), et la base, elle,
// **survit** à la reconstruction : elle vit sur le volume nommé `atlas-pgdata`
// (`docker-compose.yml`). Le script supposait donc une base vierge devant une
// base habitée, et l'écrasait.
//
// Un espace qui se répare ne doit jamais coûter les chantiers qu'il porte.
// ───────────────────────────────────────────────────────────────────────────
//
//   0  HABITÉE — il y a du travail dedans : ne rien écraser
//   1  VIERGE — on peut amorcer sans rien perdre
//   2  indéterminé — on n'a pas pu demander
//
// **Et l'indétermination se range du côté d'HABITÉE**, chez l'appelant : se
// tromper en n'amorçant pas coûte une commande (`npm run db:seed`) ; se tromper
// en amorçant coûte ses données, et rien ne les rend.

import pg from "pg";

const URL = process.env.DATABASE_SUPER_URL ?? process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!URL) process.exit(2);

const client = new pg.Client({ connectionString: URL, connectionTimeoutMillis: 10_000 });

try {
  await client.connect();

  // **UN RÔLE QUI NE TRAVERSE PAS LA RLS COMPTE ZÉRO SUR UNE BASE PLEINE**, et
  // ce zéro-là ferait vider les chantiers du patron. C'est la leçon déjà payée
  // par `sauvegarder-banc.mjs` — une sauvegarde faite sous `atlas_app` est vide
  // de la moitié des lignes, et personne ne s'en aperçoit avant d'en avoir
  // besoin. Ici, le prix serait pire : ce n'est pas une copie ratée, c'est
  // l'original.
  //
  // On le MESURE auprès de la base plutôt que de le déduire du nom dans
  // l'adresse : un rôle renommé, une adresse montée autrement, et la déduction
  // se tromperait en silence.
  const { rows: qui } = await client.query(
    "SELECT current_setting('is_superuser') = 'on' AS super, " +
      "COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user), false) AS passe"
  );
  if (!qui[0].super && !qui[0].passe) process.exit(2);

  // **On compte les ENTREPRISES, et c'est le bon témoin.** Tout le reste
  // dépend d'elles : pas d'entreprise, pas de client, pas de chantier, pas de
  // devis. Une table absente — base jamais migrée — rend `undefined_table`,
  // qui est bien une base vierge.
  const { rows } = await client.query("SELECT count(*)::int AS n FROM entreprises");
  process.exit(rows[0].n > 0 ? 0 : 1);
} catch (panne) {
  // `42P01` : la table n'existe pas encore. C'est une base neuve, pas un doute.
  process.exit(panne?.code === "42P01" ? 1 : 2);
} finally {
  await client.end().catch(() => {});
}
