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
  piecesReseau: Record<string, { nom: string; marque?: string; metresParRouleau?: number }>;
  coudes: { ref: string; nom: string; detail: string; filetage: string }[];
  corps: { ref: string; nom: string; filetage: string }[];
  referenceDe(cle: string): string | null;
};
const CAT = CATALOGUE as unknown as Catalogue;

const TE_LIGNE = "te-taraude-25-34-25";
const COUDE_LIGNE = "coude-taraude-25-34";
const TE_EGAL = "te-25-25-25";

/**
 * Les raccords et le tuyau d'un réseau, selon son diamètre. Le Ø25 par défaut ;
 * le Ø32 quand il l'a choisi pour ce réseau (sa règle du 20 octobre 2026, « la
 * C »). Une seule table, pour la liste comme pour l'écran (`postes.ts`).
 */
export function raccordsEn(diametre: 25 | 32) {
  return diametre === 32
    ? { te: "te-taraude-32-34-32", coude: "coude-taraude-32-34", egal: "te-32-32-32", pe: "pe32", nomPe: "PEHD Ø32" }
    : { te: TE_LIGNE, coude: COUDE_LIGNE, egal: TE_EGAL, pe: "pe25", nomPe: "PEHD Ø25" };
}
const PEBD16 = "pebd16";
const GRILLAGE = "grillage-bleu";

/** Ce que le calcul pose au regard : sa fiche de nourrice, et la sonde de pluie quand il l'a cochée. */
function auRegard(l: LigneCalcul): boolean {
  if (!l.ref) return false;
  return Boolean(CAT.piece(l.ref)) || l.ref === "RP403";
}

function nomDe(ref: string): string {
  const p = CAT.piecesReseau[ref];
  return p ? (p.marque ? `${p.marque} ${p.nom}` : p.nom) : ref;
}

