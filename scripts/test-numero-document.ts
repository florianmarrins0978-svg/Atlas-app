import assert from "node:assert/strict";
import {
  decouperNumeroDocument,
  ressembleAUnTelephone,
  CHIFFRES_MINIMUM_D_UN_TELEPHONE,
} from "../src/lib/numero-document";

// Le numéro d'un devis ne doit plus ressembler à un téléphone.
//
// **Deux fois le même défaut, deux jours de suite.** Le 12 août 2026, iOS
// transforme « 2026-0003 » en lien d'appel sur la facture du client et React
// annonce « Hydration failed » ; l'en-tête `format-detection` est posée. Le
// 13 août, le patron ouvre le lien du devis reçu par SMS : même erreur, même
// signature — la vue intégrée de Messages ne lit pas cette en-tête.
//
// Ce qui suit éprouve le second remède, celui qui ne demande plus rien au
// navigateur : le numéro est découpé en morceaux dont aucun ne porte assez de
// chiffres pour être un téléphone. La mise en forme qui empêche de les recoller
// est éprouvée ailleurs, dans un vrai navigateur
// (`test-detection-automatique-e2e.ts`) — ici, on éprouve la règle.

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

console.log("=== Le numéro du document, et ce qu'un téléphone y voit ===");

cas("le témoin : le numéro nu ressemble bel et bien à un téléphone", () => {
  // **Sans ce cas, tous les autres pourraient garder le vide.** Le jour où
  // `ressembleAUnTelephone` cesserait de reconnaître quoi que ce soit, les
  // contrôles ci-dessous resteraient verts en ne prouvant plus rien.
  assert.equal(ressembleAUnTelephone("2026-0007"), true, "« 2026-0007 » n'alerte plus");
  assert.equal(ressembleAUnTelephone("06 12 34 56 78"), true, "un vrai numéro n'alerte plus");
  assert.equal(ressembleAUnTelephone("Devis n° 2026-0007"), true, "le titre entier n'alerte plus");
});

cas("un numéro découpé, recollé par un retour à la ligne, n'alerte plus", () => {
  // Le retour à la ligne est ce que le navigateur insère entre deux blocs quand
  // il aplatit la page — c'est exactement ce que lit un détecteur.
  for (const numero of ["2026-0007", "2026-0001", "2025-0123", "FA-2026-0042", "202600079999"]) {
    const morceaux = decouperNumeroDocument(numero);
    assert.ok(morceaux.length > 1, `« ${numero} » n'a pas été découpé`);
    assert.equal(
      ressembleAUnTelephone(morceaux.join("\n")),
      false,
      `« ${numero} » découpé en ${JSON.stringify(morceaux)} passe encore pour un téléphone`
    );
  }
});

cas("aucun morceau ne porte à lui seul de quoi faire un téléphone", () => {
  for (const numero of ["2026-0007", "FA-2026-0042", "202600079999", "12345678901234"]) {
    for (const morceau of decouperNumeroDocument(numero)) {
      const chiffres = [...morceau].filter((c) => c >= "0" && c <= "9").length;
      assert.ok(
        chiffres < CHIFFRES_MINIMUM_D_UN_TELEPHONE,
        `le morceau « ${morceau} » de « ${numero} » porte ${chiffres} chiffres`
      );
    }
  }
});

cas("le découpage ne perd rien : recollé, c'est le numéro d'origine", () => {
  // **La propriété qui autorise à s'en servir partout.** Un découpage qui
  // mangerait un caractère afficherait au client un numéro qui n'est pas le
  // sien — et le rapprochement avec son PDF deviendrait impossible.
  for (const numero of ["2026-0007", "FA-2026-0042", "", "A", "2026-0007-BIS", "1", "202600079999"]) {
    assert.equal(decouperNumeroDocument(numero).join(""), numero, `« ${numero} » a été altéré`);
  }
});

cas("un numéro court reste d'un seul morceau", () => {
  // Rien ne justifie de couper ce qui ne ressemble déjà à rien : une coupure
  // inutile abîmerait la copie du numéro sans rien protéger.
  assert.deepEqual(decouperNumeroDocument("2026"), ["2026"]);
  assert.deepEqual(decouperNumeroDocument("A-12"), ["A-12"]);
  assert.deepEqual(decouperNumeroDocument(""), []);
});

cas("la coupure suit la forme du numéro : l'année d'abord", () => {
  assert.deepEqual(decouperNumeroDocument("2026-0007"), ["2026-", "0007"]);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Numéro de document — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
