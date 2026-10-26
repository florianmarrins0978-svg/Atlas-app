"use client";

import { useState, useTransition } from "react";
import { colors, font, voile } from "@/lib/design-tokens";
import {
  BORNES_RAPPELS,
  RYTHMES_RAPPEL,
  depuisCombien,
  derniersDelais,
  joursEcoules,
  type CleDelaiRappel,
  type GenreRappel,
  type ReglagesRappels,
} from "@/lib/rappels";
import { couleursDuTon, type TonCarte } from "@/lib/ton-des-cartes";
import TitreDeCarte from "@/components/atlas/TitreDeCarte";
import Paquet from "@/components/atlas/reglages/Paquet";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import { caducVersCarte, rappelVersCarte, versCarte } from "@/app/Notifications";
import type { NotificationPatron } from "@/server/repositories/envois-devis";
import Trace from "@/components/atlas/reglages/Trace";
import { ecrireRappelsAction } from "./actions";

/**
 * « Notifications » — `maquettes/atlas-reglages-notifications.html`, puis sa
 * planche soignée du 26 octobre 2026 (`appli/soignee/reglages-notifications.html`,
 * vue Proposé).
 *
 * **L'écran dit d'abord CE QUI EXISTE, et il ne le règle pas.** Deux familles
 * d'alertes vivent déjà sur l'accueil — la réponse d'un client, le lien de
 * devis expiré — et elles n'ont pas d'interrupteur : les couper, ce serait ne
 * plus savoir qu'on a été refusé. Sa règle du 13 août 2026 : *« [des
 * interrupteurs] seulement à celles où la désactivation n'entraîne pas de
 * problème juridique ou moral ou de dysfonctionnement à l'appli »*.
 *
 * **Puis ce qui se règle**, et c'est vraiment réglable : quatre rappels de
 * confort, qui apparaissent sur l'accueil et se coupent sans rien perdre.
 *
 * **Le quatrième est arrivé le 16 août 2026**, avec la donnée qui lui manquait
 * — le paiement d'une facture, noté depuis « Terminés › TVA ». C'est aussi le
 * seul qui porte un rythme : voir `Rappel` plus bas.
 *
 * **Sous chaque rappel allumé, la carte qu'il fait naître sur l'accueil** (sa
 * planche soignée) : ces rappels ne vivent pas ici, ils arrivent là-bas, et
 * l'on reconnaît enfin un réglage à ce qu'il produit. La carte est celle de
 * `rappelVersCarte`, la fonction même de l'accueil : ses mots, sa couleur, et
 * le nombre de jours qu'on vient de régler. Les quatre phrases grises qui
 * décrivaient chaque rappel sont parties, puisque la carte dit la même chose.
 */
