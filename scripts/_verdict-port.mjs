/**
 * Le port 3000 est-il joignable depuis son téléphone ? — la question, et sa
 * réponse HONNÊTE.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Payé le matin du 22 août 2026, et cela a coûté trois allers-retours.**
 *
 * La fiche annonçait « Port 3000 : PRIVÉ (sans-gh) ». Il a fait les trois clics
 * de l'onglet PORTS, puis : *« il est en public déjà »*. La fiche mentait — et
 * pas par accident : **elle ne mesurait rien.** Elle recopiait le mot rendu au
 * démarrage par `ouvrir-port.sh`, et ce mot ne dit pas l'état du port, il dit
 * ce que le script a pu FAIRE. `sans-gh` signifie « `gh` est absent, je n'ai
 * pas pu le régler » — la fiche en concluait « donc il est privé », ce qui est
 * un raisonnement, pas un relevé.
 *
 * Une fiche existe précisément pour éviter de raisonner sur une machine qu'on
 * ne voit pas (`CLAUDE.md` §1 bis). Celle-là raisonnait à notre place, et à
 * tort : « une erreur qui accuse à tort coûte plus cher que pas d'erreur du
 * tout » (`AGENTS.md`).
 *
 * **Ce qui remplace la supposition :** l'espace s'appelle lui-même par son
 * ADRESSE PUBLIQUE, celle que le patron tape sur son téléphone, et rapporte ce
 * qui revient. C'est la seule mesure qui réponde à la vraie question — non pas
 * « comment le port est-il réglé ? » mais « que voit-il, lui ? ».
 * ───────────────────────────────────────────────────────────────────────────
 */

/**
 * LE GESTE À FAIRE, D'APRÈS CE QUE L'ESPACE A PU FAIRE LUI-MÊME.
 *
 * **Né le 23 août 2026, après trois « ça ne marche pas » d'affilée.** La fiche
 * donnait toujours le même remède — rendre le port public dans l'onglet PORTS —
 * quel que soit ce que le démarrage avait rencontré. Or « privé » et « inconnu
 * du relais » portent le même symptôme et n'ont pas le même geste : basculer la
 * visibilité d'un port que le relais ne connaît pas ne peut RIEN, et c'est
 * pourtant ce qu'on lui faisait refaire.
 *
 * Le mot rendu par `ouvrir-port.sh` tranche, et il n'était pas lu ici.
 */
function gestePort(etatPort) {
  const mot = String(etatPort ?? "");

  if (mot === "non-declare") {
    return (
      "     LE RELAIS NE CONNAÎT MÊME PAS LE PORT 3000 — vérifié auprès de GitHub.\n" +
      "     Le rendre « public » ne peut donc rien : il n'y a rien à basculer.\n" +
      "     Il faut le RÉENREGISTRER : onglet PORTS → retirer la ligne 3000, puis\n" +
      "     « Transférer un port » → 3000. S'il ne revient pas, reconstruire le\n" +
      "     conteneur (⌘⇧P → « Rebuild Container ») : la déclaration publique de\n" +
      "     `devcontainer.json` ne s'applique qu'à ce moment-là."
    );
  }

  if (mot === "sans-gh") {
    return (
      "     L'ESPACE N'A PAS PU L'OUVRIR LUI-MÊME (`gh` est absent de cette image) :\n" +
      "     personne n'a donc réglé ce port depuis son allumage.\n" +
      "     onglet PORTS → clic droit sur 3000 → « Visibilité du port » → « Public ».\n" +
      "     S'il n'y a PAS de ligne 3000, c'est qu'il n'est pas déclaré : le\n" +
      "     transférer, ou reconstruire le conteneur (« Rebuild Container »), qui\n" +
      "     applique la déclaration publique de `devcontainer.json`."
    );
  }

  if (mot.startsWith("échec:")) {
    return (
      `     L'ESPACE A ESSAYÉ DE L'OUVRIR ET GITHUB A REFUSÉ : ${mot.slice("échec:".length)}\n` +
      "     C'est ce refus qu'il faut lever — pas la visibilité du port. Un jeton\n" +
      "     expiré se renouvelle par `gh auth login` dans le terminal de l'espace."
    );
  }

  // « ouvert », « hors-codespace », ou rien : on ne sait pas mieux, et on garde
  // les deux gestes dans l'ordre où ils coûtent le moins cher.
  return (
    "     C'est le port qui n'est pas joignable de l'extérieur :\n" +
    "     onglet PORTS → clic droit sur 3000 → « Visibilité du port » → « Public ».\n" +
    "     S'il est DÉJÀ public, c'est que le relais ne trouve personne sur 3000 :\n" +
    "     retirer puis remettre le port dans l'onglet PORTS le réenregistre."
  );
}

