#!/usr/bin/env node
/**
 * NE PAS VIDER LE REDIS DES AUTRES SESSIONS.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa consigne du 9 septembre 2026, et elle est arrivée en colère :**
 * *« normalement chaque session peut prendre un port différent, plusieurs
 * sessions tournent en même temps, n'effacez pas les batteries des autres ! »*
 * Puis, dans la foulée : *« pourquoi une session vide toutes les autres, je
 * veux plus ça ! »*
 *
 * **Ce qui l'a provoquée :** trois `redis-cli FLUSHALL` joués le soir même,
 * pour débloquer le limiteur de connexion pendant un diagnostic.
 *
 * ─── POURQUOI C'EST GRAVE, ET POURQUOI ÇA NE SE VOIT PAS ───────────────────
 *
 * Redis tient **seize bases numérotées**, étanches entre elles, et
 * `scripts/_atelier.ts` en donne UNE par atelier : c'est exactement ce qui
 * permet à plusieurs batteries de tourner en même temps sur une machine.
 *
 * `FLUSHALL` les vide **toutes**, donc le compteur de connexions des voisines.
 * Le limiteur n'accepte que cinq connexions par quart d'heure pour un même
 * couple (compte, adresse IP) ; vidé sous les pieds d'une batterie en cours,
 * il la fait rougir vingt fois sur *« dépassement de délai en attendant la
 * redirection après la connexion »* — c'est-à-dire : le formulaire de connexion
 * est cassé. Il ne l'est pas. C'est la panne du 14 août 2026, à ceci près
 * qu'elle est ici provoquée depuis la session d'à côté, et qu'**aucun des vingt
 * messages ne désigne le coupable**. La session voisine perd son verdict de dix
 * minutes et cherche dans son propre code.
 *
 * ─── CE QU'IL REFUSE, ET CE QU'IL LAISSE PASSER ────────────────────────────
 *
 * | `FLUSHALL` | **refusé** — il vide les seize bases, celles des autres comprises |
 * | `FLUSHDB` **sans** `-n` | **refusé** — il vide la base 0, soit l'atelier de rang 0, qui n'est pas forcément le sien |
 * | `FLUSHDB` **avec** `-n <rang>` | laissé passer : le rang est nommé, la responsabilité est prise |
 * | tout le reste de `redis-cli` | laissé passer — lire ne détruit rien |
 *
 * **Il ne ferme donc aucune porte** : ce qu'il propose à la place fait
 * exactement le même travail sur SON atelier. C'est le principe de
 * `garde-travail-non-enregistre.mjs` — un garde-fou qui parle à tort s'apprend
 * à être ignoré, et l'on perd la protection sans s'en apercevoir
 * (`CLAUDE.md` §1 bis).
 *
 * ─── Le contrat du déclencheur ─────────────────────────────────────────────
 *
 * Reçoit sur l'entrée standard le JSON de `PreToolUse` (`tool_name`,
 * `tool_input`) et répond sur la sortie standard. `permissionDecision: "deny"`
 * refuse l'appel ; ne rien écrire le laisse passer.
 *
 * `scripts/test-garde-redis-des-autres.ts` lui montre autant de commandes à
 * laisser passer qu'à refuser, et il a été vu faire les deux.
 * ───────────────────────────────────────────────────────────────────────────
 */

/**
 * Le geste destructeur, s'il y en a un dans cette ligne de commande.
 *
 * **On lit la commande ENTIÈRE, pas seulement son début** : un `FLUSHALL` caché
 * derrière un `&&`, un `;` ou un tube détruirait tout autant. D'où la recherche
 * sur tout le texte plutôt qu'une analyse du premier mot.
 *
 * **Et l'on n'exige pas `redis-cli` juste devant** : `redis-cli -u … FLUSHALL`
 * et `redis-cli FLUSHALL` doivent être vus tous les deux. Ce qui compte, c'est
 * qu'un `redis-cli` et un verbe de vidage soient dans la même commande.
 */
