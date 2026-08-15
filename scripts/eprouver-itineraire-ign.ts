/**
 * Le service d'itinéraire de l'IGN vaut-il ce qu'on espère ?
 *
 * **Pourquoi ce script existe.** Le patron veut qu'Atlas propose d'apparier
 * deux chantiers d'une demi-journée pour faire une journée, en regardant
 * lesquels sont les plus proches. La question qui commande tout le reste :
 * mesure-t-on **à vol d'oiseau** ou **par la route** ?
 *
 * Par la route suppose d'envoyer les adresses de ses clients à un service
 * extérieur — donc un **sous-traitant ultérieur** de plus, à nommer dans un
 * contrat qui n'existe pas encore (`docs/A-FAIRE.md` points 1 et 2). C'est
 * exactement le raisonnement qui a fait préférer la Base Adresse Nationale à
 * Google (`src/server/adresses/base-adresse-nationale.ts`).
 *
 * **Sauf que l'État publie aussi un service d'itinéraire**, sur la même
 * Géoplateforme que les adresses. S'il tient, la route rentre dans la même case
 * que la Base Adresse Nationale : service public, sans compte, sans clé, sans
 * contrat avec une entreprise privée.
 *
 * **Personne ne peut le vérifier depuis l'environnement de développement** —
 * son mandataire réseau refuse les services extérieurs. Ce script est donc fait
 * pour tourner ailleurs, sur une machine qui a le réseau
 * (`.github/workflows/itineraire.yml`), comme `pages.yml` pour le site publié
 * et `adresses.yml` pour la Base Adresse Nationale.
 *
 * **Il RAPPORTE avant de juger.** Son but n'est pas de garder un comportement
 * acquis, mais d'éclairer une décision qui n'est pas prise : il imprime ce que
 * le service répond vraiment, et n'échoue que s'il est inutilisable.
 */

// **Ce fichier n'importe rien**, ce qui en fait un script GLOBAL aux yeux de
// TypeScript : son `main` entrait alors en collision avec celui des autres
// scripts du dossier — « Duplicate function implementation ». `export {}` en
// fait un module, et la fonction porte son propre nom plutôt que `main` :
// ceinture et bretelles, parce que le premier des deux seul n'a pas suffi.
export {};

const BAN = "https://api-adresse.data.gouv.fr/search/";
const IGN = "https://data.geopf.fr/navigation/itineraire";

/**
 * Des places de mairie, jamais une adresse de client.
 *
 * Choisies dans les monts du Lyonnais **exprès** : c'est le relief qui fait
 * diverger le vol d'oiseau et la route, et c'est précisément l'écart qu'on veut
 * chiffrer. Deux communes séparées par une colline sont proches sur une carte
 * et loin en camion.
 */
const LIEUX = [
  "Place de la Mairie 69850 Saint-Martin-en-Haut",
  "Place de la Mairie 69610 Sainte-Foy-l'Argentière",
  "Place de la Mairie 69440 Mornant",
  "Place Bellecour 69002 Lyon",
];

type Point = { libelle: string; lon: number; lat: number };

/** La distance à vol d'oiseau, en kilomètres — celle qui ne coûte rien. */
function volDOiseau(a: Point, b: Point): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function geocoder(libelle: string): Promise<Point> {
  const url = new URL(BAN);
  url.searchParams.set("q", libelle);
  url.searchParams.set("limit", "1");
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`La Base Adresse Nationale répond ${r.status} pour « ${libelle} »`);
  const j = (await r.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
  const c = j.features?.[0]?.geometry?.coordinates;
  if (!c) throw new Error(`Aucune coordonnée rendue pour « ${libelle} »`);
  return { libelle, lon: c[0], lat: c[1] };
}

type Trajet = {
  statut: number;
  ms: number;
  distanceKm: number | null;
  minutes: number | null;
  entetes: Record<string, string>;
  corpsCourt: string;
};

/**
 * On ne suppose PAS le format de la réponse.
 *
 * Le service peut rendre les distances en mètres ou en kilomètres, les durées
 * en secondes ou en « HH:MM:SS », et nommer ses champs autrement demain. Un
 * script qui affirmerait un schéma qu'il n'a jamais vu répondrait à côté — on
 * lit donc largement, et l'on imprime le corps brut quand on ne reconnaît rien.
 */
