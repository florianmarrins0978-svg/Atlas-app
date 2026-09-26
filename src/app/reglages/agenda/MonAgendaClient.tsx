"use client";

import { useState, useTransition } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { motsDeLAgenda, type MotsDeLAgenda } from "@/lib/agenda-externe";
import type { EtatAgenda } from "@/server/repositories/agendas-externes";
import type { EtatAgendaApple } from "@/server/repositories/agenda-apple";
import {
  basculerAgendaAction,
  basculerAppleAction,
  debrancherAgendaAction,
  debrancherAppleAction,
  demarrerRaccordementAction,
  enregistrerIdentifiantsAction,
  listerAgendasAppleAction,
  reglerEcritureAppleAction,
  relierAppleAction,
  resynchroniserAppleAction,
  type AgendaProposé,
} from "./actions";

/**
 * « Mon agenda » : une ligne par agenda, son état en deux mots, un bouton.
 *
 * **Sa demande du 26 septembre 2026, capture à l'appui** (Google en panne) :
 * *« trop de mots, trop compliqué, il faut qu'elle soit hyper simple »*. Son
 * choix : la proposition A de `appli/mon-agenda-simple.html`. L'écran d'avant
 * portait une vingtaine de lignes, le message de Google en JSON et cinq boutons
 * avant de savoir quoi faire.
 *
 * **Ce qui n'a pas bougé, parce que ce sont des règles et pas du texte :**
 *
 * 1. **la panne se voit** : « Ne se lit plus », en rouge, sur la ligne. Un
 *    raccordement mort en silence est pire que pas de raccordement du tout ;
 * 2. **l'avertissement iCloud est AU-DESSUS du mot de passe** : ce mot de passe
 *    ouvre tout l'iCloud, prévenir après la frappe est prévenir trop tard ;
 * 3. **écrire dans iCloud est une décision** : l'interrupteur est éteint tant
 *    qu'il ne l'a pas allumé, et le choix du calendrier n'existe pas avant ;
 * 4. **débrancher se confirme** : un doigt qui glisse ne doit pas coûter un
 *    mot de passe à régénérer chez Apple.
 *
 * **Les identifiants Google ne se montrent QUE s'il n'y en a aucun.** Sa
 * décision du même jour : Atlas portera les siens sur le serveur
 * (`configurationGoogle`), et personne n'aura rien à coller. Mais tant que ce
 * n'est pas fait, « Débrancher » efface aussi ceux qu'il a saisis
 * (`debrancherAgenda` supprime la ligne) : retirer la saisie l'aurait empêché
 * de jamais se rebrancher. Elle vit donc dans le volet « Relier », et n'y
 * apparaît que quand rien d'autre ne permet de relier.
 */

const RETOURS: Record<string, { ton: "bien" | "mal"; texte: string }> = {
  relie: { ton: "bien", texte: "Agenda Google relié." },
  refus: { ton: "mal", texte: "Annulé chez Google. Rien n'a changé." },
  etat: { ton: "mal", texte: "Le retour de Google n'a pas pu être vérifié. Recommencez." },
  non_configure: { ton: "mal", texte: "Atlas n'a pas encore d'identifiants Google." },
  echec: { ton: "mal", texte: "Google a refusé. Rien n'a été relié, vous pouvez réessayer." },
  identifiants: { ton: "bien", texte: "Identifiants enregistrés. Il reste à relier." },
};

type Volet = null | "gerer-google" | "gerer-icloud" | "relier-icloud" | "identifiants-google";

