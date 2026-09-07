import assert from "node:assert/strict";
import { attendreLeDevis } from "../src/lib/attente-devis";

// **Attendre un devis sans dépendre d'un aller-retour tenu ouvert.**
//
// Le patron, le 12 août 2026 : *« entre le moment où je clique mon devis et le
// moment où le devis apparaît, la première fois il s'est passé plus de six
// minutes et j'ai dû recharger la page pour que le devis arrive. »*
//
// Le serveur avait fini depuis longtemps : chaque appel à un modèle est borné à
// trente secondes, la chaîne entière ne peut pas durer six minutes. Ce qui a
// duré six minutes, c'est **son attente** — la réponse ne revenait pas, et
// l'écran n'avait aucun moyen de savoir que le devis existait déjà.
//
// Trois propriétés se tiennent ici, et chacune répare un morceau de ce vécu :
//
//   1. **on repose la question** — un aller-retour perdu ne se rattrape pas, une
//      question posée en boucle, si ;
//   2. **une panne passagère ne fait pas abandonner** — le réseau d'un artisan
//      sur un chantier n'est pas celui d'un bureau ;
//   3. **l'attente sait renoncer** — une attente sans fin est précisément le
//      défaut qu'on répare, pas celui qu'on déplace.
//
// Fonction pure, éprouvée sans serveur ni navigateur (`CLAUDE.md` §3) : le temps
// et le réseau sont injectés, donc la suite est instantanée et ne dépend de rien.

let passed = 0;
let failed = 0;

