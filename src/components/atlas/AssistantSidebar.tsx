"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import { useAssistant } from "./assistant-contexte";
import { rendreMarkdownSimple } from "./rendreMarkdownSimple";
import { poserQuestionAction } from "@/app/assistant/actions";
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
  const finListeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ouvert) finListeRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, ouvert]);

  async function envoyer() {
    const question = saisie.trim();
    if (!question || enCours) return;
    setSaisie("");
    const historiquePourAction = messages.map((m) => ({ role: m.role, contenu: m.contenu }));
    setMessages((cur) => [...cur, { role: "user", contenu: question }]);
    setEnCours(true);
    try {
      const reponse = await poserQuestionAction(chantierId, historiquePourAction, question);
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
    if (!chantierId) return;
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
        (`ARCHITECTURE.md` §85). Son bouton est maintenant dans l'en-tête, où il
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
              <button onClick={() => assistant?.fermer()} aria-label="Fermer" className="text-[20px]" style={{ color: colors.muted }}>
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <p className="text-[13px]" style={{ color: colors.muted }}>
                  Posez une question sur ce chantier : prestations, matériel, transcription, devis, tarifs…
                </p>
              )}
              <div className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
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
                              className="flex-1 rounded-full py-2 text-[13px] font-medium text-white disabled:opacity-40"
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

            <div className="flex items-center gap-2 border-t px-3 py-3" style={{ borderColor: colors.line }}>
              <input
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") envoyer();
                }}
                placeholder="Votre question…"
                className="flex-1 rounded-[4px] border-0 px-4 py-2.5 outline-none"
                style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "14px" }}
              />
              <button
                onClick={envoyer}
                disabled={enCours || !saisie.trim()}
                aria-label="Envoyer"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full disabled:opacity-40"
                style={{ backgroundColor: colors.rust }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
                </svg>
              </button>
            </div>
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
  };
  return libelles[nomOutil] ?? nomOutil;
}
