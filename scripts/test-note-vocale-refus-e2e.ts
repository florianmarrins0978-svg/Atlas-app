import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";

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
// Il passe par l'import de fichier, qui emprunte la MÊME route que l'anneau et
// que l'écran de dictée (`/api/notes-vocales/<chantier>`) : c'est le seul chemin
// où une suite peut choisir ce qu'elle envoie. Éprouver la route, c'est éprouver
// les trois.

const BASE = "http://localhost:3000";
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
  await page.fill('input[placeholder="M. Bernard"]', `Refus note ${Date.now()}`);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantier = page.url().split("/").pop()!.split("?")[0];

  /** Dépose un fichier sur l'écran de dictée et rend ce que l'écran répond. */
  async function deposer(nom: string, mimeType: string, octets: Buffer): Promise<string> {
    await page.goto(`${BASE}/chantiers/${chantier}/note-vocale`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const entree = page.locator('input[type="file"]');
    // **Le contrôle doit savoir qu'il a bien agi.** Sans cette vérification, un
    // écran qui n'offrirait plus l'import le rendrait vert en silence.
    if ((await entree.count()) === 0) {
      throw new Error("aucun champ de fichier sur l'écran de dictée — rien n'a été éprouvé");
    }
    await entree.setInputFiles({ name: nom, mimeType, buffer: octets });
    await page.waitForTimeout(2500);
    return await page.locator("body").innerText();
  }

  {
    await cas("un format refusé nomme le format reçu", async () => {
      const ecran = await deposer("photo.pdf", "application/pdf", Buffer.from("%PDF-1.4 rien"));
      if (!/application\/pdf/.test(ecran)) {
        throw new Error(
          "l'écran ne dit pas QUEL format a été refusé. Le patron ne peut donc pas " +
            "signaler le format que son téléphone produit, et personne ne peut le " +
            `deviner. Écran :\n      ` +
            ecran.split("\n").filter((l) => l.trim()).slice(0, 12).join("\n      ")
        );
      }
    });

    await cas("un enregistrement vide est refusé, pas rangé", async () => {
      const ecran = await deposer("note.webm", "audio/webm", Buffer.alloc(0));
      if (!/vide/i.test(ecran)) {
        throw new Error(
          "un fichier de zéro octet n'est pas refusé en toutes lettres. Il descend " +
            "jusqu'à la base, qui le rejette — et ce qui remonte alors n'est plus un " +
            "refus lisible mais une panne. Confronté à l'ancien code, l'écran " +
            "affichait la requête SQL entière, noms de tables et identifiant " +
            `d'entreprise compris. Écran :\n      ` +
            ecran.split("\n").filter((l) => l.trim()).slice(0, 12).join("\n      ").slice(0, 900)
        );
      }
      const { rows: notes } = await pool.query(
        `select taille_octets from notes_vocales where chantier_id = $1`,
        [chantier]
      );
      if (notes.length > 0) {
        throw new Error(
          `une note a été rangée en base malgré le refus (${notes[0].taille_octets} octets) : ` +
            "l'écran et la base ne disent pas la même chose."
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
