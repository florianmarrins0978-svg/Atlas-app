// UN SALARIÉ CONSULTE SON PLANNING. IL N'Y ÉCRIT RIEN.
//
// ═══════════════════════════════════════════════════════════════════════════
// **LA DÉCISION DU PATRON, 30 AOÛT 2026 :**
//
//   « Un salarié peut uniquement CONSULTER son planning. Il ne doit pouvoir
//     effectuer AUCUNE modification depuis le planning. »
//
// Aucune suppression, aucun déplacement, aucune replanification, aucune note,
// aucun changement d'équipe. Elle clôt la seule question que les deux lots
// précédents lui avaient renvoyée, et qu'ils avaient refusé de trancher à sa
// place (`garde-action.ts`, `test-actions-gardees-db.ts`).
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE PROUVE, ET DANS QUEL ORDRE.**
//
//   1. la RÈGLE dit non au salarié, oui aux deux autres ;
//   2. la GARDE, sous un vrai salarié en base, refuse pour de bon ;
//   3. **SANS elle, il serait passé** — la garde d'avant le laisse entrer. Ce
//      contrôle-là est le seul qui prouve que le lot sert à quelque chose ;
//   4. aucune action d'écriture ne l'oublie, et elle vient AVANT la portée ;
//   5. la LECTURE reste ouverte — sinon on lui a retiré son seul document ;
//   6. la PORTÉE n'a pas bougé — le patron a demandé qu'elle ne bouge pas ;
//   7. et l'essai négatif : garde retirée du fichier, le contrôle rougit ;
//      rétablie, il reverdit, et le fichier est rendu à l'octet près.
//
// **Ni l'écran ni les boutons n'entrent ici.** Ce qui se cache se remontre ;
// ce qui se refuse au serveur se refuse à qui fabrique la requête à la main.

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { donnerUnAcces, listerAcces, changerLaPortee } from "../src/server/repositories/membres-entreprise";
import { creerChantier } from "../src/server/repositories/chantiers";
import { nommerEquipe } from "../src/server/repositories/equipes";
import {
  exigerEcritureSurLePlanning,
  exigerChantierDansSaPortee,
  ActionRefuseeError,
} from "../src/server/garde-action";
import { peutModifierLePlanning, ROLES } from "../src/lib/acces-roles";
import { pool } from "../src/server/db/client";
import type { Ctx } from "../src/server/repositories/context";

const FICHIER_ACTIONS = join(process.cwd(), "src/app/planning/actions.ts");

/**
 * Les actions du planning qui ÉCRIVENT, avec ce qu'elles écrivent.
 *
 * **Écrite à la main, et c'est assumé ici** — au contraire de
 * `test-actions-gardees-db.ts`, qui énumère. Cette liste-ci ne sert pas à
 * trouver ce qu'on a oublié : elle nomme, une par une, les six choses que le
 * patron a interdites. Un oubli est attrapé par l'autre suite, qui relève tout
 * fichier « use server » ; celle-ci vérifie qu'aucune de SES six n'a été
 * rouverte, et qu'aucune ne s'est renommée sans qu'on s'en aperçoive.
 */
const ECRITURES = [
  ["planifierChantierAction", "poser un chantier à une date"],
  ["basculerEquipeAction", "changer l'équipe d'une demi-journée"],
  ["deplacerChantierAction", "déplacer un chantier dans la journée"],
  ["ecrireNoteChantierAction", "écrire le pense-bête"],
  ["deplanifierChantierAction", "retirer un chantier du planning"],
  ["supprimerChantierAction", "supprimer un chantier"],
] as const;

/** La seule qui LIT — la feuille de chantier sans un montant, son document. */
const LECTURE = "tachesDuChantierAction";

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

/** Le corps de chaque fonction exportée du fichier des actions du planning. */
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
 * Il prend la source en ARGUMENT plutôt que de la relire : c'est ce qui permet
 * de le confronter à une version amputée sans toucher au dépôt plus longtemps
 * que l'instant du contrôle. Rend la liste des manques, vide quand tout va bien.
 */
function actionsSansGarde(source: string): string[] {
  const corps = corpsDesActions(source);
  const nues: string[] = [];
  for (const [nom] of ECRITURES) {
    const c = corps.get(nom);
    // Une action disparue est un manque, pas une absence : renommée ailleurs,
    // elle écrirait sans garde sous un autre nom.
    if (c === undefined) {
      nues.push(`${nom} (introuvable)`);
      continue;
    }
    if (!c.includes("exigerEcritureSurLePlanning(")) nues.push(nom);
  }
  return nues;
}

