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

cas("un port QUE LE RELAIS NE CONNAÎT PAS n'envoie plus basculer une visibilité", () => {
  // **Le cas du 23 août 2026, et il a coûté trois « ça ne marche pas ».** La
  // fiche donnait le même geste — rendre le port public — quel que soit ce que
  // le démarrage avait rencontré. Basculer la visibilité d'un port que le
  // relais ne connaît pas ne peut RIEN : il n'y a rien à basculer.
  const { souci } = verdictPort({
    etatPort: "non-declare",
    dehors: { joignable: false, statut: 404, type: null, motif: "404 sans type" },
  });
  assert.match(souci ?? "", /NE CONNAÎT MÊME PAS LE PORT/, "le souci ne dit pas que le port est inconnu du relais");
  assert.match(souci ?? "", /RÉENREGISTRER|Transférer un port/, "il n'indique pas le geste qui, LUI, peut aboutir");
  assert.ok(
    !/« Visibilité du port » → « Public »/.test(souci ?? ""),
    "il renvoie encore vers la bascule de visibilité, celle qui ne peut rien ici"
  );
});

cas("un refus de GitHub est CITÉ, jamais résumé en « échec »", () => {
  // Un mot qui ne désigne personne coûte plus cher que pas de message du tout.
  const { souci } = verdictPort({
    etatPort: "échec:HTTP 401: Bad credentials",
    dehors: { joignable: false, statut: 404, type: null, motif: "404 sans type" },
  });
  assert.match(souci ?? "", /Bad credentials/, "la raison du refus est perdue en route");
  assert.match(souci ?? "", /gh auth login/, "on ne dit pas comment lever le refus");
});

cas("« sans-gh » DIT que personne n'a réglé ce port depuis l'allumage", () => {
  const { souci } = verdictPort({
    etatPort: "sans-gh",
    dehors: { joignable: false, statut: 404, type: null, motif: "404 sans type" },
  });
  assert.match(souci ?? "", /N'A PAS PU L'OUVRIR LUI-MÊME/, "rien ne dit que l'espace n'a rien pu faire");
  assert.match(souci ?? "", /Rebuild Container/, "le remède de fond — un espace qui naît avec la déclaration — n'est pas donné");
});

