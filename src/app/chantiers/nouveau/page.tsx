"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { creerChantierAction } from "./actions";

// Intégration réelle : la création passe désormais par une Server Action
// (creerChantierAction), qui persiste le chantier (et le client s'il est
// renseigné) dans la base réelle, dans le contexte de l'entreprise active.
//
// Comportement clavier mobile : le bouton principal reste dans le flux normal de
// la page (pas de position fixed) — pas de risque de chevauchement à l'ouverture
// du clavier. Les champs utilisent une taille de police ≥16px pour éviter le zoom
// automatique d'iOS Safari au focus.

export default function NouveauChantierPage() {
  const router = useRouter();
  const [nomChantier, setNomChantier] = useState("");
  const [nomClient, setNomClient] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresseChantier, setAdresseChantier] = useState("");
  const [adresseClient, setAdresseClient] = useState("");
  const [adresseClientVisible, setAdresseClientVisible] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const peutCreer = nomChantier.trim().length > 0 && !enCours;

  async function handleCreer() {
    if (nomChantier.trim().length === 0) return; // jamais de création sans nom
    setEnCours(true);
    setErreur(null);
    try {
      const { id } = await creerChantierAction({
        nomChantier,
        nomClient,
        telephone,
        adresseChantier,
        adresseClient,
      });
      router.push(`/chantiers/${id}`);
    } catch {
      setErreur("Impossible de créer le chantier pour l'instant. Réessayez.");
      setEnCours(false);
    }
  }

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        {/* Retour discret — même style que la fiche chantier */}
        <div className="px-6 pt-8">
          <Link
            href="/"
            aria-label="Retour à la liste des chantiers"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <div className="px-6 pt-5">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Nouveau
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Un chantier
          </h1>
        </div>

        <form
          className="mt-7 flex flex-col gap-4 px-6"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreer();
          }}
        >
          {/* 1 — Nom du chantier : seul champ obligatoire */}
          <Field
            label="Nom du chantier"
            placeholder="Rénovation salle de bain"
            big
            value={nomChantier}
            onChange={setNomChantier}
            required
          />
          {/* 2 — Nom du client : facultatif */}
          <Field
            label="Nom du client (facultatif)"
            placeholder="M. Bernard"
            value={nomClient}
            onChange={setNomClient}
          />
          {/* 3 — Téléphone : facultatif */}
          <Field
            label="Téléphone (facultatif)"
            placeholder="06 12 34 56 78"
            type="tel"
            value={telephone}
            onChange={setTelephone}
          />
          {/* 4 — Adresse du chantier : facultative */}
          <Field
            label="Adresse du chantier (facultatif)"
            placeholder="12 rue des Lilas, Nantes"
            value={adresseChantier}
            onChange={setAdresseChantier}
          />

          {/* 5 — Adresse client, masquée par défaut */}
          {!adresseClientVisible ? (
            <button
              type="button"
              onClick={() => setAdresseClientVisible(true)}
              className="self-start text-[14px] font-medium"
              style={{ color: colors.rust }}
            >
              + Ajouter une adresse client différente
            </button>
          ) : (
            <Field
              label="Adresse du client (facultatif)"
              placeholder="Si différente de l'adresse du chantier"
              value={adresseClient}
              onChange={setAdresseClient}
            />
          )}

          {/* 6 — Action principale */}
          <div className="pt-4">
            <PrimaryButton disabled={!peutCreer} onClick={handleCreer}>
              {enCours ? "Création…" : "Créer le chantier →"}
            </PrimaryButton>
          </div>
          <p className="text-center text-[13px]" style={{ color: erreur ? colors.alert : colors.muted }}>
            {/* Ne promet plus une modification ultérieure du client : aucun
                écran ne le permet aujourd'hui. Mieux vaut inviter à renseigner
                maintenant ce qui est connu. */}
            {erreur ??
              (nomChantier.trim().length > 0
                ? "Renseignez dès maintenant ce que vous savez du client : ces informations ne sont plus modifiables ensuite."
                : "Le nom du chantier est nécessaire pour continuer.")}
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
  big = false,
  value,
  onChange,
  required = false,
}: {
  label: string;
  placeholder: string;
  type?: string;
  big?: boolean;
  value?: string;
  onChange?: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={smallCaps} style={{ color: colors.muted }}>
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-required={required || undefined}
        className="rounded-2xl border-0 px-4 py-3.5 outline-none"
        style={{
          backgroundColor: colors.card,
          color: colors.ink,
          fontFamily: big ? font.display : font.body,
          fontSize: big ? "20px" : "16px",
        }}
      />
    </label>
  );
}
