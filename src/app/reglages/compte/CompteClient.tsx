"use client";

import { useState, useTransition } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { renommerCompteAction } from "./actions";

/**
 * « Mon compte » — `maquettes/atlas-reglages-moi.html`, écran 1.
 *
 * **L'e-mail se LIT, il ne se change pas — et ce n'est pas un oubli.** C'est
 * l'identifiant de connexion, et Atlas n'a AUCUN canal pour le confirmer : ni
 * e-mail sortant, ni SMS (tranché le 4 août 2026), ni parcours d'inscription,
 * ni réinitialisation par courriel. Une lettre de travers dans ce champ, et le
 * compte devient inaccessible — sans le moindre moyen de revenir en arrière.
 * Un champ dont la faute de frappe est irréparable ne s'ouvre pas tant qu'il
 * n'y a pas de quoi la rattraper. L'écran le DIT plutôt que de laisser croire à
 * une panne (`TODO.md` §0 octovicies).
 */
export default function CompteClient({ initial }: { initial: { nom: string; email: string } }) {
  const [nom, setNom] = useState(initial.nom);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  /** Ce qui n'est pas encore écrit — le bouton du bas DIT cet état (§99). */
  const [aEcrire, setAEcrire] = useState(false);

  function enregistrer() {
    demarrer(async () => {
      const r = await renommerCompteAction(nom);
      setRefus(r.ok ? null : r.raison);
      if (r.ok) setAEcrire(false);
    });
  }

  // Les initiales, à défaut d'un portrait : `users.image` existe et reste vide
  // — personne ne téléverse une photo depuis un chantier, et un rond vide se
  // lit comme un écran cassé.
  const initiales = initialesDe(nom, initial.email);

  return (
    // `pb-40` : la barre d'enregistrement s'ajoute aux onglets, et sans cette
    // réserve le dernier paragraphe passe dessous.
    <div className="pb-40">
      {refus && (
        <p
          role="alert"
          className={`mx-[26px] mt-4 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}`, color: colors.alert }}
        >
          {refus}
        </p>
      )}

      <div className="mx-[26px] mt-[26px] flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full"
          style={{ backgroundColor: colors.card, color: colors.or, fontFamily: font.display, fontSize: 19 }}
        >
          {initiales}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate" style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.25 }}>
            {nom.trim() === "" ? initial.email : nom}
          </span>
          <span className={`mt-0.5 block ${texteSituation}`} style={{ color: colors.muted }}>
            Ce compte
          </span>
        </span>
      </div>

      <section
        className="mx-[26px] mt-[30px] border-t pt-[18px] [&>*:last-child]:border-b-0"
        style={{ borderColor: colors.line }}
      >
        <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
          Qui vous êtes
        </p>

        <label className="block border-b py-[13px]" style={{ borderColor: colors.line }}>
          <span className={`mb-[5px] block ${libelleCaps}`} style={{ color: colors.muted }}>
            Nom
          </span>
          <input
            type="text"
            value={nom}
            autoComplete="name"
            aria-label="Nom"
            onChange={(e) => {
              setNom(e.target.value);
              setAEcrire(true);
            }}
            onBlur={enregistrer}
            className="block w-full border-0 bg-transparent p-0 outline-none"
            // 16 px au moins : en dessous, iOS agrandit la page à la mise au
            // point et il se retrouve avec un écran zoomé à rétablir à la main.
            style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.35, color: colors.ink }}
          />
          <span className={`mt-1.5 block ${texteSituation}`} style={{ color: colors.muted }}>
            Ce nom ne part pas chez le client : c&apos;est celui de votre entreprise qui s&apos;imprime sur le devis.
          </span>
        </label>

        <div className="border-b py-[13px]" style={{ borderColor: colors.line }}>
          <span className={`mb-[5px] block ${libelleCaps}`} style={{ color: colors.muted }}>
            E-mail
          </span>
          <span
            className="block break-all"
            style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.35, color: colors.ink }}
          >
            {initial.email}
          </span>
          <span className={`mt-1.5 block ${texteSituation}`} style={{ color: colors.muted }}>
            C&apos;est aussi l&apos;identifiant avec lequel vous vous connectez. Il ne se change pas encore : rien ne
            permettrait de vérifier la nouvelle adresse, et une faute de frappe fermerait le compte pour de bon.
          </span>
        </div>
      </section>

      {/* **Pas de téléphone, et l'écran le DIT.** Sa réponse « A », le 14 août
          2026. Une absence muette se lit comme un oubli, et la question
          reviendrait dans un mois. */}
      <p
        className={`mx-[26px] mt-[30px] border-t pt-[18px] ${texteSituation}`}
        style={{ borderColor: colors.line, color: colors.muted }}
      >
        Pas de téléphone ici, et c&apos;est voulu. Le numéro que vos clients voient est celui de l&apos;entreprise,
        réglé dans « Mon entreprise » et imprimé sur vos documents. En ajouter un second, personnel, n&apos;enverrait
        rien à personne : Atlas ne passe ni appel ni SMS.
      </p>

      <BarreEnregistrer aEcrire={aEcrire} enCours={enCours} onEnregistrer={enregistrer} />
    </div>
  );
}

/**
 * Deux lettres, tirées du nom — et de l'e-mail quand le nom manque.
 *
 * Exportée pour être éprouvée sans navigateur : un compte neuf n'a pas de nom,
 * et c'est exactement le cas où un rond vide passerait pour un défaut.
 */
export function initialesDe(nom: string, email: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (mots.length >= 2) return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  const avant = email.split("@")[0] ?? "";
  return (avant.slice(0, 2) || "?").toUpperCase();
}

/**
 * Le bouton du bas, posé SUR l'écran — sa réponse « À » du 14 août 2026.
 *
 * Il se pose sur `--atlas-barre`, jamais sur un nombre écrit à la main : la
 * hauteur de la barre du bas comprend `env(safe-area-inset-bottom)`, nulle sur
 * un ordinateur et d'une vingtaine de pixels sur un iPhone à encoche.
 */
function BarreEnregistrer({
  aEcrire,
  enCours,
  onEnregistrer,
}: {
  aEcrire: boolean;
  enCours: boolean;
  onEnregistrer: () => void;
}) {
  const rien = !aEcrire && !enCours;
  return (
    <div
      className="fixed inset-x-0 z-10 mx-auto max-w-md border-t px-[26px] pb-4 pt-3.5"
      style={{ bottom: "var(--atlas-barre)", backgroundColor: colors.cream, borderColor: colors.line }}
    >
      <button
        type="button"
        onClick={onEnregistrer}
        disabled={rien}
        className="block w-full rounded-full py-[15px] text-center text-[16px]"
        style={{
          backgroundColor: rien ? colors.card : colors.rust,
          color: rien ? colors.muted : colors.cream,
          boxShadow: rien ? `inset 0 0 0 1px ${colors.line}` : "none",
        }}
      >
        {enCours ? "Enregistrement…" : rien ? "Enregistré ✓" : "Enregistrer"}
      </button>
    </div>
  );
}
