import { getFournisseurVision } from "../providers/llm/fabrique";
import { zoneMesuree } from "@/lib/arrosage/croquis-complet";

/**
 * Lire un croquis de jardin photographié, avec ses métrés.
 *
 * *Sa demande du 20 août 2026 :* « le croquis et ses métrés, avec la
 * possibilité de mettre la photo. Ensuite, une fois qu'on a mis la photo et que
 * tu as analysé ce qu'il faut, tu fais apparaître un plan avec les différents
 * réseaux et le détail des pièces. »
 *
 * **Et sa correction, qui a rendu ce fichier possible :** il avait été répondu
 * que lire une image demandait une IA qu'Atlas n'avait pas. *« Tu peux le
 * faire, il y a déjà l'IA dans l'application, Anthropic et OpenAI. »* Il avait
 * raison — `lire-ticket.ts` fait la même chose depuis le 12 août
 * (`CLAUDE.md` §5 ter).
 *
 * ## Ce que la lecture rend, et ce qu'elle ne rend pas
 *
 * **Trois choses, et rien d'autre :** les surfaces de chaque partie du jardin,
 * la longueur des haies, et où se trouve le point d'eau. Le
 * découpage en réseaux et la liste des pièces se déduisent de là, et ce
 * calcul-là est déjà écrit (`src/lib/arrosage/calcul.js`).
 *
 * Elle ne rend **jamais un plan posé dans son dos** : ce qui sort est une
 * PROPOSITION que l'écran montre et qu'il corrige. Un croquis au crayon sur un
 * coin de table se lit mal, et un métré faux fait commander le mauvais nombre
 * d'arroseurs — c'est le paysagiste qui revient poser les manquants.
 *
 * **Ce qui n'a pas été lu reste vide et signalé**, jamais deviné
 * (`CLAUDE.md` §4). Une zone sans mesure n'est pas une zone de 10 × 5 par
 * défaut : c'est une zone dont on dit qu'on n'a pas su lire ses cotes.
 *
 * ## Ce qui est éprouvable ici, et ce qui ne l'est pas
 *
 * `lireReponseCroquis` est une fonction pure : elle prend le texte rendu par le
 * modèle et en tire des zones, ou refuse. Elle est éprouvée sans clé et sans
 * réseau (`scripts/test-lecture-croquis.ts`) — c'est là que vivent les pièges :
 * un modèle qui répond en prose, qui invente une surface de 40 000 m², qui rend
 * une largeur négative, ou qui mélange mètres et centimètres.
 *
 * **L'appel au fournisseur, lui, n'est pas éprouvé dans cet environnement** :
 * il n'y a aucune clé ici. Il devra l'être sur le banc du patron, avec un vrai
 * croquis — et tant que ce n'est pas fait, ça s'écrit « non vérifié »
 * (`AGENTS.md`).
 */

/** Une partie du jardin, telle que le croquis la montre. */
export type ZoneLue = {
  /** « gazon », « massif », « haie », « potager » — les types du calcul. */
  type: "gazon" | "massif" | "haie" | "potager";
  /** Ce que le croquis écrit à côté : « pelouse devant ». */
  nom: string | null;
  /** Pour une surface : longueur et largeur en mètres. `null` si non lues. */
  L: number | null;
  l: number | null;
  /** Pour une haie : les mètres linéaires. Le massif est une surface (L × l). */
  ml: number | null;
  /**
   * Combien de lignes de goutte-à-goutte pour une haie. Le dessin du plan le
   * donne (sa demande du 18 octobre 2026 : la largeur PROPOSE, il décide) ; la
   * photo, non, et le calcul en pose alors une.
   */
  lignesHaie?: number;
  /**
   * Où la zone se trouve SUR LE DESSIN, en fraction (0 à 1) — pas en mètres.
   *
   * **Sa demande du 22 août 2026 : « oui fais-le lire les proportions ».** Le
   * modèle voit qu'une pelouse occupe le tiers gauche du croquis ; il ne voit
   * pas qu'elle est à douze mètres du regard. Les mètres se déduisent ensuite
   * des cotes déjà lues (`geometrie-croquis.ts`), jamais du dessin.
   */
  x: number | null;
  y: number | null;
  largeurFraction: number | null;
  hauteurFraction: number | null;
};

