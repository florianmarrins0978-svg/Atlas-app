"use client";

import { colors, font, smallCaps } from "@/lib/design-tokens";
import { useRemovableList, WithId } from "@/lib/use-removable-list";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import UndoToast from "@/components/atlas/UndoToast";
import { AnimatedRow } from "@/components/atlas/AnimatedRow";

// Maquette isolée — n'affecte aucune route existante.
// Calcul entièrement simulé : les lignes de départ sont fixes (pas encore reliées
// aux tarifs de l'entreprise ni aux informations vérifiées), mais le total est
// une vraie somme, recalculée en direct à chaque modification.

type Ligne = WithId & { libelle: string; montant: number };

const LIGNES_INITIALES: Ligne[] = [
  { id: 1, libelle: "Main d'œuvre — 2 hommes × 2 jours", montant: 1120 },
  { id: 2, libelle: "Dépose carrelage — 8 m²", montant: 144 },
  { id: 3, libelle: "Pose faïence — 8 m²", montant: 360 },
  { id: 4, libelle: "Forfait déplacement", montant: 35 },
];

export default function PrixMockup() {
  const lignes = useRemovableList<Ligne>(LIGNES_INITIALES, 100);
  const total = lignes.items.reduce((s, l) => s + (Number.isFinite(l.montant) ? l.montant : 0), 0);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100dvh" }}>
      <div className="mx-auto max-w-md pb-16">
        <div className="px-6 pt-8">
          <a
            href="/design/hub"
            aria-label="Retour"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <div className="px-6 pt-5">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Rénovation salle de bain
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Prix
          </h1>
        </div>

        {/* Total — information la plus importante, en évidence */}
        <div className="mx-6 mt-6 rounded-2xl px-5 py-6 text-center" style={{ backgroundColor: colors.card }}>
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 6 }}>
            Total
          </p>
          <p className="text-[40px] font-semibold leading-none" style={{ fontFamily: font.display, color: colors.rust }}>
            {total.toLocaleString("fr-FR")} €
          </p>
          <p className="mt-2 text-[12px]" style={{ color: colors.muted }}>
            Calculé à partir des tarifs de l&apos;entreprise — modifiable ci-dessous.
          </p>
        </div>

        <form className="mt-7 flex flex-col gap-2 px-6" onSubmit={(e) => e.preventDefault()}>
          <span className={smallCaps} style={{ color: colors.muted }}>
            Détail
          </span>

          {lignes.items.map((ligne) => (
            <AnimatedRow key={ligne.id} leaving={lignes.leavingIds.has(ligne.id)} onRemove={() => lignes.remove(ligne.id)}>
              <input
                value={ligne.libelle}
                onChange={(e) => lignes.updateAt(ligne.id, (l) => ({ ...l, libelle: e.target.value }))}
                className="flex-1 rounded-2xl border-0 px-4 py-3 outline-none"
                style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "15px" }}
              />
              <input
                type="number"
                value={ligne.montant}
                onChange={(e) => lignes.updateAt(ligne.id, (l) => ({ ...l, montant: parseFloat(e.target.value) || 0 }))}
                className="w-24 flex-shrink-0 rounded-2xl border-0 px-3 py-3 text-right outline-none"
                style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "15px" }}
              />
            </AnimatedRow>
          ))}

          <button
            type="button"
            onClick={() => lignes.add((id) => ({ id, libelle: "", montant: 0 }))}
            className="mt-1 self-start text-[14px] font-medium"
            style={{ color: colors.rust }}
          >
            + Ajouter une ligne
          </button>
          {lignes.items.length === 0 && (
            <p className="text-[13px]" style={{ color: colors.muted }}>
              Aucune ligne pour l&apos;instant.
            </p>
          )}

          <div className="pt-5">
            <PrimaryButton>Préparer le devis →</PrimaryButton>
          </div>
        </form>
      </div>

      <UndoToast
        open={lignes.lastRemoved !== null}
        message="Ligne supprimée"
        onUndo={lignes.undoLastRemoved}
        onDismiss={lignes.clearLastRemoved}
      />
    </div>
  );
}
