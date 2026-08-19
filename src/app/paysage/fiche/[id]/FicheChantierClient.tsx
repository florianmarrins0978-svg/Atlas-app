"use client";

import { useMemo, useState } from "react";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { jourLisible } from "@/lib/jour";
import { parFamilles } from "@/lib/prestations-entretien";
import {
  MINUTES_MAX,
  PAS_MINUTES,
  empechementEnvoi,
  libelleMinutes,
} from "@/lib/passage-entretien";
import { composerMessageEntretien, lienTransmission } from "@/lib/message-client";
import type { CiviliteChoisie } from "@/lib/civilite";
import {
  cocherLigneAction,
  envoyerFicheAction,
  majPassageAction,
  nommerClientAction,
} from "../actions";

// La fiche qu'il coche sur un chantier — arrangement C, 17 août 2026.
//
// **Ce que cet écran ne fait PAS : décider.** Ce qui reste à l'écran quand le
// client est nommé est calculé par le serveur (`recomposerPourClient`), et
// l'écran affiche ce qu'on lui rend. Refaire ce tri ici donnerait deux vérités
// sur une même liste, et elles finiraient par diverger (`CLAUDE.md` §3).

type Ligne = { id: string; famille: string; libelle: string; ordre: number; faite: boolean };

export type PassageAffiche = {
  id: string;
  jour: string;
  clientId: string | null;
  clientNom: string | null;
  clientTelephone: string | null;
  clientEmail: string | null;
  clientCivilite: string | null;
  minutes: number | null;
  observations: string | null;
  envoyeLe: string | null;
  jeton: string | null;
  lignes: Ligne[];
};

