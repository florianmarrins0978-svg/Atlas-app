"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { colors, font, libelleCaps, surPlein, texteSituation, voile } from "@/lib/design-tokens";
import {
  BORNES,
  lireConditions,
  lignesConditionsDevis,
  type Conditions,
} from "@/lib/conditions-documents";
import {
  MESSAGE_PAR_DEFAUT,
  phraseDuDocument,
  refusDuMessage,
} from "@/lib/message-client";
import {
  ecrireNumero,
  FORMATS_NUMERO,
  FORMAT_PAR_DEFAUT,
  repartChaqueAnnee,
} from "@/lib/numero-documents";
import {
  ALLURE_PAR_DEFAUT,
  encreSurFond,
  estLAllureParDefaut,
  LOGOS_ACCEPTES,
  refusDuLogo,
  TYPOGRAPHIES,
  typographieDe,
  type Allure,
} from "@/lib/allure-documents";
import {
  majAllureAction,
  majFormatNumeroAction,
  majConditionsAction,
  poserLogoAction,
  reprendreAllurePhotoAction,
  retirerLogoAction,
} from "./actions";
import EditeurMessage from "./EditeurMessage";

/**
 * « Devis & factures » — ce qui s'imprime en plus, et ce qui ne se coupe pas.
 *
 * *Dessiné le 13 août 2026 (`maquettes/atlas-reglages-documents.html`), codé le
 * 14. `ARCHITECTURE.md` §102.*
 *
 * **Un interrupteur éteint ne déplie rien.** Montrer un champ grisé sous un
 * réglage coupé invite à le remplir pour rien — c'est le parti arrêté sur la
 * planche du plan, et il tient ici.
 *
 * **L'APERÇU DU BAS DIT ENFIN LA VÉRITÉ — branché le 25 août 2026.**
 *
 * Il ne l'a pas toujours dite, et c'est le patron qui l'a vu : *« les autres qui
 * sont en ON doivent-ils être visibles sur le devis ? car je ne vois rien, est-ce
 * normal ? »* Non. Pendant onze jours, `lignesConditionsDevis` n'était appelée
 * **que par cet aperçu** : il réglait, l'aperçu montrait les phrases, et son
 * client ne recevait qu'une chose — la validité. Cet écran promettait ce
 * qu'aucun document ne tenait.
 *
 * **Depuis, les cinq autres se figent sur le devis à sa création** (migration
 * 0064), comme la validité et pour la même raison : corriger un réglage ne doit
 * pas réécrire un devis déjà parti. Le PDF les met en phrases avec CETTE
 * fonction-ci — deux rédactions finiraient par diverger, et c'est le client qui
 * lirait la mauvaise (`CLAUDE.md` §3).
 *
 * **Éteindre en fait disparaître**, et c'est sa question du même jour : *« si je
 * décoche le bouton OFF, ils sont censés disparaître ? »* Oui.
 * `scripts/test-conditions-sur-le-devis.ts` le tient, sur la trace du PDF.
 *
 * **Ce qui a laissé passer le défaut onze jours, et qu'il faut retenir :** les
 * contrôles éprouvaient la RÈGLE — les bonnes phrases pour les bons réglages —,
 * jamais le CHEMIN entre le réglage et le papier. Une pièce débranchée passe
 * entre les deux, en restant verte.
 *
 * L'aperçu ne porte aucun montant : le total d'un devis à venir n'existe pas, et
 * un chiffre inventé là finirait imprimé. Le PDF, lui, le connaît — c'est là que
 * le montant de l'acompte s'écrit.
 */
/**
 * L'aperçu, coloré : ce qu'Atlas remplit tout seul s'affiche en doré.
 *
 * **Ce n'est PAS une seconde rédaction du message** (`CLAUDE.md` §3) : on coupe
 * le modèle sur les mêmes pastilles que `rendreMessage`, on y pose les mêmes
 * valeurs, et la concaténation des morceaux redonne exactement le texte que le
 * client recevra. Le doré ne fait que MONTRER ce qui bouge — le prénom, la
 * phrase du document, le lien — pour qu'il le voie sans avoir à poser quoi que
 * ce soit à la main. Le nom de l'entreprise se pose aussi, mais en encre : il ne
 * « bouge » pas d'un envoi à l'autre.
 */
function apercuColore(
  modele: string,
  valeurs: { client: string; document: string; lien: string; entreprise: string }
) {
  return modele.split(/(\[client\]|\[document\]|\[lien\]|\[entreprise\])/).map((bout, i) => {
    if (bout === "[client]") return <b key={i} style={{ color: colors.or, fontWeight: 600 }}>{valeurs.client}</b>;
    if (bout === "[document]") return <b key={i} style={{ color: colors.or, fontWeight: 600 }}>{valeurs.document}</b>;
    if (bout === "[lien]") return <b key={i} style={{ color: colors.or, fontWeight: 600, wordBreak: "break-all" }}>{valeurs.lien}</b>;
    if (bout === "[entreprise]") return <span key={i}>{valeurs.entreprise}</span>;
    return <span key={i}>{bout}</span>;
  });
}

/** Les deux envois qui diffèrent le plus — c'est le mot qui change qu'il veut voir. */
const APERCUS_MESSAGE = [
  { clef: "devis", titre: "Envoi d'un devis", phrase: phraseDuDocument({ genre: "devis" }), lien: "https://…/devis/…" },
  {
    clef: "facture",
    titre: "Envoi d'une facture",
    // Un numéro et une échéance d'exemple, reconnaissables comme tels : les
    // siens n'existent pas tant qu'aucune facture n'est émise.
    phrase: phraseDuDocument({ genre: "facture", numero: "F2026-0008", echeanceLisible: "21 septembre" }),
    lien: "https://…/facture/…",
  },
] as const;

/**
 * Les `@font-face` des neuf familles — écrits DEPUIS la liste, jamais à la main.
 *
 * Une famille ajoutée à `TYPOGRAPHIES` doit s'afficher sans qu'on y pense :
 * une seconde liste ici finirait par en oublier une, et le patron aurait un
 * choix qui ne montre rien.
 */
const FACES = TYPOGRAPHIES.flatMap((t) =>
  t.famille && t.fichiers
    ? [
        `@font-face{font-family:"${t.famille}";font-weight:400;font-display:swap;src:url("/api/polices/${t.fichiers.normal}") format("truetype")}`,
        `@font-face{font-family:"${t.famille}";font-weight:700;font-display:swap;src:url("/api/polices/${t.fichiers.gras}") format("truetype")}`,
      ]
    : []
).join("");

