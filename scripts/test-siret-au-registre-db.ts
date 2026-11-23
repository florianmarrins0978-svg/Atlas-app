import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { db, pool } from "../src/server/db/client";
import { entreprises } from "../src/server/db/schema";
import { creerSonCompte } from "../src/server/repositories/creation-compte";
import { mettreAJourEntreprise, reconfirmerLeSiret } from "../src/server/repositories/entreprises";

// ═══════════════════════════════════════════════════════════════════════════
// UN SIRET QUE LE REGISTRE N'A PAS CONFIRMÉ (migration 0196)
// ═══════════════════════════════════════════════════════════════════════════
//
// Sa règle du 23 novembre 2026 : *« il ne faut pas le bloquer ; il ne faut pas
// non plus qu'il puisse créer des comptes gratuits à tire-larigot »*. Le compte
// se crée toujours ; le drapeau dit si ses devis attendent le registre. Par les
// portes qu'il emprunte (`creerSonCompte`, `mettreAJourEntreprise`,
// `reconfirmerLeSiret`), contre un faux registre :
//   · un SIRET tapé à l'inscription attend le registre, sauf s'il l'a confirmé ;
//   · sans SIRET, rien n'attend ;
//   · le registre qui le connaît lève le drapeau ; inconnu ou muet, il reste ;
//   · un SIRET changé dans Réglages attend de nouveau ; retapé tel quel, non ;
//   · une entreprise d'avant n'attend rien.
//
// **Elle ne vide pas la base** : chaque compte a son courriel et son SIRET
// tirés au hasard, et tout ce qu'elle crée s'efface à la fin.

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`❌ ${nom}\n   ${e instanceof Error ? e.message : e}`);
  }
}

const luhn = (s: string) =>
  [...s].reverse().reduce((t, c, i) => {
    let n = Number(c);
    if (i % 2) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    return t + n;
  }, 0) % 10 === 0;
const completer = (debut: string) => {
  for (let d = 0; d < 10; d++) if (luhn(debut + d)) return debut + d;
  throw new Error("clé introuvable");
};
const siretAuHasard = () => completer(completer(String(Math.floor(1e7 + Math.random() * 8e7))) + String(Math.floor(Math.random() * 1e4)).padStart(4, "0"));

const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL });
const crees: { email: string; entrepriseId: string; siren: string | null }[] = [];

async function compte(siret: string | undefined, siretConfirme?: boolean) {
  const email = `registre-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@essai.local`;
  const saisie = { civilite: "mr" as const, prenom: "Lucien", nom: "Vidal", email, motDePasse: "trois-mots-tres-courts", entreprise: "Jardins Vidal", forme: "EI", tva: "franchise" as const, ...(siret ? { siret } : {}) };
  const r = siretConfirme === undefined ? await creerSonCompte(saisie) : await creerSonCompte(saisie, { siretConfirme });
  assert.ok(r.ok, r.ok ? "" : r.refus);
  crees.push({ email, entrepriseId: r.entrepriseId, siren: siret ? siret.slice(0, 9) : null });
  return { utilisateurId: r.utilisateurId, entrepriseId: r.entrepriseId };
}
async function drapeau(entrepriseId: string) {
  const [e] = await db.select({ a: entreprises.siretAConfirmer }).from(entreprises).where(eq(entreprises.id, entrepriseId));
  assert.ok(e, "entreprise introuvable : rien n'a été éprouvé");
  return e.a;
}

async function main() {
  const connus = new Set<string>();
  let muet = false;
  const serveur = createServer((req, res) => {
    if (muet) {
      res.writeHead(503).end();
      return;
    }
    const q = new URL(req.url ?? "/", "http://x").searchParams.get("q") ?? "";
    const corps = connus.has(q)
      ? { results: [{ siren: q.slice(0, 9), nom_complet: "JARDINS VIDAL", statut_diffusion: "O", siege: { siret: q, adresse: "10 RUE DES ARTISANS 44000 NANTES", etat_administratif: "A" }, matching_etablissements: [] }] }
      : { results: [], total_results: 0 };
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(corps));
  });
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
  process.env.REGISTRE_ENTREPRISES_BASE = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;

  try {
    await cas("un SIRET tapé à l'inscription attend le registre ; confirmé, non ; sans SIRET, rien", async () => {
      assert.equal(await drapeau((await compte(siretAuHasard())).entrepriseId), true);
      assert.equal(await drapeau((await compte(siretAuHasard(), true)).entrepriseId), false);
      assert.equal(await drapeau((await compte(undefined)).entrepriseId), false);
    });

    await cas("le registre qui le connaît lève le drapeau ; inconnu ou muet, il reste", async () => {
      const siret = siretAuHasard();
      const c = await compte(siret);
      muet = true;
      assert.equal((await reconfirmerLeSiret(c))?.etat, "injoignable");
      assert.equal(await drapeau(c.entrepriseId), true, "un registre muet a confirmé le SIRET");
      muet = false;
      assert.equal((await reconfirmerLeSiret(c))?.etat, "inconnu");
      assert.equal(await drapeau(c.entrepriseId), true, "un SIRET inconnu a été confirmé");
      connus.add(siret);
      assert.equal((await reconfirmerLeSiret(c))?.etat, "trouve");
      assert.equal(await drapeau(c.entrepriseId), false, "le registre a confirmé, et le drapeau reste");
      assert.equal(await reconfirmerLeSiret(c), null, "un SIRET confirmé se redemande au registre");
    });

    await cas("un SIRET changé dans Réglages attend de nouveau ; retapé tel quel, non", async () => {
      const siret = siretAuHasard();
      const c = await compte(siret, true);
      await mettreAJourEntreprise(c, { siret: `${siret.slice(0, 3)} ${siret.slice(3, 6)} ${siret.slice(6, 9)} ${siret.slice(9)}`, telephone: "02 40 11 22 33" });
      assert.equal(await drapeau(c.entrepriseId), false, "le même SIRET, autrement espacé, attend le registre");
      const autre = siretAuHasard();
      crees.push({ email: "", entrepriseId: c.entrepriseId, siren: autre.slice(0, 9) });
      await mettreAJourEntreprise(c, { siret: autre });
      assert.equal(await drapeau(c.entrepriseId), true, "un SIRET neuf n'attend pas le registre");
      await mettreAJourEntreprise(c, { siret: "" });
      assert.equal(await drapeau(c.entrepriseId), false, "un SIRET effacé attend encore le registre");
    });
  } finally {
    serveur.close();
    for (const c of crees) {
      await admin.query("DELETE FROM entreprises WHERE id = $1", [c.entrepriseId]);
      if (c.email) await admin.query("DELETE FROM users WHERE email = $1", [c.email]);
      if (c.siren) await admin.query("DELETE FROM essais_par_siren WHERE siren = $1", [c.siren]);
    }
    await admin.end();
    await pool.end();
  }

  console.log(`\nLe SIRET à confirmer : ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
