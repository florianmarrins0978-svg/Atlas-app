"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CHAPITRES,
  FORMES_DE_LA_PORTE,
  avanceToutSeul,
  questionsApplicables,
  refusDe,
  reponsesProposees,
  totalAnnonce,
  typographie,
  type Champ,
  type Question,
} from "@/lib/creation-compte";
import { ATTESTATION_FORMATS, refusDeLAttestation } from "@/lib/attestation-decennale";
import { composerTelephone, PAYS_PAR_DEFAUT } from "@/lib/telephone";
import { etatDemi, MOT_ETAT, partDeLaBarre } from "@/lib/planning-jour";
import { couleurDApparence } from "@/lib/couleurs-planning";
import { charte } from "@/lib/chartes";
import { colors, surPlein } from "@/lib/design-tokens";
import PorteDeNuit, { SERIF } from "@/components/atlas/PorteDeNuit";
import SaisieDuCode from "@/components/atlas/SaisieDuCode";
import OeilMotDePasse from "@/components/atlas/OeilMotDePasse";
import { creerLeCompteAction } from "./actions";
import { renvoyerLeCodeAction, verifierLeCodeAction } from "@/app/verifier-email/actions";
import { deconnexionAction } from "@/app/login/actions";
import { deposerAttestationAction } from "@/app/reglages/identite/attestation-actions";
import type { SaisieCompte } from "@/server/repositories/creation-compte";

/**
 * CRÉER UN COMPTE — une question à la fois.
 *
 * **La porte soignée, sa planche du 26 octobre 2026, codée le même jour**
 * (`appli/soignee/creer-un-compte.html`). Écran 2 de
 * `appli/la-porte-en-plein-air.html` d'abord (8 septembre), dont tout ce qui
 * se décidait reste : une question à la fois, la nuit, la jauge par chapitre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI EST ÉCRIT ICI, ET CE QUI NE L'EST PAS.** L'ordre des questions, ce
 * qui est obligatoire, ce qui ne se pose que dans certains cas, ce qui se
 * propose, le total annoncé et ce qui manque à la fin vivent dans
 * `src/lib/creation-compte.ts` : ce sont des règles (`CLAUDE.md` §3). Ce
 * fichier ne fait que les montrer.
 *
 * **AUCUNE COULEUR N'EST ÉCRITE À LA MAIN** : `PorteDeNuit` pose les variables
 * de la charte Nuit, et les jetons `colors.*` la suivent. Avant le compte,
 * personne n'a choisi de couleurs : la porte est la nuit.
 *
 * **UN SEUL ÉCRAN EST MONTÉ À LA FOIS**, jamais vingt cachés : un formulaire
 * masqué garde ses valeurs, et une question « passée » plus haut reviendrait
 * remplie sans que personne l'ait retapée.
 *
 * **LA FIN N'EST PLUS ICI.** Après le code, la porte passe aux conditions,
 * puis à `/creer-un-compte/pret` (Face ID, Tout est prêt) : « Entrer dans
 * Atlas » ouvrait encore les conditions, il entre désormais pour de bon.
 */

/**
 * Trois jours d'exemple sous le compteur des chantiers — sa remarque du
 * 26 octobre : « on ne sait pas trop pourquoi on choisit deux équipes ou
 * moins ». Ils se remplissent par la règle du planning (`etatDemi`), avec ses
 * mots (`MOT_ETAT`) et ses couleurs d'office dans la nuit de la porte.
 */
const JOURS_D_EXEMPLE: readonly [string, number][] = [
  ["Lundi", 2],
  ["Mardi", 1],
  ["Mercredi", 3],
];
const NUIT = charte("nuit");