export default function FicheChantierClient({
  passage,
  clients,
  origine,
  entrepriseNom,
}: {
  passage: PassageAffiche;
  clients: { id: string; nom: string; adresse: string | null }[];
  /** `https://…`, bâtie par le serveur — jamais lue depuis `window` (voir la page). */
  origine: string;
  entrepriseNom: string;
}) {
  const [lignes, setLignes] = useState(passage.lignes);
  const [clientId, setClientId] = useState(passage.clientId);
  const [clientNom, setClientNom] = useState(passage.clientNom);
  const [minutes, setMinutes] = useState(passage.minutes);
  const [observations, setObservations] = useState(passage.observations ?? "");
  const [envoyeLe, setEnvoyeLe] = useState(passage.envoyeLe);
  const [jeton, setJeton] = useState(passage.jeton);
  const [phrase, setPhrase] = useState<string | null>(null);
  // **Un CONSTAT n'est pas un refus, et ne se peint pas en rouge.** « 17
  // prestations retirées » est le résultat attendu du repli : le dire en rouge,
  // au bas de l'écran, au-dessous du bouton, le ferait lire comme une panne
  // — et il chercherait ce qu'il a cassé. Il se dit là où le changement a eu
  // lieu, sous le nom du client, du même gris que le reste.
  const [constat, setConstat] = useState<string | null>(null);
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");

  const parti = envoyeLe !== null;
  const familles = useMemo(() => parFamilles(lignes), [lignes]);

  const empechement = empechementEnvoi({
    clientId,
    lignes,
    envoyeLe: envoyeLe ? new Date(envoyeLe) : null,
  });

  async function cocher(ligne: Ligne) {
    if (parti) return;
    const faite = !ligne.faite;
    // **L'écran bouge d'abord, le serveur suit.** Sous un gant, un retard d'un
    // demi-seconde entre l'appui et la coche se lit comme un appui manqué —
    // et il appuie une seconde fois, qui décoche.
    setLignes((cur) => cur.map((l) => (l.id === ligne.id ? { ...l, faite } : l)));
    const r = await cocherLigneAction(passage.id, ligne.id, faite);
    if (!r.ok) {
      setLignes((cur) => cur.map((l) => (l.id === ligne.id ? { ...l, faite: !faite } : l)));
      setPhrase(r.phrase);
    }
  }

  async function poserMinutes(valeur: number | null) {
    setMinutes(valeur);
    const r = await majPassageAction(passage.id, { minutes: valeur });
    if (!r.ok) setPhrase(r.phrase);
  }

  async function choisirClient(c: { id: string; nom: string }) {
    setChoixOuvert(false);
    setRecherche("");
    const r = await nommerClientAction(passage.id, c.id);
    if (!r.ok) {
      setPhrase(r.phrase);
      return;
    }
    setClientId(c.id);
    setClientNom(c.nom);
    // **Le serveur rend ce qui reste, l'écran l'affiche.** Refaire le repli
    // ici donnerait deux vérités sur une même liste, et une fiche qui montre
    // autre chose que ce qui est en base est pire qu'une fiche trop longue.
    setLignes(r.lignes);
    setConstat(
      r.retirees > 0
        ? `Fiche repliée sur ce que ${c.nom} prend d'habitude — ${r.retirees} ligne${
            r.retirees > 1 ? "s" : ""
          } de moins. Vous pouvez encore tout cocher.`
        : null
    );
  }

  async function envoyer() {
    const r = await envoyerFicheAction(passage.id);
    if (!r.ok) {
      setPhrase(r.phrase);
      return;
    }
    setEnvoyeLe(new Date().toISOString());
    setJeton(r.lien.split("/").pop() ?? null);
  }

  const clientsFiltres = clients.filter((c) =>
    recherche.trim() === ""
      ? true
      : c.nom.toLowerCase().includes(recherche.trim().toLowerCase())
  );

  return (
    <div
      className="pb-12"
      style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }}
      data-atlas="fiche-chantier"
    >
      <section className="mx-[26px] mt-[20px]">
        <p className="text-[13px]" style={{ color: colors.muted }}>
          {jourLisible(passage.jour)}
        </p>

        {/* ─── LE PONT VERS LE CLIENT — arrangement C ─────────────────────────
            « Une ligne discrète, touchable à tout moment. » Elle est en HAUT et
            non au bas de la fiche : c'est la première chose qu'il sait en
            arrivant chez quelqu'un, et la dernière qu'on veut lui réclamer une
            fois qu'il a tout coché. */}
        {clientId ? (
          <>
            <div className="mt-[8px] flex items-center gap-[10px]">
              <span className="text-[17px]" style={{ fontFamily: font.display }}>
                {clientNom}
              </span>
              {!parti && (
                <button
                  type="button"
                  onClick={() => setChoixOuvert(true)}
                  className="text-[12px] underline"
                  style={{ color: colors.muted }}
                >
                  Changer
                </button>
              )}
            </div>
            {constat && !parti && (
              <p
                className="mt-[5px] text-[11.5px] leading-[1.5]"
                style={{ color: colors.muted }}
              >
                {constat}
              </p>
            )}
          </>
        ) : (
          !parti && (
            <button
              type="button"
              data-atlas="pont-client"
              onClick={() => setChoixOuvert(true)}
              className="mt-[8px] text-left"
            >
              <span className="text-[15px]" style={{ color: colors.rust }}>
                + C&apos;est pour quel client ?
              </span>
              <span className="mt-[2px] block text-[11.5px]" style={{ color: colors.muted }}>
                Facultatif — vous pourrez le dire à la fin.
              </span>
            </button>
          )
        )}
      </section>

      {choixOuvert && (
        <ChoixDuClient
          clients={clientsFiltres}
          recherche={recherche}
          setRecherche={setRecherche}
          fermer={() => setChoixOuvert(false)}
          choisir={choisirClient}
        />
      )}

      {/* ─── LES PRESTATIONS ────────────────────────────────────────────────── */}
      <section className="mx-[26px] mt-[24px]">
        {familles.map((groupe) => (
          <div key={groupe.famille} className="mt-[18px] first:mt-0">
            <h2 className={smallCaps} style={{ color: colors.muted }}>
              {groupe.famille}
            </h2>
            <div className="mt-[8px]">
              {groupe.lignes.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  disabled={parti}
                  onClick={() => cocher(l)}
                  aria-pressed={l.faite}
                  className="flex min-h-[48px] w-full items-center gap-[13px] border-b py-[11px] text-left"
                  style={{ borderColor: colors.line }}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] text-[13px]"
                    style={{
                      flex: "none",
                      backgroundColor: l.faite ? colors.rust : "transparent",
                      border: `1.5px solid ${l.faite ? colors.rust : colors.chevron}`,
                      color: colors.card,
                    }}
                  >
                    {l.faite ? "✓" : ""}
                  </span>
                  <span
                    className="min-w-0 flex-1 text-[15px] leading-[1.3]"
                    style={{ color: l.faite ? colors.ink : colors.inkSoft }}
                  >
                    {l.libelle}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ─── LE TEMPS PASSÉ, À LA MOLETTE ───────────────────────────────────── */}
      <section className="mx-[26px] mt-[28px]">
        <h2 className={smallCaps} style={{ color: colors.muted }}>
          Temps passé
        </h2>
        <MoletteDuree minutes={minutes} figee={parti} poser={poserMinutes} />
      </section>

      {/* ─── LES OBSERVATIONS ───────────────────────────────────────────────── */}
      <section className="mx-[26px] mt-[24px]">
        <h2 className={smallCaps} style={{ color: colors.muted }}>
          Observations
        </h2>
        <textarea
          value={observations}
          disabled={parti}
          onChange={(e) => setObservations(e.target.value)}
          onBlur={async () => {
            const r = await majPassageAction(passage.id, { observations: observations || null });
            if (!r.ok) setPhrase(r.phrase);
          }}
          rows={3}
          placeholder="Ce que le client doit savoir — une haie à reprendre, un arrosage coupé…"
          className="mt-[8px] w-full rounded-[14px] px-[15px] py-3 text-[15px] leading-[1.5] outline-none"
          style={{ backgroundColor: colors.card, color: colors.ink, border: `1px solid ${colors.line}` }}
        />
      </section>

      {/* ─── L'ENVOI ────────────────────────────────────────────────────────── */}
      <section className="mx-[26px] mt-[30px]">
        {parti ? (
          <RapportParti
            lien={jeton ? `${origine}/entretien/${jeton}` : ""}
            clientNom={clientNom}
            entrepriseNom={entrepriseNom}
            clientCivilite={passage.clientCivilite}
            telephone={passage.clientTelephone}
            email={passage.clientEmail}
          />
        ) : (
          <>
            <PrimaryButton repere="envoyer-fiche" disabled={empechement !== null} onClick={envoyer}>
              Enregistrer et envoyer
            </PrimaryButton>
            {/* **Le bouton éteint DIT pourquoi.** Un bouton gris muet passe pour
                cassé, et il appuie trois fois avant d'abandonner. */}
            {empechement && (
              <p
                className="mt-[12px] text-center text-[12.5px] leading-[1.6]"
                style={{ color: colors.muted }}
              >
                {empechement}
              </p>
            )}
          </>
        )}

        {phrase && (
          <p
            className="mt-[14px] text-center text-[12.5px] leading-[1.6]"
            style={{ color: colors.alert }}
          >
            {phrase}
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * La molette du temps — **sa décision du 16 août : « la A »**.
 *
 * Deux listes natives. Sur son iPhone, c'est EXACTEMENT la molette qu'il
 * connaît : celle du réveil, celle de l'agenda. Aucune imitation ne rendra la
 * friction d'un vrai tambour, et une molette dessinée par nous serait une
 * molette de plus à apprendre. Les autres propositions, et pourquoi elles ont
 * été écartées : `docs/maquettes/65-choisir-l-heure.html`.
 *
 * **Une molette ne peut produire qu'une valeur juste** : il n'y a rien à
 * refuser, donc rien à expliquer. C'est ce qui la sépare d'un champ de saisie.
 */
function MoletteDuree({
  minutes,
  figee,
  poser,
}: {
  minutes: number | null;
  figee: boolean;
  poser: (valeur: number | null) => void;
}) {
  const heures = minutes === null ? 0 : Math.floor(minutes / 60);
  const reste = minutes === null ? 0 : minutes % 60;

  const style = {
    backgroundColor: colors.card,
    color: colors.ink,
    border: `1px solid ${colors.line}`,
    fontFamily: font.display,
  };

  return (
    <div className="mt-[8px] flex items-center gap-[10px]">
      <select
        aria-label="Heures"
        disabled={figee}
        value={heures}
        onChange={(e) => poser(Number(e.target.value) * 60 + reste)}
        className="flex-1 rounded-[14px] px-[15px] py-3 text-[17px] outline-none"
        style={style}
      >
        {Array.from({ length: MINUTES_MAX / 60 + 1 }, (_, h) => (
          <option key={h} value={h}>
            {h} h
          </option>
        ))}
      </select>
      <select
        aria-label="Minutes"
        disabled={figee}
        value={reste}
        onChange={(e) => poser(heures * 60 + Number(e.target.value))}
        className="flex-1 rounded-[14px] px-[15px] py-3 text-[17px] outline-none"
        style={style}
      >
        {Array.from({ length: 60 / PAS_MINUTES }, (_, i) => i * PAS_MINUTES).map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      <span className="text-[13px]" style={{ color: colors.muted, flex: "none" }}>
        {libelleMinutes(minutes)}
      </span>
    </div>
  );
}

/**
 * Le choix du client — **on le retrouve, on ne le retape pas**.
 *
 * La catégorie client existe depuis le 16 août : ressaisir un nom déjà connu
 * fabriquerait un second « Martins » que rien ne rapprocherait du premier, et
 * le passage suivant ne retrouverait plus son historique.
 */
function ChoixDuClient({
  clients,
  recherche,
  setRecherche,
  fermer,
  choisir,
}: {
  clients: { id: string; nom: string; adresse: string | null }[];
  recherche: string;
  setRecherche: (v: string) => void;
  fermer: () => void;
  choisir: (c: { id: string; nom: string }) => void;
}) {
  return (
    <section className="mx-[26px] mt-[16px]" data-atlas="choix-du-client">
      <div
        className="rounded-[18px] px-[16px] py-[14px]"
        style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}` }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className={smallCaps} style={{ color: colors.muted }}>
            Pour qui ?
          </span>
          <button
            type="button"
            onClick={fermer}
            className="text-[12px] underline"
            style={{ color: colors.muted }}
          >
            Fermer
          </button>
        </div>

        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un client"
          className="mt-[10px] w-full rounded-[12px] px-[13px] py-[9px] text-[15px] outline-none"
          style={{ backgroundColor: colors.cream, color: colors.ink, border: `1px solid ${colors.line}` }}
        />

        {clients.length === 0 ? (
          <p className="mt-[12px] text-[12.5px] leading-[1.6]" style={{ color: colors.muted }}>
            Aucun client à ce nom. Vos clients se créent au fil des devis.
          </p>
        ) : (
          <div className="mt-[6px] max-h-[240px] overflow-y-auto">
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => choisir(c)}
                className="flex min-h-[46px] w-full items-center border-b py-[10px] text-left"
                style={{ borderColor: colors.line }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-[1.25]">{c.nom}</span>
                  {c.adresse && (
                    <span className="mt-[2px] block text-[11.5px]" style={{ color: colors.muted }}>
                      {c.adresse}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Ce qu'il voit une fois le rapport figé — **et le message à envoyer**.
 *
 * **Aucun fournisseur d'envoi, et c'est un choix** (`docs/A-FAIRE.md` §5, sa
 * décision du 3 août) : le message part de SA messagerie et de SON numéro. Le
 * client reçoit un texte de son artisan, pas d'un robot inconnu.
 */
function RapportParti({
  lien,
  clientNom,
  clientCivilite,
  entrepriseNom,
  telephone,
  email,
}: {
  /** Adresse complète du rapport, bâtie par le serveur. */
  lien: string;
  clientNom: string | null;
  clientCivilite: string | null;
  entrepriseNom: string;
  telephone: string | null;
  email: string | null;
}) {
  // **Le message et l'adresse `sms:`/`mailto:` viennent du module commun.**
  // Les refaire ici donnerait deux façons d'écrire au client de l'artisan, et
  // c'est là que se logent les défauts payés : un numéro espacé qui ouvre un
  // SMS sans destinataire, un lien collé au texte qui n'est pas cliquable
  // (`src/lib/message-client.ts`).
  const canal: "sms" | "email" = telephone ? "sms" : "email";
  const message = composerMessageEntretien({
    clientNom: clientNom ?? "",
    clientCivilite: (clientCivilite ?? undefined) as CiviliteChoisie | undefined,
    entrepriseNom,
    lien,
  });
  const destinataire = telephone ?? email;

  return (
    <div>
      <p className="text-center text-[13px] leading-[1.6]" style={{ color: colors.muted }}>
        Ce rapport est figé. Il ne se modifie plus — c&apos;est ce qui en fait une preuve de
        passage.
      </p>

      <div className="mt-[16px]">
        {destinataire ? (
          <PrimaryButton
            repere={canal === "sms" ? "ouvrir-sms-fiche" : "ouvrir-email-fiche"}
            href={lienTransmission({ canal, destinataire, message })}
          >
            {canal === "sms" ? "Ouvrir le SMS tout prêt" : "Ouvrir l'e-mail tout prêt"}
          </PrimaryButton>
        ) : (
          // **Ni téléphone ni courriel : le dire, et donner le lien quand même.**
          // Un écran qui n'offrirait rien laisserait un rapport figé sans moyen
          // de le transmettre — et il n'aurait aucun moyen de savoir pourquoi.
          <p className="text-center text-[12.5px] leading-[1.6]" style={{ color: colors.muted }}>
            Ce client n&apos;a ni téléphone ni e-mail dans sa fiche. Copiez le lien ci-dessous.
          </p>
        )}
      </div>

      {lien && (
        <p
          className="mt-[14px] break-all text-center text-[11.5px] leading-[1.6]"
          style={{ color: colors.muted }}
        >
          {lien}
        </p>
      )}
    </div>
  );
}
