import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Monter la base de qualification : migrations, puis jeu de données fictif.
//
//   npm run qa:setup
//
// ═══════════════════════════════════════════════════════════════════════════
// **POURQUOI CE SCRIPT EXISTE, ET CE QU'IL ÉVITE — payé le 30 août 2026.**
//
// La première version de l'établi enchaînait simplement les deux scripts
// existants :
//
//     "qa:setup": "npm run db:migrate:local && npm run db:seed:local"
//
// Et elle est morte sur :
//
//     error: permission denied for schema public
//
// Parce que `db:migrate:local` lit `DATABASE_URL`, c'est-à-dire le rôle
// **applicatif** — celui qui, ici comme en production, n'a AUCUN droit de DDL.
// C'est délibéré : c'est ce qui fait que l'isolation entre entreprises est
// réellement éprouvée pendant les essais, au lieu d'être contournée par un
// superutilisateur qui traverse la RLS sans le dire.
//
// Les migrations, elles, doivent tourner sous le rôle **propriétaire**
// (`DATABASE_ADMIN_URL`) — exactement ce que fait déjà
// `scripts/monter-base-locale.sh`. Et l'inverse est PIRE, parce qu'il réussit :
// migrer sous un superutilisateur crée des tables qui ne lui appartiennent pas,
// et le défaut n'apparaît qu'à la suite suivante, ailleurs, sous la forme d'un
// « permission denied for table … » sur une table qu'on n'a pas touchée
// (`CLAUDE.md` §5 — cinquante suites rouges d'un coup).
//
// **Le même défaut dort dans `dev:setup`** pour l'environnement de tous les
// jours : sur un volume Docker neuf, il échoue à l'identique. Noté dans
// `TODO.md` plutôt que corrigé ici — l'établi QA ne doit pas devenir le
// prétexte à remanier le chemin de développement.
//
// ═══════════════════════════════════════════════════════════════════════════
// **ÉCRIT EN NODE, ET NON EN SHELL**, parce que le patron n'est pas toujours
// sur la même machine que nous : `VAR=x npm run …` n'existe pas sur l'invite de
// commandes Windows, et un `qa:setup` qui ne marche que sur Linux serait une
// commande transmise sans avoir été parcourue (`AGENTS.md`).

const RACINE = path.join(import.meta.dirname, "..");

function lireEnv() {
  const chemin = path.join(RACINE, ".env");
  if (!existsSync(chemin)) {
    console.error(
      "\n❌ Aucun .env dans ce dossier.\n\n" +
        "   L'établi de qualification a besoin de sa configuration :\n\n" +
        "     cp .env.qa.example .env\n",
    );
    process.exit(1);
  }
  const env = {};
  for (const ligne of readFileSync(chemin, "utf8").split("\n")) {
    const nette = ligne.trim();
    if (!nette || nette.startsWith("#")) continue;
    const coupure = nette.indexOf("=");
    if (coupure < 1) continue;
    env[nette.slice(0, coupure).trim()] = nette.slice(coupure + 1).trim();
  }
  return env;
}

const env = lireEnv();

const proprietaire = env.DATABASE_ADMIN_URL?.trim();
if (!proprietaire) {
  console.error(
    "\n❌ DATABASE_ADMIN_URL est absente du .env.\n\n" +
      "   Les migrations créent des tables : elles exigent le rôle propriétaire.\n" +
      "   Le rôle applicatif (DATABASE_URL) n'a aucun droit de DDL, ici comme en production.\n\n" +
      "   Reprendre .env.qa.example.\n",
  );
  process.exit(1);
}

// Une garde de plus, et elle ne coûte rien : ce script écrit dans une base et
// la vide. Qu'il refuse tout ce qui n'est pas cette machine.
try {
  const hote = new URL(proprietaire).hostname.toLowerCase();
  if (!["localhost", "127.0.0.1", "::1"].includes(hote)) {
    console.error(`\n❌ DATABASE_ADMIN_URL désigne « ${hote} », qui n'est pas cette machine.\n`);
    process.exit(1);
  }
} catch {
  console.error("\n❌ DATABASE_ADMIN_URL ne se lit pas comme une adresse.\n");
  process.exit(1);
}

const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

/**
 * Les deux étapes tournent sous le PROPRIÉTAIRE.
 *
 * Les migrations parce qu'elles créent ; le jeu de données parce qu'il commence
 * par un `TRUNCATE`, et que le rôle applicatif ne l'a pas non plus. C'est le
 * propriétaire des tables, pas un superutilisateur : les tables restent à
 * `atlas_owner`, et la RLS continue de s'appliquer aux requêtes du produit.
 */
const etapes = [
  { nom: "Migrations", args: ["run", "db:migrate"], attrape: "un schéma en retard sur le code" },
  { nom: "Jeu de données fictif", args: ["run", "db:seed"], attrape: "une base vide, où rien ne se teste" },
];

for (const etape of etapes) {
  console.log(`\n→ ${etape.nom}`);
  const r = spawnSync(NPM, etape.args, {
    cwd: RACINE,
    stdio: "inherit",
    // `...env` d'abord : les variables du .env s'appliquent, puis DATABASE_URL
    // est ÉCRASÉE par l'adresse du propriétaire. L'ordre compte.
    env: { ...process.env, ...env, DATABASE_URL: proprietaire },
  });
  if (r.status !== 0) {
    console.error(`\n❌ ${etape.nom} a échoué — ce qu'elle attrape : ${etape.attrape}\n`);
    process.exit(1);
  }
}

console.log("\n✅ Base de qualification prête. Vérifier l'isolation :  npm run qa:preuve\n");