export default function CreerUnComptePage() {
  const router = useRouter();
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [rang, setRang] = useState(0);
  const [refus, setRefus] = useState<string | null>(null);
  const [etape, setEtape] = useState<"questions" | "code" | "envoi">("questions");
  const [codeEnvoyeA, setCodeEnvoyeA] = useState<{ email: string; avertissement?: string } | null>(null);
  const [mdpVisible, setMdpVisible] = useState<Record<string, boolean>>({});
  const [autresFormes, setAutresFormes] = useState(false);
  /**
   * La photo de l'attestation, GARDÉE DANS LE TÉLÉPHONE jusqu'au code : rien
   * ne part avant « Créer mon compte », et un compte ouvert avec une adresse
   * inventée ne range aucun fichier.
   */
  const [attestation, setAttestation] = useState<File | null>(null);
  const [enCours, demarrer] = useTransition();

  // Ce que l'écran montre : les réponses, plus celles qu'on propose d'office.
  // C'est aussi ce qui part en base — une seule et même valeur.
  const vues = useMemo(() => reponsesProposees(reponses), [reponses]);
  const questions = useMemo(() => questionsApplicables(reponses), [reponses]);
  const question: Question | undefined = questions[rang];
  const total = totalAnnonce(reponses);

  const repondre = (cle: string, valeur: string) => {
    setRefus(null);
    setReponses((avant) => ({ ...avant, [cle]: valeur }));
  };

  function suivante(avec: Record<string, string> = reponses) {
    const suite = questionsApplicables(avec);
    setRefus(null);
    if (rang + 1 < suite.length) {
      setRang(rang + 1);
      return;
    }
    envoyer(reponsesProposees(avec));
  }

  function avancer() {
    if (!question) return;
    const manque = refusDe(question, vues);
    if (manque) {
      setRefus(manque);
      return;
    }
    suivante();
  }

  /** « Passer » efface les réponses de l'écran : ce qui est passé est vide, pas proposé. */
  function passer() {
    if (!question) return;
    const sans = { ...reponses };
    for (const champ of question.champs ?? []) sans[champ.cle] = "";
    if (question.attestation) {
      sans.attestation = "";
      setAttestation(null);
    }
    setReponses(sans);
    suivante(sans);
  }

  function choisir(cle: string, valeur: string, q: Question) {
    const avec = { ...reponses, [cle]: valeur };
    setRefus(null);
    setReponses(avec);
    // Un court instant pour voir la pastille se poser, puis la suite.
    if (avanceToutSeul(q)) window.setTimeout(() => suivante(avec), 160);
  }

  function envoyer(c: Record<string, string>) {
    demarrer(async () => {
      const decennale = c.decennale === "oui";
      const saisie: SaisieCompte = {
        civilite: c.identite === "mme" ? "mme" : "mr",
        prenom: c.prenom ?? "",
        nom: c.nom ?? "",
        email: c.email ?? "",
        motDePasse: c.mdp ?? "",
        entreprise: c.entreprise ?? "",
        forme: c.forme ?? "",
        siret: c.siret,
        adresse: c.adresse,
        capital: c.capital,
        rcs: c.rcs,
        // Le format de Réglages : national, avec son zéro (`composerTelephone`).
        telephone: composerTelephone(PAYS_PAR_DEFAUT, c.tel ?? ""),
        emailPro: c.emailPro,
        tva: c.tva === "assujettie" ? "assujettie" : "franchise",
        numeroTva: c.numTva,
        iban: c.iban,
        titulaire: c.titulaire,
        moyens: c.moyens,
        periodiciteTva: c.rythme === "trimestrielle" ? "trimestrielle" : "mensuelle",
        tvaExigibilite: c.reversement === "debits" ? "debits" : "encaissements",
        assureur: decennale ? c.assureur : undefined,
        adresseAssureur: decennale ? c.adresseAssureur : undefined,
        couverture: decennale ? c.couverture : undefined,
        mediateur: c.mediateur,
        mediateurCoordonnees: c.mediateurOu,
        nombreEquipes: Number(c.equipes ?? 1),
      };
      const etat = await creerLeCompteAction(saisie);
      if (etat?.refus !== undefined) {
        setRefus(etat.refus);
        return;
      }
      if (etat) {
        setCodeEnvoyeA({ email: etat.codeEnvoyeA, avertissement: etat.avertissement });
        setEtape("code");
      }
    });
  }

  /**
   * Le code est bon : la photo part, PUIS les conditions.
   *
   * Par le dépôt de Mon entreprise, qui la vérifie, la range et la fait lire
   * par l'IA. **Un dépôt raté ne retient personne** : « Tout est prêt » le dira
   * (« Attestation à joindre »), et Mon entreprise la reprend.
   */
  async function apresLeCode() {
    if (attestation && reponses.decennale === "oui") {
      setEtape("envoi");
      const envoi = new FormData();
      envoi.set("fichier", attestation);
      const r = await deposerAttestationAction(envoi).catch(() => null);
      if (!r?.ok) console.error("[porte] attestation non déposée", r && !r.ok ? r.raison : "panne");
    }
    router.push("/documents-legaux");
  }

  if (etape === "code" && codeEnvoyeA) {
    return (
      <PorteDeNuit className="atlas-bas-sans-barre flex min-h-[100dvh] flex-col px-[22px]">
        <div className="flex flex-1 flex-col">
          {/* Pas de « Retour » vers les questions : le compte est créé. Celui
              de la case du code ferme la session et ramène à la porte. */}
          <SaisieDuCode
            email={codeEnvoyeA.email}
            avertissement={codeEnvoyeA.avertissement}
            onVerifie={() => void apresLeCode()}
            verifier={verifierLeCodeAction}
            renvoyer={renvoyerLeCodeAction}
            sortir={() => deconnexionAction("entree")}
          />
        </div>
      </PorteDeNuit>
    );
  }

  if (etape === "envoi") {
    return (
      <PorteDeNuit className="atlas-bas-sans-barre flex min-h-[100dvh] flex-col px-[22px]">
        <div className="flex flex-1 flex-col justify-center" role="status">
          <h1 className="text-[30px] leading-[1.12]" style={SERIF}>
            Votre attestation part
          </h1>
          <p className="mt-2 text-[15px]" style={{ color: colors.inkSoft }}>
            Avec votre compte, jointe à vos devis et vos factures.
          </p>
        </div>
      </PorteDeNuit>
    );
  }

  if (!question) return null;
  const dernier = rang + 1 === questions.length;
  const chapitreIci = CHAPITRES.indexOf(question.chapitre);
  const duChapitre = questions.filter((x) => x.chapitre === question.chapitre);
  const plusieursCases = (question.champs?.length ?? 0) > 1 || Boolean(question.civilite);

  return (
    <PorteDeNuit className="atlas-bas-sans-barre flex min-h-[100dvh] flex-col px-[22px]">
      <div className="flex-shrink-0 pt-[6px]">
        <button
          type="button"
          onClick={() => (rang === 0 ? router.push("/bienvenue") : (setRefus(null), setRang(rang - 1)))}
          className="-ml-[10px] flex min-h-[48px] items-center gap-[6px] rounded-full pl-2 pr-3 text-[15.5px] font-semibold"
          style={{ color: colors.inkSoft }}
          aria-label="Revenir en arrière"
        >
          {/* Le chevron du retour montre un SENS : ce n'est pas une flèche
              décorative au bout d'un libellé (`CLAUDE.md` §3). */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
          Retour
        </button>
        <div className="mt-[2px] flex items-baseline justify-between text-[14.5px] tabular-nums" style={{ color: colors.inkSoft }}>
          <b style={{ color: colors.ink, fontWeight: 600 }}>{question.chapitre}</b>
          <span>
            {rang + 1} sur {total}
          </span>
        </div>
        {/* **UN SEGMENT PAR CHAPITRE, ET NON UN POURCENTAGE** : il montre
            combien il reste d'étapes. Celui du chapitre en cours se remplit
            question par question. */}
        <div className="mt-[10px] flex gap-[5px]" aria-hidden="true">
          {CHAPITRES.map((chap, i) => {
            const part =
              i < chapitreIci ? 100 : i > chapitreIci ? 0 : Math.round(((duChapitre.indexOf(question) + 1) / duChapitre.length) * 100);
            return (
              <div key={chap} className="h-[4px] flex-1 overflow-hidden rounded-full" style={{ background: colors.line }}>
                <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${part}%`, background: colors.or }} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-[18px]">
        <div className="my-auto">
          <h1 className="mb-5 text-[30px] leading-[1.12] tracking-[-0.01em] [text-wrap:balance]" style={SERIF}>
            {typographie(question.question)}
          </h1>
          {question.aide && (
            <p className="-mt-2 mb-5 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
              {question.aide}
            </p>
          )}

          {question.civilite && (
            <div className="mb-[14px] grid grid-cols-2 gap-[10px]" role="group" aria-label="Civilité">
              {question.civilite.map((c) => {
                const pris = vues.identite === c.valeur;
                return (
                  <button
                    key={c.valeur}
                    type="button"
                    aria-pressed={pris}
                    onClick={() => repondre("identite", c.valeur)}
                    className="flex min-h-[56px] items-center justify-center gap-[10px] rounded-full text-[16.5px]"
                    style={{
                      background: colors.card,
                      color: colors.ink,
                      boxShadow: pris ? `inset 0 0 0 2px ${colors.or}` : `inset 0 0 0 1px ${colors.line}`,
                    }}
                  >
                    <Pastille prise={pris} />
                    {c.titre}
                  </button>
                );
              })}
            </div>
          )}

          {question.champs?.map((champ, i) => (
            <ChampDeLaPorte
              key={champ.cle}
              champ={champ}
              nomme={plusieursCases}
              premier={i === 0 && !question.civilite}
              valeur={vues[champ.cle] ?? ""}
              propose={reponses[champ.cle] === undefined && Boolean(vues[champ.cle]) && Boolean(champ.tireDuSiret)}
              visible={Boolean(mdpVisible[champ.cle])}
              onVisible={() => setMdpVisible((v) => ({ ...v, [champ.cle]: !v[champ.cle] }))}
              onChange={(v) => repondre(champ.cle, v)}
              onEntree={avancer}
              etiquette={question.question}
            />
          ))}

          {question.id === "mdp" && <ReglesDuMotDePasse mdp={vues.mdp ?? ""} confirm={vues.confirm ?? ""} />}

          {question.formes && (
            <>
              <div className="rounded-[14px] px-[18px] py-[2px]" style={{ background: colors.card }} role="group" aria-label="Forme juridique">
                {FORMES_DE_LA_PORTE.filter((f) => f.courante || autresFormes || vues.forme === f.valeur).map((f, i) => (
                  <LigneDeChoix
                    key={f.valeur}
                    titre={f.titre}
                    note={f.note}
                    pris={vues.forme === f.valeur}
                    filet={i > 0}
                    onChoisir={() => choisir("forme", f.valeur, question)}
                  />
                ))}
              </div>
              {!autresFormes && !FORMES_DE_LA_PORTE.some((f) => !f.courante && f.valeur === vues.forme) && (
                <button
                  type="button"
                  onClick={() => setAutresFormes(true)}
                  className="mt-[6px] flex min-h-[48px] items-center gap-[6px] text-[15.5px] font-semibold"
                  style={{ color: colors.or }}
                >
                  Une autre forme
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5.5 9l6.5 6.5L18.5 9" />
                  </svg>
                </button>
              )}
            </>
          )}

          {/* **Oui ou Non : deux pilules l'une sous l'autre**, et non les deux
              cartes côte à côte de la planche : sa règle du 12 août 2026, la
              même forme ronde pour tous les boutons (`test-boutons-arrondis`).
              Arrondie, une carte de trois lignes rognait son texte. */}
          {question.cartes && (
            <div className="flex flex-col gap-[10px]">
              {question.cartes.map((c) => {
                const pris = vues[question.id] === c.valeur;
                return (
                  <button
                    key={c.valeur}
                    type="button"
                    aria-pressed={pris}
                    onClick={() => choisir(question.id, c.valeur, question)}
                    className="flex min-h-[68px] w-full items-center gap-[14px] rounded-full px-[26px] py-[12px] text-left"
                    style={{ background: colors.card, boxShadow: pris ? `inset 0 0 0 2px ${colors.or}` : `inset 0 0 0 1px ${colors.line}` }}
                  >
                    <Pastille prise={pris} />
                    <span className="min-w-0">
                      <span className="block text-[20px] leading-[1.2]" style={{ ...SERIF, color: colors.ink }}>
                        {c.titre}
                      </span>
                      <span className="mt-[2px] block text-[14px] leading-[1.35]" style={{ color: colors.inkSoft }}>
                        {c.note}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {question.liste && (
            <div className="rounded-[14px] px-[18px] py-[2px]" style={{ background: colors.card }} role="group" aria-label={question.question}>
              {question.liste.map((o, i) => (
                <LigneDeChoix
                  key={o.valeur}
                  titre={o.titre}
                  note={o.note}
                  pris={vues[question.id] === o.valeur}
                  filet={i > 0}
                  onChoisir={() => choisir(question.id, o.valeur, question)}
                />
              ))}
            </div>
          )}

          {question.compteur && (
            <Compteur
              valeur={Number(vues[question.id] ?? question.compteur.min)}
              min={question.compteur.min}
              max={question.compteur.max}
              onChange={(n) => repondre(question.id, String(n))}
            />
          )}

          {question.attestation && (
            <Attestation
              fichier={attestation}
              onFichier={(f) => {
                const refusFichier = refusDeLAttestation(f.type.split(";")[0].trim().toLowerCase(), f.size);
                if (refusFichier) {
                  setRefus(refusFichier);
                  return;
                }
                setAttestation(f);
                repondre("attestation", "jointe");
              }}
            />
          )}

          {/* La place du refus est réservée là où un refus peut tomber : un
              message qui apparaît pousserait « Continuer » au moment où le
              doigt se pose dessus. Une réponse déjà proposée n'en reçoit pas. */}
          {question.propose === undefined && (
            <p className="mt-3 min-h-[22px] text-[14.5px] leading-[22px]" role="alert" aria-live="polite" style={{ color: colors.alert }}>
              {refus ?? ""}
            </p>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 pb-1 pt-2">
        {/* Oui ou Non, et la forme : un appui suffit, « Continuer » n'a rien à valider. */}
        {!avanceToutSeul(question) && (
          <button
            type="button"
            onClick={avancer}
            disabled={enCours}
            className="min-h-[56px] w-full rounded-full text-[17px] font-semibold transition-transform active:scale-[0.985] disabled:opacity-60"
            style={{ background: colors.plein, color: surPlein }}
          >
            {enCours ? "Un instant…" : dernier ? "Créer mon compte" : "Continuer"}
          </button>
        )}
        {/* « Passer » n'apparaît QUE là où passer est permis, et jamais sur une
            réponse déjà proposée : il n'y a rien à passer. */}
        {!question.requis && question.propose === undefined && (
          <button
            type="button"
            onClick={passer}
            className="mt-1 flex min-h-[48px] w-full items-center justify-center text-[15.5px] font-semibold"
            style={{ color: colors.inkSoft }}
          >
            Passer
          </button>
        )}
        {question.propose !== undefined && refus && (
          <p className="mt-2 text-center text-[14.5px]" role="alert" style={{ color: colors.alert }}>
            {refus}
          </p>
        )}
      </div>
    </PorteDeNuit>
  );
}

/** La pastille d'un choix : un rond creux, plein d'or quand il est pris. */
function Pastille({ prise }: { prise: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="block h-[22px] w-[22px] flex-none rounded-full transition-shadow duration-200"
      style={{ boxShadow: prise ? `inset 0 0 0 7px ${colors.or}` : `inset 0 0 0 1.5px ${colors.chevron}` }}
    />
  );
}

function LigneDeChoix({
  titre,
  note,
  pris,
  filet,
  onChoisir,
}: {
  titre: string;
  note?: string;
  pris: boolean;
  filet: boolean;
  onChoisir: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pris}
      onClick={onChoisir}
      className="flex min-h-[62px] w-full items-center gap-3 py-[12px] text-left"
      style={filet ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}
    >
      <Pastille prise={pris} />
      <span className="min-w-0">
        <span className="block text-[18px] leading-[1.25]" style={{ ...SERIF, color: colors.ink }}>
          {titre}
        </span>
        {note && (
          <span className="mt-[2px] block text-[14px] leading-[1.4]" style={{ color: colors.inkSoft }}>
            {note}
          </span>
        )}
      </span>
    </button>
  );
}

function ChampDeLaPorte({
  champ,
  nomme,
  premier,
  valeur,
  propose,
  visible,
  onVisible,
  onChange,
  onEntree,
  etiquette,
}: {
  champ: Champ;
  nomme: boolean;
  premier: boolean;
  valeur: string;
  propose: boolean;
  visible: boolean;
  onVisible: () => void;
  onChange: (v: string) => void;
  onEntree: () => void;
  etiquette: string;
}) {
  const [actif, setActif] = useState(false);
  const entree = (
    <input
      onFocus={() => setActif(true)}
      onBlur={() => setActif(false)}
      type={champ.oeil && visible ? "text" : champ.type}
      name={champ.cle}
      placeholder={champ.placeholder}
      autoComplete={champ.autocomplete}
      inputMode={champ.inputMode}
      value={valeur}
      aria-label={nomme && champ.libelle ? undefined : etiquette}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEntree();
        }
      }}
      className="min-h-[56px] min-w-0 flex-1 bg-transparent px-[22px] text-[16.5px] outline-none"
      style={{ color: colors.ink }}
    />
  );
  return (
    <label className={`block ${premier ? "" : "mt-[14px]"}`}>
      {nomme && champ.libelle && (
        <span className="mb-[7px] ml-[22px] block text-[14px] font-semibold" style={{ color: colors.inkSoft }}>
          {champ.libelle}
        </span>
      )}
      {/* La case entière s'entoure d'or quand on y écrit, l'indicatif et
          l'unité compris : c'est une seule case pour le doigt. */}
      <span
        className="flex min-h-[56px] items-center rounded-full"
        style={{ background: colors.card, boxShadow: actif ? `inset 0 0 0 2px ${colors.or}` : `inset 0 0 0 1px ${colors.line}` }}
      >
        {champ.indicatif && (
          <span
            className="ml-2 flex h-8 flex-none items-center rounded-full px-3 text-[15px] font-semibold"
            style={{ background: colors.rustTint, color: colors.ink }}
          >
            {PAYS_PAR_DEFAUT.code} {PAYS_PAR_DEFAUT.indicatif}
          </span>
        )}
        {entree}
        {champ.unite && (
          <span className="flex-none pr-[22px] text-[16px]" style={{ color: colors.inkSoft }}>
            {champ.unite}
          </span>
        )}
        {champ.oeil && (
          <OeilMotDePasse
            ouvert={visible}
            onBasculer={onVisible}
            quoi="le mot de passe"
            couleur={colors.inkSoft}
            couleurOuvert={colors.or}
            className="mr-[6px]"
          />
        )}
      </span>
      {propose && (
        <span className="ml-[22px] mt-[7px] block text-[14px] font-semibold" style={{ color: colors.carteVertTexte }}>
          Tiré de votre SIRET.
        </span>
      )}
    </label>
  );
}

/**
 * La règle du mot de passe se lit AVANT le refus. Elle ne se recopie pas : la
 * longueur vient de `mot-de-passe.ts`, et le refus complet (trop courant, son
 * nom dedans) reste celui de `refusDe`, au moment de continuer.
 */
function ReglesDuMotDePasse({ mdp, confirm }: { mdp: string; confirm: string }) {
  const tenues = [
    { cle: "longueur", texte: "12 caractères au moins", tenue: mdp.length >= 12 },
    { cle: "pareil", texte: "Les deux sont identiques", tenue: confirm !== "" && confirm === mdp },
  ];
  return (
    <ul className="ml-[22px] mt-[14px]">
      {tenues.map((r) => (
        <li key={r.cle} className="flex min-h-[30px] items-center gap-[10px] text-[14.5px]" style={{ color: r.tenue ? colors.ink : colors.inkSoft }}>
          <span
            aria-hidden="true"
            className="grid h-5 w-5 flex-none place-items-center rounded-full"
            style={r.tenue ? { background: colors.carteVertTexte, color: colors.cream } : { boxShadow: `inset 0 0 0 1.5px ${colors.chevron}` }}
          >
            {r.tenue && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
          </span>
          {r.texte}
        </li>
      ))}
    </ul>
  );
}

function Compteur({ valeur, min, max, onChange }: { valeur: number; min: number; max: number; onChange: (n: number) => void }) {
  const bouton = (pas: number, nom: string, trait: string) => (
    <button
      type="button"
      aria-label={nom}
      disabled={valeur + pas < min || valeur + pas > max}
      onClick={() => onChange(valeur + pas)}
      className="grid h-14 w-14 place-items-center rounded-full disabled:opacity-40"
      style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
        <path d={trait} />
      </svg>
    </button>
  );
  return (
    <>
      <div className="flex items-center justify-center gap-[22px]">
        {bouton(-1, "Un de moins", "M5 12h14")}
        <output aria-live="polite" className="min-w-[76px] text-center text-[56px] leading-none tabular-nums" style={SERIF}>
          {valeur}
        </output>
        {bouton(1, "Un de plus", "M12 5v14M5 12h14")}
      </div>
      <p className="mt-1 text-center text-[15.5px]" style={{ color: colors.inkSoft }}>
        {valeur > 1 ? "chantiers par jour" : "chantier par jour"}
      </p>
      <div className="mt-5 grid grid-cols-3 gap-[10px]" aria-label="Trois jours d’exemple">
        {JOURS_D_EXEMPLE.map(([jour, chantiers]) => {
          const charge = chantiers / valeur;
          const etat = etatDemi({ pris: Array.from({ length: chantiers }), charge });
          return (
            <div key={jour} className="flex flex-col gap-[7px] rounded-[12px] px-3 pb-[11px] pt-3" style={{ background: colors.card }}>
              <span className="text-[13px] font-semibold" style={{ color: colors.inkSoft }}>
                {jour}
              </span>
              <span className="whitespace-nowrap text-[17px] leading-[1.2]" style={SERIF}>
                {chantiers} {chantiers > 1 ? "chantiers" : "chantier"}
              </span>
              <span className="h-[6px] overflow-hidden rounded-full" style={{ background: colors.line }}>
                <span
                  className="block h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${partDeLaBarre(charge)}%`, background: couleurDApparence(etat, NUIT) }}
                />
              </span>
              {/* Le mot accompagne toujours la couleur. */}
              <span className="flex items-center gap-[6px] whitespace-nowrap text-[13px] font-semibold">
                <span aria-hidden="true" className="h-[10px] w-[10px] flex-none rounded-[3px]" style={{ background: couleurDApparence(etat, NUIT) }} />
                {MOT_ETAT[etat]}
              </span>
            </div>
          );
        })}
      </div>
      {/* **Sa précision du 26 octobre** : « ça ne bloque rien, c'est
          simplement visuel ». Vrai dans le code : une journée pleine se
          prévient et ne se refuse plus (sa règle du 23 août,
          `verifierJourPropose`). */}
      <p className="mt-3 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
        <b style={{ color: colors.ink, fontWeight: 600 }}>Ça ne bloque rien</b> : un jour complet se choisit quand même,
        Atlas vous prévient seulement.
      </p>
    </>
  );
}