export default function NotificationsClient({ initial }: { initial: ReglagesRappels }) {
  const [reglages, setReglages] = useState<ReglagesRappels>(initial);
  /**
   * **Le dernier délai de chaque rappel, que le rallumage reprend** — la règle
   * vit dans `derniersDelais` (`src/lib/rappels.ts`) : l'écran ne fait que
   * garder ce qu'elle lui rend entre deux gestes.
   */
  const [derniers, setDerniers] = useState(() => derniersDelais(initial, null));
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function ecrire(partiel: Partial<ReglagesRappels>) {
    const vise = { ...reglages, ...partiel };
    setReglages(vise);
    setDerniers((d) => derniersDelais(vise, d));
    demarrer(async () => {
      const r = await ecrireRappelsAction(vise);
      if (r.ok) {
        setRefus(null);
        // **On reprend ce que le SERVEUR a retenu**, pas ce qu'on lui a envoyé :
        // une valeur hors bornes est ramenée dans les bornes, et l'écran doit
        // montrer le nombre qui sera vraiment employé.
        setReglages(r.reglages);
        setDerniers((d) => derniersDelais(r.reglages, d));
      } else {
        setRefus(r.raison);
        setReglages(reglages);
      }
    });
  }

  /** Les quatre lignes ne diffèrent que par leur réglage : le reste est commun. */
  const reglable = (cle: CleDelaiRappel) => ({
    valeur: reglages[cle],
    bornes: BORNES_RAPPELS[cle],
    enCours,
    onChange: (v: number | null) => ecrire(seulement(cle, v)),
    onRallumer: () => ecrire(seulement(cle, derniers[cle])),
  });

  return (
    <div className="pb-24">
      {refus && (
        <div role="alert" className="mx-[22px] mt-4">
          <PlageTon ton="rouge">{refus}</PlageTon>
        </div>
      )}

      {/* **UNE LIGNE, ET ELLE NE PARLE QUE DE LUI.**
          Sa question du 9 septembre 2026, devant la version courte : *« ni SMS
          ni e-mail, ça sous-entend quoi ? »*. Trois lectures, dont une FAUSSE —
          qu'Atlas ne saurait pas envoyer un devis par SMS. La phrase mêlait ce
          que LUI reçoit et ce que ses CLIENTS reçoivent ; sur cet écran, ses
          clients n'ont rien à faire. */}
      <p className="mx-[24px] mt-[18px] text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
        Ces rappels s&apos;affichent sur votre écran d&apos;accueil, quand vous ouvrez Atlas.
      </p>

      {/* **CE QU'IL RÈGLE D'ABORD — sa proposition B, retenue le 9 septembre 2026.**
          On ouvre cet écran pour changer quelque chose. Il s'ouvrait sur deux
          lignes sans interrupteur : on croyait qu'il ne se réglait pas, et il
          fallait faire défiler pour trouver ce qu'on venait chercher. Les deux
          alertes qu'on ne peut pas couper sont passées en bas — elles ne
          perdent rien à y être, puisqu'elles sont *toujours* allumées.

          **Et les paragraphes qui expliquaient l'écran sont partis** : celui
          qui répétait le mot « toujours » du titre juste au-dessus, celui qui
          décrivait ce que fait l'interrupteur d'à côté, et le bloc « Où se
          solde une facture » qui ne portait aucun réglage. Sa consigne du
          25 août : « le moins de mots possible ». */}
      <Paquet titre="Ce que vous réglez">
        {/* **PREMIÈRE, et son libellé n'est pas indifférent.** Le patron, le
            16 août 2026, devant « Devis pas encore parti » : *« j'ai peur que la
            façon dont tu l'as écrit ne soit pas compréhensible — qu'on ne
            comprenne pas que cette ligne sert à ça, le devis non envoyé. »*

            Il avait raison, et la cause est la VOISINE : posée sur « Devis sans
            réponse », deux lignes commençaient par le même mot et il fallait
            lire la ligne grise pour les séparer. Quatre mots lui ont été
            montrés, chacun avec sa voisine (`docs/maquettes/56-…`, § 3) ; il a
            retenu **« Chantier sans devis »** — le seul qui se distingue au
            PREMIER mot, et qui fait raconter aux trois lignes le chantier dans
            l'ordre : pas de devis, sans réponse, fini pas facturé.

            Ne pas le renommer sans lui : c'est un mot qu'il a choisi contre un
            autre, en le voyant en place. */}
        <Rappel
          nom="Chantier sans devis"
          genre="chantier-sans-devis"
          icone={TRACE_DOCUMENT}
          {...reglable("chantierSansDevisJours")}
        />
        <Rappel
          nom="Devis sans réponse"
          genre="devis-sans-reponse"
          icone={TRACE_SABLIER}
          {...reglable("devisSansReponseJours")}
        />
        <Rappel
          nom="Chantier fini, pas facturé"
          genre="chantier-non-facture"
          icone={TRACE_FACTURE}
          {...reglable("chantierNonFactureJours")}
        />
        {/* **Le quatrième, et le seul qui porte un RYTHME.** Les trois autres
            s'éteignent d'eux-mêmes dès que le geste attendu est fait ; celui-ci
            peut durer des mois, et sans rythme la carte resterait à l'écran
            chaque jour jusqu'au paiement (`ARCHITECTURE.md`). */}
        <Rappel
          nom="Facture impayée"
          genre="facture-impayee"
          icone={TRACE_EURO}
          {...reglable("factureImpayeeJours")}
          // Le délai se compte depuis l'échéance ÉCRITE SUR LA FACTURE, pas
          // depuis l'envoi ni depuis les Réglages : sa décision du 7 octobre
          // 2026, qui a demandé que l'écran le dise.
          apres="après l'échéance"
          rythme={{
            valeur: reglages.factureImpayeeRythmeJours,
            onChange: (v) => ecrire({ factureImpayeeRythmeJours: v }),
          }}
        />
      </Paquet>

      {/* **LES DEUX QU'ON NE PEUT PAS COUPER, EN BAS — sa proposition B.**
          Le titre dit déjà « toujours », et ces deux lignes-là n'ont pas
          d'interrupteur : l'absence se VOIT, elle n'a pas besoin d'un
          paragraphe pour se dire. Leurs deux phrases grises sont parties avec
          la planche soignée : les cartes elles-mêmes, chacune dans sa couleur,
          disent ce qui arrive. */}
      <Paquet titre="Ce qui vous est toujours signalé">
        <Fixe nom="Réponse à un devis" icone={TRACE_BULLE} cartes={CARTES_REPONSE} />
        <Fixe nom="Lien de devis expiré" icone={TRACE_HORLOGE} cartes={CARTES_CADUC} />
      </Paquet>
    </div>
  );
}