export type CroquisLu = {
  zones: ZoneLue[];
  /** Où l'eau arrive : « compteur », « robinet », « puits », ou inconnu. */
  pointDEau: "compteur" | "robinet" | "puits" | null;
  /**
   * Où la nourrice est dessinée, en fraction du croquis. `null` si absente.
   *
   * **Elle ne se déduit JAMAIS du point d'eau** (`CLAUDE.md` §4 bis) : c'est
   * l'utilisateur qui la place, et l'endroit dépend de ce que lui seul sait —
   * un passage de voiture, un massif qu'on ne rouvre pas, l'accès pour
   * l'hivernage. Absente du croquis, elle reste absente ici.
   */
  nourrice: { x: number; y: number } | null;
  /**
   * Où le piquage est dessiné, en fraction du croquis. `null` si absent.
   *
   * **Sa règle du 11 septembre 2026 : l'amenée se CALCULE, ni lue ni
   * supposée.** Le croquis porte le piquage et la nourrice (ce sont deux des
   * trois éléments obligatoires) ; les cotes donnent l'échelle ; la longueur
   * du compteur à la nourrice s'en déduit (`geometrie-croquis.ts`), comme le
   * trajet du regard. Plus de 30 m posés d'office.
   */
  piquage: { x: number; y: number } | null;
  /** Ce que la lecture n'a pas su faire, dit en français au patron. */
  reserves: string[];
};

export type ResultatCroquis =
  | { ok: true; croquis: CroquisLu }
  | { ok: false; raison: string };

