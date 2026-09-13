/**
 * SA BASE PORTE-T-ELLE CE QUE CE CODE ATTEND ?
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi ce fichier existe, et ce que son absence a coûté — 13 septembre
 * 2026.** Sa plainte : *« je peux toujours pas créer de compte »*, capture à
 * l'appui. La panne se reproduit ici en retirant une migration de la base : le
 * code demande ce que la base n'a pas, l'écriture tombe, et rien ne le dit.
 *
 * **Sa machine le savait, et ne le disait à personne.** Les migrations
 * s'appliquent à chaque allumage (`.devcontainer/appliquer-migrations.sh`), et
 * cette commande **dit** quand elle échoue — dans le journal de démarrage, qui
 * n'est publié nulle part (dépôt public). Une base restée en arrière était donc
 * invisible des deux côtés : de lui, qui voit un écran qui tombe, et de nous,
 * qui devinons. C'est exactement la classe d'échanges que `CLAUDE.md` §1 bis a
 * fermée pour le port et la version servie — et que la base avait échappé.
 *
 * **Le code servi et la base sont deux choses, et la fiche n'en publiait
 * qu'une.** « Code SERVI : 3c5bda7 · tout concorde » peut être vrai pendant que
 * la base est deux migrations en arrière.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Ce qu'on compare, et pourquoi c'est fiable.** `scripts/run-migrations.ts`
 * inscrit chaque fichier appliqué dans `public._migrations`, par son NOM. Le
 * dossier `drizzle/` porte les fichiers attendus. La différence des deux est
 * la réponse, sans interprétation.
 *
 * La lecture ne demande aucun droit particulier : le rôle applicatif a `SELECT`
 * sur cette table. Elle ne fait jamais tomber le diagnostic — une base
 * injoignable rend « inconnu », qui est la vérité, et pas « à jour ».
 */

/**
 * Ce qui manque à la base, d'après les deux listes. **Fonction pure** : c'est
 * ce qui la rend éprouvable sans base, et c'est là que vivent les pièges (une
 * base en AVANCE sur le code, ce qui arrive en revenant sur une version
 * antérieure, n'est pas un retard et ne doit alarmer personne).
 *
 * @param {string[]} attendues
 * @param {string[]} appliquees
 * @returns {string[]}
 */
export function migrationsManquantes(attendues, appliquees) {
  const deja = new Set(appliquees);
  return attendues.filter((f) => !deja.has(f)).sort();
}

/**
 * La ligne que la fiche publie. Rien de plus — et surtout, le geste qu'elle
 * propose ne touche à aucune donnée (`CLAUDE.md` §4 septies : jamais
 * reconstruire, jamais supprimer, jamais réamorcer).
 *
 * @param {{ statut: string, appliquees?: number, manquantes?: string[], raison?: string }} etat
 * @returns {string}
 */
export function ligneEtatBase(etat) {
  if (etat.statut === "inconnu") return `inconnu — ${etat.raison}`;
  if (etat.statut === "a-jour") return `à jour (${etat.appliquees} migration(s))`;
  const noms = etat.manquantes.slice(0, 3).join(", ");
  const reste = etat.manquantes.length > 3 ? `, +${etat.manquantes.length - 3}` : "";
  return `EN RETARD sur le code — ${etat.manquantes.length} migration(s) non appliquée(s) : ${noms}${reste}`;
}

/**
 * Interroge vraiment la base. Rend toujours un état, jamais une exception :
 * ce diagnostic est lu quand plus rien ne va, et il ne doit pas tomber avec le
 * reste.
 *
 * @param {{ url?: string | null, fichiers?: string[], delaiMs?: number }} [options]
 * @returns {Promise<{ statut: "a-jour" | "en-retard" | "inconnu", appliquees?: number, manquantes?: string[], raison?: string }>}
 */
export async function lireEtatDeLaBase({ url, fichiers, delaiMs = 4000 } = {}) {
  if (!url) return { statut: "inconnu", raison: "aucune adresse de base dans l'environnement" };
  if (!fichiers || fichiers.length === 0) {
    return { statut: "inconnu", raison: "aucune migration trouvée dans drizzle/" };
  }

  let Client;
  try {
    ({ Client } = await import("pg"));
  } catch {
    return { statut: "inconnu", raison: "le pilote PostgreSQL n'est pas installé" };
  }

  const client = new Client({ connectionString: url, connectionTimeoutMillis: delaiMs });
  try {
    await client.connect();
    const { rows } = await Promise.race([
      client.query("SELECT nom FROM _migrations"),
      new Promise((_, refuser) => setTimeout(() => refuser(new Error("délai dépassé")), delaiMs)),
    ]);
    const manquantes = migrationsManquantes(fichiers, rows.map((r) => r.nom));
    return manquantes.length === 0
      ? { statut: "a-jour", appliquees: rows.length }
      : { statut: "en-retard", manquantes, appliquees: rows.length };
  } catch (e) {
    // `_migrations` absente veut dire qu'AUCUNE migration n'est passée : c'est
    // le retard maximal, pas une panne de lecture. Le dire autrement enverrait
    // chercher du côté du réseau.
    if (/_migrations.*does not exist|relation .*_migrations/i.test(String(e?.message))) {
      return { statut: "en-retard", manquantes: fichiers, appliquees: 0 };
    }
    return { statut: "inconnu", raison: String(e?.message ?? e).split("\n")[0].slice(0, 120) };
  } finally {
    await client.end().catch(() => {});
  }
}
