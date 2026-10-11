"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import ChoixCanal from "@/components/atlas/ChoixCanal";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { MOIS_LONGS, jourLisibleCourt } from "@/lib/mois";
import { avecCivilite } from "@/lib/civilite";
import { duMois, prestationDuPassage, type EnvoiDesDates, type GroupeDuMois } from "@/lib/dates-du-mois";
import { canalPourJoindre, composerMessageDatesDuMois, lienTransmission } from "@/lib/message-client";
import { ouvrirAdresse } from "@/lib/ouvrir-messagerie";
import { adressePourLeClient, ouvrableParLeClient, phraseAdresseLocale } from "@/lib/adresse-du-client";
import type { JourIso } from "@/lib/disponibilites";
import type { ContactDuContrat } from "@/server/repositories/dates-du-mois";
import { envoyerDatesDuMoisAction } from "./dates-du-mois-actions";

// LES DATES DU MOIS DANS LE TIROIR DU PLANNING — planche 130, sa demande du
// 27 septembre 2026.
//
// **Aucune règle ici** : ce qui est prêt à partir et ce qui attend le client
// vient de `datesDuMois` (`src/lib/dates-du-mois.ts`), la même fonction que le
// serveur rejoue avant d'envoyer (`CLAUDE.md` §3).

export type DonneesDatesDuMois = {
  envois: EnvoiDesDates[];
  contacts: ContactDuContrat[];
  entrepriseNom: string;
  origine: string;
};

type Passage = { id: string; nom: string; datePlanifiee: string | null };

/**
 * « À envoyer » : un bloc par client et par mois, dès que la dernière date est
 * posée. **Il s'ouvre et l'écran y descend tout seul** — sa demande : *« il ne
 * faut pas avoir besoin de recliquer sur le nom du client »*. Le bouton vit
 * SOUS les lignes, à sa demande aussi.
 */
