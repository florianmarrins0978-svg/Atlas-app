"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import { jourEtMois } from "@/lib/jour";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import Picto from "@/components/atlas/reglages/Picto";
import BottomSheet from "@/components/atlas/BottomSheet";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import ChampDeFeuille from "@/components/atlas/ChampDeFeuille";
import {
  manquesDeLaFeuille,
  phraseDesCasesQuiManquent,
  JOURS_POUR_ACCEPTER,
  type CeQueLaFicheDit,
  type SaisieInscription,
} from "@/lib/urssaf/branchement";
import { inscrireALUrssafAction } from "./actions-urssaf";

/**
 * « AVANCE IMMÉDIATE » sur la fiche d'un client (sa planche du 8 novembre
 * 2026, écran « Le client », lot 3). Elle ne paraît que pour une entreprise
 * déclarée, reliée à l'Urssaf, et un client particulier (`rubriqueDuClient`).
 *
 * Trois états, lus au serveur (`ceQueLaFicheDit`) : pas inscrit, et « L'inscrire
 * à l'Urssaf » ; en attente, l'Urssaf lui a écrit ; inscrit, ses factures
 * partent à l'Urssaf.
 *
 * **« Lui renvoyer le lien » n'est pas dessiné** : la description officielle de
 * l'API (1.29.1) n'a aucune route pour renvoyer le courriel d'activation. Un
 * bouton qui ne ferait rien serait pire qu'aucun. Le délai passé, l'inscription
 * se refait, et l'Urssaf lui réécrit.
 *
 * **La feuille ne demande que ce qu'Atlas n'a pas** : son nom, sa civilité, son
 * portable et son e-mail sont repris de la fiche, l'adresse aussi (lue dans la
 * Base Adresse Nationale par le serveur). « Il manque N cases » se compte par
 * la règle même de l'envoi (`manquesDeLaFeuille`), que le serveur rejoue.
 */
