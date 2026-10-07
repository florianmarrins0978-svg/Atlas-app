"use client";

import { useRouter } from "next/navigation";
import { colors, texteSituation } from "@/lib/design-tokens";
import { deconnexionAction } from "@/app/login/actions";
import SectionDoubleVerification from "@/app/reglages/connexion/SectionDoubleVerification";

/**
 * La même section que dans Réglages, sans autre issue que l'activer ou sortir.
 *
 * **« Se déconnecter » reste offert** : un patron qui n'a pas son téléphone sous
 * la main ne doit pas se croire enfermé. Il revient quand il l'a.
 */
export default function ActivationObligatoire() {
  const router = useRouter();
  return (
    <>
      <p className={`mx-[26px] mt-4 ${texteSituation}`} style={{ color: colors.inkSoft }}>
        Obligatoire pour votre compte.
      </p>
      <SectionDoubleVerification
        etatInitial={{ active: false, codesRestants: 0 }}
        obligatoire
        apresActivation={() => router.replace("/")}
      />
      <button
        type="button"
        onClick={() => void deconnexionAction()}
        className="mx-[26px] mt-6 py-2 text-[14.5px]"
        style={{ color: colors.inkSoft }}
      >
        Se déconnecter
      </button>
    </>
  );
}
