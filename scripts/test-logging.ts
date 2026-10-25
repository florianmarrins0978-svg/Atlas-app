import assert from "node:assert";
import { redigerPourJournal } from "../src/server/logger";
import { empreinteCourriel } from "../src/lib/empreinte-courriel";
import { idRequeteValideOuGenere, executerAvecContexte, getContexteRequete, enrichirContexteRequete } from "../src/server/request-context";

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => void | Promise<void>) {
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

async function main() {
  await test("Rédaction : les clés sensibles sont systématiquement masquées", () => {
    const redige = redigerPourJournal({
      email: "demo@atlas.local",
      password: "secret123",
      donnees: { motDePasse: "encore-un-secret", tarifId: "abc" },
      DATABASE_URL: "postgresql://user:pass@host/db",
    }) as Record<string, unknown>;
    assert.equal(redige.password, "[rédigé]");
    assert.equal((redige.donnees as Record<string, unknown>).motDePasse, "[rédigé]");
    assert.equal(redige.DATABASE_URL, "[rédigé]");
    assert.equal((redige.donnees as Record<string, unknown>).tarifId, "abc");
  });

  // **L'adresse ne part plus en clair, elle part en EMPREINTE** (sa décision du
  // 25 octobre 2026). Le journal est copié chez l'hébergeur, chez Sentry, dans
  // les sauvegardes : une fuite y livrait la liste des comptes et l'heure de
  // leurs échecs. L'empreinte garde ce qui servait, retrouver les tentatives
  // d'une personne, en calculant celle de son adresse (`npm run empreinte`).
  await test("Courriel : l'adresse ne s'écrit jamais en clair, mais en empreinte", () => {
    process.env.AUTH_SECRET = "secret-d-essai-du-journal-0000000000000000";
    const redige = redigerPourJournal({ email: "Jean.Dupont@Exemple.fr", donnees: { emailPro: "pro@exemple.fr" } }) as Record<string, unknown>;
    const texte = JSON.stringify(redige);
    assert.ok(!texte.includes("Dupont") && !texte.includes("exemple"), `une adresse est partie en clair : ${texte}`);
    assert.equal(redige.email, empreinteCourriel("Jean.Dupont@Exemple.fr", process.env.AUTH_SECRET));
    assert.match(String(redige.email), /^courriel:[0-9a-f]{16}$/);
  });

  await test("Courriel : la même adresse tapée autrement donne la même empreinte, une autre adresse non", () => {
    const s = "secret-d-essai-du-journal-0000000000000000";
    assert.equal(empreinteCourriel(" jean.dupont@exemple.fr ", s), empreinteCourriel("JEAN.DUPONT@EXEMPLE.FR", s));
    assert.notEqual(empreinteCourriel("jean.dupont@exemple.fr", s), empreinteCourriel("jean.dupont@gmial.com", s));
    // Sans la clé, on ne la recalcule pas : une autre clé donne autre chose.
    assert.notEqual(empreinteCourriel("jean.dupont@exemple.fr", s), empreinteCourriel("jean.dupont@exemple.fr", "une-autre-cle"));
  });

  await test("Courriel : un champ qui n'est pas une adresse n'est pas touché", () => {
    const redige = redigerPourJournal({ emailEnvoye: true, nbEmails: 3 }) as Record<string, unknown>;
    assert.equal(redige.emailEnvoye, true);
    assert.equal(redige.nbEmails, 3);
  });

  await test("Rédaction : une Error conserve message/pile/cause sans jamais lever", () => {
    const cause = new Error("cause profonde");
    const erreur = new Error("échec", { cause });
    const redige = redigerPourJournal(erreur) as Record<string, unknown>;
    assert.equal(redige.message, "échec");
    assert.ok(typeof redige.pile === "string");
    assert.ok(redige.cause);
  });

  await test("Rédaction : une structure profondément imbriquée ne lève jamais (protection anti-boucle)", () => {
    const profond: Record<string, unknown> = {};
    let courant = profond;
    for (let i = 0; i < 20; i++) {
      courant.suite = {};
      courant = courant.suite as Record<string, unknown>;
    }
    const redige = redigerPourJournal(profond);
    assert.ok(redige !== undefined);
  });

  await test("Identifiant de requête : un uuid valide entrant est conservé tel quel", () => {
    const valide = "123e4567-e89b-12d3-a456-426614174000";
    assert.equal(idRequeteValideOuGenere(valide), valide);
  });

  await test("Identifiant de requête : une entrée invalide ou surdimensionnée est remplacée, jamais réutilisée", () => {
    const genere1 = idRequeteValideOuGenere("pas-un-uuid");
    assert.notEqual(genere1, "pas-un-uuid");
    assert.match(genere1, /^[0-9a-f-]{36}$/i);

    const genereTropLong = idRequeteValideOuGenere("a".repeat(5000));
    assert.match(genereTropLong, /^[0-9a-f-]{36}$/i);

    const genereVide = idRequeteValideOuGenere(null);
    assert.match(genereVide, /^[0-9a-f-]{36}$/i);
  });

  await test("Contexte de requête : le même requestId est visible dans les opérations imbriquées", async () => {
    await executerAvecContexte({ requestId: "req-test-1" }, async () => {
      assert.equal(getContexteRequete()?.requestId, "req-test-1");
      await new Promise((r) => setTimeout(r, 5));
      assert.equal(getContexteRequete()?.requestId, "req-test-1", "Doit rester visible après un point d'attente asynchrone");

      async function operationImbriquee() {
        assert.equal(getContexteRequete()?.requestId, "req-test-1", "Doit se propager sans changement de signature");
      }
      await operationImbriquee();
    });
  });

  await test("Contexte de requête : deux requêtes concurrentes ne se mélangent jamais", async () => {
    const resultats: string[] = [];
    await Promise.all([
      executerAvecContexte({ requestId: "req-A" }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        resultats.push(getContexteRequete()!.requestId);
      }),
      executerAvecContexte({ requestId: "req-B" }, async () => {
        await new Promise((r) => setTimeout(r, 1));
        resultats.push(getContexteRequete()!.requestId);
      }),
    ]);
    assert.ok(resultats.includes("req-A") && resultats.includes("req-B"));
  });

  await test("Contexte de requête : enrichissement sans ouvrir un contexte imbriqué", async () => {
    await executerAvecContexte({ requestId: "req-enrichi" }, async () => {
      enrichirContexteRequete({ entrepriseId: "ent-1", utilisateurId: "user-1" });
      const ctx = getContexteRequete();
      assert.equal(ctx?.requestId, "req-enrichi");
      assert.equal(ctx?.entrepriseId, "ent-1");
      assert.equal(ctx?.utilisateurId, "user-1");
    });
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  if (failed > 0) process.exit(1);
}

main();
