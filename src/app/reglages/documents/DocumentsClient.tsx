"use client";

import { useRef, useState, useTransition } from "react";
import { colors, font, libelleCaps, surPlein, texteSituation } from "@/lib/design-tokens";
import {
  BORNES,
  lireConditions,
  lignesConditionsDevis,
  type Conditions,
} from "@/lib/conditions-documents";
import {
  MESSAGE_PAR_DEFAUT,
  PASTILLES,
  phraseDuDocument,
  refusDuMessage,
  rendreMessage,
} from "@/lib/message-client";
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
  majConditionsAction,
  poserLogoAction,
  reprendreAllurePhotoAction,
  retirerLogoAction,
} from "./actions";

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
 * **L'aperçu du bas lit LA MÊME fonction que le PDF** (`lignesConditionsDevis`).
 * Deux rédactions finiraient par diverger, et c'est le client qui lirait la
 * mauvaise (`CLAUDE.md` §3). Il ne porte aucun montant : le total d'un devis à
 * venir n'existe pas, et un chiffre inventé là finirait imprimé.
 */
/** Ce que chaque pastille dit, dans SES mots — pas « [client] » en clair. */
const MOTS: Record<(typeof PASTILLES)[number], string> = {
  "[client]": "le client",
  "[document]": "le document",
  "[lien]": "le lien",
  "[entreprise]": "mon entreprise",
};

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

/** Les trois documents de l'aperçu, et ce qu'Atlas écrit à la place de `[document]`. */
const APERCUS = [
  { clef: "devis", nom: "Devis", phrase: phraseDuDocument({ genre: "devis" }) },
  {
    clef: "facture",
    nom: "Facture",
    // Un numéro et une échéance d'exemple, reconnaissables comme tels : les
    // siens n'existent pas tant qu'aucune facture n'est émise, et en inventer
    // un vrai lui ferait croire qu'il regarde une facture existante.
    phrase: phraseDuDocument({
      genre: "facture",
      numero: "F2026-0008",
      echeanceLisible: "21 septembre",
    }),
  },
  { clef: "entretien", nom: "Compte rendu", phrase: phraseDuDocument({ genre: "entretien" }) },
] as const;

