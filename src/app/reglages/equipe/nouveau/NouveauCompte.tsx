"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { colors, surPlein } from "@/lib/design-tokens";
import { etatConfirmation, LONGUEUR_MINIMALE } from "@/lib/mot-de-passe";
import OeilMotDePasse from "@/components/atlas/OeilMotDePasse";
import ActionBas from "@/components/atlas/reglages/ActionBas";
import LigneReglage, { styleValeurReglage } from "@/components/atlas/reglages/LigneReglage";
import Paquet from "@/components/atlas/reglages/Paquet";
import DemanderPreuve from "@/components/atlas/DemanderPreuve";
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
 * **LA PLANCHE DU 11 OCTOBRE 2026** (`appli/donner-un-acces-corrige.html`,
 * version Corrigé) : le rôle d'abord, puis « Son compte » ; des champs à fond
 * teinté de 52 px, qu'on voit au soleil et qu'on touche sans viser ; le refus
 * du serveur au-dessus du bouton. Aucune règle d'accès n'a bougé.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **LES RÉGLAGES SOIGNÉS, 26 OCTOBRE 2026** (`appli/soignee/reglages-equipe.html`) :
 * « Son rôle » et « Son compte » deviennent deux paquets aux titres dorés, et
 * les cases à fond teinté du 11 octobre prennent l'allure des autres réglages :
 * une plage claire, le libellé en toutes lettres, la valeur en serif de 18 px.
 * « Créer le compte », toujours le seul plein, se pose au-dessus de la barre.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUI NE SE DÉCIDE PAS ICI : le droit d'y être.** L'adresse est sous
 * `/reglages/equipe`, que `cheminAutorise` ferme à tout ce qui n'est pas patron
 * — et la page serveur le revérifie. Cet écran n'est qu'un dessin.
 */
export default function NouveauCompte({
  roleInitial = "salarie",
  retour = "/reglages/equipe",
}: {
  /** Le rôle déjà choisi dans l'organigramme (27 septembre 2026) : on ne le redemande pas. */
  roleInitial?: Role;
  /** Où revenir : là d'où l'on vient, l'équipe ou l'organigramme. */
  retour?: string;
}) {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [role, setRole] = useState<Role>(roleInitial);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  // Donner un accès demande une identité récente (E11) : le serveur le dit,
  // l'écran ouvre la demande puis recrée le compte tout seul.
  const [preuveDemandee, setPreuveDemandee] = useState<string | null>(null);

  const disent = etatConfirmation(motDePasse, confirmation);

  function creer() {
    setMessage(null);
    demarrer(async () => {
      const r = await donnerUnAccesAction({ nom, email, motDePasse, confirmation, role });
      if (r.ok) {
        // Retour à la liste, où il verra la ligne qu'il vient de créer. Un
        // écran de félicitations serait un appui de plus pour rien.
        router.push(retour);
        router.refresh();
      } else if (r.preuveExigee) {
        setPreuveDemandee(r.message);
      } else {
        setMessage(r.message);
      }
    });
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          creer();
        }}
      >
        {/* **LE RÔLE D'ABORD** (planche du 11 octobre 2026) : c'est la vraie
            décision de l'écran ; le nom et le mot de passe ne sont que la clé. */}
        <ChoixRole titre valeur={role} inerte={enCours} onChoisir={setRole} />

        <Paquet titre="Son compte">
          <Champ etiquette="Nom" valeur={nom} onChange={setNom} autoComplete="off" placeholder="Son prénom" />
          <Champ
            etiquette="Adresse e-mail"
            valeur={email}
            onChange={setEmail}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="nom@exemple.fr"
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
            souligne={disent ? (disent.identiques ? colors.carteVertTexte : colors.alert) : undefined}
            // Le libellé passe au rouge aussi : sous un clavier ouvert, la phrase
            // seule ne se voit pas toujours (planche du 11 octobre 2026).
            faux={disent?.identiques === false}
          />
        </Paquet>

        <button
          type="button"
          onClick={() => router.push(retour)}
          className="mx-[22px] mt-2 flex min-h-[48px] w-[calc(100%-44px)] items-center justify-center rounded-full text-[16px] font-semibold"
          style={{ color: colors.inkSoft }}
        >
          Annuler
        </button>

        {/* **LE SEUL APLAT PLEIN DE L'ÉCRAN**, et c'est tout l'objet de sa
            deuxième remarque. Les cartes de rôle, au-dessus, sont teintées. Il se
            pose au-dessus de la barre, sous le pouce (planche du 26 octobre).

            **Le refus juste AU-DESSUS du bouton** (planche du 11 octobre 2026).
            Sous « Annuler », il tombait souvent hors de l'écran : le patron
            appuyait, et rien ne semblait se passer. Collé au bouton, il se lit
            là où l'on vient d'appuyer. */}
        <ActionBas>
          {message && (
            <p className="mb-2.5 text-[14px] leading-[1.45]" style={{ color: colors.alert }} role="alert">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={enCours}
            className="atlas-plein flex min-h-[56px] w-full items-center justify-center rounded-full text-[17px] font-semibold"
            style={{ backgroundColor: colors.plein, color: surPlein, opacity: enCours ? 0.6 : 1 }}
          >
            {enCours ? "Un instant…" : "Créer le compte"}
          </button>
        </ActionBas>
      </form>

      {/* Hors du formulaire : sa feuille porte son propre bouton, qui ne doit
          pas soumettre la création. */}
      <DemanderPreuve
        ouvert={preuveDemandee !== null}
        motif={preuveDemandee ?? ""}
        onAbandon={() => setPreuveDemandee(null)}
        onProuve={() => {
          setPreuveDemandee(null);
          creer();
        }}
      />
    </>
  );
}

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
  const id = useId();
  return (
    <LigneReglage libelle={etiquette} htmlFor={id}>
      {/* 18 px : en dessous de 16, Safari zoome à la mise au point et l'écran
          saute sous le doigt. La leçon est déjà écrite dans `atlas-reglages-moi`. */}
      <input
        id={id}
        style={{ ...styleValeurReglage, caretColor: colors.or }}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        {...reste}
      />
    </LigneReglage>
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
  faux = false,
}: {
  etiquette: string;
  valeur: string;
  onChange: (v: string) => void;
  sous?: string;
  souligne?: string;
  faux?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const id = useId();

  return (
    <LigneReglage
      libelle={faux ? <span style={{ color: colors.alert }}>{etiquette}</span> : etiquette}
      htmlFor={id}
      sous={
        sous ? (
          <span style={{ color: souligne ?? colors.inkSoft, fontWeight: souligne ? 600 : 400 }}>{sous}</span>
        ) : undefined
      }
    >
      <span className="-my-1.5 -mr-2.5 flex items-center gap-2">
        <input
          id={id}
          className="min-w-0 flex-1"
          style={{ ...styleValeurReglage, caretColor: colors.or }}
          type={ouvert ? "text" : "password"}
          // **`new-password`, jamais `off`.** Sans lui, le gestionnaire du
          // navigateur propose au patron SON mot de passe — et c'est celui-là
          // qui partirait dans le compte du salarié.
          autoComplete="new-password"
          aria-label={etiquette}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
        />
        <OeilMotDePasse
          ouvert={ouvert}
          onBasculer={() => setOuvert((o) => !o)}
          quoi={etiquette.toLowerCase()}
          couleur={colors.inkSoft}
          couleurOuvert={colors.or}
        />
      </span>
    </LigneReglage>
  );
}