async function main() {
  console.log("=== Le planning du salarié : lecture seule ===\n");

  // ─── 1. LA RÈGLE ─────────────────────────────────────────────────────────
  await essai("LA RÈGLE : le salarié ne modifie pas, le patron et le commercial si", () => {
    assert.equal(peutModifierLePlanning("salarie"), false, "un salarié peut modifier le planning");
    assert.equal(peutModifierLePlanning("proprietaire"), true, "le patron a perdu son droit");
    assert.equal(peutModifierLePlanning("commercial"), true, "le commercial a perdu son droit");
    // Refuser de conclure sur rien : le jour où un quatrième rôle naît, cette
    // règle doit avoir été relue plutôt que d'ouvrir en silence.
    // **Ce compte est un fil à la patte, et il a fait son travail le 30 août
    // 2026** : l'arrivée du rôle « Facturation » l'a fait rougir, ce qui a
    // obligé à rouvrir `peutModifierLePlanning` — écrite alors `!== "salarie"`,
    // elle aurait donné au rôle neuf le droit de déplacer et de supprimer des
    // chantiers, sans qu'aucune ligne ne change. Elle est depuis une liste
    // blanche. Le compte reste : le prochain rôle doit provoquer la même halte.
    assert.equal(ROLES.length, 4, "un rôle est apparu : la règle d'écriture n'a pas été relue");
    assert.equal(
      peutModifierLePlanning("facturation"),
      false,
      "la facturation écrit sur le planning : sa consigne du 30 août dit le contraire"
    );
  });

  // ─── LE DÉCOR : une entreprise, ses trois rôles, un chantier ─────────────
  await nettoyerBase();
  const a = await creerEntreprise(
    { nom: "Chez A" },
    { email: "patron-lecture@essai.local", nom: "Patron" }
  );
  const ctxPatron: Ctx = { utilisateurId: a.utilisateurId, entrepriseId: a.entreprise.id };

  for (const [role, email] of [
    ["salarie", "salarie-lecture@essai.local"],
    ["commercial", "commercial-lecture@essai.local"],
  ] as const) {
    await donnerUnAcces(ctxPatron, {
      nom: `Essai ${role}`,
      email,
      motDePasse: "mot-de-passe-assez-long-1234",
      confirmation: "mot-de-passe-assez-long-1234",
      role,
    });
  }
  const membres = await listerAcces(ctxPatron);
  const salarie = membres.find((m) => m.role === "salarie");
  const commercial = membres.find((m) => m.role === "commercial");
  const chantier = await creerChantier(ctxPatron, { nom: "Haie de Mme Dupont" });

  await essai("le décor existe — sinon rien n'est éprouvé", () => {
    assert.ok(salarie, "le salarié n'a pas été créé");
    assert.ok(commercial, "le commercial n'a pas été créé");
    assert.ok(chantier?.id, "le chantier n'a pas été créé");
  });

  const ctxSalarie: Ctx = { utilisateurId: salarie!.utilisateurId, entrepriseId: a.entreprise.id };
  const ctxCommercial: Ctx = { utilisateurId: commercial!.utilisateurId, entrepriseId: a.entreprise.id };

  // ─── 2. LA GARDE REFUSE — chacun des six gestes, nommément ───────────────
  for (const [nom, geste] of ECRITURES) {
    await essai(`LE SALARIÉ NE PEUT PAS ${geste} — ${nom}`, async () => {
      await assert.rejects(
        () => exigerEcritureSurLePlanning(ctxSalarie, geste),
        (e: unknown) => e instanceof ActionRefuseeError,
        `un salarié peut ${geste} : la décision du patron n'est pas appliquée`
      );
    });
  }

  // ─── 3. L'ESSAI QUI PROUVE QUE CE LOT SERT À QUELQUE CHOSE ───────────────
  await essai("SANS CETTE GARDE, IL SERAIT PASSÉ — la garde d'avant le laisse entrer", async () => {
    /**
     * **Le contrôle négatif permanent, et il ne touche à aucun fichier.**
     *
     * Avant ce lot, les six actions ne vérifiaient QUE la portée. Avec la
     * portée par défaut — « tout », l'état de départ —, `exigerChantierDansSaPortee`
     * sort immédiatement sans rien refuser : un salarié supprimait donc
     * n'importe quel chantier de l'entreprise.
     *
     * Si cette ligne se mettait un jour à rejeter, ce ne serait pas une bonne
     * nouvelle : cela voudrait dire que le refus vient d'ailleurs, et l'essai
     * ci-dessus deviendrait vert pour la mauvaise raison — le pire des faux
     * verts, celui qui rassure.
     */
    await exigerChantierDansSaPortee(ctxSalarie, chantier.id, "supprimer ce chantier");
  });

  // ─── 4. LES DEUX AUTRES RÔLES N'ONT RIEN PERDU ──────────────────────────
  await essai("LE PATRON garde exactement ses droits", async () => {
    for (const [, geste] of ECRITURES) await exigerEcritureSurLePlanning(ctxPatron, geste);
  });

  await essai("LE COMMERCIAL garde exactement ses droits — rien n'a été resserré sur lui", async () => {
    // Le patron l'a demandé mot pour mot : ne pas toucher au commercial sauf
    // nécessité. Sans ce contrôle, on aurait pu fermer large et croire l'appli
    // sûre en ayant cassé le métier de quelqu'un.
    //
    // **Et ce n'est plus un non-changement : il l'a CONFIRMÉ le 30 août 2026**,
    // à la question posée telle quelle. Ce contrôle défend donc une décision,
    // pas un reste — le resserrer demande une seconde décision de sa part.
    for (const [, geste] of ECRITURES) await exigerEcritureSurLePlanning(ctxCommercial, geste);
  });

  await essai("un compte d'une AUTRE entreprise est refusé, une couche plus bas", async () => {
    // Le refus n'est pas `ActionRefuseeError` : `getRole` passe par
    // `withEntreprise`, qui lève « n'est pas membre » avant qu'un rôle soit lu.
    // Ce qui compte n'est pas la classe mais que le refus EXISTE, à deux
    // étages plutôt qu'un.
    const b = await creerEntreprise(
      { nom: "Chez B" },
      { email: "patron-b-lecture@essai.local", nom: "Patron B" }
    );
    const intrus: Ctx = { utilisateurId: b.utilisateurId, entrepriseId: a.entreprise.id };
    await assert.rejects(
      () => exigerEcritureSurLePlanning(intrus, "supprimer ce chantier"),
      (e: unknown) => e instanceof Error
    );
  });

  // ─── 5. AUCUNE ACTION D'ÉCRITURE NE L'OUBLIE ────────────────────────────
  const SOURCE = readFileSync(FICHIER_ACTIONS, "utf8");

  await essai("CHAQUE action d'écriture du planning porte la garde", () => {
    const nues = actionsSansGarde(SOURCE);
    assert.deepEqual(
      nues,
      [],
      `Ces actions du planning écrivent sans garde d'écriture :\n      ${nues.join("\n      ")}\n` +
        "    Un salarié peut les poster avec sa session — l'écran ne les protège pas.\n" +
        '    Ajouter en première ligne : await exigerEcritureSurLePlanning(ctx, "…");'
    );
  });

  await essai("LA GARDE VIENT AVANT LA PORTÉE — l'ordre n'est pas indifférent", () => {
    /**
     * `exigerChantierDansSaPortee` interroge la base : l'équipe de la personne,
     * puis les chantiers de cette équipe. Un salarié doit être refusé sans
     * qu'on paie ces deux requêtes — et surtout sans qu'un chantier hors portée
     * réponde plus lentement qu'un chantier de son équipe. Ce délai-là se
     * mesure, et il dirait à qui cherche lesquels sont les siens.
     */
    const corps = corpsDesActions(SOURCE);
    const mauvaises: string[] = [];
    for (const [nom] of ECRITURES) {
      const c = corps.get(nom)!;
      const ecriture = c.indexOf("exigerEcritureSurLePlanning(");
      const portee = c.indexOf("exigerChantierDansSaPortee(");
      if (ecriture === -1 || portee === -1 || ecriture > portee) mauvaises.push(nom);
    }
    assert.deepEqual(mauvaises, [], `la garde d'écriture passe après la portée dans : ${mauvaises.join(", ")}`);
  });

  await essai("LA LECTURE RESTE OUVERTE — sinon on lui retire son seul document", () => {
    // Sa feuille de chantier sans montants, décidée le 21 août 2026. Un refus
    // trop large passerait ici pour une réussite : c'est le contrôle qui
    // empêche de « sécuriser » en fermant tout.
    const corps = corpsDesActions(SOURCE);
    const c = corps.get(LECTURE);
    assert.ok(c, `${LECTURE} a disparu : le salarié n'a plus de feuille de chantier`);
    assert.ok(
      !c.includes("exigerEcritureSurLePlanning("),
      `${LECTURE} est une LECTURE : la garder en écriture ferme au salarié la feuille sans montants`
    );
  });

  await essai("LA PORTÉE N'A PAS BOUGÉ — le patron a demandé qu'elle ne bouge pas", () => {
    // Sa décision concerne les droits d'ÉCRITURE, pas le périmètre de lecture.
    // Les sept actions — les six écritures ET la lecture — gardent leur portée.
    const corps = corpsDesActions(SOURCE);
    const sansPortee: string[] = [];
    for (const nom of [...ECRITURES.map(([n]) => n), LECTURE]) {
      const c = corps.get(nom);
      if (!c || !c.includes("exigerChantierDansSaPortee(")) sansPortee.push(nom);
    }
    assert.deepEqual(sansPortee, [], `la portée a été perdue sur : ${sansPortee.join(", ")}`);
  });

  // ─── 6. LA PORTÉE RESSERRÉE NE ROUVRE RIEN ──────────────────────────────
  await essai("RESSERRÉ SUR SON ÉQUIPE, IL RESTE REFUSÉ — même sur SES chantiers", async () => {
    /**
     * Le piège que ce contrôle ferme : croire que « lecture seule » et
     * « portée » se remplacent. Un salarié resserré sur son équipe VOIT ses
     * chantiers — et il ne doit pas davantage y toucher. Les deux règles se
     * cumulent ; aucune ne dispense de l'autre.
     */
    const equipe = await nommerEquipe(ctxPatron, 1, "Équipe A");
    const r = await changerLaPortee(ctxPatron, salarie!.id, "ses_equipes", equipe.id);
    assert.deepEqual(r, { ok: true }, "le resserrement de la portée a été refusé");
    await assert.rejects(
      () => exigerEcritureSurLePlanning(ctxSalarie, "supprimer ce chantier"),
      (e: unknown) => e instanceof ActionRefuseeError,
      "resserré sur son équipe, un salarié écrit à nouveau"
    );
  });

  // ─── 7. L'ESSAI NÉGATIF SUR LE FICHIER ──────────────────────────────────
  await essai("ESSAI NÉGATIF : garde retirée, le contrôle ROUGIT ; rétablie, il reverdit", () => {
    /**
     * **Un contrôle qui n'a jamais échoué ne prouve rien** (`AGENTS.md`). Celui
     * du dessus lit une source : on lui donne donc la source amputée, et il
     * doit dénoncer exactement les six.
     *
     * **Le fichier est réécrit sur le disque**, parce que le patron l'a demandé
     * ainsi — « tu retires volontairement la garde serveur ». Il est rendu dans
     * un `finally`, puis comparé à l'octet près : un contrôle qui laisserait le
     * dépôt entamé serait pire que le défaut qu'il traque.
     */
    const ampute = SOURCE.replace(/^ +await exigerEcritureSurLePlanning\(.*\);\n/gm, "");
    assert.notEqual(ampute, SOURCE, "aucune garde n'a été retirée : l'essai négatif ne mesurerait rien");

    try {
      writeFileSync(FICHIER_ACTIONS, ampute, "utf8");
      const relu = readFileSync(FICHIER_ACTIONS, "utf8");
      const nues = actionsSansGarde(relu);
      assert.deepEqual(
        nues.sort(),
        ECRITURES.map(([n]) => n).sort(),
        "la garde a été retirée et le contrôle est resté vert : il ne défend rien"
      );
    } finally {
      writeFileSync(FICHIER_ACTIONS, SOURCE, "utf8");
    }

    const rendu = readFileSync(FICHIER_ACTIONS, "utf8");
    assert.equal(rendu, SOURCE, "le fichier n'a pas été rendu à l'identique");
    assert.deepEqual(actionsSansGarde(rendu), [], "la protection n'est pas revenue");
  });

  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Planning en lecture seule — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("❌ Suite interrompue :", e instanceof Error ? e.message : e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
