// QUI ATTEINT QUOI — la règle, éprouvée sans base et sans navigateur.
//
// **Ce que cette suite protège.** `docs/QUESTIONS.md` §10 : *« un salarié qui
// découvre votre marge parce qu'il a su regarder, c'est pire que pas de
// restriction du tout, puisque vous vous croyiez protégé »*. La règle vit dans
// une fonction pure (`src/lib/acces-roles.ts`) précisément pour qu'elle
// s'éprouve ici, exhaustivement, plutôt que par un écran à la fois.
//
// **Elle éprouve la RÈGLE, pas un libellé d'écran** (`CLAUDE.md` §5 bis) : si le
// patron fait retirer un mot demain, aucun de ces contrôles ne bouge.
//
// **Le contrôle le plus important est celui de la LISTE BLANCHE** : il balaie
// toutes les adresses réelles du dépôt et exige qu'un salarié soit refusé
// partout sauf sur les cinq qui lui sont ouvertes. Une page ajoutée demain, par
// une autre session, lui est donc fermée d'office — et si quelqu'un l'ouvre, il
// faudra qu'il l'écrive ici, à la main.

import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  ROLES,
  accueilDuRole,
  ceQueLeRoleChange,
  cheminAutorise,
  estRole,
  libelleRole,
  ongletsDuRole,
  peutFacturer,
  peutModifierLePlanning,
  peutVoirLesMontants,
} from "../src/lib/acces-roles";
import { rubriquesReglages, adressesAutorisees } from "../src/lib/rubriques-reglages";
import { estCheminPublic } from "../src/lib/chemins-publics";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/**
 * Toutes les adresses que le dépôt sert vraiment, lues dans `src/app`.
 *
 * **Lues, jamais recopiées.** Une liste écrite à la main aurait vieilli au
 * premier écran neuf — et c'est exactement l'écran neuf qui pose le risque : il
 * ne serait dans aucune liste, donc dans aucun contrôle, et il s'ouvrirait à qui
 * n'y a pas droit sans que rien ne le dise.
 */
function adressesDuDepot(): string[] {
  const racine = path.join(__dirname, "..", "src", "app");
  const trouvees: string[] = [];

  function parcourir(dossier: string, prefixe: string) {
    for (const entree of readdirSync(dossier)) {
      const complet = path.join(dossier, entree);
      if (!statSync(complet).isDirectory()) {
        if (entree === "page.tsx" || entree === "route.ts") trouvees.push(prefixe === "" ? "/" : prefixe);
        continue;
      }
      // `(groupes)` et `@parallèles` ne sont pas des segments d'adresse.
      if (entree.startsWith("(") || entree.startsWith("@") || entree.startsWith("_")) {
        parcourir(complet, prefixe);
        continue;
      }
      // Un segment dynamique reçoit une valeur plausible : la règle raisonne sur
      // la FORME de l'adresse, jamais sur l'identifiant.
      const segment = entree.startsWith("[") ? "xxxx" : entree;
      parcourir(complet, `${prefixe}/${segment}`);
    }
  }

  parcourir(racine, "");
  return trouvees.sort();
}

const ADRESSES = adressesDuDepot();

/** Ce qu'un salarié a le droit d'ouvrir, écrit ici À LA MAIN, et c'est le but. */
const OUVERT_AU_SALARIE = [
  "/planning",
  "/documents-legaux",
  "/reglages",
  "/reglages/compte",
  "/reglages/notifications",
  "/reglages/connexion",
  "/reglages/apparence",
  "/api/chantiers/xxxx/feuille/pdf",
  "/api/polices/xxxx",
  "/api/health/live",
  "/api/health/ready",
  "/api/health/banc",
  "/api/health/banc/etat",
  "/api/health/diagnostic",
  // Ajoutée au lot de clôture du 29 août 2026 : elle dit si le ménage se fait
  // encore. Ouverte comme les autres sondes — un outil de surveillance n'a pas
  // de session, et elle ne rend qu'une date et un statut.
  "/api/health/purge",
];

console.log("=== Qui atteint quoi ===\n");

essai("le dépôt a bien été parcouru — sans quoi ce qui suit ne mesure rien", () => {
  // Un contrôle qui balaie zéro adresse rendrait un vert qui ne prouve rien
  // (`CLAUDE.md` §5 : « un contrôle qui mesure ZÉRO ne mesure rien »).
  assert.ok(ADRESSES.length > 30, `seulement ${ADRESSES.length} adresses trouvées`);
  assert.ok(ADRESSES.includes("/planning"));
  assert.ok(ADRESSES.includes("/reglages/tarifs"));
});