export default function MonAgendaClient({
  google,
  apple,
  issue,
}: {
  google: EtatAgenda;
  apple: EtatAgendaApple;
  issue: string | null;
}) {
  const [enCours, demarrer] = useTransition();
  const [volet, setVolet] = useState<Volet>(null);
  const [motif, setMotif] = useState<string | null>(null);
  const retour = issue ? RETOURS[issue] ?? null : null;

  const ouvrir = (v: Volet) => {
    setMotif(null);
    setVolet(v);
  };
  const recharger = () => window.location.reload();

  // Relier et rebrancher Google, c'est le même geste : la page d'accord de
  // Google. Sans identifiants, il n'y a pas de page où aller ; le seul geste
  // utile est alors de les coller.
  const relierGoogle = () =>
    google.configure ? demarrer(() => void demarrerRaccordementAction()) : ouvrir("identifiants-google");

  const boutonGoogle = !google.relie || google.derniereErreur
    ? { libelle: google.relie ? "Rebrancher" : "Relier", plein: true, geste: relierGoogle }
    : { libelle: "Gérer", plein: false, geste: () => ouvrir("gerer-google") };

  const boutonApple = !apple.relie || apple.derniereErreur
    ? { libelle: apple.relie ? "Rebrancher" : "Relier", plein: true, geste: () => ouvrir("relier-icloud") }
    : { libelle: "Gérer", plein: false, geste: () => ouvrir("gerer-icloud") };

  return (
    <div className="px-[26px] pt-6">
      {retour && (
        <p
          role="status"
          className="mb-5 rounded-[4px] px-4 py-3 text-[14px] leading-snug"
          style={{
            backgroundColor: colors.rustTint,
            borderLeft: `3px solid ${retour.ton === "bien" ? colors.sage : colors.alert}`,
          }}
        >
          {retour.texte}
        </p>
      )}

      <section className="overflow-hidden rounded-[14px]" style={{ backgroundColor: colors.card }}>
        <Ligne
          repere="agenda-google"
          nom="Google Agenda"
          initiale="G"
          mots={motsDeLAgenda(google)}
          bouton={boutonGoogle}
          enCours={enCours}
        />
        <div style={{ height: 1, backgroundColor: colors.line }} />
        <Ligne repere="agenda-icloud" nom="iCloud" initiale="i" mots={motsDeLAgenda(apple)} bouton={boutonApple} enCours={enCours} />
      </section>

      <BottomSheet open={volet !== null} onBackdropClick={() => setVolet(null)}>
        {motif && (
          <p
            role="alert"
            className="mb-4 rounded-[4px] px-4 py-3 text-[13px] leading-snug"
            style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}` }}
          >
            {motif}
          </p>
        )}
        {volet === "gerer-google" && <GererGoogle etat={google} recharger={recharger} />}
        {volet === "gerer-icloud" && <GererApple etat={apple} setMotif={setMotif} recharger={recharger} />}
        {volet === "relier-icloud" && <RelierApple compteConnu={apple.compte} setMotif={setMotif} recharger={recharger} />}
        {volet === "identifiants-google" && <IdentifiantsGoogle etat={google} setMotif={setMotif} />}
      </BottomSheet>
    </div>
  );
}

function Ligne({
  repere,
  nom,
  initiale,
  mots,
  bouton,
  enCours,
}: {
  repere: string;
  nom: string;
  initiale: string;
  mots: MotsDeLAgenda;
  bouton: { libelle: string; plein: boolean; geste: () => void };
  enCours: boolean;
}) {
  const teinte = mots.ton === "bien" ? colors.sage : mots.ton === "mal" ? colors.alert : colors.muted;
  return (
    <div data-atlas={repere} className="flex items-center gap-3 px-4 py-4">
      <span
        aria-hidden
        className="grid h-9 w-9 flex-none place-items-center rounded-[9px] text-[15px] font-semibold"
        style={{ backgroundColor: colors.rustTint }}
      >
        {initiale}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{nom}</span>
        <span className="flex items-center gap-1.5 text-[13.5px]" style={{ color: teinte }}>
          <span aria-hidden className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: teinte }} />
          {mots.texte}
        </span>
      </span>
      <button
        type="button"
        disabled={enCours}
        onClick={bouton.geste}
        className={`${bouton.plein ? "atlas-plein " : ""}flex-none rounded-full px-4 py-2 text-[14px] font-medium`}
        style={{
          backgroundColor: bouton.plein ? colors.plein : colors.rustTint,
          color: bouton.plein ? surPlein : colors.ink,
          opacity: enCours ? 0.6 : 1,
        }}
      >
        {bouton.libelle}
      </button>
    </div>
  );
}

function GererGoogle({ etat, recharger }: { etat: EtatAgenda; recharger: () => void }) {
  const [enCours, demarrer] = useTransition();
  return (
    <>
      <Titre>Google Agenda</Titre>
      {etat.compte && <Compte>{etat.compte}</Compte>}
      <Interrupteur
        libelle="Lire mon agenda"
        allume={etat.actif}
        enCours={enCours}
        basculer={() => demarrer(async () => { await basculerAgendaAction(!etat.actif); recharger(); })}
      />
      <Debrancher
        phrase="Atlas cessera de lire cet agenda."
        debrancher={() => demarrer(async () => { await debrancherAgendaAction(); recharger(); })}
        enCours={enCours}
      />
    </>
  );
}

function GererApple({
  etat,
  setMotif,
  recharger,
}: {
  etat: EtatAgendaApple;
  setMotif: (m: string | null) => void;
  recharger: () => void;
}) {
  const [enCours, demarrer] = useTransition();
  const [agendas, setAgendas] = useState<AgendaProposé[] | null>(null);
  const [dit, setDit] = useState<string | null>(null);

  const ecrire = () =>
    demarrer(async () => {
      setMotif(null);
      if (etat.ecritureActive) {
        const r = await reglerEcritureAppleAction({ active: false });
        if (!r.ok) return setMotif(r.motif);
        return recharger();
      }
      // La liste est redemandée à Apple à chaque ouverture, jamais devinée
      // d'après un état ancien.
      const r = await listerAgendasAppleAction();
      if (!r.ok) return setMotif(r.motif);
      setAgendas(r.agendas);
    });

  const ecrireDans = (a: AgendaProposé) =>
    demarrer(async () => {
      const r = await reglerEcritureAppleAction({ active: true, calendrier: { href: a.href, nom: a.nom } });
      if (!r.ok) return setMotif(r.motif);
      recharger();
    });

  const renvoyer = () =>
    demarrer(async () => {
      setMotif(null);
      const r = await resynchroniserAppleAction();
      if (!r.ok) return setMotif(r.motif);
      setDit(r.poses === 0 ? "Aucun chantier planifié à envoyer." : `${r.poses} chantier${r.poses > 1 ? "s" : ""} renvoyé${r.poses > 1 ? "s" : ""}.`);
    });

  const debrancher = () =>
    demarrer(async () => {
      const r = await debrancherAppleAction();
      if (r.restes) {
        // **Taire des restes serait mentir sur un ménage qui n'a pas eu lieu.**
        // Il les découvrirait dans son téléphone un mois plus tard.
        return setMotif(
          `Débranché, mais Atlas n'a pas pu retirer ses rendez-vous de votre agenda : ${r.restes}. Ils sont à supprimer depuis le Calendrier.`
        );
      }
      recharger();
    });

  return (
    <>
      <Titre>iCloud</Titre>
      {etat.compte && <Compte>{etat.compte}</Compte>}
      <Interrupteur
        libelle="Lire mon agenda"
        allume={etat.actif}
        enCours={enCours}
        basculer={() => demarrer(async () => { await basculerAppleAction(!etat.actif); recharger(); })}
      />
      <Interrupteur libelle="Écrire mes chantiers dedans" allume={etat.ecritureActive} enCours={enCours} basculer={ecrire} />

      {agendas && !etat.ecritureActive && (
        <div className="mb-3 rounded-[12px] px-4 py-3" style={{ backgroundColor: colors.card }}>
          <p className="text-[13px]" style={{ color: colors.muted }}>
            Dans quel calendrier ?
          </p>
          {agendas.map((a) => (
            <button
              key={a.href}
              type="button"
              disabled={enCours || !a.inscriptible}
              onClick={() => ecrireDans(a)}
              className="block w-full py-2.5 text-left text-[15px]"
              style={{ opacity: a.inscriptible ? 1 : 0.45 }}
            >
              {a.nom}
              {!a.inscriptible && (
                <span className="block text-[12.5px]" style={{ color: colors.muted }}>
                  En lecture seule
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {etat.derniereErreurEcriture && (
        <p className="mb-3 text-[13px]" style={{ color: colors.alert }}>
          Le dernier chantier n&apos;a pas pu être écrit.
        </p>
      )}

      {etat.ecritureActive && (
        <button
          type="button"
          disabled={enCours}
          onClick={renvoyer}
          className="mb-3 w-full rounded-full px-5 py-3 text-[15px] font-medium"
          style={{ backgroundColor: colors.rustTint, opacity: enCours ? 0.6 : 1 }}
        >
          Renvoyer mes chantiers
        </button>
      )}
      {dit && (
        <p className="mb-3 text-[13px]" style={{ color: colors.rust }}>
          {dit}
        </p>
      )}

      <Debrancher
        phrase="Atlas retirera de votre agenda les rendez-vous qu'il y a posés. Les vôtres ne sont pas touchés."
        debrancher={debrancher}
        enCours={enCours}
      />
    </>
  );
}

function RelierApple({
  compteConnu,
  setMotif,
  recharger,
}: {
  compteConnu: string | null;
  setMotif: (m: string | null) => void;
  recharger: () => void;
}) {
  const [enCours, demarrer] = useTransition();
  const [compte, setCompte] = useState(compteConnu ?? "");
  const [motDePasse, setMotDePasse] = useState("");

  const relier = () =>
    demarrer(async () => {
      setMotif(null);
      const r = await relierAppleAction({ compte, motDePasse });
      if (!r.ok) return setMotif(r.motif);
      // Le mot de passe quitte l'écran dès qu'il a servi.
      setMotDePasse("");
      recharger();
    });

  return (
    <>
      <Titre>Relier iCloud</Titre>
      {/* **AU-DESSUS du champ, et cet ordre EST la règle.** Apple ne sait pas
          restreindre ce mot de passe à l'agenda. */}
      <p
        className="mb-3 rounded-[6px] px-4 py-3 text-[14px] leading-snug"
        style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}` }}
      >
        <strong>Ce mot de passe ouvre tout votre iCloud.</strong> Vous pouvez l&apos;annuler chez Apple quand
        vous voulez.
      </p>
      <p className="mb-4 text-[13.5px] leading-snug" style={{ color: colors.muted }}>
        Sur account.apple.com : Connexion et sécurité, puis Mots de passe pour les apps, puis Générer.
      </p>
      <Champ libelle="Adresse iCloud" valeur={compte} onChange={setCompte} exemple="prenom@icloud.com" />
      <Champ
        libelle="Mot de passe pour les apps"
        valeur={motDePasse}
        onChange={setMotDePasse}
        exemple="abcd efgh ijkl mnop"
        masque
      />
      <BoutonPlein enCours={enCours} onClick={relier}>
        {enCours ? "Connexion à Apple…" : "Relier"}
      </BoutonPlein>
    </>
  );
}

function IdentifiantsGoogle({ etat, setMotif }: { etat: EtatAgenda; setMotif: (m: string | null) => void }) {
  const [enCours, demarrer] = useTransition();
  const [clientId, setClientId] = useState(etat.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [redirection, setRedirection] = useState(
    etat.redirection ?? (typeof window !== "undefined" ? `${window.location.origin}/api/agenda/google/retour` : "")
  );

  const enregistrer = () =>
    demarrer(async () => {
      setMotif(null);
      const r = await enregistrerIdentifiantsAction({ clientId, clientSecret, redirection });
      if (!r.ok) return setMotif(r.motif);
      // L'état vient du serveur, jamais d'une supposition de l'écran.
      window.location.href = "/reglages/agenda?issue=identifiants";
    });

  return (
    <>
      <Titre>Relier Google</Titre>
      <p className="mb-4 text-[13.5px] leading-snug" style={{ color: colors.muted }}>
        Une seule fois, sur console.cloud.google.com. Recopiez l&apos;adresse de retour à l&apos;identique chez
        Google.
      </p>
      <Champ libelle="Identifiant client" valeur={clientId} onChange={setClientId} exemple="1234-abcd.apps.googleusercontent.com" />
      <Champ libelle="Secret client" valeur={clientSecret} onChange={setClientSecret} exemple="GOCSPX…" masque />
      <Champ libelle="Adresse de retour" valeur={redirection} onChange={setRedirection} exemple="https://…/api/agenda/google/retour" />
      <BoutonPlein enCours={enCours} onClick={enregistrer}>
        Enregistrer
      </BoutonPlein>
    </>
  );
}

function Titre({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[22px] leading-tight" style={{ fontFamily: font.display }}>
      {children}
    </p>
  );
}

function Compte({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[13.5px]" style={{ color: colors.muted }}>
      {children}
    </p>
  );
}

function Interrupteur({
  libelle,
  allume,
  enCours,
  basculer,
}: {
  libelle: string;
  allume: boolean;
  enCours: boolean;
  basculer: () => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-4 rounded-[12px] px-4 py-3.5" style={{ backgroundColor: colors.card }}>
      <span className="flex-1 text-[15px]">{libelle}</span>
      <button
        type="button"
        role="switch"
        aria-checked={allume}
        aria-label={libelle}
        disabled={enCours}
        onClick={basculer}
        className="relative h-[30px] w-[50px] flex-none rounded-full"
        style={{ backgroundColor: allume ? colors.rust : voile(colors.ink, 0.18), opacity: enCours ? 0.6 : 1 }}
      >
        <span
          className="absolute top-[3px] block h-6 w-6 rounded-full"
          style={{
            left: allume ? 23 : 3,
            backgroundColor: colors.card,
            boxShadow: "0 1px 3px rgba(20,18,14,.28)",
            transition: "left .2s",
          }}
        />
      </button>
    </div>
  );
}

/** Une suppression se confirme : un doigt qui glisse ne doit pas coûter un raccordement. */
function Debrancher({ phrase, debrancher, enCours }: { phrase: string; debrancher: () => void; enCours: boolean }) {
  const [confirmation, setConfirmation] = useState(false);
  if (!confirmation) {
    return (
      <button
        type="button"
        onClick={() => setConfirmation(true)}
        className="mt-2 w-full rounded-full px-5 py-3 text-[15px] font-medium"
        style={{ backgroundColor: colors.rustTint, color: colors.alert }}
      >
        Débrancher
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-[6px] px-4 py-3" style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}` }}>
      <p className="text-[14px] leading-snug">{phrase}</p>
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
          className="px-4 py-2 text-[14px] font-medium"
          style={{ color: colors.muted }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function BoutonPlein({ enCours, onClick, children }: { enCours: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={onClick}
      className="atlas-plein mt-2 w-full rounded-full px-5 py-3 text-[15px] font-medium"
      style={{ backgroundColor: colors.plein, color: surPlein, opacity: enCours ? 0.6 : 1 }}
    >
      {children}
    </button>
  );
}

/**
 * Une case de saisie. 16 px de corps au minimum : en dessous, iOS agrandit la
 * page dès que le champ prend le focus. Les secrets sont masqués à la frappe :
 * ces écrans se remplissent souvent à deux.
 */
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
    <label className="mb-3 block">
      <span className="mb-1 block text-[13px]" style={{ color: colors.muted }}>
        {libelle}
      </span>
      <input
        type={masque ? "password" : "text"}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={exemple}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="w-full rounded-[6px] px-4 py-3 text-[16px]"
        style={{ backgroundColor: colors.card, color: colors.ink, border: `1px solid ${colors.line}` }}
      />
    </label>
  );
}
