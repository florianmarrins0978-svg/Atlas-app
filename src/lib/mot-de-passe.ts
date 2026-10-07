/**
 * Ce qui fait qu'un nouveau mot de passe est acceptable.
 *
 * *Dessiné le 14 août 2026 (`maquettes/atlas-reglages-moi.html`, écran 3), codé
 * le même jour après sa réponse : « il faut pouvoir confirmer son mdp 2× avant
 * de le changer et met le petit œil à côté pour afficher ou non le mdp ».*
 *
 * **Fonction pure, et c'est ce qui empêche les deux écarts habituels.** La même
 * fonction décide si le bouton s'allume ET si l'action serveur accepte
 * (`CLAUDE.md` §3). Deux implémentations divergent toujours, et ici la
 * divergence se paierait dans le mauvais sens : un bouton allumé sur une saisie
 * que le serveur refuse, ou l'inverse — un artisan qui croit son mot de passe
 * changé alors qu'il ne l'est pas.
 *
 * **Ce que cette règle NE fait pas, délibérément :** aucune exigence de
 * majuscule, de chiffre ou de caractère spécial. Elles ne rendent pas un mot de
 * passe plus sûr qu'une phrase longue, et sur un chantier elles produisent des
 * mots de passe notés sur un carnet. Une longueur, et c'est tout.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **De huit à douze caractères, le 23 août 2026.** L'audit de sécurité (constat
 * C1) a montré que rien n'empêchait réellement de deviner un mot de passe :
 * 28 800 essais par jour et par compte, et aucune limite du tout les jours où
 * Redis tombait. Ce lot ferme les deux (`src/lib/tentatives-connexion.ts`), et
 * allonge la barre — les trois vont ensemble, aucune ne suffit seule.
 *
 * **Le principe reste le sien** : une longueur, jamais une grammaire. Douze
 * caractères, c'est trois mots courts collés — pas un code à retenir.
 *
 * **CE QUE CETTE RÈGLE NE TOUCHE PAS, et c'est essentiel :** la vérification
 * d'un mot de passe existant. Elle ne s'applique qu'à la CRÉATION et au
 * CHANGEMENT. Un compte dont le mot de passe fait huit caractères continue
 * d'ouvrir normalement — durcir la barre ne doit jamais mettre dehors quelqu'un
 * qui n'a rien demandé. La comparaison bcrypt de `src/auth.ts` est intacte.
 */

/** Douze caractères : ce que l'écran annonce, et ce que le serveur exige. */
export const LONGUEUR_MINIMALE = 12;

export type RefusMotDePasse =
  /** Plus court que `LONGUEUR_MINIMALE`. */
  | "trop-court"
  /** Assez long, mais fait de ce qu'un attaquant essaie en premier. */
  | "trop-courant"
  /** Assez long, mais fait du nom ou de l'adresse du compte. */
  | "trop-personnel"
  /** La confirmation ne redit pas la même chose. */
  | "confirmation-differente"
  /** Le nouveau est l'ancien : le geste n'aurait rien fait. */
  | "sans-changement"
  /** L'ancien mot de passe n'est pas celui du compte. */
  | "actuel-faux";

/**
 * Ce qui bloque, ou `null` si rien ne bloque.
 *
 * **L'ordre des contrôles est celui de la saisie**, et il n'est pas
 * indifférent : signaler « la confirmation diffère » alors que le mot de passe
 * fait trois caractères envoie corriger la mauvaise ligne. On dit d'abord ce
 * qui manque là où le doigt se trouve.
 */
export function verifierNouveauMotDePasse(
  nouveau: string,
  confirmation: string,
  personnel: Personnel,
  actuel?: string
): RefusMotDePasse | null {
  if (nouveau.length < LONGUEUR_MINIMALE) return "trop-court";
  const faiblesse = faiblesseDe(nouveau, personnel);
  if (faiblesse) return faiblesse;
  if (actuel !== undefined && actuel !== "" && nouveau === actuel) return "sans-changement";
  // La confirmation se compare TELLE QUELLE, espaces compris : un mot de passe
  // qui commence par une espace est un mot de passe valable, et le rogner ici
  // enregistrerait autre chose que ce qu'il a tapé.
  if (confirmation !== nouveau) return "confirmation-differente";
  return null;
}

/** Ce que l'artisan lit. Une phrase, pas un code. */
export function messageRefus(refus: RefusMotDePasse): string {
  switch (refus) {
    case "trop-court":
      return `Il faut au moins ${LONGUEUR_MINIMALE} caractères.`;
    case "trop-courant":
      return "Ce mot de passe est trop courant.";
    case "trop-personnel":
      return "Ce mot de passe reprend votre nom ou votre adresse.";
    case "confirmation-differente":
      return "Les deux saisies ne sont pas identiques.";
    case "sans-changement":
      return "C'est déjà votre mot de passe actuel.";
    case "actuel-faux":
      // **Ne dit PAS « mot de passe incorrect » tout court.** Sur cet écran il y
      // a trois champs : la phrase doit désigner LEQUEL, sans quoi il retape le
      // nouveau (`AGENTS.md` — une erreur qui accuse à tort coûte plus cher que
      // pas d'erreur du tout).
      return "Votre mot de passe actuel n'est pas celui-là.";
  }
}

