"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, libelleCaps, voile } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import { salariesAffiches, libelleSalarie } from "@/lib/equipes";
import { libelleAbsence, phraseDuRefus, refusDeLAbsence } from "@/lib/absences-equipe";
import { noterAbsenceAction, retirerAbsenceAction } from "./actions";

/**
 * « Absences » — les jours où quelqu'un n'est pas là.
 *
 * *Le patron, le 14 août 2026 : « Comment on fait si jamais il y a une équipe
 * qui doit partir en déplacement pour cinq jours ? Est-ce qu'il y a un moyen de
 * l'ajouter au planning ? »* Retenu sur maquette (`docs/maquettes/55`,
 * proposition A) : sous les noms, dans Réglages → Équipe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE ÇA FAIT, ET CE QUE ÇA NE FAIT PAS.**
 *
 * Un salarié absent **ne compte plus** dans les dates proposées au client, ces
 * jours-là. Avec deux gars dont un en déplacement, Atlas se comporte
 * exactement comme s'il n'y en avait qu'un — puis tout revient normal, sans
 * que le patron ait rien à défaire. C'est tout : ni solde de congés, ni
 * validation, ni paie.
 *
 * **CE BLOC PARLE DE GENS DEPUIS LE 26 AOÛT 2026**, et il parlait de files du
 * planning avant. La coupure demandée ce jour-là (planche 97) a donné à la
 * capacité son propre compteur : ce qu'on note absent ici, ce sont les
 * personnes qu'il a nommées, et c'est ce qu'il cherchait en écrivant
 * « déplacement pour cinq jours ».
 *
 * **Le client ne voit jamais rien de ceci** — ni les gens, ni les absences.
 * Il voit une date, comme avant.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE BLOC N'EXISTE PAS SANS SALARIÉ, et ce n'est pas un oubli.** Seul,
 * noter son absence reviendrait à fermer l'entreprise : plus aucune date ne
 * serait proposable, et rien à l'écran ne l'expliquerait. Le geste juste dans
 * ce cas est l'agenda extérieur, qui bloque la période pour de bon — la phrase
 * en bas y renvoie plutôt que de laisser chercher.
 *
 * Même registre que le bloc des noms juste au-dessus, qui disparaît pour la
 * même raison : un réglage dont la valeur ne serait jamais lue est un piège.
 */

export type AbsenceAffichee = {
  id: string;
  rang: number;
  nom: string | null;
  premierJour: string;
  dernierJour: string;
  motif: string | null;
};

