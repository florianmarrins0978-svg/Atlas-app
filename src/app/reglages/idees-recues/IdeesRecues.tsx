"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, font, surPlein } from "@/lib/design-tokens";
import {
  dateDeLIdee,
  ditApresTri,
  libelleDuTri,
  libelleEtatIdee,
  ongletDeLIdee,
  ONGLETS_IDEES,
  quiAEnvoye,
  REPONSE_IDEE_MAX,
  tonEtatIdee,
  trisPossibles,
  type EtatIdee,
  type OngletIdees,
  type TriIdee,
} from "@/lib/idees";
import type { Role } from "@/lib/acces-roles";
import { useRetraits } from "@/components/atlas/useRetraits";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import BottomSheet from "@/components/atlas/BottomSheet";
import ChoixEnMots from "@/components/atlas/reglages/ChoixEnMots";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import { rangerIdeeAction, repondreIdeeAction } from "./actions";

export type IdeeRecueAffichee = {
  id: string;
  texte: string;
  etat: EtatIdee;
  reponse: string | null;
  envoyeeLe: string;
  auteurNom: string;
  auteurRole: Role;
  entrepriseNom: string;
};

/**
 * L'écran de l'éditeur : trois onglets, et un geste par idée.
 *
 * **Ranger se rattrape** : l'idée passe tout de suite dans son onglet, le
 * tiroir dit « Marquée prévue », et rien n'est écrit tant qu'il est ouvert
 * (`useRetraits`). L'artisan ne voit donc jamais un état qu'on a annulé.
 */
