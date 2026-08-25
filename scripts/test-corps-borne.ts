// Le corps d'une requête ne peut pas dépasser la borne — constat M6.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE PROUVE, ET CE QU'ELLE NE PEUT PAS PROUVER.**
//
// Elle prouve que le parseur multipart ne voit **jamais** plus d'octets que la
// limite : le flux est cassé en passant, pas mesuré après coup. Les corps sont
// de vrais corps multipart, et le parseur est celui de la pile (`undici`) —
// pas une imitation.
//
// Elle ne peut pas prouver ce qui se passe au niveau du serveur HTTP lui-même
// (ce que Node accepte de mettre en tampon avant de rendre la main à Next) :
// cela dépend de l'hébergeur et non de notre code. Ce que nous garantissons
// commence à `Request`, et c'est là que la borne est posée.
//
// **`content-length` est délibérément MENTEUR dans plusieurs cas ci-dessous.**
// C'est tout l'objet du resserrement du 24 août : le premier correctif s'y
// fiait, et cet en-tête est écrit par le client.
//
// Ni base, ni réseau, ni navigateur.

import assert from "node:assert/strict";
import { CorpsTropGros, fluxBorne, formDataBornee } from "../src/server/corps-borne";

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

const LIMITE = 64 * 1024;
const FRONTIERE = "----atlas-essai";

/** Un vrai corps multipart, avec un fichier de la taille demandée. */
function corpsMultipart(tailleUtile: number, nom = "fichier.webm"): Buffer {
  const tete = Buffer.from(
    `--${FRONTIERE}\r\n` +
      `Content-Disposition: form-data; name="fichier"; filename="${nom}"\r\n` +
      `Content-Type: audio/webm\r\n\r\n`
  );
  const pied = Buffer.from(`\r\n--${FRONTIERE}--\r\n`);
  return Buffer.concat([tete, Buffer.alloc(tailleUtile, 0x41), pied]);
}

/**
 * Une requête dont on choisit l'en-tête `content-length` — y compris faux, y
 * compris absent. C'est le cœur de ce que la suite doit pouvoir simuler.
 */
function requeteAvec(corps: Buffer, longueurAnnoncee: number | null | "absente"): Request {
  const entetes = new Headers({ "content-type": `multipart/form-data; boundary=${FRONTIERE}` });
  if (longueurAnnoncee !== "absente" && longueurAnnoncee !== null) {
    entetes.set("content-length", String(longueurAnnoncee));
  }
  // Le corps passe par un flux : c'est ainsi qu'il arrive d'un vrai client, et
  // c'est ce que `fluxBorne` doit pouvoir couper.
  return new Request("http://atlas.local/api/notes-vocales/x", {
    method: "POST",
    headers: entetes,
    body: new Response(new Uint8Array(corps)).body,
    // @ts-expect-error — `duplex` est exigé par Node pour un corps en flux, et
    // n'est pas encore dans les types du DOM.
    duplex: "half",
  });
}