/**
 * Le verdict, à partir de ce qu'on a pu constater.
 *
 * Fonction pure, éprouvée sans réseau (`scripts/test-verdict-port.ts`).
 *
 * @param {object} vu
 * @param {string|null} vu.etatPort  Le mot rendu par `ouvrir-port.sh`, ou `null`.
 * @param {null|{joignable:boolean, statut?:number, type?:string|null, motif?:string}} vu.dehors
 *   Ce que l'appel à l'adresse publique a rendu, ou `null` si on n'a pas pu
 *   l'essayer (hors Codespace, variables absentes).
 * @param {boolean|null} [vu.serveurLocal] Atlas répond-il sur `127.0.0.1:3000` ?
 *   `null` quand personne ne l'a mesuré — et l'on ne conclut alors rien de plus
 *   qu'avant. Voir le bloc « RIEN NE SERT SUR 3000 » plus bas.
 * @returns {{ligne:string, souci:string|null}}
 */
export function verdictPort({ etatPort, dehors, serveurLocal = null }) {
  // **La mesure prime sur le réglage, toujours.** Un port qu'il a lui-même
  // rendu public répond, quoi qu'ait pu faire — ou ne pas faire — le script de
  // démarrage. C'est exactement le cas qui a fait mentir la fiche.
  if (dehors && dehors.joignable) {
    return { ligne: "ouvert — Atlas répond bien à l'adresse publique (vérifié)", souci: null };
  }

  if (dehors && !dehors.joignable) {
    const detail = dehors.motif
      ? dehors.motif
      : `réponse ${dehors.statut ?? "?"}${dehors.type ? ` (${dehors.type})` : ""}`;
    // **Le geste À FAIRE découle de QUI a répondu, et il n'y a plus à choisir.**
    // Tant que la fiche proposait « deux causes possibles, dans cet ordre », le
    // patron essayait la première — rendre le port public — et revenait dire
    // « je suis déjà en public ». La signature d'Atlas tranche : on ne lui
    // propose plus une liste, on lui donne le geste.
    const atteintAtlas = /d'ATLAS lui-même/.test(detail);

    // **CE QU'IL VOIT, LUI : un TÉLÉCHARGEMENT, pas une erreur.** Sa capture du
    // 31 août 2026 à 1 h 07 montre Safari sur `about:blank`, proposant
    // d'enregistrer un fichier nommé comme son espace. Ce n'est pas une panne
    // de plus : c'est ce que fait un navigateur devant une réponse SANS TYPE —
    // il ne sait pas l'afficher, donc il l'enregistre. Le refus nu du relais
    // arrive exactement ainsi. Sans cette phrase, la fiche décrit un « 502 »
    // que rien ne relie à ce qu'il a sous les yeux.
    const sansType = dehors.statut !== undefined && !dehors.type;
    const vuDuTelephone = sansType
      ? "\n     Sur son téléphone, cela se voit comme un TÉLÉCHARGEMENT proposé à la\n" +
        "     place de la page : un navigateur enregistre ce qu'il ne sait pas afficher."
      : "";

    // ─────────────────────────────────────────────────────────────────────────
    // **RIEN NE SERT SUR 3000 : LE RELAIS NE PEUT RENDRE QUE ÇA — 31 août 2026.**
    //
    // Sa fiche de la nuit se contredisait sur deux lignes voisines :
    //
    //     Serveur   : NE RÉPOND PAS sur le port 3000
    //     Port 3000 : INJOIGNABLE DE L'EXTÉRIEUR — réponse 502 … c'est le port
    //                 ou le relais, PAS le code
    //
    // La seconde accusait le port pendant que la première disait qu'aucun
    // serveur n'écoutait — et le geste proposé (onglet PORTS → « Public »)
    // n'aurait rien pu réparer : un relais qui ne trouve personne derrière un
    // port répond 502, public ou non. C'est la faute que ce fichier existe pour
    // ne plus commettre : « une erreur qui accuse à tort coûte plus cher que
    // pas d'erreur du tout » (`AGENTS.md`).
    //
    // On ne conclut que sur une MESURE : `serveurLocal` vaut `false` quand
    // `127.0.0.1:3000` a été interrogé et s'est tu. À `null` — non mesuré — le
    // verdict reste celui d'avant, faute de savoir.
    if (!atteintAtlas && serveurLocal === false) {
      return {
        ligne: `INJOIGNABLE DE L'EXTÉRIEUR — ${detail}`,
        souci:
          "RIEN NE SERT SUR LE PORT 3000, ET C'EST TOUT : le relais de GitHub ne\n" +
          "     trouve personne derrière, donc il refuse. Le port n'y est pour rien —\n" +
          "     public ou non, il n'y a rien à atteindre.\n" +
          `     Ce que voit son téléphone : ${detail}.${vuDuTelephone}\n` +
          "     NE PAS toucher à l'onglet PORTS : c'est la ligne « Serveur » ci-dessus\n" +
          "     qu'il faut suivre, et elle dit quoi faire.",
      };
    }

    return {
      ligne: `INJOIGNABLE DE L'EXTÉRIEUR — ${detail}`,
      souci: atteintAtlas
        ? "L'ADRESSE PUBLIQUE ATTEINT ATLAS, ET C'EST ATLAS QUI REFUSE.\n" +
          `     Ce que voit son téléphone : ${detail}.\n` +
          "     Le port n'y est pour rien — inutile d'y toucher. C'est le JOURNAL DE\n" +
          "     DÉMARRAGE qu'il faut lire (/tmp/essai.log), et lui seul."
        : "L'ADRESSE PUBLIQUE N'ATTEINT MÊME PAS ATLAS. L'espace tourne, mais la\n" +
          `     requête s'arrête avant : ${detail}.${vuDuTelephone}\n` +
          "     Le code n'y est pour rien — inutile de lire le journal du serveur.\n" +
          gestePort(etatPort),
    };
  }

  // Sans mesure possible, on dit ce qu'on sait — et **on ne conclut pas**.
  if (etatPort === "ouvert") {
    return { ligne: "rendu public au démarrage (non revérifié depuis)", souci: null };
  }
  if (etatPort === "hors-codespace") {
    return { ligne: "hors espace GitHub — rien à ouvrir", souci: null };
  }
  if (etatPort === null) {
    return { ligne: "inconnu (démarrage d'avant le 21 août, ou hors banc)", souci: null };
  }
  if (String(etatPort).startsWith("échec:")) {
    return {
      ligne: `NON RÉGLÉ — GitHub a refusé : ${String(etatPort).slice("échec:".length)}`,
      souci:
        "L'ESPACE A ESSAYÉ D'OUVRIR LE PORT ET S'EST FAIT REFUSER. Tant que ce\n" +
        "     refus tient, chaque allumage repartira avec un port non réglé.",
    };
  }
  if (etatPort === "non-declare") {
    return {
      ligne: "NON DÉCLARÉ AU RELAIS — GitHub ne connaît aucun port 3000 pour cet espace",
      souci: "LE RELAIS NE CONNAÎT PAS LE PORT 3000.\n" + gestePort("non-declare"),
    };
  }
  return {
    ligne: `visibilité INCONNUE (${etatPort}) — le démarrage n'a pas pu la régler NI la lire`,
    souci:
      "LA VISIBILITÉ DU PORT 3000 N'A PAS PU ÊTRE RÉGLÉE au démarrage, et n'a pas\n" +
      "     pu être vérifiée non plus. **Cela ne veut PAS dire qu'il est privé** :\n" +
      "     s'il a été rendu public à la main, il l'est resté. Si l'application ne\n" +
      "     s'ouvre pas depuis un téléphone, commencer par l'onglet PORTS de\n" +
      "     l'éditeur → clic droit sur 3000 → « Visibilité du port » → « Public ».",
  };
}

