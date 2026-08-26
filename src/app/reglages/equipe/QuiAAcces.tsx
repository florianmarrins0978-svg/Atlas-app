"use client";

import { useState, useTransition } from "react";
import { colors, font, libelleCaps, surPlein, voile } from "@/lib/design-tokens";
import { ROLES, ceQueLeRoleChange, libelleRole, type PorteePlanning, type Role } from "@/lib/acces-roles";
import { LONGUEUR_MINIMALE } from "@/lib/mot-de-passe";
import { libelleEquipe } from "@/lib/equipes";
import {
  changerLaPorteeAction,
  changerLeRoleAction,
  donnerUnAccesAction,
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
 * montre est déjà refusé au serveur (`GardeAcces`, `exigerOuverture`,
 * `exigerProprietaire`). Un bouton retiré n'a jamais fermé une adresse, et
 * `docs/QUESTIONS.md` §10 le dit d'avance.
 */
export default function QuiAAcces({
  acces,
  moi,
  equipes,
  nombreEquipes,
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
  nombreEquipes: number;
}) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);
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
                      nombreEquipes={nombreEquipes}
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

      <div style={{ borderTop: `1px solid ${colors.line}` }}>
        {ajout ? (
          <FormulaireAcces
            inerte={enCours}
            onAnnuler={() => {
              setAjout(false);
              setMessage(null);
            }}
            onValider={(saisie) => agir(() => donnerUnAccesAction(saisie), () => setAjout(false))}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setAjout(true);
              setMessage(null);
            }}
            className="flex w-full items-center gap-3 py-3.5 text-left text-[15px]"
            style={{ color: colors.ink }}
          >
            <span style={{ color: colors.muted }}>+</span>
            Donner un accès
          </button>
        )}
      </div>

      {message && (
        <p className="mt-2 text-[12.5px]" style={{ color: colors.alert }} role="alert">
          {message}
        </p>
      )}
    </section>
  );
}

/**
 * Le rôle, et ce qu'il change.
 *
 * **Les phrases viennent de `acces-roles.ts`**, avec la règle qu'elles
 * décrivent. Écrites ici, elles auraient vieilli à la première restriction
 * déplacée — et une promesse fausse sur un écran d'accès est pire que pas
 * d'écran du tout : le patron croirait avoir fermé.
 */
function ChoixRole({
  valeur,
  inerte,
  onChoisir,
}: {
  valeur: Role;
  inerte: boolean;
  onChoisir: (role: Role) => void;
}) {
  const dit = ceQueLeRoleChange(valeur);
  return (
    <>
      <div className="flex gap-2">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            disabled={inerte}
            onClick={() => r !== valeur && onChoisir(r)}
            aria-pressed={r === valeur}
            className="flex-1 rounded-full py-2 text-[12.5px]"
            style={
              r === valeur
                ? { backgroundColor: colors.ink, color: surPlein }
                : { border: `1px solid ${colors.line}`, color: colors.muted }
            }
          >
            {libelleRole(r)}
          </button>
        ))}
      </div>

      <ul className="mt-3 space-y-1">
        {dit.peut.map((l) => (
          <li key={l} className="text-[12.5px]" style={{ color: colors.ink }}>
            {l}
          </li>
        ))}
        {dit.nonPlus.map((l) => (
          <li key={l} className="text-[12.5px] line-through" style={{ color: colors.muted }}>
            {l}
          </li>
        ))}
      </ul>
    </>
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
  nombreEquipes,
  inerte,
  onChoisir,
}: {
  portee: PorteePlanning;
  equipeId: string | null;
  equipes: { id: string; rang: number; nom: string | null }[];
  nombreEquipes: number;
  inerte: boolean;
  onChoisir: (portee: PorteePlanning, equipeId: string | null) => void;
}) {
  // On ne propose que les files qui existent vraiment : le compteur de
  // l'entreprise fait autorité sur le nombre, la table ne porte que des noms.
  const proposables = equipes.filter((e) => e.rang <= nombreEquipes);

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
              {libelleEquipe({ rang: e.rang, nom: e.nom }, nombreEquipes) ?? `Équipe ${e.rang}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * DONNER UN ACCÈS — nom, adresse, rôle, et un mot de passe qu'il lui dit.
 *
 * **Pourquoi un mot de passe et pas une invitation par courriel** : Atlas
 * n'envoie aucun courriel à un utilisateur d'Atlas, et un envoi qui n'arrive pas
 * laisserait le salarié dehors sans que personne le sache. Le patron est à côté
 * de lui ; le salarié le change ensuite dans « Mon compte », qui lui est ouvert.
 * Le raisonnement complet est dans `donnerUnAcces`.
 */
function FormulaireAcces({
  inerte,
  onValider,
  onAnnuler,
}: {
  inerte: boolean;
  onValider: (saisie: { nom: string; email: string; motDePasse: string; role: Role }) => void;
  onAnnuler: () => void;
}) {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [role, setRole] = useState<Role>("salarie");

  const champ = {
    borderBottom: `1px solid ${colors.line}`,
    color: colors.ink,
    fontFamily: font.body,
  } as const;

  return (
    <form
      className="py-4"
      onSubmit={(e) => {
        e.preventDefault();
        onValider({ nom, email, motDePasse, role });
      }}
    >
      <input
        className="w-full bg-transparent py-2 text-[15px] outline-none"
        style={champ}
        placeholder="Nom"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        autoComplete="off"
      />
      <input
        className="mt-2 w-full bg-transparent py-2 text-[15px] outline-none"
        style={champ}
        placeholder="Adresse e-mail"
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="off"
      />
      <input
        className="mt-2 w-full bg-transparent py-2 text-[15px] outline-none"
        style={champ}
        // **`new-password`, jamais `off`.** Sans lui, le gestionnaire du
        // navigateur propose au patron SON mot de passe, et c'est celui-là qui
        // partirait dans le compte du salarié.
        autoComplete="new-password"
        placeholder={`Mot de passe (${LONGUEUR_MINIMALE} caractères)`}
        type="password"
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
      />

      <div className="mt-3 flex gap-2">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            aria-pressed={r === role}
            className="flex-1 rounded-full py-2 text-[12.5px]"
            style={
              r === role
                ? { backgroundColor: colors.ink, color: surPlein }
                : { border: `1px solid ${colors.line}`, color: colors.muted }
            }
          >
            {libelleRole(r)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="submit"
          disabled={inerte}
          className="rounded-full px-5 py-2.5 text-[13px]"
          style={{ backgroundColor: colors.ink, color: surPlein }}
        >
          Donner l&apos;accès
        </button>
        <button type="button" onClick={onAnnuler} className="text-[13px]" style={{ color: colors.muted }}>
          Annuler
        </button>
      </div>
    </form>
  );
}