/**
 * Le document d'exemple montré à côté de chaque format.
 *
 * **L'année vient de l'HORLOGE, jamais d'un millésime écrit à la main** —
 * c'est exactement le défaut que ce lot corrige : le numéro des factures
 * portait « 2026 » en dur, et en janvier 2027 il l'aurait porté encore.
 */
const EXEMPLE = {
  annee: new Date().getFullYear(),
  mois: new Date().getMonth() + 1,
  numero: 12,
};

export default function DocumentsClient({
  initial,
  messageInitial,
  entrepriseNom,
  formatInitial,
  allureInitiale,
  logoInitial,
}: {
  initial: Conditions;
  /** Son message, ou `null` quand il n'a pas touché à celui d'Atlas. */
  messageInitial: string | null;
  entrepriseNom: string;
  /** Le format de ses numéros, ou `null` quand il n'a rien choisi. */
  formatInitial: string | null;
  /** L'allure réglée, ou celle d'aujourd'hui quand il n'a rien touché. */
  allureInitiale: Allure;
  /** La clef de son logo dans le stockage, ou `null`. */
  logoInitial: string | null;
}) {
  const [c, setC] = useState<Conditions>(initial);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [aEcrire, setAEcrire] = useState(false);
  const [message, setMessage] = useState(messageInitial ?? MESSAGE_PAR_DEFAUT);

  // Ce que chaque pastille AFFICHE, en doré et verrouillé, dans le cadre. Le nom
  // de l'entreprise est le sien, réel ; les autres sont ce qu'Atlas y posera
  // (le prénom du client, la phrase qui s'adapte au document, le lien).
  const libellesJetons = useMemo<Record<string, string>>(
    () => ({
      "[client]": "le prénom",
      "[document]": "la phrase de votre devis / facture",
      "[lien]": "le lien",
      "[entreprise]": entrepriseNom || "votre entreprise",
    }),
    [entrepriseNom]
  );

  // ── L'allure : elle s'enregistre SEULE, dès qu'il touche une couleur ──
  // Le bouton du bas engage les conditions, qui lient l'entreprise. Une couleur
  // ne lie personne : la faire attendre le même bouton obligerait à valider des
  // conditions pour changer un fond de page.
  const [allure, setAllure] = useState<Allure>(allureInitiale);
  const [logo, setLogo] = useState<string | null>(logoInitial);
  const [refusAllure, setRefusAllure] = useState<string | null>(null);
  const [allureEnCours, demarrerAllure] = useTransition();
  const choixImage = useRef<HTMLInputElement | null>(null);

  // ── Le format des numéros : il s'enregistre seul, comme l'allure ──────
  const [formatNumero, setFormatNumero] = useState(formatInitial ?? FORMAT_PAR_DEFAUT);
  const [formatEnCours, demarrerFormat] = useTransition();

  function poserFormat(clef: string) {
    setFormatNumero(clef);
    demarrerFormat(async () => {
      const r = await majFormatNumeroAction(clef);
      // On réaffiche ce que la base porte : une clef refusée y est restée
      // celle d'avant, et l'écran doit montrer ce qui s'imprimera.
      if (r.ok) setFormatNumero(r.format);
      else setRefusAllure(r.raison);
    });
  }

  // ── Reprendre l'allure d'un document PHOTOGRAPHIÉ — sa demande du 25 août ──
  // Ce que la photo a repris (couleurs, police, mentions) et ce qu'elle n'a pas
  // su faire (réserve). Le même geste, la même transition que le réglage à la
  // main juste dessous : photographier n'est qu'une autre façon de le remplir.
  const [reprise, setReprise] = useState<{ repris: string[]; reserve: string | null } | null>(null);
  const choixPhoto = useRef<HTMLInputElement | null>(null);

  function reprendrePhoto(f: File) {
    setRefusAllure(null);
    setReprise(null);
    const formulaire = new FormData();
    formulaire.append("fichier", f);
    demarrerAllure(async () => {
      const r = await reprendreAllurePhotoAction(formulaire);
      if (!r.ok) {
        setRefusAllure(r.raison);
        return;
      }
      // On affiche ce que la base porte — l'allure et les mentions relues —,
      // jamais ce que la photo a cru voir : c'est ce qui s'imprimera.
      setAllure(r.allure);
      setC(lireConditions(r.conditions));
      setReprise({ repris: r.repris, reserve: r.reserve });
    });
  }

  function poserAllure(partiel: Partial<Allure>) {
    const prochaine = { ...allure, ...partiel };
    setAllure(prochaine);
    demarrerAllure(async () => {
      // **On envoie `null` quand c'est le défaut** : la base garde alors ses
      // colonnes vides, et ses documents suivront la charte si elle bouge.
      const r = await majAllureAction(estLAllureParDefaut(prochaine) ? null : prochaine);
      setRefusAllure(r.ok ? null : r.raison);
      // On réaffiche ce que la base porte : une couleur mal formée y est
      // retombée sur le défaut, et l'écran doit montrer ce qui s'imprimera.
      if (r.ok) setAllure(r.allure);
    });
  }

  // **Le refus vient de la MÊME fonction que le serveur** (`refusDuMessage`) :
  // un écran qui laisserait enregistrer ce que le serveur rejette lui ferait
  // appuyer sur un bouton qui ne fait rien.
  const refusMessage = refusDuMessage(message);

  function poser(partiel: Partial<Conditions>) {
    setC((v) => ({ ...v, ...partiel }));
    setAEcrire(true);
  }

  function enregistrer(partiel: Partial<Conditions>) {
    const prochain = { ...c, ...partiel };
    setC(prochain);
    demarrer(async () => {
      const r = await majConditionsAction({
        validiteJours: prochain.validiteJours,
        acomptePourcent: prochain.acomptePourcent,
        delaiPaiementJours: prochain.delaiPaiementJours,
        moyensPaiement: prochain.moyensPaiement,
        rappelerPenalites: prochain.rappelerPenalites,
        textePied: prochain.textePied,
      }, message);
      setRefus(r.ok ? null : r.raison);
      // **On affiche ce que la base porte, jamais ce qu'on a demandé.** Un refus
      // silencieux laisserait un réglage coché qui n'existe pas.
      if (r.ok) {
        setC(lireConditions(r.conditions));
        // **On réaffiche ce que la base porte.** `null` veut dire « celui
        // d'Atlas » : le champ redevient alors son texte, et non un cadre vide
        // qu'il croirait avoir effacé.
        setMessage(r.messageClient ?? MESSAGE_PAR_DEFAUT);
        setAEcrire(false);
      }
    });
  }

  const apercu = lignesConditionsDevis(c);

  return (
    <div className="pb-40">
      {refus && (
        <p
          role="alert"
          className={`mx-[26px] mt-4 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}`, color: colors.alert }}
        >
          {refus}
        </p>
      )}

      <Bloc titre="Ce qui s'imprime sur le devis">
        <Reglage
          nom="Durée de validité"
          dit="En tête, sous le numéro du devis"
          allume={c.validiteJours !== null}
          onBascule={(v) => enregistrer({ validiteJours: v ? 30 : null })}
        >
          <Chiffre
            valeur={c.validiteJours}
            unite="jours"
            apres="à compter de l'envoi"
            bornes={BORNES.validiteJours}
            onEcrire={(n) => poser({ validiteJours: n })}
            onFini={(n) => enregistrer({ validiteJours: n })}
          />
        </Reglage>

        <Reglage
          nom="Acompte à la commande"
          dit="Écrit sous le total du devis"
          allume={c.acomptePourcent !== null}
          onBascule={(v) => enregistrer({ acomptePourcent: v ? 30 : null })}
        >
          <Chiffre
            valeur={c.acomptePourcent}
            unite="%"
            apres="à la signature"
            bornes={BORNES.acomptePourcent}
            onEcrire={(n) => poser({ acomptePourcent: n })}
            onFini={(n) => enregistrer({ acomptePourcent: n })}
          />
        </Reglage>

        <Reglage
          nom="Délai de paiement"
          dit="Zéro veut dire comptant"
          allume={c.delaiPaiementJours !== null}
          onBascule={(v) => enregistrer({ delaiPaiementJours: v ? 30 : null })}
        >
          <Chiffre
            valeur={c.delaiPaiementJours}
            unite="jours"
            apres="après la facture"
            bornes={BORNES.delaiPaiementJours}
            onEcrire={(n) => poser({ delaiPaiementJours: n })}
            onFini={(n) => enregistrer({ delaiPaiementJours: n })}
          />
        </Reglage>

        <Reglage
          nom="Moyens de paiement acceptés"
          dit="Listés sous vos coordonnées bancaires"
          allume={c.moyensPaiement !== null}
          onBascule={(v) => enregistrer({ moyensPaiement: v ? "virement, chèque" : null })}
        >
          <Libre
            valeur={c.moyensPaiement ?? ""}
            exemple="virement, chèque, espèces"
            onEcrire={(t) => poser({ moyensPaiement: t })}
            onFini={(t) => enregistrer({ moyensPaiement: t })}
          />
        </Reglage>

        <Reglage
          nom="Rappeler les pénalités sur le devis"
          dit="Elles figurent de toute façon sur la facture"
          allume={c.rappelerPenalites}
          onBascule={(v) => enregistrer({ rappelerPenalites: v })}
        />

        <Reglage
          nom="Texte en bas de vos documents"
          dit="Ajouté tel quel à chaque devis"
          allume={c.textePied !== null}
          onBascule={(v) => enregistrer({ textePied: v ? "" : null })}
        >
          <Libre
            valeur={c.textePied ?? ""}
            exemple="Sous réserve d'accès au chantier."
            long
            onEcrire={(t) => poser({ textePied: t })}
            onFini={(t) => enregistrer({ textePied: t })}
          />
        </Reglage>
      </Bloc>

      {/* **CE QUI N'A PAS D'INTERRUPTEUR, dit à l'endroit exact où on le
          chercherait.** Le patron, le 13 août : des interrupteurs *« seulement
          à celles où la désactivation n'entraîne pas de problème juridique ou
          moral »*. Les retirer d'une facture la rendrait irrégulière ; un
          bouton ici serait « rendre ma facture irrégulière », posé dans un écran
          où l'on vient changer un pourcentage. */}
      <Bloc titre="Ce qui ne se coupe pas">
        <div className="flex items-start gap-3 py-[14px]">
          <span className="min-w-0 flex-1">
            <span className="block" style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.25 }}>
              Mentions légales de la facture
            </span>
            <span className={`mt-1 block ${texteSituation}`} style={{ color: colors.muted }}>
              Pénalités de retard, indemnité forfaitaire de 40 €, et la franchise de
              l&apos;article 293 B quand vous n&apos;êtes pas assujetti.
            </span>
          </span>
          <span className={libelleCaps} style={{ color: colors.or, flex: "none", paddingTop: 4 }}>
            Obligatoire
          </span>
        </div>
        <p className={texteSituation} style={{ color: colors.muted }}>
          Elles s&apos;écrivent seules et suivent votre régime de TVA. Les retirer rendrait
          la facture irrégulière.
        </p>
      </Bloc>

      {/* ── SON MESSAGE AU CLIENT — sa demande du 23 août 2026 ──────────────
          *« Y a-t-il un endroit dans les réglages où l'utilisateur peut rédiger
          ce message automatique ? »* Il n'y en avait pas.

          **Ici et pas ailleurs** : sa réponse A, devant la planche
          `appli/mon-message-au-client.html`. **Un seul message pour ses trois
          documents**, et la phrase du milieu vient d'Atlas — sa « façon 1 »,
          choisie après avoir vu ce que l'autre coûtait : une facture qui parle
          d'un devis, et l'échéance perdue. */}
      <Bloc titre="Mon message au client">
        {/* **Sa demande du 25 août 2026 :** le message par défaut est déjà
            écrit, il modifie ce qu'il veut, et « seuls les mots en doré ne
            peuvent être modifiés » — le prénom, la phrase du document (qui
            s'adapte au devis comme à la facture, sa « façon 1 »), le lien et son
            nom. C'est `EditeurMessage` qui les verrouille. */}
        <p className={`mb-3 ${texteSituation}`} style={{ color: colors.muted }}>
          Modifiez ce que vous voulez. Les mots en doré se remplissent tout seuls
          et ne se modifient pas.
        </p>

        <EditeurMessage
          valeur={message}
          libelles={libellesJetons}
          invalide={refusMessage !== null}
          onChange={(m) => {
            setMessage(m);
            setAEcrire(true);
          }}
        />

        {/* Le seul filet de sécurité qui reste : reprendre le message d'Atlas
            s'il l'a défait (par exemple en retirant le lien, que le serveur
            refuse). Montré seulement quand le sien en diffère. */}
        {message.trim() !== MESSAGE_PAR_DEFAUT && (
          <button
            type="button"
            data-atlas="message-defaut"
            onClick={() => {
              setMessage(MESSAGE_PAR_DEFAUT);
              setAEcrire(true);
            }}
            className="mt-2.5 min-h-[44px] rounded-full px-4 text-[13.5px]"
            style={{ color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          >
            Remettre le message d&apos;Atlas
          </button>
        )}

        {refusMessage && (
          <p
            role="alert"
            data-atlas="message-refus"
            className={`mt-2.5 ${texteSituation}`}
            style={{ color: colors.alert }}
          >
            {refusMessage}
          </p>
        )}

        {/* **Les deux aperçus passent par les mêmes valeurs que l'envoi.** Le
            doré ne fait que montrer ce qu'Atlas remplit ; côte à côte, ils
            prouvent que le mot change — « devis » ici, « facture » là — sans
            qu'il réécrive rien. */}
        <div className="mb-2 mt-5 flex items-baseline gap-2">
          <span className={libelleCaps} style={{ color: colors.muted }}>
            Ce que votre client recevra
          </span>
          <span className={texteSituation} style={{ color: colors.muted }}>
            · <b style={{ color: colors.or, fontWeight: 600 }}>doré</b> = rempli tout seul
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {APERCUS_MESSAGE.map((a) => (
            <div
              key={a.clef}
              data-atlas={`apercu-${a.clef}`}
              className="overflow-hidden rounded-[6px]"
              style={{ border: `1px solid ${colors.lineSoft}` }}
            >
              <div
                className={libelleCaps}
                style={{
                  padding: "7px 11px",
                  backgroundColor: colors.rustTint,
                  color: colors.muted,
                  borderBottom: `1px solid ${colors.lineSoft}`,
                }}
              >
                {a.titre}
              </div>
              <p
                className="whitespace-pre-wrap px-[11px] py-[11px] text-[12px] leading-[1.5]"
                style={{ backgroundColor: colors.card, color: colors.inkSoft }}
              >
                {apercuColore(message.trim() || MESSAGE_PAR_DEFAUT, {
                  client: "Mme Larousse",
                  document: a.phrase,
                  // Une adresse d'exemple, reconnaissable comme telle : le vrai
                  // lien n'existe qu'au moment de l'envoi.
                  lien: a.lien,
                  entreprise: entrepriseNom,
                })}
              </p>
            </div>
          ))}
        </div>
      </Bloc>

      {/* ── L'ALLURE DE SES DOCUMENTS — sa demande du 23 août 2026 ─────────
          *« il faudrait que l'utilisateur puisse avoir un endroit dédié à la
          modification de son devis. S'il veut rajouter son logo, changer la
          typographie, changer le fond de page. »*

          **Ici, et pas dans une rubrique à part** : sa réponse B devant la
          planche `appli/allure-de-mes-devis.html`. **Le devis et la facture
          seulement** — la feuille de chantier est interne, et il ne l'a pas
          demandée. */}
      {/* ── LE NUMÉRO DE SES DOCUMENTS — sa demande du 26 août 2026 ────────
          *« Dans la catégorie facture il faut rajouter le format de numéro,
          c'est obligatoire il me semble. »*

          **Le format ne l'est pas ; la SUITE l'est** — chronologique, sans trou
          ni doublon, ce qu'Atlas tenait déjà. Ce qui était cassé, en revanche,
          c'est que le millésime était écrit en dur : en janvier 2027, ses
          factures auraient encore dit 2026. */}
      <Bloc titre="Le numéro de mes documents">
        <p className={`mb-3 ${texteSituation}`} style={{ color: colors.muted }}>
          Vos documents déjà émis gardent leur numéro.
        </p>

        <div className="mb-4 flex flex-col gap-2">
          {FORMATS_NUMERO.map((f) => {
            const choisi = formatNumero === f.clef;
            return (
              <button
                key={f.clef}
                type="button"
                data-atlas={`format-${f.clef}`}
                aria-pressed={choisi}
                onClick={() => poserFormat(f.clef)}
                // `rounded-full`, comme tous ses boutons depuis le 12 août 2026.
                className="flex min-h-[62px] items-baseline justify-between gap-3 rounded-full px-5 py-2.5 text-left"
                style={{
                  backgroundColor: choisi ? colors.card : "transparent",
                  boxShadow: `inset 0 0 0 1px ${choisi ? colors.or : colors.line}`,
                }}
              >
                <span className="min-w-0">
                  <span className="block text-[15px]" style={{ color: colors.ink }}>
                    {f.nom}
                  </span>
                  {/* **La mention « par défaut » vit dans `dit`, et nulle part
                      ailleurs.** L'ajouter ici la faisait lire deux fois sur le
                      format concerné — « Le format par défaut · par défaut ».
                      Vu à la capture, par aucun test (`CLAUDE.md` §5). */}
                  <span className={`mt-0.5 block ${texteSituation}`} style={{ color: colors.muted }}>
                    {f.dit}
                  </span>
                </span>
                {/* **L'exemple vient de la MÊME fonction que le numéro réel**
                    (`ecrireNumero`). Un aperçu écrit à part finirait par montrer
                    autre chose que ce qui part chez le client (`CLAUDE.md` §3). */}
                <span
                  data-atlas={`exemple-${f.clef}`}
                  className="flex-none text-[15px]"
                  style={{ color: colors.or, fontVariantNumeric: "tabular-nums" }}
                >
                  {ecrireNumero(f.clef, "facture", EXEMPLE)}
                </span>
              </button>
            );
          })}
        </div>

        <p className={`mb-2 ${libelleCaps}`} style={{ color: colors.muted }}>
          Ce que ça donne
        </p>
        <div className="rounded-[6px] px-[15px] py-3" style={{ backgroundColor: colors.card }}>
          {([
            ["Votre prochain devis", ecrireNumero(formatNumero, "devis", EXEMPLE)],
            ["Votre prochaine facture", ecrireNumero(formatNumero, "facture", EXEMPLE)],
          ] as const).map(([quoi, valeur]) => (
            <p key={quoi} className="flex justify-between gap-3 py-1 text-[14px]">
              <span style={{ color: colors.ink }}>{quoi}</span>
              <span style={{ color: colors.inkSoft, fontVariantNumeric: "tabular-nums" }}>
                {valeur}
              </span>
            </p>
          ))}
        </div>

        {/* **Ce que le format IMPLIQUE se dit, et ne se règle pas à part.** Un
            second interrupteur « repartir chaque année » serait un piège : sur
            une suite sans année, le cocher ferait deux documents du même numéro
            à un an d'écart — un doublon, ce que la loi interdit. */}
        <p
          data-atlas="consequence-format"
          className={`mt-3 ${texteSituation}`}
          style={{ color: colors.muted }}
        >
          {repartChaqueAnnee(formatNumero)
            ? "Le compteur repart à 1 le 1ᵉʳ janvier."
            : "Le compteur ne repart jamais : sans l'année, deux documents porteraient le même numéro."}
        </p>

        <p className={`mt-3 ${texteSituation}`} style={{ color: colors.muted }}>
          {formatEnCours ? "Enregistrement…" : "Enregistré au fur et à mesure."}
        </p>
      </Bloc>

      <Bloc titre="L'allure de mes devis">
        {/* **Les vraies polices, servies depuis les fichiers du PDF.** Sans
            elles, ce choix est un mensonge : le navigateur ne connaît aucune
            des neuf, et « Playfair Display » s'afficherait en Georgia. Vu à la
            capture le 24 août 2026, jamais par un test. */}
        <style>{FACES}</style>
        <p className={`mb-3 ${texteSituation}`} style={{ color: colors.muted }}>
          Elle habille votre devis et votre facture. La feuille de chantier, elle,
          ne change pas : personne d&apos;autre que vous ne la lit.
        </p>

        {/* ── PHOTOGRAPHIER UN DEVIS — sa demande du 25 août 2026 ─────────────
            *« faut que l'utilisateur puisse prendre la photo de son devis […]
            pareil pour sa facture »*, après *« on comprend rien, trop compliqué
            pour modifier »*. Dessiné d'abord (`appli/photographier-mon-devis.html`)
            et tranché ainsi : la photo reprend l'ALLURE (couleurs, police) et les
            MENTIONS — jamais les lignes ni les prix, jamais le logo.

            **La photo d'abord, le réglage à la main dessous** : son choix devant
            la question du 25 août. Un seul champ, sans `capture` : le navigateur
            offre alors l'appareil photo OU la photothèque — son devis est parfois
            déjà une image dans sa galerie. */}
        <div
          className="mb-5 rounded-[6px] p-4"
          style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
        >
          <input
            ref={choixPhoto}
            type="file"
            accept="image/*"
            className="hidden"
            data-atlas="photo-fichier"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) reprendrePhoto(f);
            }}
          />
          {/* Deux gestes, un pour chaque document — comme sur la maquette. La
              lecture est la même : ce sont ses mots qui changent, pas le calcul. */}
          <button
            type="button"
            data-atlas="photo-devis"
            disabled={allureEnCours}
            onClick={() => choixPhoto.current?.click()}
            className="atlas-plein flex min-h-[52px] w-full items-center justify-center rounded-full px-4 text-[15px]"
            style={{ backgroundColor: colors.plein, color: surPlein, opacity: allureEnCours ? 0.6 : 1 }}
          >
            {allureEnCours ? "Lecture…" : "Photographier mon devis"}
          </button>
          <button
            type="button"
            data-atlas="photo-facture"
            disabled={allureEnCours}
            onClick={() => choixPhoto.current?.click()}
            className="mt-2 flex min-h-[52px] w-full items-center justify-center rounded-full px-4 text-[15px]"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}`, opacity: allureEnCours ? 0.6 : 1 }}
          >
            Photographier ma facture
          </button>

          {reprise && (
            <div data-atlas="photo-repris" className="mt-3">
              {reprise.repris.length > 0 ? (
                <p className="text-[14px] leading-[1.5]" style={{ color: colors.ink }}>
                  Repris : {reprise.repris.join(", ")}.
                </p>
              ) : (
                <p className="text-[14px] leading-[1.5]" style={{ color: colors.muted }}>
                  Rien n&apos;a pu être repris de cette photo.
                </p>
              )}
              {reprise.reserve && (
                <p className={`mt-1 ${texteSituation}`} style={{ color: colors.muted }}>
                  {reprise.reserve}
                </p>
              )}
            </div>
          )}

          <p className={`mt-2 ${texteSituation}`} style={{ color: colors.muted }}>
            Les couleurs, la police et les mentions. Ni les lignes, ni les prix.
          </p>
        </div>

        {refusAllure && (
          <p role="alert" data-atlas="allure-refus" className={`mb-3 ${texteSituation}`} style={{ color: colors.alert }}>
            {refusAllure}
          </p>
        )}

        {/* ── L'APERÇU EN TÊTE, ET IL RESTE COLLÉ — sa proposition B, 24 août 2026
            ────────────────────────────────────────────────────────────────────
            *« Lorsque je modifie mon devis, je suis obligé de descendre pour
            voir les modifications ; il faut mieux organiser la page pour
            pouvoir voir ce qu'on modifie. »* Trois rangements lui ont été
            dessinés (planche 96, `appli/allure-mieux-rangee.html`), et il a
            répondu : **« la B »**.

            **Le défaut était un défaut d'ORDRE, pas de contenu.** L'aperçu
            fermait ce bloc, après dix pastilles de typographie sur cinq rangées
            et deux nuanciers : il tombait à plus de 900 px du haut. Toucher une
            police, c'était descendre, regarder, remonter — dix-huit trajets
            pour essayer les neuf.

            **Pourquoi COLLÉ et pas seulement remonté** (la proposition A, qu'il
            n'a pas retenue) : posé en tête sans collage, l'aperçu se voit en
            arrivant puis ressort de l'écran dès qu'on descend aux polices. La
            moitié du problème seulement, et la planche le mesurait.

            **`sticky` et non `fixed`** : la feuille suit tant que CE bloc est à
            l'écran, et s'en va avec lui. Fixée, elle recouvrirait les réglages
            du message et du numéro, où elle n'a rien à faire.

            **Le fond est opaque, à dessein** : les pastilles défilent dessous,
            et sans lui on lirait « Merriweather » à travers le devis.

            **POURQUOI COLLÉ ET PAS SEULEMENT REMONTÉ EN TÊTE.** Trois rangements
            lui ont été montrés (`appli/allure-mieux-rangee.html`), et il a
            répondu **B** le 25 août 2026. La proposition A — l'aperçu simplement
            placé avant les réglages — ne règle que la moitié du problème : dès
            qu'on descend jusqu'aux polices, la feuille est de nouveau hors de
            l'écran, c'est-à-dire exactement là où l'on a besoin de la voir. La
            planche le disait, et il a tranché en connaissance de cause. */}
        <div
          data-atlas="allure-apercu-colle"
          className="sticky top-0 z-10 -mx-[26px] mb-5 px-[26px] pb-3 pt-2"
          // **Une ombre courte sous le bord**, et rien de plus : sans elle, les
          // pastilles qui défilent semblent s'effacer au milieu de nulle part.
          // Elle dit qu'il y a un dessus et un dessous.
          style={{
            backgroundColor: colors.cream,
            // **Aucune couleur en clair dans un écran** (`CLAUDE.md` §3) : sept
            // chartes cohabitent, dont deux sombres où une ombre noire posée en
            // dur ne se voit plus. `voile` la fait suivre l'encre de la charte.
            boxShadow: `0 8px 14px -12px ${voile(colors.ink, 0.5)}`,
          }}
        >
          {/* **Un aperçu d'APPARENCE, et rien d'autre.** Il ne porte aucun
              montant calculé, aucune condition : ce serait une seconde écriture
              du devis, qui finirait par ne plus dire ce que le PDF dit
              (`CLAUDE.md` §3). Ce qu'il montre — le fond, l'accent, la
              typographie, la place du logo — est exactement ce que la fabrique
              de PDF pose, et rien de plus. */}
          <p className={`mb-2 ${libelleCaps}`} style={{ color: colors.muted }}>
            L&apos;allure de la page
          </p>
          <Feuille allure={allure} logo={logo} nom={entrepriseNom} />
        </div>

        <p className={`mb-2 ${libelleCaps}`} style={{ color: colors.muted }}>Mon logo</p>
        <div className="mb-1 flex items-center gap-3">
          <span
            data-atlas="logo-case"
            className="flex h-[58px] w-[58px] flex-none items-center justify-center overflow-hidden rounded-[6px] text-[11px]"
            style={{ backgroundColor: colors.card, color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          >
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/fichiers/${logo}`}
                alt="Votre logo"
                className="h-full w-full object-contain"
              />
            ) : (
              "Aucun"
            )}
          </span>
          <input
            ref={choixImage}
            type="file"
            accept={LOGOS_ACCEPTES.join(",")}
            className="hidden"
            data-atlas="logo-fichier"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              // **Refusé ici avec la MÊME fonction que le serveur.** Le laisser
              // partir pour se le voir refuser après le téléversement lui ferait
              // attendre pour rien, sur un forfait de chantier.
              const refus = refusDuLogo(f.type, f.size);
              if (refus) {
                setRefusAllure(refus);
                return;
              }
              setRefusAllure(null);
              const formulaire = new FormData();
              formulaire.append("fichier", f);
              demarrerAllure(async () => {
                const r = await poserLogoAction(formulaire);
                if (r.ok) setLogo(r.logo);
                else setRefusAllure(r.raison);
              });
            }}
          />
          <button
            type="button"
            data-atlas="logo-choisir"
            onClick={() => choixImage.current?.click()}
            className="min-h-[44px] rounded-full px-4 text-[14px]"
            style={{ color: colors.or, boxShadow: `inset 0 0 0 1px ${colors.or}` }}
          >
            {logo ? "Changer" : "Choisir une image"}
          </button>
          {logo && (
            <button
              type="button"
              data-atlas="logo-retirer"
              onClick={() =>
                demarrerAllure(async () => {
                  const r = await retirerLogoAction();
                  if (r.ok) setLogo(null);
                  else setRefusAllure(r.raison);
                })
              }
              className="min-h-[44px] rounded-full px-4 text-[14px]"
              style={{ color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            >
              Retirer
            </button>
          )}
        </div>
        <p className={`mb-5 ${texteSituation}`} style={{ color: colors.muted }}>
          En haut à gauche, au-dessus de vos coordonnées. PNG ou JPEG, 1,5 Mo au plus.
        </p>

        <p className={`mb-2 ${libelleCaps}`} style={{ color: colors.muted }}>Typographie</p>
        <div className="mb-5 grid grid-cols-2 gap-2">
          {TYPOGRAPHIES.map((t) => {
            const choisie = allure.typographie === t.clef;
            return (
              <button
                key={t.clef}
                type="button"
                data-atlas={`typo-${t.clef}`}
                aria-pressed={choisie}
                onClick={() => poserAllure({ typographie: t.clef })}
                // **`rounded-full`, comme tous ses boutons depuis le 12 août
                //   2026.** `test-boutons-arrondis` l'a attrapé ici : un rayon
                //   de 8 px était resté, et un seul bouton carré dans
                //   l'application se voit. Le rembourrage est plus large en
                //   conséquence — sur une pastille, le texte touche la courbe.
                className="min-h-[62px] rounded-full px-5 py-2.5 text-left"
                style={{
                  backgroundColor: choisie ? colors.card : "transparent",
                  boxShadow: `inset 0 0 0 1px ${choisie ? colors.or : colors.line}`,
                }}
              >
                {/* **Le nom s'écrit DANS la police qu'il nomme.** Une liste de
                    noms en linéale ne montre rien de ce qu'on choisit — et
                    c'est la seule chose qu'il regarde ici. */}
                <span
                  className="block text-[15px]"
                  style={{ color: colors.ink, fontFamily: t.pileCss ?? undefined }}
                >
                  {t.nom}
                </span>
                <span className={`mt-0.5 block ${texteSituation}`} style={{ color: colors.muted }}>
                  {t.clef === ALLURE_PAR_DEFAUT.typographie ? `${t.dit} · par défaut` : t.dit}
                </span>
              </button>
            );
          })}
        </div>

        <Couleur
          titre="Fond de page"
          valeur={allure.fond}
          clef="fond"
          aide="N'importe quelle couleur. Un fond sombre éclaircit le texte tout seul."
          // **Le raccourci « aujourd'hui » vient du défaut, jamais d'un hexa
          //   retapé.** Une teinte recopiée ici aurait fini par désigner une
          //   couleur qui n'est plus celle de ses documents.
          rapides={[
            [ALLURE_PAR_DEFAUT.fond, "Celui d'aujourd'hui"],
            ["#ffffff", "Blanc"],
            ["#ece9e1", "Crème"],
            ["#e8e8e6", "Gris clair"],
          ]}
          onChoisir={(v) => poserAllure({ fond: v })}
        />

        <Couleur
          titre="Couleur d'accent"
          valeur={allure.accent}
          clef="accent"
          aide="Le trait sous le titre, les intitulés, et le total à payer."
          rapides={[
            [ALLURE_PAR_DEFAUT.accent, "Celui d'aujourd'hui"],
            ["#2f3b2f", "Vert pin"],
            ["#6e2433", "Bordeaux"],
            ["#1c1c1a", "Noir"],
          ]}
          onChoisir={(v) => poserAllure({ accent: v })}
        />

        {!estLAllureParDefaut(allure) && (
          <button
            type="button"
            data-atlas="allure-defaut"
            onClick={() => poserAllure({ ...ALLURE_PAR_DEFAUT })}
            className="mt-3 min-h-[44px] w-full rounded-full text-[14px]"
            style={{ color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          >
            Revenir aux réglages d&apos;aujourd&apos;hui
          </button>
        )}

        <p className={`mt-3 ${texteSituation}`} style={{ color: colors.muted }}>
          {allureEnCours ? "Enregistrement…" : "Enregistré au fur et à mesure."}
        </p>
      </Bloc>

      {/* L'aperçu vient APRÈS les réglages : lu avant, il décrirait un état
          qu'on n'a pas encore choisi. */}
      <Bloc titre="Ce que votre devis dira">
        {apercu.length === 0 ? (
          <p className={texteSituation} style={{ color: colors.muted }}>
            Rien ne s&apos;ajoutera : votre devis portera ses lignes, ses totaux et sa
            mention de signature, sans condition supplémentaire.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {apercu.map((l) => (
              <li key={l} className="text-[13px] leading-[1.6]" style={{ color: colors.inkSoft }}>
                {l}
              </li>
            ))}
          </ul>
        )}
        <p className={`mt-3 ${texteSituation}`} style={{ color: colors.muted }}>
          Le montant de l&apos;acompte se calcule sur chaque devis. Il n&apos;est pas
          écrit ici : il dépend du total.
        </p>
      </Bloc>

      <p className={`mx-[26px] mt-[30px] border-t pt-[18px] ${texteSituation}`}
         style={{ borderColor: colors.line, color: colors.muted }}>
        Chaque devis garde <b style={{ color: colors.ink, fontWeight: 400 }}>ce que ces
        réglages disaient le jour où il a été créé</b> : les corriger aujourd&apos;hui
        ne change aucun document déjà fait.
      </p>

      <div
        className="fixed inset-x-0 z-10 mx-auto max-w-md border-t px-[26px] pb-4 pt-3.5"
        style={{ bottom: "var(--atlas-barre)", backgroundColor: colors.cream, borderColor: colors.line }}
      >
        <button
          type="button"
          onClick={() => enregistrer({})}
          disabled={(!aEcrire && !enCours) || refusMessage !== null}
          className="block w-full rounded-full py-[15px] text-center text-[16px]"
          style={{
            backgroundColor: (!aEcrire && !enCours) || refusMessage ? colors.card : colors.rust,
            color: (!aEcrire && !enCours) || refusMessage ? colors.muted : colors.cream,
            boxShadow:
              (!aEcrire && !enCours) || refusMessage ? `inset 0 0 0 1px ${colors.line}` : "none",
          }}
        >
          {enCours
            ? "Enregistrement…"
            : refusMessage
              ? "Message incomplet"
              : !aEcrire
                ? "Enregistré ✓"
                : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section
      className="mx-[26px] mt-[30px] border-t pt-[18px] first-of-type:mt-[26px] first-of-type:border-t-0 first-of-type:pt-0 [&>*:last-child]:border-b-0"
      style={{ borderColor: colors.line }}
    >
      <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
        {titre}
      </p>
      {children}
    </section>
  );
}

/**
 * Un réglage : son interrupteur, et ce qu'il déplie.
 *
 * **Éteint, rien ne se déplie.** Un champ sous un réglage coupé invite à le
 * remplir pour rien — arrêté sur la planche du plan des réglages.
 */
function Reglage({
  nom,
  dit,
  allume,
  onBascule,
  children,
}: {
  nom: string;
  dit: string;
  allume: boolean;
  onBascule: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b" style={{ borderColor: colors.line }}>
      <button
        type="button"
        role="switch"
        aria-checked={allume}
        onClick={() => onBascule(!allume)}
        className="flex w-full items-center gap-[14px] py-[15px] text-left"
        style={{ minHeight: 56 }}
      >
        <span className="min-w-0 flex-1">
          <span className="block" style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.25 }}>
            {nom}
          </span>
          <span className={`mt-1 block ${texteSituation}`} style={{ color: colors.muted }}>
            {dit}
          </span>
        </span>
        {/* 52 × 32 : la piste tient la cible de 44 px avec la hauteur de sa
            ligne, et reste sous le pouce sans écraser le libellé. */}
        <span
          aria-hidden="true"
          className="relative h-8 w-[52px] flex-none rounded-full transition-colors"
          style={{ backgroundColor: allume ? colors.rust : colors.line }}
        >
          <span
            className="absolute top-[3px] h-[26px] w-[26px] rounded-full transition-all"
            style={{
              left: allume ? 23 : 3,
              backgroundColor: colors.card,
              boxShadow: allume ? "none" : `inset 0 0 0 1px ${colors.line}`,
            }}
          />
        </span>
      </button>
      {allume && children && <div className="pb-4">{children}</div>}
    </div>
  );
}

/** Un nombre et son unité, sur une plage crème. */
function Chiffre({
  valeur,
  unite,
  apres,
  bornes,
  onEcrire,
  onFini,
}: {
  valeur: number | null;
  unite: string;
  apres: string;
  bornes: { min: number; max: number };
  onEcrire: (n: number) => void;
  onFini: (n: number) => void;
}) {
  return (
    <span className="flex items-center gap-2.5 rounded-[4px] px-[15px] py-3" style={{ backgroundColor: colors.card }}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`${unite === "%" ? "Pourcentage" : "Nombre de jours"}, entre ${bornes.min} et ${bornes.max}`}
        value={valeur ?? ""}
        onChange={(e) => onEcrire(Number(e.target.value.replace(/\D/g, "")) || 0)}
        onBlur={(e) => onFini(Number(e.target.value.replace(/\D/g, "")) || 0)}
        className="w-[4ch] border-0 bg-transparent p-0 outline-none"
        // 17 px : en dessous de 16, iOS agrandit la page à la mise au point.
        style={{ fontFamily: font.display, fontSize: 17, color: colors.ink, fontVariantNumeric: "tabular-nums" }}
      />
      <span style={{ fontFamily: font.display, fontSize: 17, color: colors.or }}>{unite}</span>
      {/* **Aucun montant ici.** Un « soit 1 044 € » se contredirait au premier
          chiffre changé — vu sur la planche le 13 août, jamais par un test. */}
      <span className={`flex-1 text-right ${texteSituation}`} style={{ color: colors.muted }}>
        {apres}
      </span>
    </span>
  );
}

