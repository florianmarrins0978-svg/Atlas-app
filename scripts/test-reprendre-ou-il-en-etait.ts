import assert from "node:assert/strict";
import {
  getNextAction,
  getStatutAffiche,
  getNextActionHref,
  lienDeReprise,
  statutLabel,
  type EtatChantierPourAction,
} from "../src/lib/chantier-etat";

// **« Il n'y a pas de mémoire dans les actions. »** — le patron, 13 août 2026.
//
// Sa séquence, mot pour mot : *« J'étais en train de rédiger le devis, j'ai
// finalisé de rédiger mon devis, j'allais l'envoyer au client. Je me suis
// trompé dans le prix, donc j'ai cliqué pour modifier mon devis. J'ai
// enregistré le nouveau prix, puis j'ai fait retour sans faire exprès. Le
// problème, c'est que si maintenant je reclique sur mon chantier [...] je suis
// obligé de refaire toutes les étapes une à une, alors que j'étais déjà arrivé
// à la toute fin, il ne me manquait plus qu'à envoyer le devis. »*
//
// **Ce qu'il avait perdu n'était pas son travail, c'était sa place** — et rien
// ne le lui disait. Les deux fonctions ci-dessous lisaient la chaîne DEPUIS LE
// DÉBUT et s'arrêtaient au premier trou : un devis rédigé à la main, donc sans
// passer par l'écran « Informations », laissait `informationsVerifieesAt` vide.
// La fiche proposait alors « Ajouter des photos » et la liste affichait
// « Brouillon », sur un chantier dont le devis n'attendait plus que son envoi.
//
// Cette suite tient la règle qui remplace celle-là : **on repart du point le
// plus avancé, jamais du premier maillon manquant.** Elle sait échouer —
// remettre `getNextAction` dans l'ordre d'avant rougit le premier cas, et
// retirer la ligne `devis_pret` de `getStatutAffiche` rougit le second.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const JADIS = new Date("2026-08-13T09:00:00Z");

/** Un chantier neuf : rien n'a été fait. */
// Typé explicitement : sans cela, `null` se déduit en type `null` et les jalons
// posés plus bas ne s'y glissent plus.
const NEUF: EtatChantierPourAction = {
  photosCount: 0,
  aUneNoteVocale: false,
  informationsVerifieesAt: null,
  prixValideAt: null,
  devisGenereAt: null,
  devisEnvoyeAt: null,
  datePlanifiee: null,
};

console.log("=== Reprendre où il en était ===\n");

// ─── SON cas, celui du 13 août ─────────────────────────────────────────────

cas("SON CAS : devis rédigé à la main, il ne reste qu'à l'envoyer", () => {
  // Le devis existe, le prix est posé — mais les informations n'ont jamais été
  // « vérifiées », puisqu'il a écrit son devis lui-même. C'est exactement l'état
  // de son chantier quand il est revenu dessus.
  const action = getNextAction({
    ...NEUF,
    prixValideAt: JADIS,
    devisGenereAt: JADIS,
  });
  assert.equal(action?.key, "devis-consulter", "l'écran le renvoie en amont de son travail");
  assert.match(
    action?.label ?? "",
    /Envoyer le devis/,
    "le libellé ne dit pas le geste qui reste — c'était le seul qui manquait"
  );
});

cas("SON CAS : la liste ne dit plus « Brouillon » sur un devis prêt", () => {
  const statut = getStatutAffiche(
    {
      photosCount: 0,
      aUneNoteVocale: false,
      informationsVerifieesAt: null,
      devisGenereAt: JADIS,
      devisEnvoyeAt: null,
      datePlanifiee: null,
    },
    new Date("2026-08-13T14:00:00Z")
  );
  assert.equal(statut, "devis_pret", "un devis écrit était annoncé comme « rien n'a été fait »");
  assert.equal(statutLabel.devis_pret, "Devis prêt à envoyer");
});

// ─── La règle, sur toute la chaîne ─────────────────────────────────────────

cas("un jalon franchi commande, même si tout l'amont manque", () => {
  // Chaque cas saute délibérément TOUT ce qui précède : c'est la voie normale
  // depuis que la chaîne va de la dictée au devis d'un seul geste.
  const attendus: [Partial<EtatChantierPourAction>, string][] = [
    [{ datePlanifiee: "2026-09-01" }, "aucune"],
    [{ devisEnvoyeAt: JADIS }, "planifier"],
    [{ devisGenereAt: JADIS }, "devis-consulter"],
    [{ prixValideAt: JADIS }, "devis-preparer"],
    [{ informationsVerifieesAt: JADIS }, "prix"],
    [{ aUneNoteVocale: true }, "informations"],
    [{ photosCount: 3 }, "note-vocale"],
    [{}, "photos"],
  ];
  for (const [jalon, attendu] of attendus) {
    const obtenu = getNextAction({ ...NEUF, ...jalon })?.key ?? "aucune";
    assert.equal(obtenu, attendu, `${JSON.stringify(jalon)} → « ${obtenu} » au lieu de « ${attendu} »`);
  }
});

