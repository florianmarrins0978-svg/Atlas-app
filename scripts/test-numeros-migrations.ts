import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";

/**
 * DEUX MIGRATIONS NE PRENNENT PAS LE MÊME NUMÉRO — pas une de plus.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI CE CONTRÔLE EXISTE, ET POURQUOI SI TARD.**
 *
 * `TODO.md` porte depuis le 27 août 2026 une entrée intitulée « Deux migrations
 * portent le numéro 0067 ». Elle disait vrai et elle était **incomplète** :
 * l'audit de santé du 5 septembre 2026 a compté **onze numéros pris deux fois
 * ou trois**, soit vingt-quatre fichiers — et `0067` en portait trois, pas deux.
 *
 * Ce n'est pas la faute de qui l'a écrite : c'est la mécanique du dépôt. Six
 * sessions travaillent le même soir, chacune prend « le numéro suivant », et
 * **la fusion réussit sans rien dire** puisque les deux fichiers ont des noms
 * différents. Exactement ce qui produit les paragraphes en double
 * d'`ARCHITECTURE.md` — sauf que ceux-là ont reçu leur garde-fou le 26 août
 * (`verifier-memoire.mjs`), et les migrations non. Le document était protégé,
 * la base ne l'était pas.
 *
 * ── CE QUE ÇA COÛTE VRAIMENT, ET CE QUE ÇA NE COÛTE PAS ────────────────────
 *
 * **Aujourd'hui : rien**, et il faut le dire aussi clairement que le reste.
 * `run-migrations.ts` suit chaque migration par SON NOM DE FICHIER, pas par son
 * numéro : les vingt-quatre s'appliquent, toutes, une seule fois. J'ai relevé
 * pour chaque groupe les tables créées et les tables touchées — aucun couple de
 * même numéro n'a de dépendance croisée.
 *
 * **Ce qui n'est pas garanti, en revanche, c'est l'ORDRE.** Il vient de
 * `readdirSync(...).sort()`, un tri alphabétique du nom complet : entre deux
 * `0067_`, c'est la queue du nom qui tranche, jamais l'ordre où elles sont
 * arrivées. Une base reconstruite depuis zéro les applique donc dans un ordre
 * que personne n'a choisi. Le jour où deux migrations de même numéro se
 * toucheront — l'une créant ce que l'autre modifie —, la panne ne se verra pas
 * sur les bases existantes, seulement sur une base neuve : en production, à la
 * restauration d'une sauvegarde, ou chez le prochain artisan.
 *
 * ── CE CONTRÔLE NE DEMANDE PAS DE RENOMMER QUOI QUE CE SOIT ────────────────
 *
 * **Renommer une migration déjà sur `main` est INTERDIT**, et ce n'est pas une
 * précaution : la clé de suivi étant le nom, un fichier renommé se REJOUE sur
 * toute base qui l'avait déjà appliquée. Les onze doublons ci-dessous sont donc
 * des faits acquis, inscrits tels quels, et ce contrôle les laisse tranquilles.
 *
 * Il ne défend qu'une chose : **le douzième**.
 *
 * ── LA LISTE DOIT RESTER EXACTE, ET C'EST CE QUI L'EMPÊCHE DE POURRIR ──────
 *
 * Un numéro qu'on laisserait ici après l'avoir démêlé fait rougir le contrôle
 * au même titre qu'un doublon neuf — on ne peut donc pas oublier de raccourcir
 * la liste en nettoyant. Idiome repris de `DOUBLONS_CONNUS`
 * (`verifier-memoire.mjs`), pour que les deux se lisent pareil.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const DOSSIER = path.join(__dirname, "..", "drizzle");

/**
 * Les onze numéros pris plus d'une fois AVANT ce contrôle, relevés le
 * 5 septembre 2026. Ils viennent tous de sessions parallèles, et aucun ne se
 * corrige : voir plus haut.
 */
