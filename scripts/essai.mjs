import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { ETAT_PRECHAUFFAGE } from "./prechauffer.mjs";
import { annoncePrete, adressePubliquePossible } from "./annonce-adresse.mjs";
import { prendreVerrouBanc, libererVerrouBanc } from "./verrou-banc.mjs";
import { avertissementAtelier } from "./annonce-atelier.mjs";

// Démarre l'application pour les essais, attend qu'elle réponde vraiment, puis
// affiche l'adresse à ouvrir.
//
// Pourquoi ne pas se contenter de `next dev` : le message « ready » de Next.js
// arrive AVANT que le premier écran soit compilable. Celui qui ouvre l'adresse
// à cet instant obtient une page blanche, sans rien qui explique pourquoi — et
// conclut que l'application est cassée. C'est arrivé.
//
// Ce script attend donc une vraie réponse HTTP, et dit ensuite quoi ouvrir.

const PORT = process.env.PORT ?? "3000";
const SANTE = `http://127.0.0.1:${PORT}/api/health/live`;

function attendre(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function repond() {
  try {
    const r = await fetch(SANTE, { signal: AbortSignal.timeout(5000) });
    return r.status === 200;
  } catch {
    return false;
  }
}

// **Jamais deux serveurs pour un seul port.**
//
// Le 9 août 2026, le patron a lu « HTTP ERROR 404 » : plus rien n'écoutait. Son
// terminal montrait l'invite revenue après `npm run essai`, c'est-à-dire un
// serveur mort — pas un serveur lent. Le mécanisme : l'espace démarre le
// serveur tout seul (`.devcontainer/demarrer.sh`), il en a lancé un second à la
// main, et le `pkill -f "[n]ext dev"` que fait le démarrage à chaque allumage
// en a tué un des deux. Celui qui restait n'était pas forcément celui que le
// mandataire de GitHub avait publié.
//
// Une commande tapée par erreur ne doit pas pouvoir éteindre l'application. Si
// quelqu'un répond déjà sur ce port, on le dit et on s'arrête.
if (await repond()) {
  const dejaLa = adressePubliquePossible(PORT);
  console.log(
    "\n  ─────────────────────────────────────────────────────────────\n" +
      "   Atlas tourne déjà — rien à relancer.\n\n" +
      (dejaLa ? `     ${dejaLa}\n` : `     http://localhost:${PORT}\n`) +
      "\n   (L'espace de travail le démarre tout seul à chaque allumage.)\n" +
      "  ─────────────────────────────────────────────────────────────\n"
  );
  process.exit(0);
}

// **UN SEUL BANC À LA FOIS — et répondre ne suffit pas à le savoir.**
//
// Constaté chez le patron le 10 août 2026, au soir : il a tapé `npm run essai`
// pendant que l'espace de travail construisait déjà le sien. Le garde ci-dessus
// ne l'a pas arrêté — **pendant sa construction, un banc ne répond pas encore**
// — un second serveur est parti, a trouvé le port pris, et est mort sur
// « EADDRINUSE ». Le message affiché accusait alors la base de données, qui
// n'y était pour rien : une erreur qui désigne le mauvais coupable coûte plus
// cher que pas d'erreur du tout (`AGENTS.md`).
//
// `banc.mjs` prend ce verrou depuis le même jour ; `essai.mjs` ne le prenait
// pas, et c'est par là que le patron est passé. Ce n'est pas le port qu'il faut
// regarder, c'est **l'existence d'un autre banc**.
const verrou = prendreVerrouBanc();
if (!verrou.pris) {
  console.log(
    "\n  ─────────────────────────────────────────────────────────────\n" +
      "   Atlas est DÉJÀ en train de démarrer — rien à relancer.\n\n" +
      "   L'espace de travail s'en charge tout seul à chaque allumage.\n" +
      "   Comptez deux à cinq minutes la première fois.\n\n" +
      "   Pour le suivre :   tail -f /tmp/essai.log\n" +
      "   Vous attendez la ligne « L'application répond ».\n\n" +
      "   (En lancer un second ferait échouer les deux sur le port " + PORT + " :\n" +
      "    c'est le « EADDRINUSE » du 10 août 2026.)\n" +
      "  ─────────────────────────────────────────────────────────────\n"
  );
  process.exit(0);
}
process.on("exit", () => libererVerrouBanc());

// **`npm run essai` est l'ATELIER, et sur un espace distant c'est un piège.**
//
// Le 10 août 2026, le patron a tapé cette commande dans son espace GitHub et
// regardé « toujours en compilation » pendant plus de trois minutes — sur
// `/api/health/live`, la route la plus petite du dépôt. Rien n'était cassé :
// `next dev` compile chaque écran au moment où on l'ouvre, et le disque d'un
// espace distant est lent (le journal l'écrit lui-même : « Slow filesystem
// detected »). Chaque écran suivant lui aurait coûté la même attente.
//
// C'est la troisième fois que la lenteur du mode développement lui coûte une
// soirée, et les deux premières ont produit `npm run banc` — qui bâtit une fois
// puis sert des écrans immédiats (`ARCHITECTURE.md` §45). Le dépôt le savait et
// ne le lui disait pas : une commande qui laisse prendre le mauvais chemin sans
// un mot vaut un défaut.
//
// On ne l'empêche pas — l'atelier reste l'outil du développement, et le
// rechargement à chaud n'existe que là. On le dit, c'est tout. Le texte vit dans
// `annonce-atelier.mjs` : enfoui ici, il n'aurait jamais été vu échouer.
const AVERTISSEMENT_ATELIER = avertissementAtelier();
if (AVERTISSEMENT_ATELIER) console.log(AVERTISSEMENT_ATELIER);

// **Sans dépendances installées, `npx` PROPOSE DE TÉLÉCHARGER Next.**
//
// Le patron, le 10 août 2026 : « Need to install the following packages:
// next@16.3.0 — Ok to proceed? ». La question n'a aucun rapport avec ce qu'il
// voulait faire, et accepter aurait fait tourner l'application sur une version
// que le dépôt n'a jamais éprouvée — il est figé sur 16.2.12. On refuse avant
// d'en arriver là, et on nomme le vrai coupable : les dépendances manquent.
const NEXT_LOCAL = "node_modules/next/dist/bin/next";
if (!existsSync(NEXT_LOCAL)) {
  console.error(`
  ─────────────────────────────────────────────────────────────
   Les dépendances ne sont pas installées.

   Ne laissez pas « npx » vous proposer de télécharger Next :
   il prendrait une autre version que celle du dépôt.

   Jouez d'abord, dans cet ordre :

     bash .devcontainer/preparer.sh    dépendances, base, données

   ou, si la base est déjà prête :

     npm ci

   puis relancez :

     npm run essai
  ─────────────────────────────────────────────────────────────
`);
  process.exit(1);
}

// `--no-install` en renfort : si le contrôle ci-dessus laissait passer un cas
// non prévu, npx échoue au lieu de POSER UNE QUESTION à laquelle personne
// n'attend d'avoir à répondre.
// Entrée coupée, sortie héritée — même raison que dans `banc.mjs` : quand son
// entrée est un vrai terminal, Next.js tente d'en prendre le contrôle
// (`setRawMode`), et cet appel échoue en `EIO` si le terminal disparaît sous
// lui. Le patron y a perdu une construction entière, sur une segmentation
// fault, après un « Compiled successfully ». Ctrl+C continue de fonctionner :
// il passe par le groupe de processus, jamais par l'entrée de l'enfant.
const serveur = spawn("npx", ["--no-install", "next", "dev", "-H", "0.0.0.0", "-p", PORT], {
  stdio: ["ignore", "inherit", "inherit"],
  env: process.env,
});

// **Ne pas mourir sur-le-champ quand le serveur s'arrête.** Sortir ici
// empêchait le diagnostic d'en bas d'être atteint : le script disparaissait
// avant d'avoir pu dire pourquoi. La sortie est retenue, traitée après, puis
// rendue telle quelle.
let sortieServeur = null;
let attentePassee = false;
serveur.on("exit", (code) => {
  sortieServeur = code ?? 0;
  if (attentePassee) process.exit(sortieServeur);
});

// Arrêter le script doit arrêter le serveur : sans cela il reste en écoute, et
// la tentative suivante échoue sur un port déjà pris — message qui n'a plus
// aucun rapport avec la cause.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    serveur.kill(signal);
    process.exit(0);
  });
}

