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
    // `pb-40` : la barre d'enregistrement s'ajoute aux onglets.
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
        {/* **Le nom seul, sans « Ce compte » dessous.** Sa demande du 26 août
            2026. Un écran qui s'appelle « Mon compte » n'a pas besoin de dire
            sous chaque ligne qu'on y est. */}
        <span className="min-w-0 flex-1">
          <span className="block truncate" style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.25 }}>
            {nom.trim() === "" ? initial.email : nom}
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
          {/* **Six mots au lieu de quarante — sa demande du 26 août 2026.** Ce
              qui a été retiré, c'est le POURQUOI : rien ne permet de vérifier
              une nouvelle adresse, et une faute de frappe fermerait le compte.
              Cela reste vrai, et c'est sa place ici (`ARCHITECTURE.md`), pas à
              l'écran.

              **Mais la ligne ne disparaît pas**, contrairement à celle du nom :
              un champ qui ne s'ouvre pas quand on le touche se lit comme une
              panne, et il chercherait ce qu'il a mal fait. */}
          <span className={`mt-1.5 block ${texteSituation}`} style={{ color: colors.muted }}>
            Sert aussi à vous connecter. Pas encore modifiable.
          </span>
        </div>
      </section>

      {/* **Le paragraphe du téléphone est parti — sa demande du 26 août 2026 :**
          *« supprime la phrase sous enregistrer »*. Il expliquait pourquoi il
          n'y a pas de champ téléphone (sa réponse « A » du 14 août), en quatre
          lignes, sous le bouton — donc à moitié caché par la barre.

          **La décision, elle, n'a pas bougé** : aucun champ téléphone ici, et
          `test-compte-connexion-e2e.ts` le refuse toujours. C'est l'explication
          qui part, pas la règle. */}

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
        // **Passé au vert des boutons le 4 septembre 2026.** Il l'a relevé
        // lui-même — *« j'avais demandé à changer tous les boutons en vert
        // clair »* —, et ce bouton-ci avait échappé au balayage du 3 : il ne
        // portait pas `atlas-plein`, et le contrôle ne regardait QUE ce qui la
        // portait. Il la porte maintenant, et il est donc gardé.
        //
        // **La classe n'est posée que quand le bouton est ALLUMÉ** : éteint, il
        // est creux et gris, et le voile de l'appui n'aurait rien à éclaircir.
        className={`block w-full rounded-full py-[15px] text-center text-[16px] ${rien ? "" : "atlas-plein"}`}
        style={{
          backgroundColor: rien ? colors.card : colors.plein,
          color: rien ? colors.muted : colors.cream,
          boxShadow: rien ? `inset 0 0 0 1px ${colors.line}` : "none",
        }}
      >
        {enCours ? "Enregistrement…" : rien ? "Enregistré ✓" : "Enregistrer"}
      </button>
    </div>
  );
}
