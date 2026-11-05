"use client";

import { useEffect, useRef, useState } from "react";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { dateDeLIdee, libelleEtatIdee, tonEtatIdee, TEXTE_IDEE_MAX, texteDIdeeValide, type EtatIdee } from "@/lib/idees";
import { useRetraits } from "@/components/atlas/useRetraits";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import ActionBas from "@/components/atlas/reglages/ActionBas";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import Picto from "@/components/atlas/reglages/Picto";
import { useMagnetophone, formulaireDeNote } from "@/app/chantiers/[id]/magnetophone";
import { cerclesDeLaVoix } from "@/app/chantiers/[id]/AnneauNoteVocale";
import { envoyerIdeeAction, transcrireIdeeAction } from "./actions";

export type IdeeAffichee = {
  id: string;
  texte: string;
  etat: EtatIdee;
  reponse: string | null;
  envoyeeLe: string;
};

/**
 * L'écran de l'artisan : dire son idée, puis la suivre.
 *
 * **La voix d'abord, avec LA dictée du chantier** (sa B du 1er novembre 2026) :
 * les mêmes classes (`.atlas-dictee`, `globals.css`), le même enregistreur
 * (`useMagnetophone`), les mêmes cercles. Ceux qui s'en servent ne sont pas à
 * l'aise avec un téléphone (`PRODUCT.md`) : un geste qu'ils connaissent déjà
 * vaut mieux qu'un nouveau.
 *
 * **« Envoyée, Annuler »** : l'idée se pose en tête de « Vos idées » tout de
 * suite, et ne part qu'à la fermeture du tiroir (`useRetraits`, ses trois
 * sorties). Annuler ne défait donc rien chez l'éditeur : rien n'y était arrivé.
 */
