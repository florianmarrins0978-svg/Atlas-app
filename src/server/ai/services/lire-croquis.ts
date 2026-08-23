import { getFournisseurVision } from "../providers/llm/fabrique";

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
 * les longueurs de haie et de massif, et où se trouve le point d'eau. Le
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
  /** Pour une haie ou un massif : les mètres linéaires. */
  ml: number | null;
  /**
   * OÙ la zone se trouve — le coin haut-gauche, en mètres, sur le repère du
   * croquis. `null` quand le dessin ne permet pas de la situer.
   *
   * **Sans elle, aucun plan ne peut être DESSINÉ** — seulement compté. C'est
   * ce qui manquait le 23 août 2026 : la lecture rendait des surfaces sans
   * jamais dire où elles étaient, et le plan des maquettes portait donc le
   * contour de SON jardin, écrit en dur.
   */
  x: number | null;
  y: number | null;
};

export type CroquisLu = {
  zones: ZoneLue[];
  /** Où l'eau arrive : « compteur », « robinet », « puits », ou inconnu. */
  pointDEau: "compteur" | "robinet" | "puits" | null;
  /**
   * L'ENDROIT DÉFINITIF DE LA NOURRICE, sur le même repère que les zones.
   *
   * **`null` n'est pas un manque à combler : c'est un refus** (`CLAUDE.md`
   * §4 bis). *« L'outil doit fonctionner avec un plan avec toutes les métrées,
   * l'emplacement du piquage et l'endroit définitif de la nourrice — sans ça
   * il ne doit rien proposer. »* Et surtout, on ne la DEVINE pas : *« c'est
   * l'utilisateur qui placera la nourrice où il veut »*. Informer n'est pas
   * proposer.
   */
  nourrice: { x: number; y: number } | null;
  /** Ce que la lecture n'a pas su faire, dit en français au patron. */
  reserves: string[];
};

export type ResultatCroquis =
  | { ok: true; croquis: CroquisLu }
  | { ok: false; raison: string };

const SYSTEME = `Tu lis des croquis de jardin dessinés à la main par un paysagiste français, avec leurs métrés.
Tu réponds UNIQUEMENT par un objet JSON, sans phrase avant ni après, sans balises de code.
Forme attendue :
{"zones":[{"type":"gazon|massif|haie|potager","nom":string|null,"longueur_m":number|null,"largeur_m":number|null,"metres_lineaires":number|null,"x_m":number|null,"y_m":number|null}],"point_d_eau":"compteur|robinet|puits|null","nourrice":{"x_m":number,"y_m":number}|null}
Règles :
- Tu ne DEVINES jamais. Une cote illisible vaut null. Une zone sans aucune cote se rend quand même, avec ses champs à null.
- Les pelouses et potagers se mesurent en longueur x largeur. Les haies et massifs se mesurent en mètres linéaires.
- Les mesures sont en MÈTRES, en nombre décimal à point. Un « 1200 » à côté d'une haie est probablement 12,00 m : rends 12.
- N'invente aucune zone qui ne figure pas sur le dessin.
- Si le croquis ne montre pas d'où vient l'eau, rends null.
- POSITIONS : pose un repère en mètres, origine au coin HAUT-GAUCHE du dessin, x vers la droite, y vers le BAS. Pour chaque zone, "x_m" et "y_m" sont son coin haut-gauche dans ce repère. Deux zones qui se touchent partagent leur arête : leurs coordonnées doivent le montrer.
- Si le dessin ne permet pas de situer une zone les unes par rapport aux autres, rends x_m et y_m à null plutôt qu'un placement inventé.
- "nourrice" est l'endroit du regard de vannes (souvent noté « nourrice », « regard » ou « vannes »), dans le même repère. S'il n'est PAS dessiné, rends null — ne le place jamais toi-même.`;

const CONSIGNE = "Lis ce croquis de jardin et rends l'objet JSON demandé.";

/** Les types que le calcul connaît — tout autre mot est refusé plutôt que traduit au jugé. */
const TYPES = ["gazon", "massif", "haie", "potager"] as const;

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

  /** Une abscisse : zéro est licite, le négatif et l'invraisemblable ne le sont pas. */
  const position = (v: unknown): number | null => {
    const n = nombre(v);
    if (n === null || n < 0 || n > 200) return null;
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
    const typeBrut = (chaine(o.type) ?? "").toLowerCase();
    if (!(TYPES as readonly string[]).includes(typeBrut)) {
      // **Un type inconnu ne se traduit pas au jugé.** « verger » rangé en
      // « gazon » lui poserait des turbines sur des arbres fruitiers.
      reserves.push(`une zone d'un type non reconnu a été écartée (« ${typeBrut || "sans type"} »)`);
      continue;
    }
    const type = typeBrut as ZoneLue["type"];
    const nom = chaine(o.nom);
    const lineaire = type === "haie" || type === "massif";
    const zone: ZoneLue = {
      type,
      nom,
      L: lineaire ? null : cote(o.longueur_m, 100, nom ?? type),
      l: lineaire ? null : cote(o.largeur_m, 100, nom ?? type),
      ml: lineaire ? cote(o.metres_lineaires, 200, nom ?? type) : null,
      // **Une position peut valoir zéro**, contrairement à une cote : la zone
      // du coin haut-gauche est en (0 ; 0). `cote()` refuserait ce zéro comme
      // une mesure nulle — d'où une lecture séparée, qui n'accepte pas non plus
      // le négatif (l'origine est un coin, rien n'est à sa gauche).
      x: position(o.x_m),
      y: position(o.y_m),
    };
    // Une zone dont aucune cote n'a été lue reste dans la liste — le patron sait
    // qu'elle existe et la complète. La faire disparaître lui ferait croire que
    // le croquis ne la montrait pas.
    if (lineaire ? zone.ml === null : zone.L === null || zone.l === null) {
      reserves.push(`les cotes de « ${nom ?? type} » n’ont pas pu être lues`);
    }
    zones.push(zone);
  }

  if (zones.length === 0) {
    return { ok: false, raison: "Aucune partie de jardin n'a été reconnue sur ce croquis." };
  }

  const eauBrute = (chaine(brut.point_d_eau) ?? "").toLowerCase();
  const pointDEau =
    eauBrute === "compteur" || eauBrute === "robinet" || eauBrute === "puits" ? eauBrute : null;
  if (pointDEau === null) reserves.push("le croquis ne dit pas d’où vient l’eau");

  // **La nourrice n'est retenue que si les DEUX coordonnées sont lues.** Une
  // seule des deux placerait le regard sur une ligne au lieu d'un point, et le
  // tracé partirait d'un endroit que personne n'a dessiné.
  const nourriceBrute = brut.nourrice as Record<string, unknown> | null | undefined;
  const nx = nourriceBrute ? position(nourriceBrute.x_m) : null;
  const ny = nourriceBrute ? position(nourriceBrute.y_m) : null;
  const nourrice = nx !== null && ny !== null ? { x: nx, y: ny } : null;
  if (nourrice === null) {
    reserves.push("le croquis ne montre pas l’endroit définitif de la nourrice");
  }
  if (zones.some((z) => z.x === null || z.y === null)) {
    reserves.push("le croquis ne situe pas toutes les zones les unes par rapport aux autres");
  }

  return { ok: true, croquis: { zones, pointDEau, nourrice, reserves } };
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
