/**
 * Ajoute cinq chantiers de test pour essayer la proposition « par le trajet ».
 *
 * **Pourquoi un script à part, et non le seed.** Le seed
 * (`src/server/db/seed.ts`) VIDE puis reconstruit tout, et une dizaine de
 * suites comptent exactement ses quatre chantiers (`verify-liste-4-chantiers`,
 * le tableau de bord…). Y verser cinq chantiers de plus casserait la batterie,
 * et le seed ne tourne de toute façon qu'à la CRÉATION du conteneur
 * (`.devcontainer/preparer.sh`) : sur un banc déjà allumé, il ne repasse jamais.
 * Ce script, lui, s'ajoute à l'entreprise de démonstration existante SANS rien
 * tronquer, et se relance sur un banc en marche — c'est ce que le patron a
 * demandé le 16 août 2026 pour éprouver l'appariement de deux demi-journées.
 *
 * **Ce que chaque chantier doit avoir pour devenir un candidat** — la règle est
 * dans `chantiersDemiJourneeAPlanifier` (`src/server/repositories/chantiers.ts`) :
 *   · un devis parti (`devisEnvoyeAt` non nul) — avant, un chantier n'a rien à
 *     faire dans un planning ;
 *   · aucune date posée (`datePlanifiee` nul) — « pas encore ajouté au planning » ;
 *   · pas terminé (`termineAt` nul) ;
 *   · une durée d'UNE demi-journée, lue de `dureePrevue` par `dureeEnDemiJournees`.
 *
 * **Les coordonnées sont posées ici**, avec `adresseSituee = adresseChantier`,
 * pour que l'appariement fonctionne dès la première ouverture sans dépendre
 * d'un appel à la Base Adresse Nationale (que le mandataire réseau du banc peut
 * refuser). Ce sont les mairies des communes, à quelques centaines de mètres
 * près : bien assez pour un temps de trajet en camion.
 *
 * **Un chantier est POSÉ d'office, sur la prochaine matinée libre.** La
 * proposition par trajet part toujours d'un chantier DÉJÀ posé sur une
 * demi-journée : sans point de départ, elle n'a rien à comparer et ne s'affiche
 * pas. Cinq chantiers tous « sans date » ne montraient donc jamais la
 * fonctionnalité — c'est le blocage signalé le 17 août 2026. Le script pose donc
 * le premier (« Portail Rezé ») le matin ; son après-midi reste libre, et à
 * l'ouverture de ce jour la proposition apparaît, classée par le trajet depuis
 * Rezé. Les quatre autres restent « sans date » : ce sont les candidats proposés.
 *
 * **Idempotent.** Les chantiers de test portent tous le préfixe « Chantier
 * test — » et leurs clients le suffixe « (test) » : on les efface avant de les
 * réinsérer, de sorte qu'un second passage ne les double pas. La suppression
 * est bornée à l'entreprise de démonstration par la RLS.
 *
 * **`withEntreprise`, jamais `db` en direct** (`CLAUDE.md` §3) : le contexte
 * d'isolation est posé, comme pour n'importe quel appel réel. La pose passe par
 * `planifierChantier`, la même fonction que l'écran — jamais une seconde règle
 * qui finirait par diverger.
 *
 * Lancement, sur le banc, avec la même base que l'application :
 *
 *     npm run essai:chantiers-trajets
 */
import { eq, like, sql } from "drizzle-orm";
import { pool, db } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { entreprises, membresEntreprise, clients, chantiers } from "../src/server/db/schema";
import { planifierChantier } from "../src/server/repositories/chantiers";
import { distanceOiseauKm } from "../src/lib/appariement-demi-journees";

type ChantierTest = {
  nom: string;
  client: string;
  telephone: string;
  adresse: string;
  latitude: number;
  longitude: number;
};