export default function IdeesRecues({ idees }: { idees: IdeeRecueAffichee[] }) {
  const router = useRouter();
  const [onglet, setOnglet] = useState<OngletIdees>("nouvelles");
  const tris = useRef(new Map<string, TriIdee>());
  const [enCours, setEnCours] = useState<Record<string, TriIdee>>({});
  const [repondreA, setRepondreA] = useState<IdeeRecueAffichee | null>(null);

  const rangements = useRetraits({
    valider: async (id) => {
      const tri = tris.current.get(id);
      if (!tri) return { succes: true };
      try {
        return await rangerIdeeAction(id, tri);
      } catch {
        return { succes: false, erreur: "L'idée n'a pas pu être rangée. Réessayez dans un instant." };
      }
    },
  });

  // L'état que l'écran montre : celui de la base, ou le geste qui attend.
  const etatVu = (i: IdeeRecueAffichee): EtatIdee => (rangements.estRetire(i.id) ? (enCours[i.id] ?? i.etat) : i.etat);

  function ranger(i: IdeeRecueAffichee, tri: TriIdee) {
    tris.current.set(i.id, tri);
    setEnCours((cur) => ({ ...cur, [i.id]: tri }));
    rangements.retirer(i.id, ditApresTri(tri));
  }

  function annuler() {
    const dernier = rangements.dernier;
    rangements.annuler();
    if (!dernier) return;
    tris.current.delete(dernier.id);
    setEnCours((cur) => {
      const suite = { ...cur };
      delete suite[dernier.id];
      return suite;
    });
  }

  const compte = (o: OngletIdees) => idees.filter((i) => ongletDeLIdee(etatVu(i)) === o).length;
  const visibles = idees.filter((i) => ongletDeLIdee(etatVu(i)) === onglet);

  return (
    <div className="px-[22px]">
      <ChoixEnMots
        libelle="Quelles idées"
        valeur={onglet}
        onChoix={setOnglet}
        options={ONGLETS_IDEES.map((o) => ({ valeur: o.cle, libelle: `${o.nom} ${compte(o.cle)}`, dataAtlas: `onglet-${o.cle}` }))}
      />

      <div className="mt-4 flex flex-col gap-3" data-atlas={`idees-${onglet}`}>
        {visibles.length === 0 && (
          <p className="px-2 py-10 text-center text-[16px]" style={{ color: colors.inkSoft }}>
            {onglet === "nouvelles" ? "Aucune idée nouvelle." : onglet === "prevues" ? "Aucune idée prévue." : "Aucune idée traitée."}
          </p>
        )}
        {visibles.map((i) => {
          const etat = etatVu(i);
          const ton = tonEtatIdee(etat);
          return (
            <article
              key={i.id}
              className="rounded-[6px] px-[18px] py-4"
              style={{ backgroundColor: colors.card }}
              data-atlas="idee-recue"
            >
              <p className="text-[19px] leading-[1.32] [overflow-wrap:anywhere]" style={{ fontFamily: font.display, color: colors.ink }}>
                {i.texte}
              </p>
              <p className="mt-[9px] text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                <b className="font-semibold" style={{ color: colors.ink }}>
                  {quiAEnvoye(i.auteurNom, i.auteurRole, i.entrepriseNom)}
                </b>{" "}
                {dateDeLIdee(new Date(i.envoyeeLe))}.
              </p>
              {etat !== "envoyee" && (
                <div className="mt-2">
                  <EtatEcrit ton={ton === "neutre" ? undefined : ton}>{libelleEtatIdee(etat)}</EtatEcrit>
                </div>
              )}
              {i.reponse && (
                <p className="mt-[9px] text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                  <b style={{ color: colors.ink }}>Votre réponse&nbsp;:</b> {i.reponse}
                </p>
              )}
              {rangements.refuses[i.id] && (
                <p className="mt-2 text-[14.5px]" role="alert" style={{ color: colors.alert }}>
                  {rangements.refuses[i.id]}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                {trisPossibles(etat).map((tri) => (
                  <button
                    key={tri}
                    type="button"
                    onClick={() => ranger(i, tri)}
                    data-atlas={`ranger-${tri}`}
                    className="min-h-[44px] rounded-full px-[14px] text-[15px] font-semibold"
                    style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
                  >
                    {libelleDuTri(tri)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRepondreA(i)}
                  data-atlas="repondre-idee"
                  className="ml-auto min-h-[44px] px-1 text-[16px] font-semibold"
                  style={{ color: colors.rust }}
                >
                  Répondre
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <TiroirDesRetires
        className="mt-4"
        dernier={rangements.dernier}
        nombre={rangements.nombre}
        onAnnuler={annuler}
        situation={rangements.dernier?.libelle}
        compteARebours={rangements.compteARebours}
      />

      <FeuilleDeReponse
        idee={repondreA}
        fermer={() => setRepondreA(null)}
        envoyee={() => {
          setRepondreA(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function FeuilleDeReponse({
  idee,
  fermer,
  envoyee,
}: {
  idee: IdeeRecueAffichee | null;
  fermer: () => void;
  envoyee: () => void;
}) {
  const [texte, setTexte] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [pour, setPour] = useState<string | null>(null);

  // Une autre idée ouverte : on repart de sa réponse à elle.
  if (idee && idee.id !== pour) {
    setPour(idee.id);
    setTexte(idee.reponse ?? "");
    setMessage(null);
  }

  function envoyer() {
    if (!idee) return;
    demarrer(async () => {
      const resultat = await repondreIdeeAction(idee.id, texte);
      if (!resultat.ok) {
        setMessage(resultat.message);
        return;
      }
      envoyee();
    });
  }

  return (
    <BottomSheet open={idee !== null} onBackdropClick={fermer}>
      <div className="px-[22px] pb-6 pt-2">
        <p className="mb-4 mt-1.5 text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
          Votre réponse
        </p>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          maxLength={REPONSE_IDEE_MAX}
          rows={4}
          aria-label="Votre réponse"
          data-atlas="texte-reponse"
          className="min-h-[110px] w-full resize-none rounded-[6px] px-[15px] py-3.5 text-[16px] leading-[1.4]"
          style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.lineSoft}` }}
        />
        {message && (
          <p className="mt-2 text-[14.5px]" role="alert" style={{ color: colors.alert }}>
            {message}
          </p>
        )}
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={fermer}
            disabled={enCours}
            className="min-h-[56px] flex-1 rounded-full text-[17px] font-semibold disabled:opacity-60"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={envoyer}
            disabled={enCours}
            data-atlas="envoyer-reponse"
            className="atlas-plein min-h-[56px] flex-1 rounded-full text-[17px] font-semibold disabled:opacity-60"
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            {enCours ? "Un instant…" : "Envoyer"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
