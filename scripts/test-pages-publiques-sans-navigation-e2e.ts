import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import { CHEMINS_PUBLICS, estPageDuClient } from "../src/lib/chemins-publics";

// **Ce que voit le client de l'artisan ne porte JAMAIS l'outil de l'artisan.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 12 août 2026, capture à l'appui : *« lorsque le client reçoit le
// lien cliquable de la facture, s'il clique en dessous sur planning ou chantier,
// il a accès à mon application. Ce n'est pas du tout ce que je veux. »*
//
// **Il n'y avait pas de fuite** — vérifié : un appui sur « Planning » mène à la
// page de connexion, et aucune de ses données n'est lisible. Mais son client
// voyait « Chantiers · Planning · Terminés · Réglages » au bas de sa facture, ce
// qui est déjà un de trop : une facture n'est pas un écran d'application, et une
// barre de navigation inopérante est pire qu'absente.
//
// **La cause n'était pas un oubli isolé, c'était une duplication.** Deux listes
// tenaient la même vérité : le middleware savait `/factures` public depuis le
// 6 août, la mise en page ne connaissait que `/devis`. Un écran public ajouté
// plus tard n'entrait que dans l'une des deux.
//
// D'où ce balayage. Il ne vérifie pas « la facture », il vérifie **tous les
// chemins publics déclarés**, en les lisant à leur source
// (`src/lib/chemins-publics.ts`). Un nouveau chemin public y entre, et il est
// éprouvé le jour même — sans que personne ait à y penser.

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

/**
 * Les adresses publiques réellement visitables, avec un vrai jeton quand il en
 * faut un.
 *
 * **Un jeton inventé ne prouverait rien** : la page rendrait « lien inconnu »,
 * dont la mise en page peut différer de celle d'une facture réelle. C'est
 * exactement le genre de contrôle vert sur du vide que ce dépôt a déjà payé.
 */
async function adressesPubliques(): Promise<Array<[string, string]>> {
  const liste: Array<[string, string]> = [["la page de connexion", "/login"]];

  const devis = await pool.query(`select jeton from envois_devis limit 1`);
  if (devis.rows[0]) liste.push(["le devis vu par le client", `/devis/${devis.rows[0].jeton}`]);

  const facture = await pool.query(`select jeton from envois_factures limit 1`);
  if (facture.rows[0]) {
    liste.push(["la facture vue par le client", `/factures/${facture.rows[0].jeton}`]);
  }

  return liste;
}

