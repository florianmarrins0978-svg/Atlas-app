"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { etatConfirmation, LONGUEUR_MINIMALE } from "@/lib/mot-de-passe";
import type { Role } from "@/lib/acces-roles";
import ChoixRole from "../ChoixRole";
import { donnerUnAccesAction } from "../actions";

/**
 * NOUVEAU COMPTE — un écran à lui seul.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **SA RÉPONSE DU 26 AOÛT 2026 : « B, tu peux coder »**, sur
 * `appli/donner-un-acces.html`.
 *
 * Ce qu'il a écarté (proposition A) : le formulaire dans une carte posée sur la
 * liste. Ce qu'il a retenu : un écran entier, d'où la liste a disparu.
 *
 * **Ce que cela répare, et c'était sa troisième remarque** — *« la démarcation
 * entre vous patron et le compte qu'on est en train d'attribuer n'est pas bien
 * séparée, on comprend pas très bien »*. Le formulaire vivait DANS la liste des
 * comptes existants, juste sous sa propre ligne : deux blocs de champs et de
 * pastilles se suivaient, et rien ne disait où le sien finissait. Ici il n'y a
 * plus rien à confondre — sa ligne n'est pas sur cet écran.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUI NE SE DÉCIDE PAS ICI : le droit d'y être.** L'adresse est sous
 * `/reglages/equipe`, que `cheminAutorise` ferme à tout ce qui n'est pas patron
 * — et la page serveur le revérifie. Cet écran n'est qu'un dessin.
 */
export default function NouveauCompte() {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [role, setRole] = useState<Role>("salarie");
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const disent = etatConfirmation(motDePasse, confirmation);

  function creer() {
    setMessage(null);
    demarrer(async () => {
      const r = await donnerUnAccesAction({ nom, email, motDePasse, confirmation, role });
      if (r.ok) {
        // Retour à la liste, où il verra la ligne qu'il vient de créer. Un
        // écran de félicitations serait un appui de plus pour rien.
        router.push("/reglages/equipe");
        router.refresh();
      } else {
        setMessage(r.message);
      }
    });
  }

  return (
    <form
      className="px-[26px] pb-24"
      onSubmit={(e) => {
        e.preventDefault();
        creer();
      }}
    >
      <Champ etiquette="Nom" valeur={nom} onChange={setNom} autoComplete="off" />
      <Champ
        etiquette="Adresse e-mail"
        valeur={email}
        onChange={setEmail}
        type="email"
        inputMode="email"
        autoComplete="off"
      />

      <ChampSecret
        etiquette="Mot de passe"
        valeur={motDePasse}
        onChange={setMotDePasse}
        sous={`Au moins ${LONGUEUR_MINIMALE} caractères`}
      />
      <ChampSecret
        etiquette="Confirmer le mot de passe"
        valeur={confirmation}
        onChange={setConfirmation}
        sous={disent?.message}
        // Vert d'accord, rouge en désaccord : la phrase change de sens, sa
        // couleur aussi. Grise, elle se lirait comme une consigne.
        souligne={disent ? (disent.identiques ? colors.rust : colors.alert) : undefined}
      />

      <div className="mt-7">
        <ChoixRole titre valeur={role} inerte={enCours} onChoisir={setRole} />
      </div>

      {/* **LE SEUL APLAT PLEIN DE L'ÉCRAN**, et c'est tout l'objet de sa
          deuxième remarque. Les pastilles de rôle, au-dessus, sont teintées. */}
      <button
        type="submit"
        disabled={enCours}
        className="atlas-plein mt-7 flex w-full items-center justify-center rounded-full py-3.5 text-[14px] font-semibold"
        style={{ backgroundColor: colors.plein, color: surPlein, opacity: enCours ? 0.6 : 1 }}
      >
        {enCours ? "Un instant…" : "Créer le compte"}
      </button>

      <button
        type="button"
        onClick={() => router.push("/reglages/equipe")}
        className="mt-1 flex w-full items-center justify-center py-3 text-[13px]"
        style={{ color: colors.muted }}
      >
        Annuler
      </button>

      {message && (
        <p className="mt-2 text-center text-[12.5px]" style={{ color: colors.alert }} role="alert">
          {message}
        </p>
      )}
    </form>
  );
}