export default function AbsencesEquipe({
  nombreSalaries,
  noms,
  initialAbsences,
  aujourdHui,
}: {
  nombreSalaries: number;
  /** Ce que la base porte, par rang. Un rang absent est un cas ordinaire. */
  noms: { rang: number; nom: string | null }[];
  initialAbsences: AbsenceAffichee[];
  /** Le jour d'aujourd'hui, calculé au serveur — jamais dans le navigateur. */
  aujourdHui: string;
}) {
  const router = useRouter();

  const [ouverte, setOuverte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  const [rang, setRang] = useState(1);
  const [premierJour, setPremierJour] = useState(aujourdHui);
  const [dernierJour, setDernierJour] = useState(aujourdHui);
  const [motif, setMotif] = useState("");

  // **Les lignes retirées disparaissent tout de suite, et reviennent si le
  // serveur n'a pas suivi.** Attendre le serveur pour effacer donne un écran
  // qui ne répond pas ; effacer sans jamais revenir en arrière fait croire à
  // une suppression qui n'a pas eu lieu (`ARCHITECTURE.md` §48).
  const [retirees, setRetirees] = useState<Set<string>>(new Set());

  if (nombreSalaries <= 0) {
    return (
      <p
        className="mx-[26px] mt-[30px] border-t pt-[18px] text-[12px] leading-[1.7]"
        style={{ borderColor: colors.line, color: colors.muted }}
      >
        Seul, une absence fermerait l’entreprise : plus aucune date ne serait
        proposable.{" "}
        <span style={{ color: colors.ink }}>
          Pour vos congés, posez-les dans votre agenda
        </span>{" "}
        — Atlas en tient compte et ne proposera rien sur ces jours-là.
      </p>
    );
  }

  const lignesEquipes = salariesAffiches(noms, nombreSalaries);
  const nomDuRang = (r: number) =>
    libelleSalarie(lignesEquipes.find((e) => e.rang === r) ?? { rang: r, nom: null }, nombreSalaries) ??
    `Salarié ${r}`;

  const absences = initialAbsences.filter((a) => !retirees.has(a.id));

  function ouvrir() {
    setRang(1);
    setPremierJour(aujourdHui);
    setDernierJour(aujourdHui);
    setMotif("");
    setRefus(null);
    setOuverte(true);
  }

  /**
   * Le dernier jour suit le premier tant qu'il est avant.
   *
   * Sans cela, avancer le début au-delà de la fin laisse une absence à
   * l'envers, que le bouton refuse — et le patron se retrouve devant un bouton
   * éteint sans comprendre lequel des deux champs le gêne.
   */
  function changerPremier(valeur: string) {
    setPremierJour(valeur);
    if (dernierJour < valeur) setDernierJour(valeur);
  }

  async function enregistrer() {
    setEnCours(true);
    setRefus(null);
    const fd = new FormData();
    fd.set("rang", String(rang));
    fd.set("premierJour", premierJour);
    fd.set("dernierJour", dernierJour);
    fd.set("motif", motif);
    const r = await noterAbsenceAction(fd);
    setEnCours(false);
    if (!r.ok) {
      setRefus(r.raison);
      return;
    }
    setOuverte(false);
    router.refresh();
  }

  async function retirer(id: string) {
    setRetirees((cur) => new Set(cur).add(id));
    const r = await retirerAbsenceAction(id);
    if (!r.ok) {
      // La ligne n'a pas bougé en base : on la remet plutôt que de laisser
      // croire à une suppression.
      setRetirees((cur) => {
        const suivant = new Set(cur);
        suivant.delete(id);
        return suivant;
      });
      return;
    }
    router.refresh();
  }

  // La même règle que le serveur, jamais une seconde : c'est elle qui décide
  // du bouton comme du refus.
  const refusSaisi = refusDeLAbsence(premierJour, dernierJour);
  const armé = refusSaisi === null && !enCours;

  return (
    <section className="mt-[30px]">
      <p className={`mb-1.5 px-[26px] ${libelleCaps}`} style={{ color: colors.muted }}>
        Absences
      </p>

      {absences.length === 0 ? (
        <p className="px-[26px] py-2 text-[13px] leading-[1.7]" style={{ color: colors.muted }}>
          Personne d’absent. Un déplacement, un congé, un arrêt : notez-le ici et
          Atlas n’enverra plus personne à sa place ces jours-là.
        </p>
      ) : (
        <div className="px-[26px]">
          {absences.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 py-3"
              style={{ borderBottom: `1px solid ${colors.lineSoft}` }}
            >
              <span
                className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-[11.5px]"
                style={{ backgroundColor: colors.rustTint, color: colors.rust }}
                aria-hidden="true"
              >
                {a.rang}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{nomDuRang(a.rang)}</span>
                {a.motif && (
                  <span className="mt-0.5 block truncate text-[11.5px]" style={{ color: colors.muted }}>
                    {a.motif}
                  </span>
                )}
              </span>
              <span className="flex-shrink-0 text-[12.5px]" style={{ color: colors.or }}>
                {libelleAbsence(a.premierJour, a.dernierJour)}
              </span>
              <button
                type="button"
                onClick={() => void retirer(a.id)}
                aria-label={`Retirer l'absence de ${nomDuRang(a.rang)}`}
                className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full"
                style={{ border: `1px solid ${colors.line}`, color: colors.muted }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Une pastille creuse, comme tous les boutons de ce dépôt
          (`scripts/test-boutons-arrondis.ts`). */}
      <button
        type="button"
        onClick={ouvrir}
        className="mx-[26px] mt-3.5 block w-[calc(100%-52px)] rounded-full py-3 text-center text-[13.5px]"
        style={{ border: `1px solid ${colors.line}`, color: colors.rust }}
      >
        + Noter une absence
      </button>

      <p className="mx-[26px] mt-3 text-[12px] leading-[1.7]" style={{ color: colors.muted }}>
        Un absent <span style={{ color: colors.ink }}>ne compte plus</span> ces
        jours-là : Atlas propose une date de moins, et tout revient normal
        ensuite. Vos clients ne voient rien de tout ceci.
      </p>

      <BottomSheet open={ouverte} onBackdropClick={() => setOuverte(false)}>
        <p className={`text-center ${libelleCaps}`} style={{ color: colors.or }}>
          Absence
        </p>
        <p className="mb-3.5 mt-2 text-center text-[20px]" style={{ fontFamily: font.display }}>
          Qui n’est pas là ?
        </p>

        <div className="flex flex-col gap-px overflow-hidden rounded-xl" style={{ backgroundColor: colors.lineSoft }}>
          <Ligne libelle="Qui">
            <select
              value={rang}
              onChange={(e) => setRang(Number(e.target.value))}
              aria-label="Qui est absent"
              className="w-full bg-transparent text-right text-[15.5px] outline-none"
              style={{ color: colors.ink }}
            >
              {lignesEquipes.map((e) => (
                <option key={e.rang} value={e.rang}>
                  {nomDuRang(e.rang)}
                </option>
              ))}
            </select>
          </Ligne>
          <Ligne libelle="Du">
            <input
              type="date"
              value={premierJour}
              onChange={(e) => changerPremier(e.target.value)}
              aria-label="Premier jour d'absence"
              className="w-full bg-transparent text-right text-[15.5px] outline-none"
            />
          </Ligne>
          <Ligne libelle="Au">
            <input
              type="date"
              value={dernierJour}
              min={premierJour}
              onChange={(e) => setDernierJour(e.target.value)}
              aria-label="Dernier jour d'absence"
              className="w-full bg-transparent text-right text-[15.5px] outline-none"
            />
          </Ligne>
          <Ligne libelle="Motif">
            <input
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Déplacement…"
              aria-label="Motif de l'absence"
              className="w-full bg-transparent text-right text-[15.5px] outline-none"
            />
          </Ligne>
        </div>

        <p
          className="mt-2.5 rounded-xl px-3.5 py-3 text-[12.5px] leading-[1.5]"
          style={{ backgroundColor: voile(colors.or, 0.1), color: colors.or }}
        >
          {refusSaisi ? (
            phraseDuRefus(refusSaisi)
          ) : (
            <>
              {nomDuRang(rang)} sera absente {libelleAbsence(premierJour, dernierJour)} —
              week-ends compris. Le motif n’est là que pour vous.
            </>
          )}
        </p>

        {refus && (
          <p role="alert" className="mt-2.5 text-center text-[13px]" style={{ color: colors.alert }}>
            {refus}
          </p>
        )}

        <button
          type="button"
          onClick={() => void enregistrer()}
          disabled={!armé}
          className="mt-3 w-full rounded-full py-[15px] text-[15px]"
          style={{
            backgroundColor: colors.rust,
            color: colors.cream,
            fontFamily: font.display,
            opacity: armé ? 1 : 0.35,
          }}
        >
          {enCours ? "Enregistrement…" : "Noter l’absence"}
        </button>
        <button
          type="button"
          onClick={() => setOuverte(false)}
          className="mt-1.5 w-full rounded-full py-3 text-[14.5px]"
          style={{ color: colors.muted }}
        >
          Annuler
        </button>
      </BottomSheet>
    </section>
  );
}

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <label
      className="flex items-center justify-between gap-3 px-[15px] py-[13px]"
      style={{ backgroundColor: colors.card }}
    >
      <span className="flex-shrink-0 text-[13px]" style={{ color: colors.muted }}>
        {libelle}
      </span>
      {children}
    </label>
  );
}
