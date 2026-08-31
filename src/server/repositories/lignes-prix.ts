import { asc, eq } from "drizzle-orm";
import Decimal from "decimal.js";
import { withEntreprise } from "../db/with-entreprise";
import type { DbOrTx } from "../db/client";
import { and, asc as _asc } from "drizzle-orm";
import { lignesPrix, lignesPrixPrestations, prestations } from "../db/schema";
import type { Ctx } from "./context";
import { membresDuLibelle } from "../../lib/lignes-vendables";

export async function listerLignesPrix(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(lignesPrix).where(eq(lignesPrix.chantierId, chantierId)).orderBy(asc(lignesPrix.ordre))
  );
}

/**
 * Écrit une ligne au détail du chantier.
 *
 * **`quantite: "1"` en dur était le défaut du 26 août 2026.** Le patron dictait
 * « huit cents mètres de haie », le modèle rendait `800` / `ml`, et cette
 * fonction écrivait `1` — le client lisait alors « 1 × 14 000 € » là où
 * l'artisan avait dit « 800 mètres à 17,50 ». Ce n'était pas un forfait décidé,
 * c'était une colonne que ce chemin ne renseignait jamais. La règle qui décide
 * de la quantité commerciale vit désormais dans `src/lib/quantite-commerciale.ts`.
 *
 * **`aChiffrer` (migration 0070) :** le travail est identifié, son prix ne
 * l'est pas. Le montant reste à `0` en base — la facturation n'accepte pas de
 * NULL — mais le drapeau dit que ce zéro n'est pas un prix, et le devis ne peut
 * pas partir tant qu'il est levé.
 */
export async function ajouterLignePrix(
  ctx: Ctx,
  chantierId: string,
  libelle: string,
  montant: string,
  options?: { quantite?: string; prixUnitaire?: string; unite?: string | null; aChiffrer?: boolean }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const existantes = await tx.select().from(lignesPrix).where(eq(lignesPrix.chantierId, chantierId));
    const [row] = await tx
      .insert(lignesPrix)
      .values({
        entrepriseId: ctx.entrepriseId,
        chantierId,
        libelle,
        montant,
        quantite: options?.quantite ?? "1",
        prixUnitaire: options?.prixUnitaire ?? montant,
        unite: options?.unite ?? undefined,
        aChiffrer: options?.aChiffrer ?? false,
        ordre: existantes.length,
      })
      .returning();
    return row;
  });
}