async function main() {
  console.log("=== Le client de l'artisan ne voit pas l'outil de l'artisan ===\n");

  const navigateur = await lancerNavigateur();
  // **Aucune session.** C'est tout l'objet : ce contexte est celui du client,
  // qui n'a pas de compte et n'en aura jamais.
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  const adresses = await adressesPubliques();

  await cas(`des adresses publiques réelles ont été trouvées (${adresses.length})`, async () => {
    // Sans devis ni facture en base, il ne resterait que `/login` — et ce
    // balayage serait vert sans avoir regardé ce qui compte.
    if (adresses.length < 2) {
      throw new Error(
        "aucun lien client (devis ou facture) en base : ce contrôle n'éprouve alors " +
          "que la page de connexion, c'est-à-dire presque rien. Jouer d'abord " +
          "test-facture-au-client-e2e, qui en fabrique un."
      );
    }
  });

  for (const [quoi, chemin] of adresses) {
    await cas(`${quoi} — aucune barre de navigation`, async () => {
      await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);

      // On cherche l'élément lui-même, pas les mots : les libellés sont mis en
      // capitales par le style, et un contrôle qui lit « PLANNING » dans le
      // texte rendu passerait à côté selon la casse. Vécu le 12 août.
      const barre = await page.locator(".atlas-nav-basse").count();
      if (barre > 0) {
        throw new Error(
          "la barre de navigation du patron est présente sur une page publique. " +
            "Son client y voit les onglets de son outil de travail. Le chemin est-il " +
            "bien dans `src/lib/chemins-publics.ts` ?"
        );
      }
      for (const onglet of ["Chantiers", "Planning", "Terminés", "Réglages"]) {
        if (await page.getByRole("link", { name: onglet, exact: true }).count()) {
          throw new Error(`un lien « ${onglet} » est offert au client sur ${chemin}`);
        }
      }
    });
  }

  // **Et rien qui PARLE la langue du patron non plus.**
  //
  // La barre absente ne suffit pas. Le 13 août 2026, en vérifiant justement ce
  // contrôle sur la remarque du patron — *« s'il clique sur les cases en bas,
  // il est dans l'application »* —, j'ai trouvé que le veilleur des réponses
  // illisibles, posé la veille, était monté sur SES pages : au premier serveur
  // lent, son client aurait lu qu'« Atlas est en train de se préparer après une
  // mise à jour ». Une barre en moins, un bandeau en plus : la même faute d'un
  // cran plus bas.
  //
  // Ce cas ne vise que les DEUX pages que le client reçoit. `/login` est public
  // lui aussi, mais c'est l'écran du patron : ce qui lui parle d'Atlas y est
  // chez lui — d'où `estPageDuClient` et non `estCheminPublic`.
  for (const [quoi, chemin] of adresses.filter(([, c]) => estPageDuClient(c))) {
    await cas(`${quoi} — rien ne lui parle de l'outil de l'artisan`, async () => {
      await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
      // On provoque l'échec plutôt que de l'attendre : un veilleur monté ne se
      // voit pas tant que rien ne casse, et un contrôle qui regarde une page
      // paisible resterait vert en ne gardant rien.
      await page.evaluate(() => {
        const raison = new Error("An unexpected response was received from the server.");
        window.dispatchEvent(
          new PromiseRejectionEvent("unhandledrejection", {
            promise: Promise.reject(raison),
            reason: raison,
            cancelable: true,
          })
        );
      });
      await page.waitForTimeout(600);

      const bandeau = page.locator('[data-atlas="reponse-illisible"]');
      if (await bandeau.count()) {
        throw new Error(
          `Le client lit, sur ${chemin} : « ${(await bandeau.innerText()).replace(/\s+/g, " ").slice(0, 90)} ». ` +
            "Il n'a jamais entendu parler d'Atlas, et n'a rien à faire de l'état du banc de l'artisan."
        );
      }
    });
  }

  // **Et ce que le middleware protège vraiment.** La barre absente ne suffit
  // pas : ce qui compte pour le patron, c'est qu'aucune de ses données ne soit
  // lisible. On vérifie donc aussi la porte, pas seulement l'enseigne.
  await cas("sans compte, les écrans du patron restent fermés", async () => {
    for (const ecran of ["/", "/planning", "/termines", "/reglages"]) {
      await page.goto(`${BASE}${ecran}`, { waitUntil: "networkidle" });
      if (!page.url().includes("/login")) {
        throw new Error(
          `${ecran} s'est ouvert sans session (arrivé sur ${page.url()}). ` +
            "Ce n'est plus une gêne d'affichage : le client accède aux données du patron."
        );
      }
    }
  });

  await cas("les chemins publics déclarés sont bien tous couverts ici", async () => {
    // Un garde-fou contre le contrôle qui vieillit : si quelqu'un déclare un
    // nouveau chemin public sans l'ajouter ci-dessus, ce balayage continuerait
    // de passer au vert en ne regardant que les anciens.
    const couverts = ["/login", "/devis", "/factures", "/api/auth", "/api/cron", "/api/session-perimee"];
    const oublies = CHEMINS_PUBLICS.filter((p) => !couverts.includes(p));
    if (oublies.length > 0) {
      throw new Error(
        `chemin(s) public(s) déclaré(s) mais non éprouvé(s) ici : ${oublies.join(", ")}. ` +
          "Ajoutez-les à `adressesPubliques`, ou à la liste des chemins sans page visitable."
      );
    }
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Pages publiques — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