essai("le patron atteint tout, sans exception", () => {
  for (const a of ADRESSES) {
    assert.ok(cheminAutorise("proprietaire", a), `le patron est refusé sur ${a}`);
  }
});

essai("le salarié n'atteint QUE le planning, ses réglages, et sa feuille sans montants", () => {
  const ouvertes = ADRESSES.filter((a) => !estCheminPublic(a) && cheminAutorise("salarie", a));
  assert.deepEqual(ouvertes.sort(), [...OUVERT_AU_SALARIE].sort());
});

essai("aucun devis, aucune facture, aucun chantier ne sort pour un salarié", () => {
  // Nommément, parce que ce sont eux qui portent les montants : si la liste
  // blanche changeait par distraction, c'est ici qu'on veut lire le rouge.
  for (const a of [
    "/",
    "/chantiers/xxxx",
    "/chantiers/xxxx/prix",
    "/chantiers/xxxx/facture",
    "/chantiers/xxxx/devis-complet",
    "/api/devis/xxxx/pdf",
    "/api/factures/xxxx/pdf",
    "/api/mes-donnees",
    "/api/fichiers/xxxx",
    "/clients",
    "/termines",
    "/reglages/tarifs",
    "/reglages/prix",
  ]) {
    assert.equal(cheminAutorise("salarie", a), false, `un salarié atteint ${a}`);
  }
});

essai("le commercial atteint l'application, sauf les adresses nommées", () => {
  const fermees = ADRESSES.filter((a) => !cheminAutorise("commercial", a));
  assert.deepEqual(fermees.sort(), [
    // **« Terminés » et la TVA sont entrés le 30 août 2026, et ce n'est pas un
    // resserrement d'humeur : c'est SA règle du 13 août**, restée lettre morte
    // trois semaines (`docs/QUESTIONS.md` §10) — *« ni les factures, ni la
    // TVA »*. Les lignes ci-dessous manquaient, et leur absence défendait le
    // défaut.
    "/api/factures/xxxx/pdf",
    "/chantiers/xxxx/facture",
    "/reglages/abonnement",
    "/reglages/documents",
    "/reglages/donnees",
    "/reglages/equipe",
    // **Ajoutée le 26 août 2026 par ce contrôle lui-même**, et c'est ce qu'on
    // lui demande : l'écran « Nouveau compte » est né ce jour-là, et la liste
    // attendue ne le portait pas. Une adresse neuve sous `/reglages/equipe`
    // hérite de son refus — mais l'hériter en SILENCE serait le jour où l'on
    // pose une page qui, elle, ne devait pas l'hériter.
    "/reglages/equipe/nouveau",
    "/reglages/identite",
    "/termines",
    "/termines/tva",
  ]);
});

essai("le commercial voit les chantiers, les devis et les prix — mais PAS les factures", () => {
  // Sa précision du 23 août 2026 : « les commerciaux auront accès à l'entièreté
  // de l'application, sauf… ». Ce contrôle est là pour que personne ne resserre
  // ce rôle en croyant bien faire.
  for (const a of ["/", "/chantiers/xxxx", "/chantiers/xxxx/prix", "/chantiers/xxxx/export", "/api/devis/xxxx/pdf", "/planning", "/clients"]) {
    assert.ok(cheminAutorise("commercial", a), `le commercial est refusé sur ${a}`);
  }
  // ═══════════════════════════════════════════════════════════════════════
  // **CE CONTRÔLE DISAIT L'INVERSE JUSQU'AU 30 AOÛT 2026, et il défendait un
  // défaut.** Il exigeait que `/termines/tva` soit OUVERT au commercial, au
  // nom de « l'entièreté de l'application » — alors que la table du patron,
  // dans le même document et dix jours plus tôt, écrivait *« ni les factures,
  // ni la TVA »*. Une suite qui réclame ce que la règle interdit est pire
  // qu'une absence de suite : elle rassure celui qui vient vérifier.
  for (const a of ["/termines", "/termines/tva", "/chantiers/xxxx/facture", "/api/factures/xxxx/pdf"]) {
    assert.ok(!cheminAutorise("commercial", a), `le commercial atteint encore ${a}`);
  }
});

