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
import { pool, db } from "../src/server/db/client";
import { users, preuvesAuthentification } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import {
  poserPreuve,
  preuveRecenteExiste,
  exigerPreuveRecente,
  effacerPreuves,
  purgerPreuvesPerimees,
  PreuveRecenteExigeeError,
} from "../src/server/preuve-recente";
import { FENETRE_PREUVE_MINUTES, GESTES_SENSIBLES } from "../src/lib/preuve-recente";

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

/** Vieillir une preuve sans attendre : on recule sa date en base. */
async function vieillirDe(utilisateurId: string, sessionId: string, minutes: number) {
  await pool.query(
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

  // ─── LE CŒUR : l'isolation entre deux sessions du MÊME utilisateur ────────

  await essai("SANS PREUVE, un geste sensible est refusé", async () => {
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_A }), false);
  });

  await essai("après une preuve, la MÊME session passe", async () => {
    await poserPreuve(personne.id, SESSION_A, "mot-de-passe");
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
    await poserPreuve(personne.id, SESSION_A, "mot-de-passe");
    await vieillirDe(personne.id, SESSION_A, FENETRE_PREUVE_MINUTES - 1);
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_A }), true);
  });

  await essai("UNE PREUVE PÉRIMÉE NE VAUT PLUS RIEN", async () => {
    await poserPreuve(personne.id, SESSION_A, "mot-de-passe");
    await vieillirDe(personne.id, SESSION_A, FENETRE_PREUVE_MINUTES + 1);
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_A }), false);
  });

  await essai("se reprouver RAFRAÎCHIT — et n'empile pas une seconde ligne", async () => {
    await poserPreuve(personne.id, SESSION_A, "mot-de-passe");
    await vieillirDe(personne.id, SESSION_A, FENETRE_PREUVE_MINUTES + 1);
    await poserPreuve(personne.id, SESSION_A, "cle-appareil");
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_A }), true);

    const lignes = await db
      .select({ methode: preuvesAuthentification.methode })
      .from(preuvesAuthentification)
      .where(eq(preuvesAuthentification.utilisateurId, personne.id));
    assert.equal(lignes.length, 1, `${lignes.length} preuves pour une session : la table gonflerait`);
    assert.equal(lignes[0].methode, "cle-appareil", "le moyen employé n'a pas été retenu");
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
    await poserPreuve(personne.id, SESSION_B, "mot-de-passe");
    await exigerPreuveRecente({ utilisateurId: personne.id, sessionId: SESSION_B }, GESTES_SENSIBLES.exportComplet);
  });

  // ─── CE QUI EFFACE LES PREUVES ────────────────────────────────────────────

  console.log("");

  await essai("un changement de contexte de sécurité efface TOUTES ses preuves", async () => {
    await poserPreuve(personne.id, SESSION_A, "mot-de-passe");
    await poserPreuve(personne.id, SESSION_B, "mot-de-passe");
    await effacerPreuves(personne.id);
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_A }), false);
    assert.equal(await preuveRecenteExiste({ utilisateurId: personne.id, sessionId: SESSION_B }), false);
  });

  await essai("…et n'efface que les siennes", async () => {
    await poserPreuve(personne.id, SESSION_A, "mot-de-passe");
    await poserPreuve(voisin.id, SESSION_A, "mot-de-passe");
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
    await poserPreuve(personne.id, SESSION_A, "mot-de-passe");
    await vieillirDe(personne.id, SESSION_A, FENETRE_PREUVE_MINUTES + 5);
    await poserPreuve(personne.id, SESSION_B, "mot-de-passe");
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
