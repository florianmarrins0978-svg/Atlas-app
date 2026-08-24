"use client";

import { useMemo, useState } from "react";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { jourLisible } from "@/lib/jour";
import { parFamilles } from "@/lib/prestations-entretien";
import { MINUTES_MAX, PAS_MINUTES, empechementEnvoi } from "@/lib/passage-entretien";
import { composerMessageEntretien, lienTransmission } from "@/lib/message-client";
import { ouvrirAdresse } from "@/lib/ouvrir-messagerie";
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

/** Un client de la liste — coordonnées comprises : voir la page. */
type Client = {
  id: string;
  nom: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  canal: "sms" | "email" | null;
};

export type PassageAffiche = {
  id: string;
  jour: string;
  clientId: string | null;
  clientNom: string | null;
  clientTelephone: string | null;
  clientEmail: string | null;
  clientCivilite: string | null;
  clientCanal: "sms" | "email" | null;
  minutes: number | null;
  tempsVisible: boolean;
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
  modeleMessage,
}: {
  passage: PassageAffiche;
  clients: Client[];
  /** `https://…`, bâtie par le serveur — jamais lue depuis `window` (voir la page). */
  origine: string;
  entrepriseNom: string;
  /**
   * Son gabarit de message, écrit dans « Devis & factures ». `null` : Atlas.
   *
   * **`modeleMessage`, jamais `messageClient`** : ce nom est pris ailleurs dans
   * l'application, où il désigne le mot laissé par le CLIENT — l'inverse.
   */
  modeleMessage: string | null;
}) {
  const [lignes, setLignes] = useState(passage.lignes);
  const [clientId, setClientId] = useState(passage.clientId);
  const [clientNom, setClientNom] = useState(passage.clientNom);
  /**
   * **Les coordonnées vivent en ÉTAT, pas dans les props.**
   *
   * La fiche s'ouvre sans client : `passage.clientTelephone` est alors vide, et
   * le rester après qu'il a nommé quelqu'un ferait ouvrir un message sans
   * destinataire — qu'il ne découvrirait que dans Messages. Elles suivent donc
   * le client choisi.
   */
  const [telephone, setTelephone] = useState(passage.clientTelephone);
  const [email, setEmail] = useState(passage.clientEmail);
  const [civilite, setCivilite] = useState(passage.clientCivilite);
  const [minutes, setMinutes] = useState(passage.minutes);
  /**
   * Le temps paraît-il sur le compte rendu du client ? — sa demande du 22 août.
   *
   * **Il ne gouverne QUE la page du client.** La durée reste enregistrée : elle
   * lui dit ce qu'a coûté un chantier, et la perdre en masquant l'obligerait à
   * la ressaisir au passage suivant (migration `0060`).
   */
  const [tempsVisible, setTempsVisible] = useState(passage.tempsVisible);
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
  /**
   * Par quoi le rapport part — **sa demande du 20 août 2026** : *« sous le nom
   * du client, il doit y avoir la mention envoyé par, avec le choix soit SMS
   * soit par email »*.
   *
   * Le défaut vient de SA fiche client, comme pour le devis : c'est un choix du
   * client, pas un réglage de l'application. Il reste changeable ici — il
   * change d'avis au moment d'envoyer, pas au moment de créer la fiche.
   */
  const [canal, setCanal] = useState<"sms" | "email">(
    passage.clientCanal ?? (passage.clientTelephone ? "sms" : "email")
  );
  const [recherche, setRecherche] = useState("");

  const parti = envoyeLe !== null;
  const familles = useMemo(() => parFamilles(lignes), [lignes]);

  const empechement = empechementEnvoi({
    clientId,
    lignes,
    envoyeLe: envoyeLe ? new Date(envoyeLe) : null,
    canal,
    telephone,
    email,
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

  async function basculerTemps() {
    if (parti) return;
    const voulu = !tempsVisible;
    // L'écran bouge d'abord, le serveur suit — comme les coches, et pour la
    // même raison : sous un gant, un demi-seconde d'attente se lit comme un
    // appui manqué, et il rappuie.
    setTempsVisible(voulu);
    const r = await majPassageAction(passage.id, { tempsVisible: voulu });
    if (!r.ok) {
      setTempsVisible(!voulu);
      setPhrase(r.phrase);
    }
  }

  async function choisirClient(c: Client) {
    setChoixOuvert(false);
    setRecherche("");
    const r = await nommerClientAction(passage.id, c.id);
    if (!r.ok) {
      setPhrase(r.phrase);
      return;
    }
    setClientId(c.id);
    setClientNom(c.nom);
    // Ses coordonnées et son canal arrivent avec lui : sans cela, l'écran
    // resterait sur celles d'un passage ouvert sans client, c'est-à-dire aucune.
    setTelephone(c.telephone);
    setEmail(c.email);
    setCanal(c.canal ?? (c.telephone ? "sms" : "email"));
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

  /**
   * Figer le rapport **et ouvrir sa messagerie dans la foulée**.
   *
   * *Sa demande du 20 août 2026 : « quand on clique sur enregistrer et envoyer
   * […] ça ouvre tout de suite soit le SMS, soit l'e-mail […] pas comme là où
   * ça nous ouvre d'abord une autre page ».* C'est le même geste que sur le
   * devis depuis le 18 août, et pour la même raison : le rapport est prêt, le
   * message est prêt, il n'y a plus rien à demander.
   *
   * **L'écran figé reste derrière, et ce n'est pas un oubli.** L'ouverture part
   * d'une continuation asynchrone — le rapport doit d'abord exister en base
   * pour avoir une adresse — et un navigateur peut refuser une navigation vers
   * `sms:` qui ne suit pas immédiatement le doigt, sans un mot. S'il refuse, le
   * patron retrouve le bouton ; s'il accepte, il ne le voit qu'au retour.
   */
  async function envoyer() {
    const r = await envoyerFicheAction(passage.id);
    if (!r.ok) {
      setPhrase(r.phrase);
      return;
    }
    const jetonNeuf = r.lien.split("/").pop() ?? null;
    setEnvoyeLe(new Date().toISOString());
    setJeton(jetonNeuf);
    if (!jetonNeuf) return;

    const destinataire = canal === "sms" ? telephone : email;
    if (!destinataire?.trim()) return;
    const message = composerMessageEntretien({
      clientNom: clientNom ?? "",
      clientCivilite: (civilite ?? undefined) as CiviliteChoisie | undefined,
      entrepriseNom,
      modele: modeleMessage,
      lien: `${origine}/entretien/${jetonNeuf}`,
    });
    ouvrirAdresse(lienTransmission({ canal, destinataire, message }), canal);
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
            {!parti && (
              <ChoixDuCanal canal={canal} setCanal={setCanal} telephone={telephone} email={email} />
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
                  data-atlas="prestation"
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
        {/* **L'état s'écrit en toutes lettres, à gauche du curseur.** Un
            interrupteur nu se décode ; cet écran se regarde avec un gant, entre
            deux chantiers. Et le mot est CONTRE son curseur : posé à droite, il
            se rattacherait au titre de la section suivante. */}
        <div className="flex items-center justify-between gap-3">
          <h2 className={smallCaps} style={{ color: colors.muted }}>
            Temps passé
          </h2>
          <button
            type="button"
            data-atlas="temps-visible"
            aria-pressed={tempsVisible}
            aria-label="Montrer le temps passé sur le compte rendu du client"
            disabled={parti}
            onClick={basculerTemps}
            className="flex items-center gap-2 disabled:opacity-40"
          >
            <span className={smallCaps} style={{ color: tempsVisible ? colors.rust : colors.muted }}>
              {tempsVisible ? "Visible" : "Masqué"}
            </span>
            <span
              aria-hidden="true"
              className="relative block h-[26px] w-[44px] rounded-full transition-colors"
              style={
                tempsVisible
                  ? { backgroundColor: colors.rust }
                  : { backgroundColor: colors.rustTint, boxShadow: `inset 0 0 0 1px ${colors.line}` }
              }
            >
              <span
                className="absolute left-[3px] top-[3px] block h-[20px] w-[20px] rounded-full transition-transform"
                style={{
                  backgroundColor: colors.card,
                  boxShadow: "0 1px 3px rgba(20,18,14,0.28)",
                  transform: tempsVisible ? "translateX(18px)" : "none",
                }}
              />
            </span>
          </button>
        </div>
        <MoletteDuree minutes={minutes} figee={parti} poser={poserMinutes} />
        {/* La phrase qu'il a dictée le 23 août, mot pour mot. Elle n'existe que
            masqué : un écran qui commente un réglage au repos est du bruit. */}
        {!tempsVisible && (
          <p className="mt-[9px] text-[12.5px] leading-[1.5]" style={{ color: colors.muted }}>
            Votre client ne le verra pas sur son compte rendu.
          </p>
        )}
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
            clientCivilite={civilite}
            telephone={telephone}
            email={email}
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
 * « Envoyé par » — **sa demande du 20 août 2026**, sous le nom du client.
 *
 * **Deux pastilles, pas une liste déroulante.** Il y a exactement deux réponses
 * possibles, et il choisit d'un pouce, sur un chantier : dérouler pour choisir
 * entre deux est un geste de plus pour rien. C'est aussi la forme que l'écran
 * du devis emploie déjà pour changer de canal.
 *
 * **Ce qui manque se DIT, et ne se cache pas.** Un canal sans coordonnée reste
 * proposé — il sait peut-être que le numéro est ailleurs —, mais il porte la
 * mention, et le bouton d'envoi s'éteint avec sa phrase
 * (`empechementEnvoi`). Le masquer laisserait croire à une panne.
 */
function ChoixDuCanal({
  canal,
  setCanal,
  telephone,
  email,
}: {
  canal: "sms" | "email";
  setCanal: (c: "sms" | "email") => void;
  telephone: string | null;
  email: string | null;
}) {
  const cases: { valeur: "sms" | "email"; mot: string; coordonnee: string | null }[] = [
    { valeur: "sms", mot: "SMS", coordonnee: telephone },
    { valeur: "email", mot: "E-mail", coordonnee: email },
  ];

  return (
    <div className="mt-[10px] flex items-center gap-[8px]" data-atlas="choix-du-canal">
      <span className={smallCaps} style={{ color: colors.muted, flex: "none" }}>
        Envoyé par
      </span>
      {cases.map((c) => {
        const actif = canal === c.valeur;
        return (
          <button
            key={c.valeur}
            type="button"
            aria-pressed={actif}
            data-canal={c.valeur}
            onClick={() => setCanal(c.valeur)}
            // 34 px de haut, touchable au pouce sans peser sur l'écran : la
            // pastille est un choix, pas l'action principale.
            className="rounded-full px-[13px] py-[7px] text-[12.5px] leading-none"
            style={{
              flex: "none",
              backgroundColor: actif ? colors.rust : "transparent",
              color: actif ? colors.card : colors.inkSoft,
              border: `1px solid ${actif ? colors.rust : colors.line}`,
            }}
          >
            {c.mot}
            {!c.coordonnee?.trim() && (
              <span style={{ opacity: 0.7 }}> · absent</span>
            )}
          </button>
        );
      })}
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
  clients: Client[];
  recherche: string;
  setRecherche: (v: string) => void;
  fermer: () => void;
  choisir: (c: Client) => void;
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
