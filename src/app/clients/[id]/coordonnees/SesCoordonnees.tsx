"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import ChoixCivilite from "@/components/atlas/ChoixCivilite";
import ChampAdresse from "@/components/atlas/ChampAdresse";
import AvisNumeroTva from "@/components/atlas/AvisNumeroTva";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import type React from "react";
import { colors, libelleCaps } from "@/lib/design-tokens";
import Pellicule, { type VignettePhoto } from "@/app/chantiers/[id]/Pellicule";
import { casesDuClient, type CiviliteClient } from "@/lib/civilite";
import { DEBUT_NUMERO_TVA } from "@/lib/autoliquidation";
import { enregistrerSesCoordonneesAction } from "./actions";

/**
 * SES COORDONNÉES À LUI — l'écran que la porte « Modifier » ouvre.
 *
 * **Sa réponse du 14 septembre 2026 devant les trois places : « la A ».**
 *
 * **Pourquoi ce n'est PAS le formulaire du chantier**, alors que le dépôt
 * refuse deux écrans pour une même saisie (`CLAUDE.md` §3) : celui-là n'écrit
 * pas la même chose. Il porte l'adresse des TRAVAUX et le micro du chantier,
 * et le client y reprend l'adresse du chantier quand il n'en a pas à lui. Le
 * rouvrir ici aurait demandé un chantier qui n'existe pas. Ce qui est commun
 * depuis le 1er novembre 2026, c'est sa MISE EN PAGE, et la pellicule de son
 * dernier chantier, sous Enregistrer.
 *
 * Ce qui est commun reste commun : les pastilles de civilité
 * (`ChoixCivilite`), la case d'adresse et ses suggestions (`ChampAdresse`), la
 * règle d'enregistrement (`mettreAJourClient`). Ce qui est propre à cet écran,
 * c'est l'absence du chantier.
 */
