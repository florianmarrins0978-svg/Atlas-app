"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { empreinteDuPlan, type PlanFige, type SaisieDuPlan } from "@/lib/arrosage/plan-enregistre";
import { heureDite, resumeDuDossier } from "@/lib/arrosage/mots-des-dossiers";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import { enregistrerLePlanAction, sesDossiersAction, type DossierPourLaFeuille, type EtatEnregistrement } from "../dossiers-arrosage/actions";
import ChoixDuClient from "../dossiers-arrosage/ChoixDuClient";
import { Feuille } from "./FeuillePiece";
import Icone from "./Icones";

/**
 * « ENREGISTRER DANS UN DOSSIER », sous les réserves du plan — sa planche du
 * 21 novembre 2026 (`appli/arrosage-dossiers.html`), son « tu peux tout
 * coder » du même soir. Un geste en plus, jamais une étape : l'outil reste
 * utilisable sans dossier (`ARCHITECTURE.md` §125).
 *
 * Ce qui part : la saisie (les paramètres, ses retouches, ce que l'IA a lu),
 * la photo du croquis, et l'EMPREINTE du plan affiché. Le serveur refait le
 * plan et la compare (`enregistrerLePlanAction`) : il n'enregistre jamais un
 * plan qu'il n'a pas calculé lui-même.
 */
export default function EnregistrerDansUnDossier({
  saisie,
  plan,
  photo,
  lecture,
}: {
  saisie: SaisieDuPlan;
  plan: PlanFige;
  /** La photo du croquis, quand le plan vient d'une photo ; `null` pour un plan dessiné. */
  photo: () => File | null;
  lecture: unknown;
}) {
  const [ouverte, setOuverte] = useState(false);
  const [dossiers, setDossiers] = useState<DossierPourLaFeuille[] | null>(null);
  const [choix, setChoix] = useState<string | "nouveau" | null>(null);
  const [nom, setNom] = useState("");
  const [client, setClient] = useState<{ id: string; nom: string } | null>(null);
  const [etat, setEtat] = useState<EtatEnregistrement | null>(null);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    if (!ouverte) return;
    let vivant = true;
    sesDossiersAction().then((d) => vivant && setDossiers(d));
    return () => {
      vivant = false;
    };
  }, [ouverte]);

  const avecPhoto = photo() !== null;
  const maintenant = new Date();

  function enregistrer() {
    if (!choix) {
      setEtat({ etat: "refus", raison: "Choisissez un dossier." });
      return;
    }
    const f = new FormData();
    f.set("saisie", JSON.stringify({ ...saisie, lecture }));
    f.set("empreinte", empreinteDuPlan(plan));
    if (choix === "nouveau") {
      f.set("nom", nom);
      if (client) f.set("clientId", client.id);
    } else f.set("dossierId", choix);
    const p = photo();
    if (p) f.set("croquis", p);
    demarrer(async () => {
      const r = await enregistrerLePlanAction(f);
      setEtat(r);
      if (r.etat !== "refus") setOuverte(false);
    });
  }

  return (
    <div className="mt-5" data-atlas="enregistrer-dans-un-dossier">
      <button
        type="button"
        onClick={() => {
          setEtat(null);
          setOuverte(true);
        }}
        data-atlas="enregistrer-dossier"
        className="flex min-h-[56px] w-full items-center justify-center gap-[10px] rounded-full bg-transparent text-[17px] font-semibold"
        style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
      >
        <Icone nom="dossier" />
        Enregistrer dans un dossier
      </button>
      {etat?.etat === "enregistre" && (
        <p className="mt-3 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }} data-atlas="plan-enregistre">
          Enregistré dans {etat.dossier}, aujourd’hui à {heureDite(new Date(etat.le))}.{" "}
          <Link href={`/paysage/dossiers-arrosage/${etat.dossierId}`} className="font-semibold underline" style={{ color: colors.orTexte }}>
            Ouvrir le dossier
          </Link>
        </p>
      )}
      {etat?.etat === "deja" && (
        <p className="mt-3 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }} data-atlas="plan-deja-enregistre">
          Ce plan est déjà enregistré tel quel dans {etat.dossier}.
        </p>
      )}

      {ouverte && (
        <Feuille titre="Dans quel dossier ?" repere="feuille-enregistrer" onFermer={() => setOuverte(false)}>
          <p className="mb-[10px] text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            {avecPhoto ? "Le croquis, vos saisies, le plan, la liste et les réserves, tels qu’à l’écran." : "Vos saisies, le plan, la liste et les réserves, tels qu’à l’écran."}
          </p>
          <div role="radiogroup" aria-label="Le dossier">
            {dossiers === null ? (
              <p className="py-3 text-[15px]" style={{ color: colors.muted }}>
                <PointsQuiSoufflent />
              </p>
            ) : (
              dossiers.map((d) => <Choix key={d.id} oui={choix === d.id} onChoisir={() => setChoix(d.id)} nom={d.nom} sous={resumeDuDossier(d.plans, d.dernier ? new Date(d.dernier) : null, maintenant)} />)
            )}
            <Choix oui={choix === "nouveau"} onChoisir={() => setChoix("nouveau")} nom="Nouveau dossier" sous={null} />
          </div>
          {choix === "nouveau" && (
            <div>
              <ChoixDuClient
                choisi={client}
                onChoisi={(c) => {
                  setClient(c);
                  if (c) setNom(`Plan d’arrosage de ${c.nom}`);
                }}
              />
              <label className="mb-[6px] mt-[18px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }} htmlFor="nom-du-nouveau-dossier">
                Nom du dossier
              </label>
              <input
                id="nom-du-nouveau-dossier"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Plan d’arrosage de…"
                maxLength={120}
                className="block w-full rounded-[10px] border-0 px-[12px] py-3 text-[16px]"
                style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
              />
            </div>
          )}
          {etat?.etat === "refus" && (
            <p className="mt-3 text-[14.5px] font-semibold" style={{ color: colors.alert }} role="alert">
              {etat.raison}
            </p>
          )}
          <button
            type="button"
            onClick={enregistrer}
            disabled={enCours}
            data-atlas="enregistrer"
            className="atlas-plein mt-[14px] flex min-h-[56px] w-full items-center justify-center gap-[10px] rounded-full border-0 text-[17px] font-semibold"
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            {enCours ? <PointsQuiSoufflent /> : "Enregistrer"}
          </button>
        </Feuille>
      )}
    </div>
  );
}

function Choix({ oui, onChoisir, nom, sous }: { oui: boolean; onChoisir: () => void; nom: string; sous: string | null }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={oui}
      onClick={onChoisir}
      data-atlas="choix-du-dossier"
      className="flex min-h-[60px] w-full items-center gap-[14px] border-0 bg-transparent px-1 py-2 text-left"
      style={{ borderBottom: `1px solid ${colors.line}`, color: colors.ink }}
    >
      <span
        aria-hidden="true"
        className="flex h-[22px] w-[22px] flex-none rounded-full"
        style={{ boxShadow: `inset 0 0 0 ${oui ? 7 : 1.5}px ${oui ? colors.ink : colors.muted}` }}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[17px]" style={{ fontFamily: font.display }}>
          {nom}
        </span>
        {sous && (
          <span className="mt-[2px] block text-[13.5px]" style={{ color: colors.inkSoft }}>
            {sous}
          </span>
        )}
      </span>
    </button>
  );
}
