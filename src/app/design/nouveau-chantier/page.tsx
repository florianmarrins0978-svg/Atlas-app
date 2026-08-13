"use client";

import { useState } from "react";
import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";

// Maquette isolée — n'affecte aucune route existante.
//
// Comportement clavier mobile : le bouton principal est dans le flux normal de la
// page (pas de position fixed), donc aucun risque de chevauchement ou de mise en
// page cassée quand le clavier apparaît — la page défile normalement comme tout
// formulaire natif.

export default function NouveauChantierMockup() {
  const [nomClient, setNomClient] = useState("");
  const [adresseClientVisible, setAdresseClientVisible] = useState(false);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100dvh" }}>
      <div className="mx-auto max-w-md pb-16">
        {/* Retour discret — cohérent avec la fiche chantier, aucune concurrence avec l'action principale */}
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

        <form className="mt-7 flex flex-col gap-4 px-6" onSubmit={(e) => e.preventDefault()}>
          {/* 1 — Nom du client. La case « Nom du chantier » a été retirée le
              2026-08-05 : plus rien n'est obligatoire, le nom se déduit du
              client, sinon de l'adresse, sinon de la date. La maquette suit
              l'écran réel — une maquette qui montre un champ disparu induit en
              erreur plus sûrement qu'une maquette absente. */}
          <Field
            label="Nom du client (facultatif)"
            placeholder="Bernard"
            big
            value={nomClient}
            onChange={setNomClient}
          />
          {/* 3 — Téléphone : facultatif */}
          <Field label="Téléphone (facultatif)" placeholder="06 12 34 56 78" type="tel" />
          {/* 4 — Adresse du chantier : facultative, libellé explicite pour éviter toute ambiguïté avec l'adresse du client */}
          <Field label="Adresse du chantier (facultatif)" placeholder="12 rue des Lilas, Nantes" />

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
            <Field label="Adresse du client (facultatif)" placeholder="Si différente de l'adresse du chantier" />
          )}

          {/* 6 — Action principale, toujours active : plus rien n'est exigé */}
          <div className="pt-4">
            <PrimaryButton>Créer le chantier →</PrimaryButton>
          </div>
          <p className="text-center text-[13px]" style={{ color: colors.muted }}>
            Vous pourrez compléter les informations manquantes depuis la fiche du chantier.
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
}: {
  label: string;
  placeholder: string;
  type?: string;
  big?: boolean;
  value?: string;
  onChange?: (v: string) => void;
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