const SYSTEME = `Tu lis des croquis de jardin dessinés à la main par un paysagiste français, avec leurs métrés.
Tu réponds UNIQUEMENT par un objet JSON, sans phrase avant ni après, sans balises de code.
Forme attendue :
{"rotation_lecture":0|90|180|270,"zones":[{"type":"gazon|massif|haie|potager","nom":string|null,"longueur_m":number|null,"largeur_m":number|null,"metres_lineaires":number|null,"x":number|null,"y":number|null,"largeur_fraction":number|null,"hauteur_fraction":number|null,"cotes_deduites":[{"champ":"longueur_m|largeur_m|metres_lineaires","depuis":string}]}],"point_d_eau":"compteur|robinet|puits|null","nourrice":{"x":number|null,"y":number|null},"piquage":{"x":number|null,"y":number|null},"mots_d_arrosage":[string]}
Règles :
- Tu ne DEVINES jamais, mais tu DÉDUIS. Deviner, c'est écrire un nombre que rien sur le croquis ne donne : c'est interdit. Déduire, c'est tirer une cote d'une autre cote ÉCRITE, par la géométrie du dessin : c'est ce qu'on attend de toi, comme un paysagiste qui relit le croquis d'un collègue. Une cote qui ne se lit pas et ne se déduit pas vaut null. Une zone sans aucune cote se rend quand même, avec ses champs à null.
- LES CHIFFRES S'ÉCRIVENT DANS TOUS LES SENS. Un croquis fait à main levée porte ses cotes le long des bords, chacune dans son propre sens : couchée, de bas en haut, ou la tête en bas, indépendamment des mots et des autres cotes. Tourne CHAQUE nombre jusqu'à ce qu'il se lise comme une mesure en mètres. Une lecture qui ne donne pas une mesure plausible (des lettres mêlées aux chiffres, une virgule au mauvais endroit, un nombre absurde) veut dire que tu le lis dans le mauvais sens : retourne-le avant de conclure qu'il est illisible. La virgule est décimale : « 4,50 » vaut 4.5.
- UNE COTE MESURE LE BORD LE LONG DUQUEL ELLE EST ÉCRITE, souvent entre deux flèches ou deux petits traits. Plusieurs cotes écrites bout à bout sur un même bord s'additionnent : « 7,50 » puis « 4,50 » sur le même côté font 12 m. Une cote suivie de « M » ou « m » est en mètres ; « H » devant une cote donne une hauteur, jamais une longueur au sol.
- CE QUE TU DOIS DÉDUIRE, et seulement cela : (1) un bord non coté qui longe d'un bout à l'autre un bord coté d'une autre zone a la même longueur, par exemple une bande de goutte-à-goutte dessinée sur toute la hauteur d'une pelouse cotée 10 m mesure 10 m ; (2) le côté opposé d'une zone rectangulaire a la même longueur que le côté coté ; (3) la somme ou la différence de cotes écrites sur une même ligne. Tu ne déduis JAMAIS une cote des proportions du dessin : il n'est pas à l'échelle.
- CHAQUE COTE DÉDUITE SE DÉCLARE dans « cotes_deduites » de sa zone : « champ » nomme le champ rempli, « depuis » dit en quelques mots de quelle cote écrite elle vient (« le bord de la zone Arroseur, coté 10 m »). Une cote lue telle quelle sur le croquis n'y figure pas. Sans « depuis », la cote déduite est refusée.
- « rotation_lecture » : de combien de degrés, dans le sens des aiguilles d'une montre, il faut tourner la PHOTO pour que les noms des zones se lisent à l'endroit. Une feuille photographiée couchée, dont les mots se lisent de bas en haut, vaut 90. Les places, elles, se mesurent sur la photo TELLE QU'ELLE EST, sans la tourner : la rotation est appliquée ensuite.
- LES PLACES SE DONNENT EN FRACTION DU DESSIN, de 0 à 1. x=0 est le bord gauche, x=1 le bord droit ; y=0 le haut, y=1 le bas. « x » et « y » sont le CENTRE de la zone ; « largeur_fraction » et « hauteur_fraction » sont ce qu'elle occupe. Ne convertis JAMAIS ces places en mètres : les mètres se déduisent des cotes.
- « Tu ne devines jamais » NE S'APPLIQUE PAS AUX PLACES. Une cote se LIT (illisible = null) ; une place se MESURE SUR L'IMAGE, et tu la vois toujours dès que la zone est dessinée. Rends donc x, y, largeur_fraction et hauteur_fraction pour CHAQUE zone visible, même approximativement : le croquis est fait à main levée et n'est pas à l'échelle, personne n'attend d'exactitude. Ne les laisse à null que si la zone est citée par écrit sans être dessinée.
- La nourrice est le regard d'où partent les réseaux (souvent un rectangle marqué « nourrice », « regard » ou « vannes »). Si elle n'est pas dessinée, rends x et y à null, et ne la place pas au point d'eau pour dépanner.
- Le piquage est l'endroit où l'arrosage se branche sur l'eau (le compteur, le robinet, souvent marqué « compteur », « piquage », « arrivée d'eau », ou un rond avec un robinet). Une croix avec le mot « robinet » à côté est un piquage sur un robinet : rends sa place, et « robinet » pour point_d_eau. Rends sa place en fraction du dessin, comme la nourrice ; s'il n'est pas dessiné, x et y à null, et ne le place pas à la nourrice pour dépanner.
- CE QUE LE PAYSAGISTE ÉCRIT DANS UNE ZONE COMMANDE SON TYPE, avant ce que le dessin suggère. « Arroseur », « arroseurs », « turbines », « tuyères » : la zone reçoit des arroseurs, rends "gazon". « Goutte à goutte », « goutte-à-goutte », « GAG », « gaine » : la zone reçoit du goutte-à-goutte, jamais "gazon" ; rends "haie" si elle n'a qu'une longueur (une bande étroite le long d'un mur ou d'une zone se mesure par sa seule longueur), "massif" si elle a une longueur et une largeur. Recopie le mot écrit dans « nom ».
- Les pelouses, massifs et potagers se mesurent en longueur x largeur. Les haies se mesurent en mètres linéaires.
- Les mesures sont en MÈTRES, en nombre décimal à point. Un « 1200 » à côté d'une haie est probablement 12,00 m : rends 12.
- N'invente aucune zone qui ne figure pas sur le dessin.
- « mots_d_arrosage » : CHAQUE mot d'arrosage écrit sur le croquis, recopié tel quel, une fois par endroit où il est écrit (« GAG », « Goutte à goutte », « Arroseur »…). Chacun de ces mots désigne une zone à rendre dans « zones » : une bande marquée « GAG » en haut et une autre marquée « goutte à goutte » sur le côté font DEUX zones. Une flèche à côté du mot montre la bande qu'il désigne.
- Ce qu'on n'arrose pas n'est pas une zone : un parking, une allée, une terrasse, la maison, un garage, une route. Ne le rends pas, même s'il porte des cotes ; ses cotes servent seulement à placer le reste.
- Si le croquis ne montre pas d'où vient l'eau, rends null.`;