// Autour de Nantes, du plus proche au plus lointain — des écarts « plus ou
// moins espacés » comme demandé. Le dernier (Pornic) dépasse le seuil des
// 40 km à vol d'oiseau depuis les premiers : il tombera dans « écartés », ce
// qui laisse aussi essayer le « Voir quand même ».
const CHANTIERS: ChantierTest[] = [
  {
    nom: "Chantier test — Portail Rezé",
    client: "M. Girard (test)",
    telephone: "06 00 00 00 01",
    adresse: "8 rue Jean Jaurès, 44400 Rezé",
    latitude: 47.1926,
    longitude: -1.5626,
  },
  {
    nom: "Chantier test — Clôture Bouguenais",
    client: "M. Lucas (test)",
    telephone: "06 00 00 00 02",
    adresse: "4 rue de la Loire, 44340 Bouguenais",
    latitude: 47.1725,
    longitude: -1.6249,
  },
  {
    nom: "Chantier test — Terrasse Vertou",
    client: "Mme Hamon (test)",
    telephone: "06 00 00 00 03",
    adresse: "15 rue de la Garenne, 44120 Vertou",
    latitude: 47.1697,
    longitude: -1.4699,
  },
  {
    nom: "Chantier test — Muret Clisson",
    client: "Mme Renard (test)",
    telephone: "06 00 00 00 04",
    adresse: "22 rue des Vignes, 44190 Clisson",
    latitude: 47.0878,
    longitude: -1.2864,
  },
  {
    nom: "Chantier test — Abri Pornic",
    client: "M. Moreau (test)",
    telephone: "06 00 00 00 05",
    adresse: "10 rue du Port, 44210 Pornic",
    latitude: 47.1159,
    longitude: -2.1044,
  },
];

/** Une demi-journée, dans les mots que `dureeEnDemiJournees` reconnaît. */
const DUREE_DEMI_JOURNEE = "une demi-journée";

/**
 * Le prochain jour ouvrable (lundi–vendredi) strictement après aujourd'hui.
 *
 * **Pourquoi pas aujourd'hui.** Un chantier posé « ce matin » a peut-être déjà
 * commencé : le poser à venir laisse voir la proposition sans ambiguïté. On
 * saute samedi et dimanche — l'artisan ne cale pas une intervention le week-end,
 * et le planning barre ces jours.
 */
