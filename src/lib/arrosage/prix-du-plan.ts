import Decimal from "decimal.js";
import { normaliserPourRecherche } from "../recherche-client";

/**
 * LES PRIX DES FOURNISSEURS SUR LE PLAN — sa planche du 18 octobre 2026
 * (`appli/arrosage-prix-fournisseurs.html`, validée) : *« il me met à chaque
 * fois les prix à côté des pièces. Le jour où je fais mon plan, il me fait un
 * montant total, à titre indicatif parce que les prix peuvent changer »*.
 *
 * **Ce sont des PRIX D'ACHAT**, ceux de Réglages, Fournisseurs et partenaires,
 * sans marge : le total dit ce que le matériel lui coûtera, pas ce qu'il le
 * vendra.
 *
 * **Une pièce prend un prix par sa RÉFÉRENCE**, imprimée sur le devis du
 * fournisseur ; à défaut, par un nom identique au caractère près (accents et
 * majuscules mis à part). Jamais par un nom voisin : deux raccords qui se
 * ressemblent n'ont pas le même prix, et un réseau enterré se chiffre juste ou
 * pas du tout (`.claude/rules/arrosage.md`).
 */

export type PrixAchatDuFournisseur = {
  societeId: string;
  societeNom: string;
  reference: string | null;
  nom: string;
  prixHt: string;
  /** AAAA-MM-JJ. */
  releveLe: string;
};

export type PieceDuPlan = { ref: string; nom: string; q: number; u: string; reference: string | null };

export type FournisseurDuPlan = {
  id: string;
  nom: string;
  /** Le prix unitaire de chaque pièce du plan qu'il vend, par clé du catalogue. */
  prix: Record<string, { prixHt: string; releveLe: string }>;
};

const refPropre = (r: string | null | undefined) => (r ?? "").toUpperCase().replace(/[\s.\-_/]/g, "");

/** Les prix de chaque fournisseur pour les pièces de CE plan. Le plus récent relevé l'emporte. */
export function prixDesFournisseurs(
  pieces: readonly PieceDuPlan[],
  achats: readonly PrixAchatDuFournisseur[],
  fournisseurs: readonly { id: string; nom: string }[]
): FournisseurDuPlan[] {
  return fournisseurs.map((f) => {
    const siens = achats.filter((a) => a.societeId === f.id);
    const prix: FournisseurDuPlan["prix"] = {};
    for (const p of pieces) {
      const parRef = refPropre(p.reference);
      const nom = normaliserPourRecherche(p.nom);
      const trouves = siens.filter((a) =>
        parRef && refPropre(a.reference) ? refPropre(a.reference) === parRef : normaliserPourRecherche(a.nom) === nom
      );
      const recent = trouves.reduce<PrixAchatDuFournisseur | null>((m, a) => (m === null || a.releveLe > m.releveLe ? a : m), null);
      if (recent) prix[p.ref] = { prixHt: recent.prixHt, releveLe: recent.releveLe };
    }
    return { id: f.id, nom: f.nom, prix };
  });
}

/** « moins » : le moins cher des fournisseurs, pièce par pièce ; sinon l'identifiant d'un fournisseur. */
export type VueDesPrix = "moins" | string;

export type LignePrixee = PieceDuPlan & { prix: { montant: string; unitaire: string; de: string } | null };

export type TotalDuPlan = {
  lignes: LignePrixee[];
  /** `null` : aucune pièce n'a de prix. Jamais 0 €. */
  total: string | null;
  sansPrix: number;
  /** « Prix Aqua Plus du 19/10/2026. » par fournisseur dont un prix sert. */
  dates: { nom: string; le: string }[];
};

const jourFrancais = (iso: string) => iso.split("-").reverse().join("/");

export function totalDuPlan(pieces: readonly PieceDuPlan[], fournisseurs: readonly FournisseurDuPlan[], vue: VueDesPrix): TotalDuPlan {
  const servis = new Map<string, string>();
  let total = new Decimal(0);
  let sansPrix = 0;
  const lignes = pieces.map((p) => {
    const candidats = (vue === "moins" ? fournisseurs : fournisseurs.filter((f) => f.id === vue))
      .filter((f) => p.ref in f.prix)
      .map((f) => ({ f, x: f.prix[p.ref] }));
    const mieux = candidats.reduce<(typeof candidats)[number] | null>((m, c) => (m === null || new Decimal(c.x.prixHt).lt(m.x.prixHt) ? c : m), null);
    // Une longueur à mesurer n'a pas de quantité : son prix ne se compte pas.
    if (!mieux || !p.q) {
      sansPrix++;
      return { ...p, prix: null };
    }
    const montant = new Decimal(mieux.x.prixHt).times(p.q);
    total = total.plus(montant);
    const avant = servis.get(mieux.f.nom);
    if (!avant || mieux.x.releveLe > avant) servis.set(mieux.f.nom, mieux.x.releveLe);
    return { ...p, prix: { montant: montant.toFixed(2), unitaire: new Decimal(mieux.x.prixHt).toFixed(2), de: mieux.f.nom } };
  });
  return {
    lignes,
    total: sansPrix === pieces.length ? null : total.toFixed(2),
    sansPrix,
    dates: [...servis.entries()].map(([nom, le]) => ({ nom, le: jourFrancais(le) })),
  };
}

/** « Prix Aqua Plus du 19/10/2026. Ils ont pu changer. » */
export function phraseDesDates(t: TotalDuPlan): string {
  if (t.total === null) return "Aucun prix encore.";
  return `${t.dates.map((d) => `Prix ${d.nom} du ${d.le}`).join(". ")}. Ils ont pu changer.`;
}

/** « 3 pièces sans prix sur 28, le total ne les compte pas. » */
export function phraseDuManque(t: TotalDuPlan): string {
  const n = t.lignes.length;
  if (!t.sansPrix) return "";
  return `${t.sansPrix} pièce${t.sansPrix > 1 ? "s" : ""} sans prix sur ${n}, le total ne les compte pas.`;
}
