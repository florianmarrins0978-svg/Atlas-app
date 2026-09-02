"use client";

import { useState, useTransition } from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import type { EtatAgendaApple } from "@/server/repositories/agenda-apple";
import {
  basculerAppleAction,
  debrancherAppleAction,
  listerAgendasAppleAction,
  reglerEcritureAppleAction,
  relierAppleAction,
  resynchroniserAppleAction,
  type AgendaProposé,
} from "./actions";

/**
 * « Mon agenda iCloud » — relier, lire, et décider d'écrire.
 *
 * **Écrit d'après `maquettes/atlas-agenda-apple.html`**, montrée au patron le
 * 12 août 2026 puis validée par *« code pour qu'on puisse lire et écrire dans
 * cet agenda »*. Deux règles y sont tenues, et ce ne sont pas des préférences
 * d'affichage :
 *
 * 1. **On prévient AVANT de faire taper.** Le mot de passe pour les apps ouvre
 *    tout l'iCloud — mail, contacts, fichiers — parce qu'Apple ne sait pas le
 *    restreindre à un service. L'avertissement est donc au-dessus du champ :
 *    prévenir après la frappe, c'est prévenir trop tard.
 * 2. **Écrire est une décision.** L'interrupteur est éteint tant qu'il ne l'a
 *    pas allumé, et le choix du calendrier n'existe pas avant. Proposer où
 *    écrire à quelqu'un qui n'a pas dit qu'il voulait qu'on écrive lui ferait
 *    croire que c'est déjà parti.
 */
