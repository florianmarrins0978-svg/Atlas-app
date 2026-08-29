import { and, desc, eq, or } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { leconsPrix, lignesPrix } from "../db/schema";
import { signatureLecon, type LeconObservee } from "../../lib/lecons-prix";
import {
  profilDepuisLibelle,
  signatureV2,
  sontComparables,
  type ProfilComparaison,
} from "../../lib/comparabilite-prix";
import { prixAttribuable, prixAttribuableDes } from "../../lib/prix-attribuable";
import { prestationsDeLaLigne, prestationsDeLaLigneDans } from "./lignes-prix";
import { logger } from "../logger";
import type { Ctx } from "./context";

/**
 * La quantité et son unité — **ensemble ou pas du tout**.
 *
 * La base l'exige (`lecons_prix_quantite_avec_unite`), et pour la même raison
 * que sur `prestations` : « 800 » tout seul se lit 800 mètres, 800 m² ou
 * 800 heures selon qui le lit.
 */
function mesureDuProfil(profil: ProfilComparaison | null): { quantite: string | null; unite: string | null } {
  const complet = profil?.quantite && profil?.unite;
  return complet ? { quantite: profil!.quantite!, unite: profil!.unite! } : { quantite: null, unite: null };
}

/**
 * Le profil de comparaison d'une ligne, d'après les prestations qu'elle vend.
 *
 * **Une seule prestation, et une seule.** Une ligne qui en réunit plusieurs —
 * abattage, broyage, évacuation — porte bien le prix d'UN travail (c'est ce que
 * `prixAttribuable` vient d'établir), mais ses mesures et son espèce sont
 * celles du travail porteur : c'est lui qu'on retient. Sur une ligne à deux
 * arbres, aucune lecture ne saurait les distinguer, et on préfère ne rien
 * retenir plutôt qu'un profil mélangé.
 */
function profilDesPrestations(
  vendues: readonly {
    libelle: string;
    nature: string | null;
    espece: string | null;
    methode: string | null;
    quantite: string | null;
    unite: string | null;
    caracteristiques: unknown;
  }[],
  nature: string
): ProfilComparaison | null {
  const porteuses = vendues.filter((p) => (p.nature ?? "") === nature);
  if (porteuses.length !== 1) return null;
  const p = porteuses[0];
  return {
    nature,
    methode: p.methode,
    espece: p.espece,
    caracteristiques: p.caracteristiques,
    quantite: p.quantite,
    unite: p.unite,
  };
}

// La mémoire des corrections — écriture et lecture, rien d'autre.
//
// Toute la règle (ce qui se rapproche, ce qui ne se rapproche pas, ce que dit
// le rappel) vit dans `src/lib/lecons-prix.ts`, pure et éprouvable sans base.
// C'est la règle du dépôt (`CLAUDE.md` §3), et elle a sa raison d'être ici :
// confondre deux techniques d'abattage rappellerait un prix faux de 800 €, et
// ce genre de défaut se trouve en jouant des exemples, pas en montant une base.

/**
 * Retient le prix que le patron a arrêté sur une ligne de devis.
 *
 * **Silencieux par construction**, et c'est délibéré. Cette fonction est
 * appelée à chaque fois qu'il quitte un champ de prix : la faire échouer
 * bruyamment sur un libellé qu'on ne sait pas classer reviendrait à
 * l'empêcher d'écrire son devis parce qu'on n'a pas su en tirer une leçon.
 * L'apprentissage ne doit jamais gêner le travail.
 *
 * Ne retient rien quand :
 * - le libellé ne désigne aucun métier reconnaissable (« Divers »,
 *   « Déplacement ») — un rapprochement fantaisiste vaut moins que rien ;
 * - le montant est nul ou illisible — c'est une ligne en cours de saisie, pas
 *   une décision. Sans ce filtre, la mémoire rappellerait « la dernière fois :
 *   0 € ».
 */
