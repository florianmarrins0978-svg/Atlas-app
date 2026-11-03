import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

// **Un refus de note vocale DIT pourquoi, jusqu'à l'écran.**
//
// Le patron, le 11 août 2026, capture de son téléphone à l'appui :
// *« Impossible d'enregistrer la note pour l'instant. Réessayez. »* Et personne
// — ni lui, ni le journal du serveur, ni moi — ne pouvait dire ce qui s'était
// passé. Quatre refus distincts portaient chacun leur phrase, et l'écran les
// jetait tous dans un `catch {}` pour afficher la même formule creuse.
//
// **Le défaut n'était pas le refus, c'était le silence.** Une erreur qui
// n'accuse personne coûte plus cher que pas d'erreur du tout (`AGENTS.md`) :
// elle oblige à deviner, et deviner à distance sur la machine de quelqu'un
// d'autre a déjà coûté trois allers-retours à ce dépôt.
//
// Ce contrôle éprouve les deux choses qu'aucune version précédente ne faisait :
//
//   1. **le refus nomme le format reçu.** Sans cela, un format que son iPhone
//      produit et que la liste blanche ignore resterait introuvable : le
//      message dirait « format non pris en charge » sans jamais dire lequel.
//   2. **un enregistrement vide est refusé, pas rangé.** Un micro qui rend zéro
//      octet posait jusqu'ici une note muette, et l'écran annonçait une réussite.
//
// **Il poste directement sur la route de l'anneau** (`/api/notes-vocales/<chantier>`)
// depuis le 3 novembre 2026. Il passait par « Ajouter un fichier audio », le seul
// endroit où une suite pouvait choisir ce qu'elle envoie ; cet import est parti
// avec l'écran Note vocale, et l'anneau ne sait envoyer que ce que le micro
// enregistre. La route reste la porte unique : l'éprouver, c'est éprouver
// toutes les dictées. Ce qui part avec l'écran, c'est sa façon d'afficher le
// refus ; la phrase, elle, est celle que l'anneau montre (`envoi-note-vocale.ts`).

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let echecs = 0;

async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Un refus de note vocale dit pourquoi ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // **Le chantier est CRÉÉ par l'écran, pas pioché en base.** Une première
  // version prenait « un chantier sans note » au hasard — et tombait parfois sur
  // celui d'une autre entreprise, laissé par une suite voisine. L'isolation le
  // refusait alors, à très juste titre, et le contrôle accusait l'application
  // d'un défaut qui n'existait pas.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Refus note ${Date.now()}`);
  const idChantier = await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantier = idChantier;

  /** Poste un fichier sur la route des dictées et rend la raison qu'elle donne. */
  async function deposer(nom: string, mimeType: string, octets: Buffer): Promise<string> {
    const reponse = await page.request.post(`${BASE}/api/notes-vocales/${chantier}`, {
      multipart: { fichier: { name: nom, mimeType, buffer: octets } },
    });
    // **Le contrôle doit savoir qu'il a bien agi** : un refus se rend avec un
    // corps qui le dit. Une page de connexion ou une réponse vide ne prouverait
    // rien, et ne doit pas passer pour un refus lisible.
    const corps = (await reponse.json().catch(() => null)) as { ok?: boolean; raison?: string } | null;
    if (!corps || corps.ok !== false || typeof corps.raison !== "string") {
      throw new Error(`la route n'a pas rendu de refus lisible (HTTP ${reponse.status()}) : rien n'a été éprouvé`);
    }
    return corps.raison;
  }

  {
    await cas("un format refusé nomme le format reçu", async () => {
      const raison = await deposer("photo.pdf", "application/pdf", Buffer.from("%PDF-1.4 rien"));
      if (!/application\/pdf/.test(raison)) {
        throw new Error(
          "le refus ne dit pas QUEL format a été refusé. Le patron ne peut donc pas " +
            "signaler le format que son téléphone produit, et personne ne peut le " +
            `deviner. Raison rendue : ${raison}`
        );
      }
    });

    await cas("un enregistrement vide est refusé, pas rangé", async () => {
      const raison = await deposer("note.webm", "audio/webm", Buffer.alloc(0));
      if (!/vide/i.test(raison)) {
        throw new Error(
          "un fichier de zéro octet n'est pas refusé en toutes lettres. Il descend " +
            "jusqu'à la base, qui le rejette — et ce qui remonte alors n'est plus un " +
            "refus lisible mais une panne. Confronté à l'ancien code, l'écran " +
            "affichait la requête SQL entière, noms de tables et identifiant " +
            `d'entreprise compris. Raison rendue : ${raison.slice(0, 900)}`
        );
      }
      const { rows: notes } = await pool.query(
        `select taille_octets from notes_vocales where chantier_id = $1`,
        [chantier]
      );
      if (notes.length > 0) {
        throw new Error(
          `une note a été rangée en base malgré le refus (${notes[0].taille_octets} octets) : ` +
            "la route et la base ne disent pas la même chose."
        );
      }
    });
  }

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Refus de note vocale — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
