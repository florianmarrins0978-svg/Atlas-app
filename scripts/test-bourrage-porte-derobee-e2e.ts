import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";

// LE FORMULAIRE EST GARDÉ — LA PORTE D'À CÔTÉ DOIT L'ÊTRE AUSSI.
//
// ═══════════════════════════════════════════════════════════════════════════
// **LE DÉFAUT QUE CETTE SUITE EMPÊCHE DE REVENIR** — audit final, 29 août 2026.
//
// `src/app/api/auth/[...nextauth]/route.ts` montait les gestionnaires d'Auth.js
// en entier. `/api/auth` étant un chemin public, `POST /api/auth/callback/
// credentials` appelait `authorize()` **sans passer par aucune des trois
// défenses** contre le bourrage d'identifiants : les deux seuils Redis et la
// temporisation en base vivent toutes dans `connexionAction`.
//
// On pouvait donc essayer des mots de passe en boucle, aussi vite que bcrypt le
// permettait, sans qu'aucun compteur n'avance. Tout le lot C1 et toute la
// migration 0062 étaient contournés par une adresse que personne ne regardait.
//
// **Et les deux suites qui prétendaient couvrir le sujet ne pouvaient pas le
// voir** : `test-connexion-limite-e2e.ts` pilote le formulaire — donc l'action
// serveur —, et `test-bourrage-connexion-db.ts` appelle `noterEchec()` en
// direct. Aucune ne frappait la route. Elles restaient vertes.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE TIENT, ET DANS CET ORDRE :**
//
//   1. **la porte est murée** — le rappel d'identifiants ne rend jamais de
//      session, même avec les BONS identifiants. C'est le contrôle qui compte :
//      un refus sur un mauvais mot de passe ne prouverait rien ;
//   2. **et la connexion normale marche toujours.** Sans ce second contrôle, on
//      aurait pu tout fermer et croire l'application sûre alors qu'elle serait
//      simplement inutilisable — c'est la faute que `CLAUDE.md` §2 bis nomme :
//      « plus sûr » contre « ça marche encore » ne se tranche pas seul.
//
// **Elle a été VUE ROUGE avant d'être vue verte**, sur le code d'avant : le
// rappel rendait 200 et un cookie de session. Un contrôle qui n'a jamais échoué
// ne prouve rien.

const BASE = "http://localhost:3000";
const COMPTE = "demo@atlas.local";

/** Les fournisseurs `Credentials` de `src/auth.ts`, et leurs rappels. */
const RAPPELS = ["credentials", "cle-appareil"];

async function main() {
  const navigateur = await lancerNavigateur();
  let echecs = 0;

  const essai = async (nom: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`  ✓ ${nom}`);
    } catch (e) {
      echecs++;
      console.log(`  ✗ ${nom}`);
      console.log(`    ${(e as Error).message}`);
    }
  };

  console.log("=== La porte dérobée de la connexion ===\n");

  // ─── Le mot de passe de démonstration, lu là où les autres suites le lisent ─
  //
  // **On ne le code pas en dur.** 136 fichiers dépendent de ce compte ; une
  // seconde copie de son mot de passe divergerait au premier changement, et la
  // suite accuserait le produit pour une valeur périmée.
  const motDePasse = process.env.ATLAS_MDP_DEMO?.trim() || "demo1234";

  for (const fournisseur of RAPPELS) {
    await essai(`POST /api/auth/callback/${fournisseur} ne rend aucune session`, async () => {
      const contexte = await navigateur.newContext();
      try {
        // Auth.js exige son jeton anti-CSRF : on le prend comme le ferait
        // l'attaquant, puisqu'il est offert à qui le demande. Sans cette étape,
        // un refus ne prouverait que l'absence de jeton — pas que la porte est
        // fermée.
        const csrf = await contexte.request.get(`${BASE}/api/auth/csrf`);
        const { csrfToken } = (await csrf.json().catch(() => ({}))) as { csrfToken?: string };

        const reponse = await contexte.request.post(`${BASE}/api/auth/callback/${fournisseur}`, {
          form: {
            csrfToken: csrfToken ?? "",
            email: COMPTE,
            // **LES BONS identifiants, délibérément.** Éprouver avec un mauvais
            // mot de passe ne dirait rien : le refus viendrait de bcrypt, pas de
            // la fermeture. Ce qu'on veut prouver, c'est que même une
            // vérification qui RÉUSSIRAIT ne délivre pas de session par ici.
            password: motDePasse,
          },
          maxRedirects: 0,
          failOnStatusCode: false,
        });

        const cookies = await contexte.cookies();
        const session = cookies.find((c) => /authjs\.session-token|next-auth\.session-token/.test(c.name));

        assert.ok(
          !session,
          `Le rappel « ${fournisseur} » a délivré un cookie de session (statut ${reponse.status()}). ` +
            "Toutes les défenses anti-bourrage vivent dans connexionAction : cette route les contourne, " +
            "et un attaquant peut essayer des mots de passe en boucle sans qu'aucun compteur n'avance."
        );
        assert.equal(
          reponse.status(),
          404,
          `Le rappel « ${fournisseur} » devrait être introuvable ; il a répondu ${reponse.status()}.`
        );
      } finally {
        await contexte.close();
      }
    });
  }

  // ─── ET LA CONNEXION NORMALE MARCHE TOUJOURS ─────────────────────────────
  //
  // Sans ce contrôle, la suite ci-dessus serait verte sur une application dont
  // plus personne ne peut ouvrir la porte.
  await essai("le formulaire de connexion, lui, ouvre toujours", async () => {
    const contexte = await navigateur.newContext();
    try {
      const page = await contexte.newPage();
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await page.fill('input[name="email"]', COMPTE);
      await page.fill('input[name="password"]', motDePasse);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      const chemin = new URL(page.url()).pathname;
      assert.notEqual(
        chemin,
        "/login",
        "La connexion par le formulaire ne passe plus : la fermeture du rappel a cassé le " +
          "chemin légitime. Vérifier que signIn() côté serveur n'emprunte pas la route HTTP."
      );
    } finally {
      await contexte.close();
    }
  });

  await navigateur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Porte dérobée de la connexion — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
