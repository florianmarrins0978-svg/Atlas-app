/**
 * L'organigramme de l'entreprise : qui est où, et sous qui.
 *
 * *Sa demande du 27 septembre 2026, planche
 * `appli/rappels-par-role-et-organigramme.html`, et ses réponses :* un gars n'a
 * qu'UN chef ; le chef ne voit rien de plus (c'est un titre) ; l'organigramme
 * est visible par TOUT LE MONDE, modifiable par le patron seul.
 *
 * **Il ne crée aucune liste : il LIT les deux qui existent.** Les comptes
 * (`membres_entreprise`, leur rôle) donnent le patron et le bureau ; les gars
 * (`equipes`, qui porte les salariés depuis la migration 0067) donnent le
 * terrain. Une troisième liste tenue ici divergerait des deux autres au premier
 * ajout.
 *
 * **Le terrain se désigne par le RANG**, comme partout où l'on nomme un gars
 * (`nommerEquipe`) : un gars jamais nommé n'a pas encore de ligne en base, et il
 * doit pourtant pouvoir être nommé chef ou rangé sous un chef.
 */
import type { Role } from "./acces-roles";
import { libelleSalarie, salariesAffiches } from "./equipes";

/** Un compte de l'entreprise, tel que l'organigramme le montre : ni adresse, ni accès. */
export type CompteOrganigramme = {
  membreId: string;
  utilisateurId: string;
  nom: string | null;
  role: Role;
  /** Sa tête, par `photoDUnCompte` : la même que dans « Qui a accès ». */
  photo: string | null;
};

/**
 * La photo d'un compte : celle de SON NOM de salarié quand le patron l'y a
 * relié, la sienne sinon. Une seule vérité par personne (migration 0111) ;
 * écrite ici une fois, pour « Qui a accès » comme pour l'organigramme.
 */
export function photoDUnCompte(c: { relie: boolean; photoDuNom: string | null; photoDuCompte: string | null }): string | null {
  return c.relie ? c.photoDuNom : c.photoDuCompte;
}

/** Une ligne de salarié, telle que la base la porte. */
export type SalarieOrganigramme = {
  id: string;
  rang: number;
  nom: string | null;
  estChef: boolean;
  chefId: string | null;
  photoStorageKey: string | null;
};

export type GarsAffiche = { rang: number; libelle: string; photo: string | null };
export type ChefAffiche = GarsAffiche & { gars: GarsAffiche[] };

export type Organigramme = {
  patrons: CompteOrganigramme[];
  bureau: CompteOrganigramme[];
  chefs: ChefAffiche[];
  sansChef: GarsAffiche[];
};

/**
 * Range tout le monde.
 *
 * **Un gars dont le chef ne tient plus (titre retiré, chef sorti du compteur)
 * tombe dans « Sans chef »**, il ne disparaît pas : un organigramme qui perd
 * quelqu'un en silence est pire qu'un organigramme en désordre.
 *
 * **Un chef n'a pas de chef** : le terrain n'a qu'un étage sous le bureau. Un
 * `chefId` resté sur une ligne devenue chef est ignoré ici.
 */
export function construireOrganigramme(
  comptes: readonly CompteOrganigramme[],
  salaries: readonly SalarieOrganigramme[],
  nombreSalaries: number
): Organigramme {
  const actifs = salariesAffiches(salaries, nombreSalaries);
  const ligne = (s: SalarieOrganigramme | { rang: number; nom?: string | null }) =>
    "id" in s ? s : null;
  const affiche = (s: SalarieOrganigramme | { rang: number; nom?: string | null }): GarsAffiche => ({
    rang: s.rang,
    libelle: libelleSalarie(s, nombreSalaries) ?? `Salarié ${s.rang}`,
    photo: "photoStorageKey" in s ? s.photoStorageKey : null,
  });

  const chefsLignes = actifs.map(ligne).filter((l): l is SalarieOrganigramme => l !== null && l.estChef);
  const idsChefs = new Set(chefsLignes.map((c) => c.id));

  const chefs: ChefAffiche[] = chefsLignes.map((c) => ({
    ...affiche(c),
    gars: actifs
      .filter((s) => {
        const l = ligne(s);
        return l !== null && !l.estChef && l.chefId === c.id;
      })
      .map(affiche),
  }));

  const sansChef = actifs
    .filter((s) => {
      const l = ligne(s);
      if (l === null) return true;
      return !l.estChef && (l.chefId === null || !idsChefs.has(l.chefId));
    })
    .map(affiche);

  return {
    patrons: comptes.filter((c) => c.role === "proprietaire"),
    bureau: comptes.filter((c) => c.role === "commercial" || c.role === "facturation"),
    chefs,
    sansChef,
  };
}

/**
 * Peut-on ranger ce gars sous ce chef ? La même règle sert à l'écran (ce qui se
 * coche) et au serveur (ce qui s'écrit) : deux versions divergeraient.
 *
 * Refusé : un rang hors du compteur, soi-même, un chef qui n'a pas le titre, un
 * gars qui l'a (un chef n'a pas de chef).
 */
export function peutEtreSousCeChef(
  garsRang: number,
  chefRang: number,
  salaries: readonly SalarieOrganigramme[],
  nombreSalaries: number
): boolean {
  const dansLeCompteur = (r: number) => Number.isInteger(r) && r >= 1 && r <= nombreSalaries;
  if (!dansLeCompteur(garsRang) || !dansLeCompteur(chefRang) || garsRang === chefRang) return false;
  const chef = salaries.find((s) => s.rang === chefRang);
  const gars = salaries.find((s) => s.rang === garsRang);
  return chef?.estChef === true && gars?.estChef !== true;
}
