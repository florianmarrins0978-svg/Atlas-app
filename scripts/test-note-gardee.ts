/* =======================================================================
   Une note dictée sans réseau n'est plus perdue : elle est GARDÉE.

   **Sa planche du 5 novembre 2026, réponse B le 6** (« je pense qu'il faut
   appuyer pour que la note parte ») : `appli/soignee/note-sans-reseau.html`.
   Jusque-là, un envoi raté rendait une phrase, « puis refaites la note », et
   le son partait avec la variable qui le portait. Sur une fiche NEUVE, pire :
   la création du chantier échouait d'abord, et rien n'était dit du tout.

   Ce contrôle tient ce qui DÉCIDE, sans navigateur ni base :
     1. l'envoi raté dit POURQUOI il a raté, assez pour savoir s'il faut
        garder la note : rien d'arrivé (le réseau), ou un contenu refusé ;
     2. ce qui se garde, et ce qui ne se garde pas ;
     3. le disque : « Gardée » tant que le serveur est injoignable,
        « Envoyer » dès qu'il répond. C'est SON appui qui envoie (la B) ;
     4. la phrase sous le disque, celle de la planche.
   ======================================================================= */
import assert from "node:assert/strict";
import { envoyerNoteVocale } from "../src/lib/envoi-note-vocale";
import { causeDeLaGarde, etatDuDisque, nouvelIdentifiantDEnvoi, phraseDeLaNoteGardee } from "../src/lib/note-gardee";
import { phraseDeLiaison } from "../src/lib/diagnostic-liaison";