/**
 * Ce que la ligne sous le NOUVEAU mot de passe dit, pendant la frappe.
 *
 * **Née du 31 août 2026, quand il a fait retirer les phrases grises.** Une
 * ligne annonçait en permanence « Au moins 12 caractères. » sous le champ. Elle
 * est partie avec les autres — mais la retirer SANS RIEN METTRE À LA PLACE
 * aurait laissé un bouton éteint sans raison lisible : on tape huit caractères,
 * la confirmation dit « les deux sont identiques ✓ », et rien ne bouge.
 *
 * La règle se dit donc au moment où elle mord, et à ce moment-là seulement.
 * `null` tant que le champ est vide : une exigence affichée avant la première
 * touche est exactement la phrase qu'il a fait retirer.
 */
export function etatNouveau(nouveau: string, personnel: Personnel): { message: string } | null {
  if (nouveau === "") return null;
  if (nouveau.length < LONGUEUR_MINIMALE) return { message: messageRefus("trop-court") };
  // Sans cette ligne, le bouton resterait éteint sur « 123456789012 » sans
  // qu'aucune phrase ne dise pourquoi : la même faute que celle du 31 août.
  const faiblesse = faiblesseDe(nouveau, personnel);
  return faiblesse ? { message: messageRefus(faiblesse) } : null;
}

/**
 * Ce que la ligne sous la confirmation dit, pendant la frappe.
 *
 * `null` tant qu'il n'a rien écrit dans la confirmation : lui annoncer que les
 * deux diffèrent alors qu'il n'a pas commencé à retaper serait une alarme qui
 * hurle à vide, et c'est ainsi qu'on apprend à ne plus les lire.
 */
export function etatConfirmation(
  nouveau: string,
  confirmation: string
): { identiques: boolean; message: string } | null {
  if (confirmation === "") return null;
  return confirmation === nouveau
    ? { identiques: true, message: "Les deux sont identiques ✓" }
    : { identiques: false, message: "Les deux saisies ne sont pas identiques." };
}

// ─── Ce qu'un attaquant essaie en premier ────────────────────────────────────
//
// **Sa question du 29 septembre 2026** : exiger une majuscule et un caractère
// spécial. Refusé, et la raison est dans l'en-tête : « Motdepasse1! » respecte
// cette grammaire, et c'est l'un des premiers essais de n'importe quel outil
// d'attaque. Ce qui manquait vraiment, c'est l'inverse : douze caractères
// laissaient passer « 123456789012 » et « motdepasse12 ».
//
// **Le principe : un mot de passe se découpe en morceaux** (lettres, chiffres,
// le reste), et il est refusé quand AUCUN morceau n'apporte rien : un mot de la
// liste, une suite du clavier ou de l'alphabet, une répétition, une année. Une
// liste brute de mots de passe fuités ne verrait pas « Motdepasse2026!! » ; le
// découpage le voit, et il accepte « chantier vert pelouse » parce que deux de
// ses mots n'apportent pas rien.
//
// **Le nom et l'adresse du compte, depuis le même jour** : « marrins2026! » ne
// contient aucun mot de la liste, et c'est pourtant le premier essai de qui a
// lu un devis. `personnel` est OBLIGATOIRE, et c'est délibéré : sept endroits
// appellent cette règle, et un paramètre facultatif se serait oublié en
// silence dans l'un d'eux. L'écran et le serveur d'un même geste doivent
// donner la MÊME liste, sans quoi le bouton s'allume sur ce que le serveur
// refuse.
//
// **Ce que ce contrôle NE fait PAS** : il ne connaît pas les fuites publiques
// (il faudrait un service extérieur). Il ne s'applique, comme la longueur,
// qu'à la création et au changement.

/**
 * Ce que l'on sait de la personne : prénom, nom, adresse. Une case vide ou
 * absente est permise, elle n'apporte simplement rien à refuser.
 */
export type Personnel = readonly (string | null | undefined)[];

/**
 * Les racines qu'on retrouve en tête de toutes les listes de mots de passe
 * fuités, en France d'abord. Écrites sans accent ni majuscule : la
 * comparaison se fait après les avoir retirés.
 */
const RACINES_COURANTES = new Set([
  "motdepasse", "motdepass", "mdp", "password", "passwd", "passe", "pass",
  "azerty", "qwerty", "qwertz", "azertyuiop", "qwertyuiop",
  "admin", "administrateur", "root", "user", "utilisateur", "login", "test",
  "bonjour", "bonsoir", "salut", "coucou", "hello", "welcome", "bienvenue",
  "soleil", "loulou", "doudou", "chouchou", "cheri", "cherie", "amour",
  "jetaime", "iloveyou", "love", "princesse", "chocolat", "nicolas", "julien",
  "marseille", "paris", "lyon", "toulouse", "france", "psg", "om", "olympique",
  "football", "foot", "monkey", "dragon", "master", "sunshine", "shadow",
  "superman", "batman", "pokemon", "starwars", "secret", "letmein", "abc",
  "atlas", "jardin", "jardinier", "paysage", "paysagiste", "chantier",
  "entreprise", "societe", "google", "apple", "facebook", "orange", "free",
]);