/** Le réglage d'un seul délai, prêt à partir. */
function seulement(cle: CleDelaiRappel, valeur: number | null): Partial<ReglagesRappels> {
  const partiel: Partial<ReglagesRappels> = {};
  partiel[cle] = valeur;
  return partiel;
}

/**
 * Un rappel réglable : un interrupteur, et un délai quand il est allumé.
 *
 * **Le délai disparaît quand le rappel est éteint, et sa carte avec.** Le
 * laisser grisé inviterait à le régler, et le patron croirait avoir allumé
 * quelque chose.
 */
function Rappel({
  nom,
  genre,
  icone,
  valeur,
  bornes,
  enCours,
  onChange,
  onRallumer,
  apres,
  rythme,
}: {
  nom: string;
  genre: GenreRappel;
  icone: React.ReactNode;
  valeur: number | null;
  bornes: { min: number; max: number };
  enCours: boolean;
  onChange: (v: number | null) => void;
  onRallumer: () => void;
  /** Ce que le délai suit — « après l'échéance » plutôt que l'événement par défaut. */
  apres?: string;
  /**
   * Tous les combien il le redit, sur le seul rappel qui peut durer des mois.
   *
   * **Trois choix, jamais une case de saisie.** Une case inviterait à écrire
   * « 3 jours », ce qu'il a précisément exclu le 16 août 2026 : *« je veux un
   * rappel toutes les semaines ou tous les quinze jours, mais pas qu'il y ait
   * la notification tous les jours »*.
   */
  rythme?: { valeur: number; onChange: (v: number) => void };
}) {
  const allume = valeur !== null;
  const unite = "jours";
  // La pastille prend la couleur de la carte qu'il fait naître : le devis
  // jamais parti en ambre, l'impayé en rouge, les deux autres pour mémoire.
  const ton = apercu(genre, valeur ?? bornes.min).ton;
  return (
    <div className="relative pb-4 pt-3">
      <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
      <div className="flex min-h-[48px] items-center gap-3.5">
        {allume ? (
          <PastilleIcone ton={ton === "blanc" ? undefined : ton}>{icone}</PastilleIcone>
        ) : (
          // Éteint, il perd sa couleur : une pastille ambre ou rouge sur un
          // rappel coupé annoncerait une carte qui n'arrivera pas.
          <span
            aria-hidden
            className="grid h-10 w-10 flex-none place-items-center rounded-[12px]"
            style={{ backgroundColor: voile(colors.ink, 0.06), color: colors.inkSoft }}
          >
            {icone}
          </span>
        )}
        {/* Repéré pour `test-devis-qui-tarde-e2e`, qui refuse que deux
            réglages commencent par le même mot — la crainte du patron du
            16 août 2026, et la seule façon de la tenir. */}
        <span
          data-atlas="rappel-nom"
          className="min-w-0 flex-1"
          style={{
            fontFamily: font.display,
            fontSize: 18.5,
            lineHeight: 1.25,
            color: allume ? colors.ink : colors.inkSoft,
          }}
        >
          {nom}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={allume}
          aria-label={nom}
          disabled={enCours}
          onClick={() => (allume ? onChange(null) : onRallumer())}
          // 32 px de haut, 52 de large : sous le pouce, gants compris.
          className="relative h-8 w-[52px] flex-none rounded-full transition-colors"
          // Allumé, le vert des bascules des Réglages soignés (sa planche du
          // 26 octobre 2026), le même que les autres interrupteurs de la série ;
          // sur Nuit et Sylve ce vert est clair, et la pastille `card` s'y lit.
          style={{ backgroundColor: allume ? colors.plein : voile(colors.ink, 0.18) }}
        >
          <span
            aria-hidden="true"
            className="absolute top-[3px] h-[26px] w-[26px] rounded-full transition-all"
            style={{ backgroundColor: colors.card, left: allume ? 23 : 3 }}
          />
        </button>
      </div>

      {allume && (
        <>
          <div
            className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[15px]"
            style={{ color: colors.inkSoft }}
          >
            Au bout de
            {/* **Moins et plus, sans clavier** (sa planche soignée) : le doigt
                règle un délai sans ouvrir de clavier. Le nombre se tape encore
                si on le touche, et les bornes sont celles du serveur. */}
            <span className="inline-flex items-center rounded-full" style={{ boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
              <BoutonPas
                libelle="Un jour de moins"
                trace={TRACE_MOINS}
                eteint={valeur <= bornes.min}
                onPas={() => onChange(valeur - 1)}
              />
              <input
                type="text"
                inputMode="numeric"
                value={valeur}
                aria-label={`Délai du rappel « ${nom} », en ${unite}`}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) onChange(n);
                }}
                className="w-11 border-0 bg-transparent p-0 text-center outline-none"
                // 16 px au moins : en dessous, iOS agrandit la page à la mise au point.
                style={{
                  fontFamily: font.display,
                  fontSize: 22,
                  lineHeight: 1,
                  color: colors.ink,
                  fontVariantNumeric: "tabular-nums lining-nums",
                }}
              />
              <BoutonPas
                libelle="Un jour de plus"
                trace={TRACE_PLUS}
                eteint={valeur >= bornes.max}
                onPas={() => onChange(valeur + 1)}
              />
            </span>
            <span
              // Repéré parce qu'un `<input>` ne figure PAS dans le texte de la
              // page : un contrôle qui lisait « 1 jours » dans `innerText` ne
              // mesurait rien, et passait au vert sur l'écran fautif.
              data-atlas="rappel-unite"
            >
              {/* **« 1 jour », pas « 1 jours ».** Le défaut du rappel d'impayé
                  vaut UN — c'est donc la première chose qu'il lit sur cette ligne,
                  et la faute saute aux yeux. Vue sur la capture du 16 août 2026 ;
                  aucun test ne la voyait, et c'est la cinquième fois dans ce dépôt
                  qu'un défaut sort d'une image (`CLAUDE.md` §5). */}
              {valeur === 1 ? unite.replace(/s$/, "") : unite}
              {apres ? ` ${apres}` : ""}
            </span>
          </div>

          {rythme && (
            <>
              <p className="mb-2 mt-3.5 text-[15px]" style={{ color: colors.inkSoft }}>
                Puis me le redire
              </p>
              {/* Trois grands choix de 52 px au lieu de trois pastilles en
                  12 px (sa planche soignée) : le mot pris se lit sur sa
                  plage, posée dans le creux des deux autres. Aux bouts ronds,
                  comme tout ce qu'on appuie (sa règle du 12 août 2026). */}
              <div className="flex gap-1 rounded-full p-1" style={{ backgroundColor: voile(colors.ink, 0.06) }}>
                {RYTHMES_RAPPEL.map((r) => {
                  const pris = rythme.valeur === r.jours;
                  return (
                    <button
                      key={r.jours}
                      type="button"
                      onClick={() => rythme.onChange(r.jours)}
                      disabled={enCours}
                      aria-pressed={pris}
                      data-rythme={r.jours}
                      className="min-h-[52px] flex-1 rounded-full px-1.5 text-[14.5px] font-semibold leading-[1.15] transition-colors disabled:opacity-60"
                      style={{
                        backgroundColor: pris ? colors.card : "transparent",
                        color: pris ? colors.ink : colors.inkSoft,
                        boxShadow: pris ? `0 1px 2px ${voile(colors.ink, 0.14)}` : "none",
                      }}
                    >
                      {r.libelle}
                    </button>
                  );
                })}
              </div>
              {/* **CE QUI RESTE DU BLOC « OÙ SE SOLDE UNE FACTURE », en une ligne.**
                  Ce bloc portait quatre lignes de prose et AUCUN réglage. Ce qu'il
                  apprenait d'utile — le rappel s'arrête tout seul, et où le noter —
                  ne concerne que ce rappel-ci : il descend donc sous lui, au lieu de
                  faire un chapitre. */}
              <p className="mt-2.5 text-[14px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                S&apos;arrête dès que le règlement est noté dans{" "}
                <b style={{ color: colors.ink, fontWeight: 600 }}>Terminés, TVA</b>.
              </p>
            </>
          )}

          <p
            className="mb-1.5 mt-3 flex items-center gap-1.5 text-[13.5px] font-semibold"
            style={{ color: colors.inkSoft }}
          >
            <span className="flex" style={{ color: colors.or }}>
              <Trace taille={16} epaisseur={2}>
                {TRACE_ACCUEIL}
              </Trace>
            </span>
            Sur l&apos;accueil
          </p>
          <ApercuCarte genre={genre} jours={valeur} />
        </>
      )}
    </div>
  );
}