function prochainJourOuvrable(depuis: Date): string {
  const d = new Date(Date.UTC(depuis.getUTCFullYear(), depuis.getUTCMonth(), depuis.getUTCDate()));
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // `entreprises` n'est pas sous RLS (drizzle/0001) : lecture directe permise.
  const lignesEntreprise = await db
    .select({ id: entreprises.id, nom: entreprises.nom })
    .from(entreprises)
    .orderBy(entreprises.createdAt)
    .limit(1);
  const entreprise = lignesEntreprise[0];
  if (!entreprise) {
    throw new Error(
      "Aucune entreprise en base. Lancez d'abord le seed de démonstration (npm run db:seed)."
    );
  }

  // Le propriétaire, pour poser `created_by` — et pour donner à withEntreprise
  // une adhésion réelle à vérifier. membres_entreprise EST sous RLS : on pose
  // le contexte avant de lire, comme le fait withEntreprise lui-même.
  const utilisateurId = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${entreprise.id}, true)`);
    const membres = await tx
      .select({ utilisateurId: membresEntreprise.utilisateurId })
      .from(membresEntreprise)
      .where(eq(membresEntreprise.role, "proprietaire"))
      .limit(1);
    if (membres.length === 0) {
      throw new Error(`L'entreprise ${entreprise.nom} n'a aucun propriétaire.`);
    }
    return membres[0].utilisateurId;
  });

  const maintenant = new Date();
  const idParNom: Record<string, string> = {};

  await withEntreprise(utilisateurId, entreprise.id, async (tx) => {
    // Effacer une éventuelle exécution précédente : le préfixe « Chantier
    // test — » et le suffixe « (test) » les isolent des vraies données. La RLS
    // borne déjà la suppression à cette entreprise.
    await tx.delete(chantiers).where(like(chantiers.nom, "Chantier test — %"));
    await tx.delete(clients).where(like(clients.nom, "% (test)"));

    for (const c of CHANTIERS) {
      const [client] = await tx
        .insert(clients)
        .values({ entrepriseId: entreprise.id, nom: c.client, telephone: c.telephone })
        .returning();

      const [chantier] = await tx.insert(chantiers).values({
        entrepriseId: entreprise.id,
        clientId: client.id,
        nom: c.nom,
        adresseChantier: c.adresse,
        // Coordonnées posées d'avance, et l'adresse qui les a produites : tant
        // que les deux coïncident, l'appariement ne les refera pas.
        latitude: String(c.latitude),
        longitude: String(c.longitude),
        adresseSituee: c.adresse,
        // Les quatre jalons datés jusqu'à « devis envoyé » : c'est ce dernier
        // qui fait entrer le chantier dans le planning. Les dater tous garde le
        // chantier cohérent (on ne saute pas d'étape).
        informationsVerifieesAt: maintenant,
        prixValideAt: maintenant,
        devisGenereAt: maintenant,
        devisEnvoyeAt: maintenant,
        // Pas encore au planning, pas terminé : c'est ce qui en fait un candidat.
        datePlanifiee: null,
        termineAt: null,
        // La durée dictée, lue comme UNE demi-journée.
        dureePrevue: DUREE_DEMI_JOURNEE,
        createdBy: utilisateurId,
        updatedBy: utilisateurId,
        createdAt: maintenant,
        updatedAt: maintenant,
      }).returning({ id: chantiers.id });
      idParNom[c.nom] = chantier.id;
    }
  });

  // **Poser le chantier de départ**, sinon la proposition n'a rien d'où partir.
  // Le matin de la prochaine journée ouvrable ; l'après-midi reste libre. On
  // passe par `planifierChantier` — la fonction même de l'écran — plutôt que
  // par un UPDATE à la main, pour ne pas dupliquer sa logique d'occupation.
  // **L'équipe ne se pose plus ici** : depuis la migration 0058 elle se coche
  // demi-journée par demi-journée, après la pose. Le trou de l'après-midi, lui,
  // ne dépend d'aucune équipe.
  const departNom = CHANTIERS[0].nom;
  const jourDepart = prochainJourOuvrable(maintenant);
  await planifierChantier({ utilisateurId, entrepriseId: entreprise.id }, idParNom[departNom], jourDepart, {
    quand: "matin",
  });

  const jourLisible = new Date(`${jourDepart}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  console.log(`✅ ${CHANTIERS.length} chantiers de test ajoutés à « ${entreprise.nom} ».`);
  console.log(`   « ${departNom.replace("Chantier test — ", "")} » est posé le ${jourLisible} matin.`);
  console.log(`   Ouvrez ce jour dans le planning : l'après-midi propose les plus proches.`);
  console.log("   Les quatre autres restent « sans date » — ce sont les candidats.\n");

  // La matrice des distances à vol d'oiseau, pour VOIR l'espacement — et vérifier
  // qu'il est bien « plus ou moins espacé ». Le seuil d'appariement est à 40 km.
  console.log("   Distances à vol d'oiseau entre chantiers (km) :");
  const noms = CHANTIERS.map((c) => c.nom.replace("Chantier test — ", ""));
  const largeur = Math.max(...noms.map((n) => n.length));
  const entete = " ".repeat(largeur + 2) + noms.map((n) => n.slice(0, 6).padStart(7)).join("");
  console.log("   " + entete);
  for (let i = 0; i < CHANTIERS.length; i++) {
    const cellules = CHANTIERS.map((_, j) => {
      if (i === j) return "      ·";
      const km = distanceOiseauKm(CHANTIERS[i], CHANTIERS[j]);
      return `${Math.round(km)}`.padStart(7);
    }).join("");
    console.log("   " + noms[i].padEnd(largeur + 2) + cellules);
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    return pool.end().finally(() => process.exit(1));
  });
