import assert from "node:assert/strict";
// Module JS voisin : le diagnostic tourne sur son espace sans passer par
// TypeScript, et c'est délibéré — il doit marcher sur une machine où rien n'est
// compilé.
import { verdictPort, regarderDuDehors } from "./_verdict-port.mjs";

// **« Il est en public déjà. »** — le patron, 22 août 2026 au matin.
//
// La fiche annonçait « Port 3000 : PRIVÉ (sans-gh) ». Elle ne mesurait rien :
// elle recopiait le mot rendu au démarrage par `ouvrir-port.sh`, lequel ne dit
// pas l'état du port mais ce que le script a pu FAIRE. `sans-gh` — « `gh` est
// absent, je n'ai pas pu le régler » — devenait « donc il est privé ».
//
// Trois allers-retours perdus, et la vraie panne restée invisible pendant ce
// temps. Cette suite tient la règle qui remplace la supposition : **la mesure
// prime, et sans mesure on ne conclut pas.**

let echecs = 0;
const epreuves: [string, () => void | Promise<void>][] = [];
// **Chaque cas est ATTENDU, y compris les asynchrones.** Une première version
// les lançait sans les attendre : leurs échecs arrivaient après le verdict, et
// la suite rendait un vert qui ne prouvait rien — le défaut que `CLAUDE.md` §5
// nomme « un contrôle qui mesure zéro ».
function cas(nom: string, verifier: () => void | Promise<void>) {
  epreuves.push([nom, verifier]);
}

console.log("=== Ce que la fiche a le droit de dire du port ===\n");

cas("SON CAS : `sans-gh` n'accuse plus le port d'être privé", () => {
  const { ligne, souci } = verdictPort({ etatPort: "sans-gh", dehors: null });
  assert.doesNotMatch(
    ligne,
    /PRIVÉ/,
    "la fiche affirme encore « PRIVÉ » sur une visibilité qu'elle n'a pas lue — c'est le mensonge du 22 août"
  );
  assert.match(ligne, /INCONNUE/, "elle doit dire qu'elle ne sait pas, plutôt que de deviner");
  assert.match(
    souci ?? "",
    /ne veut PAS dire qu'il est privé/,
    "l'avertissement doit détromper, pas envoyer faire trois clics inutiles"
  );
});

cas("la MESURE prime sur le réglage du démarrage", () => {
  // Le cas exact du 22 août : le démarrage n'a rien pu faire, mais le patron a
  // rendu le port public à la main, et l'adresse répond.
  const { ligne, souci } = verdictPort({
    etatPort: "sans-gh",
    dehors: { joignable: true, statut: 200, type: "application/json" },
  });
  assert.match(ligne, /ouvert/, "un port qui répond est déclaré fermé : la mesure ne prime pas");
  assert.equal(souci, null, "un port qui répond ne doit alarmer personne");
});

cas("une adresse publique qui ne rend PAS Atlas est signalée, avec ce qu'elle rend", () => {
  const { ligne, souci } = verdictPort({
    etatPort: "ouvert",
    dehors: { joignable: false, statut: 302, type: "text/html", motif: "renvoi vers https://github.com/login — ce n'est pas Atlas" },
  });
  assert.match(ligne, /INJOIGNABLE/, "un port réglé « ouvert » mais muet passe pour sain");
  assert.match(souci ?? "", /github\.com\/login/, "le souci ne dit pas CE QUE voit son téléphone");
});

