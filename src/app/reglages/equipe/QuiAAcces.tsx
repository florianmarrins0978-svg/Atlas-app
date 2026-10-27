"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { colors, font, voile } from "@/lib/design-tokens";
import { libelleRole, type PorteePlanning, type Role } from "@/lib/acces-roles";
import { libelleSalarie, salariesAffiches } from "@/lib/equipes";
import TeteRonde from "@/components/atlas/TeteRonde";
import DemanderPreuve from "@/components/atlas/DemanderPreuve";
import Paquet from "@/components/atlas/reglages/Paquet";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import ChoixRole from "./ChoixRole";
import Picto from "@/components/atlas/reglages/Picto";
import {
  changerLaPorteeAction,
  changerLeRoleAction,
  relierAuSalarieAction,
  retirerUnAccesAction,
} from "./actions";

/**
 * « QUI A ACCÈS » — la liste des comptes de l'entreprise, et ce que chacun peut.
 *
 * *Dessiné le 13 août 2026 (`maquettes/atlas-reglages-equipe.html`), codé le
 * 25 août.*
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **DEUX LISTES SUR CET ÉCRAN, ET PAS UNE.** Celle-ci porte des COMPTES ; celle
 * d'en dessous porte des FILES DU PLANNING. Dans Atlas, une « équipe » n'est pas
 * un groupe de personnes : « Équipe B » peut désigner deux ouvriers qui
 * n'ouvriront jamais l'application, et un commercial a un compte sans conduire
 * aucun chantier. Les confondre ferait chercher un salarié dans la mauvaise
 * liste — c'est pourquoi elles sont séparées, et nommées différemment.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CE QUE CET ÉCRAN NE FAIT PAS : garder quoi que ce soit.** Tout ce qu'il
 * montre est déjà refusé au serveur (`garderLaPage`, `exigerOuverture`,
 * `exigerProprietaire`). Un bouton retiré n'a jamais fermé une adresse, et
 * `docs/QUESTIONS.md` §10 le dit d'avance.
 */
