import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  bornesDuChantier,
  etatAgendaApple,
  intituleChantier,
} from "../src/server/repositories/agenda-apple";
import { chiffrer, dechiffrer } from "../src/server/agenda/secret-au-repos";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **L'agenda iCloud, éprouvé SOUS LE RÔLE APPLICATIF.**
//
// Le raccordement lui-même ne peut pas être joué ici : le mandataire réseau de
// cet environnement refuse `caldav.icloud.com`. Ce qui l'entoure, en revanche,
// se vérifie — et c'est là que sont les deux risques qui comptent :
//
//   1. **l'isolation.** Un agenda relié appartient à UNE entreprise. Si la
//      lecture traversait, Atlas barrerait les journées d'un artisan à cause
//      des rendez-vous d'un autre ;
//   2. **le mot de passe au repos.** Celui d'Apple ouvre TOUT l'iCloud — mail,
//      contacts, fichiers —, pas seulement l'agenda. Le trouver en clair dans
//      une sauvegarde n'est pas la même fuite qu'un nom de client.
//
// `CLAUDE.md` §5 : les suites navigateur tournent sous un rôle qui traverse la
// RLS, donc elles ne peuvent pas voir le point 1. Cette suite-ci le peut.

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Élagage ${suffixe}` },
    { email: `apple-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/**
 * Pose une ligne iCloud directement, sans passer par Apple.
 *
 * `relierAgendaApple` appelle le réseau AVANT d'écrire — c'est ce qui fait
 * qu'un mot de passe mal recopié est refusé tout de suite. Impossible à jouer
 * ici, donc : on écrit la ligne comme il l'écrirait, chiffrement compris, pour
 * éprouver tout ce qui vient APRÈS.
 */
async function poserLigneApple(ctx: Ctx, motDePasse: string, compte: string) {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.entreprise_id', $1, false)", [ctx.entrepriseId]);
    await client.query(
      `INSERT INTO agendas_externes (entreprise_id, fournisseur, compte, mot_de_passe, agendas_lus, actif)
       VALUES ($1, 'apple', $2, $3, $4::jsonb, true)`,
      [ctx.entrepriseId, compte, chiffrer(motDePasse), JSON.stringify(["/42/calendars/perso/"])]
    );
  } finally {
    client.release();
  }
}

/** Les octets réellement stockés, lus au plus près de la base. */
async function octetsStockes(ctx: Ctx): Promise<{ motDePasse: string | null }> {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.entreprise_id', $1, false)", [ctx.entrepriseId]);
    const { rows } = await client.query(
      "SELECT mot_de_passe FROM agendas_externes WHERE entreprise_id = $1 AND fournisseur = 'apple'",
      [ctx.entrepriseId]
    );
    return { motDePasse: rows[0]?.mot_de_passe ?? null };
  } finally {
    client.release();
  }
}

