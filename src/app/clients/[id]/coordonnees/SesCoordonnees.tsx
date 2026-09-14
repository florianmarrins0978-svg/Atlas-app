"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import ChoixCivilite from "@/components/atlas/ChoixCivilite";
import ChampAdresse from "@/components/atlas/ChampAdresse";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors, smallCaps } from "@/lib/design-tokens";
import type { Civilite } from "@/lib/civilite";
import { enregistrerSesCoordonneesAction } from "./actions";

/**
 * SES COORDONNÉES À LUI — l'écran que la porte « Modifier » ouvre.
 *
 * **Sa réponse du 14 septembre 2026 devant les trois places : « la A ».**
 *
 * **Pourquoi ce n'est PAS le formulaire du chantier**, alors que le dépôt
 * refuse deux écrans pour une même saisie (`CLAUDE.md` §3) : celui-là n'écrit
 * pas la même chose. Il porte l'adresse des TRAVAUX, les photos et le micro du
 * chantier, et le client y reprend l'adresse du chantier quand il n'en a pas à
 * lui. Le rouvrir ici aurait demandé un chantier qui n'existe pas, et aurait
 * traîné trois champs qui ne concernent pas le client.
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
}: {
  clientId: string;
  depart: { nom: string; civilite: Civilite | null; telephone: string; email: string; adresse: string };
  retour: { href: string; libelle: string };
}) {
  const router = useRouter();
  const [nom, setNom] = useState(depart.nom);
  const [civilite, setCivilite] = useState<Civilite | null>(depart.civilite);
  const [telephone, setTelephone] = useState(depart.telephone);
  const [email, setEmail] = useState(depart.email);
  const [adresse, setAdresse] = useState(depart.adresse);
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

      <form
        className="flex flex-col gap-[10px] px-6 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          enregistrer();
        }}
      >
        <ChoixCivilite valeur={civilite} onChange={setCivilite} sansLegende />

        <Case libelle="Nom du client" valeur={nom} onChange={setNom} placeholder="Bernard" />
        <Case
          libelle="Téléphone"
          valeur={telephone}
          onChange={setTelephone}
          placeholder="06 12 34 56 78"
          type="tel"
        />
        <Case
          libelle="E-mail"
          valeur={email}
          onChange={setEmail}
          placeholder="bernard@exemple.fr"
          type="email"
        />
        <ChampAdresse
          label="Son adresse"
          placeholder="12 rue des Lilas, Nantes"
          value={adresse}
          onChange={setAdresse}
        />

        {/* Un refus se lit là où le geste se fait, et il porte sa raison. */}
        {refus && (
          <p role="alert" className="text-[14px]" style={{ color: colors.alert }}>
            {refus}
          </p>
        )}

        <div className="mt-3">
          <PrimaryButton onClick={enregistrer} disabled={enCours} pleineLargeur repere="enregistrer-coordonnees">
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

/** Une case étiquetée — la grammaire de la fiche client, sans son chantier. */
function Case({
  libelle,
  valeur,
  onChange,
  placeholder,
  type = "text",
}: {
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: "text" | "tel" | "email";
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={smallCaps} style={{ color: colors.muted }}>
        {libelle}
      </span>
      <input
        type={type}
        value={valeur}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="atlas-case"
        style={{ color: colors.ink }}
      />
    </label>
  );
}
