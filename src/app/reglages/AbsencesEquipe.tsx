"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { colors, font, surPlein } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import { salariesAffiches, libelleSalarie } from "@/lib/equipes";
import { libelleAbsence, phraseDuRefus, refusDeLAbsence } from "@/lib/absences-equipe";
import { deOuD } from "@/lib/contrats-entretien";
import { noterAbsenceAction, retirerAbsenceAction } from "./actions";
import TeteRonde from "@/components/atlas/TeteRonde";
import Paquet from "@/components/atlas/reglages/Paquet";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import LigneReglage, { styleValeurReglage } from "@/components/atlas/reglages/LigneReglage";
import Picto from "@/components/atlas/reglages/Picto";

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
  agendaRelie,
}: {
  nombreSalaries: number;
  /** Ce que la base porte, par rang. Un rang absent est un cas ordinaire. */
  noms: { rang: number; nom: string | null; photo: string | null }[];
  initialAbsences: AbsenceAffichee[];
  /** Le jour d'aujourd'hui, calculé au serveur — jamais dans le navigateur. */
  aujourdHui: string;
  /**
   * Un agenda extérieur est-il relié ET actif — Google ou iCloud ?
   *
   * **Lu au serveur, jamais supposé.** C'est lui qui décide de ce que la phrase
   * du bas a le droit de promettre : sans raccordement, les périodes
   * extérieures sont vides, et des congés posés ailleurs ne bloquent rien.
   */
  agendaRelie: boolean;
}) {
  const router = useRouter();

  const [ouverte, setOuverte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  /**
   * Les chantiers d'où ce congé vient de retirer la personne.
   *
   * **Ici, et pas au planning, parce qu'ici rien ne se voit.** Poser un congé
   * défait les affectations qu'il traverse (sa consigne du 8 septembre 2026,
   * « corrige à la racine »). Sur le planning, la pastille disparaît sous ses
   * yeux : l'écran MONTRE, il n'a rien à expliquer (`CLAUDE.md` §3). Sur cet
   * écran-là, les chantiers concernés sont ailleurs — sans cette phrase, une
   * demi-journée passerait de « Julien » à personne sans qu'il l'apprenne.
   */
  const [liberes, setLiberes] = useState<{ id: string; nom: string }[]>([]);

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
    /**
     * **CETTE PHRASE PROMETTAIT UN AGENDA QUI N'EST PEUT-ÊTRE PAS RELIÉ.**
     *
     * Trouvé le 8 septembre 2026, en vérifiant la phrase d'à côté qu'il venait
     * de faire retirer. Elle affirmait « Atlas en tient compte » sans rien
     * savoir : `periodesOccupeesPourEntreprise` rend une liste VIDE quand
     * aucune ligne d'agenda n'est reliée et active — donc un artisan seul, sans
     * agenda branché, posait ses congés dans Google et Atlas continuait de
     * proposer ces jours-là. Il ne l'aurait su qu'en recevant l'appel d'un
     * client un jour de vacances.
     *
     * **Ce n'est pas la phrase qu'on répare, c'est ce qu'elle dit du produit :**
     * l'écran lit l'état réel des deux raccordements (Google et iCloud) et
     * n'affirme que ce qui est vrai pour LUI. Quand rien n'est relié, il donne
     * le geste qui manque au lieu d'une promesse.
     */
    // **La phrase devient une plage qui se touche tout entière** (planche du
    // 26 octobre 2026) quand il y a un agenda à relier : le geste qui manque
    // se trouve sans viser un mot souligné.
    const phrase = (
      <p className="text-[15px] leading-[1.5]" style={{ color: colors.inkSoft }}>
        Seul, une absence fermerait l’entreprise : plus aucune date ne serait
        proposable.{" "}
        {agendaRelie ? (
          <>
            <span className="font-semibold" style={{ color: colors.ink }}>
              Pour vos congés, posez-les dans votre agenda
            </span>{" "}
            : Atlas en tient compte et ne proposera rien sur ces jours-là.
          </>
        ) : (
          <>
            Pour vos congés,{" "}
            <span
              className="font-semibold underline decoration-[1.5px] underline-offset-4"
              style={{ color: colors.or }}
            >
              reliez votre agenda
            </span>{" "}
            : Atlas n’en tient compte qu’une fois relié.
          </>
        )}
      </p>
    );
    return (
      <Paquet titre="Absences" sansPlage>
        {agendaRelie ? (
          <div className="flex items-start gap-3.5 rounded-[6px] p-[18px]" style={{ backgroundColor: colors.card }}>
            <PastilleIcone ton="bleu">
              <Picto nom="calendrier" />
            </PastilleIcone>
            {phrase}
          </div>
        ) : (
          <Link
            href="/reglages/agenda"
            data-atlas="agenda-a-relier"
            className="flex items-start gap-3.5 rounded-[6px] p-[18px]"
            style={{ backgroundColor: colors.card }}
          >
            <PastilleIcone ton="bleu">
              <Picto nom="calendrier" />
            </PastilleIcone>
            {phrase}
          </Link>
        )}
      </Paquet>
    );
  }

  const lignesEquipes = salariesAffiches(noms, nombreSalaries);
  const nomDuRang = (r: number) =>
    libelleSalarie(lignesEquipes.find((e) => e.rang === r) ?? { rang: r, nom: null }, nombreSalaries) ??
    `Salarié ${r}`;
  const photoDuRang = (r: number) => noms.find((e) => e.rang === r)?.photo ?? null;

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
    setLiberes([]);
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
    setLiberes(r.chantiersLiberes);
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

  // **« Absence de Thomas », et plus « Thomas sera absente »** (planche du
  // 26 octobre 2026) : la phrase mettait le féminin à tout le monde. Le nom ne
  // dit pas le genre ; « absence de » est juste pour chacun. L'élision vient de
  // la règle commune (`deOuD`) : « d'Antoine », jamais « de Antoine ».
  const nomSaisi = nomDuRang(rang);
  const deNom = deOuD(nomSaisi);

  return (
    <Paquet titre="Absences" sansPlage>
      {/* **« ATLAS N'ENVERRA PLUS PERSONNE À SA PLACE » EST PARTI — sa
          remarque du 8 septembre 2026 : *« la phrase dans absence n'a aucun
          sens »*. Il avait raison, et deux fois.

          **Atlas n'envoie personne**, et n'a jamais envoyé personne : il
          propose des dates à un client. « À sa place » laissait même entendre
          qu'un remplaçant serait choisi. La phrase décrivait une application
          qui n'existe pas.

          **Et elle disait de travers ce qui était déjà écrit juste**, sous le
          bouton : « un absent ne compte plus ces jours-là ; Atlas propose une
          date de moins ». Deux phrases pour une seule règle, dont la fausse
          arrivait la première (`CLAUDE.md` §3 : jamais deux fois la même
          règle).

          Ne reste ici que ce que l'autre ne dit pas : qu'il n'y a personne
          d'absent, et ce qu'on note dans ce bloc. */}

      {/* **Ce que le congé vient de défaire** — les chantiers d'où la personne
          a été retirée. La liste se ferme d'elle-même au congé suivant : elle
          annonce un fait, elle ne s'installe pas. */}
      {liberes.length > 0 && (
        <div role="status" className="mb-2.5">
          <PlageTon ton="or" dataAtlas="chantiers-liberes">
            Retiré de {liberes.map((c) => c.nom).join(", ")}.
          </PlageTon>
        </div>
      )}

      <div className="overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
        {absences.length === 0 ? (
          <p className="py-4 text-[15px] leading-[1.5]" style={{ color: colors.inkSoft }}>
            Personne d’absent. Un déplacement, un congé, un arrêt : notez-le ici.
          </p>
        ) : (
          absences.map((a) => (
            <div key={a.id} className="relative flex min-h-[76px] items-center gap-3.5 py-3">
              <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
              {/* **Sa tête, quand il en a une** (planche du 27 septembre 2026).
                  Sans photo, son numéro en or, comme sur la ligne de son nom. */}
              <TeteRonde repli={a.rang} photo={photoDuRang(a.rang)} taille={40} />
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-[18px] font-semibold leading-[1.25]"
                  style={{ fontFamily: font.display, color: colors.ink }}
                >
                  {nomDuRang(a.rang)}
                </span>
                <span className="mt-0.5 block text-[15px] font-semibold" style={{ color: colors.or }}>
                  {libelleAbsence(a.premierJour, a.dernierJour)}
                </span>
                {a.motif && (
                  <span className="mt-[3px] block truncate text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                    {a.motif}
                  </span>
                )}
              </span>
              {/* La croix grandit à 44 px : elle se touche sans viser. */}
              <button
                type="button"
                onClick={() => void retirer(a.id)}
                aria-label={`Retirer l'absence de ${nomDuRang(a.rang)}`}
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full"
                style={{ boxShadow: `inset 0 0 0 1px ${colors.line}`, color: colors.inkSoft }}
              >
                <Picto nom="croix" taille={18} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* **Une pilule creuse aux bouts ronds**, comme dans l'appli d'aujourd'hui
          (sa demande du 26 octobre 2026, et `scripts/test-boutons-arrondis.ts`).
          Le plein reste au seul geste qui enregistre, dans la feuille. */}
      <button
        type="button"
        onClick={ouvrir}
        className="mt-4 flex min-h-[56px] w-full items-center justify-center rounded-full text-[17px] font-semibold"
        style={{ boxShadow: `inset 0 0 0 1px ${colors.line}`, color: colors.rust }}
      >
        + Noter une absence
      </button>

      <p className="mx-0.5 mt-3 text-[14px] leading-[1.5]" style={{ color: colors.inkSoft }}>
        Un absent <span className="font-semibold" style={{ color: colors.ink }}>ne compte plus</span> ces
        jours-là : Atlas propose une date de moins, et tout revient normal
        ensuite. Vos clients ne voient rien de tout ceci.
      </p>

      <BottomSheet open={ouverte} onBackdropClick={() => setOuverte(false)}>
        {/* « ABSENCE » en capitales au-dessus est parti (planche du 26 octobre
            2026) : la question suffit. */}
        <h2 className="mb-4 mt-1 text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
          Qui n’est pas là ?
        </h2>

        <div className="overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
          <LigneReglage libelle="Qui" htmlFor="absence-qui">
            <span className="flex items-center justify-between gap-2">
              <select
                id="absence-qui"
                value={rang}
                onChange={(e) => setRang(Number(e.target.value))}
                aria-label="Qui est absent"
                className="min-w-0 flex-1 appearance-none"
                style={styleValeurReglage}
              >
                {lignesEquipes.map((e) => (
                  <option key={e.rang} value={e.rang}>
                    {nomDuRang(e.rang)}
                  </option>
                ))}
              </select>
              <span className="flex-none" style={{ color: colors.or }}>
                <Picto nom="bas" taille={20} />
              </span>
            </span>
          </LigneReglage>
          <div className="relative grid grid-cols-2 gap-[18px] py-3.5">
            <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
            <label className="block min-w-0">
              <span className="block text-[14px] font-semibold" style={{ color: colors.inkSoft }}>
                Du
              </span>
              <input
                type="date"
                value={premierJour}
                onChange={(e) => changerPremier(e.target.value)}
                aria-label="Premier jour d'absence"
                className="mt-[3px] block"
                style={styleValeurReglage}
              />
            </label>
            <label className="block min-w-0">
              <span className="block text-[14px] font-semibold" style={{ color: colors.inkSoft }}>
                Au
              </span>
              <input
                type="date"
                value={dernierJour}
                min={premierJour}
                onChange={(e) => setDernierJour(e.target.value)}
                aria-label="Dernier jour d'absence"
                className="mt-[3px] block"
                style={styleValeurReglage}
              />
            </label>
          </div>
          <LigneReglage libelle="Motif" htmlFor="absence-motif">
            <input
              id="absence-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Déplacement…"
              aria-label="Motif de l'absence"
              style={styleValeurReglage}
            />
          </LigneReglage>
        </div>

        <div className="mt-2.5">
          <PlageTon ton={refusSaisi ? "ambre" : "or"}>
            {refusSaisi ? (
              phraseDuRefus(refusSaisi)
            ) : (
              <>
                Absence {deNom.slice(0, deNom.length - nomSaisi.length)}
                <span className="font-bold" style={{ color: colors.ink }}>{nomSaisi}</span>{" "}
                {libelleAbsence(premierJour, dernierJour)}, week-ends compris. Le motif n’est là que pour vous.
              </>
            )}
          </PlageTon>
        </div>

        {refus && (
          <p role="alert" className="mt-2.5 text-center text-[14px]" style={{ color: colors.alert }}>
            {refus}
          </p>
        )}

        <button
          type="button"
          onClick={() => void enregistrer()}
          disabled={!armé}
          className="atlas-plein mt-4 flex min-h-[56px] w-full items-center justify-center rounded-full text-[17px] font-semibold"
          style={{
            backgroundColor: colors.plein,
            color: surPlein,
            opacity: armé ? 1 : 0.35,
          }}
        >
          {enCours ? "Enregistrement…" : "Noter l’absence"}
        </button>
        <button
          type="button"
          onClick={() => setOuverte(false)}
          className="mt-1 flex min-h-[48px] w-full items-center justify-center rounded-full text-[16px] font-semibold"
          style={{ color: colors.inkSoft }}
        >
          Annuler
        </button>
      </BottomSheet>
    </Paquet>
  );
}