essai("la facturation tient son cycle, et rien de plus", () => {
  for (const a of ["/", "/chantiers/xxxx", "/chantiers/xxxx/facture", "/clients", "/termines/tva", "/planning", "/api/factures/xxxx/pdf"]) {
    assert.ok(cheminAutorise("facturation", a), `la facturation est refusée sur ${a}`);
  }
  for (const a of ["/paysage", "/catalogue", "/reglages/identite", "/reglages/tarifs", "/reglages/equipe"]) {
    assert.ok(!cheminAutorise("facturation", a), `la facturation atteint ${a}`);
  }
});

essai("un accès donné se REFUSE, pas seulement se cache — le contrôle sait rougir", () => {
  // Un contrôle jamais vu rouge ne prouve rien (`AGENTS.md`). On confronte donc
  // la règle à ce qu'elle prétend interdire : si `cheminAutorise` rendait `true`
  // partout, la ligne suivante tomberait.
  assert.equal(cheminAutorise("salarie", "/chantiers/xxxx/prix"), false);
  assert.equal(cheminAutorise("commercial", "/reglages/identite"), false);
  // Et si elle rendait `false` partout, celle-ci tomberait.
  assert.equal(cheminAutorise("salarie", "/planning"), true);
});

essai("une adresse illisible est refusée, jamais acceptée par défaut", () => {
  for (const role of ROLES) {
    if (role === "proprietaire") continue;
    assert.equal(cheminAutorise(role, "planning"), false);
    assert.equal(cheminAutorise(role, ""), false);
  }
});

essai("le sommaire des réglages dit exactement ce que la règle autorise", () => {
  // **Aucune seconde liste.** Le sommaire filtre par `cheminAutorise` : une
  // rubrique affichée qui mènerait à un refus se lirait comme une panne.
  for (const role of ROLES) {
    for (const href of adressesAutorisees(role)) {
      assert.ok(cheminAutorise(role, href), `${role} voit ${href} et s'y ferait refuser`);
    }
  }
});

essai("un salarié ne reçoit que « Moi » dans les réglages", () => {
  const ensembles = rubriquesReglages("salarie");
  assert.deepEqual(ensembles.map((e) => e.titre), ["Moi"]);
  assert.deepEqual(adressesAutorisees("salarie").sort(), [
    "/reglages/apparence",
    "/reglages/compte",
    "/reglages/connexion",
    "/reglages/notifications",
  ]);
});

essai("un commercial reçoit l'entreprise amputée, jamais l'identité ni les accès", () => {
  const titres = rubriquesReglages("commercial").map((e) => e.titre);
  assert.deepEqual(titres, ["L'entreprise", "Moi"]);
  const adresses = adressesAutorisees("commercial");
  assert.ok(!adresses.includes("/reglages/identite"));
  assert.ok(!adresses.includes("/reglages/equipe"));
  assert.ok(!adresses.includes("/reglages/documents"));
  assert.ok(adresses.includes("/reglages/tarifs"));
});

essai("un rôle illisible ne reçoit rien de l'entreprise", () => {
  assert.deepEqual(rubriquesReglages(null).map((e) => e.titre), ["Moi"]);
});

const ONGLETS = [
  { href: "/" },
  { href: "/planning" },
  { href: "/termines" },
  { href: "/paysage" },
  { href: "/reglages" },
];

essai("la barre du bas suit le rôle", () => {
  assert.equal(ongletsDuRole("proprietaire", ONGLETS).length, 5);
  // Le commercial perd « Terminés » — l'onglet de la facturation. Il garde les
  // quatre autres : chantiers, planning, paysage, réglages.
  assert.deepEqual(ongletsDuRole("commercial", ONGLETS).map((o) => o.href), ["/", "/planning", "/paysage", "/reglages"]);
  // La facturation perd « Paysage » — les outils du terrain ne facturent rien.
  assert.deepEqual(ongletsDuRole("facturation", ONGLETS).map((o) => o.href), ["/", "/planning", "/termines", "/reglages"]);
  assert.deepEqual(ongletsDuRole("salarie", ONGLETS).map((o) => o.href), ["/planning", "/reglages"]);
});

essai("le repli d'un refus est toujours une adresse que le rôle atteint", () => {
  // Sans quoi un refus renverrait vers un autre refus, et l'écran resterait
  // blanc — la boucle qu'aucun test d'écran ne verrait.
  for (const role of ROLES) {
    assert.ok(cheminAutorise(role, accueilDuRole(role)), `${role} est refusé sur son propre accueil`);
  }
});

