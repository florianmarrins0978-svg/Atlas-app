"use client";

import { useState, useTransition } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { majIdentiteAction } from "./actions";

/**
 * L'identité de l'entreprise — d'après `maquettes/atlas-reglages-identite.html`.
 *
 * **Trois règles portées par cet écran, et arrêtées sur planche :**
 *
 *   - **le SIREN ne se saisit pas** : il EST les neuf premiers chiffres du
 *     SIRET, et l'écran le MONTRE sous le champ. Deux saisies seraient deux
 *     façons de se contredire, et c'est celui qui saisit qui paierait l'écart ;
 *   - **le régime de TVA se déclare** et commande ce qui s'imprime. Il était
 *     deviné d'après le taux appliqué jusqu'au 13 août 2026, et se trompait dans
 *     les deux sens (`ARCHITECTURE.md` §81) ;
 *   - **un champ manquant reste vide et se signale sur SA LIGNE**, en disant ce
 *     que l'absence empêche. Un exemple plausible glissé à la place d'une donnée
 *     absente finirait imprimé sur une pièce comptable (`docs/AGENT.md` §3).
 */
type Identite = {
  nom: string;
  formeJuridique: string;
  adresse: string;
  siret: string;
  telephone: string;
  email: string;
  iban: string;
  titulaireCompte: string;
  numeroTva: string;
  regimeTva: "assujettie" | "franchise";
};

/** Les neuf premiers chiffres du SIRET — jamais une seconde saisie. */
export function sirenDepuisSiret(siret: string): string | null {
  const chiffres = siret.replace(/\D/g, "");
  if (chiffres.length < 9) return null;
  return chiffres.slice(0, 9).replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
}

export default function IdentiteClient({ initial }: { initial: Identite }) {
  const [valeurs, setValeurs] = useState<Identite>(initial);
  const [refus, setRefus] = useState<string | null>(null);
  const [, demarrer] = useTransition();

  function ecrire<C extends keyof Identite>(champ: C, valeur: Identite[C]) {
    setValeurs((v) => ({ ...v, [champ]: valeur }));
  }

  function enregistrer(partiel: Partial<Identite>) {
    demarrer(async () => {
      const r = await majIdentiteAction(partiel);
      setRefus(r.ok ? null : r.raison);
    });
  }

  const siren = sirenDepuisSiret(valeurs.siret);

  return (
    <div className="pb-24">
      {refus && (
        <p
          role="alert"
          className={`mx-[26px] mt-4 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}`, color: colors.alert }}
        >
          {refus}
        </p>
      )}

      <Bloc titre="Comment vous vous nommez">
        <Champ
          etiquette="Nom de l'entreprise"
          valeur={valeurs.nom}
          onChange={(v) => ecrire("nom", v)}
          onFini={() => enregistrer({ nom: valeurs.nom })}
          manquant={valeurs.nom.trim() === ""}
          empeche="Sans nom, vos documents n'ont pas d'émetteur."
        />
        <Champ
          etiquette="Forme juridique"
          valeur={valeurs.formeJuridique}
          placeholder="SASU, EI, EURL…"
          onChange={(v) => ecrire("formeJuridique", v)}
          onFini={() => enregistrer({ formeJuridique: valeurs.formeJuridique })}
        />
      </Bloc>

      <Bloc titre="Où vous êtes établi">
        <Champ
          etiquette="Adresse du siège"
          valeur={valeurs.adresse}
          long
          onChange={(v) => ecrire("adresse", v)}
          onFini={() => enregistrer({ adresse: valeurs.adresse })}
          manquant={valeurs.adresse.trim() === ""}
          empeche="Elle figure en tête de chaque devis et de chaque facture."
        />
      </Bloc>

      <Bloc titre="Vos identifiants">
        <Champ
          etiquette="SIRET"
          valeur={valeurs.siret}
          placeholder="14 chiffres"
          onChange={(v) => ecrire("siret", v)}
          onFini={() => enregistrer({ siret: valeurs.siret })}
          manquant={valeurs.siret.trim() === ""}
          empeche="Vos factures ne sont pas conformes sans lui."
          /* Le SIREN se MONTRE, il ne se demande pas. */
          sous={siren ? `SIREN ${siren} — les neuf premiers chiffres. Il ne se saisit pas séparément.` : null}
        />
      </Bloc>

      <Bloc titre="Votre régime de TVA">
        <Choix
          nom="Franchise en base"
          detail="Vous ne facturez pas de TVA. La mention de l'article 293 B s'imprime sur chaque facture."
          pris={valeurs.regimeTva === "franchise"}
          onChoix={() => {
            ecrire("regimeTva", "franchise");
            enregistrer({ regimeTva: "franchise" });
          }}
        />
        <Choix
          nom="Assujettie"
          detail="Vous facturez la TVA. Votre numéro intracommunautaire figure alors sur la facture."
          pris={valeurs.regimeTva === "assujettie"}
          onChoix={() => {
            ecrire("regimeTva", "assujettie");
            enregistrer({ regimeTva: "assujettie" });
          }}
        />
        {/* Le numéro n'existe que pour qui doit en avoir un : le montrer grisé
            sous « franchise » inviterait à remplir un champ jamais imprimé. */}
        {valeurs.regimeTva === "assujettie" && (
          <Champ
            etiquette="Numéro de TVA intracommunautaire"
            valeur={valeurs.numeroTva}
            placeholder="FR…"
            onChange={(v) => ecrire("numeroTva", v)}
            onFini={() => enregistrer({ numeroTva: valeurs.numeroTva })}
          />
        )}
      </Bloc>

      <Bloc titre="Pour vous joindre">
        <Champ
          etiquette="Téléphone"
          valeur={valeurs.telephone}
          onChange={(v) => ecrire("telephone", v)}
          onFini={() => enregistrer({ telephone: valeurs.telephone })}
        />
        <Champ
          etiquette="Adresse e-mail"
          valeur={valeurs.email}
          onChange={(v) => ecrire("email", v)}
          onFini={() => enregistrer({ email: valeurs.email })}
        />
      </Bloc>

      <Bloc titre="Pour être payé">
        <Champ
          etiquette="IBAN"
          valeur={valeurs.iban}
          onChange={(v) => ecrire("iban", v)}
          onFini={() => enregistrer({ iban: valeurs.iban })}
          manquant={valeurs.iban.trim() === ""}
          empeche="Sans lui, votre client reçoit un devis qu'il ne peut pas payer."
        />
        <Champ
          etiquette="Titulaire du compte"
          valeur={valeurs.titulaireCompte}
          placeholder={valeurs.nom || "Le nom qui figure sur le compte"}
          onChange={(v) => ecrire("titulaireCompte", v)}
          onFini={() => enregistrer({ titulaireCompte: valeurs.titulaireCompte })}
        />
      </Bloc>

      <p className={`mx-[26px] mt-[30px] border-t pt-[18px] ${texteSituation}`}
         style={{ borderColor: colors.line, color: colors.muted }}>
        Ces informations remplissent vos devis et vos factures toutes seules.
        Chaque document garde <b style={{ color: colors.ink, fontWeight: 400 }}>ce
        qu&apos;elles disaient le jour où il a été créé</b> : les corriger
        aujourd&apos;hui ne change aucun document déjà fait.
      </p>
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mx-[26px] mt-[30px] pt-[18px]" style={{ borderTop: `1px solid ${colors.line}` }}>
      <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
        {titre}
      </p>
      {children}
    </section>
  );
}