cas("un 404 DÉSIGNE son auteur : le relais de GitHub, ou Atlas", async () => {
  // **Deux 404 opposés portent le même chiffre** — trouvé le 22 août 2026,
  // après avoir envoyé le patron deux fois à l'onglet PORTS sur un « 404 » qui
  // n'accusait personne. Celui du relais veut dire « le port n'est pas
  // public » ; celui d'Atlas veut dire l'inverse — le port est ouvert, et
  // c'est l'application qui refuse. Le geste à faire n'est pas le même.
  const faux = (entetes: Record<string, string>) =>
    Promise.resolve({ status: 404, headers: new Headers(entetes) } as Response);

  const duRelais = await regarderDuDehors({
    nom: "espace", domaine: "app.github.dev",
    chercher: () => faux({ server: "GitHub.com", "content-type": "text/html" }),
  });
  assert.match(duRelais!.motif ?? "", /RELAIS GITHUB/, "un 404 de GitHub n'est pas reconnu : on renvoie lire le journal d'Atlas pour rien");
  assert.match(duRelais!.motif ?? "", /pas public/, "il ne dit pas le geste qui répare");

  const dAtlas = await regarderDuDehors({
    nom: "espace", domaine: "app.github.dev",
    chercher: () => faux({ server: "next.js", "content-type": "application/json" }),
  });
  assert.match(dAtlas!.motif ?? "", /ATLAS lui-même/, "un 404 d'Atlas est mis sur le dos du port : trois clics inutiles de plus");
});

cas("un renvoi ne publie QUE le domaine, jamais l'adresse d'authentification", async () => {
  // **Le filtre à secrets avalait la ligne entière** (22 août 2026) : l'adresse
  // de connexion GitHub porte « authorize », que `expurger` retire en bloc — et
  // la fiche perdait le seul mot qui répondait à la question. Le domaine suffit
  // à trancher, et ne peut rien divulguer.
  const rendu = await regarderDuDehors({
    nom: "espace", domaine: "app.github.dev",
    chercher: () =>
      Promise.resolve({
        status: 302,
        headers: new Headers({
          location: "https://github.com/login/oauth/authorize?client_id=abc&state=SECRET_TOKEN_123",
        }),
      } as Response),
  });
  assert.doesNotMatch(rendu!.motif ?? "", /authorize|SECRET_TOKEN/, "l'adresse complète est publiée : le filtre retirera la ligne entière");
  assert.match(rendu!.motif ?? "", /github\.com/, "le domaine, qui tranche à lui seul, est perdu");
  assert.match(rendu!.motif ?? "", /n'est PAS public/, "le verdict ne dit pas ce qu'il faut en conclure");
});

cas("hors espace GitHub, il n'y a rien à ouvrir et rien à craindre", () => {
  const { ligne, souci } = verdictPort({ etatPort: "hors-codespace", dehors: null });
  assert.match(ligne, /hors espace/);
  assert.equal(souci, null);
});

cas("le regard du dehors ne lève jamais, même quand le réseau tombe", async () => {
  // Un diagnostic qui tombe ne diagnostique plus rien — et c'est justement
  // quand tout va mal qu'on le lit.
  const rendu = await regarderDuDehors({
    nom: "espace-imaginaire",
    domaine: "app.github.dev",
    port: "3000",
    chercher: () => Promise.reject(new Error("réseau coupé")),
  });
  assert.ok(rendu, "le regard du dehors s'est abstenu alors qu'il avait de quoi essayer");
  assert.equal(rendu.joignable, false);
  assert.match(rendu.motif ?? "", /réseau coupé/, "la raison de l'échec est perdue en route");
});

cas("hors Codespace, le regard du dehors s'abstient plutôt que d'inventer", () => {
  // `null` veut dire « je n'ai pas pu regarder », et `verdictPort` en tient
  // compte. Rendre `{joignable:false}` ferait crier au port fermé sur toute
  // machine qui n'est pas un espace GitHub — la CI, par exemple.
  return regarderDuDehors({ nom: undefined, domaine: undefined }).then((r: unknown) => {
    assert.equal(r, null);
  });
});

// Enveloppé dans une fonction : ce dépôt compile ses suites en CommonJS, où
// l'attente au premier niveau n'existe pas.
async function jouer() {
  for (const [nom, verifier] of epreuves) {
    try {
      await verifier();
      console.log(`  ✓ ${nom}`);
    } catch (e) {
      echecs++;
      console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
    }
  }

  console.log(
    echecs === 0
      ? "\n✅ Ce que la fiche dit du port — 0 échec(s).\n"
      : `\n❌ Ce que la fiche dit du port — ${echecs} échec(s).\n`
  );
  process.exit(echecs === 0 ? 0 : 1);
}

jouer();