essai("les montants ne sont pas pour le salarié", () => {
  assert.equal(peutVoirLesMontants("proprietaire"), true);
  assert.equal(peutVoirLesMontants("facturation"), true);
  assert.equal(peutVoirLesMontants("commercial"), true);
  assert.equal(peutVoirLesMontants("salarie"), false);
});

essai("les libellés sont ceux de sa planche", () => {
  assert.equal(libelleRole("proprietaire"), "Patron");
  assert.equal(libelleRole("facturation"), "Facturation");
  assert.equal(libelleRole("commercial"), "Commercial");
  assert.equal(libelleRole("salarie"), "Salarié");
});

essai("« membre » n'est plus un rôle", () => {
  assert.equal(estRole("membre"), false);
  assert.equal(estRole("salarie"), true);
  assert.equal(estRole(null), false);
});

essai("ce que l'écran promet correspond à ce que la règle fait", () => {
  // Une promesse fausse sur un écran d'accès est pire que pas d'écran : le
  // patron croirait avoir fermé. On ne compare pas les mots — ils changeront —
  // mais le FAIT qu'un rôle sans restriction n'en annonce aucune, et l'inverse.
  assert.deepEqual(ceQueLeRoleChange("proprietaire").nonPlus, []);
  assert.ok(ceQueLeRoleChange("commercial").nonPlus.length > 0);
  assert.ok(ceQueLeRoleChange("salarie").nonPlus.length > 0);
  for (const role of ROLES) {
    assert.ok(ceQueLeRoleChange(role).peut.length > 0, `${role} n'annonce rien qu'il puisse faire`);
  }
});

/**
 * **CE CONTRÔLE EST NÉ D'UN MENSONGE QUE LE PRÉCÉDENT LAISSAIT PASSER.**
 *
 * Jusqu'au 30 août 2026, l'écran des accès annonçait au patron que le
 * commercial pouvait faire « Les factures et le relevé de TVA » — alors que sa
 * propre règle du 13 août disait *« ni les factures, ni la TVA »*. Le contrôle
 * d'au-dessus ne pouvait pas le voir : il vérifiait que les listes ne sont pas
 * vides, jamais **ce qu'elles disent**.
 *
 * Celui-ci attache donc les mots à la capacité. Deux mots seulement — ceux du
 * patron —, et de chaque côté : promettre ce qu'on refuse est le défaut du
 * 13 août ; taire une restriction réelle en est le jumeau, et c'est le suivant
 * qu'on paierait.
 */
essai("L'ÉCRAN NE PROMET PAS CE QUE LA RÈGLE REFUSE — le mensonge du 13 août", () => {
  const dit = (liste: readonly string[], mot: string) =>
    liste.some((l) => l.toLowerCase().includes(mot));

  for (const role of ROLES) {
    const { peut, nonPlus } = ceQueLeRoleChange(role);

    // **Un rôle SANS aucune restriction est dispensé de la moitié positive.**
    // Le patron annonce « Tout Atlas » : énumérer sous cette phrase ce qu'il
    // peut faire serait une seconde liste, qui vieillirait à la première
    // fonction ajoutée. Sa `nonPlus` vide est déjà vérifiée juste au-dessus, et
    // c'est elle qui rend la promesse vraie.
    if (peutFacturer(role)) {
      if (nonPlus.length > 0) {
        assert.ok(dit(peut, "facture"), `${role} facture, et l'écran ne le dit pas`);
      }
      assert.ok(!dit(nonPlus, "facture"), `${role} facture, et l'écran annonce le contraire`);
    } else {
      assert.ok(!dit(peut, "facture"), `${role} ne facture pas, et l'écran le lui promet`);
      // Le patron doit LIRE la restriction avant de donner l'accès : une
      // restriction tue se découvre le jour où la personne se plaint.
      assert.ok(dit(nonPlus, "facture"), `${role} ne facture pas, et l'écran se tait`);
    }

    if (!peutModifierLePlanning(role) && role !== "proprietaire") {
      assert.ok(dit(nonPlus, "planning"), `${role} n'écrit pas au planning, et l'écran se tait`);
    }
  }
});

console.log("");
console.log(`Qui atteint quoi — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