const CONSIGNE = "Lis ce croquis de jardin et rends l'objet JSON demandé.";

/** Les types que le calcul connaît — tout autre mot est refusé plutôt que traduit au jugé. */
const TYPES = ["gazon", "massif", "haie", "potager"] as const;

/**
 * L'arrosage que le paysagiste a ÉCRIT dans la zone, ou rien.
 *
 * **Son croquis du 20 octobre 2026** portait « Arroseur » sur la grande partie,
 * « GAG » et « Goutte à goutte » sur deux bandes : le plan est sorti tout en
 * goutte-à-goutte. Le type était laissé au jugement du modèle, qui ne voyait
 * écrit nulle part « pelouse ». Or le calcul ne pose des arroseurs que sur un
 * gazon : le mot écrit est un ordre, et il se lit ici, dans une règle qui
 * s'éprouve, pas dans la consigne seule.
 *
 * Le goutte-à-goutte se cherche d'abord : « arrosage goutte à goutte » n'est
 * pas une zone à arroseurs. « Arrosage » seul ne dit rien du matériel.
 */
/**
 * Une surface qu'on n'arrose pas, à son nom : « Parking », « Allée »…
 *
 * Sa seconde photo du 20 octobre 2026 : « Parking » est sorti en zone de
 * goutte-à-goutte, posée à droite, à la place de ses deux bandes. Le nom doit
 * COMMENCER par le mot : « Massif du parking » s'arrose, lui.
 */
function surfaceNonArrosee(nom: string | null): boolean {
  if (!nom) return false;
  const t = nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return /^(le |la |l'|l’)?(parking|allee|terrasse|maison|garage|trottoir|route|chemin|dallage|cour)\b/.test(t);
}

function arrosageEcrit(texte: string | null): "arroseurs" | "goutte" | null {
  if (!texte) return null;
  const t = texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/goutte|\bg\.?a\.?g\b|\bgaines?\b/.test(t)) return "goutte";
  if (/\barroseurs?\b|\bturbines?\b|\btuyeres?\b|\basperseurs?\b/.test(t)) return "arroseurs";
  return null;
}

/**
 * Ce que le modèle a répondu, transformé en zones — ou refusé.
 *
 * **Les défenses, chacune contre un travers observé des modèles.** Elles sont
 * celles de `lire-ticket.ts`, plus celles que le métier impose ici :
 *
 *  1. *Il entoure son objet* — on extrait le premier objet accoladé.
 *  2. *Il rend des chaînes là où on attend des nombres* — « 12,5 m » se
 *     convertit plutôt que de jeter une lecture juste.
 *  3. *Il confond les unités.* Un « 1200 » relevé à côté d'une haie est des
 *     centimètres ; au-delà de 200 m de linéaire ou de 100 m de côté, la valeur
 *     est refusée et signalée — un jardin de particulier n'a pas ces
 *     dimensions, et une cote fausse d'un facteur cent fait commander cent fois
 *     trop de tuyau.
 *  4. *Il invente pour faire plaisir* — une zone sans aucune cote est gardée
 *     mais **vide**, avec sa réserve. C'est au patron de la compléter.
 */