function BoutonPas({
  libelle,
  trace,
  eteint,
  onPas,
}: {
  libelle: string;
  trace: React.ReactNode;
  eteint: boolean;
  onPas: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={libelle}
      disabled={eteint}
      onClick={onPas}
      className="grid h-11 w-11 place-items-center rounded-full"
      style={{ color: eteint ? colors.chevron : colors.ink }}
    >
      <Trace taille={20} epaisseur={2}>
        {trace}
      </Trace>
    </button>
  );
}

/**
 * Ce que l'accueil fera de ce réglage, mis en carte par la règle de l'accueil.
 *
 * **Le nom est celui d'un client quelconque**, pas un nom inventé : une carte
 * d'exemple qui dirait « Mme Costa » ferait chercher quelle cliente porte ce
 * nom. Le délai, lui, est mis en mots par `depuisCombien`, celle du serveur de
 * l'accueil : la carte dit « depuis hier » au premier jour, comme là-bas.
 */
function apercu(genre: GenreRappel, jours: number) {
  // Deux instants séparés de N jours pleins, et rien de l'horloge du jour : la
  // carte ne dépend que du réglage, au premier rendu comme au serveur.
  const debut = new Date(0);
  const maintenant = new Date(jours * 24 * 60 * 60 * 1000);
  return rappelVersCarte({
    genre,
    chantierId: "apercu",
    chantierNom: "Votre client",
    depuisTexte: depuisCombien(maintenant, debut),
    depuisJours: joursEcoules(maintenant, debut),
    quand: 0,
    // Le montant ne s'invente pas : la carte montre où il se lira.
    facture:
      genre === "facture-impayee"
        ? { id: "apercu", numero: "", resteDu: "Le reste dû", total: "", partielle: false }
        : undefined,
  });
}

