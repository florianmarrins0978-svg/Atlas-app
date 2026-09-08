"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  CHAPITRES,
  avanceToutSeul,
  phraseDeCeQuiManque,
  questionsApplicables,
  refusDe,
  reponsesProposees,
  resteAFaire,
  totalAnnonce,
  typographie,
  type Question,
} from "@/lib/creation-compte";
import { charte } from "@/lib/chartes";
import OeilMotDePasse from "@/components/atlas/OeilMotDePasse";
import { creerLeCompteAction } from "./actions";
import type { SaisieCompte } from "@/server/repositories/creation-compte";

/**
 * CRÉER UN COMPTE — une question à la fois.
 *
 * Écran 2 de `appli/la-porte-en-plein-air.html`, qu'il a choisi le 8 septembre
 * 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI EST ÉCRIT ICI, ET CE QUI NE L'EST PAS.** L'ordre des questions, ce
 * qui est obligatoire, ce qui ne se pose que dans certains cas, le total
 * annoncé et ce qu'on dit à la fin vivent dans `src/lib/creation-compte.ts` :
 * ce sont des règles, elles s'éprouvent sans base et sans navigateur
 * (`CLAUDE.md` §3). Ce fichier ne fait que les montrer.
 *
 * **POURQUOI LA CHARTE « NUIT » EST NOMMÉE, ET POURQUOI AUCUNE COULEUR N'EST
 * ÉCRITE À LA MAIN.** Ici, personne n'est connu : il n'y a pas de charte
 * choisie à lire, et la planche qu'il a retenue est sombre. On nomme donc la
 * charte — et l'on prend SES jetons, jamais des valeurs recopiées. La planche
 * portait un gris et un or à elle, à un cheveu de ceux du produit : les
 * recopier aurait fait vivre huit chartes et demie (`CLAUDE.md` §3).
 *
 * **UN SEUL CHAMP EST MONTÉ À LA FOIS**, jamais seize cachés : un formulaire
 * masqué garde ses valeurs, et une question « passée » plus haut reviendrait
 * remplie sans que personne l'ait retapée.
 */

const NUIT = charte("nuit").jetons;
const FOND = `radial-gradient(120% 62% at 8% 4%, ${NUIT.rustTint} 0%, ${NUIT.card} 40%, ${NUIT.cream} 78%)`;
const SERIF = { fontFamily: "ui-serif, Georgia, serif" } as const;
const CHAMP = {
  background: NUIT.card,
  color: NUIT.ink,
  boxShadow: `inset 0 0 0 1px ${NUIT.line}`,
} as const;