export default function AvanceImmediateDuClient({
  clientId,
  qui,
  dit,
  preremplie,
  peutInscrire,
}: {
  clientId: string;
  /** « Mr. Lambert » : son nom tel que la fiche l'écrit. */
  qui: string;
  dit: CeQueLaFicheDit;
  preremplie: SaisieInscription;
  /** Les droits de la facturation : un compte sans eux lit l'état, sans le geste. */
  peutInscrire: boolean;
}) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [s, setS] = useState<SaisieInscription>(preremplie);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const manques = useMemo(() => manquesDeLaFeuille(s), [s]);
  const manque = (champ: string) => manques.some((m) => m.champ === champ);
  const ecrire = <K extends keyof SaisieInscription>(cle: K, v: SaisieInscription[K]) => setS((avant) => ({ ...avant, [cle]: v }));

  function inscrire() {
    setRefus(null);
    demarrer(async () => {
      const r = await inscrireALUrssafAction(clientId, s);
      if (!r.ok) {
        const detail = r.manques?.length ? ` ${r.manques.map((m) => m.libelle).join(", ")}.` : "";
        setRefus(`${r.raison}${detail}`);
        return;
      }
      setOuverte(false);
      // L'IBAN tapé ne reste pas dans l'écran : il est parti à l'Urssaf.
      setS(preremplie);
      router.refresh();
    });
  }

  const relancer = dit.etat === "pas-inscrit" || (dit.etat === "en-attente" && dit.delaiPasse);

  return (
    <section className="mx-[22px] mt-3" data-atlas="avance-immediate-du-client">
      <h2
        className="mb-2 text-[13px] font-semibold uppercase"
        style={{ color: colors.or, letterSpacing: "0.12em", fontFamily: font.body, fontWeight: 600 }}
      >
        Avance immédiate
      </h2>
      <div className="rounded-[6px] px-4 py-3.5" style={{ backgroundColor: colors.card }}>
        <div className="flex items-center gap-3.5">
          <PastilleIcone ton={dit.etat === "inscrit" ? "vert" : dit.etat === "en-attente" ? "ambre" : undefined}>
            <Picto nom={dit.etat === "inscrit" ? "coche" : dit.etat === "en-attente" ? "horloge-sable" : "euro"} taille={22} />
          </PastilleIcone>
          <span className="min-w-0 flex-1">
            <span className="block text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
              {dit.etat === "inscrit" ? "Inscrit" : dit.etat === "en-attente" ? `En attente de ${qui}` : "Il paie la moitié"}
            </span>
            <span className="mt-0.5 block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
              {dit.etat === "inscrit"
                ? `Depuis le ${jourEtMois(dit.depuis)}. Ses factures partent à l'Urssaf.`
                : dit.etat === "en-attente"
                  ? dit.delaiPasse
                    ? `L'Urssaf lui a écrit le ${jourEtMois(dit.ecritLe)}. Le délai est passé.`
                    : `L'Urssaf lui a écrit le ${jourEtMois(dit.ecritLe)}. Il a ${JOURS_POUR_ACCEPTER} jours pour accepter.`
                  : "Ses factures passent par l'Urssaf, qui vous verse tout."}
            </span>
          </span>
        </div>
        {relancer && peutInscrire && (
          <div className="mt-4">
            <PrimaryButton pleineLargeur repere="inscrire-a-l-urssaf" onClick={() => setOuverte(true)}>
              {dit.etat === "pas-inscrit" ? "L'inscrire à l'Urssaf" : "L'inscrire à nouveau"}
            </PrimaryButton>
          </div>
        )}
      </div>

      <BottomSheet open={ouverte} onBackdropClick={enCours ? undefined : () => setOuverte(false)}>
        <h2 className="text-[24px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
          L&apos;inscrire à l&apos;Urssaf
        </h2>

        <div className="mt-4 flex gap-2" role="group" aria-label="Civilité">
          {(["M", "Mme"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={s.civilite === c}
              data-atlas={`urssaf-civilite-${c}`}
              onClick={() => ecrire("civilite", c)}
              className="min-h-[44px] flex-1 rounded-full px-3 text-[16px]"
              style={{
                backgroundColor: s.civilite === c ? colors.rustTint : colors.card,
                color: colors.ink,
                boxShadow: manque("civilite") ? `inset 0 0 0 1.5px ${colors.carteAmbreTexte}` : `inset 0 0 0 1px ${colors.line}`,
              }}
            >
              {c === "M" ? "Monsieur" : "Madame"}
            </button>
          ))}
        </div>

        <ChampDeFeuille libelle="Nom de naissance" valeur={s.nomNaissance} onChange={(v) => ecrire("nomNaissance", v)} manque={manque("nomNaissance")} />
        <ChampDeFeuille libelle="Prénoms" valeur={s.prenoms} onChange={(v) => ecrire("prenoms", v)} manque={manque("prenoms")} />

        <div className="grid grid-cols-2 gap-2.5">
          <ChampDeFeuille
            libelle="Né le"
            type="date"
            valeur={s.dateNaissance}
            onChange={(v) => ecrire("dateNaissance", v)}
            manque={manque("dateNaissance")}
          />
          <div className="mt-4">
            <label className="mb-1.5 block text-[13.5px] font-semibold" style={{ color: colors.inkSoft }}>
              Pays
              <select
                value={s.neEnFrance ? "france" : "ailleurs"}
                onChange={(e) => ecrire("neEnFrance", e.target.value === "france")}
                className="mt-1.5 block w-full rounded-[4px] border-0 px-3 py-3 font-normal outline-none"
                style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px" }}
              >
                <option value="france">France</option>
                <option value="ailleurs">Ailleurs</option>
              </select>
            </label>
          </div>
        </div>

        {s.neEnFrance ? (
          <div className="grid grid-cols-[1fr_2fr] gap-2.5">
            <ChampDeFeuille
              libelle="Département"
              inputMode="text"
              placeholder="44"
              valeur={s.departementNaissance}
              onChange={(v) => ecrire("departementNaissance", v)}
              manque={manque("departementNaissance")}
            />
            <ChampDeFeuille
              libelle="Commune de naissance"
              placeholder="Nantes"
              valeur={s.communeNaissance}
              onChange={(v) => ecrire("communeNaissance", v)}
              manque={manque("communeNaissance")}
            />
          </div>
        ) : (
          <ChampDeFeuille
            libelle="Code de son pays"
            inputMode="numeric"
            placeholder="99134"
            aide="Cinq chiffres, sur le site de l'Insee."
            valeur={s.paysNaissance}
            onChange={(v) => ecrire("paysNaissance", v)}
            manque={manque("paysNaissance")}
          />
        )}

        <ChampDeFeuille libelle="Portable" type="tel" inputMode="tel" valeur={s.portable} onChange={(v) => ecrire("portable", v)} manque={manque("portable")} />
        <ChampDeFeuille libelle="E-mail" type="email" inputMode="email" valeur={s.email} onChange={(v) => ecrire("email", v)} manque={manque("email")} />
        <ChampDeFeuille
          libelle="Son IBAN"
          placeholder="FR76"
          aide="L'Urssaf y prélève sa moitié."
          valeur={s.iban}
          onChange={(v) => ecrire("iban", v)}
          manque={manque("iban")}
          repere="urssaf-iban"
        />
        <div className="grid grid-cols-[1fr_2fr] gap-2.5">
          <ChampDeFeuille libelle="BIC" valeur={s.bic} onChange={(v) => ecrire("bic", v)} manque={manque("bic")} />
          <ChampDeFeuille libelle="Titulaire" valeur={s.titulaire} onChange={(v) => ecrire("titulaire", v)} manque={manque("titulaire")} />
        </div>

        {phraseDesCasesQuiManquent(manques.length) && (
          <p className="mb-3 mt-5 text-center text-[14.5px] font-semibold" data-atlas="cases-qui-manquent" style={{ color: colors.carteAmbreTexte }}>
            {phraseDesCasesQuiManquent(manques.length)}
          </p>
        )}
        {refus && (
          <p role="alert" data-atlas="refus-inscription" className="mt-3 text-[14px] font-semibold leading-[1.4]" style={{ color: colors.carteRougeTexte }}>
            {refus}
          </p>
        )}
        <div className="mt-5">
          <PrimaryButton pleineLargeur repere="inscrire-confirmer" disabled={enCours || manques.length > 0} onClick={inscrire}>
            {enCours ? "Inscription…" : "Inscrire"}
          </PrimaryButton>
        </div>
      </BottomSheet>
    </section>
  );
}