let passes = 0;
let echecs = 0;
async function cas(nom: string, verifier: () => void | Promise<void>) {
  try {
    await verifier();
    passes++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const json = (corps: unknown, status: number) =>
  new Response(JSON.stringify(corps), { status, headers: { "content-type": "application/json" } });

async function main() {
  console.log("\n=== Une note sans réseau est gardée ===\n");

  // ─── 1. L'envoi raté dit pourquoi ────────────────────────────────────────
  // Le serveur injoignable : `fetch` lève. Le diagnostic interroge
  // `/api/health/live` par une adresse relative, qui lève aussi hors d'un
  // navigateur : la conclusion est « hors-ligne », sans aucun réseau.
  await cas("rien n'est arrivé : l'échec le dit, et nomme la liaison", async () => {
    const r = await envoyerNoteVocale("c1", new FormData(), async () => {
      throw new TypeError("Failed to fetch");
    });
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.liaison === "hors-ligne", `l'échec ne dit pas que rien n'est arrivé : ${JSON.stringify(r)}`);
  });

  await cas("une réponse qui n'est pas celle de la route se garde aussi", async () => {
    const r = await envoyerNoteVocale("c1", new FormData(), async () => new Response("<html>connexion</html>", { status: 200 }));
    assert.ok(!r.ok && r.sessionPerimee !== true, "une page HTML en 200 n'est pas une session expirée");
    assert.equal(causeDeLaGarde(r), "serveur", "une réponse illisible ne jette pas la note");
  });

  await cas("un contenu refusé par le serveur ne se garde pas : le renvoyer ne servirait à rien", async () => {
    const r = await envoyerNoteVocale("c1", new FormData(), async () =>
      json({ ok: false, raison: "Ce format de son n'est pas lu.", nonRecevable: true }, 409)
    );
    assert.ok(!r.ok && r.nonRecevable === true, "le refus du contenu doit traverser jusqu'à l'écran");
    assert.equal(causeDeLaGarde(r), null);
  });

  await cas("une session expirée garde la note : elle repart après la reconnexion", async () => {
    const r = await envoyerNoteVocale("c1", new FormData(), async () =>
      json({ ok: false, raison: "Votre session a expiré (étape : session). Rechargez la page." }, 401)
    );
    assert.equal(causeDeLaGarde(r), "session");
  });

  await cas("une panne du serveur garde la note : elle repartira", async () => {
    const r = await envoyerNoteVocale("c1", new FormData(), async () =>
      json({ ok: false, raison: "Le serveur n'a pas pu écrire le son (étape : stockage)." }, 409)
    );
    assert.equal(causeDeLaGarde(r), "serveur");
  });

  await cas("un envoi réussi ne garde rien", async () => {
    const r = await envoyerNoteVocale("c1", new FormData(), async () =>
      json({ ok: true, storageKey: "k", dureeSecondes: 12 }, 200)
    );
    assert.equal(r.ok, true);
    assert.equal(causeDeLaGarde(r), null);
  });

  // ─── 2. Le disque : Gardée, puis Envoyer ─────────────────────────────────
  await cas("sans réseau, le disque dit Gardée ; le serveur revenu, il dit Envoyer", () => {
    assert.equal(etatDuDisque("hors-ligne", false), "gardee");
    assert.equal(etatDuDisque("hors-ligne", null), "gardee", "ne pas savoir n'est pas « revenu »");
    assert.equal(etatDuDisque("hors-ligne", true), "a-envoyer");
  });

  await cas("quand le réseau n'est pas en cause, Envoyer est offert tout de suite", () => {
    for (const cause of ["serveur", "session", "page-vieillie", "serveur-en-peine"] as const) {
      assert.equal(etatDuDisque(cause, null), "a-envoyer", cause);
    }
  });

  // ─── 3. La phrase sous le disque ─────────────────────────────────────────
  await cas("la phrase de la planche, mot pour mot", () => {
    assert.equal(phraseDeLaNoteGardee({ cause: "hors-ligne", joignable: false, ficheNeuve: false }), "Envoyez-la quand le réseau revient.");
    assert.equal(phraseDeLaNoteGardee({ cause: "hors-ligne", joignable: true, ficheNeuve: false }), "Le réseau est revenu.");
  });

  await cas("sur une fiche neuve, elle dit de rester sur la page : rien ne la retrouve ailleurs", () => {
    const p = phraseDeLaNoteGardee({ cause: "hors-ligne", joignable: false, ficheNeuve: true });
    assert.match(p, /revient/);
    assert.match(p, /page/);
  });

  await cas("une fiche neuve que le serveur n'a pas créée ne dit jamais de recharger", () => {
    for (const cause of ["page-vieillie", "serveur-en-peine", "serveur", "session"] as const) {
      const p = phraseDeLaNoteGardee({ cause, joignable: null, ficheNeuve: true, raison: "Rechargez la page." });
      assert.ok(!/recharg/i.test(p), `${cause} : « ${p} »`);
      assert.match(p, /page/);
    }
  });

  await cas("l'identifiant d'un envoi a la forme que le serveur lit, et change à chaque note", () => {
    const forme = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const a = nouvelIdentifiantDEnvoi();
    const b = nouvelIdentifiantDEnvoi();
    assert.match(a, forme);
    assert.notEqual(a, b);
    // Un tirage fixé rend un identifiant fixé : la forme ne dépend que de lui.
    assert.equal(nouvelIdentifiantDEnvoi(() => new Uint8Array(16)), "00000000-0000-4000-8000-000000000000");
  });

  await cas("la raison du serveur se lit telle quelle quand c'est lui", () => {
    const p = phraseDeLaNoteGardee({ cause: "serveur", joignable: null, ficheNeuve: false, raison: "Le disque du serveur est plein." });
    assert.match(p, /plein/);
  });

  await cas("un stockage refusé par le téléphone se DIT, il ne se tait pas", () => {
    const p = phraseDeLaNoteGardee({ cause: "hors-ligne", joignable: false, ficheNeuve: false, stockageRefuse: true });
    assert.match(p, /page/, `le refus du téléphone n'est pas dit : ${p}`);
  });

  await cas("plus aucune phrase ne dit de refaire la note : elle est gardée", () => {
    for (const etat of ["hors-ligne", "page-vieillie", "serveur-en-peine"] as const) {
      assert.ok(!/refaites/i.test(phraseDeLiaison(etat)), `« ${phraseDeLiaison(etat)} »`);
    }
  });

  await cas("aucune phrase ne porte de tiret ni de point médian", () => {
    const phrases = [
      ...(["hors-ligne", "page-vieillie", "serveur-en-peine"] as const).map(phraseDeLiaison),
      ...(["hors-ligne", "serveur", "session", "page-vieillie", "serveur-en-peine"] as const).flatMap((cause) =>
        [true, false].flatMap((ficheNeuve) =>
          [true, false, null].map((joignable) => phraseDeLaNoteGardee({ cause, joignable, ficheNeuve, raison: "Raison." }))
        )
      ),
    ];
    for (const p of phrases) assert.ok(!/[—–·]/.test(p), `« ${p} »`);
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${passes} cas réussi(s), ${echecs} échoué(s).`);
  if (echecs) process.exit(1);
}

main();