export async function retenirLecon(ctx: Ctx, lignePrixId: string): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select()
      .from(lignesPrix)
      .where(and(eq(lignesPrix.id, lignePrixId), eq(lignesPrix.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    if (!ligne) return false;

    // **Le montant doit appartenir à UN seul travail.**
    //
    // `signatureLecon` prend la PREMIÈRE nature reconnue dans le libellé. Sur
    // une ligne qui porte « Tonte de la pelouse » et « Érable — démontage en
    // rétention », c'est l'abattage qui gagne : le prix du lot entier serait
    // retenu comme le prix d'un démontage, et rappelé plus tard avec l'autorité
    // de l'expérience.
    //
    // La même règle que la grille (`src/lib/prix-attribuable.ts`), et c'est
    // volontaire : deux garde-fous différents finiraient par diverger, et l'un
    // des deux laisserait passer ce que l'autre refuse (`CLAUDE.md` §3).
    // Ce que la ligne vend réellement (migration 0069). Vide sur une ligne
    // d'avant : on retombe alors sur son libellé, comme avant.
    //
    // **Dans la transaction courante, jamais dans une nouvelle.** Ouvrir un
    // second `withEntreprise` ici prendrait une deuxième connexion du pool
    // pendant qu'on tient la première : sous quelques requêtes simultanées, le
    // pool se vide et l'application attend une connexion que personne ne rendra.
    const vendues = await prestationsDeLaLigneDans(tx, ligne.id).catch(() => []);

    const attribution =
      vendues.length > 0 ? prixAttribuableDes(vendues) : prixAttribuable(ligne.libelle);
    if (!attribution.attribuable) {
      logger.info("Leçon de prix : montant non attribuable, rien n'est retenu", {
        chantierId: ligne.chantierId,
        motif: attribution.motif,
      });
      return false;
    }

    // **La clé V1 reste écrite telle quelle.** Elle est déjà stockée sur des
    // milliers de lignes ; en changer le format orphelinerait toute la mémoire
    // du patron, sans un mot et sans erreur.
    const signature = signatureLecon(ligne.libelle);

    // **Et la V2 s'écrit À CÔTÉ** (migration 0070). Elle sait ce que la V1
    // ignorait : l'ordre de grandeur, l'unité, l'espèce. Elle vient des colonnes
    // quand la ligne connaît ses prestations, du libellé sinon.
    const profil =
      profilDesPrestations(vendues, attribution.nature) ?? profilDepuisLibelle(ligne.libelle);
    const v2 = profil ? signatureV2(profil) : null;

    // Sans AUCUNE clé, la leçon serait introuvable : on ne l'écrit pas.
    if (!signature && !v2) return false;

    const montant = Number(ligne.montant);
    if (!Number.isFinite(montant) || montant <= 0) return false;

    // Une seule leçon par ligne, mise à jour à chaque correction : il tape son
    // prix chiffre par chiffre, et compter chaque frappe emplirait la mémoire
    // de 1, puis 10, puis 100 en allant vers 1 000. Seule sa dernière décision
    // compte.
    await tx
      .insert(leconsPrix)
      .values({
        entrepriseId: ctx.entrepriseId,
        lignePrixId: ligne.id,
        chantierId: ligne.chantierId,
        // Sans clé V1 calculable — une tonte, par exemple, que le vocabulaire
        // V1 ne connaît pas —, la V2 sert de clé, et la colonne reste
        // renseignée pour ne pas violer son NOT NULL.
        signature: signature?.cle ?? v2!.cle,
        signatureV2: v2?.cle ?? null,
        // **La matière du futur calibrage** (§11 du brief du 27 août) : sans
        // elle, on ne pourra jamais établir honnêtement, sur ses vrais devis,
        // le seuil d'écart au-delà duquel deux chantiers cessent d'être
        // comparables.
        espece: profil?.espece ?? null,
        ...mesureDuProfil(profil),
        libelle: ligne.libelle,
        prix: ligne.montant,
      })
      .onConflictDoUpdate({
        target: leconsPrix.lignePrixId,
        set: {
          signature: signature?.cle ?? v2!.cle,
          signatureV2: v2?.cle ?? null,
          espece: profil?.espece ?? null,
          ...mesureDuProfil(profil),
          libelle: ligne.libelle,
          prix: ligne.montant,
          constateLe: new Date(),
        },
      });
    return true;
  });
}

/**
 * Ce qu'il a facturé pour ce genre de travail, le plus récent d'abord.
 *
 * ─── Ce qui a changé le 27 août 2026 ────────────────────────────────────────
 *
 * Le rapprochement se faisait sur la clé V1 — nature, technique, tranche de
 * diamètre — comparée par égalité de chaîne en SQL. **50 ml et 800 ml de haie y
 * avaient la même clé** : le rappel présentait le prix de l'une comme
 * l'expérience de l'autre, et c'est d'où venaient les « 15 chantiers
 * comparables ».
 *
 * Deux temps désormais :
 *
 * 1. **la base présélectionne largement** — la clé V1 OU la clé V2, ce qui
 *    ramène au moins tout ce qu'elle ramenait avant ;
 * 2. **le tri fin se fait ici**, sur les critères éliminatoires certains
 *    (`sontComparables`) : ordre de grandeur, unité, espèce quand les deux
 *    côtés la connaissent.
 *
 * **Les leçons d'AVANT restent lisibles**, et c'est la contrainte qui a
 * gouverné tout le reste : leur clé n'est pas réécrite, et leur profil se relit
 * de leur propre libellé — celui qu'elles ont toujours porté. Rien ne prétend
 * connaître des champs qu'elles n'ont jamais eus : leur espèce reste inconnue,
 * et une espèce inconnue n'élimine rien.
 *
 * `chantierExclu` retire le chantier en cours : se rappeler à soi-même le prix
 * qu'on vient d'écrire n'apprend rien, et afficherait « la dernière fois :
 * 1 400 € » juste sous une ligne à 1 400 €.
 */