function ApercuCarte({ genre, jours }: { genre: GenreRappel; jours: number }) {
  const carte = apercu(genre, jours);
  const couleurs = couleursDuTon(carte.ton);
  return (
    <div
      data-atlas="apercu-rappel"
      data-atlas-ton={carte.ton}
      className="rounded-[14px] px-3.5 pb-3 pt-[11px]"
      // **La carte « pour mémoire » se pose sur la crème, pas sur la plage.**
      // Sur l'accueil elle est blanche sur la crème du fond ; ici elle est dans
      // une plage déjà blanche, où elle disparaîtrait. Le contraste est le même,
      // retourné.
      style={{ backgroundColor: carte.ton === "blanc" ? colors.cream : couleurs.fond }}
    >
      <TitreDeCarte ton={carte.ton}>{carte.titre}</TitreDeCarte>
      <p className="mt-[3px] text-[17px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
        {carte.chantierNom}
      </p>
      {carte.texte && (
        <p className="mt-0.5 text-[14px] leading-[1.4]" style={{ color: couleurs.texte }}>
          {carte.texte}
        </p>
      )}
      {carte.montant && (
        <p className="mt-[5px] text-[17px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
          {carte.montant.du}
        </p>
      )}
    </div>
  );
}

/**
 * Une alerte qui existe et ne se règle pas — elle se LIT, elle ne se touche pas.
 * Les cartes qu'elle fait naître se montrent en pastilles, dans leur couleur.
 */