cas("sans mesure, « non-declare » se dit tel quel et ne passe pas pour « inconnu »", () => {
  const { ligne } = verdictPort({ etatPort: "non-declare", dehors: null });
  assert.match(ligne, /NON DÉCLARÉ AU RELAIS/, "un port inconnu du relais est rangé avec les visibilités douteuses");
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

cas("un 404 DÉSIGNE son auteur, et sur une SIGNATURE, non sur des indices", async () => {
  // **Deux 404 opposés portent le même chiffre.** Celui du relais veut dire
  // « la requête n'atteint pas Atlas » ; celui d'Atlas veut dire l'inverse. Le
  // geste à faire n'est pas le même, et se tromper coûte une soirée.
  //
  // **La première version DEVINAIT**, sur la présence du mot « github » dans
  // l'en-tête `Server`. Le 23 août 2026, le patron reçoit un refus arrivé NU —
  // sans en-tête, sans type : il tombait donc du côté d'Atlas, et la fiche l'a
  // envoyé lire un journal de serveur qui n'avait rien à dire. Atlas signe
  // désormais ses réponses (`x-atlas-vivant`), et le relais ne peut pas
  // inventer cette signature.
  const faux = (entetes: Record<string, string>) =>
    Promise.resolve({ status: 404, headers: new Headers(entetes) } as Response);

  const duRelais = await regarderDuDehors({
    nom: "espace", domaine: "app.github.dev",
    chercher: () => faux({ server: "GitHub.com", "content-type": "text/html" }),
  });
  assert.match(duRelais!.motif ?? "", /AVANT Atlas/, "un 404 de GitHub n'est pas reconnu : on renvoie lire le journal d'Atlas pour rien");
  assert.match(duRelais!.motif ?? "", /n'atteint PAS l'application/, "il ne dit pas le geste qui répare");

  // **SON CAS DU 23 AOÛT, et c'est celui qui a menti.** Un refus sans le
  // moindre en-tête ne prouve RIEN sur Atlas ; l'ancienne règle le lui
  // attribuait pourtant, faute d'y lire « github ».
  const toutNu = await regarderDuDehors({
    nom: "espace", domaine: "app.github.dev",
    chercher: () => faux({}),
  });
  assert.doesNotMatch(
    toutNu!.motif ?? "",
    /d'ATLAS lui-même/,
    "un refus SANS EN-TÊTE est mis sur le dos d'Atlas : c'est le défaut du 23 août, " +
      "qui a envoyé le patron lire un journal muet pendant que le port était en cause"
  );
  assert.match(toutNu!.motif ?? "", /n'atteint PAS l'application/, "il n'oriente pas vers le port");
  // **Et il DIT ce que la réponse portait.** Devant un refus nu, c'est la seule
  // chose qui reste à examiner — sans elle, la fiche décrit un vide et l'agent
  // en est réduit à supposer, ce qui a déjà coûté deux allers-retours au patron.
  assert.match(
    toutNu!.motif ?? "",
    /en-têtes reçus : AUCUN/,
    "la fiche ne dit pas que la réponse n'avait AUCUN en-tête : le seul fait qui restait à lire"
  );

  // Et quand il y en a, ce sont les NOMS qui sortent — jamais les valeurs, qui
  // peuvent porter un jeton sur un dépôt public.
  const avecEntetes = await regarderDuDehors({
    nom: "espace", domaine: "app.github.dev",
    chercher: () => faux({ "x-github-request-id": "SECRET-123", server: "GitHub.com" }),
  });
  assert.match(avecEntetes!.motif ?? "", /en-têtes reçus : .*x-github-request-id/, "les noms d'en-têtes ne sont pas publiés");
  assert.doesNotMatch(avecEntetes!.motif ?? "", /SECRET-123/, "une VALEUR d'en-tête est publiée : ce dépôt est public");

  // Et l'inverse : une réponse SIGNÉE est bien mise au compte d'Atlas, sans
  // quoi le contrôle serait devenu incapable de désigner l'application et l'on
  // enverrait toujours vers le port.
  const dAtlas = await regarderDuDehors({
    nom: "espace", domaine: "app.github.dev",
    chercher: () => faux({ "x-atlas-vivant": "1", server: "next.js" }),
  });
  assert.match(dAtlas!.motif ?? "", /ATLAS lui-même/, "une réponse signée n'est pas reconnue : on enverrait au port pour rien");

  // **La signature ne doit pas se laisser imiter par le nom du serveur.** Sans
  // ce cas, on aurait pu retomber sur la déduction d'avant sans s'en apercevoir.
  const imitation = await regarderDuDehors({
    nom: "espace", domaine: "app.github.dev",
    chercher: () => faux({ server: "atlas-vivant" }),
  });
  assert.doesNotMatch(imitation!.motif ?? "", /d'ATLAS lui-même/, "un nom de serveur suffit à se faire passer pour Atlas");
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

cas("SA NUIT DU 31 AOÛT : un refus du relais N'ACCUSE PLUS le port quand rien ne sert", () => {
  // **Sa fiche se contredisait sur deux lignes voisines**, à 1 h 07, pendant
  // qu'il essayait d'ouvrir Atlas depuis son téléphone :
  //
  //     Serveur   : NE RÉPOND PAS sur le port 3000
  //     Port 3000 : INJOIGNABLE — … c'est le port ou le relais, pas le code
  //
  // Et le geste proposé — onglet PORTS → « Public » — ne pouvait RIEN : un
  // relais qui ne trouve personne derrière un port répond 502, public ou non.
  // Deux chiffres qui se contredisent dans le même écran, c'est toute la fiche
  // qu'on cesse de croire (`CLAUDE.md` §4 bis).
  const { souci } = verdictPort({
    etatPort: "ouvert",
    dehors: {
      joignable: false,
      statut: 502,
      type: "",
      motif:
        "réponse 502 de quelque chose AVANT Atlas (serveur « sans nom », sans type, " +
        "non signée ; en-têtes reçus : cache-control, connection) — la requête n'atteint " +
        "PAS l'application : c'est le port ou le relais, pas le code",
    },
    serveurLocal: false,
  });
  assert.match(souci ?? "", /RIEN NE SERT SUR LE PORT 3000/, "la fiche n'annonce pas la seule cause mesurée");
  assert.ok(
    !/« Visibilité du port » → « Public »/.test(souci ?? ""),
    "elle renvoie encore à l'onglet PORTS — le geste qui ne pouvait rien la nuit du 31 août"
  );
  assert.match(souci ?? "", /ligne « Serveur »/, "elle ne renvoie pas vers la ligne qui, elle, dit quoi faire");
});

cas("le TÉLÉCHARGEMENT qu'il voit est nommé, parce que c'est ÇA qu'il a sous les yeux", () => {
  // Sa capture ne montre ni « 502 » ni « erreur » : Safari propose d'enregistrer
  // un fichier. Une réponse sans type ne s'affiche pas — elle se télécharge. Sans
  // cette phrase, rien ne relie la fiche à ce qu'il décrit.
  const { souci } = verdictPort({
    etatPort: "ouvert",
    dehors: { joignable: false, statut: 502, type: "", motif: "réponse 502 AVANT Atlas" },
    serveurLocal: false,
  });
  assert.match(souci ?? "", /TÉLÉCHARGEMENT/, "le symptôme qu'il décrit n'est nulle part dans la fiche");
});

cas("un serveur VIVANT laisse le port suspect — on n'a pas juste déplacé l'aveuglement", () => {
  // Le cas inverse, et il doit rester intact : Atlas écoute bien sur 3000, mais
  // le dehors ne l'atteint pas. Là, le port EST le coupable, et le geste de
  // l'onglet PORTS est le bon.
  const { souci } = verdictPort({
    etatPort: "ouvert",
    dehors: { joignable: false, statut: 502, type: "", motif: "réponse 502 AVANT Atlas" },
    serveurLocal: true,
  });
  assert.match(souci ?? "", /N'ATTEINT MÊME PAS ATLAS/, "un port fermé devant un serveur debout n'est plus signalé");
  assert.match(souci ?? "", /« Visibilité du port »/, "le geste qui répare CE cas a disparu avec le correctif");
});

cas("sans mesure du serveur local, le verdict reste celui d'avant", () => {
  // **On ne conclut que sur ce qu'on a mesuré.** `serveurLocal` absent veut dire
  // « personne n'a regardé » — pas « il est mort ». Conclure ici enverrait le
  // patron attendre un veilleur devant un port réellement fermé.
  const { souci } = verdictPort({
    etatPort: "sans-gh",
    dehors: { joignable: false, statut: 502, type: "", motif: "réponse 502 AVANT Atlas" },
  });
  assert.match(souci ?? "", /N'ATTEINT MÊME PAS ATLAS/, "une ignorance est prise pour une mesure");
  assert.ok(!/RIEN NE SERT SUR LE PORT 3000/.test(souci ?? ""), "on affirme qu'aucun serveur n'écoute sans l'avoir vérifié");
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