// **DIX minutes, et non trois.** Le patron, le 10 août 2026, sur un espace de
// travail dont Next.js disait lui-même « Slow filesystem detected. The
// benchmark took 20605 ms » — deux cents fois la normale. Le serveur avait
// démarré en 486 ms et compilait encore quand le script a renoncé : il a lu
// « l'application n'a pas répondu » alors qu'elle était en train d'arriver.
//
// Abandonner trop tôt ne coûte pas une attente : ça fait croire à une panne.
// Réglable pour éprouver ce script, jamais pour l'usage courant.
const ATTENTE_MAX = Number(process.env.ATLAS_ATTENTE_MAX ?? 600) * 1000;
const DEBUT = Date.now();
const LIMITE = DEBUT + ATTENTE_MAX;
let pret = false;
let prochainSigne = DEBUT + 30_000;
while (Date.now() < LIMITE && sortieServeur === null) {
  if (await repond()) {
    pret = true;
    break;
  }
  // Un signe de vie toutes les trente secondes : sans lui, un écran figé
  // pendant dix minutes se lit comme un plantage, et on ferme le terminal —
  // ce qui tue le serveur au moment où il aboutit.
  if (Date.now() >= prochainSigne) {
    const secondes = Math.round((Date.now() - DEBUT) / 1000);
    console.log(`  … toujours en compilation (${secondes} s). Le premier écran d'un espace neuf est long.`);
    prochainSigne = Date.now() + 30_000;
  }
  await attendre(2000);
}

