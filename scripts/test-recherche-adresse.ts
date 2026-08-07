import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { chercherAdresses } from "../src/server/adresses/base-adresse-nationale";

// **L'appel à la Base Adresse Nationale, confronté à ce qu'un service extérieur
// fait réellement.**
//
// Le mandataire réseau de l'environnement de développement refuse
// `api-adresse.data.gouv.fr` : impossible d'y appeler le vrai service d'ici.
// Plutôt que de laisser ce chemin sans contrôle — ou pire, de prétendre l'avoir
// vérifié — on monte ICI un service qui se comporte comme lui, y compris dans
// ses mauvais jours. La vérification contre le VRAI service est déplacée vers
// une machine qui peut le joindre (`.github/workflows/adresses.yml`), comme le
// fait déjà `pages.yml` pour le site publié (`AGENTS.md`).
//
// Ce que cela tient, et qu'aucun contrôle ne voyait : **une panne du service ne
// doit jamais empêcher de créer un chantier.** Le patron travaille dehors, avec
// un réseau qui va et vient. Si l'aide à la saisie emportait le formulaire avec
// elle, elle coûterait plus qu'elle ne rapporte.

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

const CHARGE_UTILE = {
  type: "FeatureCollection",
  features: [
    {
      properties: {
        label: "20 Rue de la Paix 78200 Mantes-la-Jolie",
        context: "78, Yvelines, Île-de-France",
      },
    },
  ],
};

/** Un service qui se comporte comme on le lui demande, sur un port libre. */
function servir(
  repondre: (url: URL, finir: (code: number, corps: string, type?: string) => void) => void
): Promise<{ base: string; fermer: () => Promise<void>; vues: URL[]; serveur: Server }> {
  const vues: URL[] = [];
  return new Promise((resoudre) => {
    const serveur = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      vues.push(url);
      repondre(url, (code, corps, type = "application/json") => {
        res.writeHead(code, { "Content-Type": type });
        res.end(corps);
      });
    });
    serveur.listen(0, "127.0.0.1", () => {
      const port = (serveur.address() as { port: number }).port;
      resoudre({
        base: `http://127.0.0.1:${port}`,
        vues,
        serveur,
        fermer: () => new Promise<void>((r) => serveur.close(() => r())),
      });
    });
  });
}

async function main() {
  console.log("=== Le jour où tout va bien ===");

  await cas("l'adresse tapée arrive au service, et la suggestion revient entière", async () => {
    const s = await servir((_url, finir) => finir(200, JSON.stringify(CHARGE_UTILE)));
    try {
      const r = await chercherAdresses("20 rue de la paix 78", s.base);
      assert.ok(r.ok, "La recherche a échoué alors que le service répondait normalement.");
      assert.deepEqual(r.suggestions, [
        { libelle: "20 Rue de la Paix 78200 Mantes-la-Jolie", contexte: "78, Yvelines, Île-de-France" },
      ]);

      const demande = s.vues[0];
      assert.equal(demande.pathname, "/search/");
      assert.equal(demande.searchParams.get("q"), "20 rue de la paix 78");
      assert.equal(
        demande.searchParams.get("autocomplete"),
        "1",
        "Sans le mode « autocomplete », le service exige un mot terminé : la liste ne suivrait pas la frappe."
      );
    } finally {
      await s.fermer();
    }
  });

  await cas("on n'envoie QUE la rue — jamais le nom du client", async () => {
    // Ce qui part chez un tiers est ce qui compte le plus ici. Le patron a
    // accepté l'aide à la saisie parce qu'elle n'expose pas ses clients ; ce
    // contrôle est ce qui rend cette phrase vraie plutôt que rassurante.
    const s = await servir((_url, finir) => finir(200, JSON.stringify(CHARGE_UTILE)));
    try {
      await chercherAdresses("12 rue des Lilas", s.base);
      const envoye = s.vues[0].searchParams;
      const noms = [...envoye.keys()].sort();
      assert.deepEqual(
        noms,
        ["autocomplete", "limit", "q"],
        `Des données inattendues partent chez le service : ${noms.join(", ")}.`
      );
    } finally {
      await s.fermer();
    }
  });

  console.log("\n=== Les mauvais jours du service ===");

  await cas("service en panne (502) : aucune suggestion, aucune exception", async () => {
    const s = await servir((_url, finir) => finir(502, "<html>Bad Gateway</html>", "text/html"));
    try {
      const r = await chercherAdresses("20 rue de la paix", s.base);
      assert.equal(r.ok, false);
      assert.equal(r.ok === false && r.raison, "refuse");
    } finally {
      await s.fermer();
    }
  });

  await cas("réponse illisible : aucune suggestion, aucune exception", async () => {
    const s = await servir((_url, finir) => finir(200, "ceci n'est pas du JSON"));
    try {
      const r = await chercherAdresses("20 rue de la paix", s.base);
      assert.equal(r.ok, false, "Une réponse illisible ne doit jamais produire d'adresse.");
    } finally {
      await s.fermer();
    }
  });

  await cas("service injoignable : on rend la main, on ne fait pas attendre", async () => {
    // Port fermé : le cas du réseau coupé sur un chantier.
    const r = await chercherAdresses("20 rue de la paix", "http://127.0.0.1:1");
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.raison, "injoignable");
  });

  await cas("service qui ne répond jamais : on abandonne au bout de quelques secondes", async () => {
    // Le pire cas, et le seul invisible : une connexion qui reste ouverte. Sans
    // délai maximal, la liste ne viendrait jamais ET le champ resterait suspendu.
    const s = await servir(() => {
      /* on ne répond pas, volontairement */
    });
    try {
      const debut = Date.now();
      const r = await chercherAdresses("20 rue de la paix", s.base);
      const duree = Date.now() - debut;
      assert.equal(r.ok, false);
      assert.ok(duree < 10_000, `Abandon après ${duree} ms : trop long, le champ reste figé sous les doigts.`);
    } finally {
      s.serveur.closeAllConnections?.();
      await s.fermer();
    }
  });

  console.log("\n=== Ce qu'on n'appelle pas du tout ===");

  await cas("moins de trois caractères : aucune requête n'est émise", async () => {
    // Le contrôle qui coûte le plus cher s'il manque : une requête par lettre,
    // multipliée par dix mille utilisateurs, c'est nous qui serions coupés.
    const s = await servir((_url, finir) => finir(200, JSON.stringify(CHARGE_UTILE)));
    try {
      const r = await chercherAdresses("20", s.base);
      assert.equal(r.ok, false);
      assert.equal(r.ok === false && r.raison, "trop-court");
      assert.equal(s.vues.length, 0, `${s.vues.length} requête(s) partie(s) pour deux caractères.`);
    } finally {
      await s.fermer();
    }
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Recherche d'adresse — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
