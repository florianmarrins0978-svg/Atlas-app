import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { trajetVoiture, lireTrajet } from "../src/server/itineraire/geoplateforme";

// **L'appel au service d'itinéraire de l'IGN, confronté à ce qu'un service
// extérieur fait réellement.**
//
// Même dispositif que `test-recherche-adresse.ts`, et pour la même raison : le
// mandataire réseau de l'environnement de développement refuse les services
// extérieurs. On monte donc ICI un service qui se comporte comme lui, y compris
// dans ses mauvais jours, et la vérification contre le VRAI service est
// déplacée vers une machine qui a le réseau (`.github/workflows/itineraire.yml`).
//
// Ce que ces contrôles tiennent, et qui ne se voit sur aucune capture :
//
//   · **une panne de l'IGN ne doit jamais vider le planning.** Le trajet est un
//     confort ; le vol d'oiseau, lui, est calculé chez nous et ne dépend de
//     personne. Si l'appel levait, l'écran entier tomberait avec lui ;
//   · **ce qui part chez le service se limite à deux paires de nombres.** Pas de
//     nom de client, pas d'adresse en clair. C'est ce qui rend la fonction
//     acceptable avant que le contrat de sous-traitance existe
//     (`docs/A-FAIRE.md` points 1 et 2) — et un contrôle vaut mieux qu'une
//     phrase rassurante ;
//   · **longitude d'abord.** Inversée, la requête part pour la Somalie et le
//     service répond « pas de route » sans qu'on comprenne pourquoi.

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void> | void) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const SAINT_MARTIN = { latitude: 45.6483, longitude: 4.5622 };
const MORNANT = { latitude: 45.6156, longitude: 4.6717 };

