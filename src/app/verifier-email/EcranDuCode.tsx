"use client";

import { useRouter } from "next/navigation";
import PorteDeNuit from "@/components/atlas/PorteDeNuit";
import SaisieDuCode from "@/components/atlas/SaisieDuCode";

/**
 * La porte de nuit, avec la seule case du code dedans.
 *
 * Après le bon code, on va chez soi : `/`. S'il reste des conditions à
 * accepter, la garde de `template.tsx` y renvoie — elle se rejoue à chaque
 * déplacement, celui-ci compris.
 */
export default function EcranDuCode({ email }: { email: string }) {
  const router = useRouter();
  return (
    <PorteDeNuit className="atlas-bas-sans-barre flex min-h-[100dvh] flex-col px-[22px]">
      <div className="flex flex-1 flex-col pt-[18px]">
        <SaisieDuCode email={email} onVerifie={() => router.push("/")} />
      </div>
    </PorteDeNuit>
  );
}