/** Un texte libre, court ou long. */
function Libre({
  valeur,
  exemple,
  long,
  onEcrire,
  onFini,
}: {
  valeur: string;
  exemple: string;
  long?: boolean;
  onEcrire: (t: string) => void;
  onFini: (t: string) => void;
}) {
  const commun = {
    value: valeur,
    placeholder: exemple,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onEcrire(e.target.value),
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => onFini(e.target.value),
    className: "block w-full rounded-[4px] border-0 px-[15px] py-3 outline-none",
    style: { backgroundColor: colors.card, color: colors.ink, fontSize: 16, lineHeight: 1.5 },
  } as const;
  return long ? (
    <textarea {...commun} rows={2} aria-label="Texte ajouté en bas de chaque document" className={`${commun.className} resize-none`} />
  ) : (
    <input {...commun} type="text" aria-label="Moyens de paiement acceptés" autoComplete="off" />
  );
}

/**
 * Une couleur : le nuancier de l'appareil, et trois ou quatre raccourcis.
 *
 * **Le nuancier libre est le réglage, les pastilles ne sont qu'un raccourci.**
 * Sa règle du 23 août : *« le fond teinté fait-le modifiable »*. Une liste
 * fermée de trois teintes n'est pas modifiable — c'est un choix, pas une
 * couleur.
 */