function Fixe({
  nom,
  icone,
  cartes,
}: {
  nom: string;
  icone: React.ReactNode;
  cartes: { titre: string; ton: TonCarte }[];
}) {
  return (
    <div className="relative flex flex-wrap items-center gap-x-3.5 gap-y-2.5 py-3">
      <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
      <PastilleIcone>{icone}</PastilleIcone>
      <span
        className="min-w-0 flex-1"
        style={{ fontFamily: font.display, fontSize: 18, lineHeight: 1.25, color: colors.ink }}
      >
        {nom}
      </span>
      <span className="flex basis-full flex-wrap gap-1.5">
        {cartes.map((c) => {
          const couleurs = couleursDuTon(c.ton);
          return (
            <span
              key={c.titre}
              className="inline-flex min-h-[28px] items-center gap-[7px] whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold"
              style={{ backgroundColor: couleurs.fond, color: couleurs.titre }}
            >
              <span
                aria-hidden
                className="h-[7px] w-[7px] flex-none rounded-full"
                style={{ backgroundColor: "currentColor" }}
              />
              {c.titre}
            </span>
          );
        })}
      </span>
    </div>
  );
}

/**
 * Les cartes d'une réponse de client, dans l'ordre de sa planche : accepté,
 * correction, autre date, retourné. **Titres et couleurs viennent de
 * `versCarte`, la règle de l'accueil**, appliquée à quatre réponses d'exemple ;
 * rien n'est recopié ici.
 */
const CARTES_REPONSE = (
  [
    { reponse: "acceptee", dateContreProposee: false },
    { reponse: "correction", dateContreProposee: false },
    { reponse: "acceptee", dateContreProposee: true },
    { reponse: "refusee", dateContreProposee: false },
  ] as const
).map(({ reponse, dateContreProposee }) => {
  const exemple: NotificationPatron = {
    envoiId: "apercu",
    chantierId: "apercu",
    chantierNom: "",
    reponse,
    responduAt: null,
    dateRetenue: null,
    dateContreProposee,
    precisionClient: null,
    joursSouhaites: null,
  };
  const { titre, ton } = versCarte(exemple);
  return { titre, ton };
});

/** Le lien expiré, mis en carte par la même règle de l'accueil. */
const CARTES_CADUC = [
  caducVersCarte({ envoiId: "apercu", chantierId: "apercu", chantierNom: "", envoyeAt: new Date(0), expireAt: new Date(0) }),
].map(({ titre, ton }) => ({ titre, ton }));

// Les tracés de la planche soignée (`appli/soignee/kit.js`), recopiés et non
// redessinés : l'écran doit ressembler à ce qu'il a validé.
const TRACE_DOCUMENT = (
  <Trace>
    <path d="M6.5 3.5H14l4 4v13H6.5z" />
    <path d="M14 3.5v4h4M9.5 12.5h5M9.5 16h5" />
  </Trace>
);
const TRACE_SABLIER = (
  <Trace>
    <path d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5-8 8.5" />
  </Trace>
);
const TRACE_FACTURE = (
  <Trace>
    <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
    <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
  </Trace>
);
const TRACE_EURO = (
  <Trace>
    <path d="M16.5 7.2A6 6 0 1 0 16.5 16.8M5.5 10.5h8M5.5 13.5h8" />
  </Trace>
);
const TRACE_BULLE = (
  <Trace>
    <path d="M12 4c4.7 0 8.5 3.4 8.5 7.6S16.7 19.2 12 19.2c-1 0-2-.1-2.9-.4L5 20.5l1.2-3.6C4.5 15.5 3.5 13.6 3.5 11.6 3.5 7.4 7.3 4 12 4z" />
  </Trace>
);
const TRACE_HORLOGE = (
  <Trace>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Trace>
);
const TRACE_ACCUEIL = <path d="M3.5 20.5h17M5.5 20.5V10L12 5l6.5 5v10.5M10 20.5v-5h4v5" />;
const TRACE_MOINS = <path d="M5 12h14" />;
const TRACE_PLUS = <path d="M12 5v14M5 12h14" />;