export function gesteQuiVideRedis(commande) {
  if (typeof commande !== "string" || commande.trim() === "") return null;

  // **LE CORPS D'UN HEREDOC EST DU TEXTE, PAS DES COMMANDES.** Trouvé en
  // situation, à la minute où ce garde-fou a été branché : il a refusé le
  // message de commit qui le décrivait. Un message multiligne passe par
  // `<<'FIN' … FIN`, et les apostrophes du français y déséquilibrent le retrait
  // des citations ci-dessous — « qu'écrire » ouvre une citation que rien ne
  // referme, et le verbe du texte se retrouve alors à découvert. On enlève donc
  // le corps AVANT tout le reste.
  //
  // **Sa suite ne pouvait pas le voir** : elle n'éprouvait que des commandes
  // d'une seule ligne. C'est l'usage réel qui l'a montré, et le cas y est entré.
  const sansHeredoc = commande.replace(
    /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?^\s*\2\s*$/gm,
    " "
  );

  // **Ce qui est ENTRE GUILLEMETS est du texte, pas un geste.** Sans cela,
  // `git commit -m 'ne jamais faire redis-cli FLUSHALL'` était refusé — écrire
  // la règle devenait impossible. C'est le défaut exact qu'avait eu
  // `garde-travail-non-enregistre.mjs`, attrapé là aussi par sa suite avant
  // d'avoir gêné personne. On remplace par un blanc plutôt que de supprimer :
  // deux mots collés par le retrait formeraient un verbe qui n'a pas été tapé.
  const horsCitations = sansHeredoc.replace(/'[^']*'|"[^"]*"/g, " ");

  // Chaque commande de la ligne, prise séparément : sans cela, un `redis-cli
  // GET x && psql -c "FLUSHALL"` serait refusé à tort.
  const morceaux = horsCitations.split(/&&|\|\||[;|\n]/);

  for (const morceau of morceaux) {
    if (!/\bredis-cli\b/i.test(morceau)) continue;

    if (/\bFLUSHALL\b/i.test(morceau)) {
      return { verbe: "FLUSHALL", morceau: morceau.trim() };
    }
    if (/\bFLUSHDB\b/i.test(morceau)) {
      // `-n <rang>` nomme la base : la responsabilité est prise, on laisse.
      // `--dbnum` n'existe pas dans redis-cli ; seul `-n` compte.
      if (/(^|\s)-n\s+\d+/.test(morceau)) continue;
      return { verbe: "FLUSHDB sans -n", morceau: morceau.trim() };
    }
  }
  return null;
}

export function phraseDuRefus(quoi) {
  return [
    `**Refusé : \`${quoi.verbe}\` vide le Redis des AUTRES sessions.**`,
    "",
    `   ${quoi.morceau}`,
    "",
    "Redis tient seize bases numérotées, **une par atelier** — c'est ce qui permet",
    "à plusieurs batteries de tourner en même temps. Les vider toutes efface le",
    "compteur de connexions des voisines : elles rougissent alors vingt fois sur",
    "« dépassement de délai après la connexion », et aucun message ne dit pourquoi.",
    "",
    "**Ce qui fait la même chose, sur VOTRE atelier seulement :**",
    "",
    "   redis-cli -n <rang> FLUSHDB",
    "",
    "Le rang ne se devine pas : la batterie l'annonce (« Atelier n° 2 — port 3002 »),",
    "et le rang 0 est le port 3000.",
  ].join("\n");
}

function principal() {
  let entree = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (bloc) => (entree += bloc));
  process.stdin.on("end", () => {
    let donnees;
    try {
      donnees = JSON.parse(entree || "{}");
    } catch {
      // **Devant le moindre doute, se taire.** Un déclencheur qui refuse sur une
      // entrée qu'il n'a pas comprise bloque le travail sans rien protéger.
      process.exit(0);
    }

    const quoi = gesteQuiVideRedis(donnees?.tool_input?.command);
    if (!quoi) process.exit(0);

    const message = phraseDuRefus(quoi);
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: message,
        },
        systemMessage: message,
      })
    );
    process.exit(0);
  });
}

// Le fichier sert aussi de bibliothèque à sa suite : on ne lit l'entrée
// standard que lorsqu'il est lancé comme déclencheur.
if (process.argv[1] && process.argv[1].endsWith("garde-redis-des-autres.mjs")) {
  principal();
}