/**
 * Les suites qu'on tape sans réfléchir, écrites deux fois pour qu'un morceau
 * qui « fait le tour » (« 890123 ») s'y trouve encore.
 */
const SUITES = [
  "0123456789", "abcdefghijklmnopqrstuvwxyz",
  "azertyuiopqsdfghjklmwxcvbn", "qwertyuiopasdfghjklzxcvbnm",
  "azertyuiop", "qsdfghjklm", "wxcvbn", "asdfghjkl", "zxcvbnm",
  "aqwzsxedcrfvtgbyhnujikolpm", "&é\"'(-è_çà",
].flatMap((suite) => {
  const tour = suite + suite;
  return [tour, [...tour].reverse().join("")];
});

/** Les chiffres qui déguisent une lettre, quand ils sont pris entre deux. */
const CHIFFRES_DEGUISES: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s",
};

function estUneRepetition(morceau: string): boolean {
  for (let pas = 1; pas <= morceau.length / 2; pas++) {
    if (morceau.length % pas !== 0) continue;
    if (morceau.slice(0, pas).repeat(morceau.length / pas) === morceau) return true;
  }
  return false;
}

function dansUneSuite(morceau: string): boolean {
  return SUITES.some((suite) => suite.includes(morceau));
}

/**
 * Vrai quand le morceau se découpe tout entier en mots connus : « marrinsflorian »
 * est fait de deux mots du compte, « azertymotdepasse » de deux racines. Un mot
 * honnête ne se découpe presque jamais ainsi jusqu'à sa dernière lettre.
 */
function faitDeMotsConnus(morceau: string, connus: ReadonlySet<string>): boolean {
  const atteint = [true, ...Array<boolean>(morceau.length).fill(false)];
  for (let fin = 1; fin <= morceau.length; fin++) {
    for (let debut = 0; debut < fin && !atteint[fin]; debut++) {
      if (!atteint[debut]) continue;
      const mot = morceau.slice(debut, fin);
      atteint[fin] = connus.has(mot) || (mot.length >= 3 && dansUneSuite(mot));
    }
  }
  return atteint[morceau.length];
}

function morceauSansApport(morceau: string, connus: ReadonlySet<string>): boolean {
  if (/^[^a-z0-9]+$/.test(morceau)) return true; // des signes seuls
  if (/^[0-9]{1,4}$/.test(morceau)) return true; // une année, un « 12 »
  if (connus.has(morceau)) return true;
  if (estUneRepetition(morceau)) return true;
  if (dansUneSuite(morceau)) return true;
  return /^[a-z]+$/.test(morceau) && faitDeMotsConnus(morceau, connus);
}

/** Sans accent ni majuscule, « p4ssw0rd » redevenu « password ». */
function ramener(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // « p4ssw0rd » : un chiffre pris entre deux lettres redevient la lettre
    // qu'il déguise, sinon le découpage le couperait en cinq morceaux.
    .replace(/(?<=[a-z])[0134578@$](?=[a-z])/g, (c) => CHIFFRES_DEGUISES[c]);
}

/**
 * Les mots du compte : « florian.marrins85@gmail.com » donne florian, marrins,
 * 85 (trop court, déjà sans apport), gmail, com. Moins de trois lettres, un
 * mot n'est pas retenu : « Le » ou « Ba » refuseraient des phrases honnêtes.
 */
function motsDuCompte(personnel: Personnel): Set<string> {
  const mots = new Set<string>();
  for (const valeur of personnel) {
    for (const mot of ramener(valeur ?? "").match(/[a-z]+|[0-9]+/g) ?? []) {
      if (mot.length >= 3) mots.add(mot);
    }
  }
  return mots;
}

function sansApport(ramene: string, connus: ReadonlySet<string>): boolean {
  if (new Set(ramene).size < 4) return true;
  if (estUneRepetition(ramene)) return true;
  if (dansUneSuite(ramene)) return true;
  const morceaux = ramene.match(/[a-z]+|[0-9]+|[^a-z0-9]+/g) ?? [];
  return morceaux.every((morceau) => morceauSansApport(morceau, connus));
}

/**
 * Ce qui rend le mot de passe trop facile à deviner, ou `null`.
 *
 * **« Trop courant » se juge d'abord, sans le compte** : « motdepasse12 » est
 * faible pour tout le monde, et la phrase doit le dire ainsi plutôt que de
 * parler d'un nom qu'il ne contient pas.
 */
function faiblesseDe(motDePasse: string, personnel: Personnel): "trop-courant" | "trop-personnel" | null {
  const ramene = ramener(motDePasse);
  if (sansApport(ramene, RACINES_COURANTES)) return "trop-courant";
  const connus = new Set([...RACINES_COURANTES, ...motsDuCompte(personnel)]);
  return sansApport(ramene, connus) ? "trop-personnel" : null;
}
