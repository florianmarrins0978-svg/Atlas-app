import assert from "node:assert";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { FICHES_MODE_EMPLOI, chercherFiches, type FicheModeEmploi } from "../src/lib/mode-emploi";
import { rechercherModeEmploi } from "../src/server/ai/tools/rechercher-mode-emploi";

/**
 * Le mode d'emploi que récite l'assistant, confronté au CODE.
 *
 * **Pourquoi cette suite existe.** Une fiche dit un geste — « glissez, puis
 * Retirer ». Le jour où ce bouton change de nom, disparaît, ou change d'écran,
 * l'assistant continuerait de l'enseigner : l'artisan chercherait cinq minutes
 * avant de conclure que l'application est cassée. Une documentation périmée est
 * pire qu'absente, on s'y fie encore (`CLAUDE.md` §1).
 *
 * Chaque fiche porte donc son fichier source et des `preuves` — des morceaux de
 * texte qui doivent s'y trouver. C'est cette confrontation qui est éprouvée
 * ici, et rien d'autre.
 */

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const RACINE = path.join(__dirname, "..");

/**
 * Le fichier source SANS ses commentaires.
 *
 * **Payé le 24 septembre 2026.** La fiche « termines-facturer » enseignait
 * l'onglet « À facturer », parti le 13 septembre : sa preuve passait quand
 * même, parce que le commentaire qui racontait le départ de l'onglet citait
 * son nom. Un commentaire n'est pas peint à l'écran ; ce qui prouve un geste,
 * c'est le code.
 *
 * **Les commentaires sont lus par l'analyseur de TypeScript, pas par une
 * expression régulière** : celle-ci aurait coupé « https:// » en deux. Et ils
 * sont BLANCHIS sur place plutôt que le fichier réimprimé, parce que
 * l'imprimeur récrit « Préparer » en « Préparer » : toutes les preuves
 * accentuées seraient tombées à tort.
 */