export default function UneIdee({ idees }: { idees: IdeeAffichee[] }) {
  const magnetophone = useMagnetophone();
  const [mode, setMode] = useState<"voix" | "ecrire">("voix");
  const [transcription, setTranscription] = useState(false);
  const [texte, setTexte] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [niveau, setNiveau] = useState(0);

  // Ce qui attend la fermeture du tiroir : l'identifiant ne vit que sur cet
  // écran, le texte part avec lui.
  const textes = useRef(new Map<string, string>());
  const [enAttente, setEnAttente] = useState<{ id: string; texte: string }[]>([]);
  const ecrites = useRef(new Set<string>());

  const envois = useRetraits({
    valider: async (id) => {
      const aEnvoyer = textes.current.get(id);
      if (!aEnvoyer) return { succes: true };
      // Le crochet parle de « retrait » quand l'appel lève : ici, c'est une
      // idée qui n'est pas partie, et elle le dit.
      try {
        const resultat = await envoyerIdeeAction(aEnvoyer);
        if (resultat.succes) ecrites.current.add(id);
        return resultat;
      } catch {
        return { succes: false, erreur: "L'idée n'a pas pu partir. Réessayez dans un instant." };
      }
    },
  });

  // La liste du serveur est revenue : les idées écrites y sont, la copie
  // posée par l'écran peut partir.
  useEffect(() => {
    if (ecrites.current.size === 0) return;
    const parties = ecrites.current;
    setEnAttente((liste) => liste.filter((i) => !parties.has(i.id)));
    ecrites.current = new Set();
  }, [idees]);

  useEffect(() => {
    if (!magnetophone.enregistre) return;
    const t = setInterval(() => {
      const mesure = magnetophone.niveau();
      const force = mesure === null ? 0.15 + Math.random() * 0.6 : mesure;
      setNiveau((precedent) => precedent + (force - precedent) * 0.45);
    }, 95);
    return () => clearInterval(t);
  }, [magnetophone.enregistre, magnetophone]);

  function poser(contenu: string) {
    const id = crypto.randomUUID();
    textes.current.set(id, contenu);
    setEnAttente((liste) => [{ id, texte: contenu }, ...liste]);
    envois.retirer(id, contenu);
  }

  function annuler() {
    const dernier = envois.dernier;
    envois.annuler();
    if (!dernier) return;
    textes.current.delete(dernier.id);
    setEnAttente((liste) => liste.filter((i) => i.id !== dernier.id));
  }

  async function commencer() {
    if (transcription || magnetophone.enregistre) return;
    setMessage(null);
    await magnetophone.demarrer();
  }

  function jeter() {
    magnetophone.jeter();
    magnetophone.setErreur(null);
    setNiveau(0);
  }

  async function envoyerLaVoix() {
    if (!magnetophone.enregistre || magnetophone.secondes < 1) return;
    const capte = await magnetophone.arreter();
    setNiveau(0);
    if (!capte) return;
    setTranscription(true);
    try {
      const resultat = await transcrireIdeeAction(formulaireDeNote(capte.blob, capte.secondes));
      if (!resultat.ok) {
        setMessage(resultat.raison);
        return;
      }
      poser(resultat.texte);
    } catch {
      setMessage("La dictée s'est arrêtée en chemin. Vous pouvez écrire votre idée.");
    } finally {
      setTranscription(false);
    }
  }

  function envoyerLEcrit() {
    const valide = texteDIdeeValide(texte);
    if (!valide.ok) {
      setMessage(valide.message);
      return;
    }
    setMessage(null);
    poser(valide.texte);
    setTexte("");
    setMode("voix");
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  // Une idée posée reste à l'écran jusqu'à ce que la liste du serveur la
  // porte : sans quoi elle disparaîtrait entre l'écriture et le retour.
  const visibles = enAttente;
  const aucune = visibles.length === 0 && idees.length === 0;

  return (
    <div className="px-[22px]">
      {mode === "voix" && (
        <div className="atlas-dictee mt-[18px]" data-etat={magnetophone.enregistre ? "dicte" : "repos"} data-atlas="dicter-idee">
          {transcription ? (
            <p className="flex items-center gap-2 text-[16px]" style={{ color: colors.ink }}>
              Envoi
              <PointsQuiSoufflent />
            </p>
          ) : magnetophone.enregistre ? (
            <div className="atlas-ecoute">
              <button type="button" onClick={jeter} aria-label="Jeter ce que vous avez dit" className="atlas-jeter" style={{ color: colors.inkSoft }}>
                <span className="atlas-jeter-rond">
                  <Picto nom="corbeille" taille={21} epaisseur={1.7} />
                </span>
                Jeter
              </button>
              <button
                type="button"
                onClick={envoyerLaVoix}
                aria-label="Envoyer votre idée"
                className="atlas-envoyer"
                style={{ color: colors.ink }}
                data-atlas="idee-envoyer-la-voix"
              >
                <svg className="atlas-cercles" viewBox="0 0 120 120" aria-hidden="true">
                  {cerclesDeLaVoix(niveau).map((c, k) => (
                    <circle key={k} cx="60" cy="60" r={c.rayon} opacity={c.opacite} />
                  ))}
                </svg>
                <span className="atlas-disque-envoi">
                  <Picto nom="envoyer" taille={28} epaisseur={1.7} />
                </span>
                Envoyer
              </button>
              <span className="atlas-compteur" style={{ color: colors.ink, fontFamily: font.display }}>
                <span className="atlas-pastille" style={{ backgroundColor: colors.alert }} />
                {mmss(magnetophone.secondes)}
              </span>
            </div>
          ) : (
            <>
              <span className="atlas-objet">
                <button type="button" onClick={commencer} aria-label="Dire votre idée" className="atlas-micro">
                  <Picto nom="micro" taille={28} epaisseur={1.8} />
                </button>
              </span>
              <p className="atlas-indice mt-3 text-center text-[15.5px]" style={{ color: colors.inkSoft }}>
                Appuyez et dites ce qui vous manque
              </p>
            </>
          )}
          {(magnetophone.erreur || message) && (
            <p className="mt-3 text-center text-[14.5px] leading-[1.45]" role="alert" style={{ color: colors.alert }}>
              {magnetophone.erreur ?? message}
            </p>
          )}
        </div>
      )}

      {mode === "voix" && !magnetophone.enregistre && !transcription && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setMode("ecrire");
            }}
            data-atlas="ecrire-idee"
            className="flex min-h-[56px] min-w-[220px] items-center justify-center gap-2.5 rounded-full px-[22px] text-[17px] font-semibold"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
          >
            <Picto nom="crayon" taille={22} />
            J&apos;écris mon idée
          </button>
        </div>
      )}

      {mode === "ecrire" && (
        <label className="mt-2 block">
          <span className="mb-[7px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
            Votre idée
          </span>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            maxLength={TEXTE_IDEE_MAX}
            rows={6}
            autoFocus
            data-atlas="texte-idee"
            placeholder="Ce qui vous manque, ce qui vous ferait gagner du temps"
            className="min-h-[168px] w-full resize-none rounded-[6px] px-[15px] py-3.5 text-[17px] leading-[1.45]"
            style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.lineSoft}` }}
          />
          {message && (
            <span className="mt-2 block text-[14.5px]" role="alert" style={{ color: colors.alert }}>
              {message}
            </span>
          )}
        </label>
      )}

      {!magnetophone.enregistre && !transcription && (
        <p className="mt-[14px] text-center text-[13px]" style={{ color: colors.inkSoft }}>
          Elle arrive chez Atlas, avec votre nom.
        </p>
      )}

      {!aucune && (
        <section className="mt-[30px]" data-atlas="vos-idees">
          <p className="mb-[10px] text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.or }}>
            Vos idées
          </p>
          <ul className="overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
            {visibles.map((i) => (
              <Idee
                key={i.id}
                texte={i.texte}
                etat={envois.refuses[i.id] ? null : "envoyee"}
                quand={envois.refuses[i.id] ? null : "À l'instant"}
                refus={envois.refuses[i.id] ?? null}
                reponse={null}
              />
            ))}
            {idees.map((i) => (
              <Idee
                key={i.id}
                texte={i.texte}
                etat={i.etat}
                quand={dateDeLIdee(new Date(i.envoyeeLe))}
                refus={null}
                reponse={i.reponse}
              />
            ))}
          </ul>
        </section>
      )}

      <TiroirDesRetires
        className="mt-4"
        dernier={envois.dernier}
        nombre={envois.nombre}
        onAnnuler={annuler}
        situation={envois.nombre > 1 ? "Envoyées à l'instant" : "Envoyée à l'instant"}
        compteARebours={envois.compteARebours}
      />

      {mode === "ecrire" && (
        <ActionBas dataAtlas="envoyer-idee">
          <button
            type="button"
            onClick={envoyerLEcrit}
            className="atlas-plein flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full text-[17px] font-semibold"
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            <Picto nom="envoyer" taille={22} />
            Envoyer mon idée
          </button>
        </ActionBas>
      )}
    </div>
  );
}

function Idee({
  texte,
  etat,
  quand,
  refus,
  reponse,
}: {
  texte: string;
  etat: EtatIdee | null;
  quand: string | null;
  refus: string | null;
  reponse: string | null;
}) {
  const ton = etat ? tonEtatIdee(etat) : null;
  return (
    <li className="relative border-t py-[15px] first:border-t-0" style={{ borderColor: colors.line }} data-atlas="idee">
      <p className="text-[18px] leading-[1.32] [overflow-wrap:anywhere]" style={{ fontFamily: font.display, color: colors.ink }}>
        {texte}
      </p>
      <p className="mt-[9px] flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        {etat && <EtatEcrit ton={ton === "neutre" ? undefined : (ton ?? undefined)}>{libelleEtatIdee(etat)}</EtatEcrit>}
        {quand && (
          <span className="text-[13px]" style={{ color: colors.inkSoft }}>
            {quand}
          </span>
        )}
      </p>
      {refus && (
        <p className="mt-2 text-[14.5px] leading-[1.45]" role="alert" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}
      {reponse && (
        <p className="mt-[9px] text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
          <b style={{ color: colors.ink }}>Atlas&nbsp;:</b> {reponse}
        </p>
      )}
    </li>
  );
}
