import type { Ctx } from "../repositories/context";
import { listerTarifs } from "../repositories/tarifs";
import { lireMarges, prixAchatCandidats } from "../repositories/fournisseurs-partenaires";
import { prixDeLaLigne } from "./proposition-prix";
import { lignesVendables } from "../../lib/lignes-vendables";
import { prixDUneLigneDictee } from "../../lib/prix-achat";
import type { RetoucheResolue } from "../../lib/retouches-devis";

/**
 * **Une ligne dictée DANS le devis va chercher ses prix à lui** : son
 * signalement du 21 octobre 2026. Depuis le micro du devis, « on évacue le
 * gros bois, il y a 15 tonnes », et la ligne arrivait « Aucun prix dicté, à
 * vous de la chiffrer » alors que « Évacuation » est dans ses tarifs.
 *
 * Ce chemin ne lisait que le prix PRONONCÉ. Il suit désormais le même ordre
 * que la dictée du chantier : le prix qu'il a dit, puis sa grille, puis ses
 * tarifs, puis ses prix d'achat × sa marge, puis « à chiffrer ». Les règles
 * sont celles de `proposition-prix.ts` et de `prix-achat.ts`, appelées ici et
 * jamais recopiées.
 */
export async function chiffrerLesAjouts(
  ctx: Ctx,
  chantierId: string,
  retouches: RetoucheResolue[]
): Promise<RetoucheResolue[]> {
  if (!retouches.some((r) => r.retouche.type === "ajouter" && r.retouche.prixUnitaire === null)) return retouches;

  const [tarifs, achats, marges] = await Promise.all([listerTarifs(ctx), prixAchatCandidats(ctx), lireMarges(ctx)]);
  const deVente = tarifs.map((t) => ({ tarifId: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite }));

  return Promise.all(
    retouches.map(async (r): Promise<RetoucheResolue> => {
      const t = r.retouche;
      if (t.type !== "ajouter" || t.prixUnitaire !== null) return r;

      // Sa grille d'abord : elle connaît le travail et ses mesures.
      const [ligne] = lignesVendables([{ libelle: t.libelle, quantite: t.quantite, unite: t.unite }]).lignes;
      if (ligne) {
        const c = await prixDeLaLigne(ctx, chantierId, [t.libelle], ligne);
        if (c.prix !== null) {
          const auTaux = c.quantite !== undefined && c.prixUnitaire !== undefined;
          return {
            ...r,
            retouche: {
              ...t,
              ...(auTaux
                ? { quantite: c.quantite!, unite: c.unite ?? null, prixUnitaire: c.prixUnitaire! }
                : { ...unSeulPrix(t), prixUnitaire: c.prix }),
              source: sourceDe(c.calcul),
            },
          };
        }
      }

      // Ses tarifs de vente, puis ses prix d'achat × sa marge.
      const q = t.quantite !== null ? Number(t.quantite) : 1;
      const p = prixDUneLigneDictee(t.libelle, Number.isFinite(q) && q > 0 ? q : 1, { tarifs: deVente, achats, marges }, t.unite);
      if (p.montant === null) return r;
      const parSaQuantite = t.quantite !== null && Number(p.quantite) === Number(t.quantite);
      return {
        ...r,
        retouche: {
          ...t,
          ...(parSaQuantite ? {} : unSeulPrix(t)),
          quantite: p.quantite,
          unite: p.unite,
          prixUnitaire: p.prixUnitaire,
          source: p.origine === "vente" ? sourceDe([{ libelle: "Tarif appliqué", detail: p.detail }]) : "vos prix d'achat",
        },
      };
    })
  );
}

/**
 * D'où vient le prix de la ligne, dit en quelques mots sous elle : son tarif
 * nommé (« votre tarif « Évacuation » »), sinon sa grille.
 */
function sourceDe(calcul: readonly { libelle: string; detail: string }[]): string {
  const tarif = calcul.find((c) => c.libelle === "Tarif appliqué")?.detail.match(/« (.+?) »/)?.[1];
  return tarif ? `votre tarif « ${tarif} »` : "votre grille de prix";
}

/**
 * Un prix qui vaut pour tout le travail, et pas pour chacune de ses unités.
 *
 * **La mesure qu'il a dite ne disparaît pas pour autant** : « 15 tonnes »
 * passe dans le libellé, parce que la ligne compte désormais un seul prix et
 * que ce chiffre, c'est lui qui l'a relevé sur le chantier.
 */
function unSeulPrix(t: { libelle: string; quantite: string | null; unite: string | null }) {
  const pluriel = (u: string) => (Number(t.quantite) > 1 && /^[a-zà-ÿ]+$/i.test(u) && !/s$/.test(u) ? `${u}s` : u);
  const mesure = t.quantite !== null && t.unite ? `${t.quantite} ${pluriel(t.unite)}` : null;
  return {
    libelle: mesure && !t.libelle.includes(mesure) ? `${t.libelle}, ${mesure}` : t.libelle,
    quantite: "1",
    unite: null,
  };
}