/**
 * Appeler l'espace par SON ADRESSE PUBLIQUE, comme le ferait son téléphone.
 *
 * **Sans jeton et sans biscuit, délibérément.** Un appel authentifié
 * traverserait un port privé et rendrait un vert qui ne vaut rien — c'est
 * exactement le vert que la fiche donnait déjà. Ce qu'on veut savoir est ce que
 * voit un visiteur nu.
 *
 * Ne lève jamais : un diagnostic qui tombe ne diagnostique plus rien.
 */
export async function regarderDuDehors({
  nom = process.env.CODESPACE_NAME,
  domaine = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN,
  port = process.env.PORT ?? "3000",
  chercher = (url, options) => fetch(url, options),
} = {}) {
  if (!nom || !domaine) return null;
  const url = `https://${nom}-${port}.${domaine}/api/health/live`;
  try {
    const r = await chercher(url, {
      redirect: "manual",
      // Les biscuits d'une session GitHub fausseraient la mesure ; il n'y en a
      // pas ici, mais le dire empêche qu'on en ajoute par confort un jour.
      headers: { "cache-control": "no-cache" },
      signal: AbortSignal.timeout(10_000),
    });
    const type = r.headers.get("content-type") ?? "";
    // **Atlas répond du JSON sur cette adresse, GitHub répond une page.** Le
    // code seul ne suffit pas : une page de connexion GitHub peut arriver en
    // 200, et c'est ce qui a fait croire à un serveur en bonne santé.
    if (r.status === 200 && type.includes("json")) return { joignable: true, statut: 200, type };
    if (r.status >= 300 && r.status < 400) {
      // **Le SEUL nom de domaine, jamais l'adresse entière.** Le renvoi d'un
      // port privé pointe vers une page d'authentification GitHub, dont
      // l'adresse porte « authorize » et un jeton de retour. Publiée telle
      // quelle, elle était retirée en bloc par le filtre à secrets de
      // `rapporter-espace.mjs` — et la fiche perdait précisément le mot qui
      // répondait à la question (22 août 2026). Le domaine suffit à trancher :
      // `github.com`, c'est le relais ; autre chose, c'est Atlas.
      let ou = "ailleurs";
      try {
        ou = new URL(r.headers.get("location") ?? "", url).host;
      } catch {
        /* une destination illisible ne doit pas faire tomber le diagnostic */
      }
      return {
        joignable: false,
        statut: r.status,
        type,
        motif: /github\.com$/i.test(ou)
          ? `renvoi vers ${ou} — le relais demande une connexion GitHub, donc le port n'est PAS public`
          : `renvoi vers ${ou} — ce n'est pas Atlas`,
      };
    }
    // **QUI répond, et c'est toute la question** — ajouté le 22 août 2026,
    // après un « 404 » qui ne désignait personne. Un 404 du relais de GitHub
    // (port non public) et un 404 d'Atlas (route absente) portent le même
    // chiffre et appellent deux gestes opposés : rendre le port public, ou
    // aller lire le journal du serveur. Envoyer au mauvais des deux, c'est ce
    // qu'on vient de faire deux fois.
    //
    // **On publie l'IDENTITÉ du serveur, jamais le corps de sa réponse.** Ce
    // dépôt est public, et une censure faite au jugé finit toujours par
    // laisser passer l'imprévu (`scripts/rapporter-espace.mjs`).
    const serveur = r.headers.get("server") ?? "sans nom";
    // **QUI a répondu se CONSTATE, il ne se devine plus.**
    //
    // Le 23 août 2026, le patron reçoit un téléchargement au lieu d'Atlas. La
    // fiche annonce « 404 d'ATLAS lui-même » et l'envoie lire le journal du
    // serveur — alors que la requête n'avait jamais atteint Atlas. La déduction
    // reposait sur l'absence du mot « github » dans l'en-tête `Server` : un
    // refus du relais arrivé NU, sans en-tête ni type, tombait donc du mauvais
    // côté. Deux hypothèses fausses lui ont été livrées avant qu'on ne le voie.
    //
    // Atlas signe désormais cette route (`x-atlas-vivant`, voir
    // `src/app/api/health/live/route.ts`). Le relais ne peut pas inventer cette
    // signature : présente, c'est Atlas ; absente, la requête n'est pas arrivée
    // jusqu'à lui. Les marques de GitHub restent lues, mais seulement pour
    // NOMMER le relais — plus pour décider.
    // **Les NOMS des en-têtes reçus, jamais leurs valeurs.** Devant un refus nu,
    // savoir ce que la réponse portait — ou ne portait rien du tout — est la
    // seule chose qui distingue un relais muet d'un serveur intermédiaire. Les
    // valeurs, elles, peuvent contenir un jeton ; ce dépôt est public
    // (`scripts/rapporter-espace.mjs`).
    const nomsEntetes = [...r.headers.keys()].sort().join(", ") || "AUCUN";
    const signeAtlas = r.headers.get("x-atlas-vivant") !== null;
    const marqueGithub = /github/i.test(serveur) || /github/i.test(r.headers.get("x-github-request-id") ?? "x");
    const relais = !signeAtlas;
    return {
      joignable: false,
      statut: r.status,
      type,
      motif: relais
        ? `réponse ${r.status} de ${marqueGithub ? "GitHub" : "quelque chose"} AVANT Atlas ` +
          `(serveur « ${serveur} », ${type || "sans type"}, non signée ; en-têtes reçus : ` +
          `${nomsEntetes}) — la requête n'atteint PAS l'application : c'est le port ou ` +
          `le relais, pas le code`
        : `réponse ${r.status} d'ATLAS lui-même (signature reçue, serveur « ${serveur} », ` +
          `${type || "sans type"}) — le port est bien ouvert, c'est l'application qui refuse`,
    };
  } catch (err) {
    return {
      joignable: false,
      motif: `l'adresse publique n'a pas répondu (${err instanceof Error ? err.message : String(err)})`,
    };
  }
}
