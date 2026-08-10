// « Ça ne marche pas » — dire QUI ment, en une commande.
//
// **Pourquoi ce script existe.** Le 10 août 2026, le patron ouvre l'adresse de
// son banc depuis son téléphone : Safari affiche `about:blank` et lui propose
// de TÉLÉCHARGER un fichier. Pas une page blanche — un téléchargement. J'ai
// alors reproduit l'application chez moi : elle répond `307 → /login`, puis
// `200 text/html`, y compris avec les en-têtes du mandataire de GitHub. Donc
// l'application n'était pas en cause, et je ne pouvais pas aller plus loin :
// le réseau de l'agent refuse `*.app.github.dev` (`AGENTS.md`).
//
// Ce qui manquait n'était pas une idée, c'était UN FAIT : la réponse exacte que
// reçoit son téléphone. Ce script va la chercher **depuis l'intérieur de
// l'espace de travail**, seul endroit d'où l'adresse publique est joignable, et
// il en tire un verdict en français.
//
// Il ne modifie rien. On peut le lancer sur un banc en panne.
//
//     npm run diagnostiquer:banc

const PORT = process.env.PORT ?? "3000";
const LOCAL = `http://127.0.0.1:${PORT}`;

/** L'adresse publique de l'espace, quand on y est. */
function adressePublique() {
  const nom = process.env.CODESPACE_NAME;
  if (!nom) return null;
  const domaine = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev";
  return `https://${nom}-${PORT}.${domaine}`;
}

/**
 * Une requête, et ce qu'elle rapporte VRAIMENT.
 *
 * `redirect: "follow"` à dessein : c'est ce que fait un navigateur, et le
 * défaut cherché est précisément dans la réponse FINALE — un `307` n'a pas de
 * type de contenu, et s'arrêter là ne prouverait rien.
 */
async function interroger(url) {
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
      // Ce que Safari annonce. Un serveur peut répondre autre chose à `*/*`
      // qu'à une vraie demande de page : interroger avec l'en-tête du
      // navigateur, sinon on éprouve un cas que personne ne vit.
      headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
    const type = r.headers.get("content-type") ?? "";
    const disposition = r.headers.get("content-disposition") ?? "";
    const debut = (await r.text()).slice(0, 400);
    return { ok: true, statut: r.status, url: r.url, type, disposition, debut };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : String(e) };
  }
}

function ligne(quoi, r) {
  if (!r.ok) return `  ${quoi} : injoignable — ${r.erreur}`;
  return (
    `  ${quoi} : ${r.statut} · ${r.type || "AUCUN TYPE DE CONTENU"}` +
    (r.disposition ? ` · content-disposition: ${r.disposition}` : "") +
    `\n      arrivé sur ${r.url}`
  );
}

/** Le navigateur télécharge au lieu d'afficher : voilà les deux causes. */
function seraTelecharge(r) {
  if (!r.ok) return false;
  if (/attachment/i.test(r.disposition)) return true;
  return !/text\/html|application\/xhtml/i.test(r.type);
}

/** Le mandataire de GitHub a répondu à la place de l'application. */
function reponseDeGitHub(r) {
  if (!r.ok) return false;
  return /github\.com|Sign in to GitHub|githubusercontent/i.test(r.debut) ||
    /^https:\/\/github\.com/.test(r.url);
}

console.log("\n  ─── Diagnostic du banc d'essai ───────────────────────────────\n");

const local = await interroger(LOCAL + "/");
const sante = await interroger(LOCAL + "/api/health/live");
console.log(ligne("Application, vue de l'intérieur ", local));
console.log(ligne("Route de santé                 ", sante));

const publique = adressePublique();
let dehors = null;
if (publique) {
  dehors = await interroger(publique + "/");
  console.log(ligne("Adresse publique               ", dehors));
} else {
  console.log("  Adresse publique                : sans objet — hors espace de travail.");
}

console.log("\n  ─── Verdict ──────────────────────────────────────────────────\n");