export function lireReponseCroquis(texte: string): ResultatCroquis {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut === -1 || fin <= debut) {
    return { ok: false, raison: "La lecture n'a rien rendu d'exploitable." };
  }

  let brut: Record<string, unknown>;
  try {
    brut = JSON.parse(texte.slice(debut, fin + 1)) as Record<string, unknown>;
  } catch {
    return { ok: false, raison: "La lecture n'a rien rendu d'exploitable." };
  }

  const chaine = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const p = v.trim();
    return p === "" || p.toLowerCase() === "null" ? null : p;
  };

  const nombre = (v: unknown): number | null => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v !== "string") return null;
    const p = v.replace(/[^\d,.-]/g, "").replace(",", ".");
    if (p === "" || p === "-" || p === ".") return null;
    const n = Number(p);
    return Number.isFinite(n) ? n : null;
  };

  /**
   * Une place sur le dessin : un nombre entre 0 et 1, ou rien.
   *
   * **Hors de [0, 1], on refuse plutôt que de ramener dans les bornes.** Un
   * modèle qui rend « 12 » pour un x n'a pas donné une fraction : il a donné
   * des mètres, ou un pixel, ou il s'est trompé de champ. Le rogner à 1
   * fabriquerait une position plausible et fausse, et c'est une distance de
   * tuyau qui en sortirait.
   */
  const fraction = (v: unknown): number | null => {
    const n = nombre(v);
    if (n === null) return null;
    return n >= 0 && n <= 1 ? n : null;
  };

  const reserves: string[] = [];

  /** Une cote plausible pour un jardin de particulier, ou rien. */
  const cote = (v: unknown, maxi: number, quoi: string): number | null => {
    const n = nombre(v);
    if (n === null) return null;
    if (n <= 0) {
      reserves.push(`une mesure nulle ou négative a été lue pour ${quoi}`);
      return null;
    }
    if (n > maxi) {
      reserves.push(`une mesure invraisemblable a été lue pour ${quoi} (${n} m)`);
      return null;
    }
    return Math.round(n * 100) / 100;
  };

  const brutZones = Array.isArray(brut.zones) ? brut.zones : [];
  if (brutZones.length === 0) {
    return { ok: false, raison: "Aucune partie de jardin n'a été reconnue sur ce croquis." };
  }

  const zones: ZoneLue[] = [];
  for (const z of brutZones) {
    if (typeof z !== "object" || z === null) continue;
    const o = z as Record<string, unknown>;
    const typeLu = (chaine(o.type) ?? "").toLowerCase();
    const nom = chaine(o.nom);
    if (surfaceNonArrosee(nom) && arrosageEcrit(nom) === null) {
      reserves.push(`« ${nom} » ne s’arrose pas : la zone a été écartée`);
      continue;
    }
    // **Le mot écrit dans la zone passe avant le type rendu** : une zone à
    // arroseurs est un gazon, une zone en goutte-à-goutte n'en est jamais un.
    // Une haie reste une haie, elle se mesure en longueur.
    const ecrit = arrosageEcrit(nom) ?? arrosageEcrit(typeLu);
    const typeBrut =
      ecrit === "arroseurs"
        ? "gazon"
        : ecrit === "goutte" && typeLu !== "haie" && typeLu !== "massif" && typeLu !== "potager"
          ? nombre(o.longueur_m) === null && nombre(o.metres_lineaires) !== null
            ? "haie"
            : "massif"
          : typeLu;
    if (!(TYPES as readonly string[]).includes(typeBrut)) {
      // **Un type inconnu ne se traduit pas au jugé.** « verger » rangé en
      // « gazon » lui poserait des turbines sur des arbres fruitiers.
      reserves.push(`une zone d'un type non reconnu a été écartée (« ${typeBrut || "sans type"} »)`);
      continue;
    }
    const type = typeBrut as ZoneLue["type"];
    // **Le massif est une surface** : le calcul y couche des lignes parallèles
    // sur sa longueur et sa largeur. Lu en mètres linéaires, il n'en avait
    // aucune, et ne recevait pas une goutte (18 octobre 2026).
    const lineaire = type === "haie";
    // **UNE COTE DÉDUITE SE GARDE SI ELLE DIT D'OÙ ELLE VIENT** — sa demande du
    // 21 octobre 2026 : *« si le jardin fait 10 mètres, que la bande de goutte à
    // goutte fait la même taille que le jardin, forcément la bande fait 10
    // mètres »*. Déduire d'une cote écrite n'est pas deviner (`arrosage.md`,
    // règle 1) ; une déduction sans source, si. La réserve la montre sous le
    // plan, là où « Modifier » la corrige. Elle nomme la VALEUR et non le côté :
    // au quart de tour, la longueur et la largeur s'échangent plus bas.
    const deduites = new Map<string, string>();
    for (const d of Array.isArray(o.cotes_deduites) ? o.cotes_deduites : []) {
      if (typeof d !== "object" || d === null) continue;
      const champ = chaine((d as Record<string, unknown>).champ);
      if (champ) deduites.set(champ, chaine((d as Record<string, unknown>).depuis) ?? "");
    }
    const coteDe = (champ: "longueur_m" | "largeur_m" | "metres_lineaires", maxi: number) => {
      const depuis = deduites.get(champ);
      if (depuis === "") return null;
      const valeur = cote(o[champ], maxi, nom ?? type);
      if (valeur !== null && depuis !== undefined) {
        reserves.push(
          `la cote de ${String(valeur).replace(".", ",")} m de « ${nom ?? type} » n’est pas écrite, elle est déduite de ${depuis} : vérifiez-la`,
        );
      }
      return valeur;
    };
    const zone: ZoneLue = {
      type,
      nom,
      L: lineaire ? null : coteDe("longueur_m", 100),
      l: lineaire ? null : coteDe("largeur_m", 100),
      ml: lineaire ? coteDe("metres_lineaires", 200) : null,
      x: fraction(o.x),
      y: fraction(o.y),
      largeurFraction: fraction(o.largeur_fraction),
      hauteurFraction: fraction(o.hauteur_fraction),
    };
    // Une zone dont aucune cote n'a été lue reste dans la liste — le patron sait
    // qu'elle existe et la complète. La faire disparaître lui ferait croire que
    // le croquis ne la montrait pas.
    if (!zoneMesuree(zone)) {
      reserves.push(`les cotes de « ${nom ?? type} » n’ont pas pu être lues`);
    }
    zones.push(zone);
  }

  if (zones.length === 0) {
    return { ok: false, raison: "Aucune partie de jardin n'a été reconnue sur ce croquis." };
  }

  // **UNE ZONE ÉCRITE NE SE PERD PAS EN SILENCE** (20 octobre 2026). Le modèle
  // recopie chaque mot d'arrosage qu'il voit ; s'il rend moins de zones que de
  // mots, une partie du jardin manque au plan, et elle se dit sous le plan.
  // Moins de mots que de zones ne dit rien : une flèche peut en désigner deux.
  const mots = Array.isArray(brut.mots_d_arrosage) ? brut.mots_d_arrosage.map(chaine) : [];
  const ecrits = (quoi: "goutte" | "arroseurs") => mots.filter((m) => arrosageEcrit(m) === quoi).length;
  const lues = (gazon: boolean) => zones.filter((z) => (z.type === "gazon") === gazon).length;
  const manque = (n: number, lu: number, quoi: string) => {
    if (n <= lu) return;
    const nombre = lu === 0 ? "aucune n’a été lue" : `${lu} seulement ${lu > 1 ? "ont été lues" : "a été lue"}`;
    reserves.push(
      n === 1
        ? `1 zone ${quoi} est écrite sur le croquis, elle n’a pas été lue : le plan ne l’arrose pas`
        : `${n} zones ${quoi} sont écrites sur le croquis, ${nombre} : le plan ne les arrose pas toutes`,
    );
  };
  manque(ecrits("goutte"), lues(false), "de goutte-à-goutte");
  manque(ecrits("arroseurs"), lues(true), "à arroseurs");

  const eauBrute = (chaine(brut.point_d_eau) ?? "").toLowerCase();
  const pointDEau =
    eauBrute === "compteur" || eauBrute === "robinet" || eauBrute === "puits" ? eauBrute : null;
  if (pointDEau === null) reserves.push("le croquis ne dit pas d’où vient l’eau");

  // **LA NOURRICE SE LIT, ELLE NE SE DÉDUIT PAS** (`CLAUDE.md` §4 bis). Absente
  // du dessin, elle reste absente : la poser au point d'eau « pour dépanner »
  // ferait creuser au mauvais endroit, et une tranchée ne se déplace pas.
  const nourriceBrute = (brut.nourrice ?? {}) as Record<string, unknown>;
  const nx = fraction(nourriceBrute.x);
  const ny = fraction(nourriceBrute.y);
  const nourrice = nx !== null && ny !== null ? { x: nx, y: ny } : null;
  if (nourrice === null) {
    reserves.push("le croquis ne montre pas où la nourrice est posée");
  }
  // **Le piquage se LIT, il ne se déduit pas** — même règle que la nourrice,
  // pour la même raison : c'est sa place qui donne la longueur de l'amenée, et
  // une amenée posée au jugé entre dans la pression au dernier arroseur.
  const piquageBrut = (brut.piquage ?? {}) as Record<string, unknown>;
  const px = fraction(piquageBrut.x);
  const py = fraction(piquageBrut.y);
  const piquage = px !== null && py !== null ? { x: px, y: py } : null;
  if (piquage === null) {
    reserves.push("le croquis ne montre pas où le piquage se fait");
  }

  // **LA FEUILLE SE LIT DANS LE SENS DE SON ÉCRITURE** (20 octobre 2026). Sa
  // photo était prise feuille couchée : le plan posait le parking à droite,
  // alors qu'il est sous la pelouse. Le modèle dit de combien tourner ; le
  // quart de tour se calcule ici, parce qu'un modèle qui tourne des
  // coordonnées de tête se trompe de côté.
  const rotation = nombre(brut.rotation_lecture);
  const quart = rotation === null ? 0 : ((rotation % 360) + 360) % 360;
  if (quart !== 0 && quart !== 90 && quart !== 180 && quart !== 270) {
    reserves.push("le sens de lecture du croquis n’a pas été compris : les zones sont placées comme sur la photo");
    return { ok: true, croquis: { zones, pointDEau, nourrice, piquage, reserves } };
  }
  const tourner = (p: { x: number; y: number }) =>
    quart === 90 ? { x: 1 - p.y, y: p.x } : quart === 180 ? { x: 1 - p.x, y: 1 - p.y } : quart === 270 ? { x: p.y, y: 1 - p.x } : p;
  const couche = quart === 90 || quart === 270;
  const zonesLues = zones.map((z) => {
    const place = z.x !== null && z.y !== null ? tourner({ x: z.x, y: z.y }) : { x: z.x, y: z.y };
    // La longueur suit le côté horizontal du dessin (`geometrie-croquis.ts`) :
    // au quart de tour, elle échange sa place avec la largeur.
    return couche
      ? { ...z, ...place, L: z.l, l: z.L, largeurFraction: z.hauteurFraction, hauteurFraction: z.largeurFraction }
      : { ...z, ...place };
  });
  return {
    ok: true,
    croquis: {
      zones: zonesLues,
      pointDEau,
      nourrice: nourrice && tourner(nourrice),
      piquage: piquage && tourner(piquage),
      reserves,
    },
  };
}

/**
 * Photographier, lire, proposer.
 *
 * **Sans fournisseur de vision, on refuse proprement** — l'écran retombe alors
 * sur la saisie à la main, qui est un parcours entier et non une panne.
 */
export async function lireCroquis(base64: string, mimeType: string): Promise<ResultatCroquis> {
  // **Le fournisseur de VISION, pas celui qui rédige** — corrigé le 21 août
  // 2026. `getFournisseurVision()` existe depuis la veille, précisément pour
  // que « qui regarde les photos » se règle sans toucher à « qui rédige » ; le
  // croquis appelait pourtant le second. Une installation qui pose
  // `VISION_PROVIDER` envoyait donc ses croquis au mauvais endroit, en silence.
  const fournisseur = getFournisseurVision();
  if (!fournisseur.lireImage) {
    return { ok: false, raison: "La lecture automatique n’est pas disponible ici." };
  }
  const r = await fournisseur.lireImage(SYSTEME, CONSIGNE, { base64, mimeType });
  if (!r.succes) {
    // Le message du fournisseur est repris tel quel : « clé refusée » et
    // « quota dépassé » ne se réparent pas de la même façon.
    return { ok: false, raison: r.erreur.message };
  }
  return lireReponseCroquis(r.texte);
}