async function test(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    passed++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const reponse = (corps: unknown, ok = true) =>
  ({ ok, json: async () => corps }) as Response;

/** Le temps ne passe pas vraiment : la suite doit rester instantanée. */
const sansAttendre = async () => {};

async function main() {
  console.log("=== L'attente du devis : elle insiste, et elle renonce ===\n");

  await test("dès que le devis est prêt, elle s'arrête et le dit", async () => {
    let appels = 0;
    const issue = await attendreLeDevis("c1", {
      patienter: sansAttendre,
      interroger: async () => {
        appels++;
        return reponse({ pret: true });
      },
    });
    assert.equal(issue.type, "pret");
    assert.equal(appels, 1, "elle ne doit pas continuer à interroger après un « prêt »");
  });

  await test("elle interroge la bonne adresse, avec le chantier", async () => {
    let vue = "";
    await attendreLeDevis("abc-123", {
      patienter: sansAttendre,
      interroger: async (url) => {
        vue = url;
        return reponse({ pret: true });
      },
    });
    assert.equal(vue, "/api/chantiers/abc-123/devis-pret");
  });

  await test("elle attend le temps qu'il faut, puis y va", async () => {
    let appels = 0;
    const issue = await attendreLeDevis("c1", {
      patienter: sansAttendre,
      interroger: async () => {
        appels++;
        return reponse({ pret: appels >= 12 });
      },
    });
    assert.equal(issue.type, "pret");
    assert.equal(appels, 12);
  });

  await test("une panne passagère du réseau ne la fait pas renoncer", async () => {
    // Le réseau d'un artisan sur un chantier tombe et revient. Abandonner au
    // premier échec, ce serait le renvoyer recharger sa page — ce qu'on répare.
    let appels = 0;
    const issue = await attendreLeDevis("c1", {
      patienter: sansAttendre,
      interroger: async () => {
        appels++;
        if (appels < 5) throw new Error("Failed to fetch");
        return reponse({ pret: true });
      },
    });
    assert.equal(issue.type, "pret");
  });

  await test("une réponse qui n'est pas du JSON ne passe pas pour un « prêt »", async () => {
    // Derrière un mandataire, une session expirée rend une page HTML — parfois
    // avec un code 200. La lire comme un succès emmènerait le patron sur un
    // devis qui n'existe pas.
    const issue = await attendreLeDevis("c1", {
      limiteMs: 12_000,
      intervalleMs: 4_000,
      patienter: sansAttendre,
      interroger: async () =>
        ({
          ok: true,
          json: async () => {
            throw new Error("Unexpected token < in JSON");
          },
        }) as unknown as Response,
    });
    assert.equal(issue.type, "abandon");
  });

  await test("un « pas prêt » répondu poliment n'est pas un « prêt »", async () => {
    const issue = await attendreLeDevis("c1", {
      limiteMs: 8_000,
      intervalleMs: 4_000,
      patienter: sansAttendre,
      interroger: async () => reponse({ pret: false }),
    });
    assert.equal(issue.type, "abandon");
  });

  await test("ELLE SAIT RENONCER — une attente sans fin est le défaut réparé", async () => {
    let appels = 0;
    const issue = await attendreLeDevis("c1", {
      limiteMs: 20_000,
      intervalleMs: 4_000,
      patienter: sansAttendre,
      interroger: async () => {
        appels++;
        return reponse({ pret: false });
      },
    });
    assert.equal(issue.type, "abandon");
    assert.equal(appels, 5, "vingt secondes par pas de quatre : cinq questions, pas une de plus");
  });

  await test(
    "L'ARRÊT D'AVANT-CHIFFRAGE LA FAIT ABOUTIR — sa capture du 1ᵉʳ septembre 2026",
    async () => {
      /**
       * *« Atlas prépare toujours votre devis… (96 s) »*, et rien ne vient.
       *
       * Ce compteur ne s'atteint que par CE rattrapage : une réponse d'action
       * serveur perdue. La chaîne, elle, avait fini — elle l'attendait à
       * l'arrêt d'avant-chiffrage, sans avoir écrit le moindre devis, ce
       * qu'elle fait dans cinq de ses six issues.
       *
       * L'attente ne reconnaissait qu'un devis écrit : elle ne pouvait donc
       * JAMAIS aboutir dans ce cas — cinq minutes de compteur devant un
       * serveur au repos. **Contre l'ancienne version, ce contrôle rougit :**
       * elle rendait « abandon » après la limite au lieu de rapporter l'arrêt.
       */
      const questions = [
        {
          id: "technique#1",
          libellePrestation: "Abattage d'un chêne mort",
          question: "Au pied, en démontage, ou en démontage avec rétention ?",
          options: [{ valeur: "retention", libelle: "Démontage avec rétention" }],
          unite: null,
        },
      ];
      let appels = 0;
      const issue = await attendreLeDevis("c1", {
        patienter: sansAttendre,
        interroger: async () => {
          appels++;
          return reponse({ pret: false, questions });
        },
      });
      assert.equal(issue.type, "questions", "elle doit rapporter l'arrêt, pas renoncer");
      assert.deepEqual(issue.type === "questions" ? issue.questions : null, questions);
      assert.equal(appels, 1, "il n'y a plus rien à attendre : elle s'arrête");
    }
  );

  await test("un devis écrit prime sur des questions restées sans réponse", async () => {
    // Ce qu'il a laissé de côté ressort SIGNALÉ sur le devis
    // (`chiffrerEtPreparer`, `aSignaler`). Le renvoyer à l'arrêt lui ferait
    // refaire un chemin déjà franchi, devant un devis qui l'attend.
    const issue = await attendreLeDevis("c1", {
      patienter: sansAttendre,
      interroger: async () =>
        reponse({ pret: true, questions: [{ id: "x", libellePrestation: "", question: "", options: null, unite: null }] }),
    });
    assert.equal(issue.type, "pret");
  });

  await test("une liste de questions VIDE ne l'arrête pas", async () => {
    // La chaîne n'a pas encore écrit ses prestations : il n'y a rien à
    // demander, et rien à montrer. Elle continue d'attendre.
    const issue = await attendreLeDevis("c1", {
      limiteMs: 8_000,
      intervalleMs: 4_000,
      patienter: sansAttendre,
      interroger: async () => reponse({ pret: false, questions: [] }),
    });
    assert.equal(issue.type, "abandon");
  });

  await test("elle rend compte du temps écoulé, pour que l'écran ne paraisse pas figé", async () => {
    const vus: number[] = [];
    await attendreLeDevis("c1", {
      limiteMs: 12_000,
      intervalleMs: 4_000,
      patienter: sansAttendre,
      interroger: async () => reponse({ pret: false }),
      surAttente: (s) => vus.push(s),
    });
    assert.deepEqual(vus, [4, 8, 12]);
  });

  console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} test(s) réussi(s), ${failed} échoué(s).`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
