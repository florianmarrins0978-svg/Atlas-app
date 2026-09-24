"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CHAMP, NUIT, SERIF } from "@/components/atlas/PorteDeNuit";
import SaisieDuCode from "@/components/atlas/SaisieDuCode";
import OeilMotDePasse from "@/components/atlas/OeilMotDePasse";
import { etatConfirmation, etatNouveau, verifierNouveauMotDePasse } from "@/lib/mot-de-passe";
import { choisirLeMotDePasseAction, recevoirUnCodeAction, verifierLeCodeOublieAction } from "./actions";

/**
 * Les trois écrans de la planche : l'adresse, le code, le nouveau mot de passe.
 *
 * **Le jeton ne vit qu'ici, en mémoire.** Il n'est ni dans l'adresse de la
 * page, ni dans un cookie : il sert une fois, dans le quart d'heure, et un
 * rechargement le perd, ce qui ramène simplement à « Recevoir un code ».
 *
 * Le bouton « Enregistrer » s'allume avec la même fonction que le serveur
 * applique (`verifierNouveauMotDePasse`) : deux règles divergeraient, et l'on
 * verrait un bouton allumé sur une saisie refusée (`CLAUDE.md` §3).
 */
export default function EcranMotDePasseOublie({ adresseDeDepart }: { adresseDeDepart: string }) {
  const router = useRouter();
  const [etape, setEtape] = useState<"adresse" | "code" | "nouveau">("adresse");
  const [adresse, setAdresse] = useState(adresseDeDepart);
  const [jeton, setJeton] = useState("");
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function recevoir() {
    setRefus(null);
    demarrer(async () => {
      const etat = await recevoirUnCodeAction(adresse);
      if (etat.ok) setEtape("code");
      else setRefus(etat.refus);
    });
  }

  if (etape === "code") {
    return (
      <div className="flex flex-1 flex-col pt-[18px]">
        <SaisieDuCode
          email={adresse.trim().toLowerCase()}
          onVerifie={() => setEtape("nouveau")}
          verifier={async (code) => {
            const etat = await verifierLeCodeOublieAction(adresse, code);
            if (!etat.ok) return etat;
            setJeton(etat.jeton);
            return { ok: true };
          }}
          renvoyer={() => recevoirUnCodeAction(adresse)}
          sortir={async () => router.push("/login")}
        />
      </div>
    );
  }

  if (etape === "nouveau") {
    return (
      <NouveauMotDePasse
        adresse={adresse}
        jeton={jeton}
        recommencer={() => {
          setJeton("");
          setEtape("adresse");
        }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <button
        type="button"
        onClick={() => router.push("/login")}
        className="flex flex-shrink-0 items-center gap-[6px] self-start py-2 pr-[10px] pt-[10px] text-[14px]"
        style={{ color: NUIT.muted }}
        aria-label="Revenir à la connexion"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5 8 12l7 7" />
        </svg>
        Retour
      </button>

      <div className="flex flex-1 flex-col justify-center py-6">
        <h1 className="mb-4 text-[30px] leading-[1.1]" style={SERIF}>
          Mot de passe oublié
        </h1>
        <input
          type="email"
          name="email"
          autoComplete="username"
          placeholder="Adresse"
          aria-label="Adresse"
          value={adresse}
          onChange={(e) => {
            setRefus(null);
            setAdresse(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") recevoir();
          }}
          className="w-full rounded-full px-5 py-[15px] text-[16px] outline-none"
          style={CHAMP}
        />
        <p className="mt-3 min-h-[19px] text-[13px] leading-[19px]" role="alert" aria-live="polite" style={{ color: NUIT.alerte }}>
          {refus ?? ""}
        </p>
      </div>

      <button
        type="button"
        onClick={recevoir}
        disabled={enCours}
        className="w-full flex-shrink-0 rounded-full py-4 text-[17px] leading-none transition-transform active:scale-[0.985] disabled:opacity-60"
        style={{ background: NUIT.rust, color: NUIT.cream, ...SERIF }}
      >
        {enCours ? "Un instant…" : "Recevoir un code"}
      </button>
    </div>
  );
}

function NouveauMotDePasse({
  adresse,
  jeton,
  recommencer,
}: {
  adresse: string;
  jeton: string;
  recommencer: () => void;
}) {
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState({ nouveau: false, confirmation: false });
  const [refus, setRefus] = useState<{ message: string; recommencer: boolean } | null>(null);
  const [enCours, demarrer] = useTransition();

  const court = etatNouveau(nouveau);
  const accord = etatConfirmation(nouveau, confirmation);
  const bloquant = verifierNouveauMotDePasse(nouveau, confirmation);

  function enregistrer() {
    if (bloquant) return;
    setRefus(null);
    demarrer(async () => {
      // En cas de réussite, l'action redirige vers l'accueil et ne rend rien.
      const etat = await choisirLeMotDePasseAction(adresse, jeton, nouveau, confirmation);
      setRefus({ message: etat.refus, recommencer: etat.recommencer });
    });
  }

  const cases = [
    { cle: "nouveau" as const, texte: "Nouveau mot de passe", valeur: nouveau, poser: setNouveau, sous: court?.message ?? null, teinte: NUIT.alerte },
    {
      cle: "confirmation" as const,
      texte: "Confirmer le nouveau mot de passe",
      valeur: confirmation,
      poser: setConfirmation,
      sous: accord?.message ?? null,
      teinte: accord?.identiques ? NUIT.orTexte : NUIT.alerte,
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center py-6">
        <h1 className="mb-4 text-[30px] leading-[1.1]" style={SERIF}>
          Nouveau mot de passe
        </h1>
        {cases.map((c) => (
          <div key={c.cle}>
            <div className="flex items-center" style={{ ...CHAMP, borderRadius: 9999 }}>
              <input
                type={visible[c.cle] ? "text" : "password"}
                name={c.cle}
                autoComplete="new-password"
                placeholder={c.texte}
                aria-label={c.texte}
                value={c.valeur}
                onChange={(e) => {
                  setRefus(null);
                  c.poser(e.target.value);
                }}
                className="min-w-0 flex-1 bg-transparent px-5 py-[15px] text-[16px] outline-none"
                style={{ color: NUIT.ink }}
              />
              <OeilMotDePasse
                ouvert={visible[c.cle]}
                onBasculer={() => setVisible((v) => ({ ...v, [c.cle]: !v[c.cle] }))}
                quoi="le mot de passe"
                couleur={NUIT.muted}
                couleurOuvert={NUIT.orTexte}
                className="mr-[6px]"
              />
            </div>
            <p className="mb-[6px] ml-[14px] mt-[6px] min-h-[19px] text-[13px] leading-[19px]" aria-live="polite" style={{ color: c.teinte }}>
              {c.sous ?? ""}
            </p>
          </div>
        ))}
        <p className="min-h-[19px] text-[13px] leading-[19px]" role="alert" aria-live="polite" style={{ color: NUIT.alerte }}>
          {refus?.message ?? ""}
        </p>
      </div>

      {refus?.recommencer ? (
        <button
          type="button"
          onClick={recommencer}
          className="w-full flex-shrink-0 rounded-full py-4 text-[17px] leading-none transition-transform active:scale-[0.985]"
          style={{ background: NUIT.rust, color: NUIT.cream, ...SERIF }}
        >
          Recevoir un code
        </button>
      ) : (
        <button
          type="button"
          onClick={enregistrer}
          disabled={enCours || bloquant !== null}
          className="w-full flex-shrink-0 rounded-full py-4 text-[17px] leading-none transition-transform active:scale-[0.985] disabled:opacity-45"
          style={{ background: NUIT.rust, color: NUIT.cream, ...SERIF }}
        >
          {enCours ? "Un instant…" : "Enregistrer"}
        </button>
      )}
    </div>
  );
}