/**
 * La photo de l'attestation : prise sur place, ou un fichier déjà là (un PDF
 * reçu par e-mail). Les formats et le poids sont ceux du dépôt de Mon
 * entreprise (`attestation-decennale.ts`), vérifiés ici pour refuser tout de
 * suite plutôt qu'après le code.
 */
function Attestation({ fichier, onFichier }: { fichier: File | null; onFichier: (f: File) => void }) {
  const photo = useRef<HTMLInputElement>(null);
  const document = useRef<HTMLInputElement>(null);
  // L'aperçu se fabrique au GESTE, et se libère quand il est remplacé ou que
  // l'écran part : une adresse `blob:` oubliée garde la photo en mémoire.
  const [apercu, setApercu] = useState<string | null>(null);
  const dernier = useRef<string | null>(null);
  useEffect(() => () => {
    if (dernier.current) URL.revokeObjectURL(dernier.current);
  }, []);

  const recevoir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (dernier.current) URL.revokeObjectURL(dernier.current);
    dernier.current = f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
    setApercu(dernier.current);
    onFichier(f);
  };
  const entrees = (
    <>
      <input ref={photo} type="file" accept={ATTESTATION_FORMATS.join(",")} capture="environment" className="hidden" onChange={recevoir} />
      <input ref={document} type="file" accept={ATTESTATION_FORMATS.join(",")} className="hidden" onChange={recevoir} />
    </>
  );

  if (fichier) {
    return (
      <>
        {entrees}
        <div className="flex items-center gap-4 rounded-[14px] p-4" style={{ background: colors.card }}>
          {apercu ? (
            // Un aperçu local (`blob:`) qui ne passe par aucun serveur : rien à
            // optimiser, comme la photo du croquis (`ArrosageClient`).
            <Image src={apercu} alt="" width={54} height={70} unoptimized className="h-[70px] w-[54px] flex-none rounded-[5px] object-cover" />
          ) : (
            <span className="grid h-[70px] w-[54px] flex-none place-items-center rounded-[5px] text-[13px] font-semibold" style={{ background: colors.cream, color: colors.inkSoft }}>
              PDF
            </span>
          )}
          <span className="min-w-0 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            <span className="block text-[18px] leading-[1.25]" style={{ ...SERIF, color: colors.ink }}>
              Votre attestation
            </span>
            Elle partira avec votre compte, jointe à vos devis et vos factures.
          </span>
        </div>
        <button
          type="button"
          onClick={() => photo.current?.click()}
          className="mt-1 flex min-h-[48px] items-center text-[15.5px] font-semibold"
          style={{ color: colors.or }}
        >
          Reprendre la photo
        </button>
      </>
    );
  }
  return (
    <>
      {entrees}
      <button
        type="button"
        onClick={() => photo.current?.click()}
        // En creux d'or, pas en plein : « Continuer » est déjà le bouton plein
        // de l'écran, et deux aplats ne disent plus lequel compte.
        className="flex min-h-[56px] w-full items-center justify-center gap-[10px] rounded-full text-[17px] font-semibold"
        style={{ color: colors.or, boxShadow: `inset 0 0 0 1.5px ${colors.or}` }}
      >
        Prendre la photo
      </button>
      <button
        type="button"
        onClick={() => document.current?.click()}
        className="mt-[10px] flex min-h-[56px] w-full items-center justify-center rounded-full text-[17px] font-semibold"
        style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
      >
        Choisir un fichier
      </button>
    </>
  );
}
