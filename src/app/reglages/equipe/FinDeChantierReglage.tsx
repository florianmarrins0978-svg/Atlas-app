"use client";

import { useState, useTransition } from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import Paquet from "@/components/atlas/reglages/Paquet";
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
 * **ILS RAPPELLENT, ILS NE BLOQUENT PLUS — sa règle du 19 septembre 2026 :**
 * *« il faut qu'on puisse l'envoyer même si on ne met pas de photo ou si tout
 * n'est pas coché, parce qu'un chantier de 8 jours, il faut pouvoir faire
 * plusieurs retours d'intervention jour après jour »*. Allumés, ils écrivent
 * sous « Envoyer le retour du jour » ce qui manque encore ; le retour part
 * quand même. Un réglage qui aurait gardé son verrou aurait contredit sa
 * planche ; un réglage retiré aurait effacé sa décision du 8 septembre. Il
 * garde donc son sens — dire à l'équipe ce qu'il attend — et perd sa porte.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **ET LE PREMIER RAPPELLE D'ENVOYER — sa planche du 26 septembre 2026.** Son
 * sous-titre, sa phrase à lui, disait ce que l'interrupteur ne faisait pas.
 * Allumé, il met désormais « Retour à envoyer » sous le chantier du jour au
 * planning, chaque soir, et « Retour pas reçu » sur l'accueil du patron le
 * lendemain (`retourDuJourAttendu`, `retoursPasRecus`).
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
    <Paquet titre="Fin de chantier" dataAtlas="reglage-fin-de-chantier">
      <Bascule
        titre="Demander une preuve"
        dit="Rappelle d'envoyer le retour d'intervention à chaque fin de chantier"
        actif={demande}
        enCours={enCours}
        repere="retour-demande"
        onChange={(v) => enregistrer(v, photoExigee)}
      />

      {demande && (
        <Bascule
          titre="Au moins une photo"
          dit="Rappelée aussi, avant l'envoi"
          actif={photoExigee}
          enCours={enCours}
          repere="retour-photo"
          onChange={(v) => enregistrer(demande, v)}
        />
      )}

      {refus && (
        <p className="pb-3.5 text-[14px] leading-[1.5]" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}
    </Paquet>
  );
}

/**
 * Une ligne d'interrupteur : le titre en serif, ce qu'il fait dessous, la
 * bascule au bout du pouce (planche du 26 octobre 2026).
 */
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
    <div className="relative flex min-h-[64px] items-center gap-3.5 py-3">
      {/* Le filet se pose au-dessus de chaque ligne ; le paquet rogne le premier. */}
      <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
          {titre}
        </span>
        <span className="mt-0.5 block text-[14px] leading-[1.4]" style={{ color: colors.inkSoft }}>
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
        className="relative h-[32px] w-[52px] flex-none rounded-full disabled:opacity-60"
        style={{
          backgroundColor: actif ? colors.plein : voile(colors.ink, 0.18),
          transition: "background-color .22s cubic-bezier(.22,.61,.36,1)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span
          aria-hidden="true"
          className="absolute left-[3px] top-[3px] h-[26px] w-[26px] rounded-full"
          style={{
            backgroundColor: actif ? surPlein : colors.card,
            boxShadow: `0 1px 2px ${voile(colors.ink, 0.2)}`,
            transform: actif ? "translateX(20px)" : "none",
            transition: "transform .24s cubic-bezier(.34,1.4,.5,1)",
          }}
        />
      </button>
    </div>
  );
}
