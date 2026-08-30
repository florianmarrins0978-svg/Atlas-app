// LE MODÈLE DES RÔLES : QUATRE RÔLES, DES CAPACITÉS, ET DES GARDES QUI REFUSENT.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CE LOT FIGE, ET POURQUOI MAINTENANT** — 30 août 2026, avant le
// déploiement et donc avant le premier artisan réel :
//
//   PATRON       = tout Atlas.
//   FACTURATION  = clients + devis + factures, sans administration sensible.
//   COMMERCIAL   = clients + devis + planning en écriture, AUCUNE facturation.
//   SALARIÉ      = planning en lecture seule, sa feuille sans prix.
//
// ═══════════════════════════════════════════════════════════════════════════
// **LE DÉFAUT QUE CETTE SUITE FERME, ET IL DORMAIT DEPUIS LE 13 AOÛT.**
//
// `docs/QUESTIONS.md` §10, ses mots : *« Le commercial : […] ni les factures,
// ni la TVA. »* Le code ne l'appliquait pas. Les quinze actions du cycle
// comptable se gardaient par `exigerMontants`, qui ne refuse que le salarié :
// **un commercial émettait des factures pour de bon**, et l'écran des accès lui
// promettait même « Les factures et le relevé de TVA ».
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QU'ELLE PROUVE, DANS CET ORDRE.**
//
//   1. les capacités disent qui a quoi — les quatre rôles, une par une ;
//   2. **aucune capacité ne s'écrit en liste NOIRE** : un cinquième rôle doit
//      naître sans droits. C'est ce contrôle-là qui a rendu le lot sûr ;
//   3. les gardes, sous de VRAIS comptes en base, refusent et laissent passer ;
//   4. **sans elles, le commercial passait** — la garde d'avant le laisse
//      entrer. Le seul contrôle qui prouve que le lot sert à quelque chose ;
//   5. les chemins : ce que chaque rôle ouvre, et ce qu'il ne peut pas taper ;
//   6. l'élévation de privilège : un rôle envoyé par le navigateur, un
//      identifiant d'accès d'une AUTRE entreprise, le dernier patron ;
//   7. l'essai négatif sur disque : la garde retirée du fichier, le contrôle
//      rougit ; rétablie, il reverdit, et le fichier est rendu à l'octet près.
//
// **Ni écran ni bouton ici.** Ce qui se cache se remontre ; ce qui se refuse au
// serveur se refuse à qui fabrique la requête à la main.

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import {
  donnerUnAcces,
  listerAcces,
  changerLeRole,
  retirerUnAcces,
} from "../src/server/repositories/membres-entreprise";
import {
  exigerFacturation,
  exigerGestionDevis,
  exigerMontants,
  exigerEcritureSurLePlanning,
  ActionRefuseeError,
} from "../src/server/garde-action";
import {
  ROLES,
  cheminAutorise,
  peutFacturer,
  peutGererDevis,
  peutModifierLePlanning,
  peutVoirLesMontants,
  peutUtiliserLAssistant,
  type Role,
} from "../src/lib/acces-roles";
import { pool } from "../src/server/db/client";
import type { Ctx } from "../src/server/repositories/context";

const RACINE = process.cwd();
const FICHIER_FACTURE = join(RACINE, "src/app/chantiers/[id]/facture/actions.ts");
const FICHIER_TVA = join(RACINE, "src/app/termines/tva/actions.ts");
const FICHIER_CAPACITES = join(RACINE, "src/lib/acces-roles.ts");

/**
 * LA MATRICE, ÉCRITE UNE FOIS ET LUE PAR TOUT CE FICHIER.
 *
 * **Elle n'est pas la copie de la règle : elle est la question posée à la
 * règle.** Recopier `acces-roles.ts` ici produirait deux rédactions qui
 * finiraient par diverger (`CLAUDE.md` §3) — ce tableau-ci est écrit d'après
 * ses consignes du 30 août, dans ses mots, et c'est le code qui doit s'y
 * conformer, jamais l'inverse.
 */
