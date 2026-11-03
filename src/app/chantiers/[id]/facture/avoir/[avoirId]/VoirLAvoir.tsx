"use client";

import { useRouter } from "next/navigation";
import PastilleAjout from "@/components/atlas/PastilleAjout";

/**
 * « Voir l'avoir » en pastille, comme « Voir le PDF » sur la facture (planche
 * du 2 novembre 2026) : la pastille partagée est un bouton, l'avoir s'ouvre
 * dans la visionneuse de l'appli.
 */
export default function VoirLAvoir({ adresse }: { adresse: string }) {
  const router = useRouter();
  return <PastilleAjout libelle="Voir l'avoir" icone="oeil" repere="avoir-voir-pdf" onClick={() => router.push(adresse)} />;
}
