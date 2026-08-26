"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { colors, font, libelleCaps, surPlein, voile } from "@/lib/design-tokens";
import { libelleRole, type PorteePlanning, type Role } from "@/lib/acces-roles";
import { libelleSalarie } from "@/lib/equipes";
import ChoixRole from "./ChoixRole";
import { changerLaPorteeAction, changerLeRoleAction, retirerUnAccesAction } from "./actions";

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
 * montre est déjà refusé au serveur (`GardeAcces`, `exigerOuverture`,
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
  function agir(geste: () => Promise<{ ok: true } | { ok: false; message: string }>, apres?: () => void) {
    setMessage(null);
    demarrer(async () => {
      const r = await geste();
      if (r.ok) apres?.();
      else setMessage(r.message);
    });
  }

  return (
    <section className="mt-7 px-[26px]">
      <p className={`mb-1.5 ${libelleCaps}`} style={{ color: colors.muted }}>
        Qui a accès
      </p>

      <ul className="mt-1">
        {acces.map((p) => {
          const estMoi = p.utilisateurId === moi;
          return (
            <li key={p.id} style={{ borderTop: `1px solid ${colors.line}` }}>
              <button
                type="button"
                onClick={() => setOuvert(ouvert === p.id ? null : p.id)}
                className="flex w-full items-center gap-3 py-3.5 text-left"
                aria-expanded={ouvert === p.id}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]" style={{ color: colors.ink }}>
                    {estMoi ? "Vous" : (p.nom ?? p.email)}
                  </span>
                  <span className="block truncate text-[12px]" style={{ color: colors.muted }}>
                    {p.email}
                  </span>
                </span>
                <span className={libelleCaps} style={{ color: colors.muted }}>
                  {libelleRole(p.role)}
                </span>
              </button>

              {ouvert === p.id && (
                <div className="pb-4">
                  <ChoixRole
                    valeur={p.role}
                    inerte={enCours}
                    onChoisir={(role) => agir(() => changerLeRoleAction(p.id, role))}
                  />

                  {/* **Ce qu'il voit du planning : seulement pour un salarié.**
                      Un commercial voit l'application entière — lui proposer une
                      restriction laisserait croire qu'elle s'applique, et le
                      patron croirait avoir fermé quelque chose. */}
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
                      className="mt-4 text-[13px] underline underline-offset-4"
                      style={{ color: colors.alert }}
                    >
                      Retirer l&apos;accès
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* **« Donner un accès » MÈNE AILLEURS depuis le 26 août 2026** — sa
          réponse « B » sur `appli/donner-un-acces.html`.

          Le formulaire vivait ici, juste sous sa propre ligne : deux blocs de
          champs et de pastilles se suivaient, et rien ne disait où le sien
          finissait (*« la démarcation […] n'est pas bien séparée »*). Il prend
          désormais un écran entier, d'où cette liste a disparu — il n'y a plus
          rien à confondre. */}
      <Link
        href="/reglages/equipe/nouveau"
        className="flex w-full items-center gap-3 py-3.5 text-left text-[15px]"
        style={{ borderTop: `1px solid ${colors.line}`, color: colors.ink }}
      >
        <span style={{ color: colors.muted }}>+</span>
        Donner un accès
      </Link>

      {message && (
        <p className="mt-2 text-[12.5px]" style={{ color: colors.alert }} role="alert">
          {message}
        </p>
      )}
    </section>
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

  return (
    <div className="mt-4">
      <p className={`mb-2 ${libelleCaps}`} style={{ color: colors.muted }}>
        Ce qu&apos;il voit du planning
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={inerte}
          aria-pressed={portee === "tout"}
          onClick={() => portee !== "tout" && onChoisir("tout", null)}
          className="flex-1 rounded-full py-2 text-[12.5px]"
          style={
            portee === "tout"
              ? { backgroundColor: colors.ink, color: surPlein }
              : { border: `1px solid ${colors.line}`, color: colors.muted }
          }
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
          className="flex-1 rounded-full py-2 text-[12.5px]"
          style={
            portee === "ses_equipes"
              ? { backgroundColor: colors.ink, color: surPlein }
              : { border: `1px solid ${colors.line}`, color: colors.muted }
          }
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
              className="rounded-full px-3 py-1.5 text-[12px]"
              style={
                e.id === equipeId
                  ? { backgroundColor: voile(colors.ink, 0.08), color: colors.ink }
                  : { border: `1px solid ${colors.line}`, color: colors.muted }
              }
            >
              {libelleSalarie({ rang: e.rang, nom: e.nom }, nombreSalaries) ?? `Salarié ${e.rang}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