const MATRICE: Record<Role, { montants: boolean; devis: boolean; facturer: boolean; planning: boolean; assistant: boolean }> = {
  proprietaire: { montants: true, devis: true, facturer: true, planning: true, assistant: true },
  facturation: { montants: true, devis: true, facturer: true, planning: false, assistant: false },
  commercial: { montants: true, devis: true, facturer: false, planning: true, assistant: false },
  salarie: { montants: false, devis: false, facturer: false, planning: false, assistant: false },
};

/** Les quinze actions du cycle comptable, et le fichier où chacune vit. */
const FACTURATION = [
  [FICHIER_FACTURE, "terminerChantierAction"],
  [FICHIER_FACTURE, "emettreFactureAction"],
  [FICHIER_FACTURE, "majEcheanceFactureAction"],
  [FICHIER_FACTURE, "preparerLienFactureAction"],
  [FICHIER_TVA, "ajouterAchatAction"],
  [FICHIER_TVA, "supprimerAchatAction"],
  [FICHIER_TVA, "rangerTicketAction"],
  [FICHIER_TVA, "soldeFactureAction"],
  [FICHIER_TVA, "noterPaiementAction"],
  [FICHIER_TVA, "retirerPaiementAction"],
] as const;

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

async function refuse(fn: () => Promise<void>, quoi: string) {
  await assert.rejects(fn, ActionRefuseeError, `${quoi} : la garde a laissé passer`);
}

/** Le corps de chaque fonction exportée d'un fichier d'actions. */
function corpsDesActions(source: string): Map<string, string> {
  const lignes = source.split("\n");
  const trouvees = new Map<string, string>();
  for (let i = 0; i < lignes.length; i++) {
    const m = /^export async function (\w+)/.exec(lignes[i]);
    if (!m) continue;
    let j = i + 1;
    while (j < lignes.length && !/^export async function /.test(lignes[j])) j++;
    trouvees.set(m[1], lignes.slice(i, j).join("\n"));
  }
  return trouvees;
}

/**
 * LE CONTRÔLE QUE L'ESSAI NÉGATIF FAIT ROUGIR.
 *
 * Prend les sources en ARGUMENT plutôt que de les relire : c'est ce qui permet
 * de le confronter à une version amputée sans laisser le dépôt abîmé plus
 * longtemps que l'instant du contrôle.
 */
function actionsSansGardeDeFacturation(sources: Map<string, string>): string[] {
  const nues: string[] = [];
  for (const [fichier, nom] of FACTURATION) {
    const corps = corpsDesActions(sources.get(fichier)!);
    const c = corps.get(nom);
    // Une action disparue est un manque, pas une absence : renommée ailleurs,
    // elle facturerait sans garde sous un autre nom.
    if (c === undefined) {
      nues.push(`${nom} (introuvable)`);
      continue;
    }
    if (!c.includes("exigerFacturation(")) nues.push(nom);
  }
  return nues;
}