const DOUBLONS_CONNUS = new Set([
  "0035", // agenda_apple · periodicite_tva
  "0036", // achats_tva · monsieur_plutot_que_chez
  "0062", // message_client · tentatives_connexion
  "0063", // allure_documents · cles_appareil
  "0064", // conditions_sur_le_devis · secret_authentification
  "0065", // preuve_recente · roles_et_acces
  "0066", // format_numero · preuve_par_le_moteur
  "0067", // isolation_contexte_vide · propositions_sans_chantier · salaries_a_part
  "0068", // effacement_client_devis_envoye · prestation_structuree
  "0069", // fil_assistant · journal_des_purges · ligne_de_prix_et_ses_prestations
  "0071", // rappel_vu · role_facturation
]);

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

console.log("=== Les numéros de migration ===\n");

const fichiers = readdirSync(DOSSIER)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const parNumero = new Map<string, string[]>();
for (const f of fichiers) {
  const numero = f.slice(0, 4);
  parNumero.set(numero, [...(parNumero.get(numero) ?? []), f]);
}

/**
 * **UN CONTRÔLE QUI MESURE ZÉRO NE MESURE RIEN** (`CLAUDE.md` §5). Un dossier
 * vide — chemin faux, arborescence remaniée — rendrait « aucun doublon » en
 * vert, et ce vert-là ne prouverait rien. On refuse de conclure.
 */
test("il y a bien des migrations à examiner", () => {
  assert.ok(
    fichiers.length >= 70,
    `${fichiers.length} fichier(s) .sql dans ${DOSSIER} — le dossier a-t-il déménagé ? ` +
      "Refus de conclure : sans migrations, « aucun doublon » ne veut rien dire."
  );
});

test("aucun numéro NEUF n'est pris deux fois", () => {
  const neufs = [...parNumero.entries()]
    .filter(([numero, liste]) => liste.length > 1 && !DOUBLONS_CONNUS.has(numero))
    .map(([numero, liste]) => `      ${numero} → ${liste.join(", ")}`);

  assert.equal(
    neufs.length,
    0,
    "Deux sessions ont pris le même numéro de migration :\n" +
      neufs.join("\n") +
      "\n\n      CE QU'IL FAUT FAIRE, ET SURTOUT PAS L'INVERSE :\n" +
      "      · renommer CELLE QUI N'EST PAS ENCORE SUR `main` — aucune base ne\n" +
      "        l'a appliquée que la vôtre, il suffit d'y corriger la ligne de\n" +
      "        `_migrations` ;\n" +
      "      · NE JAMAIS renommer celle qui est déjà sur `main` : la clé de\n" +
      "        suivi est le nom du fichier, et un renommage la REJOUE sur toutes\n" +
      "        les bases à jour.\n" +
      "      Prendre le numéro suivant libre. Voir `TODO.md` et le commentaire\n" +
      "      en tête de ce fichier."
  );
});

test("la liste des doublons connus est encore exacte", () => {
  const demeles = [...DOUBLONS_CONNUS].filter((numero) => (parNumero.get(numero)?.length ?? 0) <= 1);
  assert.equal(
    demeles.length,
    0,
    `${demeles.join(", ")} n'est plus en double : le retirer de DOUBLONS_CONNUS ` +
      "dans ce fichier, sinon la liste protège un doublon qui reviendrait."
  );
});

/**
 * **Ce couple-ci ne défend pas la base, il défend la LECTURE de la base.**
 * Le numéro le plus haut est celui qu'une session lira pour prendre le suivant.
 * S'il est en double, elle a une chance sur deux de croire que le suivant est
 * libre alors qu'il l'est déjà — et c'est précisément ainsi que `0069` et
 * `0071` sont nés.
 */
test("le dernier numéro n'est pas lui-même en double", () => {
  const dernier = [...parNumero.keys()].sort().at(-1)!;
  const combien = parNumero.get(dernier)!.length;
  assert.equal(
    combien,
    1,
    `le numéro le plus haut (${dernier}) est pris ${combien} fois : ` +
      "la prochaine session lira une queue de liste ambiguë. Le prochain numéro libre est " +
      `${String(Number(dernier) + 1).padStart(4, "0")}.`
  );
});

console.log(`\n${failed === 0 ? "✅" : "❌"} Numéros de migration — ${passed} réussi(s), ${failed} échec(s).`);
process.exit(failed === 0 ? 0 : 1);