if (!pret) {
  // **NE PAS ACCUSER LA BASE DE DONNÉES PAR DÉFAUT.** La version précédente le
  // faisait, et elle a envoyé le patron chercher au mauvais endroit un jour où
  // le journal disait « disque lent » trois lignes plus haut. Une erreur qui
  // désigne le mauvais coupable coûte plus cher que pas d'erreur du tout
  // (AGENTS.md). On regarde si le serveur est ENCORE EN VIE : cela sépare les
  // deux cas sans rien supposer.
  const n = Math.max(1, Math.round(ATTENTE_MAX / 60_000));
  const duree = `${n} minute${n > 1 ? "s" : ""}`;
  if (sortieServeur === null) {
    console.error(
      `\n  ⚠️  L'application n'a pas encore répondu après ${duree},\n` +
        "     mais LE SERVEUR TOURNE TOUJOURS — il compile encore.\n\n" +
        "     Ne fermez pas ce terminal : le fermer tuerait le serveur au\n" +
        "     moment où il aboutit. Attendez, puis rechargez la page.\n\n" +
        "     Pour savoir sans deviner :\n" +
        `       curl -s -o /dev/null -w '%{http_code}\\n' ${SANTE}\n` +
        "     200 = c'est prêt.\n\n" +
        "     Si les lignes ci-dessus portent « Slow filesystem detected »,\n" +
        "     c'est le disque de cet espace de travail qui est lent — rien\n" +
        "     d'autre. Un espace neuf repart sur un disque neuf.\n"
    );
  } else {
    console.error(
      "\n  ⚠️  Le serveur s'est arrêté avant de répondre.\n" +
        "     Les lignes ci-dessus, émises par lui, disent pourquoi.\n" +
        "     Cause fréquente : la base de données n'est pas montée —\n" +
        "     relancer alors `bash .devcontainer/preparer.sh`.\n"
    );
  }
} else {
  console.log(annoncePrete({ port: PORT }));

  // **Compiler les écrans maintenant, plutôt que sous ses yeux.**
  //
  // `next dev` compile à la demande : le premier accès à un écran coûte trente
  // à cent secondes, et le mandataire de GitHub abandonne bien avant — d'où les
  // « HTTP ERROR 504 » du 9 août. On absorbe donc ce coût ici, pendant qu'il ne
  // regarde pas. Le raisonnement complet vit dans `prechauffer.mjs`.
  //
  // Rien de tout ceci ne doit pouvoir empêcher le serveur de servir : la
  // moindre difficulté est écrite et oubliée.
  try {
    const { cookieDeSession, ecransDeChantier, ECRANS_A_PRECHAUFFER, expliquerObstacle, prechauffer } =
      await import("./prechauffer.mjs");
    const base = `http://127.0.0.1:${PORT}`;
    let motifSansSession = null;
    const cookie = await cookieDeSession({
      databaseUrl: process.env.DATABASE_URL,
      authSecret: process.env.AUTH_SECRET,
      nodeEnv: process.env.NODE_ENV,
      ecrire: (raison) => {
        motifSansSession = raison;
      },
    });
    if (!cookie) {
      // **Dire la vraie raison, pas « pas de session ».** Voir `prechauffer.mjs` :
      // ce message a déjà accusé le mauvais coupable pendant que PostgreSQL
      // était arrêté et que l'application entière était morte.
      console.log(`  ⚠ ${motifSansSession ?? "préchauffage impossible, sans raison connue"}\n`);
      writeFileSync(
        ETAT_PRECHAUFFAGE,
        JSON.stringify({
          faits: 0,
          total: 0,
          reussis: 0,
          echoues: 0,
          termine: true,
          obstacle: motifSansSession,
          majAt: new Date().toISOString(),
        })
      );
    } else {
      const ecrans = [...ECRANS_A_PRECHAUFFER, ...(await ecransDeChantier({ base, cookie }))];
      console.log(`  Préchauffage de ${ecrans.length} écrans en cours — ils s'ouvriront ensuite du premier coup.\n`);
      // **L'avancement est déposé dans un fichier, pour que l'application
      // puisse le montrer au patron.** Il travaille au téléphone : lire un
      // terminal ne lui est pas offert, et le 9 août il a attendu trois minutes
      // sans aucun moyen de savoir si quelque chose avançait. Le fichier est lu
      // par `/api/health/banc`, qui s'ouvre sans se connecter.
      const noterAvancement = (etat) => {
        try {
          writeFileSync(
            ETAT_PRECHAUFFAGE,
            JSON.stringify({ ...etat, majAt: new Date().toISOString() })
          );
        } catch {
          // Un préchauffage qui ne peut pas écrire son état préchauffe quand même.
        }
      };
      const bilan = await prechauffer({
        base,
        cookie,
        ecrans,
        ecrire: (ligne) => console.log(`  · ${ligne}`),
        avancer: noterAvancement,
      });
      noterAvancement({
        faits: ecrans.length,
        total: ecrans.length,
        reussis: bilan.reussis,
        echoues: bilan.echoues,
        encours: null,
        termine: true,
        secondes: bilan.secondes,
        obstacle: expliquerObstacle(bilan.renvoiDominant),
      });
      console.log(
        `\n  Préchauffage terminé : ${bilan.reussis} écran(s) prêts` +
          (bilan.echoues ? `, ${bilan.echoues} en échec` : "") +
          ` — ${bilan.secondes} s.`
      );
      const obstacle = expliquerObstacle(bilan.renvoiDominant);
      if (obstacle) console.log(`  ${obstacle}`);
      console.log("");
    }
  } catch (e) {
    console.log(`  (Préchauffage abandonné : ${e instanceof Error ? e.message : e})\n`);
  }
}

// À partir d'ici, la mort du serveur doit arrêter le script : c'est lui qui le
// tenait en vie.
attentePassee = true;
if (sortieServeur !== null) process.exit(sortieServeur);