export function piecesDuPlan(
  materiel: LigneCalcul[],
  dessin: Dessin | null,
  options: {
    compteur: boolean;
    seuil25: number;
    amenee: number | null;
    /**
     * Les sorties du goutte-à-goutte, telles que le calcul les compte
     * (`goutteAGoutte`). Le massif n'a pas de tête sur le plan : sans elles, la
     * liste perdait le coude taraudé de chaque sortie et le té égal des
     * suivantes, que sa règle du 16 octobre 2026 exige. Obligatoire, pour
     * qu'aucun appel ne puisse l'oublier en silence.
     */
    goutte: { sorties: number; tesEgaux: number };
    /** Il a coché « Grillage avertisseur » (sa demande du 18 octobre 2026). Absent : pas coché. */
    grillage?: boolean;
    /** Le tuyau de chaque réseau, par son numéro : Ø25 quand rien n'est dit. */
    diametres?: (25 | 32)[];
    /** Le tuyau retenu pour l'amenée, choisi par lui ou proposé par l'outil. Absent : la règle du seuil. */
    diametreAmenee?: 25 | 32;
  }
): Piece[] {
  const parReseau = (f: (r: Dessin["reseaux"][number]) => number) =>
    dessin ? `par réseau : ${dessin.reseaux.map((r) => f(r)).join(", ")}` : undefined;

  // ── Du compteur à la nourrice ─────────────────────────────────────────────
  //
  // **La longueur est CALCULÉE sur le croquis** (sa règle du 11 septembre
  // 2026 : ni lue, ni supposée), du piquage à la nourrice ; arrondie au mètre
  // supérieur, un tuyau se coupe. Quand elle n'a pas pu l'être, « à mesurer » —
  // jamais un chiffre plausible. Le seuil dit jusqu'où le Ø25 tient.
  const seuil = options.seuil25 > 0 ? `Ø25 jusqu’à ${Math.floor(options.seuil25)} m, Ø32 au-delà` : "Ø32 d’office : le débit passe trop vite en Ø25";
  const amenee: Piece[] = [
    {
      ref: "pe25-amenee",
      nom: options.diametreAmenee
        ? `PEHD Ø${options.diametreAmenee}`
        : options.amenee !== null && options.seuil25 > 0 && options.amenee > options.seuil25 ? "PEHD Ø32" : "PEHD Ø25",
      q: options.amenee !== null ? Math.ceil(options.amenee) : null,
      u: "ml",
      ou: "amenee",
      detail: options.amenee !== null ? `du piquage à la nourrice, calculé sur le croquis, ${seuil}` : seuil,
    },
  ];
  if (options.compteur) {
    amenee.push({
      ref: TE_EGAL,
      reference: CAT.referenceDe(TE_EGAL),
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
  const surLeTrace = new Set([TE_LIGNE, COUDE_LIGNE, TE_EGAL, ...Object.values(raccordsEn(32))]);
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
            ? "compté sans le tracé, à vérifier sur le plan"
            : undefined,
    });
  }

  if (dessin) {
    // **Les SBE, par position** — deux emplois, deux lignes. Celui du bas est
    // toujours en 3/4" (c'est le té de ligne qui l'impose) ; celui du haut suit
    // le FILETAGE DU CORPS, lu au catalogue : la 3504 se visse en 1/2" sur un
    // SBE 050, comme les tuyères (sa décision d'octobre 2026). La règle d'avant,
    // « 3/4" pour une turbine », faisait commander 13 SBE 075 de trop et
    // manquer autant de SBE 050 sur son jardin d'exemple (18 octobre 2026).
    const tetes = dessin.reseaux.flatMap((r) => r.tetes);
    const hautParFiletage = new Map<string, { q: number; noms: string[] }>();
    for (const l of materiel) {
      const c = CAT.corps.find((x) => x.ref === l.ref);
      if (!c) continue;
      const h = hautParFiletage.get(c.filetage) ?? { q: 0, noms: [] };
      h.q += l.q;
      h.noms.push(`${l.q} ${c.nom}`);
      hautParFiletage.set(c.filetage, h);
    }
    // La référence RELEVÉE vient de la ligne du calcul, jamais de la clé.
    const coudeDe = (filetage: string) => {
      const c = CAT.coudes.find((x) => x.filetage === filetage);
      if (!c) return undefined;
      const ligne = materiel.find((l) => l.ref === c.ref);
      return { ...c, reference: ligne?.reference ?? null };
    };
    const bas = coudeDe("3/4");
    if (bas && tetes.length > 0) {
      jardin.push({ ref: bas.ref, reference: bas.reference, nom: `${bas.nom}, ${bas.detail}`, q: tetes.length, u: "u", ou: "jardin", detail: "en bas de chaque arroseur, sur la ligne" });
    }
    for (const [filetage, h] of hautParFiletage) {
      const haut = coudeDe(filetage);
      if (haut && h.q > 0) jardin.push({ ref: haut.ref, reference: haut.reference, nom: `${haut.nom}, ${haut.detail}`, q: h.q, u: "u", ou: "jardin", detail: `en haut de ${h.noms.join(", ")}` });
    }

    // **Les raccords de ligne, lus sur le tracé** — réseau par réseau, et par
    // diamètre : un réseau qu'il a passé en Ø32 prend les pièces en 32.
    const diametreDe = (r: Dessin["reseaux"][number]) => options.diametres?.[r.numero] ?? 25;
    // Les sorties du goutte-à-goutte prennent les mêmes pièces Ø25 : un coude
    // taraudé par sortie, un té égal par sortie après la première de sa vanne.
    // Le goutte-à-goutte n'a pas de perte de ligne au calcul : il reste en Ø25.
    const { sorties, tesEgaux: egauxGoutte } = options.goutte;
    const etGoutte = (n: number) => (n > 0 ? `, et ${n} pour le goutte-à-goutte` : "");
    for (const d of [25, 32] as const) {
      const ceux = dessin.reseaux.filter((r) => diametreDe(r) === d);
      if (ceux.length === 0 && d === 32) continue;
      const k = raccordsEn(d);
      const somme = (f: (r: Dessin["reseaux"][number]) => number) => ceux.reduce((t, r) => t + f(r), 0);
      const par = (f: (r: Dessin["reseaux"][number]) => number) =>
        d === 25 && ceux.length === dessin.reseaux.length ? parReseau(f) : `réseau${ceux.length > 1 ? "x" : ""} ${ceux.map((r) => r.numero + 1).join(", ")} : ${ceux.map(f).join(", ")}`;
      const g = d === 25 ? sorties : 0, eg = d === 25 ? egauxGoutte : 0;
      const tes = somme((r) => r.tes);
      const coudes = somme((r) => r.coudes) + g;
      const egaux = somme((r) => r.tesEgaux) + eg;
      const sansReseau = ceux.length === 0;
      if (tes > 0) jardin.push({ ref: k.te, reference: CAT.referenceDe(k.te), nom: nomDe(k.te), q: tes, u: "u", ou: "jardin", detail: par((r) => r.tes) });
      if (coudes > 0) jardin.push({ ref: k.coude, reference: CAT.referenceDe(k.coude), nom: nomDe(k.coude), q: coudes, u: "u", ou: "jardin", detail: sansReseau ? `${g} pour le goutte-à-goutte` : `${par((r) => r.coudes)}${etGoutte(g)}` });
      if (egaux > 0) jardin.push({ ref: k.egal, reference: CAT.referenceDe(k.egal), nom: nomDe(k.egal), q: egaux, u: "u", ou: "jardin", detail: sansReseau ? `${eg} pour le goutte-à-goutte` : `${par((r) => r.tesEgaux)}${etGoutte(eg)}` });

      // **Le tuyau des réseaux, mesuré sur le tracé.** Arrondi au mètre
      // supérieur : un tuyau se coupe, il ne s'allonge pas.
      const ml = somme((r) => r.metresTuyau);
      if (ml > 0) jardin.push({ ref: k.pe, nom: k.nomPe, q: Math.ceil(ml), u: "ml", ou: "jardin", detail: par((r) => r.metresTuyau) });
    }

    // **Le grillage avertisseur couvre toute la tranchée, amenée comprise** —
    // sa règle du 18 octobre 2026, en rouleaux de 100 m. Une amenée non mesurée
    // ne s'invente pas : la phrase dit qu'il manque.
    if (options.grillage) {
      const g = CAT.piecesReseau[GRILLAGE];
      const parRouleau = g.metresParRouleau ?? 100;
      const metres = dessin.metresTranchee + (options.amenee ?? 0);
      const rouleaux = Math.max(1, Math.ceil(metres / parRouleau));
      // **Court** — sa correction du 18 octobre 2026 : « beaucoup trop longue ;
      // tu mets 24 m de tranchée au total, et le tuyau d'amenée n'est pas
      // mesuré ». Ce qui n'est pas mesuré se nomme, rien de plus.
      const total = options.amenee !== null
        ? `${Math.ceil(dessin.metresTranchee)} m de tranchée et ${Math.ceil(options.amenee)} m d’amenée au total.`
        : `${Math.ceil(dessin.metresTranchee)} m de tranchée au total.`;
      const pointilles = dessin.liaisons.length > 0, amenee = options.amenee === null;
      const inconnu = pointilles && amenee ? " Les pointillés et le tuyau d’amenée ne sont pas mesurés."
        : pointilles ? " Les pointillés ne sont pas mesurés."
        : amenee ? " Le tuyau d’amenée n’est pas mesuré."
        : "";
      const detail = total + inconnu;
      jardin.push({ ref: GRILLAGE, nom: g.nom, q: rouleaux, u: "u", ou: "jardin", detail });
    }
  } else {
    jardin.push({ ref: "pe25", nom: "PEHD Ø25", q: null, u: "ml", ou: "jardin", detail: "le plan n’est pas dessiné : à mesurer sur place" });
  }

  return [...amenee, ...regard, ...jardin];
}