/** Une ligne de saisie : étiquette, valeur en serif, filet dessous. */
function Champ({
  etiquette, valeur, onChange, onFini, placeholder, long, manquant, empeche, sous,
}: {
  etiquette: string;
  valeur: string;
  onChange: (v: string) => void;
  onFini: () => void;
  placeholder?: string;
  long?: boolean;
  manquant?: boolean;
  /** Ce que l'absence EMPÊCHE. « Champ requis » ne fait agir personne. */
  empeche?: string;
  sous?: string | null;
}) {
  const teinte = manquant ? colors.alert : colors.line;
  const commun = {
    value: valeur,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onBlur: onFini,
    "aria-label": etiquette,
    className: "block w-full border-0 bg-transparent p-0 outline-none",
    // 16 px au moins : en dessous, iOS agrandit la page à la mise au point et le
    // patron se retrouve avec un écran zoomé à rétablir à la main.
    style: { fontFamily: font.display, fontSize: 17, lineHeight: 1.35, color: colors.ink },
  } as const;

  return (
    <label className="block py-[13px]" style={{ borderBottom: `1px solid ${teinte}` }}>
      <span className={`mb-[5px] block ${libelleCaps}`} style={{ color: manquant ? colors.alert : colors.muted }}>
        {etiquette}
        {manquant ? " — manquant" : ""}
      </span>
      {long ? (
        <textarea {...commun} rows={2} className={`${commun.className} resize-none`} />
      ) : (
        <input {...commun} type="text" autoComplete="off" spellCheck={false} />
      )}
      {sous && (
        <span className={`mt-1.5 block ${texteSituation}`} style={{ color: colors.muted }}>
          {sous}
        </span>
      )}
      {manquant && empeche && (
        <span className={`mt-1.5 block ${texteSituation}`} style={{ color: colors.alert }}>
          {empeche}
        </span>
      )}
    </label>
  );
}

/** Un choix unique — la pastille se remplit d'or, comme sur la planche. */
function Choix({
  nom, detail, pris, onChoix,
}: { nom: string; detail: string; pris: boolean; onChoix: () => void }) {
  return (
    <button
      type="button"
      onClick={onChoix}
      aria-pressed={pris}
      className="flex w-full items-start gap-[13px] py-[14px] text-left"
      style={{ borderBottom: `1px solid ${colors.line}`, minHeight: 54 }}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 h-[19px] w-[19px] flex-none rounded-full"
        style={{ boxShadow: pris ? `inset 0 0 0 6px ${colors.or}` : `inset 0 0 0 1px ${colors.line}` }}
      />
      <span className="min-w-0 flex-1">
        <span className="block" style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.25, color: colors.ink }}>
          {nom}
        </span>
        <span className={`mt-1 block ${texteSituation}`} style={{ color: colors.muted }}>
          {detail}
        </span>
      </span>
    </button>
  );
}