export default function SesCoordonnees({
  clientId,
  depart,
  retour,
  photos,
}: {
  clientId: string;
  depart: {
    nom: string;
    civilite: CiviliteClient | null;
    telephone: string;
    email: string;
    adresse: string;
    siret: string;
    numeroTva: string;
    codeService: string;
  };
  retour: { href: string; libelle: string };
  /** Son dernier chantier et ses photos ; `null` sans chantier. */
  photos: { chantierId: string; initiales: VignettePhoto[] } | null;
}) {
  const router = useRouter();
  const [nom, setNom] = useState(depart.nom);
  const [civilite, setCivilite] = useState<CiviliteClient | null>(depart.civilite);
  const [telephone, setTelephone] = useState(depart.telephone);
  const [email, setEmail] = useState(depart.email);
  const [adresse, setAdresse] = useState(depart.adresse);
  const [siret, setSiret] = useState(depart.siret);
  const [numeroTva, setNumeroTva] = useState(depart.numeroTva || DEBUT_NUMERO_TVA);
  const [codeService, setCodeService] = useState(depart.codeService);
  const cases = casesDuClient(civilite);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function enregistrer() {
    setRefus(null);
    demarrer(async () => {
      const r = await enregistrerSesCoordonneesAction(clientId, {
        nom,
        civilite,
        telephone,
        email,
        adresse,
        siret,
        numeroTva,
        codeService,
      });
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      // **On le repose sur sa fiche, pas ailleurs.** C'est l'écran d'où il
      // vient, et c'est là qu'il vérifie que la correction a pris.
      router.push(retour.href);
      router.refresh();
    });
  }

  return (
    <div className="pb-[86px]">
      <EnTeteEcran retour={retour} titre="Ses coordonnées" />

      {/* **La mise en page de sa fiche client — sa planche du 1er novembre
          2026** (`appli/soignee/client-coordonnees.html`) : *« la première
          page client, je veux pas y toucher, elle est vraiment bien, tu peux
          te baser là-dessus, même pour le style et la mise en page »*. Donc
          les pastilles, le nom et le téléphone sur une rangée, les numéros
          d'une entreprise côte à côte, des intitulés courts au-dessus, les
          cases de `FormulaireNouveauChantier`. Sans vocal : on corrige une
          fiche, on ne la dicte pas. */}
      <form
        className="flex flex-col gap-3 px-6 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          enregistrer();
        }}
      >
        <ChoixCivilite valeur={civilite} onChange={setCivilite} sansLegende />

        <div>
          <div aria-hidden="true" className={`mb-1 flex items-end gap-[9px] ${libelleCaps}`} style={{ color: colors.muted }}>
            <span className="min-w-0 flex-1 leading-[1.35]">Nom du client</span>
            <span className="w-[152px] flex-shrink-0 text-right leading-[1.35]">Téléphone</span>
          </div>
          <div className="flex gap-[9px]">
            <div className="min-w-0 flex-1">
              <Case libelle="Nom du client" valeur={nom} onChange={setNom} placeholder="Bernard" />
            </div>
            {/* Le numéro à largeur FIXE, le nom prend ce qui reste : un nom
                trop long se tronque sans rien coûter, un numéro tronqué ne se
                rappelle pas (la mesure de sa fiche, 152 px). */}
            <div className="w-[152px] flex-shrink-0">
              <Case libelle="Téléphone" valeur={telephone} onChange={setTelephone} placeholder="06 12 34 56 78" type="tel" aDroite />
            </div>
          </div>
        </div>

        {/* **Entreprise : le SIRET et le n° TVA ; Public : le SIRET et le code
            service, sur UNE rangée** — comme sa fiche (`casesDuClient`). Ils
            s'impriment sous le nom du client, sur le devis et la facture.
            Repassé sur Mr ou Mme, ils se cachent sans rien effacer. Le SIRET a
            un peu plus de place : il a quatorze chiffres. Pas de n° de TVA pour
            une mairie : la sous-traitance ne vaut pas pour elle. */}
        {cases.siret && (
          <div>
            <div className="flex gap-3">
              <div className="min-w-0 flex-[1.12]">
                <Intitule>SIRET</Intitule>
                <Case libelle="SIRET" valeur={siret} onChange={setSiret} placeholder="812 345 678 00021" repere="siret-client" />
              </div>
              {cases.numeroTva && (
                <div className="min-w-0 flex-1">
                  <Intitule>N° TVA</Intitule>
                  <Case
                    libelle="N° TVA intracommunautaire"
                    valeur={numeroTva}
                    onChange={setNumeroTva}
                    placeholder="FR00812345678"
                    repere="tva-client-fiche"
                  />
                </div>
              )}
              {cases.codeService && (
                <div className="min-w-0 flex-1">
                  <Intitule>Code service</Intitule>
                  <Case libelle="Code service" valeur={codeService} onChange={setCodeService} placeholder="Sur la commande" repere="code-service-client" />
                </div>
              )}
            </div>
            {/* Le numéro tiré du SIRET se PROPOSE, il ne s'écrit jamais seul :
                « Le mettre » est son geste (`AvisNumeroTva`). */}
            {cases.numeroTva && <AvisNumeroTva siret={siret} numeroTva={numeroTva} onMettre={setNumeroTva} />}
          </div>
        )}

        <div>
          <Intitule>E-mail</Intitule>
          <Case libelle="E-mail" valeur={email} onChange={setEmail} placeholder="bernard@exemple.fr" type="email" />
        </div>
        <div>
          <Intitule>Son adresse</Intitule>
          <ChampAdresse label="Son adresse" placeholder="12 rue des Lilas, Nantes" value={adresse} onChange={setAdresse} sansLibelle />
        </div>

        {/* Un refus se lit là où le geste se fait, et il porte sa raison. */}
        {refus && (
          <p role="alert" className="text-[14px] font-semibold" style={{ color: colors.alert }}>
            {refus}
          </p>
        )}

        <div className="mt-2">
          <PrimaryButton onClick={enregistrer} disabled={enCours} pleineLargeur repere="enregistrer-coordonnees">
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </PrimaryButton>
        </div>
      </form>

      {/* **SOUS Enregistrer, la pellicule de l'appli — sa consigne du
          1er novembre 2026 :** *« en dessous d'Enregistrer, tu laisses ce qui
          se trouve dans l'appli, le plus pour les photos »*. La même
          `Pellicule` que sa fiche client et son chantier : le « + » en
          pointillé d'or, puis les vignettes. Hors du formulaire : une photo
          s'enregistre à l'instant, elle n'attend pas « Enregistrer ». */}
      {photos && (
        <div className="mt-6 px-6" role="group" aria-label="Photos de son dernier chantier">
          <Intitule>Photos</Intitule>
          <Pellicule chantierId={photos.chantierId} initiales={photos.initiales} />
        </div>
      )}
    </div>
  );
}

/** L'intitulé court au-dessus d'une case, celui de sa fiche client. */
function Intitule({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden="true" className={`mb-1 ${libelleCaps}`} style={{ color: colors.muted }}>
      {children}
    </div>
  );
}

/** Une case, celle de sa fiche client : son nom se lit au lecteur d'écran, l'intitulé est au-dessus. */
function Case({
  libelle,
  valeur,
  onChange,
  placeholder,
  type = "text",
  repere,
  aDroite = false,
}: {
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: "text" | "tel" | "email";
  repere?: string;
  aDroite?: boolean;
}) {
  return (
    <input
      type={type}
      value={valeur}
      placeholder={placeholder}
      aria-label={libelle}
      onChange={(e) => onChange(e.target.value)}
      data-atlas={repere}
      className="atlas-case"
      style={{
        color: colors.ink,
        ...(aDroite ? { textAlign: "right" as const, fontVariantNumeric: "tabular-nums" } : null),
      }}
    />
  );
}