function Couleur({
  titre,
  valeur,
  clef,
  aide,
  rapides,
  onChoisir,
}: {
  titre: string;
  valeur: string;
  clef: string;
  aide: string;
  rapides: [string, string][];
  onChoisir: (v: string) => void;
}) {
  return (
    <div className="mb-5">
      <p className={`mb-2 ${libelleCaps}`} style={{ color: colors.muted }}>
        {titre}
      </p>
      <div className="flex items-center gap-2.5">
        <input
          type="color"
          value={valeur}
          data-atlas={`couleur-${clef}`}
          aria-label={titre}
          onChange={(e) => onChoisir(e.target.value)}
          // 44 px : la cible du pouce. Un nuancier plus petit se rate.
          className="h-[44px] w-[54px] flex-none cursor-pointer rounded-[8px] border-0 bg-transparent p-0"
        />
        <span
          data-atlas={`couleur-${clef}-valeur`}
          className="text-[13px]"
          style={{ color: colors.muted, fontVariantNumeric: "tabular-nums" }}
        >
          {valeur.toUpperCase()}
        </span>
        <span className="ml-auto flex gap-1.5">
          {rapides.map(([teinte, nom]) => (
            <button
              key={teinte}
              type="button"
              aria-label={nom}
              aria-pressed={valeur === teinte}
              data-atlas={`rapide-${clef}-${teinte.slice(1)}`}
              onClick={() => onChoisir(teinte)}
              className="h-[34px] w-[34px] rounded-full"
              style={{
                backgroundColor: teinte,
                boxShadow:
                  valeur === teinte
                    ? `0 0 0 2px ${colors.cream}, 0 0 0 4px ${colors.or}`
                    : `inset 0 0 0 1px ${colors.line}`,
              }}
            />
          ))}
        </span>
      </div>
      <p className={`mt-1.5 ${texteSituation}`} style={{ color: colors.muted }}>
        {aide}
      </p>
    </div>
  );
}