function codeSansCommentaires(chemin: string, texte: string): string {
  const fichier = ts.createSourceFile(chemin, texte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const plages: [number, number][] = [];
  const visiter = (noeud: ts.Node) => {
    // Un `{/* … */}` d'écran n'a pas d'expression : il n'est QUE commentaire.
    if (ts.isJsxExpression(noeud) && !noeud.expression) {
      plages.push([noeud.getStart(fichier), noeud.end]);
      return;
    }
    for (const r of ts.getLeadingCommentRanges(texte, noeud.pos) ?? []) plages.push([r.pos, r.end]);
    // Le texte d'un écran peut contenir « // » sans être un commentaire.
    if (noeud.kind === ts.SyntaxKind.JsxText) return;
    for (const enfant of noeud.getChildren(fichier)) visiter(enfant);
  };
  visiter(fichier);
  let propre = texte;
  for (const [debut, fin] of plages) {
    propre = propre.slice(0, debut) + " ".repeat(fin - debut) + propre.slice(fin);
  }
  return propre;
}

/**
 * Ce qu'une fiche doit prouver — extrait pour pouvoir être RETOURNÉ contre une
 * fausse fiche plus bas. Un contrôle qui n'a jamais échoué ne prouve rien
 * (`AGENTS.md`).
 */
function defautsDeLaFiche(fiche: FicheModeEmploi): string[] {
  const defauts: string[] = [];
  for (const { source: fichier, preuves } of [{ source: fiche.source, preuves: fiche.preuves }, ...(fiche.ailleurs ?? [])]) {
    const complet = path.join(RACINE, fichier);
    if (!existsSync(complet)) {
      defauts.push(`le fichier ${fichier} n'existe pas`);
      continue;
    }
    const code = codeSansCommentaires(complet, readFileSync(complet, "utf8"));
    for (const preuve of preuves) {
      if (!code.includes(preuve)) defauts.push(`« ${preuve} » ne se trouve plus dans ${fichier}`);
    }
  }
  for (const absent of fiche.absences ?? []) {
    const ou = codeDeSrc().find(([, code]) => code.includes(absent));
    if (ou) defauts.push(`« ${absent} » est arrivé dans ${ou[0]} : la fiche dit encore que ça n'existe pas`);
  }
  return defauts;
}

/** Tout `src/`, sans commentaires — lu une fois, pour les fiches qui disent « pas encore ». */
let cacheSrc: [string, string][] | null = null;
function codeDeSrc(): [string, string][] {
  if (cacheSrc) return cacheSrc;
  const fichiers = (readdirSync(path.join(RACINE, "src"), { recursive: true }) as string[]).filter((f) =>
    /\.(ts|tsx)$/.test(f)
  );
  cacheSrc = fichiers
    // Le mode d'emploi cite ce qui manque : il ne peut pas se prouver présent.
    .filter((f) => !f.endsWith(path.join("lib", "mode-emploi.ts")))
    .map((f) => {
      const complet = path.join(RACINE, "src", f);
      return [path.join("src", f), codeSansCommentaires(complet, readFileSync(complet, "utf8"))];
    });
  return cacheSrc;
}

async function main() {
  await test("Chaque fiche prouve son geste contre son fichier source", () => {
    const defauts = FICHES_MODE_EMPLOI.flatMap((f) => defautsDeLaFiche(f).map((d) => `${f.id} : ${d}`));
    assert.deepEqual(
      defauts,
      [],
      `Le code a bougé sous le mode d'emploi. Corrigez la fiche AVANT que l'assistant n'enseigne un geste mort :\n${defauts.join("\n")}`
    );
  });

  await test("Le contrôle sait échouer : une fiche qui invente un bouton est refusée", () => {
    const inventee: FicheModeEmploi = {
      id: "inventee",
      ecran: "Chantiers",
      ou: "nulle part",
      intitule: "Un geste qui n'existe pas",
      motsCles: ["inventer"],
      geste: "Appuyez sur « Supprimer définitivement ».",
      source: "src/app/EcranChantiers.tsx",
      preuves: ["Supprimer définitivement"],
    };
    assert.equal(defautsDeLaFiche(inventee).length, 1, "Une preuve absente du code doit être signalée");
  });

  await test("Le contrôle sait échouer : un fichier source disparu est signalé", () => {
    const orpheline: FicheModeEmploi = {
      ...FICHES_MODE_EMPLOI[0],
      id: "orpheline",
      source: "src/app/EcranQuiNExistePas.tsx",
    };
    assert.equal(defautsDeLaFiche(orpheline).length, 1);
  });

  await test("Aucun identifiant en double", () => {
    const ids = FICHES_MODE_EMPLOI.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length, "Deux fiches portent le même identifiant");
  });

  await test("Chaque fiche porte un geste, un écran et au moins une preuve", () => {
    for (const f of FICHES_MODE_EMPLOI) {
      assert.ok(f.geste.trim().length > 10, `${f.id} : le geste est vide ou trop court`);
      assert.ok(f.ecran.trim().length > 0, `${f.id} : pas d'écran`);
      assert.ok(f.motsCles.length >= 3, `${f.id} : trop peu de mots-clés pour être retrouvée`);
      assert.ok(f.preuves.length >= 1, `${f.id} : aucune preuve — la fiche ne peut plus être confrontée au code`);
    }
  });

  // **Sa règle du 25 août 2026 : « arrête de mettre des flèches, c'est moche ».**
  // Elle vise l'ORNEMENT — la flèche au bout d'un libellé —, pas le chevron qui
  // porte une vraie fonction : « ‹ » et « › » désignent le feuilletage des
  // semaines, et les nommer est le seul moyen de dire où appuyer. Le contrôle
  // fait donc la même distinction que la règle, sinon il réclamerait le
  // contraire de ce qui est à l'écran (`CLAUDE.md` §5 bis).
  await test("Aucune flèche décorative au bout d'un geste (sa règle du 25 août 2026)", () => {
    for (const f of FICHES_MODE_EMPLOI) {
      const texte = `${f.geste} ${f.intitule} ${f.reserve ?? ""}`;
      assert.ok(!texte.includes("→"), `${f.id} : la flèche « → » est de l'ornement`);
      assert.ok(!/[›‹]\s*$/.test(f.geste.trim()), `${f.id} : chevron décoratif en fin de geste`);
    }
  });

  // --- Ce qu'il demandera vraiment ---------------------------------------
  //
  // La question de sa demande du 25 août 2026, mot pour mot, et la réponse
  // qu'il attend. Si un jour elle ne sort plus, c'est la recherche qu'il faut
  // corriger — pas la question.
  await test("Sa question du 25 août ressort le glissement, mot pour mot", () => {
    const fiches = chercherFiches(
      "comment je fais pour supprimer un client en attente de rédaction de son devis sur la page chantier"
    );
    assert.ok(fiches.length > 0, "Aucune fiche trouvée pour sa question");
    assert.equal(fiches[0].id, "chantiers-retirer");
    assert.match(fiches[0].geste, /Glissez la ligne de droite à gauche/);
    assert.match(fiches[0].geste, /Retirer/);
  });

  const ATTENDUS: [string, string][] = [
    ["comment changer mon mot de passe", "reglages-mot-de-passe"],
    ["comment envoyer le devis au client", "devis-envoyer"],
    ["comment on fait une facture", "facture-creer"],
    ["comment je déplace un chantier sur le planning", "planning-deplacer"],
    ["où je vois ma tva", "tva"],
    ["comment ajouter une photo", "photos-ajouter"],
    ["comment faire une remise à mon client", "devis-remise"],
    ["comment corriger un devis déjà envoyé", "devis-corriger-envoye"],
    ["comment dicter mon chantier", "fiche-note-vocale"],
    ["comment relier mon agenda google", "reglages-agenda"],
    ["comment ajouter un tarif", "reglages-tarifs"],
    ["comment mettre face id", "reglages-face-id"],
    ["comment changer le siret de mon entreprise", "reglages-identite"],
    ["je veux mettre le mode sombre", "reglages-apparence"],
    ["comment donner la feuille de chantier à mes gars sans les prix", "planning-feuille"],
    ["comment télécharger mes données", "reglages-donnees"],
    // **Sa demande du 24 septembre 2026 :** *« s'il cherche une touche ou
    // l'endroit où on range les devis, facture, avoir, fiche de sécurité, fiche
    // d'intervention, n'importe quoi, il DOIT pouvoir lui répondre »*. Avant ce
    // lot, les avoirs ne rendaient RIEN, « où sont mes factures » rendait la
    // création d'une facture, et la fiche de sécurité rendait la fiche
    // d'entretien de Paysage.
    ["où sont mes factures", "ou-factures"],
    ["où je retrouve une facture envoyée", "ou-factures"],
    ["où sont mes devis", "ou-devis"],
    ["où je range les devis", "ou-devis"],
    ["où sont les avoirs", "avoir"],
    ["comment je fais un avoir", "avoir"],
    ["où est la fiche de sécurité", "fiche-securite-retrouver"],
    ["comment remplir la fiche de sécurité", "fiche-securite-remplir"],
    ["où est la fiche d'intervention", "planning-fiche-intervention"],
    ["où est le planning", "ecran-planning"],
    ["où sont les chantiers terminés", "ecran-termines"],
    ["où sont les réglages", "ecran-reglages"],
    ["où est l'arrosage", "ecran-paysage"],
    ["où est la liste de mes clients", "clients-liste"],
    ["où sont les retours d'intervention", "termines-retours"],
    ["comment faire une facture sans devis", "termines-creer-facture"],
    ["il m'a payé comment je le note", "facture-payee"],
    ["où sont les factures pas encore payées", "facture-payee"],
    ["où sont les fiches de chantier envoyées", "ou-fiches-envoyees"],
    ["je trouve pas le bouton pour envoyer le devis", "devis-envoyer"],
    ["comment ajouter un salarié", "reglages-donner-acces"],
    ["comment voir mes clients", "clients-liste"],
    ["comment on encaisse un paiement", "facture-payee"],
  ];

  await test("Les questions telles qu'il les pose retrouvent la bonne fiche", () => {
    const ecarts = ATTENDUS.filter(([question, attendu]) => chercherFiches(question)[0]?.id !== attendu).map(
      ([question, attendu]) => `« ${question} » → ${chercherFiches(question)[0]?.id ?? "(rien)"} au lieu de ${attendu}`
    );
    assert.deepEqual(ecarts, [], ecarts.join("\n"));
  });

  await test("Une question qui n'en est pas une ne rend RIEN", () => {
    // Le refus est la moitié de l'intérêt : sans lui, l'assistant répondrait
    // toujours quelque chose, et l'on cesserait de le croire.
    for (const hors of ["quel temps fait-il à Nantes", "combien coûte un abattage de chêne", "bonjour"]) {
      assert.deepEqual(chercherFiches(hors), [], `« ${hors} » ne devrait rien trouver`);
    }
  });

  await test("Une question vide ne rend rien plutôt que la première fiche venue", () => {
    assert.deepEqual(chercherFiches(""), []);
    assert.deepEqual(chercherFiches("   "), []);
  });

  await test("Le contrôle sait échouer : une preuve qui ne vit que dans un commentaire est refusée", () => {
    // « À facturer » n'existe plus à l'écran de Terminés que dans le
    // commentaire qui raconte son départ.
    const fantome: FicheModeEmploi = {
      ...FICHES_MODE_EMPLOI[0],
      id: "fantome",
      source: "src/app/termines/ListeTermines.tsx",
      preuves: ["l'onglet est parti le 13 septembre 2026"],
    };
    assert.equal(defautsDeLaFiche(fantome).length, 1, "Un commentaire ne prouve pas un bouton");
  });

  // --- Le sommaire : ce que le vrai modèle lit quand les mots ne suffisent pas
  //
  // La recherche par mots rate les tournures qu'aucun mot-clé n'a prévues
  // (« la touche », « c'est rangé où »). Le modèle, lui, les comprend : il
  // reçoit la liste des fiches par leur intitulé et redemande celle qui
  // répond, par son identifiant. Le geste récité vient toujours de la fiche.
  const contexte = {} as Parameters<typeof rechercherModeEmploi.executer>[0];

  await test("Rien trouvé : l'outil rend le sommaire, pas seulement un refus", async () => {
    const r = (await rechercherModeEmploi.executer(contexte, { question: "zzz qqq www" })) as {
      trouve: boolean;
      sommaire?: { id: string; ecran: string; intitule: string }[];
    };
    assert.equal(r.trouve, false);
    assert.equal(r.sommaire?.length, FICHES_MODE_EMPLOI.length, "Le sommaire doit porter toutes les fiches");
    assert.ok(r.sommaire?.every((s) => s.id && s.intitule && s.ecran));
  });

  await test("Une fiche se redemande par son identifiant, et sort telle qu'elle est écrite", async () => {
    const r = (await rechercherModeEmploi.executer(contexte, { fiche: "chantiers-retirer" })) as {
      trouve: boolean;
      fiches?: { geste: string }[];
    };
    assert.equal(r.trouve, true);
    assert.equal(r.fiches?.[0].geste, FICHES_MODE_EMPLOI.find((f) => f.id === "chantiers-retirer")!.geste);
  });

  await test("Le sommaire se demande aussi quand des fiches sont sorties, mais pas la bonne", async () => {
    const r = (await rechercherModeEmploi.executer(contexte, { sommaire: true })) as {
      sommaire?: { id: string }[];
    };
    assert.equal(r.sommaire?.length, FICHES_MODE_EMPLOI.length);
  });

  await test("Un identifiant inventé ne rend pas une fiche au hasard", async () => {
    const r = (await rechercherModeEmploi.executer(contexte, { fiche: "bouton-magique" })) as { trouve: boolean };
    assert.equal(r.trouve, false);
  });

  await test("Une fiche de lieu dit par quel onglet du bas on y entre", () => {
    // Il lit sur un téléphone, souvent depuis un autre écran : « l'écran
    // Terminés » ne dit pas où il est, « Terminés, dans la barre du bas » si.
    const onglets = ["Chantiers", "Planning", "Terminés", "Paysage", "Réglages"];
    const floues = FICHES_MODE_EMPLOI.filter((f) => f.lieu && !onglets.some((o) => f.ou.includes(`« ${o} »`))).map(
      (f) => `${f.id} : « ${f.ou} »`
    );
    assert.deepEqual(floues, [], floues.join("\n"));
  });

  await test("Le contrôle sait échouer : une fiche « pas encore » rougit quand l'écran arrive", () => {
    const perimee: FicheModeEmploi = {
      ...FICHES_MODE_EMPLOI[0],
      id: "perimee",
      // Un libellé qui existe bel et bien dans `src/`.
      absences: ["Vos clients"],
    };
    assert.equal(defautsDeLaFiche(perimee).length, 1);
  });

  await test("Le contrôle sait échouer : une preuve fausse sur le chemin est signalée", () => {
    const cassee: FicheModeEmploi = {
      ...FICHES_MODE_EMPLOI[0],
      id: "cassee",
      ailleurs: [{ source: "src/app/EcranChantiers.tsx", preuves: ["Un bouton qui n'existe pas"] }],
    };
    assert.equal(defautsDeLaFiche(cassee).length, 1);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  if (failed > 0) process.exit(1);
}

void main();
