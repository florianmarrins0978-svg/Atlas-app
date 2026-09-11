import { CATALOGUE } from "./catalogue.js";
import type { Dessin } from "./plan-dessine";

/**
 * LA LISTE DES PIÈCES, TELLE QU'IL L'EMPORTE AU COMPTOIR — sa lecture du
 * 11 septembre 2026, et trois règles du 21 août qu'aucune liste ne tenait.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **1. Ce que le réseau ANNONCE est ce que le plan DESSINE** (`CLAUDE.md`
 * §4 bis). Le calcul (`listeMateriel`, dans `calcul.js`) compte les tés, les
 * coudes et les tés égaux sur un modèle de rangées parallèles — celui de la
 * page publiée, qui ne trace rien. Le plan de l'application, lui, suit un vrai
 * tracé (`trace.ts`), et les deux divergeaient : 8 tés + 4 coudes + 2 tés
 * égaux dans la liste, 7 + 5 + 0 sur le dessin de ses deux pelouses. C'est le
 * défaut qu'il avait relevé le 21 août — *« il y a quatre arroseurs qui ne
 * sont pas alimentés »* — revenu par une autre porte. Quand le plan est
 * dessiné, ces trois lignes se LISENT sur lui, réseau par réseau.
 *
 * **2. Trois zones, jamais mélangées** : du compteur à la nourrice, dans le
 * regard, au jardin. La liste plate les confondait, et il manquait la première
 * en entier — ni le tuyau d'amenée, ni le té égal 25×25×25 qui coupe la ligne
 * au compteur (*« on va devoir la couper et mettre un té égal à cet
 * endroit-là »*). Le tuyau Ø25 des réseaux manquait aussi : la page publiée
 * l'ajoutait depuis une case saisie, l'application n'a pas cette case.
 *
 * **3. Chaque quantité se recompose à la main.** *« Je ne comprends pas d'où
 * sortent tes vingt-deux coudes SBE. »* Une pièce qui sert à deux endroits
 * s'écrit en deux lignes, chacune nommant sa position ; un compte qui vient
 * de plusieurs réseaux dit ce que chacun apporte.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **Pourquoi ici et pas dans `calcul.js`.** Le calcul est une copie octet pour
 * octet de la page publiée, et cette page n'a pas de tracé : y lire les
 * pièces sur le dessin est impossible. Cette fonction est la frontière — elle
 * prend ce que le calcul rend et ce que le tracé dessine, et n'invente rien
 * entre les deux. Le jour où la page publiée disparaît (`TODO.md`), le
 * comptage par rangées de `listeMateriel` part avec elle.
 */

/** Une ligne telle que le calcul la rend. */
export type LigneCalcul = { ref?: string; reference?: string | null; nom: string; q: number; u: string };

export type Zone = "amenee" | "regard" | "jardin";

export type Piece = {
  ref?: string;
  reference?: string | null;
  nom: string;
  /** `null` : « à mesurer » — une longueur que le croquis ne donne pas. */
  q: number | null;
  u: string;
  ou: Zone;
  /** D'où sort le chiffre — sa position, ou ce que chaque réseau apporte. */
  detail?: string;
};

export const TITRES_DES_ZONES: Record<Zone, string> = {
  amenee: "Du compteur à la nourrice",
  regard: "Dans le regard",
  jardin: "Au jardin",
};

/**
 * Le catalogue est du JavaScript repris tel quel : `piece()` lui est accroché
 * après coup, et TypeScript ne le voit pas. On nomme ici la forme dont cette
 * fonction a besoin, rien de plus.
 */
type Catalogue = {
  piece(ref: string): { nom: string; marque?: string } | null;
  piecesReseau: Record<string, { nom: string; marque?: string }>;
  coudes: { ref: string; nom: string; detail: string; filetage: string }[];
};
const CAT = CATALOGUE as unknown as Catalogue;

const TE_LIGNE = "te-taraude-25-34-25";
const COUDE_LIGNE = "coude-taraude-25-34";
const TE_EGAL = "te-25-25-25";
const PEBD16 = "pebd16";

/** Ce que le calcul pose au regard : sa fiche de nourrice, ou les lignes génériques. */
function auRegard(l: LigneCalcul): boolean {
  if (!l.ref) return true; // « Programmateur N voies », sans référence
  if (CAT.piece(l.ref)) return true;
  return ["electrovanne", "regard", "reducteur", "sonde-pluie"].includes(l.ref);
}

function nomDe(ref: string): string {
  const p = CAT.piecesReseau[ref];
  return p ? (p.marque ? `${p.marque} ${p.nom}` : p.nom) : ref;
}

