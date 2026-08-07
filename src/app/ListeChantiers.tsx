"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, cardShadow } from "@/lib/design-tokens";
import CarteGlissante from "@/components/atlas/CarteGlissante";
import { supprimerChantierAction } from "./planning/actions";

/**
 * La liste des chantiers à préparer — et le geste qui en retire un.
 *
 * **Pourquoi ce composant existe.** L'écran d'accueil est rendu côté serveur :
 * il ne peut ni suivre un doigt ni appeler une action. Le patron, le 7 août
 * 2026 : « le slide et la suppression que tu as fait pour les chantiers
 * planifiés, je veux la même chose pour ceux en attente du client et ceux de la
 * catégorie chantier ». Seule la liste bascule côté navigateur — le reste de
 * l'écran, ses compteurs et ses notifications restent rendus par le serveur.
 *
 * Le refus de suppression n'est pas un détail : un chantier déjà facturé ne
 * peut pas disparaître (sa facture figure au relevé de TVA). L'écran doit dire
 * pourquoi, sinon le geste paraît simplement cassé.
 */
export default function ListeChantiers({
  chantiers,
}: {
  chantiers: { id: string; nom: string; carte: ReactNode }[];
}) {
  const router = useRouter();
  const [retires, setRetires] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  async function supprimer(id: string) {
    setErreur(null);
    // Retiré de l'écran d'abord : sur un téléphone, une carte qui reste en
    // place le temps d'un aller-retour donne l'impression que rien ne s'est
    // passé, et le geste se refait.
    setRetires((r) => [...r, id]);
    const resultat = await supprimerChantierAction(id);
    if (!resultat.succes) {
      setRetires((r) => r.filter((x) => x !== id));
      setErreur(resultat.erreur);
      return;
    }
    router.refresh();
  }

  const visibles = chantiers.filter((c) => !retires.includes(c.id));

  return (
    <>
      {erreur && (
        <p role="alert" className="mt-6 px-6 text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}
      <div className="mt-8 flex flex-col gap-4 px-6">
        {visibles.map((c) => (
          <CarteGlissante
            key={c.id}
            libelleSuppression={`Supprimer le chantier ${c.nom}`}
            onSupprimer={() => supprimer(c.id)}
          >
            <Link
              href={`/chantiers/${c.id}`}
              className="flex items-start gap-4 rounded-[22px] px-5 py-5"
              style={{ backgroundColor: colors.card, boxShadow: cardShadow }}
            >
              {c.carte}
            </Link>
          </CarteGlissante>
        ))}
      </div>
    </>
  );
}