export async function leconsComparables(
  ctx: Ctx,
  /** Le libellé de la ligne, ou la ligne elle-même quand on a son identifiant. */
  cible: string | { libelle: string; id?: string },
  options: { chantierExclu?: string; limite?: number } = {}
): Promise<LeconObservee[]> {
  const libelle = typeof cible === "string" ? cible : cible.libelle;
  const lignePrixId = typeof cible === "string" ? undefined : cible.id;

  const signature = signatureLecon(libelle);

  // Le profil de la ligne courante : ses colonnes quand elle connaît ses
  // prestations, son libellé sinon.
  let profilCourant: ProfilComparaison | null = null;
  if (lignePrixId) {
    const vendues = await prestationsDeLaLigne(ctx, lignePrixId).catch(() => []);
    const attribution = vendues.length > 0 ? prixAttribuableDes(vendues) : null;
    if (attribution?.attribuable) profilCourant = profilDesPrestations(vendues, attribution.nature);
  }
  profilCourant ??= profilDepuisLibelle(libelle);
  const v2 = profilCourant ? signatureV2(profilCourant) : null;

  if (!signature && !v2) return [];

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const conditions = [
      signature ? eq(leconsPrix.signature, signature.cle) : null,
      v2 ? eq(leconsPrix.signatureV2, v2.cle) : null,
    ].filter((c): c is NonNullable<typeof c> => c !== null);

    const lignes = await tx
      .select({
        prix: leconsPrix.prix,
        constateLe: leconsPrix.constateLe,
        libelle: leconsPrix.libelle,
        chantierId: leconsPrix.chantierId,
        signatureV2: leconsPrix.signatureV2,
        espece: leconsPrix.espece,
        quantite: leconsPrix.quantite,
        unite: leconsPrix.unite,
      })
      .from(leconsPrix)
      .where(and(eq(leconsPrix.entrepriseId, ctx.entrepriseId), or(...conditions)))
      .orderBy(desc(leconsPrix.constateLe))
      // On en lit davantage qu'on n'en rendra : le tri fin ci-dessous en
      // retire, et une limite posée avant lui ferait manquer des comparables
      // légitimes au profit de rapprochements qu'on va justement écarter.
      .limit((options.limite ?? 20) * 3);

    const retenues = lignes.filter((l) => {
      if (l.chantierId === options.chantierExclu) return false;
      // Sans profil courant, on ne sait rien départager de plus que la V1 :
      // c'est exactement le comportement d'avant, et il ne se dégrade pas.
      if (!profilCourant) return true;
      const profilLecon: ProfilComparaison | null = l.signatureV2
        ? {
            nature: natureDeLaCle(l.signatureV2),
            methode: methodeDeLaCle(l.signatureV2),
            espece: l.espece,
            caracteristiques: null,
            quantite: l.quantite,
            unite: l.unite,
          }
        : profilDepuisLibelle(l.libelle);
      if (!profilLecon) return false;
      // La clé V2 stockée fait foi quand elle existe : elle porte le diamètre,
      // que les colonnes ne rejouent pas.
      if (l.signatureV2) {
        if (l.signatureV2 !== v2?.cle) return false;
        const especeLecon = l.espece?.trim().toLowerCase() || null;
        const especeCourante = profilCourant.espece?.trim().toLowerCase() || null;
        return !(especeLecon && especeCourante && especeLecon !== especeCourante);
      }
      return sontComparables(profilCourant, profilLecon);
    });

    return retenues
      .slice(0, options.limite ?? 20)
      .map(({ prix, constateLe, libelle: lib }) => ({ prix, constateLe, libelle: lib }));
  });
}

/** La nature d'une clé V2 : `v2|haie|-|-|ml|o2`. */
function natureDeLaCle(cle: string): string | null {
  return cle.split("|")[1] ?? null;
}

/** La méthode d'une clé V2, `-` valant « aucune ». */
function methodeDeLaCle(cle: string): string | null {
  const m = cle.split("|")[2];
  return !m || m === "-" ? null : m;
}