/** Ce que le service a réellement répondu le 16 août 2026, en plus court. */
const REPONSE = { distance: 12.04, duration: 20.3, resource: "bdtopo-osrm", profile: "car" };

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

  await cas("le trajet revient en kilomètres et en minutes", async () => {
    const s = await servir((_url, finir) => finir(200, JSON.stringify(REPONSE)));
    try {
      const r = await trajetVoiture(SAINT_MARTIN, MORNANT, s.base);
      assert.ok(r.ok, "Le trajet a échoué alors que le service répondait normalement.");
      assert.deepEqual(r.trajet, { km: 12.04, minutes: 20.3 });
    } finally {
      await s.fermer();
    }
  });

  await cas("longitude d'abord, latitude ensuite — l'ordre du service", async () => {
    const s = await servir((_url, finir) => finir(200, JSON.stringify(REPONSE)));
    try {
      await trajetVoiture(SAINT_MARTIN, MORNANT, s.base);
      const q = s.vues[0].searchParams;
      assert.equal(q.get("start"), "4.5622,45.6483");
      assert.equal(q.get("end"), "4.6717,45.6156");
    } finally {
      await s.fermer();
    }
  });

  await cas("on demande des kilomètres et des minutes, on ne les devine pas", async () => {
    // Sans ces deux paramètres le service rend des mètres et des secondes : « à
    // 12040 km, 1218 min de route » s'afficherait sans qu'aucun type ne bronche.
    const s = await servir((_url, finir) => finir(200, JSON.stringify(REPONSE)));
    try {
      await trajetVoiture(SAINT_MARTIN, MORNANT, s.base);
      const q = s.vues[0].searchParams;
      assert.equal(q.get("distanceUnit"), "kilometer");
      assert.equal(q.get("timeUnit"), "minute");
      assert.equal(q.get("profile"), "car");
    } finally {
      await s.fermer();
    }
  });

  await cas("il ne part QUE des nombres — jamais un nom, jamais une adresse", async () => {
    // Ce qui part chez un tiers est ce qui compte le plus ici : c'est la phrase
    // sur laquelle repose l'acceptabilité de la fonction. Ce contrôle est ce qui
    // la rend vraie plutôt que rassurante.
    const s = await servir((_url, finir) => finir(200, JSON.stringify(REPONSE)));
    try {
      await trajetVoiture(SAINT_MARTIN, MORNANT, s.base);
      const q = s.vues[0].searchParams;
      const noms = [...q.keys()].sort();
      assert.deepEqual(
        noms,
        ["distanceUnit", "end", "getSteps", "optimization", "profile", "resource", "start", "timeUnit"],
        `Des données inattendues partent chez le service : ${noms.join(", ")}.`
      );
      for (const [nom, valeur] of q) {
        assert.ok(
          !/[A-Za-zÀ-ÿ]{4,}/.test(valeur) || ["resource", "profile", "optimization", "distanceUnit", "timeUnit", "getSteps"].includes(nom),
          `Le paramètre « ${nom} » emporte du texte : ${valeur}`
        );
      }
    } finally {
      await s.fermer();
    }
  });

  console.log("\n=== Les mauvais jours du service ===");

  await cas("service en panne (502) : aucun trajet, aucune exception", async () => {
    const s = await servir((_url, finir) => finir(502, "<html>Bad Gateway</html>", "text/html"));
    try {
      const r = await trajetVoiture(SAINT_MARTIN, MORNANT, s.base);
      assert.equal(r.ok, false);
      assert.equal(r.ok === false && r.raison, "refuse");
    } finally {
      await s.fermer();
    }
  });

  await cas("réponse illisible : aucun trajet, aucune exception", async () => {
    const s = await servir((_url, finir) => finir(200, "ceci n'est pas du JSON"));
    try {
      const r = await trajetVoiture(SAINT_MARTIN, MORNANT, s.base);
      assert.equal(r.ok, false);
      assert.equal(r.ok === false && r.raison, "illisible");
    } finally {
      await s.fermer();
    }
  });

  await cas("200 avec un corps qu'on ne reconnaît pas : on ne devine rien", async () => {
    // **Le piège le plus discret** : le service change de noms de champs, tout
    // répond 200, et l'écran affiche « à NaN min de route ».
    const s = await servir((_url, finir) => finir(200, JSON.stringify({ longueur: 12, temps: 20 })));
    try {
      const r = await trajetVoiture(SAINT_MARTIN, MORNANT, s.base);
      assert.equal(r.ok, false, "Un corps méconnu a produit un trajet : il aurait affiché NaN.");
    } finally {
      await s.fermer();
    }
  });

  await cas("service injoignable : on rend la main tout de suite", async () => {
    const r = await trajetVoiture(SAINT_MARTIN, MORNANT, "http://127.0.0.1:1");
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.raison, "injoignable");
  });

  await cas("service qui ne répond jamais : on abandonne, l'écran ne reste pas suspendu", async () => {
    const s = await servir(() => {
      /* on ne répond pas, volontairement */
    });
    try {
      const debut = Date.now();
      const r = await trajetVoiture(SAINT_MARTIN, MORNANT, s.base);
      const duree = Date.now() - debut;
      assert.equal(r.ok, false);
      assert.ok(duree < 12_000, `Abandon après ${duree} ms : le planning resterait figé.`);
    } finally {
      s.serveur.closeAllConnections?.();
      await s.fermer();
    }
  });

  console.log("\n=== La lecture de la réponse, sans réseau ===");

  await cas("les nombres rendus en texte sont acceptés", () => {
    // Vu sur d'autres services de la même Géoplateforme : « "12.04" » au lieu de
    // 12.04. Refuser serait perdre le trajet pour une paire de guillemets.
    const r = lireTrajet({ distance: "12.04", duration: "20.3" });
    assert.ok(r.ok);
    assert.deepEqual(r.trajet, { km: 12.04, minutes: 20.3 });
  });

  await cas("durée nulle : aucune route ne relie les deux points", () => {
    // Le service le rend quand un point tombe dans un lac ou sur une île. « à
    // 0 min de route » serait plus trompeur que pas de proposition du tout.
    const r = lireTrajet({ distance: 0, duration: 0 });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.raison, "sans-route");
  });

  await cas("null, une liste, un nombre : rien ne lève", () => {
    for (const charge of [null, [], 42, "texte", undefined]) {
      const r = lireTrajet(charge);
      assert.equal(r.ok, false, `${JSON.stringify(charge)} a produit un trajet.`);
    }
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Itinéraire IGN — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
