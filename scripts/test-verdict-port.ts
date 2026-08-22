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
