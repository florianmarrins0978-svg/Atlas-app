import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { moisEnCours } from "@/lib/periode";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { lireMarges, listerSocietes, type SocieteComplete } from "@/server/repositories/fournisseurs-partenaires";
import RubriqueReservee from "../RubriqueReservee";
import FournisseursPartenaires, { type SocieteVue } from "./FournisseursPartenaires";
import { garderLaPage } from "@/server/garde-page";

export const dynamic = "force-dynamic";

const jourFrancais = (iso: string) => iso.split("-").reverse().join("/");
const jourDe = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

const recu = (d: SocieteComplete["devis"][number]): SocieteVue["devis"][number] => ({
  id: d.id,
  nom: d.nom,
  jour: d.recuLe,
  recuLe: jourFrancais(d.recuLe),
  nature: d.nature,
  fichierNom: d.fichierNom,
  totalTtc: d.totalTtc,
});

function vue(s: SocieteComplete): SocieteVue {
  return {
    id: s.id,
    nom: s.nom,
    marge: s.marge,
    email: s.email,
    prix: s.prix.map((p) => ({ id: p.id, nom: p.nom, reference: p.reference, unite: p.unite, prixHt: p.prixHt, prixAvant: p.prixAvant, source: p.source })),
    devis: s.devis.filter((d) => d.genre === "devis").map(recu),
    factures: s.devis.filter((d) => d.genre === "facture").map(recu),
    demandes: s.demandes.map((d) => ({
      id: d.id,
      nom: d.titre,
      jour: jourDe(d.envoyeeLe),
      envoyeeLe: jourFrancais(jourDe(d.envoyeeLe)),
      lignes: d.lignes.length,
    })),
  };
}

/**
 * « Fournisseurs et partenaires » — sa planche du 18 et du 19 octobre 2026
 * (`appli/reglages-fournisseurs-partenaires.html`, validée).
 *
 * Ce qu'il PAIE, à part de ce qu'il vend : ses fournisseurs et leurs prix, ses
 * partenaires et le prix de leur main d'œuvre, les devis reçus et les listes
 * envoyées, les factures reçues (23 octobre 2026), ses deux marges. Le devis dicté y prend ses prix après ses tarifs
 * (`src/lib/prix-achat.ts`).
 *
 * **La rubrique refuse un non-propriétaire avant de lire quoi que ce soit**,
 * comme « Mes tarifs » : ce sont ses prix d'achat et ses marges.
 */
export default async function FournisseursPage() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Ce que je paie"
        quoi="Les prix d’achat ne se consultent pas depuis ce compte."
      />
    );
  }
  const [fournisseurs, partenaires, marges] = await Promise.all([
    listerSocietes(ctx, "fournisseur"),
    listerSocietes(ctx, "partenaire"),
    lireMarges(ctx),
  ]);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran
          surtitre="Réglages"
          titre="Ce que je paie"
          retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
        />
        <p className="mx-[16px] mt-1 text-[13.5px]" style={{ color: colors.muted }}>
          Prix d’achat, à part de vos prix de vente.
        </p>
        <FournisseursPartenaires
          fournisseurs={fournisseurs.map(vue)}
          partenaires={partenaires.map(vue)}
          marges={marges}
          mois={moisEnCours()}
        />
      </div>
    </div>
  );
}