async function main() {
  console.log("=== Le corps borné : ce que le parseur voit vraiment ===\n");

  // ─── Le cas normal ────────────────────────────────────────────────────────

  await essai("une requête SOUS la limite passe, et le fichier est entier", async () => {
    const utile = 10 * 1024;
    const corps = corpsMultipart(utile);
    const fd = await formDataBornee(requeteAvec(corps, corps.length), LIMITE);
    const f = fd.get("fichier") as File;
    assert.ok(f, "aucun fichier dans le formulaire");
    assert.equal(f.size, utile, `le fichier fait ${f.size} octets au lieu de ${utile}`);
  });

  await essai("un fichier EXACTEMENT à la limite passe", async () => {
    // On vise le corps entier à la limite, pied et en-têtes compris.
    const vide = corpsMultipart(0).length;
    const corps = corpsMultipart(LIMITE - vide);
    assert.equal(corps.length, LIMITE, "le corps d'essai n'est pas exactement à la limite");
    const fd = await formDataBornee(requeteAvec(corps, corps.length), LIMITE);
    assert.ok(fd.get("fichier"), "un corps pile à la limite a été refusé");
  });

  await essai("un octet AU-DESSUS est refusé", async () => {
    const vide = corpsMultipart(0).length;
    const corps = corpsMultipart(LIMITE - vide + 1);
    assert.equal(corps.length, LIMITE + 1);
    await assert.rejects(
      () => formDataBornee(requeteAvec(corps, corps.length), LIMITE),
      CorpsTropGros
    );
  });

  // ─── LE CŒUR : `content-length` ne fait pas foi ───────────────────────────

  await essai("CONTENT-LENGTH ANNONCÉ TROP GRAND → refus AVANT toute lecture", async () => {
    // Le refus rapide : on ne commence même pas à lire.
    const corps = corpsMultipart(1024);
    await assert.rejects(() => formDataBornee(requeteAvec(corps, LIMITE * 10), LIMITE), CorpsTropGros);
  });

  await essai("CONTENT-LENGTH SOUS-DÉCLARÉ → refusé quand même, par le flux", async () => {
    /**
     * **Le cas qui condamnait le premier correctif.** Le client annonce mille
     * octets et en envoie deux cents mille. La version du 24 août au matin
     * laissait passer l'en-tête, puis `formData()` avalait tout.
     */
    const corps = corpsMultipart(200 * 1024);
    await assert.rejects(() => formDataBornee(requeteAvec(corps, 1000), LIMITE), CorpsTropGros);
  });

  await essai("AUCUN content-length (envoi en morceaux) → refusé par le flux", async () => {
    // `Transfer-Encoding: chunked` n'annonce aucune longueur : il n'y a alors
    // rien à vérifier avant de lire. Seule la borne du flux protège.
    const corps = corpsMultipart(200 * 1024);
    await assert.rejects(() => formDataBornee(requeteAvec(corps, "absente"), LIMITE), CorpsTropGros);
  });

  // ─── Ce que le parseur a réellement vu ────────────────────────────────────

  await essai("LE PARSEUR NE VOIT JAMAIS PLUS QUE LA LIMITE — compté octet par octet", async () => {
    /**
     * La preuve directe de la propriété : on compte ce qui sort de `fluxBorne`
     * quand on lui donne un corps dix fois trop gros. Sans borne, ce compteur
     * afficherait la totalité.
     */
    const corps = corpsMultipart(10 * LIMITE);
    let sortis = 0;
    const lecteur = fluxBorne(new Response(new Uint8Array(corps)).body!, LIMITE).getReader();
    try {
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        sortis += value.byteLength;
      }
      assert.fail("le flux n'a pas été cassé");
    } catch (e) {
      assert.ok(e instanceof CorpsTropGros, `cassé par autre chose : ${(e as Error).message}`);
    }
    // Au pire la limite, plus le morceau en cours — jamais le corps entier.
    assert.ok(
      sortis <= LIMITE,
      `${sortis} octets sont sortis du flux borné alors que la limite est ${LIMITE}`
    );
    assert.ok(sortis < corps.length, "le corps entier est passé");
  });

  // ─── Les corps abîmés ─────────────────────────────────────────────────────

  await essai("un multipart MALFORMÉ échoue proprement, sans se faire passer pour un dépassement", async () => {
    // Le message doit désigner le bon coupable : un corps illisible n'est pas
    // un corps trop gros, et les deux ne se répondent pas de la même façon.
    const corps = Buffer.from("ceci n'est pas un multipart");
    let attrape: unknown = null;
    try {
      await formDataBornee(requeteAvec(corps, corps.length), LIMITE);
    } catch (e) {
      attrape = e;
    }
    assert.ok(attrape, "un corps illisible a été accepté");
    assert.ok(
      !(attrape instanceof CorpsTropGros),
      "un multipart malformé se présente comme un dépassement de taille"
    );
  });

  await essai("un corps VIDE ne lève pas de dépassement", async () => {
    let attrape: unknown = null;
    try {
      await formDataBornee(requeteAvec(Buffer.alloc(0), 0), LIMITE);
    } catch (e) {
      attrape = e;
    }
    assert.ok(!(attrape instanceof CorpsTropGros), "un corps vide passe pour trop gros");
  });

  console.log("");
  console.log(`Corps borné — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main();