export default function DocumentsClient({
  initial,
  messageInitial,
  entrepriseNom,
  allureInitiale,
  logoInitial,
}: {
  initial: Conditions;
  /** Son message, ou `null` quand il n'a pas touché à celui d'Atlas. */
  messageInitial: string | null;
  entrepriseNom: string;
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
  const [apercuSur, setApercuSur] = useState<(typeof APERCUS)[number]["clef"]>("devis");
  const zone = useRef<HTMLTextAreaElement | null>(null);

  // ── L'allure : elle s'enregistre SEULE, dès qu'il touche une couleur ──
  // Le bouton du bas engage les conditions, qui lient l'entreprise. Une couleur
  // ne lie personne : la faire attendre le même bouton obligerait à valider des
  // conditions pour changer un fond de page.
  const [allure, setAllure] = useState<Allure>(allureInitiale);
  const [logo, setLogo] = useState<string | null>(logoInitial);
  const [refusAllure, setRefusAllure] = useState<string | null>(null);
  const [allureEnCours, demarrerAllure] = useTransition();
  const choixImage = useRef<HTMLInputElement | null>(null);

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
        <p className={`mb-3 ${texteSituation}`} style={{ color: colors.muted }}>
          Il part avec votre devis, votre facture et votre compte rendu de passage.
          Ce que vous posez entre crochets, Atlas le remplace.
        </p>

        <textarea
          ref={zone}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setAEcrire(true);
          }}
          data-atlas="message-client"
          aria-label="Votre message au client"
          rows={10}
          className="w-full rounded-[6px] px-[13px] py-[11px] leading-[1.5]"
          style={{
            // **16 px, jamais moins.** En dessous, iOS grossit la page à la
            // première frappe et l'écran saute sous son doigt.
            fontSize: 16,
            backgroundColor: colors.card,
            color: colors.ink,
            border: `1px solid ${refusMessage ? colors.alert : colors.line}`,
            resize: "vertical",
          }}
        />

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className={texteSituation} style={{ color: colors.muted }}>
            Poser :
          </span>
          {PASTILLES.map((pastille) => (
            <button
              key={pastille}
              type="button"
              data-atlas={`pastille-${pastille.slice(1, -1)}`}
              onClick={() => {
                // **Posée LÀ OÙ LE CURSEUR EST**, pas à la fin : un mot qui
                // atterrit au bas du message oblige à le déplacer au doigt.
                const z = zone.current;
                const debut = z?.selectionStart ?? message.length;
                const fin = z?.selectionEnd ?? debut;
                const prochain = message.slice(0, debut) + pastille + message.slice(fin);
                setMessage(prochain);
                setAEcrire(true);
                requestAnimationFrame(() => {
                  z?.focus();
                  z?.setSelectionRange(debut + pastille.length, debut + pastille.length);
                });
              }}
              className="rounded-full px-3 py-2 text-[13px]"
              style={{ color: colors.or, boxShadow: `inset 0 0 0 1px ${colors.or}` }}
            >
              {MOTS[pastille]}
            </button>
          ))}
          <button
            type="button"
            data-atlas="message-defaut"
            onClick={() => {
              setMessage(MESSAGE_PAR_DEFAUT);
              setAEcrire(true);
            }}
            className="rounded-full px-3 py-2 text-[13px]"
            style={{ color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          >
            Remettre celui d&apos;Atlas
          </button>
        </div>

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

        {/* **L'aperçu passe par la MÊME fonction que l'envoi** (`rendreMessage`).
            Une seconde rédaction ici finirait par ne plus dire la même chose que
            ce que le client reçoit — et c'est le second qui compte. */}
        <p className={`mb-2 mt-5 ${libelleCaps}`} style={{ color: colors.muted }}>
          Ce que votre client recevra
        </p>
        <div className="mb-2.5 flex gap-2">
          {APERCUS.map((a) => (
            <button
              key={a.clef}
              type="button"
              data-atlas={`apercu-${a.clef}`}
              aria-pressed={apercuSur === a.clef}
              onClick={() => setApercuSur(a.clef)}
              // **`rounded-full`, comme tous ses boutons depuis le 12 août 2026.**
              // `test-boutons-arrondis` l'a attrapé : un rayon de 6 px était resté
              // ici, et un seul bouton carré dans l'application se voit.
              className="min-h-[44px] flex-1 rounded-full text-[13.5px]"
              style={
                apercuSur === a.clef
                  ? { backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.or}` }
                  : { color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }
              }
            >
              {a.nom}
            </button>
          ))}
        </div>
        <p
          data-atlas="message-apercu"
          className="whitespace-pre-wrap rounded-[6px] px-[13px] py-[11px] text-[14px] leading-[1.5]"
          style={{ backgroundColor: colors.card, color: colors.inkSoft }}
        >
          {rendreMessage(message.trim() || MESSAGE_PAR_DEFAUT, {
            client: "Mme Larousse",
            document: APERCUS.find((a) => a.clef === apercuSur)!.phrase,
            // Une adresse d'exemple, reconnaissable comme telle : le vrai lien
            // n'existe qu'au moment de l'envoi, et un lien inventé se toucherait.
            lien: "https://…/devis/…",
            entreprise: entrepriseNom,
          })}
        </p>
        <p className={`mt-2 ${texteSituation}`} style={{ color: colors.muted }}>
          L&apos;objet du courriel n&apos;est pas modifiable : il doit rester
          reconnaissable dans une boîte de réception.
        </p>
      </Bloc>

      {/* ── L'ALLURE DE SES DOCUMENTS — sa demande du 23 août 2026 ─────────
          *« il faudrait que l'utilisateur puisse avoir un endroit dédié à la
          modification de son devis. S'il veut rajouter son logo, changer la
          typographie, changer le fond de page. »*

          **Ici, et pas dans une rubrique à part** : sa réponse B devant la
          planche `appli/allure-de-mes-devis.html`. **Le devis et la facture
          seulement** — la feuille de chantier est interne, et il ne l'a pas
          demandée. */}
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
            className="flex min-h-[52px] w-full items-center justify-center rounded-full px-4 text-[15px]"
            style={{ backgroundColor: colors.rust, color: surPlein, opacity: allureEnCours ? 0.6 : 1 }}
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

        {/* **Un aperçu d'APPARENCE, et rien d'autre.** Il ne porte aucun
            montant calculé, aucune condition : ce serait une seconde écriture du
            devis, qui finirait par ne plus dire ce que le PDF dit (`CLAUDE.md`
            §3). Ce qu'il montre — le fond, l'accent, la typographie, la place du
            logo — est exactement ce que la fabrique de PDF pose, et rien de plus. */}
        <p className={`mb-2 mt-5 ${libelleCaps}`} style={{ color: colors.muted }}>
          L&apos;allure de la page
        </p>
        <Feuille allure={allure} logo={logo} nom={entrepriseNom} />

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
