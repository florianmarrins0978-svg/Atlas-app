// LA PREUVE RÉCENTE — ce qui autorise un geste sensible, et pour QUI (M11).
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE TIENT, ET QUI N'EXISTAIT NULLE PART.**
//
// Avant le 25 août 2026, une session suffisait à tout : modifier l'IBAN sur
// lequel les clients virent l'argent, enregistrer une clé Face ID — donc une
// porte permanente qui survit au changement de mot de passe —, ou emporter toute
// l'entreprise dans un fichier.
//
// **Le piège que le brief avait raison de nommer**, et qui décide de la forme de
// cette table : une preuve attachée à l'UTILISATEUR se partagerait entre ses
// appareils. Le patron se ré-authentifie sur son iPhone, et une session volée
// sur un autre ordinateur en profite dans la seconde. C'est le cas « isolation »
// ci-dessous, et il est le plus important du fichier.
//
// Éprouvée SOUS `atlas_app`, comme la production.

import assert from "node:assert/strict";
import { Pool } from "pg";
import { hash as bcrypt } from "bcryptjs";
import { pool, db } from "../src/server/db/client";
import { users, preuvesAuthentification } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import {
  poserPreuveParMotDePasse,
  preuveRecenteExiste,
  exigerPreuveRecente,
  effacerPreuves,
  purgerPreuvesPerimees,
  PreuveRecenteExigeeError,
} from "../src/server/preuve-recente";
import { FENETRE_PREUVE_MINUTES, GESTES_SENSIBLES, preuveEstRecente } from "../src/lib/preuve-recente";

/** Le rôle qui a le droit d'écrire dans la table — pour le MONTAGE seulement. */
const proprio = new Pool({
  connectionString:
    process.env.DATABASE_ADMIN_URL ?? "postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test",
});

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/**
 * Vieillir une preuve sans attendre : on recule sa date en base.
 *
 * **Sous le rôle PROPRIÉTAIRE**, depuis `0066_preuve_par_le_moteur.sql` :
 * `atlas_app` n'a plus le droit d'écrire dans cette table, et c'est exactement
 * ce qu'on veut. Un montage d'essai peut emprunter le rôle qui en a le droit ;
 * la production, elle, passe par la fonction.
 *
 * **Et cela évite un test qui dormirait dix minutes** : la borne se mesure en
 * reculant la date, jamais en attendant l'horloge.
 */
async function vieillirDe(utilisateurId: string, sessionId: string, minutes: number) {
  await proprio.query(
    `UPDATE preuves_authentification SET prouve_le = now() - make_interval(mins => $3)
      WHERE utilisateur_id = $1 AND session_id = $2`,
    [utilisateurId, sessionId, minutes]
  );
}