export default function AgendaAppleClient({ etat }: { etat: EtatAgendaApple }) {
  const [enCours, demarrer] = useTransition();
  const [compte, setCompte] = useState(etat.compte ?? "");
  const [motDePasse, setMotDePasse] = useState("");
  const [motif, setMotif] = useState<string | null>(null);
  const [dit, setDit] = useState<string | null>(null);
  const [agendas, setAgendas] = useState<AgendaProposé[] | null>(null);
  const [confirmation, setConfirmation] = useState(false);

  const recharger = () => window.location.reload();

  const relier = () =>
    demarrer(async () => {
      setMotif(null);
      const r = await relierAppleAction({ compte, motDePasse });
      if (!r.ok) return setMotif(r.motif);
      // Le mot de passe quitte l'écran dès qu'il a servi : ces écrans se
      // remplissent souvent à deux, ou en visio avec quelqu'un qui aide.
      setMotDePasse("");
      recharger();
    });

  const ouvrirLeChoix = () =>
    demarrer(async () => {
      setMotif(null);
      const r = await listerAgendasAppleAction();
      if (!r.ok) return setMotif(r.motif);
      setAgendas(r.agendas);
    });

  const allumerLEcriture = (calendrier: AgendaProposé) =>
    demarrer(async () => {
      setMotif(null);
      const r = await reglerEcritureAppleAction({
        active: true,
        calendrier: { href: calendrier.href, nom: calendrier.nom },
      });
      if (!r.ok) return setMotif(r.motif);
      recharger();
    });

  const eteindreLEcriture = () =>
    demarrer(async () => {
      const r = await reglerEcritureAppleAction({ active: false });
      if (!r.ok) return setMotif(r.motif);
      recharger();
    });

  const renvoyer = () =>
    demarrer(async () => {
      setMotif(null);
      setDit(null);
      const r = await resynchroniserAppleAction();
      if (!r.ok) return setMotif(r.motif);
      setDit(
        r.poses === 0
          ? "Aucun chantier planifié à envoyer."
          : `${r.poses} chantier${r.poses > 1 ? "s" : ""} renvoyé${r.poses > 1 ? "s" : ""} dans votre agenda.`
      );
    });

  const debrancher = () =>
    demarrer(async () => {
      const r = await debrancherAppleAction();
      if (r.restes) {
        // **Taire des restes serait mentir sur un ménage qui n'a pas eu lieu.**
        // Il les découvrirait dans son téléphone un mois plus tard, sans savoir
        // d'où ils viennent ni comment les retirer.
        setMotif(
          `Le compte est débranché, mais Atlas n'a pas pu retirer ses rendez-vous de votre agenda : ${r.restes}. Ils sont à supprimer depuis le Calendrier.`
        );
        setConfirmation(false);
        return;
      }
      recharger();
    });

  return (
    <div className="px-6 pt-8">
      <p className="text-[11px] uppercase tracking-[0.28em]" style={{ color: colors.or, marginBottom: 10 }}>
        iCloud
      </p>

      {/* --- L'état, en une phrase, avant toute commande ------------------ */}
      <section className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.rustTint }}>
        <p className="text-[18px] leading-snug" style={{ fontFamily: font.display }}>
          {titre(etat)}
        </p>

        {etat.compte && (
          <p className="mt-1 text-[14px]" style={{ color: colors.muted }}>
            Compte : {etat.compte}
          </p>
        )}

        {!etat.relie && (
          <p className="mt-3 text-[14px] leading-snug" style={{ color: colors.muted }}>
            Sans agenda relié, Atlas propose des dates à partir de vos seuls chantiers. Ce qui est noté
            ailleurs lui reste invisible.
          </p>
        )}

        {etat.relie && etat.actif && !etat.derniereErreur && (
          <p className="mt-3 text-[14px] leading-snug" style={{ color: colors.muted }}>
            Une demi-journée prise dans votre agenda <strong>ne sera plus proposée</strong>{" à vos clients. Ce"}{" "}
            qu&apos;ils voient, ce sont des dates — jamais le titre d&apos;un rendez-vous.
          </p>
        )}

        {/* La panne se voit, elle ne se tait pas. Sans cette ligne, l'artisan
            croirait son agenda pris en compte alors qu'Atlas est revenu, en
            silence, au comportement qui produisait des doublons. */}
        {etat.derniereErreur && (
          <p
            className="mt-4 rounded-[4px] px-4 py-3 text-[13px] leading-snug"
            style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}` }}
          >
            <strong>Atlas n&apos;arrive plus à lire votre agenda.</strong>{" En attendant, il propose des dates"}{" "}
            à partir de vos seuls chantiers — donc un doublon reste possible.
            <span className="mt-2 block" style={{ color: colors.muted }}>
              Détail : {etat.derniereErreur}
            </span>
          </p>
        )}

        {etat.derniereLectureAt && !etat.derniereErreur && (
          <p className="mt-3 text-[13px]" style={{ color: colors.muted }}>
            Dernière lecture : {new Date(etat.derniereLectureAt).toLocaleString("fr-FR")}
          </p>
        )}
      </section>

      {motif && (
        <p
          role="alert"
          className="mt-4 rounded-[4px] px-4 py-3 text-[13px] leading-snug"
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}` }}
        >
          {motif}
        </p>
      )}
      {dit && !motif && (
        <p className="mt-4 text-[13px]" style={{ color: colors.rust }}>
          {dit}
        </p>
      )}

      {/* --- Relier : l'avertissement, puis les gestes, puis les champs --- */}
      {!etat.relie && (
        <section className="mt-5">
          {/*
            **AU-DESSUS du champ, et cet ordre EST la règle.** Ce mot de passe
            ouvre tout l'iCloud, Apple ne sachant pas le restreindre à un
            service. Le déplacer sous la saisie ferait lire l'avertissement à
            quelqu'un qui a déjà tapé.
          */}
          <p
            className="rounded-[4px] px-4 py-3 text-[13px] leading-snug"
            style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}` }}
          >
            <strong>Ce mot de passe ouvre tout votre iCloud</strong>{" — pas seulement l'agenda."}
            <span className="mt-2 block" style={{ color: colors.muted }}>
              Apple ne sait pas le restreindre. Atlas le garde chiffré, et vous pouvez l&apos;annuler à tout
              moment depuis votre compte Apple.
            </span>
          </p>

          <ol className="mt-4 list-decimal pl-6 text-[13.5px] leading-relaxed" style={{ color: colors.muted }}>
            <li>
              Sur <strong style={{ color: colors.ink }}>account.apple.com</strong>, ouvrez{" "}
              <strong style={{ color: colors.ink }}>Connexion et sécurité</strong>.
            </li>
            <li>
              <strong style={{ color: colors.ink }}>Mots de passe pour les apps</strong>, puis{" "}
              <strong style={{ color: colors.ink }}>Générer</strong>.
            </li>
            <li>Recopiez les seize lettres ci-dessous.</li>
          </ol>

          <div className="mt-4">
            <Champ
              libelle="Votre adresse iCloud"
              valeur={compte}
              onChange={setCompte}
              exemple="prenom@icloud.com"
            />
            <Champ
              libelle="Mot de passe pour les apps"
              valeur={motDePasse}
              onChange={setMotDePasse}
              exemple="abcd-efgh-ijkl-mnop"
              masque
            />
          </div>

          <button
            type="button"
            disabled={enCours}
            onClick={relier}
            className="atlas-plein w-full rounded-full px-5 py-3 text-[15px] font-medium"
            style={{ backgroundColor: colors.rust, color: surPlein, opacity: enCours ? 0.6 : 1 }}
          >
            {enCours ? "Connexion à Apple…" : "Relier mon agenda Apple"}
          </button>
        </section>
      )}

      {/* --- Dans l'autre sens : écrire ----------------------------------- */}
      {etat.relie && (
        <section className="mt-6">
          <p className="text-[11px] uppercase tracking-[0.28em]" style={{ color: colors.or, marginBottom: 10 }}>
            Dans l&apos;autre sens
          </p>

          <div className="rounded-[4px] px-5 py-4" style={{ backgroundColor: colors.rustTint }}>
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">Écrire mes chantiers dans mon agenda</p>
                <p className="mt-1 text-[13px] leading-snug" style={{ color: colors.muted }}>
                  {etat.ecritureActive && etat.calendrierEcritureNom
                    ? `Ils s'ajoutent au calendrier « ${etat.calendrierEcritureNom} ». Éteindre les en retire.`
                    : "Ils apparaîtront dans le Calendrier, comme vos autres rendez-vous."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={etat.ecritureActive}
                aria-label="Écrire mes chantiers dans mon agenda"
                disabled={enCours}
                onClick={() => (etat.ecritureActive ? eteindreLEcriture() : ouvrirLeChoix())}
                className="relative h-8 w-[52px] flex-none rounded-full"
                style={{
                  backgroundColor: etat.ecritureActive ? colors.rust : voile(colors.ink, 0.18),
                  opacity: enCours ? 0.6 : 1,
                }}
              >
                <span
                  className="absolute top-[3px] block h-[26px] w-[26px] rounded-full"
                  style={{
                    left: etat.ecritureActive ? 23 : 3,
                    backgroundColor: colors.card,
                    boxShadow: "0 1px 3px rgba(20,18,14,.28)",
                    transition: "left .22s",
                  }}
                />
              </button>
            </div>

            {/* Le choix n'existe QUE quand on vient de l'ouvrir : la liste est
                redemandée à Apple, jamais devinée d'après un état ancien. */}
            {agendas && !etat.ecritureActive && (
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.28em]" style={{ color: colors.muted }}>
                  Dans quel calendrier
                </p>
                <div className="mt-2">
                  {agendas.map((a) => (
                    <button
                      key={a.href}
                      type="button"
                      disabled={enCours || !a.inscriptible}
                      onClick={() => allumerLEcriture(a)}
                      className="flex w-full items-center gap-3 rounded-full px-2 py-3 text-left"
                      style={{ opacity: a.inscriptible ? 1 : 0.45 }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px]">{a.nom}</span>
                        {!a.inscriptible && (
                          <span className="block text-[12.5px]" style={{ color: colors.muted }}>
                            Partagé en lecture seule — Atlas ne peut pas y écrire
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
                <p
                  className="mt-3 rounded-[4px] px-4 py-3 text-[13px] leading-snug"
                  style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.or}` }}
                >
                  <strong>Atlas ne touche jamais un rendez-vous qu&apos;il n&apos;a pas posé.</strong>{" Ceux"}{" "}
                  qu&apos;il a écrits se retirent tous d&apos;un geste, le jour où vous débranchez.
                </p>
              </div>
            )}

            {etat.derniereErreurEcriture && (
              <p
                className="mt-4 rounded-[4px] px-4 py-3 text-[13px] leading-snug"
                style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}` }}
              >
                <strong>Le dernier chantier n&apos;a pas pu être écrit.</strong>{" Votre agenda n'est donc"}{" "}
                pas à jour.
                <span className="mt-2 block" style={{ color: colors.muted }}>
                  Détail : {etat.derniereErreurEcriture}
                </span>
              </p>
            )}
          </div>

          {etat.ecritureActive && (
            <button
              type="button"
              disabled={enCours}
              onClick={renvoyer}
              className="mt-3 w-full rounded-full px-5 py-3 text-[15px] font-medium"
              style={{ backgroundColor: colors.rustTint, color: colors.rust, opacity: enCours ? 0.6 : 1 }}
            >
              Renvoyer mes chantiers dans l&apos;agenda
            </button>
          )}
        </section>
      )}

      {/* --- Les commandes ------------------------------------------------ */}
      {etat.relie && (
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            disabled={enCours}
            onClick={() => demarrer(async () => { await basculerAppleAction(!etat.actif); recharger(); })}
            className="rounded-full px-5 py-3 text-[15px] font-medium"
            style={{ backgroundColor: colors.rustTint, color: colors.rust, opacity: enCours ? 0.6 : 1 }}
          >
            {etat.actif ? "Mettre en pause" : "Reprendre la lecture"}
          </button>

          {!confirmation && (
            <button
              type="button"
              onClick={() => setConfirmation(true)}
              className="rounded-full px-5 py-2 text-[14px] font-medium"
              style={{ color: colors.muted }}
            >
              Débrancher et effacer
            </button>
          )}

          {/* Une suppression se confirme. Elle efface un mot de passe qu'il
              faudra régénérer chez Apple, et un doigt qui glisse sur un
              téléphone ne doit pas coûter ça. */}
          {confirmation && (
            <div
              className="rounded-[4px] px-4 py-4"
              style={{ backgroundColor: colors.rustTint, borderLeft: `3px solid ${colors.alert}` }}
            >
              <p className="text-[14px] leading-snug">
                Atlas retirera de votre agenda les rendez-vous qu&apos;il y a posés, puis oubliera ce
                raccordement. Vos autres rendez-vous ne sont pas touchés.
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  disabled={enCours}
                  onClick={debrancher}
                  className="rounded-full px-4 py-2 text-[14px] font-medium"
                  style={{ backgroundColor: colors.alert, color: surPlein, opacity: enCours ? 0.6 : 1 }}
                >
                  Débrancher
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmation(false)}
                  className="rounded-full px-4 py-2 text-[14px] font-medium"
                  style={{ color: colors.muted }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Ce que l'écran annonce en titre.
 *
 * **L'ordre des cas EST la règle** : la panne prime sur la pause, qui prime sur
 * le fonctionnement nominal. L'écran de Google avait démenti son propre titre
 * trois lignes plus bas parce que la panne était traitée en dernier, donc
 * jamais (`src/lib/agenda-externe.ts`).
 */
function titre(etat: EtatAgendaApple): string {
  if (!etat.relie) return "Aucun agenda iCloud relié";
  if (etat.derniereErreur) return "Votre agenda n'est plus lu";
  if (!etat.actif) return "Agenda relié, mais en pause";
  return "Atlas tient compte de votre agenda";
}

function Champ({
  libelle,
  valeur,
  onChange,
  exemple,
  masque = false,
}: {
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  exemple: string;
  masque?: boolean;
}) {
  return (
    <label className="mb-3 block" style={{ cursor: "pointer" }}>
      <span className="block text-[13px]" style={{ color: colors.muted, marginBottom: 4 }}>
        {libelle}
      </span>
      {/* 16 px de corps au minimum : en dessous, iOS agrandit la page dès que le
          champ prend le focus, et l'écran part de travers sous son doigt. */}
      <input
        type={masque ? "password" : "text"}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={exemple}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="w-full rounded-[4px] px-4 py-3 text-[16px]"
        style={{ backgroundColor: colors.card, color: colors.ink, border: `1px solid ${colors.line}` }}
      />
    </label>
  );
}
