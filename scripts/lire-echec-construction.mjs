// **Ce que le témoin d'échec sait dire, et que personne ne lisait.**
//
// ─────────────────────────────────────────────────────────────────────────────
// **Sa soirée du 29 août 2026.** Son écran affichait, en rouge :
//
//     La dernière construction a échoué ; elle est retentée toute seule,
//     mais cela peut prendre une demi-heure.
//
// C'était vrai, et c'était **inutile** : rien ne disait POURQUOI. Or la cause
// était un manque de mémoire, et le relevé était déjà écrit dans le témoin, à
// deux lignes de la date qu'on lisait. `diagnostiquer-espace.mjs` n'en extrayait
// que `quand`, et jetait le reste.
//
// Deux heures ont été passées à chercher un défaut de construction qui
// n'existait pas — vérifié depuis sur son commit exact (`575aad7`) avec les
// variables de son `docker-compose` : `EXIT=0`, compilée en 30,6 s.
//
// ─────────────────────────────────────────────────────────────────────────────
// **Et le témoin lui-même mentait à moitié.** `banc.mjs` écrivait
// `code: ${code}` en repliant `null` sur `1`. Or Node passe `code = null` quand
// un enfant est **abattu par un signal**, le nom du signal arrivant en second
// argument — jeté. Une construction tuée par le noyau faute de mémoire
// s'écrivait donc `code: 1`, **exactement comme une erreur de compilation** :
// les deux cas les plus opposés portaient le même chiffre.
//
// Le signal est désormais consigné. Ce module le relit.

/** Ce que le noyau envoie quand la mémoire manque, et ce que le shell en fait. */
const ABATTAGE = new Set(["SIGKILL", "SIGABRT"]);

/**
 * Le témoin d'échec, relu en une phrase pour le patron.
 *
 * **Fonction pure** — elle reçoit le texte, jamais le fichier : c'est ce qui la
 * rend éprouvable sans banc, et les vrais pièges sont dans le texte (un témoin
 * d'une version antérieure, sans ligne `signal`, doit rester lisible).
 *
 * @param {string | null} brut Contenu du témoin, ou `null` s'il n'existe pas.
 * @returns {{ echoue: boolean, quand: string, cause: string | null, memoire: string | null }}
 *   `cause` vaut `null` quand on ne sait pas : **on ne devine pas un coupable.**
 *   Une cause inventée envoie chercher au mauvais endroit, ce qui coûte plus
 *   cher que pas de cause du tout (`CLAUDE.md` §5).
 */
export function lireEchecConstruction(brut) {
  if (typeof brut !== "string" || brut.trim() === "") {
    return { echoue: false, quand: "?", cause: null, memoire: null };
  }

  const champ = (nom) => (brut.match(new RegExp(`^${nom}: (.+)$`, "m")) ?? [])[1]?.trim() ?? null;

  const quand = champ("quand") ?? "?";
  const signal = champ("signal");
  const code = champ("code");
  const memoire = champ("memoire");

  // **Le signal d'abord, le code ensuite.** Un abattage porte `code: 1` depuis
  // que Node replie `null` — s'en remettre au code seul confondrait pour
  // toujours le manque de mémoire et l'erreur de compilation.
  let cause = null;
  if (signal && ABATTAGE.has(signal)) {
    cause = "abattue par le système, faute de mémoire";
  } else if (signal && signal !== "aucun") {
    cause = `interrompue par le système (${signal})`;
  } else if (code === "137") {
    // Un banc plus ancien, ou une construction tuée à travers un shell qui
    // traduit le signal en 128 + 9. Le témoin d'avant le 29 août 2026 n'a pas
    // de ligne `signal` : ce cas le rattrape.
    cause = "abattue par le système, faute de mémoire";
  }

  return { echoue: true, quand, cause, memoire };
}

/**
 * La ligne « Code SERVI » quand la construction a échoué.
 *
 * Écrite pour lui, pas pour nous : ce qui s'est passé, **et ce qu'il doit en
 * faire**. Une réserve sans suite se relit sans agir — c'est ce qui a rendu son
 * écran du 29 août inutile.
 *
 * @param {ReturnType<typeof lireEchecConstruction>} echec
 */
export function phraseEchec(echec) {
  const debut = `AUCUNE — la construction a ÉCHOUÉ (${echec.quand}).`;

  if (echec.cause?.startsWith("abattue")) {
    // **Ni gras Markdown, ni redondance — vu en regardant l'écran.**
    //
    // La première version écrivait `**Rallumer l'espace de travail**`. Or cette
    // sortie est publiée dans un bloc de code sur la fiche GitHub, où le
    // Markdown n'est PAS interprété : il aurait lu les astérisques. Les
    // majuscules, elles, marchent aux deux endroits — et c'est déjà ce que fait
    // le reste de la fiche (« AUCUNE », « LENT »).
    //
    // Elle disait aussi deux fois la même chose : « abattue faute de mémoire :
    // votre espace n'a pas assez de mémoire ». Une phrase de plus est une
    // phrase de trop (`CLAUDE.md` §3).
    return (
      `AUCUNE — la construction a ÉCHOUÉ (${echec.quand}), faute de mémoire : le système l'a abattue.` +
      "\n     RALLUMEZ L'ESPACE DE TRAVAIL : il repart d'une mémoire libre, et c'est ce qui répare." +
      "\n     Sans cela le banc reste lent, et chaque tentative retombera pareil." +
      (echec.memoire ? `\n     Mémoire à l'instant de l'échec : ${echec.memoire}` : "")
    );
  }

  if (echec.cause) {
    return `${debut} Elle a été ${echec.cause}. Le banc compile chaque écran à l'ouverture : il est LENT en attendant, et le veilleur retente.`;
  }

  // **Aucune cause reconnue : on ne l'invente pas.** On rend la phrase d'avant,
  // qui reste vraie — et la ligne `dit:` du témoin porte le message de la
  // construction pour qui va le lire.
  return `${debut} Le banc compile chaque écran à l'ouverture : il est LENT en attendant, et le veilleur retente.`;
}