export function piecesDuPlan(
  materiel: LigneCalcul[],
  dessin: Dessin | null,
  options: { compteur: boolean; seuil25: number }
): Piece[] {
  const parReseau = (f: (r: Dessin["reseaux"][number]) => number) =>
    dessin ? `par réseau : ${dessin.reseaux.map((r) => f(r)).join(" · ")}` : undefined;

  // ── Du compteur à la nourrice ─────────────────────────────────────────────
  //
  // **La longueur ne se devine pas** : l'application ne la demande pas et le
  // croquis ne la donne pas encore. Elle s'écrit « à mesurer », avec le seuil
  // qui dit jusqu'où le Ø25 tient — c'est ce chiffre qui se compare au mètre.
  const amenee: Piece[] = [
    {
      ref: "pe25-amenee",
      nom: "PEHD Ø25",
      q: null,
      u: "ml",
      ou: "amenee",
      detail:
        options.seuil25 > 0
          ? `Ø25 jusqu’à ${Math.floor(options.seuil25)} m, Ø32 au-delà`
          : "Ø32 d’office : le débit passe trop vite en Ø25",
    },
  ];
  if (options.compteur) {
    amenee.push({
      ref: TE_EGAL,
      nom: nomDe(TE_EGAL),
      q: 1,
      u: "u",
      ou: "amenee",
      detail: "coupe la ligne au compteur",
    });
  }

  // ── Dans le regard ────────────────────────────────────────────────────────
  const regard: Piece[] = materiel
    .filter(auRegard)
    .map((l) => ({
      ...l,
      ou: "regard" as const,
      detail: l.ref === "connexion" ? "2 par électrovanne" : undefined,
    }));

  // ── Au jardin ─────────────────────────────────────────────────────────────
  const jardin: Piece[] = [];
  const sbe = new Set(CAT.coudes.map((c) => c.ref));
  const surLeTrace = new Set([TE_LIGNE, COUDE_LIGNE, TE_EGAL]);
  for (const l of materiel) {
    if (auRegard(l)) continue;
    if (dessin && surLeTrace.has(l.ref ?? "")) continue; // lus sur le dessin, plus bas
    if (sbe.has(l.ref ?? "") && dessin) continue; // écrits par position, plus bas
    jardin.push({
      ...l,
      ou: "jardin",
      detail:
        l.ref === PEBD16
          ? "2 m par arroseur"
          : !dessin && surLeTrace.has(l.ref ?? "")
            ? "compté sans le tracé — à vérifier sur le plan"
            : undefined,
    });
  }

  if (dessin) {
    // **Les SBE, par position** — deux emplois, deux lignes. Celui du bas est
    // toujours en 3/4" (c'est le té de ligne qui l'impose) ; celui du haut suit
    // le corps : 3/4" pour une turbine, 1/2" pour une tuyère.
    const tetes = dessin.reseaux.flatMap((r) => r.tetes);
    const turbines = tetes.filter((t) => t.forme === "rond").length;
    const tuyeres = tetes.filter((t) => t.forme === "carre").length;
    // La référence RELEVÉE vient de la ligne du calcul, jamais de la clé.
    const coudeDe = (filetage: string) => {
      const c = CAT.coudes.find((x) => x.filetage === filetage);
      if (!c) return undefined;
      const ligne = materiel.find((l) => l.ref === c.ref);
      return { ...c, reference: ligne?.reference ?? null };
    };
    const bas = coudeDe("3/4");
    const haut12 = coudeDe("1/2");
    if (bas && tetes.length > 0) {
      jardin.push({ ref: bas.ref, reference: bas.reference, nom: `${bas.nom} — ${bas.detail}`, q: tetes.length, u: "u", ou: "jardin", detail: "en bas de chaque arroseur, sur la ligne" });
      if (turbines > 0) {
        jardin.push({ ref: bas.ref, reference: bas.reference, nom: `${bas.nom} — ${bas.detail}`, q: turbines, u: "u", ou: "jardin", detail: `en haut des ${turbines} turbines` });
      }
    }
    if (haut12 && tuyeres > 0) {
      jardin.push({ ref: haut12.ref, reference: haut12.reference, nom: `${haut12.nom} — ${haut12.detail}`, q: tuyeres, u: "u", ou: "jardin", detail: `en haut des ${tuyeres} tuyères` });
    }

    // **Les raccords de ligne, lus sur le tracé** — réseau par réseau.
    const somme = (f: (r: Dessin["reseaux"][number]) => number) => dessin.reseaux.reduce((t, r) => t + f(r), 0);
    const tes = somme((r) => r.tes);
    const coudes = somme((r) => r.coudes);
    const egaux = somme((r) => r.tesEgaux);
    if (tes > 0) jardin.push({ ref: TE_LIGNE, nom: nomDe(TE_LIGNE), q: tes, u: "u", ou: "jardin", detail: parReseau((r) => r.tes) });
    if (coudes > 0) jardin.push({ ref: COUDE_LIGNE, nom: nomDe(COUDE_LIGNE), q: coudes, u: "u", ou: "jardin", detail: parReseau((r) => r.coudes) });
    if (egaux > 0) jardin.push({ ref: TE_EGAL, nom: nomDe(TE_EGAL), q: egaux, u: "u", ou: "jardin", detail: parReseau((r) => r.tesEgaux) });

    // **Le tuyau Ø25 des réseaux, mesuré sur le tracé.** Arrondi au mètre
    // supérieur : un tuyau se coupe, il ne s'allonge pas.
    const ml = somme((r) => r.metresTuyau);
    if (ml > 0) jardin.push({ ref: "pe25", nom: "PEHD Ø25", q: Math.ceil(ml), u: "ml", ou: "jardin", detail: parReseau((r) => r.metresTuyau) });
  } else {
    jardin.push({ ref: "pe25", nom: "PEHD Ø25", q: null, u: "ml", ou: "jardin", detail: "le plan n’est pas dessiné : à mesurer sur place" });
  }

  return [...amenee, ...regard, ...jardin];
}