const STYLE_CHAMP = {
  borderBottom: `1px solid ${colors.line}`,
  color: colors.ink,
  fontFamily: font.body,
} as const;

function Champ({
  etiquette,
  valeur,
  onChange,
  ...reste
}: {
  etiquette: string;
  valeur: string;
  onChange: (v: string) => void;
  // `onChange` est OMIS du reste : le nôtre rend la valeur, celui du DOM rend
  // l'événement, et les deux ne peuvent pas porter le même nom.
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="block pt-4">
      <span className="mb-1 block text-[11px]" style={{ color: colors.muted }}>
        {etiquette}
      </span>
      <input
        // 17 px : en dessous de 16, Safari zoome à la mise au point et l'écran
        // saute sous le doigt. La leçon est déjà écrite dans `atlas-reglages-moi`.
        className="w-full bg-transparent py-2 text-[17px] outline-none"
        style={STYLE_CHAMP}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        {...reste}
      />
    </label>
  );
}

/**
 * UN MOT DE PASSE, ET SON ŒIL.
 *
 * **Sa demande du 26 août** : *« mettre le petit œil à côté du mdp pour pouvoir
 * voir ce qu'on écrit »*. C'est la même qu'il avait faite le 14 août pour son
 * propre mot de passe, et le mécanisme y est identique — **chaque champ porte
 * SON œil** : la seconde saisie ne sert à rien si l'on peut la remplir sans
 * regarder.
 *
 * **L'œil est gris au repos, or une fois ouvert.** Plein et vert, un
 * pictogramme de 21 px au bord d'un champ se lit comme un bouton d'envoi — et
 * le geste voisin doit rester le seul plein de l'écran. Ouvert, c'est un état,
 * et un état se LIT.
 */
function ChampSecret({
  etiquette,
  valeur,
  onChange,
  sous,
  souligne,
}: {
  etiquette: string;
  valeur: string;
  onChange: (v: string) => void;
  sous?: string;
  souligne?: string;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div className="pt-4">
      <span className="mb-1 block text-[11px]" style={{ color: colors.muted }}>
        {etiquette}
      </span>
      <div className="flex items-center gap-2" style={{ borderBottom: `1px solid ${colors.line}` }}>
        <input
          className="min-w-0 flex-1 bg-transparent py-2 text-[17px] outline-none"
          style={{ color: colors.ink, fontFamily: font.body }}
          type={ouvert ? "text" : "password"}
          // **`new-password`, jamais `off`.** Sans lui, le gestionnaire du
          // navigateur propose au patron SON mot de passe — et c'est celui-là
          // qui partirait dans le compte du salarié.
          autoComplete="new-password"
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-label={ouvert ? `Masquer ${etiquette.toLowerCase()}` : `Afficher ${etiquette.toLowerCase()}`}
          aria-pressed={ouvert}
          // 44 px : la cible tactile d'Atlas. Le pictogramme en fait 21.
          className="-mr-2.5 flex h-11 w-11 flex-none items-center justify-center"
          style={{ color: ouvert ? colors.or : colors.muted }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-[21px] w-[21px]"
            style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" }}
          >
            <path d="M2.4 12S6 5.8 12 5.8 21.6 12 21.6 12 18 18.2 12 18.2 2.4 12 2.4 12Z" />
            <circle cx="12" cy="12" r="3.1" />
            {ouvert && <path d="M4 20 20 4" />}
          </svg>
        </button>
      </div>
      {sous && (
        <span className="mt-1.5 block text-[11.5px]" style={{ color: souligne ?? colors.muted }}>
          {sous}
        </span>
      )}
    </div>
  );
}