/**
 * L'allure de la page, en petit — sans un seul chiffre calculé.
 *
 * **L'encre vient de `encreSurFond`, la MÊME fonction que le PDF.** L'écrire
 * une seconde fois ici donnerait, tôt ou tard, un aperçu lisible et un devis
 * qui ne l'est pas — et c'est le devis que le client reçoit (`CLAUDE.md` §3).
 */
function Feuille({ allure, logo, nom }: { allure: Allure; logo: string | null; nom: string }) {
  const { encre, encreDouce } = encreSurFond(allure.fond);
  const typo = typographieDe(allure.typographie);
  return (
    <div
      data-atlas="allure-feuille"
      className="rounded-[6px] px-4 py-4"
      style={{
        backgroundColor: allure.fond,
        color: encre,
        fontFamily: typo.pileCss ?? undefined,
        boxShadow: `inset 0 0 0 1px ${colors.line}`,
      }}
    >
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/fichiers/${logo}`} alt="" className="mb-2 h-[26px] w-auto object-contain" />
      )}
      <p className="text-[17px] leading-tight">{nom || "Votre entreprise"}</p>
      <p className="mt-1 text-[10px]" style={{ color: encreDouce }}>
        Adresse · SIRET · téléphone
      </p>
      <div className="my-2.5 h-px" style={{ backgroundColor: encre }} />
      <p className="text-center text-[13px] tracking-[0.2em]">DEVIS</p>
      <p className="mt-2.5 text-[9px] tracking-[0.14em]" style={{ color: allure.accent }}>
        ÉMETTEUR · CLIENT
      </p>
      <div className="mt-1.5 space-y-1">
        {["Taille de haie", "Évacuation des déchets"].map((l) => (
          <div key={l} className="flex justify-between border-b pb-1 text-[11px]"
               style={{ borderColor: encreDouce, color: encre }}>
            <span>{l}</span>
            <span style={{ color: encreDouce }}>—</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-right text-[13px]" style={{ color: allure.accent }}>
        Total TTC
      </p>
    </div>
  );
}
