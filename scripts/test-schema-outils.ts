import assert from "node:assert/strict";
import { z } from "zod";
import { outilsDisponibles } from "../src/server/ai/tools/registre";
import { schemaJsonDeLOutil } from "../src/server/ai/providers/llm/schema-outils";

/**
 * LE MODÈLE DOIT CONNAÎTRE LES CHAMPS DE CHAQUE OUTIL.
 *
 * **Sa capture du 26 septembre 2026 :** « Huguette Groupiron » → *« Il faut au
 * moins un mot du libellé ou un nom de client »*, puis « Comment je supprime
 * un client ? » → *« Je n'ai pas pu appeler l'outil RechercherModeEmploi »*,
 * trois fois, rechargement compris.
 *
 * `schemaJsonDeLOutil` rendait `properties: {}` pour tous les outils sauf un.
 * Le modèle devinait donc les noms des champs ; Zod jetait en silence ceux qui
 * ne tombaient pas juste, et l'outil croyait n'avoir rien reçu. Aucune
 * suite ne le voyait : elles appellent les outils avec les bons noms, que le
 * modèle, lui, n'a jamais lus.
 */

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

/** Les champs que l'outil lit, tirés de sa définition et non d'une liste recopiée. */
function champsAttendus(schema: z.ZodTypeAny): string[] {
  const forme = (schema as unknown as { shape?: Record<string, unknown> }).shape;
  return forme ? Object.keys(forme) : [];
}

console.log("=== Le modèle connaît les champs de chaque outil ===");

const avecChamps = outilsDisponibles.filter((o) => champsAttendus(o.schema).length > 0);
cas("il y a bien des outils à paramètres à éprouver", () => {
  assert.ok(avecChamps.length >= 5, `seulement ${avecChamps.length} outil(s) à paramètres trouvés`);
});

for (const outil of outilsDisponibles) {
  cas(`${outil.nom} annonce tous ses champs`, () => {
    const json = schemaJsonDeLOutil({ nom: outil.nom, description: outil.description, schema: outil.schema });
    assert.equal(json.type, "object");
    const annonces = Object.keys((json.properties as Record<string, unknown>) ?? {});
    for (const champ of champsAttendus(outil.schema)) {
      assert.ok(annonces.includes(champ), `champ « ${champ} » absent de ce que lit le modèle (${JSON.stringify(annonces)})`);
    }
  });
}

cas("RechercherLignesDevis : la phrase de sa capture part avec motCle et client", () => {
  const outil = outilsDisponibles.find((o) => o.nom === "RechercherLignesDevis")!;
  const json = schemaJsonDeLOutil({ nom: outil.nom, description: outil.description, schema: outil.schema });
  const props = json.properties as Record<string, { description?: string }>;
  assert.ok(props.motCle?.description, "motCle sans description : le modèle ne sait pas ce qu'on y met");
  assert.ok(props.client?.description, "client sans description");
});

cas("un champ facultatif n'est pas déclaré obligatoire", () => {
  const outil = outilsDisponibles.find((o) => o.nom === "RechercherModeEmploi")!;
  const json = schemaJsonDeLOutil({ nom: outil.nom, description: outil.description, schema: outil.schema });
  const requis = (json.required as string[] | undefined) ?? [];
  assert.deepEqual(requis, [], `champs exigés à tort : ${requis.join(", ")}`);
});

if (echecs > 0) {
  console.error(`\n❌ ${echecs} échec(s).`);
  process.exit(1);
}
console.log("\n✅ Chaque outil annonce ses champs au modèle.");