export function DatesAEnvoyer({
  groupe,
  donnees,
  titre,
  onEnvoye,
}: {
  groupe: GroupeDuMois<Passage>;
  donnees: DonneesDatesDuMois;
  titre: ReactNode;
  onEnvoye: (envoi: EnvoiDesDates) => void;
}) {
  const contact = donnees.contacts.find((c) => c.contratEntretienId === groupe.contratEntretienId) ?? null;
  const [canal, setCanal] = useState(canalPourJoindre(contact ?? {}));
  // Le même réglage que le devis, allumé d'office comme lui.
  const [autreDate, setAutreDate] = useState(true);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const cadre = useRef<HTMLDivElement>(null);

  // **L'écran descend jusqu'au bouton** quand le bloc paraît : c'est ce qui
  // rend l'envoi visible sans chercher. Un geste d'affichage, sans état.
  useEffect(() => {
    cadre.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, []);

  const client = avecCivilite(contact?.clientNom ?? "", contact?.clientCivilite ?? undefined);
  const mot = duMois(groupe.mois);
  const nombre = groupe.passages.length;

  function envoyer() {
    if (!canal || !contact) return;
    const adresse = adressePourLeClient(donnees.origine);
    if (!ouvrableParLeClient(adresse)) {
      setRefus(phraseAdresseLocale("l'envoi"));
      return;
    }
    setRefus(null);
    demarrer(async () => {
      const r = await envoyerDatesDuMoisAction({
        contratEntretienId: groupe.contratEntretienId,
        mois: groupe.mois,
        canal,
        autreDateAutorisee: autreDate,
      });
      if (!r.ok) {
        setRefus(r.refus);
        return;
      }
      const message = composerMessageDatesDuMois({
        clientNom: contact.clientNom,
        clientCivilite: contact.clientCivilite ?? undefined,
        entrepriseNom: donnees.entrepriseNom,
        duMois: mot,
        lien: `${adresse}/contrat/dates/${r.jeton}`,
      });
      ouvrirAdresse(
        lienTransmission({ canal, destinataire: canal === "sms" ? contact.telephone : contact.email, message }),
        canal
      );
      onEnvoye({
        contratEntretienId: groupe.contratEntretienId,
        mois: groupe.mois,
        envoyeLe: new Date().toISOString(),
        reponduLe: null,
      });
    });
  }

  return (
    <div ref={cadre} data-atlas="dates-a-envoyer" data-mois={groupe.mois}>
      {titre}
      <p className="mx-[18px] mb-0 mt-3 text-[15px] leading-[1.3]" style={{ fontFamily: font.display, color: colors.ink }}>
        {client}, {nombre} passage{nombre > 1 ? "s" : ""} en {MOIS_LONGS[Number(groupe.mois.slice(5, 7)) - 1]}
      </p>
      <div className="mx-[18px] mt-1">
        {groupe.passages.map((p, i) => (
          <div
            key={p.id}
            className="flex min-h-[46px] items-center justify-between gap-2.5 py-[9px]"
            style={{ borderBottom: i === nombre - 1 ? "none" : `1px solid ${colors.line}` }}
          >
            <span className="min-w-0 flex-1 truncate text-[16px]" style={{ fontFamily: font.display, color: colors.ink }}>
              {prestationDuPassage(p.nom)}
            </span>
            <span className="flex-none text-[12.5px]" style={{ color: colors.muted }}>
              {p.datePlanifiee ? jourLisibleCourt(p.datePlanifiee as JourIso).toLowerCase() : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="mx-[18px] mt-3 flex items-center justify-between gap-3">
        <span className="text-[15px]" style={{ color: colors.ink }}>
          Votre client peut proposer une autre date
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={autreDate}
          aria-label="Votre client peut proposer une autre date"
          data-atlas="autre-date-du-mois"
          onClick={() => setAutreDate((a) => !a)}
          className="relative h-7 w-12 flex-none rounded-full border-0"
          style={{ backgroundColor: autreDate ? colors.plein : colors.line }}
        >
          <span
            aria-hidden="true"
            className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-[left]"
            style={{ left: autreDate ? 23 : 3, backgroundColor: colors.card }}
          />
        </button>
      </div>

      <div className="mx-[18px] mt-3 flex justify-center gap-4">
        <ChoixCanal libelle="Par SMS" actif={canal === "sms"} disponible={Boolean(contact?.telephone?.trim())} onClick={() => setCanal("sms")} apparence="reglage" />
        <ChoixCanal libelle="Par e-mail" actif={canal === "email"} disponible={Boolean(contact?.email?.trim())} onClick={() => setCanal("email")} apparence="reglage" />
      </div>
      <div className="mx-[18px] mb-2 mt-2.5">
        <button
          type="button"
          onClick={envoyer}
          disabled={enCours || !canal}
          data-atlas="envoyer-dates-du-mois"
          className="atlas-plein block min-h-[52px] w-full rounded-full border-0 text-[17px] disabled:opacity-45"
          style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display }}
        >
          {enCours ? "Un instant" : `Envoyer les dates ${mot}`}
        </button>
        {(refus ?? (!canal ? "Ajoutez son téléphone ou son e-mail sur sa fiche." : null)) && (
          <p className="m-0 mt-1.5 text-center text-[13px]" style={{ color: colors.alert }}>
            {refus ?? "Ajoutez son téléphone ou son e-mail sur sa fiche."}
          </p>
        )}
      </div>
    </div>
  );
}

/** « En attente du client » : un client et un mois, envoyés, sans réponse. */
export function DatesEnAttente({
  groupe,
  donnees,
  derniere,
}: {
  groupe: GroupeDuMois<Passage> & { envoyeLe: string };
  donnees: DonneesDatesDuMois;
  derniere: boolean;
}) {
  const contact = donnees.contacts.find((c) => c.contratEntretienId === groupe.contratEntretienId) ?? null;
  const client = avecCivilite(contact?.clientNom ?? "", contact?.clientCivilite ?? undefined);
  const le = jourLisibleCourt(groupe.envoyeLe.slice(0, 10) as JourIso).toLowerCase();
  return (
    <div
      data-atlas="dates-en-attente"
      className="flex items-center justify-between gap-2.5 py-[11px]"
      style={{ borderBottom: derniere ? "none" : `1px solid ${colors.line}` }}
    >
      <span className="min-w-0 flex-1 truncate" style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.2 }}>
        {client}
      </span>
      <span className="flex-shrink-0 text-right text-[12.5px]" style={{ color: colors.muted }}>
        Dates {duMois(groupe.mois)} envoyées le {le}
      </span>
    </div>
  );
}