export async function modifierLignePrix(
  ctx: Ctx,
  id: string,
  data: {
    libelle?: string;
    montant?: string;
    quantite?: string;
    prixUnitaire?: string;
    unite?: string;
    aChiffrer?: boolean;
  }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // **Les deux sens de l'invariant `montant = quantité × prix unitaire`.**
    //
    // De bas en haut : un montant modifié seul (écran Prix, où c'est le seul
    // champ) donne quantité 1 et prix unitaire égal au montant.
    //
    // De haut en bas : une quantité ou un prix unitaire modifié (le devis
    // écrit à la main) recalcule le montant. **Ce sens manquait** — trois
    // tilleuls à 250 € donnaient un montant resté à 0,00 €, donc un devis à
    // zéro alors que l'écran affichait 750 €. Une ligne dont le total ne
    // correspond pas à son détail ne se rattrape que par un avoir.
    const patch: typeof data = { ...data };
    if (data.montant !== undefined && data.prixUnitaire === undefined && data.quantite === undefined) {
      patch.prixUnitaire = data.montant;
      patch.quantite = "1";
    } else if (data.montant === undefined && (data.prixUnitaire !== undefined || data.quantite !== undefined)) {
      const [avant] = await tx.select().from(lignesPrix).where(eq(lignesPrix.id, id)).limit(1);
      if (avant) {
        const q = new Decimal(patch.quantite ?? avant.quantite);
        const pu = new Decimal(patch.prixUnitaire ?? avant.prixUnitaire);
        patch.montant = q.times(pu).toFixed(2);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // **POSER UN PRIX, C'EST RÉPONDRE À « À CHIFFRER » — QUEL QUE SOIT LE
    // CHAMP PAR LEQUEL ON L'A POSÉ.**
    //
    // **Le défaut du 31 août 2026, dans ses mots :** *« je suis revenu en
    // arrière, j'ai mis les prix pour chaque ligne, mais il ne veut quand même
    // pas que j'envoie mon devis »*. Et il avait raison de ne rien comprendre :
    // l'écran affichait 2 280,00 € de total, plus aucune ligne marquée « à
    // chiffrer », et l'envoi nommait pourtant deux lignes qu'il venait de
    // chiffrer.
    //
    // Cette extinction lisait `data.montant` — l'ENTRÉE. Or il y a deux
    // chemins d'écriture, et un seul envoie un montant :
    //
    // | Écran | Ce qu'il poste | Le drapeau |
    // |---|---|---|
    // | Prix | `{ montant }` | s'éteignait |
    // | Devis complet | `{ libelle, quantite, prixUnitaire }` | **restait levé** |
    //
    // Sur le second, le montant est CALCULÉ quinze lignes plus haut
    // (quantité × prix unitaire) : le total du devis devenait juste, l'étiquette
    // « à chiffrer » disparaissait de l'écran — elle ne s'affiche qu'à montant
    // nul —, et rien ne trahissait le drapeau resté en base. La photographie du
    // devis le recopiait à la régénération suivante (`devis.ts`), et l'envoi
    // refusait en le renvoyant vers un écran Prix où tout paraissait normal.
    // **Une boucle sans sortie : aucun geste ne pouvait la rouvrir.**
    //
    // On lit donc `patch.montant` — le RÉSULTAT, après calcul —, seul chiffre
    // qui vaille pour la question « cette ligne est-elle chiffrée ».
    //
    // **Et l'extinction reste à sens unique.** Un montant qui retombe à zéro ne
    // relève pas le drapeau : `aChiffrer` dit « le prix n'a pas été trouvé »,
    // pas « la ligne vaut zéro ». Le rallumer ferait d'une remise gratuite
    // délibérée un devis impossible à envoyer.
    // ═══════════════════════════════════════════════════════════════════════
    if (data.aChiffrer === undefined && patch.montant !== undefined && Number(patch.montant) > 0) {
      patch.aChiffrer = false;
    }
    const [row] = await tx
      .update(lignesPrix)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(lignesPrix.id, id))
      .returning();
    return row;
  });
}

export async function supprimerLignePrix(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.delete(lignesPrix).where(eq(lignesPrix.id, id));
  });
}

export async function reordonnerLignesPrix(ctx: Ctx, chantierId: string, idsEnOrdre: string[]) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    for (let i = 0; i < idsEnOrdre.length; i++) {
      await tx
        .update(lignesPrix)
        .set({ ordre: i, updatedAt: new Date() })
        .where(eq(lignesPrix.id, idsEnOrdre[i]));
    }
  });
}

// Total exact en Decimal — jamais de somme via `number`/parseFloat. Retourne une
// chaîne décimale à 2 décimales ; la conversion en nombre n'intervient qu'au tout
// dernier moment, côté affichage (Intl.NumberFormat), jamais pendant le calcul.
export async function totalLignesPrix(ctx: Ctx, chantierId: string): Promise<string> {
  const lignes = await listerLignesPrix(ctx, chantierId);
  const total = lignes.reduce((acc, l) => acc.plus(new Decimal(l.montant)), new Decimal(0));
  return total.toFixed(2);
}


/**
 * Dit quelles prestations cette ligne de devis vend réellement.
 *
 * **Pourquoi ce lien plutôt que le texte.** Jusqu'au 26 août 2026, une ligne et
 * ses prestations ne se connaissaient que par leur libellé. Un montant posé sur
 * une ligne portant deux travaux partait dans la case du premier mot reconnu —
 * la case d'abattage du patron est passée de 800 € à 1 500 €, tonte comprise.
 *
 * **`onConflictDoNothing`, et ce n'est pas de la paresse.** Une prestation
 * n'appartient qu'à une ligne (`lignes_prix_prestations_une_seule_ligne`). Si
 * elle est déjà rattachée ailleurs — le patron rejoue l'enchaînement, une ligne
 * a survécu à un retour arrière —, on la laisse où elle est plutôt que de faire
 * échouer l'écriture de son devis. **Le lien est une aide, il n'a jamais le
 * droit de bloquer un devis** ; c'est la même règle que l'apprentissage.
 */