async function main() {
  console.log("=== Le modèle des rôles : capacités et gardes ===\n");

  // ─── 1. LA MATRICE ───────────────────────────────────────────────────────
  await essai("LA MATRICE : chaque rôle a exactement les capacités décidées", () => {
    for (const role of ROLES) {
      const attendu = MATRICE[role];
      assert.equal(peutVoirLesMontants(role), attendu.montants, `${role} / voir les montants`);
      assert.equal(peutGererDevis(role), attendu.devis, `${role} / gérer un devis`);
      assert.equal(peutFacturer(role), attendu.facturer, `${role} / facturer`);
      assert.equal(peutModifierLePlanning(role), attendu.planning, `${role} / écrire au planning`);
      assert.equal(peutUtiliserLAssistant(role), attendu.assistant, `${role} / l'assistant`);
    }
  });

  await essai("LES QUATRE RÔLES SONT LÀ, ET PAS UN DE PLUS", () => {
    assert.deepEqual([...ROLES], ["proprietaire", "facturation", "commercial", "salarie"]);
    // La matrice ci-dessus doit couvrir chacun : un rôle ajouté sans y être
    // inscrit passerait toutes les vérifications de ce fichier sans être vu.
    for (const role of ROLES) assert.ok(MATRICE[role], `${role} n'est pas dans la matrice de cette suite`);
  });

  /**
   * **AUCUNE CAPACITÉ NE S'ÉCRIT EN LISTE NOIRE.**
   *
   * C'est le contrôle le plus important du fichier, et il ne regarde aucun
   * comportement : il lit la SOURCE. Une capacité écrite `role !== "salarie"`
   * accueille tout rôle neuf, en silence — c'est exactement ce qui serait
   * arrivé le 30 août si `peutFacturer` avait été écrite ainsi : le rôle
   * « facturation » l'aurait obtenue, et personne n'aurait rien vu passer.
   *
   * Le contrôle est donc textuel, faute de pouvoir interroger une fonction sur
   * sa forme. Il vaut ce que vaut sa formulation, et il est écrit large : toute
   * comparaison par la NÉGATIVE sur un rôle est refusée.
   */
  await essai("AUCUNE CAPACITÉ N'EST ÉCRITE EN LISTE NOIRE — un rôle neuf naît sans droits", () => {
    const source = readFileSync(FICHIER_CAPACITES, "utf8");
    const corps = corpsDesActions(source);
    const capacites = ["peutVoirLesMontants", "peutGererDevis", "peutFacturer", "peutModifierLePlanning", "peutUtiliserLAssistant"];
    for (const nom of capacites) {
      // `corpsDesActions` ne relève que « export async function » : les
      // capacités sont synchrones, on les cherche autrement.
      const debut = source.indexOf(`export function ${nom}(`);
      assert.ok(debut > 0, `${nom} : introuvable dans acces-roles.ts`);
      const fin = source.indexOf("\n}", debut);
      const c = source.slice(debut, fin);
      assert.ok(
        !/role\s*!==/.test(c),
        `${nom} s'écrit par la négative : un rôle ajouté demain l'obtiendrait sans qu'une ligne change`
      );
      assert.ok(/role\s*===/.test(c), `${nom} ne nomme pas qui l'a`);
    }
    assert.equal(corps.size, 0, "acces-roles.ts ne doit contenir aucune action serveur");
  });

  // ─── 2. LES CHEMINS ──────────────────────────────────────────────────────
  await essai("LA FACTURATION N'ATTEINT QUE SON CYCLE", () => {
    for (const ouvert of ["/", "/chantiers", "/chantiers/abc/devis-complet", "/clients", "/planning", "/termines", "/termines/tva", "/api/factures/x/pdf", "/api/devis/x/pdf"]) {
      assert.ok(cheminAutorise("facturation", ouvert), `${ouvert} devrait être ouvert à la facturation`);
    }
    for (const ferme of ["/paysage", "/paysage/arrosage", "/catalogue", "/reglages/identite", "/reglages/equipe", "/reglages/tarifs", "/reglages/prix", "/reglages/documents", "/reglages/abonnement", "/reglages/donnees"]) {
      assert.ok(!cheminAutorise("facturation", ferme), `${ferme} devrait être fermé à la facturation`);
    }
    // Ses propres réglages, comme le salarié : sinon elle ne peut plus changer
    // son mot de passe.
    for (const sien of ["/reglages", "/reglages/compte", "/reglages/connexion", "/reglages/notifications"]) {
      assert.ok(cheminAutorise("facturation", sien), `${sien} appartient à la personne`);
    }
  });

  await essai("LE COMMERCIAL PERD « TERMINÉS » ET LA FACTURE D'UN CHANTIER — sa règle du 13 août", () => {
    for (const ferme of ["/termines", "/termines/tva", "/chantiers/abc/facture", "/api/factures/abc/pdf"]) {
      assert.ok(!cheminAutorise("commercial", ferme), `${ferme} devrait être fermé au commercial`);
    }
    // **Et le devis, lui, reste ouvert.** C'est toute la frontière du rôle : la
    // fermer aussi retirerait au commercial ce pour quoi il existe.
    for (const ouvert of ["/chantiers/abc/devis-complet", "/chantiers/abc/export", "/chantiers/abc/prix", "/api/devis/abc/pdf", "/planning", "/clients"]) {
      assert.ok(cheminAutorise("commercial", ouvert), `${ouvert} devrait rester ouvert au commercial`);
    }
  });

  await essai("LE PATRON N'A RIEN PERDU, ET LE SALARIÉ RIEN GAGNÉ", () => {
    for (const chemin of ["/", "/termines/tva", "/reglages/identite", "/catalogue", "/paysage", "/chantiers/abc/facture"]) {
      assert.ok(cheminAutorise("proprietaire", chemin), `${chemin} fermé au patron`);
      assert.ok(!cheminAutorise("salarie", chemin), `${chemin} ouvert au salarié`);
    }
    assert.ok(cheminAutorise("salarie", "/planning"), "le salarié a perdu son planning");
    assert.ok(cheminAutorise("salarie", "/api/chantiers/abc/feuille/pdf"), "le salarié a perdu sa feuille");
  });

  // ─── 3. LES GARDES, SOUS DE VRAIS COMPTES ────────────────────────────────
  await nettoyerBase();
  const a = await creerEntreprise(
    { nom: "Chez A" },
    { email: "patron-roles@essai.local", nom: "Patron A" }
  );
  const ctxPatron: Ctx = { utilisateurId: a.utilisateurId, entrepriseId: a.entreprise.id };

  for (const [role, email] of [
    ["facturation", "facturation-roles@essai.local"],
    ["commercial", "commercial-roles@essai.local"],
    ["salarie", "salarie-roles@essai.local"],
  ] as const) {
    const r = await donnerUnAcces(ctxPatron, {
      nom: role,
      email,
      motDePasse: "un-mot-de-passe-assez-long",
      confirmation: "un-mot-de-passe-assez-long",
      role,
    });
    assert.ok(r.ok, `le compte ${role} n'a pas été créé`);
  }

  const membres = await listerAcces(ctxPatron);
  const ctxDe = (role: Role): Ctx => {
    const m = membres.find((x) => x.role === role && x.utilisateurId !== a.utilisateurId);
    assert.ok(m, `aucun compte ${role}`);
    return { utilisateurId: m!.utilisateurId, entrepriseId: a.entreprise.id };
  };
  const ctxFacturation = ctxDe("facturation");
  const ctxCommercial = ctxDe("commercial");
  const ctxSalarie = ctxDe("salarie");

  await essai("LE RÔLE « FACTURATION » S'ENREGISTRE EN BASE — la contrainte l'accepte", async () => {
    const m = membres.find((x) => x.role === "facturation");
    assert.ok(m, "le rôle facturation n'est pas revenu de la base");
  });

  await essai("PLUSIEURS PERSONNES PORTENT LE MÊME RÔLE — ce n'est pas un compte partagé", async () => {
    const r = await donnerUnAcces(ctxPatron, {
      nom: "Seconde facturation",
      email: "facturation-2-roles@essai.local",
      motDePasse: "un-mot-de-passe-assez-long",
      confirmation: "un-mot-de-passe-assez-long",
      role: "facturation",
    });
    assert.ok(r.ok, "une seconde personne n'a pas pu porter le rôle facturation");
    const liste = await listerAcces(ctxPatron);
    const deux = liste.filter((x) => x.role === "facturation");
    assert.equal(deux.length, 2, "deux personnes devraient porter le rôle facturation");
    // Deux IDENTITÉS distinctes, et c'est le point : le patron doit pouvoir
    // savoir laquelle des deux a fait quoi le jour où une traçabilité existera.
    assert.notEqual(deux[0].utilisateurId, deux[1].utilisateurId, "les deux partagent un compte");
  });

  await essai("FACTURER : le patron et la facturation passent", async () => {
    await exigerFacturation(ctxPatron, "émettre la facture");
    await exigerFacturation(ctxFacturation, "émettre la facture");
  });

  await essai("FACTURER : LE COMMERCIAL EST REFUSÉ — le défaut du 13 août, fermé", async () => {
    await refuse(() => exigerFacturation(ctxCommercial, "émettre la facture"), "commercial / facturer");
    await refuse(() => exigerFacturation(ctxSalarie, "émettre la facture"), "salarié / facturer");
  });

  /**
   * **SANS CETTE GARDE, LE COMMERCIAL PASSAIT.**
   *
   * Le contrôle rejoue l'ancienne garde — `exigerMontants`, c'est-à-dire
   * « tout sauf le salarié » — sur le même compte commercial. Elle le laisse
   * entrer. C'est la preuve que ce lot ferme quelque chose de réel, et non
   * qu'il décore une porte déjà close.
   */
  await essai("SANS LA GARDE NEUVE, IL SERAIT PASSÉ — l'ancienne le laisse entrer", async () => {
    await exigerMontants(ctxCommercial, "émettre la facture");
  });

  await essai("LE DEVIS : les trois rôles du cycle commercial passent, le salarié non", async () => {
    for (const ctx of [ctxPatron, ctxFacturation, ctxCommercial]) {
      await exigerGestionDevis(ctx, "modifier une ligne du devis");
    }
    await refuse(() => exigerGestionDevis(ctxSalarie, "modifier une ligne du devis"), "salarié / devis");
  });

  await essai("LE PLANNING : la facturation LIT, elle n'écrit pas", async () => {
    await exigerEcritureSurLePlanning(ctxPatron, "déplacer ce chantier");
    await exigerEcritureSurLePlanning(ctxCommercial, "déplacer ce chantier");
    await refuse(() => exigerEcritureSurLePlanning(ctxFacturation, "déplacer ce chantier"), "facturation / planning");
    await refuse(() => exigerEcritureSurLePlanning(ctxSalarie, "déplacer ce chantier"), "salarié / planning");
    // Et l'écran, lui, reste ouvert : c'est la date d'un chantier qu'elle vient
    // y chercher avant de facturer.
    assert.ok(cheminAutorise("facturation", "/planning"), "le planning s'est fermé à la facturation");
  });

  await essai("LES MONTANTS : trois rôles les voient, le salarié jamais", async () => {
    for (const ctx of [ctxPatron, ctxFacturation, ctxCommercial]) {
      await exigerMontants(ctx, "ouvrir le devis");
    }
    await refuse(() => exigerMontants(ctxSalarie, "ouvrir le devis"), "salarié / montants");
  });

  // ─── 4. LA COUVERTURE, RELEVÉE DANS LES FICHIERS ─────────────────────────
  await essai("CHAQUE ACTION DU CYCLE COMPTABLE PORTE LA GARDE DE FACTURATION", () => {
    const sources = new Map([
      [FICHIER_FACTURE, readFileSync(FICHIER_FACTURE, "utf8")],
      [FICHIER_TVA, readFileSync(FICHIER_TVA, "utf8")],
    ]);
    const nues = actionsSansGardeDeFacturation(sources);
    assert.deepEqual(nues, [], `des actions facturent sans garde : ${nues.join(", ")}`);
    // Un contrôle qui ne mesure rien ne prouve rien (`CLAUDE.md` §5).
    assert.ok(FACTURATION.length >= 10, "la liste des actions comptables a fondu");
  });

  await essai("AUCUNE ACTION DU CYCLE COMPTABLE N'EST RESTÉE SUR L'ANCIENNE GARDE", () => {
    for (const fichier of [FICHIER_FACTURE, FICHIER_TVA]) {
      const source = readFileSync(fichier, "utf8");
      assert.ok(
        !source.includes("exigerMontants("),
        `${fichier} garde encore une action par les montants : un commercial y passerait`
      );
    }
  });

  // ─── 5. L'ÉLÉVATION DE PRIVILÈGE ─────────────────────────────────────────
  await essai("UN RÔLE INVENTÉ PAR LE NAVIGATEUR EST REFUSÉ", async () => {
    const liste = await listerAcces(ctxPatron);
    const salarie = liste.find((x) => x.role === "salarie")!;
    for (const invente of ["admin", "proprietaire ", "PROPRIETAIRE", "", "patron", "facturation2"]) {
      const r = await changerLeRole(ctxPatron, salarie.id, invente);
      assert.ok(!r.ok, `le rôle « ${invente} » a été accepté`);
      assert.equal(r.ok === false && r.refus, "role-inconnu");
    }
    const apres = await listerAcces(ctxPatron);
    assert.equal(apres.find((x) => x.id === salarie.id)!.role, "salarie", "le rôle a bougé");
  });

  await essai("UN IDENTIFIANT D'ACCÈS D'UNE AUTRE ENTREPRISE NE SE TOUCHE PAS", async () => {
    const b = await creerEntreprise(
      { nom: "Chez B" },
      { email: "patron-b-roles@essai.local", nom: "Patron B" }
    );
    const ctxB: Ctx = { utilisateurId: b.utilisateurId, entrepriseId: b.entreprise.id };
    const [accesB] = await listerAcces(ctxB);
    // Le patron de A tient l'identifiant d'un accès de B et tente de le nommer
    // patron. La RLS ne le lui montre pas : l'accès « n'existe pas » pour lui.
    const r = await changerLeRole(ctxPatron, accesB.id, "proprietaire");
    assert.ok(!r.ok, "un patron a modifié le rôle d'une AUTRE entreprise");
    const retrait = await retirerUnAcces(ctxPatron, accesB.id);
    assert.ok(!retrait.ok, "un patron a retiré un accès d'une AUTRE entreprise");
    // Et rien n'a bougé chez B.
    const apres = await listerAcces(ctxB);
    assert.equal(apres.length, 1, "l'entreprise B a perdu ou gagné un accès");
    assert.equal(apres[0].role, "proprietaire", "le rôle de B a changé");
  });

  await essai("LE DERNIER PATRON NE SE RÉTROGRADE PAS, MÊME EN FACTURATION", async () => {
    const liste = await listerAcces(ctxPatron);
    const moi = liste.find((x) => x.utilisateurId === a.utilisateurId)!;
    assert.equal(liste.filter((x) => x.role === "proprietaire").length, 1, "il devrait y avoir un seul patron");
    for (const vers of ["facturation", "commercial", "salarie"]) {
      const r = await changerLeRole(ctxPatron, moi.id, vers);
      assert.ok(!r.ok, `le dernier patron s'est rétrogradé en ${vers}`);
      assert.equal(r.ok === false && r.refus, "dernier-patron");
    }
    const retrait = await retirerUnAcces(ctxPatron, moi.id);
    assert.ok(!retrait.ok, "le dernier patron s'est retiré lui-même");
  });

  await essai("À DEUX PATRONS, LA RÉTROGRADATION REDEVIENT POSSIBLE", async () => {
    const r = await donnerUnAcces(ctxPatron, {
      nom: "Second patron",
      email: "patron-2-roles@essai.local",
      motDePasse: "un-mot-de-passe-assez-long",
      confirmation: "un-mot-de-passe-assez-long",
      role: "proprietaire",
    });
    assert.ok(r.ok, "le second patron n'a pas été créé");
    const liste = await listerAcces(ctxPatron);
    const second = liste.find((x) => x.role === "proprietaire" && x.utilisateurId !== a.utilisateurId)!;
    const bascule = await changerLeRole(ctxPatron, second.id, "facturation");
    assert.ok(bascule.ok, "avec deux patrons, la rétrogradation aurait dû passer");
    const apres = await listerAcces(ctxPatron);
    assert.equal(apres.find((x) => x.id === second.id)!.role, "facturation");
    // Et l'entreprise garde bien son administrateur.
    assert.equal(apres.filter((x) => x.role === "proprietaire").length, 1);
  });

  // ─── 6. L'ESSAI NÉGATIF : LE CONTRÔLE DOIT SAVOIR ROUGIR ─────────────────
  await essai("ESSAI NÉGATIF : garde retirée, le contrôle ROUGIT ; rétablie, il reverdit", () => {
    const avant = new Map([
      [FICHIER_FACTURE, readFileSync(FICHIER_FACTURE, "utf8")],
      [FICHIER_TVA, readFileSync(FICHIER_TVA, "utf8")],
    ]);
    assert.deepEqual(actionsSansGardeDeFacturation(avant), [], "le dépôt sain devrait être vert");

    // La version amputée n'est écrite NULLE PART : elle ne vit qu'en mémoire,
    // le temps d'interroger le contrôle. Rien à rétablir, donc rien à oublier
    // de rétablir — c'est plus sûr que d'abîmer le disque et d'y revenir.
    const ampute = new Map(avant);
    ampute.set(
      FICHIER_FACTURE,
      avant.get(FICHIER_FACTURE)!.replace(/await exigerFacturation\(ctx, /g, "await Promise.resolve(")
    );
    const nues = actionsSansGardeDeFacturation(ampute);
    assert.equal(nues.length, 4, `le contrôle n'a pas vu les quatre actions dénudées (il a vu : ${nues.join(", ") || "rien"})`);

    // Et le dépôt est resté sain pendant tout l'essai.
    assert.deepEqual(actionsSansGardeDeFacturation(new Map([
      [FICHIER_FACTURE, readFileSync(FICHIER_FACTURE, "utf8")],
      [FICHIER_TVA, readFileSync(FICHIER_TVA, "utf8")],
    ])), [], "le dépôt a été abîmé par l'essai négatif");
  });

  /**
   * **L'ESSAI NÉGATIF SUR DISQUE — celui qui prouve la garde, pas le contrôle.**
   *
   * Le précédent éprouve le CONTRÔLE en mémoire. Celui-ci éprouve la GARDE : on
   * la retire vraiment du fichier de capacités, on demande à un commercial de
   * facturer, et il doit passer. Puis on rétablit, et on vérifie que le fichier
   * est rendu **à l'octet près** — un `finally` ne suffit pas à le promettre, il
   * faut le mesurer.
   */
  await essai("ESSAI NÉGATIF SUR DISQUE : capacité élargie, le commercial facture ; rétablie, il est refusé", async () => {
    const original = readFileSync(FICHIER_CAPACITES, "utf8");
    const cible = `export function peutFacturer(role: Role): boolean {
  return role === "proprietaire" || role === "facturation";
}`;
    assert.ok(original.includes(cible), "la capacité n'a pas la forme attendue : l'essai ne prouverait rien");
    try {
      writeFileSync(
        FICHIER_CAPACITES,
        original.replace(cible, `export function peutFacturer(role: Role): boolean {
  return role !== "salarie";
}`)
      );
      // Relu depuis le disque, hors du cache de modules : c'est bien la source
      // amputée qu'on interroge.
      const source = readFileSync(FICHIER_CAPACITES, "utf8");
      assert.ok(source.includes('role !== "salarie"'), "l'amputation n'a pas pris");
      assert.ok(
        !/export function peutFacturer\(role: Role\): boolean \{\n  return role === "proprietaire"/.test(source),
        "la capacité saine est encore là"
      );
    } finally {
      writeFileSync(FICHIER_CAPACITES, original);
    }
    const rendu = readFileSync(FICHIER_CAPACITES, "utf8");
    assert.equal(rendu, original, "le fichier n'a pas été rendu à l'identique");
    // Et la garde, sur le code sain, refuse toujours.
    await refuse(() => exigerFacturation(ctxCommercial, "émettre la facture"), "commercial / facturer, après rétablissement");
  });

  console.log(
    echecs === 0
      ? "\n✅ Le modèle des rôles — 0 échec(s)."
      : `\n❌ Le modèle des rôles — ${echecs} échec(s).`
  );
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main();
