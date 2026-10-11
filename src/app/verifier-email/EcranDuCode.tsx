"use client";

import { useRouter } from "next/navigation";
import PorteDeNuit from "@/components/atlas/PorteDeNuit";
import SaisieDuCode from "@/components/atlas/SaisieDuCode";
import { deconnexionAction } from "@/app/login/actions";
import { renvoyerLeCodeAction, verifierLeCodeAction } from "./actions";

/**
 * La porte de nuit, avec la seule case du code dedans.
 *
 * Après le bon code, on va aux documents légaux — pas à l'accueil : la garde
 * du layout ne se rejoue pas sur une navigation côté client, et c'est la page
 * des documents qui sait s'il reste quelque chose à accepter (le même
 * chemin que « Entrer dans Atlas » sur la porte).
 */
export default function EcranDuCode({ email }: { email: string }) {
  const router = useRouter();
  return (
    <PorteDeNuit className="atlas-bas-sans-barre flex min-h-[100dvh] flex-col px-[22px]">
      <div className="flex flex-1 flex-col pt-[18px]">
        <SaisieDuCode
          email={email}
          onVerifie={() => router.push("/documents-legaux")}
          verifier={verifierLeCodeAction}
          renvoyer={renvoyerLeCodeAction}
          sortir={() => deconnexionAction("entree")}
        />
      </div>
    </PorteDeNuit>
  );
}