async function main() {
  console.log("=== La preuve récente, et à qui elle appartient ===\n");

  const marque = Date.now();
  const [personne] = await db
    .insert(users)
    .values({ email: `preuve-${marque}@test.local`, nom: "Preuve" })
    .returning({ id: users.id });
  const [voisin] = await db
    .insert(users)
    .values({ email: `voisin-${marque}@test.local`, nom: "Voisin" })
    .returning({ id: users.id });

  const SESSION_A = `session-a-${marque}`;
  const SESSION_B = `session-b-${marque}`;

  /**
   * **Un vrai mot de passe, parce qu'une preuve ne naît plus autrement.**
   *
   * Depuis `drizzle/0066_preuve_par_le_moteur.sql`, `atlas_app` n'a plus le droit
   * d'écrire dans cette table : seule la fonction en base le peut, et elle
   * vérifie le mot de passe dans la même instruction. Une suite qui poserait une
   * preuve « pour voir » éprouverait donc autre chose que la production.
   */
  const MOT_DE_PASSE = "le-mot-de-passe-de-la-suite";
  for (const id of [personne.id, voisin.id]) {
    await proprio.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [await bcrypt(MOT_DE_PASSE, 10), id]);
  }
  const poserPreuve = async (utilisateurId: string, sessionId: string) => {
    const ok = await poserPreuveParMotDePasse(utilisateurId, sessionId, MOT_DE_PASSE);
    if (!ok) throw new Error("le montage n'a pas pu poser de preuve : le mot de passe n'a pas été accepté");
  };

  // ─── LE CŒUR : l'isolation entre deux sessions du MÊME utilisateur ────────

  await essai("SANS PREUVE, un geste sensible est refusé", async () => {
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_A }), false);
  });

  await essai("après une preuve, la MÊME session passe", async () => {
    await poserPreuve(personne.id, SESSION_A);
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_A }), true);
  });

  await essai("UNE AUTRE SESSION DU MÊME UTILISATEUR RESTE REFUSÉE", async () => {
    /**
     * **LE CONTRÔLE QUI JUSTIFIE TOUTE LA FORME DE CETTE TABLE.** Si la preuve
     * était portée par l'utilisateur seul, ce cas serait vert — et une session
     * volée hériterait de la ré-authentification faite sur le téléphone du
     * patron, dans la seconde qui suit.
     */
    assert.equal(
      await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_B }),
      false,
      "LA PREUVE FUIT ENTRE DEUX SESSIONS : une session volée profiterait de celle du patron"
    );
  });

  await essai("et elle ne fuit pas non plus vers un AUTRE utilisateur", async () => {
    assert.equal(await preuveRecenteExiste({ utilisateurId: voisin.id, sessionId: SESSION_A }), false);
  });

  await essai("SANS identité de session, jamais de passe-droit", async () => {
    // Un jeton d'avant cette version n'en porte pas. Le traiter comme prouvé
    // ouvrirait la garde à toutes les sessions d'avant — celles qu'on vise.
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: undefined }), false);
  });

  // ─── L'EXPIRATION ─────────────────────────────────────────────────────────

  console.log("");

  await essai(`une preuve de ${FENETRE_PREUVE_MINUTES} minutes moins une vaut encore`, async () => {
    await poserPreuve(personne.id, SESSION_A);
    await vieillirDe(personne.id, SESSION_A, FENETRE_PREUVE_MINUTES - 1);
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_A }), true);
  });

  await essai(`LA BORNE EST INCLUSIVE : exactement ${FENETRE_PREUVE_MINUTES}:00 vaut ENCORE`, async () => {
    /**
     * **La règle doit être déterministe, et la voici en toutes lettres :**
     * `preuveEstRecente` compare `age <= fenêtre`. Une preuve d'exactement dix
     * minutes est donc **acceptée** ; c'est à dix minutes et une milliseconde
     * qu'elle tombe.
     *
     * Éprouvé en RECULANT la date, jamais en attendant l'horloge : une suite qui
     * dormirait dix minutes ne serait jouée par personne.
     */
    await poserPreuve(personne.id, SESSION_A);
    await vieillirDe(personne.id, SESSION_A, FENETRE_PREUVE_MINUTES);
    const [ligne] = await db
      .select({ prouveLe: preuvesAuthentification.prouveLe })
      .from(preuvesAuthentification)
      .where(eq(preuvesAuthentification.sessionId, SESSION_A));
    // On mesure la règle pure à l'instant EXACT de la borne, pour que le verdict
    // ne dépende pas des millisecondes écoulées entre l'écriture et la lecture.
    const pile = new Date(ligne.prouveLe.getTime() + FENETRE_PREUVE_MINUTES * 60_000);
    assert.equal(preuveEstRecente(ligne.prouveLe, pile), true, "la borne exclut dix minutes pile");
    assert.equal(
      preuveEstRecente(ligne.prouveLe, new Date(pile.getTime() + 1)),
      false,
      "une milliseconde après la borne, la preuve vaut encore"
    );
  });

  await essai("UNE PREUVE PÉRIMÉE NE VAUT PLUS RIEN", async () => {
    await poserPreuve(personne.id, SESSION_A);
    await vieillirDe(personne.id, SESSION_A, FENETRE_PREUVE_MINUTES + 1);
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_A }), false);
  });

  await essai("se reprouver RAFRAÎCHIT — et n'empile pas une seconde ligne", async () => {
    await poserPreuve(personne.id, SESSION_A);
    await vieillirDe(personne.id, SESSION_A, FENETRE_PREUVE_MINUTES + 1);
    await poserPreuve(personne.id, SESSION_A);
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_A }), true);

    const lignes = await db
      .select({ methode: preuvesAuthentification.methode })
      .from(preuvesAuthentification)
      .where(eq(preuvesAuthentification.utilisateurId, personne.id));
    assert.equal(lignes.length, 1, `${lignes.length} preuves pour une session : la table gonflerait`);
    /**
     * **Toujours « mot-de-passe », et ce n'est plus un paramètre.** Cette
     * assertion exigeait « cle-appareil » du temps où l'appelant choisissait le
     * moyen. Depuis `0066_preuve_par_le_moteur.sql`, la fonction en base l'écrit
     * elle-même — aucun appelant ne peut faire croire qu'une clé a signé alors
     * qu'aucun chemin WebAuthn n'existe.
     */
    assert.equal(lignes[0].methode, "mot-de-passe");
  });

  // ─── LA GARDE ELLE-MÊME ───────────────────────────────────────────────────

  console.log("");

  await essai("la garde LÈVE quand il n'y a pas de preuve — jamais un silence", async () => {
    let leve: unknown = null;
    try {
      await exigerPreuveRecente({ utilisateurId: personne.id, sessionId: SESSION_B }, GESTES_SENSIBLES.exportComplet);
    } catch (e) {
      leve = e;
    }
    assert.ok(leve instanceof PreuveRecenteExigeeError, "la garde n'a pas levé");
    assert.match(
      (leve as Error).message,
      /toute votre entreprise/i,
      "le message ne dit pas POURQUOI on redemande — le geste paraîtrait arbitraire"
    );
  });

  await essai("…et laisse passer quand la preuve est là", async () => {
    await poserPreuve(personne.id, SESSION_B);
    await exigerPreuveRecente({ utilisateurId: personne.id, sessionId: SESSION_B }, GESTES_SENSIBLES.exportComplet);
  });

  // ─── CE QUI EFFACE LES PREUVES ────────────────────────────────────────────

  console.log("");

  await essai("un changement de contexte de sécurité efface TOUTES ses preuves", async () => {
    await poserPreuve(personne.id, SESSION_A);
    await poserPreuve(personne.id, SESSION_B);
    await effacerPreuves(personne.id);
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_A }), false);
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_B }), false);
  });

  await essai("…et n'efface que les siennes", async () => {
    await poserPreuve(personne.id, SESSION_A);
    await poserPreuve(voisin.id, SESSION_A);
    await effacerPreuves(personne.id);
    assert.equal(
      await preuveRecenteExiste({ utilisateurId: voisin.id, sessionId: SESSION_A }),
      true,
      "la preuve du voisin est tombée avec celle de l'autre"
    );
  });

  await essai("la purge retire les périmées, et garde les vivantes", async () => {
    // Rien ne dépend de cette purge pour la sécurité — `preuveRecenteExiste`
    // refuse déjà une ligne trop vieille. Elle empêche la table de grandir.
    await poserPreuve(personne.id, SESSION_A);
    await vieillirDe(personne.id, SESSION_A, FENETRE_PREUVE_MINUTES + 5);
    await poserPreuve(personne.id, SESSION_B);
    await purgerPreuvesPerimees();
    const restantes = await db
      .select({ sessionId: preuvesAuthentification.sessionId })
      .from(preuvesAuthentification)
      .where(eq(preuvesAuthentification.utilisateurId, personne.id));
    assert.deepEqual(
      restantes.map((l) => l.sessionId),
      [SESSION_B],
      "la purge a emporté une preuve encore valable, ou laissé une périmée"
    );
  });

  await proprio.end();
  // ─── CE QUE `atlas_app` PEUT FAIRE EN SQL DIRECT ──────────────────────────

  console.log("");

  await essai("UNE PREUVE NE PEUT PAS ÊTRE FORGÉE EN SQL — le moteur la refuse", async () => {
    /**
     * **Mesuré le 25 août 2026, et c'était possible.** La première migration
     * accordait `INSERT` et `UPDATE` à `atlas_app` : une injection SQL dans
     * n'importe quelle requête métier aurait posé une preuve pour qui elle
     * voulait — en prétendant même qu'une clé d'appareil avait signé.
     *
     * La propriété ne tenait alors qu'à l'absence d'injection. Elle tient
     * maintenant par le moteur.
     */
    const refuse = async (requete: string, parametres: unknown[] = []) => {
      try {
        await pool.query(requete, parametres);
        return false;
      } catch (e) {
        return (e as { code?: string })?.code === "42501";
      }
    };
    const passees: string[] = [];
    const tentatives: [string, unknown[]][] = [
      [`INSERT INTO preuves_authentification (utilisateur_id, session_id, methode) VALUES ($1, 'forgee', 'mot-de-passe')`, [personne.id]],
      [`INSERT INTO preuves_authentification (utilisateur_id, session_id, methode) VALUES ($1, 'forgee', 'cle-appareil')`, [personne.id]],
      [`UPDATE preuves_authentification SET prouve_le = now()`, []],
      [`UPDATE preuves_authentification SET session_id = 'volee' WHERE utilisateur_id = $1`, [personne.id]],
    ];
    for (const [requete, parametres] of tentatives) {
      if (!(await refuse(requete, parametres))) passees.push(requete.slice(0, 60));
    }
    assert.deepEqual(passees, [], `Ces écritures ont abouti : ${passees.join(" | ")}`);
  });

  await essai("un MAUVAIS mot de passe ne pose aucune preuve", async () => {
    await effacerPreuves(personne.id);
    const ok = await poserPreuveParMotDePasse(personne.id, SESSION_A, "ce-n-est-pas-le-bon");
    assert.equal(ok, false, "un mot de passe faux a été accepté");
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_A }), false);
  });

  await essai("une session VIDE ne peut pas porter de preuve", async () => {
    // Sans identité, une preuve appartiendrait à tout le monde.
    let leve = false;
    try {
      await poserPreuveParMotDePasse(personne.id, "", MOT_DE_PASSE);
    } catch {
      leve = true;
    }
    assert.ok(leve, "une session vide a été acceptée comme identité");
  });

  await essai("la méthode inscrite est TOUJOURS le mot de passe — pas de journal menteur", async () => {
    /**
     * Aucun chemin WebAuthn n'existe encore. Si un appelant pouvait écrire
     * `methode = 'cle-appareil'`, le journal affirmerait une vérification qui
     * n'a jamais eu lieu — un journal qui ment est pire qu'un journal absent.
     */
    await poserPreuve(personne.id, SESSION_A);
    const [ligne] = await db
      .select({ methode: preuvesAuthentification.methode })
      .from(preuvesAuthentification)
      .where(eq(preuvesAuthentification.utilisateurId, personne.id));
    assert.equal(ligne.methode, "mot-de-passe");
  });

  await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`%-${marque}@test.local`]);
  await pool.end();

  console.log("");
  console.log(`Preuve récente — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