cas("le jalon le plus avancé l'emporte, jamais l'inverse", () => {
  // Un chantier complet ne doit pas être ramené en arrière par la présence
  // d'une étape amont : c'est le même défaut, vu de l'autre côté.
  assert.equal(
    getNextAction({
      photosCount: 5,
      aUneNoteVocale: true,
      informationsVerifieesAt: JADIS,
      prixValideAt: JADIS,
      devisGenereAt: JADIS,
      devisEnvoyeAt: JADIS,
      datePlanifiee: null,
    })?.key,
    "planifier"
  );
});

cas("la règle d'avant survit : effacer la note vocale ne ramène pas à la dictée", () => {
  // Elle existait déjà et avait sa raison : « le travail de saisie est fait, et
  // redemander une dictée donnerait l'impression d'avoir tout perdu ». Elle
  // devient un cas particulier de la nouvelle règle — mais elle doit tenir.
  assert.equal(
    getNextAction({ ...NEUF, photosCount: 0, aUneNoteVocale: false, informationsVerifieesAt: JADIS })?.key,
    "prix"
  );
});

cas("un chantier vraiment neuf commence bien par le commencement", () => {
  assert.equal(getNextAction(NEUF)?.key, "photos");
  assert.equal(
    getStatutAffiche(
      { photosCount: 0, aUneNoteVocale: false, informationsVerifieesAt: null, devisGenereAt: null, devisEnvoyeAt: null, datePlanifiee: null },
      new Date("2026-08-13T14:00:00Z")
    ),
    "brouillon",
    "un chantier neuf doit rester un brouillon — sinon le nouvel état ment dans l'autre sens"
  );
});

// ─── Ce que le nouvel état ne doit PAS écraser ─────────────────────────────

cas("un devis parti reste « envoyé », il ne redevient pas « prêt »", () => {
  assert.equal(
    getStatutAffiche(
      {
        photosCount: 0,
        aUneNoteVocale: false,
        informationsVerifieesAt: null,
        devisGenereAt: JADIS,
        devisEnvoyeAt: JADIS,
        datePlanifiee: null,
      },
      new Date("2026-08-13T14:00:00Z")
    ),
    "devis_envoye"
  );
});

cas("un chantier planifié ou facturé garde son état de fin", () => {
  const base = {
    photosCount: 0,
    aUneNoteVocale: false,
    informationsVerifieesAt: null,
    devisGenereAt: JADIS,
    devisEnvoyeAt: JADIS,
  };
  const maintenant = new Date("2026-08-13T14:00:00Z");
  assert.equal(getStatutAffiche({ ...base, datePlanifiee: "2026-09-01" }, maintenant), "planifie");
  assert.equal(
    getStatutAffiche({ ...base, datePlanifiee: "2026-09-01", termineAt: JADIS }, maintenant),
    "termine"
  );
  assert.equal(
    getStatutAffiche(
      { ...base, datePlanifiee: "2026-09-01", termineAt: JADIS, factureEnvoyeeAt: JADIS },
      maintenant
    ),
    "facture"
  );
});

cas("l'attente d'une réponse du client prime sur « prêt à envoyer »", () => {
  // Un devis parti dont le client n'a rien dit : c'est LUI qu'on attend, et le
  // dire « prêt à envoyer » proposerait de refaire un envoi déjà fait.
  assert.equal(
    getStatutAffiche(
      {
        photosCount: 0,
        aUneNoteVocale: false,
        informationsVerifieesAt: null,
        devisGenereAt: JADIS,
        devisEnvoyeAt: JADIS,
        datePlanifiee: null,
        envoiEnvoyeAt: JADIS,
        envoiExpireAt: new Date("2026-09-13T09:00:00Z"),
        envoiReponse: null,
      },
      new Date("2026-08-13T14:00:00Z")
    ),
    "en_attente_client"
  );
});


// ─── SA DEMANDE, la vraie : rouvrir un chantier, c'est REPRENDRE ───────────
//
// *« Il faut absolument que si je me suis arrêté à l'étape d'envoyer le devis,
// si je fais retour et que je retombe sur la catégorie chantier puis que je
// reclique sur mon client en attente, que ça me renvoie à l'étape où je me suis
// arrêté. [...] Si je me suis arrêté à mettre des photos et à rédiger la note
// vocale, il faut que ça me remette à cette page-là. Et ainsi de suite. »*

