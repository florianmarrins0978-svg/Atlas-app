/**
 * Quels tarifs de l'entreprise répondent à ces libellés ?
 *
 * Par correspondance d'intitulé, dans les deux sens (le tarif « Élagage »
 * couvre « élagage du sapin », et inversement), jamais au-delà de l'inclusion
 * littérale : un prix rapproché « à peu près » serait un prix inventé.
 *
 * **Une seule règle pour le calcul du prix ET l'outil de l'assistant — 29
 * septembre 2026.** Elle vivait en deux copies, l'une dans le calcul, l'autre
 * dans l'outil, avec un commentaire promettant « même règle ». L'outil avait
 * oublié le tarif sans intitulé, que « + Ajouter un tarif » écrit dès l'appui :
 * une chaîne vide est contenue dans toutes, et ce tarif à 0 € était proposé
 * pour n'importe quel travail.
 */
export type TarifCandidat = {
  tarifId: string;
  intitule: string;
  prix: string;
  unite: string | null;
};

export function tarifsCorrespondants(
  tarifs: readonly { id: string; intitule: string; prix: string; unite: string | null }[],
  libelles: readonly string[]
): TarifCandidat[] {
  const trouves = new Map<string, TarifCandidat>();
  for (const libelle of libelles) {
    const l = libelle.trim().toLowerCase();
    if (!l) continue;
    for (const t of tarifs) {
      const i = t.intitule.trim().toLowerCase();
      if (!i) continue;
      if (l.includes(i) || i.includes(l)) {
        trouves.set(t.id, { tarifId: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite });
      }
    }
  }
  return [...trouves.values()];
}
