"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { useAssistant } from "./assistant-contexte";
import { rendreMarkdownSimple } from "./rendreMarkdownSimple";
import OndeDeVoix from "./OndeDeVoix";
import { poserQuestionAction, lireFilAction, viderFilAction, dicterQuestionAction, regarderPhotoAction } from "@/app/assistant/actions";
import { appliquerPropositionsAction } from "@/app/chantiers/[id]/informations/actions";
import type { ResultatApplicationProposition, ResultatConfirmation } from "@/server/ai/propositions";
import type { PropositionAvecId } from "@/server/ai/services/assistant-service";

type PropositionAvecEtat = { proposition: PropositionAvecId; coche: boolean };

type Message = {
  role: "user" | "assistant";
  contenu: string;
  sources?: string[];
  propositions?: PropositionAvecEtat[];
  statutPropositions?: "en_attente" | "appliquee" | "annulee";
  resultats?: ResultatApplicationProposition[];
  avertissement?: string;
};

function chantierIdDepuisChemin(pathname: string): string | null {
  const m = pathname.match(/^\/chantiers\/([0-9a-f-]{36})(?:\/|$)/);
  return m ? m[1] : null;
}

export default function AssistantSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const chantierId = chantierIdDepuisChemin(pathname ?? "");

  // **L'état ne vit plus ici.** Le bouton a quitté ce composant pour l'en-tête
  // des écrans (proposition B, 13 août 2026) ; les deux se parlent par
  // `assistant-contexte`. Ce composant garde le panneau, qui doit rester
  // au-dessus de tout, donc dans le gabarit racine.
  const assistant = useAssistant();
  const ouvert = assistant?.ouvert ?? false;
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  // Un ref, pas un état : relire le fil ne doit pas provoquer un rendu de plus.
  const filRelu = useRef(false);
  /** Ce qu'une photo montrée a donné à lire — parti avec la prochaine question. */
  const [observation, setObservation] = useState<string | null>(null);
  const [dictee, setDictee] = useState<"repos" | "enregistre" | "traite">("repos");
  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [souci, setSouci] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const morceaux = useRef<Blob[]>([]);
  /** Le flux du micro, gardé le temps de peindre l'onde. */
  const [flux, setFlux] = useState<MediaStream | null>(null);
  /**
   * Ce qu'on fait de la dictée quand elle revient : la poser dans le champ, ou
   * l'envoyer tout de suite.
   *
   * **Sa demande du 27 août 2026, WhatsApp à l'appui :** *« le bouton envoyer,
   * à partir du moment où j'appuie, ça envoie la dictée automatiquement »*.
   *
   * **Cela revient sur la règle du 7 août** — *« elle remplit, elle ne valide
   * pas »* —, et c'est LUI qui l'a demandé, geste à l'appui. La relecture reste
   * possible : arrêter par le micro repose le texte dans le champ. C'est le
   * bouton d'envoi, et lui seul, qui part sans relire.
   */
  const envoiDirect = useRef(false);
  const finListeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ouvert) finListeRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, ouvert]);

  /**
   * **Le fil se relit à la PREMIÈRE ouverture, une seule fois.**
   *
   * Sa demande du 27 août 2026 : « qu'il se souvienne ». Le fil vivait ici, et
   * mourait au rechargement — or son onglet reste ouvert des heures et son banc
   * redémarre plusieurs fois par soirée (`HANDOVER.md`, piège 0).
   *
   * **À l'ouverture, pas au montage** : ce composant est dans le gabarit
   * racine, donc sur CHAQUE écran. Relire au montage coûterait une requête à
   * chaque navigation, pour un panneau qu'il n'ouvre pas.
   *
   * **Et jamais par-dessus ce qu'il vient d'écrire** : le drapeau ne retombe
   * pas à la fermeture. Rouvrir le panneau au milieu d'un échange doit retrouver
   * l'écran tel qu'il l'a laissé, pas la version enregistrée.
   */
  useEffect(() => {
    if (!ouvert || filRelu.current) return;
    filRelu.current = true;
    void lireFilAction().then((fil) => {
      if (fil.length === 0) return;
      setMessages((cur) => (cur.length > 0 ? cur : fil.map((m) => ({ role: m.role, contenu: m.contenu }))));
    });
  }, [ouvert]);

  /**
   * DICTER — le micro remplit le champ, il n'envoie rien.
   *
   * **Sa demande du 27 août 2026 : « fais la 1 ».** Le geste est celui de
   * `DicterCoordonnees` (7 août), et la règle avec : *elle remplit, elle ne
   * valide pas*. Une question mal entendue qui partirait toute seule pourrait
   * déclencher une proposition sur le mauvais client.
   *
   * **La piste se relâche à l'arrêt**, sinon le voyant du micro reste allumé
   * sur le téléphone et l'on se croit encore écouté.
   */
  /** Arrêter d'écouter : le magnétophone rend la main, `onstop` fait le reste. */
  function arreterLaDictee(direct: boolean) {
    envoiDirect.current = direct;
    recorder.current?.stop();
    recorder.current = null;
    setDictee("traite");
  }

  /** Jeter ce qu'on vient de dire, sans rien envoyer — la corbeille de WhatsApp. */
  function jeterLaDictee() {
    envoiDirect.current = false;
    const mr = recorder.current;
    recorder.current = null;
    if (mr) {
      // **On coupe `onstop` AVANT d'arrêter** : sans cela, la dictée jetée
      // partirait quand même chez le transcripteur, et se paierait.
      mr.onstop = null;
      mr.stop();
    }
    flux?.getTracks().forEach((t) => t.stop());
    setFlux(null);
    setDictee("repos");
  }

  async function dicter() {
    if (dictee === "enregistre") {
      // Le micro touché une seconde fois REPOSE le texte dans le champ : c'est
      // le chemin de celui qui veut se relire.
      arreterLaDictee(false);
      return;
    }
    setSouci(null);
    try {
      const capte = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(capte);
      morceaux.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) morceaux.current.push(e.data);
      };
      mr.onstop = async () => {
        // La piste est relâchée dès l'arrêt : sans cela, le voyant du micro
        // reste allumé sur le téléphone, et l'on se croit encore écouté.
        capte.getTracks().forEach((t) => t.stop());
        setFlux(null);
        const direct = envoiDirect.current;
        envoiDirect.current = false;
        const blob = new Blob(morceaux.current, { type: mr.mimeType || "audio/webm" });
        try {
          const fd = new FormData();
          // **Le nom suit le VRAI type.** Sur iPhone, le magnétophone rend du
          // mp4 : appeler le fichier « .webm » n'empêche rien (la porte lit les
          // octets) mais rend le journal illisible le jour où l'on cherche.
          const type = blob.type || "audio/webm";
          const nom = type.includes("mp4") ? "question.m4a" : type.includes("ogg") ? "question.ogg" : "question.webm";
          fd.set("fichier", new File([blob], nom, { type }));
          const r = await dicterQuestionAction(fd);
          if (!r.ok) {
            setSouci(r.raison);
            return;
          }
          if (direct) {
            // **Sa demande du 27 août : le bouton d'envoi part sans relire.**
            await envoyer(r.texte);
          } else {
            // **On AJOUTE à ce qui est déjà écrit.** Écraser une phrase
            // commencée au clavier serait la pire façon d'aider.
            setSaisie((cur) => (cur.trim() ? `${cur.trim()} ${r.texte}` : r.texte));
          }
        } catch {
          setSouci("La dictée n'a pas abouti. Vous pouvez écrire votre question.");
        } finally {
          setDictee("repos");
        }
      };
      mr.start();
      recorder.current = mr;
      setFlux(capte);
      setDictee("enregistre");
    } catch {
      setSouci("Le micro n'est pas accessible. Vérifiez l'autorisation dans votre navigateur.");
      setDictee("repos");
    }
  }

  /**
   * MONTRER UNE PHOTO — elle est lue tout de suite, et la lecture attend la
   * question.
   *
   * **Lue au moment où il la choisit, pas à l'envoi** : il voit immédiatement
   * si elle a été comprise, et peut la reprendre avant d'écrire sa question.
   * Attendre l'envoi, c'est lui faire taper une phrase pour rien.
   */
  async function montrerPhoto(fichier: File) {
    setSouci(null);
    setPhotoEnCours(true);
    try {
      const fd = new FormData();
      fd.set("photo", fichier);
      const r = await regarderPhotoAction(fd);
      if (r.ok) setObservation(r.lecture);
      else setSouci(r.raison);
    } catch {
      setSouci("La photo n'a pas pu être regardée.");
    } finally {
      setPhotoEnCours(false);
    }
  }

  async function oublier() {
    setMessages([]);
    await viderFilAction();
  }

  /**
   * @param dictee Le texte qui vient d'être dicté, quand il part sans relecture.
   *   **Passé en argument, jamais lu dans l'état** : `setSaisie` ne s'applique
   *   pas avant le rendu suivant, et la question serait partie vide.
   */
  async function envoyer(dictee?: string) {
    // **Une photo seule vaut une question.** Il la montre et attend qu'on lui
    // dise ce qu'on y voit ; exiger une phrase serait lui faire taper « c'est
    // quoi ? » à chaque fois.
    const question =
      (dictee ?? "").trim() || saisie.trim() || (observation ? "Que vois-tu sur cette photo ?" : "");
    if (!question || enCours) return;
    setSaisie("");
    const historiquePourAction = messages.map((m) => ({ role: m.role, contenu: m.contenu }));
    setMessages((cur) => [...cur, { role: "user", contenu: question }]);
    setEnCours(true);
    try {
      // **L'observation part AVEC la question, et une seule fois.** La garder
      // ferait relire la photo à chaque phrase suivante, et le modèle
      // répondrait à un cliché qu'il ne regarde plus.
      const reponse = await poserQuestionAction(chantierId, historiquePourAction, question, observation ?? undefined);
      setObservation(null);
      if (reponse.succes) {
        setMessages((cur) => [
          ...cur,
          {
            role: "assistant",
            contenu: reponse.texte,
            sources: reponse.sources,
            propositions: reponse.propositions?.map((p) => ({ proposition: p, coche: true })),
            statutPropositions: reponse.propositions && reponse.propositions.length > 0 ? "en_attente" : undefined,
          },
        ]);
      } else {
        setMessages((cur) => [...cur, { role: "assistant", contenu: reponse.erreur }]);
      }
    } catch {
      setMessages((cur) => [...cur, { role: "assistant", contenu: "L'assistant est momentanément indisponible." }]);
    } finally {
      setEnCours(false);
    }
  }

  function basculerCase(indexMessage: number, indexProposition: number) {
    setMessages((cur) =>
      cur.map((m, i) =>
        i === indexMessage && m.propositions
          ? {
              ...m,
              propositions: m.propositions.map((p, j) => (j === indexProposition ? { ...p, coche: !p.coche } : p)),
            }
          : m
      )
    );
  }

  async function annulerPropositions(indexMessage: number) {
    setMessages((cur) => cur.map((m, i) => (i === indexMessage ? { ...m, statutPropositions: "annulee" } : m)));
  }

  async function appliquerPropositions(indexMessage: number) {
    // **Plus de sortie muette sans chantier.** Depuis le 26 août 2026, un geste
    // peut n'en concerner aucun — créer un chantier, régler un tarif. Ce
    // `return` rendait alors le bouton « Appliquer » inerte : il s'enfonçait, et
    // rien ne se passait, ce qui se lit comme une panne.
    const message = messages[indexMessage];
    if (!message.propositions) return;
    const idsRetenus = message.propositions.filter((p) => p.coche).map((p) => p.proposition.id);
    if (idsRetenus.length === 0) {
      setMessages((cur) => cur.map((m, i) => (i === indexMessage ? { ...m, statutPropositions: "annulee" } : m)));
      return;
    }
    setEnCours(true);
    try {
      const { resultats, avertissement }: ResultatConfirmation = await appliquerPropositionsAction(chantierId, idsRetenus);
      setMessages((cur) =>
        cur.map((m, i) => (i === indexMessage ? { ...m, statutPropositions: "appliquee", resultats, avertissement } : m))
      );
      // Rafraîchit les données serveur de l'écran courant (pas un rechargement
      // complet de la page) — les propositions décochées ne sont jamais
      // exécutées, seules celles retenues ci-dessus le sont.
      router.refresh();
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      {/*
        **Plus de bulle flottante.** Elle recouvrait quelque chose sur cinq
        écrans, et cinq fois c'est l'écran qu'on a déplacé pour l'éviter
        (`ARCHITECTURE.md` §106). Son bouton est maintenant dans l'en-tête, où il
        ne peut rien couvrir : `BoutonAssistant`, posé par `EnTeteEcran`.
      */}
      {ouvert && (
        <div className="fixed inset-0 z-40 flex justify-end" style={{ backgroundColor: "rgba(0,0,0,0.25)" }}>
          <div
            className="flex h-full w-full max-w-sm flex-col"
            style={{ backgroundColor: colors.cream }}
          >
            <div className="flex items-center justify-between border-b px-4 py-4" style={{ borderColor: colors.line }}>
              <span className="text-[16px] font-semibold" style={{ fontFamily: font.display, color: colors.ink }}>
                Assistant
              </span>
              <div className="flex items-center gap-3">
                {/* **« Oublier » n'apparaît que s'il y a quelque chose à
                    oublier.** Un panneau vide portant ce mot ferait croire à un
                    réglage ; là, il ne dit rien de plus que ce qu'il fait. */}
                {messages.length > 0 && (
                  <button
                    onClick={oublier}
                    data-atlas="oublier-le-fil"
                    className="text-[13px]"
                    style={{ color: colors.muted }}
                  >
                    Oublier
                  </button>
                )}
                <button onClick={() => assistant?.fermer()} aria-label="Fermer" className="text-[20px]" style={{ color: colors.muted }}>
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <p className="text-[13px]" style={{ color: colors.muted }}>
                  Une question sur ce chantier, ou sur l&apos;application : « comment je supprime un chantier ? »
                </p>
              )}
              <div className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    // Une marque pour la capture : elle compte les RÉPONSES, et
                    // une réponse hors périmètre n'affiche aucune source
                    // (`scripts/capture-assistant-mode-emploi.mts`).
                    data-atlas={m.role === "assistant" ? "bulle-assistant" : "bulle-question"}
                    className="max-w-[85%] rounded-[4px] px-3 py-2 text-[14px]"
                    style={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      backgroundColor: m.role === "user" ? colors.rustTint : colors.card,
                      color: colors.ink,
                    }}
                  >
                    <div className="flex flex-col gap-1">{rendreMarkdownSimple(m.contenu)}</div>

                    {m.propositions && m.propositions.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1.5 border-t pt-2" style={{ borderColor: colors.line }}>
                        {m.propositions.map((p, j) => (
                          <label key={j} className="flex items-start gap-2 text-[13px]">
                            <input
                              type="checkbox"
                              checked={p.coche}
                              disabled={m.statutPropositions !== "en_attente"}
                              onChange={() => basculerCase(i, j)}
                              className="mt-0.5"
                            />
                            <span>
                              {p.proposition.description}
                              {m.resultats && (
                                <span
                                  className="ml-1 font-medium"
                                  style={{
                                    color:
                                      m.resultats.find((r) => r.propositionId === p.proposition.id)?.statut === "conflit"
                                        ? colors.alert
                                        : colors.rust,
                                  }}
                                >
                                  {m.resultats.find((r) => r.propositionId === p.proposition.id)?.statut === "conflit"
                                    ? ` — Conflit : ${m.resultats.find((r) => r.propositionId === p.proposition.id)?.message ?? ""}`
                                    : " — Appliqué"}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}

                        {m.avertissement && (
                          <p className="text-[12px] font-medium" style={{ color: colors.alert }}>
                            ⚠ {m.avertissement}
                          </p>
                        )}

                        {m.statutPropositions === "en_attente" && (
                          <div className="mt-1 flex gap-2">
                            <button
                              onClick={() => appliquerPropositions(i)}
                              disabled={enCours}
                              className="atlas-plein flex-1 rounded-full py-2 text-[13px] font-medium text-white disabled:opacity-40"
                              style={{ backgroundColor: colors.rust }}
                            >
                              Appliquer les modifications
                            </button>
                            <button
                              onClick={() => annulerPropositions(i)}
                              className="flex-1 rounded-full py-2 text-[13px] font-medium"
                              style={{ backgroundColor: colors.line, color: colors.ink }}
                            >
                              Annuler
                            </button>
                          </div>
                        )}
                        {m.statutPropositions === "annulee" && (
                          <p className="text-[12px] font-medium" style={{ color: colors.muted }}>
                            Annulé.
                          </p>
                        )}
                      </div>
                    )}
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 border-t pt-1.5 text-[11px]" style={{ borderColor: colors.line, color: colors.muted }}>
                        Sources :
                        <ul>
                          {m.sources.map((s, j) => (
                            <li key={j}>• {libelleSource(s)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
                {enCours && (
                  <p className="text-[13px]" style={{ color: colors.muted }}>
                    L&apos;assistant réfléchit…
                  </p>
                )}
                <div ref={finListeRef} />
              </div>
            </div>

            {/* **Ce qui s'est passé se DIT, à l'endroit où ça se passe.** Un
                micro qui ne prend pas, une photo refusée : sans un mot, l'écran
                a l'air en panne (`AGENTS.md`, le défaut muet). */}
            {(observation || souci || photoEnCours || dictee !== "repos") && (
              <div className="border-t px-3 pt-2 text-[12.5px]" style={{ borderColor: colors.line, color: colors.muted }}>
                {dictee === "enregistre" && <span data-atlas="dictee-en-cours">Je vous écoute — appuyez à nouveau pour arrêter.</span>}
                {dictee === "traite" && <span>Transcription…</span>}
                {photoEnCours && <span data-atlas="photo-en-cours">Je regarde la photo…</span>}
                {observation && !photoEnCours && (
                  <span data-atlas="photo-lue" className="flex items-center gap-2">
                    <span className="flex-1">Photo lue — elle part avec votre question.</span>
                    <button onClick={() => setObservation(null)} className="underline" style={{ color: colors.muted }}>
                      Retirer
                    </button>
                  </span>
                )}
                {souci && <span data-atlas="souci-assistant" style={{ color: colors.alert }}>{souci}</span>}
              </div>
            )}

            {/* **PENDANT QU'IL PARLE, LA BARRE CHANGE — sa demande du 27 août
                2026, capture de WhatsApp à l'appui.** Corbeille à gauche, le
                zigzag au milieu, l'envoi à droite. Le champ disparaît : il n'y
                a rien à taper tant qu'on parle, et le laisser ferait croire
                qu'il faut faire les deux. */}
            {dictee === "enregistre" ? (
              <div
                className="flex items-center gap-3 border-t px-3 py-3"
                style={{ borderColor: colors.line }}
                data-atlas="barre-dictee"
              >
                <button
                  onClick={jeterLaDictee}
                  aria-label="Jeter la dictée"
                  data-atlas="jeter-dictee"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.card }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" style={{ stroke: colors.ink }}>
                    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                  </svg>
                </button>

                <OndeDeVoix flux={flux} />

                <button
                  onClick={() => arreterLaDictee(true)}
                  aria-label="Envoyer la dictée"
                  data-atlas="envoyer-dictee"
                  className="atlas-plein flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.rust }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" style={{ fill: surPlein }}>
                    <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
                  </svg>
                </button>
              </div>
            ) : (
            <div className="flex items-center gap-2 border-t px-3 py-3" style={{ borderColor: colors.line }}>
              {/* **Le micro et l'appareil photo, à gauche du champ.** Discrets,
                  sans libellé : ce sont des raccourcis pour qui a les mains
                  prises, pas l'action principale de l'écran. */}
              <button
                onClick={dicter}
                disabled={enCours || dictee === "traite"}
                aria-label="Dicter la question"
                data-atlas="micro-assistant"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full disabled:opacity-40"
                style={{ backgroundColor: colors.card }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" style={{ stroke: colors.ink }}>
                  <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
                  <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
                </svg>
              </button>

              <label
                aria-label="Montrer une photo"
                data-atlas="photo-assistant"
                className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full"
                style={{ backgroundColor: colors.card }}
              >
                {/* **PAS de `capture`, et c'est sa demande du 27 août 2026 :**
                    *« je peux prendre en photo mais pas avoir accès à la
                    photothèque »*. `capture` force l'appareil photo sur iPhone
                    et ferme la pellicule — or ce qu'il veut montrer est souvent
                    DÉJÀ pris : un devis reçu, une plaque photographiée la
                    veille. Sans cet attribut, iOS propose les deux.

                    `accept` reste large : un iPhone rend du HEIC, et la porte
                    d'entrée sait le refuser avec un message qui se comprend. */}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void montrerPhoto(f);
                  }}
                />
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" style={{ stroke: colors.ink }}>
                  <path d="M3 8h3l2-2h8l2 2h3v11H3z" />
                  <circle cx="12" cy="13" r="3.2" />
                </svg>
              </label>

              <input
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void envoyer();
                }}
                placeholder="Votre question…"
                className="flex-1 rounded-[4px] border-0 px-4 py-2.5 outline-none"
                style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "14px" }}
              />
              <button
                onClick={() => void envoyer()}
                disabled={enCours || (!saisie.trim() && !observation)}
                aria-label="Envoyer"
                className="atlas-plein flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full disabled:opacity-40"
                style={{ backgroundColor: colors.rust }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" style={{ fill: surPlein }}>
                  <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
                </svg>
              </button>
            </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function libelleSource(nomOutil: string): string {
  const libelles: Record<string, string> = {
    LireInformationsChantier: "Informations chantier",
    LirePrestations: "Prestations",
    LireMateriels: "Matériel",
    LireTranscription: "Transcription",
    LireNotes: "Notes vocales",
    LireDevis: "Devis",
    LireTarifs: "Tarifs",
    RechercherModeEmploi: "Mode d'emploi",
    RechercherLignesDevis: "Devis des autres clients",
  };
  return libelles[nomOutil] ?? nomOutil;
}
