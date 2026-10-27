"use client";

import { useState, useTransition } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import PlageTon from "@/components/atlas/reglages/PlageTon";
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
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import Picto from "@/components/atlas/reglages/Picto";

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

  // **Relier et Rebrancher cernés d'or, Gérer cerné de gris** (planche des
  // Réglages soignés, 26 octobre 2026). Ils étaient deux boutons verts pleins :
  // l'or appelle le geste sans écraser l'écran, et le seul bouton plein reste
  // celui qu'une feuille porte, quand on y est.
  const boutonGoogle: BoutonDeLigne = !google.relie || google.derniereErreur
    ? { libelle: google.relie ? "Rebrancher" : "Relier", appel: true, geste: relierGoogle }
    : { libelle: "Gérer", appel: false, geste: () => ouvrir("gerer-google") };

  const boutonApple: BoutonDeLigne = !apple.relie || apple.derniereErreur
    ? { libelle: apple.relie ? "Rebrancher" : "Relier", appel: true, geste: () => ouvrir("relier-icloud") }
    : { libelle: "Gérer", appel: false, geste: () => ouvrir("gerer-icloud") };

  return (
    <div className="mx-[22px] mt-[18px]">
      {/* Le retour de Google se pose en haut, sur une plage au ton de ce qu'il
          dit : vert quand c'est relié, rouge quand Google a refusé (planche du
          26 octobre 2026). Ses mots ne changent pas. */}
      {retour && (
        <div role="status" className="mb-3.5">
          <PlageTon ton={retour.ton === "bien" ? "vert" : "rouge"}>
            <span className="flex items-center gap-2.5 font-semibold">
              {retour.ton === "bien" && <Picto nom="coche" taille={20} />}
              {retour.texte}
            </span>
          </PlageTon>
        </div>
      )}

      <section className="overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
        <Ligne
          repere="agenda-google"
          nom="Google Agenda"
          initiale="G"
          mots={motsDeLAgenda(google)}
          bouton={boutonGoogle}
          enCours={enCours}
        />
        <Ligne repere="agenda-icloud" nom="iCloud" initiale="i" mots={motsDeLAgenda(apple)} bouton={boutonApple} enCours={enCours} />
      </section>

      <BottomSheet open={volet !== null} onBackdropClick={() => setVolet(null)}>
        {motif && (
          <div role="alert" className="mb-4">
            <PlageTon ton="rouge">{motif}</PlageTon>
          </div>
        )}
        {volet === "gerer-google" && <GererGoogle etat={google} recharger={recharger} />}
        {volet === "gerer-icloud" && <GererApple etat={apple} setMotif={setMotif} recharger={recharger} />}
        {volet === "relier-icloud" && <RelierApple compteConnu={apple.compte} setMotif={setMotif} recharger={recharger} />}
        {volet === "identifiants-google" && <IdentifiantsGoogle etat={google} setMotif={setMotif} />}
      </BottomSheet>
    </div>
  );
}

type BoutonDeLigne = { libelle: string; appel: boolean; geste: () => void };