export default function CreerUnComptePage() {
  const router = useRouter();
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [rang, setRang] = useState(0);
  const [refus, setRefus] = useState<string | null>(null);
  const [fini, setFini] = useState(false);
  const [deroulantOuvert, setDeroulantOuvert] = useState(false);
  const [mdpVisible, setMdpVisible] = useState<Record<string, boolean>>({});
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
    setDeroulantOuvert(false);
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

  /** « Passer » efface la réponse : ce qui est passé est vide, pas proposé. */
  function passer() {
    if (!question) return;
    const sans = { ...reponses, [question.id]: "" };
    setReponses(sans);
    suivante(sans);
  }

  function envoyer(completes: Record<string, string>) {
    demarrer(async () => {
      const saisie: SaisieCompte = {
        civilite: completes.identite === "mme" ? "mme" : "mr",
        prenom: completes.prenom ?? "",
        nom: completes.nom ?? "",
        email: completes.email ?? "",
        motDePasse: completes.mdp ?? "",
        entreprise: completes.entreprise ?? "",
        forme: completes.forme ?? "",
        siret: completes.siret,
        adresse: completes.adresse,
        capital: completes.capital,
        rcs: completes.rcs,
        telephone: completes.tel,
        emailPro: completes.emailPro,
        tva: completes.tva === "assujettie" ? "assujettie" : "franchise",
        numeroTva: completes.numTva,
        iban: completes.iban,
        titulaire: completes.titulaire,
        moyens: completes.moyens,
      };
      const etat = await creerLeCompteAction(saisie);
      if (etat?.refus) {
        setRefus(etat.refus);
        return;
      }
      setFini(true);
    });
  }

  const manque = fini ? phraseDeCeQuiManque(resteAFaire(reponses)) : null;

  return (
    <div
      className="atlas-bas-sans-barre flex min-h-[100dvh] flex-col px-[22px]"
      style={{ background: FOND, color: NUIT.ink }}
    >
      {!fini && question && (
        <>
          <button
            type="button"
            onClick={() => (rang === 0 ? router.push("/bienvenue") : setRang(rang - 1))}
            className="flex flex-shrink-0 items-center gap-[6px] self-start py-2 pr-[10px] pt-[10px] text-[14px]"
            style={{ color: NUIT.muted }}
            aria-label="Revenir en arrière"
          >
            {/* Le chevron du retour montre un SENS : ce n'est pas une flèche
                décorative au bout d'un libellé (`CLAUDE.md` §3). */}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5 8 12l7 7" />
            </svg>
            Retour
          </button>

          <div className="mt-2 flex-shrink-0">
            <div className="mb-[10px] flex items-baseline justify-between text-[12.5px]" style={{ color: NUIT.muted }}>
              <b style={{ color: NUIT.ink, fontWeight: 500 }}>{question.chapitre}</b>
              <span>
                {rang + 1} sur {total}
              </span>
            </div>
            {/* **UN SEGMENT PAR CHAPITRE, ET NON UN POURCENTAGE.** Il montre
                COMBIEN il reste d'étapes — ce qu'une barre pleine à 40 % ne dit
                pas. Relevé sur sa capture de Qonto du 8 septembre. */}
            <div className="flex gap-[5px]" aria-hidden="true">
              {CHAPITRES.map((chap) => {
                const passe = CHAPITRES.indexOf(chap) < CHAPITRES.indexOf(question.chapitre);
                const ici = chap === question.chapitre;
                return (
                  <div
                    key={chap}
                    className="h-[3px] flex-1 overflow-hidden rounded-full"
                    style={{ background: NUIT.line }}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-200"
                      style={{ width: passe ? "100%" : ici ? "50%" : "0%", background: NUIT.or }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center py-6">
            <h1 className="mb-4 text-[30px] leading-[1.1]" style={SERIF}>
              {typographie(question.question)}
            </h1>
            {question.aide && (
              <p className="mb-4 -mt-2 text-[14px] leading-[1.5]" style={{ color: NUIT.muted }}>
                {question.aide}
              </p>
            )}

            {/* Deux cases côte à côte, DANS un groupe : la civilité. */}
            {question.choix && (
              <div className="mb-[10px] flex gap-[10px]">
                {question.choix.map((c) => {
                  const choisi = vues[question.id] === c.valeur;
                  return (
                    <button
                      key={c.valeur}
                      type="button"
                      aria-pressed={choisi}
                      onClick={() => repondre(question.id, c.valeur)}
                      className="flex-1 rounded-full py-[15px] text-center text-[16px]"
                      style={{
                        background: NUIT.card,
                        color: NUIT.ink,
                        boxShadow: choisi ? `inset 0 0 0 2px ${NUIT.or}` : `inset 0 0 0 1px ${NUIT.line}`,
                      }}
                    >
                      {c.titre}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Plusieurs cases sur le même écran : l'identité, le mot de passe. */}
            {question.champs?.map((champ) => (
              <div key={champ.cle} className="mb-[10px] flex items-center" style={{ ...CHAMP, borderRadius: 9999 }}>
                <input
                  type={champ.oeil && mdpVisible[champ.cle] ? "text" : champ.type}
                  name={champ.cle}
                  placeholder={champ.placeholder}
                  autoComplete={champ.autocomplete}
                  value={vues[champ.cle] ?? ""}
                  onChange={(e) => repondre(champ.cle, e.target.value)}
                  className="min-w-0 flex-1 bg-transparent px-5 py-[15px] text-[16px] outline-none"
                  style={{ color: NUIT.ink }}
                />
                {champ.oeil && (
                  <OeilMotDePasse
                    ouvert={Boolean(mdpVisible[champ.cle])}
                    onBasculer={() => setMdpVisible((v) => ({ ...v, [champ.cle]: !v[champ.cle] }))}
                    quoi="le mot de passe"
                    couleur={NUIT.muted}
                    couleurOuvert={NUIT.orTexte}
                    className="mr-[6px]"
                  />
                )}
              </div>
            ))}

            {/* Deux grands choix qui remplissent la question : la TVA. */}
            {question.liste && (
              <div className="flex flex-col gap-[10px]">
                {question.liste.map((o) => (
                  <button
                    key={o.valeur}
                    type="button"
                    aria-pressed={vues[question.id] === o.valeur}
                    onClick={() => {
                      const avec = { ...reponses, [question.id]: o.valeur };
                      setReponses(avec);
                      suivante(avec);
                    }}
                    // **`rounded-full` et non le rectangle arrondi de la
                    // planche** : sa règle du 12 août 2026 — la même forme
                    // partout —, et `test-boutons-arrondis.ts` la tient. Le
                    // rembourrage passe à 26 px, sinon le texte entre dans la
                    // courbe sur une carte de deux lignes.
                    className="rounded-full px-[26px] py-[15px] text-left"
                    style={{ background: NUIT.card, boxShadow: `inset 0 0 0 1px ${NUIT.line}` }}
                  >
                    <span className="block text-[16px]" style={{ color: NUIT.ink }}>
                      {o.titre}
                    </span>
                    <span className="mt-1 block text-[13px]" style={{ color: NUIT.muted }}>
                      {o.note}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Un seul champ : le cas ordinaire. */}
            {!question.champs && !question.liste && !question.deroulant && (
              <input
                type={question.type ?? "text"}
                name={question.id}
                placeholder={question.placeholder}
                autoComplete={question.autocomplete}
                value={vues[question.id] ?? ""}
                onChange={(e) => repondre(question.id, e.target.value)}
                className="w-full rounded-full px-5 py-[15px] text-[16px] outline-none"
                style={CHAMP}
              />
            )}

            {/* LE BANDEAU DÉROULANT, DESSINÉ ICI ET PAS PAR LE TÉLÉPHONE.
                Sa remarque du 8 septembre : « le bandeau déroulant doit
                respecter la charte de couleur et de style de l'appli ». Un
                <select> natif ne le peut pas — c'est le système qui dessine sa
                roue, et aucune charte d'Atlas ne l'atteint. */}
            {question.deroulant && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDeroulantOuvert((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={deroulantOuvert}
                  className="flex w-full items-center justify-between rounded-full px-5 py-[15px] text-left text-[16px]"
                  style={CHAMP}
                >
                  <span style={{ color: vues[question.id] ? NUIT.ink : NUIT.muted }}>
                    {libelleChoisi(question, vues[question.id])}
                  </span>
                  <svg width="14" height="9" viewBox="0 0 14 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 1l6 6 6-6" />
                  </svg>
                </button>
                {deroulantOuvert && (
                  <div
                    role="listbox"
                    /* **IL S'OUVRE VERS LE HAUT, et c'est une capture qui l'a
                       montré** (8 septembre 2026) : déplié vers le bas, le
                       panneau passait sous le bord de l'écran — les dernières
                       formes étaient hors de portée, et « Continuer » avec
                       elles. Au-dessus du champ, la question laisse justement
                       la place : c'est ce que fait la roue du téléphone. */
                    className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-10 max-h-[260px] overflow-y-auto rounded-[14px] py-1"
                    style={{ background: NUIT.card, boxShadow: `inset 0 0 0 1px ${NUIT.line}` }}
                  >
                    {question.deroulant.map((o) => (
                      <button
                        key={o.valeur}
                        type="button"
                        role="option"
                        aria-selected={vues[question.id] === o.valeur}
                        onClick={() => {
                          repondre(question.id, o.valeur);
                          setDeroulantOuvert(false);
                        }}
                        className="block w-full px-5 py-3 text-left"
                      >
                        <span className="block text-[15.5px]" style={{ color: NUIT.ink }}>
                          {o.titre}
                        </span>
                        <span className="mt-[2px] block text-[12.5px]" style={{ color: NUIT.muted }}>
                          {o.note}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* La place du refus est réservée en permanence : un message qui
                apparaît pousserait « Continuer » d'une ligne, au moment précis
                où le doigt se pose dessus. Même soin que sur `/login`. */}
            <p className="mt-3 min-h-[19px] text-[13px] leading-[19px]" role="alert" aria-live="polite" style={{ color: NUIT.alerte }}>
              {refus ?? ""}
            </p>
          </div>

          <div className="flex-shrink-0">
            {/* Sur un choix entre deux, « Continuer » n'a rien à valider. */}
            {!avanceToutSeul(question) && (
              <button
                type="button"
                onClick={avancer}
                disabled={enCours}
                className="w-full rounded-full py-4 text-[17px] leading-none transition-transform active:scale-[0.985] disabled:opacity-60"
                style={{ background: NUIT.rust, color: NUIT.cream, ...SERIF }}
              >
                {enCours ? "Un instant…" : rang + 1 === questions.length ? "Créer mon compte" : "Continuer"}
              </button>
            )}
            {/* « Passer » n'apparaît QUE là où passer est permis : un bouton
                grisé sur une question obligatoire ferait croire le contraire. */}
            {!question.requis && (
              <button
                type="button"
                onClick={passer}
                className="w-full bg-transparent pb-1 pt-[13px] text-[14.5px]"
                style={{ color: NUIT.muted }}
              >
                Passer
              </button>
            )}
          </div>
        </>
      )}

      {fini && (
        <div className="flex flex-1 flex-col justify-center">
          <h2 className="mb-3 text-[30px] leading-[1.1]" style={SERIF}>
            {manque ? "C’est fait." : "Tout est prêt."}
          </h2>
          {/* **Passer une question n'est pas l'oublier.** Sans cette ligne, le
              premier devis sortirait sans SIRET, et c'est le client qui le
              remarquerait. */}
          <p className="mb-6 text-[14.5px] leading-[1.6]" style={{ color: NUIT.muted }}>
            {manque ? (
              <>
                {manque} À remplir quand vous voulez dans <b style={{ color: NUIT.ink }}>Réglages</b>, puis{" "}
                <b style={{ color: NUIT.ink }}>Mon entreprise</b>.
              </>
            ) : (
              <>Vos réglages sont remplis. Votre premier devis peut partir.</>
            )}
          </p>
          <Link
            href="/"
            className="block w-full rounded-full py-4 text-center text-[17px] leading-none"
            style={{ background: NUIT.rust, color: NUIT.cream, ...SERIF }}
          >
            Entrer dans Atlas
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Ce que le viseur du déroulant affiche.
 *
 * **Le sigle SEUL ne se retient pas** — « EURL » et « SASU » ne disent rien :
 * son nom complet voyage avec lui, replié comme déplié.
 */
function libelleChoisi(question: Question, valeur: string | undefined): string {
  const o = question.deroulant?.find((x) => x.valeur === valeur);
  return o ? `${o.titre} — ${o.note}` : "Choisissez";
}
