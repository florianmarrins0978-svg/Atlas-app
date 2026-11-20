/** Le diagnostic végétal : ce que le serveur rendrait, sans serveur. */
import type { LotImporte } from "@/lib/import-fiches-phyto";
import { composerResultat } from "@/server/diagnostic/moteur";
import FICHE_DU_PLATANE from "../../../../donnees/phyto/fiches/002-anthracnose-platane.json";
import { attendre, fabrique, type Action } from "./commun";

/**
 * LE DIAGNOSTIC DE LA DÉMONSTRATION : l'anthracnose du platane, l'une des
 * trois fiches publiables du dépôt (donnees/phyto/fiches/). Celle du peuplier,
 * montrée plus haut sur la page, n'existe que dans une base locale.
 *
 * Rien n'est recopié de la fiche à la main : elle est lue par la fonction de
 * l'import (`validerLot`, à la construction), puis le résultat est composé
 * par la fonction du moteur (`composerResultat`), exactement comme le
 * serveur le fige. La
 * confiance est « probable » ; l'essence n'est pas donnée, et l'écran dit
 * alors « Probable » seul (sans « Probable · Platane », que main affiche
 * encore avec un point entre les deux mots : TODO.md).
 */
export const PHOTO_EXEMPLE = "platane-exemple.jpg";
// Déjà lue par l'import au moment de construire (construire.ts) : ce
// fichier reçoit le lot validé, pas le fichier brut.
const LOT = { lot: FICHE_DU_PLATANE as unknown as LotImporte };
const FICHE = { ...LOT.lot.fiches[0], id: "platane" };
let rattacheA: string | null = null;
const CHANTIERS = [
  { id: "lemaire", nom: "Lemaire" },
  { id: "bernard", nom: "Bernard" },
];

export const { bouchon, constante } = fabrique({
  "src/app/paysage/diagnostic/actions.ts": {
    // La photo de la démonstration, déposée par le guide de la page, rend la
    // fiche. Une autre photo demanderait l'IA, qui n'est pas sur le site :
    // l'écran le dit, au lieu de rendre le platane pour n'importe quoi.
    analyserPhotoAction: async (donnees) => {
      const photo = (donnees as FormData).get("photo");
      // Une photo vide n'est pas une photo : l'appli la refuserait aussi, et
      // c'est ce qui fait rougir le contrôle des planches quand la photo
      // d'exemple manque sur le site (vu le 20 novembre : acceptée sur son
      // seul nom, elle rendait la fiche sans exister).
      if (!(photo instanceof File) || photo.name !== PHOTO_EXEMPLE || photo.size === 0) {
        return { ok: false, phrase: "Dans l’appli, votre photo est regardée et comparée aux fiches. Ici, touchez « Une feuille de platane », à côté du téléphone." };
      }
      await attendre(1800);
      return { ok: true, id: "exemple" };
    },
    rattacherAction: async (_id, chantierId) => {
      rattacheA = String(chantierId);
      return { ok: true };
    },
  },
  "src/server/session-ctx.ts": {
    getCurrentCtx: async () => ({ utilisateurId: "demonstration", entrepriseId: "demonstration" }),
  },
  "src/server/repositories/diagnostics.ts": {
    lireDiagnostic: async () => ({
      id: "exemple",
      statut: "rendu",
      resultat: await composerResultat({ fiche: { id: FICHE.id } } as never, "probable"),
      observation: null,
      taxonId: null,
      ficheId: FICHE.id,
      chantierId: rattacheA,
      panne: null,
    }),
  },
  "src/server/repositories/fiches-phyto.ts": {
    lireFicheComplete: async () => ({
      fiche: FICHE,
      sources: FICHE.sources.map((ref) => {
        const s = LOT.lot.sources.find((x) => x.code === ref.source)!;
        return { organisme: s.organisme, titre: s.titre, url: s.url ?? null, consulteeLe: s.consulteeLe, champs: ref.champs };
      }),
    }),
    // L'identifiant d'une image EST son chemin (construire.ts) : la photo de
    // la fiche, déjà publiée dans appli/.
    lireImagesFiche: async () =>
      FICHE.images.map((im, i) => ({ id: "../../diagnostic-anthracnose-platane-feuille.jpg", ficheId: FICHE.id, ordre: i, legende: im.legende ?? null, credit: im.credit, licence: im.licence, partie: im.partie })),
    compterFichesServables: async () => 3,
  },
  "src/server/repositories/chantiers.ts": {
    listerChantiers: async () => CHANTIERS,
  },
} satisfies Record<string, Record<string, Action>>);
