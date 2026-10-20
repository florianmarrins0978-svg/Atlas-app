import { normaliserPourRecherche } from "../recherche-client";
import type { TableDePrix } from "./prix-de-la-liste";

/**
 * LES PRIX DES FOURNISSEURS SUR LE PLAN — sa planche du 18 octobre 2026
 * (`appli/arrosage-prix-fournisseurs.html`, validée) : *« il me met à chaque
 * fois les prix à côté des pièces. Le jour où je fais mon plan, il me fait un
 * montant total, à titre indicatif parce que les prix peuvent changer »*, puis
 * le 19 au soir : *« à droite, il y ait le prix, et en dessous un total »*.
 * La colonne et le total sont ceux de la liste (`prix-de-la-liste.ts`) ; ici
 * se décide seulement quel prix va à quelle pièce.
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
  /** « m » : un prix au mètre, qui ne vaut que pour une longueur. */
  unite: string;
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
      // Un prix au mètre ne vaut que pour une longueur, et un prix à la pièce
      // jamais pour des mètres : une couronne n'est pas un mètre de tube.
      const trouves = siens.filter(
        (a) =>
          (a.unite === "m") === (p.u === "ml") &&
          (parRef && refPropre(a.reference) ? refPropre(a.reference) === parRef : normaliserPourRecherche(a.nom) === nom)
      );
      const recent = trouves.reduce<PrixAchatDuFournisseur | null>((m, a) => (m === null || a.releveLe > m.releveLe ? a : m), null);
      if (recent) prix[p.ref] = { prixHt: recent.prixHt, releveLe: recent.releveLe };
    }
    return { id: f.id, nom: f.nom, prix };
  });
}

/**
 * La table que la liste du plan lit (`prix-de-la-liste.ts`, sa colonne et son
 * total) : pour chaque pièce, **le moins cher de ses fournisseurs**. Une pièce
 * qu'aucun ne vend n'y est pas, et la liste dit « sans prix ».
 */
export function lesMoinsChers(fournisseurs: readonly FournisseurDuPlan[]): TableDePrix {
  const table: TableDePrix = {};
  for (const f of fournisseurs) {
    for (const [ref, x] of Object.entries(f.prix)) {
      const p = Number(x.prixHt);
      if (Number.isFinite(p) && (table[ref] === undefined || p < table[ref])) table[ref] = p;
    }
  }
  return table;
}