export async function lierPrestationsALaLigne(
  ctx: Ctx,
  lignePrixId: string,
  prestationIds: readonly string[]
): Promise<number> {
  if (prestationIds.length === 0) return 0;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const ecrites = await tx
      .insert(lignesPrixPrestations)
      .values(
        prestationIds.map((prestationId, ordre) => ({
          entrepriseId: ctx.entrepriseId,
          lignePrixId,
          prestationId,
          ordre,
        }))
      )
      .onConflictDoNothing()
      .returning();
    return ecrites.length;
  });
}

/**
 * Les identifiants des prestations d'un chantier dont le libellé figure dans
 * cette ligne — dans l'ordre où la ligne les énonce.
 *
 * **Un rapprochement par ÉGALITÉ, jamais par expression régulière.** On compare
 * des libellés entiers, à l'intérieur d'un seul chantier : c'est une recherche
 * d'identifiant, pas une septième lecture de texte métier. Elle disparaîtra le
 * jour où le découpage manipulera des prestations plutôt que des chaînes.
 */
export async function prestationsDuLibelle(
  ctx: Ctx,
  chantierId: string,
  libelle: string
): Promise<string[]> {
  const membres = membresDuLibelle(libelle).map((m) => m.toLowerCase());
  if (membres.length === 0) return [];
  const lignes = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({ id: prestations.id, libelle: prestations.libelle })
      .from(prestations)
      .where(eq(prestations.chantierId, chantierId))
  );
  const parLibelle = new Map(lignes.map((l) => [l.libelle.trim().toLowerCase(), l.id]));
  return membres.map((m) => parLibelle.get(m)).filter((id): id is string => id !== undefined);
}

/**
 * Les prestations que cette ligne vend, telles qu'elles sont en base.
 *
 * **Le remplaçant de la lecture de libellé** (`prestationsDuLibelle`). Depuis la
 * migration 0069 la ligne SAIT ce qu'elle vend ; l'apprentissage n'a plus à
 * redéduire ses natures et ses mesures d'un texte. Une ligne d'avant n'a aucun
 * lien : la liste est vide, et l'appelant retombe alors sur le libellé.
 */
export async function prestationsDeLaLigne(ctx: Ctx, lignePrixId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    prestationsDeLaLigneDans(tx, lignePrixId)
  );
}

/**
 * La même lecture, **dans une transaction déjà ouverte**.
 *
 * **Ce n'est pas une commodité, c'est une nécessité.** `withEntreprise` ouvre
 * une transaction, donc prend une connexion du pool. L'appeler depuis
 * l'intérieur d'une autre en prend une SECONDE pendant qu'on tient la première :
 * sous quelques requêtes simultanées, le pool se vide et l'application attend
 * une connexion que personne ne rendra. `retenirLecon` a besoin de cette
 * lecture au milieu de sa propre transaction — elle passe donc par ici.
 */
export async function prestationsDeLaLigneDans(tx: DbOrTx, lignePrixId: string) {
  return (
    tx
      .select({
        id: prestations.id,
        libelle: prestations.libelle,
        nature: prestations.nature,
        espece: prestations.espece,
        methode: prestations.methode,
        quantite: prestations.quantite,
        unite: prestations.unite,
        caracteristiques: prestations.caracteristiques,
        corrigeParHumain: prestations.corrigeParHumain,
      })
      .from(lignesPrixPrestations)
      .innerJoin(
        prestations,
        and(
          eq(lignesPrixPrestations.prestationId, prestations.id),
          eq(lignesPrixPrestations.entrepriseId, prestations.entrepriseId)
        )
      )
      .where(eq(lignesPrixPrestations.lignePrixId, lignePrixId))
      .orderBy(_asc(lignesPrixPrestations.ordre))
  );
}