if (!local.ok) {
  console.log(
    "  L'APPLICATION NE RÉPOND PAS, même de l'intérieur.\n" +
      "  Ce n'est ni le réseau ni le téléphone : le serveur est mort ou en\n" +
      "  train de compiler. Regardez /tmp/essai.log, puis relancez\n" +
      "  `bash .devcontainer/demarrer.sh`.\n"
  );
  process.exit(1);
}

if (seraTelecharge(local)) {
  console.log(
    "  L'APPLICATION ELLE-MÊME renvoie autre chose qu'une page.\n" +
      `  Type reçu : « ${local.type || "aucun"} ». Un navigateur ne peut pas\n` +
      "  l'afficher : il propose de le télécharger. Le défaut est dans le code,\n" +
      "  pas dans le relais de GitHub.\n"
  );
  process.exit(1);
}

console.log(`  L'application est SAINE de l'intérieur (${local.statut}, ${local.type}).`);

if (!publique) {
  console.log("  Rien d'autre à contrôler hors d'un espace de travail.\n");
  process.exit(0);
}

if (!dehors.ok) {
  console.log(
    "\n  MAIS SON ADRESSE PUBLIQUE NE RÉPOND PAS.\n" +
      "  Le port 3000 n'est probablement pas ouvert. Une commande :\n" +
      "    gh codespace ports visibility 3000:public -c $CODESPACE_NAME\n"
  );
  process.exit(1);
}

if (reponseDeGitHub(dehors)) {
  console.log(
    "\n  MAIS C'EST GITHUB QUI RÉPOND, pas Atlas.\n" +
      "  Le port est PRIVÉ : depuis un téléphone non connecté à GitHub, il n'y\n" +
      "  a rien à voir. Une commande :\n" +
      "    gh codespace ports visibility 3000:public -c $CODESPACE_NAME\n"
  );
  process.exit(1);
}

// **Une erreur n'est pas un type de contenu abîmé.** Sans cette distinction, un
// 403 ou un 502 du relais tombait dans la branche suivante et accusait le
// protocole du port — le mauvais coupable, ce que le dépôt interdit.
if (dehors.statut >= 400) {
  console.log(
    `\n  MAIS SON ADRESSE PUBLIQUE RENVOIE UNE ERREUR ${dehors.statut}.\n` +
      "  Ce n'est donc pas l'application : elle répond bien, juste au-dessus.\n" +
      "  Ce que le relais a répondu, mot pour mot :\n\n" +
      "    " + (dehors.debut.replace(/\s+/g, " ").trim().slice(0, 180) || "(rien)") + "\n\n" +
      "  Si c'est 401 ou 403, le port n'est pas ouvert :\n" +
      "    gh codespace ports visibility 3000:public -c $CODESPACE_NAME\n"
  );
  process.exit(1);
}

if (seraTelecharge(dehors)) {
  console.log(
    "\n  MAIS LE RELAIS DE GITHUB ABÎME LA RÉPONSE.\n" +
      `  Type reçu de l'extérieur : « ${dehors.type || "aucun"} » là où\n` +
      `  l'application envoie « ${local.type} ». C'est ce qui fait proposer un\n` +
      "  TÉLÉCHARGEMENT au lieu d'afficher la page.\n\n" +
      "  Cause connue : le protocole du port est réglé sur HTTPS alors que\n" +
      "  l'application parle en HTTP. À remettre sur HTTP :\n" +
      "    gh codespace ports visibility 3000:public -c $CODESPACE_NAME\n" +
      "  puis, dans l'onglet Ports de l'éditeur, « Change Port Protocol » → HTTP.\n"
  );
  process.exit(1);
}

console.log(
  `  ET SON ADRESSE PUBLIQUE AUSSI (${dehors.statut}, ${dehors.type}).\n\n` +
    "  Tout est en ordre de ce côté. Si le téléphone ne montre toujours rien,\n" +
    "  c'est son cache : ouvrez l'adresse dans un onglet de navigation privée.\n"
);
