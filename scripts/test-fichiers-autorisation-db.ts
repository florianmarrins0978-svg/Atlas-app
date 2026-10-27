// LA PHOTO D'UNE AUTRE ENTREPRISE NE S'OUVRE PAS PAR SA CLÉ DE STOCKAGE.
//
// ─────────────────────────────────────────────────────────────────────────────
// **Pourquoi cette suite existe, et pourquoi elle est DISTINCTE de la fuite du
// logo déjà connue** (`ARCHITECTURE.md`, audit du 29 août 2026). Cette
// fuite-là vivait dans `entreprises`, une table SANS aucune politique RLS : le
// filtre explicite posé alors est la SEULE protection de cette ligne, pas un
// doublon. `photos` et `notes_vocales`, elles, sont sous `FORCE ROW LEVEL
// SECURITY` — donc protégées en production, sous `atlas_app` — mais n'avaient
// **aucun** filtre équivalent : leur seul rempart était la RLS elle-même.
//
// **Trouvé en campagne red team (27 octobre 2026), pas en relisant le code.**
// `scripts/test-fichiers-cross-entreprise-e2e.ts`, qui sert son serveur sous le
// rôle qui TRAVERSE la RLS (comme toute suite e2e, `CLAUDE.md` §5), a vu A
// recevoir la photo du chantier de B. Ce n'est pas la preuve d'un défaut en
// PRODUCTION (`atlas_app` n'a pas ce rôle, et cette suite-ci le prouve
// ci-dessous) — c'est la preuve qu'`autoriseLectureDuFichier` n'avait qu'UNE
// ligne de défense pour ces deux tables, là où `entreprises` en a deux depuis
// le 29 août. Le filtre explicite posé le 27 octobre répare exactement ça.
//
// **Cette suite-ci prouve la moitié « production » : sous le rôle réel
// (`atlas_app`), la RLS referme déjà tout, et rien n'a cassé en ajoutant le
// filtre explicite.** L'autre moitié — que le filtre referme MÊME quand la
// RLS ne protège plus rien — ne se prouve pas ici : le pool de connexion de
// l'application est un singleton posé une fois pour tout le process
// (`src/server/db/client.ts`), et cette suite a déjà besoin d'`atlas_app` pour
// monter ses propres entreprises. C'est `test-fichiers-cross-entreprise-e2e.ts`
// qui la tient : son serveur tourne sous le rôle qui traverse la RLS, par
// construction (`CLAUDE.md` §5) — c'est exactement ce rôle-là qui a laissé
// passer A sur la photo de B avant ce correctif, et c'est lui qui doit
// désormais refuser, pour la bonne raison (le filtre, pas la RLS qu'il ne
// peut pas éprouver).

import assert from "node:assert/strict";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerClient } from "../src/server/repositories/clients";
import { creerChantier } from "../src/server/repositories/chantiers";
import { ajouterPhoto } from "../src/server/repositories/photos";
import { enregistrerObjet } from "../src/server/storage";
import { autoriseLectureDuFichier } from "../src/app/api/fichiers/[...key]/route";
import type { Ctx } from "../src/server/repositories/context";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== La photo d'une autre entreprise, par sa clé de stockage ===\n");
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: patronA } = await creerEntreprise({ nom: "REDTEAM_ENTREPRISE_A" }, { email: "redteam-a-fichiers@essai.local", nom: "Patron A" });
  const { entreprise: entB, utilisateurId: patronB } = await creerEntreprise({ nom: "REDTEAM_ENTREPRISE_B" }, { email: "redteam-b-fichiers@essai.local", nom: "Patron B" });
  const ctxA: Ctx = { utilisateurId: patronA, entrepriseId: entA.id };
  const ctxB: Ctx = { utilisateurId: patronB, entrepriseId: entB.id };

  const client = await creerClient(ctxB, { nom: "REDTEAM_CLIENT_B" });
  const chantier = await creerChantier(ctxB, { nom: "REDTEAM_CHANTIER_B", clientId: client.id });
  const octets = await enregistrerObjet("photos", Buffer.from("REDTEAM_PHOTO_B"), ".jpg");
  const photo = await ajouterPhoto(ctxB, chantier.id, {
    storageKey: octets.storageKey,
    mimeType: "image/jpeg",
    tailleOctets: octets.tailleOctets,
    checksum: octets.checksum,
  });
  assert.equal(photo.ok, true, "le montage n'a pas posé la photo de B");

  await essai("A ne peut PAS lire la photo de B, sous le rôle réel (atlas_app)", async () => {
    const r = await autoriseLectureDuFichier(ctxA, octets.storageKey);
    assert.equal(r, false, "FUITE : A a été autorisé sur la photo de B, sous atlas_app");
  });

  await essai("B, lui, peut lire SA photo (sinon le refus ci-dessus ne prouve rien)", async () => {
    const r = await autoriseLectureDuFichier(ctxB, octets.storageKey);
    assert.equal(r, true, "B n'a pas été autorisé sur sa propre photo");
  });

  console.log(`\nAutorisation des fichiers — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