const CHANTIER = "3f2a5b7c-1111-2222-3333-444455556666";

cas("SON CAS : la liste mène à l'écran d'ENVOI, pas à la fiche", () => {
  // C'est là qu'il s'était arrêté : « la page où je devais ouvrir le SMS ».
  //
  // **L'écran d'envoi a changé d'adresse le 20 août 2026, pas de nature.** Le
  // geste s'appelle « Choisir la date » et vit désormais sur le devis lui-même
  // (`ARCHITECTURE.md` §135) ; `/export` n'existe plus avant l'envoi et renvoie
  // vers `devis-complet`. Continuer à l'attendre ici le ferait arriver au même
  // endroit, mais par un rebond — et masquerait qu'un des deux chemins a bougé
  // sans l'autre.
  assert.equal(
    lienDeReprise(CHANTIER, { ...NEUF, prixValideAt: JADIS, devisGenereAt: JADIS }),
    `/chantiers/${CHANTIER}/devis-complet`
  );
});

cas("chaque arrêt a son écran de reprise, et « ainsi de suite »", () => {
  const attendus: [Partial<EtatChantierPourAction>, string][] = [
    // Rien fait, ou seulement des photos et une dictée : la fiche EST l'écran —
    // l'anneau et la pellicule y vivent. C'est son deuxième exemple.
    [{}, ""],
    // Photos et dictée se reprennent SUR la fiche : la pellicule et l'anneau y
    // sont, au milieu de l'écran. C'est « cette page-là », dans ses mots.
    [{ photosCount: 2 }, ""],
    [{ aUneNoteVocale: true }, "/informations"],
    [{ informationsVerifieesAt: JADIS }, "/prix"],
    // Voir ci-dessus : l'écran qui porte l'envoi est le devis depuis le 20 août.
    [{ prixValideAt: JADIS }, "/devis-complet"],
    [{ devisGenereAt: JADIS }, "/devis-complet"],
  ];
  for (const [jalon, suffixe] of attendus) {
    assert.equal(
      lienDeReprise(CHANTIER, { ...NEUF, ...jalon }),
      `/chantiers/${CHANTIER}${suffixe}`,
      `${JSON.stringify(jalon)} ne reprend pas au bon endroit`
    );
  }
});

cas("un devis parti ou un chantier planifié restent sur leur fiche", () => {
  // **Le planning général n'est PAS un écran de reprise.** L'y envoyer
  // l'éloignerait de son chantier au lieu de l'y ramener — et il n'y a rien à
  // reprendre : c'est le client qu'on attend.
  assert.equal(lienDeReprise(CHANTIER, { ...NEUF, devisEnvoyeAt: JADIS }), `/chantiers/${CHANTIER}`);
  assert.equal(
    lienDeReprise(CHANTIER, { ...NEUF, devisEnvoyeAt: JADIS, datePlanifiee: "2026-09-01" }),
    `/chantiers/${CHANTIER}`
  );
});

cas("la reprise et l'étape suivante ne peuvent pas diverger", () => {
  // Deux règles pour une même question finiraient par se contredire : la fiche
  // proposerait un geste et la liste en ouvrirait un autre. `lienDeReprise` est
  // donc bâtie SUR `getNextAction`, et ce contrôle tient la promesse.
  const etats: Partial<EtatChantierPourAction>[] = [
    {},
    { photosCount: 1 },
    { aUneNoteVocale: true },
    { informationsVerifieesAt: JADIS },
    { prixValideAt: JADIS },
    { devisGenereAt: JADIS },
  ];
  for (const jalon of etats) {
    const etat = { ...NEUF, ...jalon };
    const action = getNextAction(etat);
    assert.ok(action, "un chantier non planifié a toujours une étape suivante");
    const reprise = lienDeReprise(CHANTIER, etat);
    // La reprise est SOIT la fiche (pour ce qui s'y fait déjà), SOIT exactement
    // l'écran de l'étape suivante. Jamais un troisième endroit inventé.
    assert.ok(
      reprise === `/chantiers/${CHANTIER}` || reprise === getNextActionHref(CHANTIER, action),
      `la liste ouvre « ${reprise} » là où la fiche propose « ${getNextActionHref(CHANTIER, action)} »`
    );
  }
});

console.log(
  echecs === 0
    ? "\n✅ Reprendre où il en était — 0 échec(s).\n"
    : `\n❌ Reprendre où il en était — ${echecs} échec(s).\n`
);
process.exit(echecs === 0 ? 0 : 1);