async function main() {
  await nettoyerBase();
  console.log("=== L'agenda iCloud : isolation, secret au repos, bornes ===\n");

  const alice = await contexte("alice");
  const bob = await contexte("bob");

  // ─── Ce qui décide, et qui ne parle à personne ───────────────────────────

  await test("une demi-journée du matin va de 8 h à 13 h, heure de Paris", async () => {
    const b = bornesDuChantier("2026-08-12", "matin", 1);
    assert.ok(b);
    // 8 h à Paris en été = 06:00Z. Les bornes viennent de `agenda-externe.ts`,
    // jamais réécrites : sinon Atlas poserait un chantier de 9 h à midi tout en
    // considérant que la matinée va de 8 h à 13 h — deux vérités pour une même
    // journée, et la divergence se découvrirait sur un doublon.
    assert.equal(b.debut.toISOString(), "2026-08-12T06:00:00.000Z");
    assert.equal(b.fin.toISOString(), "2026-08-12T11:00:00.000Z");
  });

  await test("une demi-journée d'après-midi va de 13 h à 18 h", async () => {
    const b = bornesDuChantier("2026-08-12", "apres_midi", 1);
    assert.equal(b?.debut.toISOString(), "2026-08-12T11:00:00.000Z");
    assert.equal(b?.fin.toISOString(), "2026-08-12T16:00:00.000Z");
  });

  await test("un chantier de deux demi-journées couvre la journée entière", async () => {
    const b = bornesDuChantier("2026-08-12", "matin", 2);
    assert.equal(b?.debut.toISOString(), "2026-08-12T06:00:00.000Z");
    assert.equal(b?.fin.toISOString(), "2026-08-12T16:00:00.000Z");
  });

  await test("un chantier qui déborde saute le week-end, comme le planning", async () => {
    // Vendredi 14 août après-midi + lundi 17 matin. La suite des créneaux vient
    // de `creneauxDuChantier` : si l'écriture recalculait les jours ouvrés de
    // son côté, elle poserait un chantier un samedi que le planning ignore.
    const b = bornesDuChantier("2026-08-14", "apres_midi", 2);
    assert.equal(b?.debut.toISOString(), "2026-08-14T11:00:00.000Z");
    assert.equal(b?.fin.toISOString(), "2026-08-17T11:00:00.000Z");
  });

  await test("l'hiver décale d'une heure — un décalage figé se tromperait", async () => {
    const b = bornesDuChantier("2026-01-12", "matin", 1);
    assert.equal(b?.debut.toISOString(), "2026-01-12T07:00:00.000Z");
  });

  await test("l'intitulé porte le client quand il existe, et rien d'inventé sinon", async () => {
    assert.equal(
      intituleChantier({ nom: "Taille de haie", clientNom: "M. Bernard" }),
      "Taille de haie — M. Bernard"
    );
    assert.equal(intituleChantier({ nom: "Taille de haie", clientNom: null }), "Taille de haie");
  });

  // ─── L'état, avant tout raccordement ────────────────────────────────────

  await test("sans rien relié, l'écran ne promet rien", async () => {
    const etat = await etatAgendaApple(alice);
    assert.equal(etat.relie, false);
    assert.equal(etat.ecritureActive, false, "l'écriture ne s'allume JAMAIS d'elle-même");
    assert.equal(etat.calendrierEcriture, null);
  });

  // ─── Le secret au repos ─────────────────────────────────────────────────

  await poserLigneApple(alice, "abcd-efgh-ijkl-mnop", "alice@icloud.com");

  await test("le mot de passe n'est PAS en clair dans la base", async () => {
    const brut = await octetsStockes(alice);
    assert.ok(brut.motDePasse, "aucune ligne écrite");
    assert.equal(
      brut.motDePasse.includes("abcd-efgh-ijkl-mnop"),
      false,
      "le mot de passe pour les apps est lisible tel quel dans la colonne"
    );
    // Et il se relit : un chiffrement qu'on ne sait pas défaire n'est pas un
    // chiffrement, c'est une perte.
    assert.equal(dechiffrer(brut.motDePasse), "abcd-efgh-ijkl-mnop");
  });

  await test("l'écran montre le compte relié, jamais le mot de passe", async () => {
    const etat = await etatAgendaApple(alice);
    assert.equal(etat.relie, true);
    assert.equal(etat.compte, "alice@icloud.com");
    assert.equal(
      JSON.stringify(etat).includes("abcd-efgh"),
      false,
      "le mot de passe traverse jusqu'à l'écran"
    );
  });

  // ─── L'isolation ────────────────────────────────────────────────────────

  await test("l'agenda d'Alice n'existe pas pour Bob", async () => {
    const etat = await etatAgendaApple(bob);
    assert.equal(etat.relie, false, "Bob voit le raccordement d'Alice");
    assert.equal(etat.compte, null);
  });

  await test("Bob peut relier le sien sans toucher à celui d'Alice", async () => {
    await poserLigneApple(bob, "zzzz-yyyy-xxxx-wwww", "bob@icloud.com");
    assert.equal((await etatAgendaApple(bob)).compte, "bob@icloud.com");
    assert.equal((await etatAgendaApple(alice)).compte, "alice@icloud.com");
  });

  await test("les deux fournisseurs cohabitent sur la même entreprise", async () => {
    // La contrainte d'unicité porte sur (entreprise, fournisseur) : un artisan
    // peut relier Google ET iCloud — le premier pour son agenda professionnel,
    // le second pour sa vie. Les deux se lisent, et se fondent en une seule
    // carte d'occupation.
    const client = await pool.connect();
    try {
      await client.query("SELECT set_config('app.entreprise_id', $1, false)", [alice.entrepriseId]);
      await client.query(
        `INSERT INTO agendas_externes (entreprise_id, fournisseur, compte, actif)
         VALUES ($1, 'google', 'alice@gmail.com', true)`,
        [alice.entrepriseId]
      );
      const { rows } = await client.query(
        "SELECT fournisseur FROM agendas_externes WHERE entreprise_id = $1 ORDER BY fournisseur",
        [alice.entrepriseId]
      );
      assert.deepEqual(
        rows.map((r) => r.fournisseur),
        ["apple", "google"]
      );
    } finally {
      client.release();
    }
  });

  await test("un fournisseur inconnu est refusé par la base, pas seulement par le code", async () => {
    const client = await pool.connect();
    try {
      await client.query("SELECT set_config('app.entreprise_id', $1, false)", [bob.entrepriseId]);
      await assert.rejects(
        client.query(
          `INSERT INTO agendas_externes (entreprise_id, fournisseur, actif) VALUES ($1, 'outlook', true)`,
          [bob.entrepriseId]
        ),
        /agendas_externes_fournisseur_connu|violates check constraint/,
        "la contrainte élargie en 0035 accepte n'importe quoi"
      );
    } finally {
      client.release();
    }
  });

  console.log(
    failed === 0
      ? `\n✅ Agenda iCloud — 0 échec(s).\n`
      : `\n❌ Agenda iCloud — ${failed} échec(s) sur ${passed + failed}.\n`
  );

  await fermerLimiteur();
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await fermerLimiteur();
  await pool.end();
  process.exit(1);
});