async function itineraire(a: Point, b: Point): Promise<Trajet> {
  const url = new URL(IGN);
  url.searchParams.set("resource", "bdtopo-osrm");
  url.searchParams.set("profile", "car");
  url.searchParams.set("optimization", "fastest");
  url.searchParams.set("start", `${a.lon},${a.lat}`);
  url.searchParams.set("end", `${b.lon},${b.lat}`);
  url.searchParams.set("distanceUnit", "kilometer");
  url.searchParams.set("timeUnit", "minute");
  url.searchParams.set("geometryFormat", "geojson");

  const t0 = Date.now();
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const ms = Date.now() - t0;
  const texte = await r.text();

  // Les en-têtes qui disent ce qu'on a le droit de faire — s'ils existent.
  const entetes: Record<string, string> = {};
  for (const nom of [
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
    "retry-after",
    "content-type",
  ]) {
    const v = r.headers.get(nom);
    if (v) entetes[nom] = v;
  }

  let distanceKm: number | null = null;
  let minutes: number | null = null;
  try {
    const j = JSON.parse(texte) as Record<string, unknown>;
    const nombre = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN);
    const d = nombre(j.distance);
    const t = nombre(j.duration);
    if (Number.isFinite(d)) distanceKm = d;
    if (Number.isFinite(t)) minutes = t;
  } catch {
    // Corps non JSON : on l'imprimera tel quel, c'est l'information utile.
  }

  return { statut: r.status, ms, distanceKm, minutes, entetes, corpsCourt: texte.slice(0, 300) };
}

async function eprouver() {
  console.log("=== Le service d'itinéraire de l'IGN, interrogé pour de vrai ===\n");
  console.log("Aucune clé, aucun compte : c'est justement ce qu'on vérifie.\n");

  const points: Point[] = [];
  for (const l of LIEUX) {
    const p = await geocoder(l);
    points.push(p);
    console.log(`  · ${l} → ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`);
  }

  console.log("\n--- Vol d'oiseau contre route ---\n");
  console.log("  De → vers                                          oiseau    route    durée   écart");

  let joignable = 0;
  let refuse = 0;
  const paires: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 2],
    [0, 3],
  ];

  for (const [i, j] of paires) {
    const a = points[i];
    const b = points[j];
    const oiseau = volDOiseau(a, b);
    const t = await itineraire(a, b);

    const court = (p: Point) => p.libelle.replace(/^Place (de la Mairie|Bellecour)\s*/, "").trim();
    const nom = `${court(a)} → ${court(b)}`.padEnd(48).slice(0, 48);

    if (t.statut !== 200) {
      refuse += 1;
      console.log(`  ${nom} ${oiseau.toFixed(1).padStart(6)} km   REFUS ${t.statut}`);
      console.log(`      corps : ${t.corpsCourt.replace(/\s+/g, " ")}`);
      continue;
    }
    joignable += 1;
    const route = t.distanceKm;
    const duree = t.minutes;
    if (route === null) {
      console.log(`  ${nom} ${oiseau.toFixed(1).padStart(6)} km   répond 200, mais format non reconnu`);
      console.log(`      corps : ${t.corpsCourt.replace(/\s+/g, " ")}`);
      continue;
    }
    const ecart = route / oiseau;
    console.log(
      `  ${nom} ${oiseau.toFixed(1).padStart(6)} km ${route.toFixed(1).padStart(7)} km ` +
        `${(duree ?? NaN).toFixed(0).padStart(6)} min   ×${ecart.toFixed(2)}   (${t.ms} ms)`
    );
    if (Object.keys(t.entetes).length) {
      console.log(`      en-têtes : ${JSON.stringify(t.entetes)}`);
    }
  }

  // **Ce qu'on a le droit de demander, et à quel rythme.** Aucune page ne le
  // dira aussi sûrement qu'une rafale : on en envoie dix d'affilée et l'on
  // regarde si le service se ferme. C'est la question qui décide de l'usage —
  // un service qui refuse à la dixième requête ne peut pas classer quinze
  // chantiers à l'ouverture d'un écran.
  console.log("\n--- Dix appels d'affilée : le service tient-il le rythme ? ---\n");
  const debut = Date.now();
  const statuts: number[] = [];
  for (let k = 0; k < 10; k++) {
    const t = await itineraire(points[0], points[1]);
    statuts.push(t.statut);
  }
  const total = Date.now() - debut;
  const refus = statuts.filter((s) => s !== 200);
  console.log(`  ${statuts.length} appels en ${total} ms — ${Math.round(total / statuts.length)} ms en moyenne`);
  console.log(`  statuts : ${[...new Set(statuts)].join(", ")}`);
  if (refus.length) console.log(`  ⚠ ${refus.length} refus : ${[...new Set(refus)].join(", ")}`);

  console.log("\n─────────────────────────────────────────────────────────────");
  if (joignable === 0) {
    console.log("❌ Le service n'a répondu à AUCUNE demande.");
    console.log("   La route reste hors de portée sans prestataire privé — donc sans");
    console.log("   contrat de sous-traitance. On s'en tient au vol d'oiseau.");
    process.exit(1);
  }
  if (refuse > 0 || refus.length > 0) {
    console.log(`⚠ Le service répond, mais pas toujours (${refuse} refus sur les trajets,`);
    console.log(`  ${refus.length} sur la rafale). À lire avant de s'appuyer dessus.`);
    return;
  }
  console.log("✅ Le service répond, sans clé ni compte.");
  console.log("   Reste à décider : la colonne « écart » dit ce que le vol d'oiseau");
  console.log("   fait perdre, et la rafale ce que le service supporte.");
}

eprouver().catch((e) => {
  console.error("\n❌ La vérification s'est interrompue :", e instanceof Error ? e.message : e);
  process.exit(1);
});