/** Le ton de l'état : vert relié, rouge ne se lit plus, gris non relié ou en pause. */
const TON_DES_MOTS = { bien: "vert", mal: "rouge", neutre: undefined } as const;

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
  bouton: BoutonDeLigne;
  enCours: boolean;
}) {
  return (
    <div data-atlas={repere} className="relative flex min-h-[84px] items-center gap-3.5 py-3.5">
      <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
      {/* L'initiale prend le doré de l'appli et la serif des titres. */}
      <PastilleIcone>
        <span className="text-[21px] leading-none" style={{ fontFamily: font.display }}>
          {initiale}
        </span>
      </PastilleIcone>
      <span className="min-w-0 flex-1">
        <span className="block text-[19px] leading-[1.25]" style={{ fontFamily: font.display }}>
          {nom}
        </span>
        <span className="mt-1.5 block">
          <EtatEcrit ton={TON_DES_MOTS[mots.ton]}>{mots.texte}</EtatEcrit>
        </span>
      </span>
      <button
        type="button"
        disabled={enCours}
        onClick={bouton.geste}
        className="min-h-[44px] min-w-[92px] flex-none rounded-full px-4 text-[15px] font-semibold"
        style={{
          color: bouton.appel ? colors.or : colors.ink,
          boxShadow: `inset 0 0 0 1.5px ${bouton.appel ? voile(colors.or, 0.7) : colors.line}`,
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
      <Plage>
        <Interrupteur
          libelle="Lire mon agenda"
          allume={etat.actif}
          enCours={enCours}
          basculer={() => demarrer(async () => { await basculerAgendaAction(!etat.actif); recharger(); })}
        />
      </Plage>
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
      <Plage>
        <Interrupteur
          libelle="Lire mon agenda"
          allume={etat.actif}
          enCours={enCours}
          basculer={() => demarrer(async () => { await basculerAppleAction(!etat.actif); recharger(); })}
        />
        <Interrupteur libelle="Écrire mes chantiers dedans" allume={etat.ecritureActive} enCours={enCours} basculer={ecrire} />
      </Plage>

      {agendas && !etat.ecritureActive && (
        <div className="mt-2.5 overflow-hidden rounded-[6px] px-[18px] pb-1" style={{ backgroundColor: colors.card }}>
          <p className="pt-3 text-[14px] font-semibold" style={{ color: colors.inkSoft }}>
            Dans quel calendrier ?
          </p>
          {agendas.map((a) => (
            <button
              key={a.href}
              type="button"
              disabled={enCours || !a.inscriptible}
              onClick={() => ecrireDans(a)}
              className="flex min-h-[56px] w-full items-center gap-3 py-3 text-left"
              style={{ opacity: a.inscriptible ? 1 : 0.5 }}
            >
              <span
                aria-hidden
                className="block h-[22px] w-[22px] flex-none rounded-full"
                style={{ boxShadow: `inset 0 0 0 1.5px ${colors.chevron}` }}
              />
              <span>
                <span className="block text-[17.5px] leading-[1.25]" style={{ fontFamily: font.display }}>
                  {a.nom}
                </span>
                {!a.inscriptible && (
                  <span className="mt-0.5 block text-[14px]" style={{ color: colors.inkSoft }}>
                    En lecture seule
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {etat.derniereErreurEcriture && (
        <p className="mx-0.5 mt-2.5 text-[15px] font-semibold" style={{ color: colors.carteRougeTexte }}>
          Le dernier chantier n&apos;a pas pu être écrit.
        </p>
      )}

      {etat.ecritureActive && (
        <button
          type="button"
          disabled={enCours}
          onClick={renvoyer}
          className="mt-4 flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full px-[22px] text-[17px] font-semibold"
          style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}`, opacity: enCours ? 0.6 : 1 }}
        >
          Renvoyer mes chantiers
        </button>
      )}
      {dit && (
        <p className="mx-0.5 mt-2.5 text-[15px] font-semibold" style={{ color: colors.carteVertTexte }}>
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
      <PlageTon ton="ambre">
        <strong style={{ color: colors.ink }}>Ce mot de passe ouvre tout votre iCloud.</strong> Vous pouvez
        l&apos;annuler chez Apple quand vous voulez.
      </PlageTon>
      {/* **Les trois étapes chez Apple, numérotées** (planche du 26 octobre
          2026), à la place d'une phrase à deux « puis » : on les suit l'une
          après l'autre, le téléphone dans l'autre main. */}
      <p className="mb-2 mt-[18px] text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
        Sur account.apple.com :
      </p>
      <ol className="mb-4">
        {["Connexion et sécurité", "Mots de passe pour les apps", "Générer"].map((etape, i) => (
          <li key={etape} className="flex min-h-[44px] items-center gap-3 text-[17px] leading-[1.3]" style={{ fontFamily: font.display }}>
            <span
              aria-hidden
              className="grid h-7 w-7 flex-none place-items-center rounded-full text-[14px] font-bold leading-none"
              style={{ fontFamily: font.body, color: colors.or, boxShadow: `inset 0 0 0 1.5px ${colors.or}` }}
            >
              {i + 1}
            </span>
            {etape}
          </li>
        ))}
      </ol>
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
      <p className="mb-4 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
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
    <p className="mb-4 mt-1.5 text-[26px] leading-[1.15]" style={{ fontFamily: font.display }}>
      {children}
    </p>
  );
}

function Compte({ children }: { children: React.ReactNode }) {
  return (
    <p className="-mt-2.5 mb-[18px] text-[15px]" style={{ color: colors.inkSoft }}>
      {children}
    </p>
  );
}

/** Les interrupteurs d'un agenda, dans UNE plage, séparés d'un filet : ils parlent du même calendrier. */
function Plage({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
      {children}
    </div>
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
    <div className="relative flex min-h-[64px] items-center gap-3.5 py-3">
      <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
      <span className="flex-1 text-[18px] leading-[1.25]" style={{ fontFamily: font.display }}>
        {libelle}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={allume}
        aria-label={libelle}
        disabled={enCours}
        onClick={basculer}
        className="relative h-[32px] w-[52px] flex-none rounded-full"
        style={{ backgroundColor: allume ? colors.plein : voile(colors.ink, 0.18), opacity: enCours ? 0.6 : 1 }}
      >
        <span
          className="absolute top-[3px] block h-[26px] w-[26px] rounded-full"
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

/**
 * Une suppression se confirme : un doigt qui glisse ne doit pas coûter un raccordement.
 *
 * **Sur une plage rouge, avec un bouton rouge, comme la suppression d'un
 * client** (planche du 26 octobre 2026) : la confirmation se reconnaît avant
 * d'être lue.
 */
function Debrancher({ phrase, debrancher, enCours }: { phrase: string; debrancher: () => void; enCours: boolean }) {
  const [confirmation, setConfirmation] = useState(false);
  if (!confirmation) {
    return (
      <button
        type="button"
        onClick={() => setConfirmation(true)}
        className="mt-[18px] min-h-[48px] px-1 text-[16px] font-semibold"
        style={{ color: colors.alert }}
      >
        Débrancher
      </button>
    );
  }
  return (
    <div className="mt-[18px]">
      <PlageTon ton="rouge">
        <p className="mb-3 text-[15.5px]" style={{ color: colors.ink }}>
          {phrase}
        </p>
        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={enCours}
            onClick={debrancher}
            className="min-h-[56px] flex-1 rounded-full px-4 text-[17px] font-semibold"
            style={{ backgroundColor: colors.alert, color: surPlein, opacity: enCours ? 0.6 : 1 }}
          >
            Débrancher
          </button>
          <button
            type="button"
            onClick={() => setConfirmation(false)}
            className="min-h-[56px] flex-1 rounded-full px-4 text-[17px] font-semibold"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
          >
            Annuler
          </button>
        </div>
      </PlageTon>
    </div>
  );
}

function BoutonPlein({ enCours, onClick, children }: { enCours: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={onClick}
      className="atlas-plein mt-6 min-h-[56px] w-full rounded-full px-[22px] text-[17px] font-semibold"
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
    <label className="mt-4 block">
      <span className="mb-[7px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
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
        className="min-h-[52px] w-full rounded-[6px] px-[15px] py-3.5 text-[16px]"
        style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.lineSoft}` }}
      />
    </label>
  );
}