export default function QuiAAcces({
  acces,
  moi,
  equipes,
  nombreSalaries,
}: {
  acces: {
    id: string;
    utilisateurId: string;
    nom: string | null;
    email: string;
    role: Role;
    porteePlanning: PorteePlanning;
    equipeId: string | null;
    salarieRang: number | null;
    photo: string | null;
  }[];
  /** L'id du compte connecté : « Vous », et le seul qu'on ne peut pas retirer. */
  moi: string;
  equipes: { id: string; rang: number; nom: string | null }[];
  nombreSalaries: number;
}) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // **Une seule fonction pour les quatre gestes.** Chacune rend le même couple
  // — c'est fait pour : un refus se lit toujours au même endroit, et l'écran n'a
  // pas quatre façons de dire « non ».
  // Changer un rôle et retirer un accès demandent une identité récente (E11) :
  // le SERVEUR le dit, l'écran ouvre la demande puis rejoue le même geste.
  const [preuveDemandee, setPreuveDemandee] = useState<{ motif: string; reprendre: () => void } | null>(null);

  function agir(
    geste: () => Promise<{ ok: true } | { ok: false; message: string; preuveExigee?: true }>,
    apres?: () => void
  ) {
    setMessage(null);
    demarrer(async () => {
      const r = await geste();
      if (r.ok) apres?.();
      else if (r.preuveExigee) setPreuveDemandee({ motif: r.message, reprendre: () => agir(geste, apres) });
      else setMessage(r.message);
    });
  }

  return (
    <Paquet titre="Accès">
      <ul>
        {acces.map((p) => {
          const estMoi = p.utilisateurId === moi;
          const ouverte = ouvert === p.id;
          return (
            <li key={p.id} className="relative">
              <Filet />
              <button
                type="button"
                onClick={() => setOuvert(ouverte ? null : p.id)}
                className="flex min-h-[68px] w-full items-center gap-3.5 py-3 text-left"
                aria-expanded={ouverte}
              >
                {/* **Sa tête** (27 septembre 2026) : chacun la pose dans Mon
                    compte. Sans photo, le numéro de son nom s'il est relié,
                    sinon son initiale. */}
                <TeteRonde
                  repli={p.salarieRang ?? (p.nom ?? p.email).trim().charAt(0).toUpperCase()}
                  photo={p.photo}
                  taille={44}
                />
                <span className="min-w-0 flex-1">
                  {/* **Le rôle dans une pastille, sur la ligne du nom** (planche
                      du 26 octobre 2026) : il se lit d'un coup d'œil, et
                      Patron, en or, se distingue des trois autres. */}
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className="min-w-0 truncate text-[18px] font-semibold leading-[1.25]"
                      style={{ fontFamily: font.display, color: colors.ink }}
                    >
                      {estMoi ? "Vous" : (p.nom ?? p.email)}
                    </span>
                    <PastilleRole role={p.role} />
                  </span>
                  <span className="mt-[3px] block truncate text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                    {p.email}
                  </span>
                </span>
                {/* **Le compte s'ouvre SOUS sa ligne, comme avant.** La planche
                    du 26 octobre proposait une page à lui ; il n'a pas encore
                    tranché. Le chevron tourne vers le bas quand la ligne est
                    ouverte : il dit où se trouve ce qu'on vient d'ouvrir. */}
                <span
                  className="flex-none transition-transform duration-200"
                  style={{ color: colors.or, transform: ouverte ? "rotate(90deg)" : "none" }}
                >
                  <Picto nom="suivant" taille={20} epaisseur={2} />
                </span>
              </button>

              {ouverte && (
                // **Ce qui s'ouvre se pose sur le fond de la page**, toute la
                // largeur de la plage : c'est la page du compte de la planche,
                // glissée sous sa ligne. Sa remarque du 26 août, *« la
                // démarcation n'est pas bien séparée »*, vaut aussi ici : on
                // voit où ce compte commence et où il finit.
                <div className="-mx-[18px] px-[18px] pb-5 pt-4" style={{ backgroundColor: colors.cream }}>
                  <ChoixRole
                    valeur={p.role}
                    inerte={enCours}
                    onChoisir={(role) => agir(() => changerLeRoleAction(p.id, role))}
                  />

                  {/* **Ce qu'il voit du planning : seulement pour un salarié.**
                      Un commercial voit l'application entière — lui proposer une
                      restriction laisserait croire qu'elle s'applique, et le
                      patron croirait avoir fermé quelque chose. */}
                  {nombreSalaries > 0 && (
                    <ChoixSalarie
                      rang={p.salarieRang}
                      noms={salariesAffiches(equipes, nombreSalaries)}
                      nombreSalaries={nombreSalaries}
                      inerte={enCours}
                      onChoisir={(rang) => agir(() => relierAuSalarieAction(p.id, rang))}
                    />
                  )}

                  {p.role === "salarie" && (
                    <ChoixPortee
                      portee={p.porteePlanning}
                      equipeId={p.equipeId}
                      equipes={equipes}
                      nombreSalaries={nombreSalaries}
                      inerte={enCours}
                      onChoisir={(portee, equipeId) =>
                        agir(() => changerLaPorteeAction(p.id, portee, equipeId))
                      }
                    />
                  )}

                  {/* **On ne se retire pas soi-même**, et le bouton n'est donc
                      pas dessiné : le griser inviterait à l'appuyer pour lire
                      pourquoi. Le serveur refuse de toute façon. */}
                  {!estMoi && (
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={() => agir(() => retirerUnAccesAction(p.id), () => setOuvert(null))}
                      className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold"
                      style={{ color: colors.alert }}
                    >
                      <Picto nom="croix" taille={20} />
                      Retirer l&apos;accès
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}

        {/* **« Donner un accès » MÈNE AILLEURS depuis le 26 août 2026** — sa
            réponse « B » sur `appli/donner-un-acces.html`.

            Le formulaire vivait ici, juste sous sa propre ligne : deux blocs de
            champs et de pastilles se suivaient, et rien ne disait où le sien
            finissait (*« la démarcation […] n'est pas bien séparée »*). Il prend
            désormais un écran entier, d'où cette liste a disparu — il n'y a plus
            rien à confondre. */}
        <li className="relative">
          <Filet />
          <Link
            href="/reglages/equipe/nouveau"
            className="flex min-h-[68px] w-full items-center gap-3.5 py-3 text-left"
          >
            <PastilleIcone>
              <Picto nom="plus" />
            </PastilleIcone>
            <span className="min-w-0 flex-1 text-[17px] font-semibold" style={{ color: colors.or }}>
              Donner un accès
            </span>
            <span className="flex-none" style={{ color: colors.or }}>
              <Picto nom="suivant" taille={20} epaisseur={2} />
            </span>
          </Link>
        </li>
      </ul>

      {message && (
        <p className="pb-3.5 text-[14px] leading-[1.45]" style={{ color: colors.alert }} role="alert">
          {message}
        </p>
      )}

      <DemanderPreuve
        ouvert={preuveDemandee !== null}
        motif={preuveDemandee?.motif ?? ""}
        onAbandon={() => setPreuveDemandee(null)}
        onProuve={() => {
          const reprendre = preuveDemandee?.reprendre;
          setPreuveDemandee(null);
          reprendre?.();
        }}
      />
    </Paquet>
  );
}

/** Le filet entre deux lignes de la plage ; le paquet rogne celui de la première. */
function Filet() {
  return <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />;
}

/**
 * Le rôle d'un compte, un point et un mot : jamais la couleur seule. Patron en
 * or, cerné d'un fil doré ; les trois autres sur un voile discret.
 */
function PastilleRole({ role }: { role: Role }) {
  const patron = role === "proprietaire";
  return (
    <span
      className="inline-flex min-h-[28px] flex-none items-center gap-[7px] whitespace-nowrap rounded-full px-[11px] text-[13.5px] font-semibold leading-none"
      style={
        patron
          ? { color: colors.or, boxShadow: `inset 0 0 0 1px ${voile(colors.or, 0.6)}` }
          : { color: colors.inkSoft, backgroundColor: voile(colors.ink, 0.06) }
      }
    >
      <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full" style={{ backgroundColor: "currentColor" }} />
      {libelleRole(role)}
    </span>
  );
}

/** Le petit libellé d'un réglage du compte, en toutes lettres (planche du 26 octobre). */
function SousTitre({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 mt-[22px] text-[14px] font-semibold" style={{ color: colors.inkSoft }}>
      {children}
    </p>
  );
}

/** Une pastille de choix : teintée et cernée de l'encre d'action quand elle est prise. */
function stylePastille(choisie: boolean): React.CSSProperties {
  return choisie
    ? { backgroundColor: colors.rustTint, color: colors.ink, boxShadow: `inset 0 0 0 2px ${colors.rust}` }
    : { color: colors.inkSoft, boxShadow: `inset 0 0 0 1px ${colors.line}` };
}

const PASTILLE = "min-h-[44px] rounded-full px-4 text-[15px] font-semibold";

/**
 * C'EST QUI ? Le nom de salarié que ce compte EST, relié une fois par le
 * patron : sa réponse du 27 septembre 2026. Ensuite, la photo que la personne
 * pose dans Mon compte s'affiche partout sous ce nom.
 *
 * **« Personne » est un choix, pas un oubli** : un commercial n'est aucun des
 * gars du chantier, et sa photo reste sur son compte.
 */
function ChoixSalarie({
  rang,
  noms,
  nombreSalaries,
  inerte,
  onChoisir,
}: {
  rang: number | null;
  noms: { rang: number; nom?: string | null }[];
  nombreSalaries: number;
  inerte: boolean;
  onChoisir: (rang: number | null) => void;
}) {
  return (
    <div data-atlas="c-est-qui">
      <SousTitre>C&apos;est qui&nbsp;?</SousTitre>
      <div className="flex flex-wrap gap-2">
        {noms.map((e) => (
          <button
            key={e.rang}
            type="button"
            disabled={inerte}
            aria-pressed={e.rang === rang}
            onClick={() => e.rang !== rang && onChoisir(e.rang)}
            className={PASTILLE}
            style={stylePastille(e.rang === rang)}
          >
            {libelleSalarie({ rang: e.rang, nom: e.nom ?? null }, nombreSalaries) ?? `Salarié ${e.rang}`}
          </button>
        ))}
        <button
          type="button"
          disabled={inerte}
          aria-pressed={rang === null}
          onClick={() => rang !== null && onChoisir(null)}
          className={PASTILLE}
          style={stylePastille(rang === null)}
        >
          Personne
        </button>
      </div>
    </div>
  );
}

/**
 * Ce qu'il voit du planning : tout, ou son équipe.
 *
 * **Le choix « son équipe » demande LAQUELLE, et le serveur refuse sans.** Une
 * portée resserrée sans file rattachée ne montrerait rien : le patron croirait
 * avoir restreint alors qu'il aurait effacé (`donner-un-acces.ts`).
 */
function ChoixPortee({
  portee,
  equipeId,
  equipes,
  nombreSalaries,
  inerte,
  onChoisir,
}: {
  portee: PorteePlanning;
  equipeId: string | null;
  equipes: { id: string; rang: number; nom: string | null }[];
  nombreSalaries: number;
  inerte: boolean;
  onChoisir: (portee: PorteePlanning, equipeId: string | null) => void;
}) {
  // On ne propose que les files qui existent vraiment : le compteur de
  // l'entreprise fait autorité sur le nombre, la table ne porte que des noms.
  const proposables = equipes.filter((e) => e.rang <= nombreSalaries);

  // **Deux mots dans un même rail** (planche du 26 octobre 2026) : le mot pris
  // se pose sur la plage claire. Il était peint en encre pleine, l'allure du
  // bouton qui agit, alors qu'il ne fait que dire un état.
  const segment = (pris: boolean): React.CSSProperties =>
    pris
      ? { backgroundColor: colors.card, color: colors.ink, boxShadow: `0 1px 2px ${voile(colors.ink, 0.14)}` }
      : { color: colors.inkSoft };

  return (
    <div>
      <SousTitre>Ce qu&apos;il voit du planning</SousTitre>
      <div className="flex gap-1 rounded-full p-1" style={{ backgroundColor: voile(colors.ink, 0.06) }}>
        <button
          type="button"
          disabled={inerte}
          aria-pressed={portee === "tout"}
          onClick={() => portee !== "tout" && onChoisir("tout", null)}
          className="min-h-[44px] flex-1 rounded-full px-2.5 text-[15px] font-semibold transition-colors duration-200"
          style={segment(portee === "tout")}
        >
          Tout le planning
        </button>
        <button
          type="button"
          disabled={inerte || proposables.length === 0}
          aria-pressed={portee === "ses_equipes"}
          onClick={() =>
            portee !== "ses_equipes" && onChoisir("ses_equipes", equipeId ?? proposables[0]?.id ?? null)
          }
          className="min-h-[44px] flex-1 rounded-full px-2.5 text-[15px] font-semibold transition-colors duration-200"
          style={segment(portee === "ses_equipes")}
        >
          Son équipe
        </button>
      </div>

      {portee === "ses_equipes" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {proposables.map((e) => (
            <button
              key={e.id}
              type="button"
              disabled={inerte}
              aria-pressed={e.id === equipeId}
              onClick={() => onChoisir("ses_equipes", e.id)}
              className={PASTILLE}
              style={stylePastille(e.id === equipeId)}
            >
              {libelleSalarie({ rang: e.rang, nom: e.nom }, nombreSalaries) ?? `Salarié ${e.rang}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
