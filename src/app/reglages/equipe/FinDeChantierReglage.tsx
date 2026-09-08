"use client";

import { useState, useTransition } from "react";
import { colors, libelleCaps, surPlein } from "@/lib/design-tokens";
import { reglerLaFinDeChantierAction } from "./actions";

/**
 * CE QUE LE PATRON EXIGE EN FIN DE CHANTIER.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **SA DÉCISION DU 8 SEPTEMBRE 2026 :** *« une feuille de preuve de fin de
 * chantier que le salarié remplira ou non — ça sera au patron de décider. »*
 *
 * Les deux interrupteurs sont donc ICI, et pas dans le code : c'est lui qui
 * tranche, entreprise par entreprise.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **LES DEUX PARTENT ÉTEINTS**, et ce n'est pas une timidité. Les allumer
 * d'office bloquerait, dès la mise à jour, un salarié dont le téléphone est
 * mort à 18 h — sur un chantier, sans personne à qui demander. Il les allume
 * quand il a décidé que c'était son besoin.
 *
 * **Le second DISPARAÎT quand le premier est éteint.** Un interrupteur grisé se
 * touche quand même, et son silence se lit comme une panne ; un interrupteur
 * absent dit qu'il n'y a rien à régler. La dépendance elle-même vit dans
 * `ceQuiManque` (`src/lib/retour-intervention.ts`) : cet écran ne fait que la
 * montrer.
 */
export default function FinDeChantierReglage({
  initialDemande,
  initialPhotoExigee,
}: {
  initialDemande: boolean;
  initialPhotoExigee: boolean;
}) {
  const [demande, setDemande] = useState(initialDemande);
  const [photoExigee, setPhotoExigee] = useState(initialPhotoExigee);
  const [enCours, demarrer] = useTransition();
  const [refus, setRefus] = useState<string | null>(null);

  function enregistrer(prochainDemande: boolean, prochainPhoto: boolean) {
    const avantDemande = demande;
    const avantPhoto = photoExigee;
    setDemande(prochainDemande);
    setPhotoExigee(prochainPhoto);
    setRefus(null);
    demarrer(async () => {
      const r = await reglerLaFinDeChantierAction(prochainDemande, prochainPhoto);
      if (!r.ok) {
        // **On remet l'interrupteur où il était.** Un réglage qui reste allumé à
        // l'écran alors que le serveur l'a refusé lui ferait croire que ses
        // salariés sont tenus à quelque chose qui n'est nulle part.
        setDemande(avantDemande);
        setPhotoExigee(avantPhoto);
        setRefus(r.message);
      }
    });
  }

  return (
    <section className="mt-10 px-[26px]" data-atlas="reglage-fin-de-chantier">
      <p className={libelleCaps} style={{ color: colors.muted }}>
        Fin de chantier
      </p>

      <Bascule
        titre="Demander une preuve"
        dit="Ce qui a été fait, avant « C'est fini »"
        actif={demande}
        enCours={enCours}
        repere="retour-demande"
        onChange={(v) => enregistrer(v, photoExigee)}
      />

      {demande && (
        <Bascule
          titre="Au moins une photo"
          dit="Sinon il ne peut pas terminer"
          actif={photoExigee}
          enCours={enCours}
          repere="retour-photo"
          onChange={(v) => enregistrer(demande, v)}
        />
      )}

      {refus && (
        <p className="mt-2 text-[13px] leading-[1.5]" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}
    </section>
  );
}

function Bascule({
  titre,
  dit,
  actif,
  enCours,
  repere,
  onChange,
}: {
  titre: string;
  dit: string;
  actif: boolean;
  enCours: boolean;
  repere: string;
  onChange: (actif: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-4"
      style={{ borderBottom: `1px solid ${colors.line}` }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] leading-[1.35]">{titre}</span>
        <span className="mt-[3px] block text-[12.5px] leading-[1.45]" style={{ color: colors.muted }}>
          {dit}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={actif}
        aria-label={titre}
        disabled={enCours}
        data-atlas={`bascule-${repere}`}
        onClick={() => onChange(!actif)}
        className="relative h-[31px] w-[52px] flex-none rounded-full disabled:opacity-60"
        style={{
          backgroundColor: actif ? colors.plein : colors.rustTint,
          boxShadow: actif ? "none" : `inset 0 0 0 1px ${colors.line}`,
          transition: "background-color .2s cubic-bezier(.22,.9,.3,1)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span
          aria-hidden="true"
          className="absolute left-[3px] top-[3px] h-[25px] w-[25px] rounded-full"
          style={{
            backgroundColor: actif ? surPlein : colors.card,
            boxShadow: "0 1px 3px rgba(20,18,14,.28)",
            transform: actif ? "translateX(21px)" : "none",
            transition: "transform .2s cubic-bezier(.22,.9,.3,1)",
          }}
        />
      </button>
    </div>
  );
}
