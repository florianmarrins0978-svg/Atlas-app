import pg from "pg";
import type { Occupation } from "../../lib/garde-seed";

/**
 * La base porte-t-elle DÉJÀ du travail ? La question qu'il faut poser avant de
 * la vider.
 *
 * **Sa question du 13 septembre 2026 : « ça va pas supprimer toutes mes
 * données ? »**, devant un « Rebuild Container » qu'on venait de lui conseiller.
 * La réponse était oui, et c'était la deuxième fois (10 août : *« ça va effacer
 * tout ce qu'il y a en mémoire »*).
 *
 * **Elle vit ici, et le seed seul la pose (25 octobre 2026).** Elle vivait dans
 * `preparer.sh`, l'appelant du premier allumage : `npm run db:seed` tapé à la
 * main n'y passait pas, et vidait ses chantiers. Le seul endroit qui détruit
 * est désormais celui qui demande (`scripts/test-base-habitee.ts`).
 *
 * **L'indétermination se range du côté d'habitée**, chez l'appelant : se
 * tromper en n'amorçant pas coûte un forçage écrit en toutes lettres ; se
 * tromper en amorçant coûte ses données, et rien ne les rend.
 */
export async function mesurerOccupation(adresse: string): Promise<Occupation> {
  const client = new pg.Client({ connectionString: adresse, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();

    // **UN RÔLE QUI NE TRAVERSE PAS LA RLS COMPTE ZÉRO SUR UNE BASE PLEINE**, et
    // ce zéro-là ferait vider ses chantiers. On le MESURE auprès de la base
    // plutôt que de le déduire du nom dans l'adresse : un rôle renommé, et la
    // déduction se tromperait en silence.
    const { rows: qui } = await client.query(
      "SELECT current_setting('is_superuser') = 'on' AS super, " +
        "COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user), false) AS passe",
    );
    if (!qui[0].super && !qui[0].passe) return "indeterminee";

    // **On compte les ENTREPRISES** : tout le reste dépend d'elles.
    const { rows } = await client.query("SELECT count(*)::int AS n FROM entreprises");
    return rows[0].n > 0 ? "habitee" : "vierge";
  } catch (panne) {
    // `42P01` : la table n'existe pas encore. Une base jamais migrée, pas un doute.
    return (panne as { code?: string }).code === "42P01" ? "vierge" : "indeterminee";
  } finally {
    await client.end().catch((fin: unknown) => {
      console.warn(`Fermeture de la connexion de mesure impossible : ${fin instanceof Error ? fin.message : fin}`);
    });
  }
}
