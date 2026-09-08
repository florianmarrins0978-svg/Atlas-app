"use client";

import { useState, useTransition } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import ChampAdresse from "@/components/atlas/ChampAdresse";
import ChampTelephone from "./ChampTelephone";
import ChampFormeJuridique from "./ChampFormeJuridique";
import { majIdentiteAction } from "./actions";
import BarreEnregistrer from "@/components/atlas/BarreEnregistrer";
import DemanderPreuve from "@/components/atlas/DemanderPreuve";
import { sirenDepuisSiret } from "@/lib/siren";
import { formeADuCapital } from "@/lib/formes-juridiques";
import type { PositionMentionsLegales } from "@/lib/mentions-legales";
import AlerteAncienIban from "@/components/atlas/AlerteAncienIban";
import { listerAPrevenirAction, prevenirAction } from "@/app/prevenir-du-nouvel-iban";
import type { FactureAPrevenir } from "@/server/repositories/factures";

/**
 * L'identité de l'entreprise — d'après `maquettes/atlas-reglages-identite.html`.
 *
 * **Trois règles portées par cet écran, et arrêtées sur planche :**
 *
 *   - **le SIREN ne se saisit pas** : il EST les neuf premiers chiffres du
 *     SIRET, et l'écran le MONTRE sous le champ. Deux saisies seraient deux
 *     façons de se contredire, et c'est celui qui saisit qui paierait l'écart ;
 *   - **le régime de TVA se déclare** et commande ce qui s'imprime. Il était
 *     deviné d'après le taux appliqué jusqu'au 13 août 2026, et se trompait dans
 *     les deux sens (`ARCHITECTURE.md` §87) ;
 *   - **un champ manquant reste vide et se signale sur SA LIGNE**, en disant ce
 *     que l'absence empêche. Un exemple plausible glissé à la place d'une donnée
 *     absente finirait imprimé sur une pièce comptable (`docs/AGENT.md` §3).
 */
type Identite = {
  nom: string;
  formeJuridique: string;
  adresse: string;
  siret: string;
  telephone: string;
  email: string;
  iban: string;
  titulaireCompte: string;
  numeroTva: string;
  regimeTva: "assujettie" | "franchise";
  /** Migration 0071 — n'a de sens que pour une société (`formeADuCapital`). */
  capitalSocial: string;
  villeRcs: string;
  mentionsLegalesPosition: PositionMentionsLegales;
};

export default function IdentiteClient({
  initial,
  aPrevenir,
  periodicite,
}: {
  initial: Identite;
  /**
   * **Les factures parties avec l'ancien IBAN** — sa demande du 8 septembre
   * 2026. C'est ICI que l'alerte vit, tant qu'il n'a pas prévenu : sa question
   * — *« si je les relance plus tard, où je retrouve l'écran ? »* — a montré
   * qu'un écran ouvert une fois ne suffit pas.
   */
  aPrevenir: FactureAPrevenir[];
  /**
   * Le réglage de périodicité de TVA, monté par la page — elle seule lit la
   * base — et posé ICI, sous le régime de TVA, parce que les deux moitiés
   * d'une même question se répondent ensemble ou pas du tout.
   */
  periodicite: React.ReactNode;
}) {
  const [valeurs, setValeurs] = useState<Identite>(initial);
  /**
   * **Une seule liste pour les deux exemplaires de l'alerte.** L'encart sous le
   * champ et l'écran du premier jour montrent la même chose : deux états
   * séparés laisseraient l'un réclamer un client que l'autre vient de prévenir.
   */
  const [aSignaler, setASignaler] = useState(aPrevenir);
  /**
   * L'ÉCRAN DU PREMIER JOUR — le troisième endroit, qu'il a voulu le
   * 8 septembre 2026. Il s'ouvre une fois, juste après l'enregistrement d'un
   * IBAN qui laisse des factures derrière lui.
   *
   * **Il ne remplace rien**, et c'est SA question qui l'a imposé : *« si je les
   * relance plus tard, où je retrouve l'écran ? »* — « Plus tard » referme
   * celui-ci, et l'encart sous le champ, lui, ne s'en va pas.
   */
  const [premierJour, setPremierJour] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  /**
   * Ce qui a changé depuis le dernier enregistrement.
   *
   * **Le bouton du bas DIT cet état, il ne fabrique pas un second mécanisme.**
   * Chaque champ s'écrit déjà seul en quittant la ligne — c'est ainsi depuis le
   * 13 août, et c'est ce qui protège une saisie interrompue. Un bouton qui
   * prétendrait « sauver » par-dessus donnerait deux vérités, et le patron
   * croirait perdre ce qui est déjà écrit (`ARCHITECTURE.md` §99).
   *
   * Il a tranché ce parti le 14 août 2026, planche en main : *« A »*.
   */
  const [aEcrire, setAEcrire] = useState<Partial<Identite>>({});

  function ecrire<C extends keyof Identite>(champ: C, valeur: Identite[C]) {
    setValeurs((v) => ({ ...v, [champ]: valeur }));
    setAEcrire((a) => ({ ...a, [champ]: valeur }));
  }

  /** Le geste qu'on reprendra une fois l'identité prouvée. */
  const [preuveDemandee, setPreuveDemandee] = useState<{ motif: string; reprendre: () => void } | null>(
    null
  );

  function enregistrer(partiel: Partial<Identite>) {
    demarrer(async () => {
      const r = await majIdentiteAction(partiel);
      // Les coordonnées bancaires demandent une identité récente : on l'obtient,
      // puis on réenregistre tout seul. Le refus vient du SERVEUR — cet écran ne
      // décide de rien.
      if (!r.ok && r.preuveExigee) {
        setPreuveDemandee({ motif: r.raison, reprendre: () => enregistrer(partiel) });
        return;
      }
      setRefus(r.ok ? null : r.raison);
      // **On ne déclare écrit que ce que le serveur a accepté.** Vider la liste
      // sur un refus afficherait « Enregistré » sur une valeur perdue.
      if (r.ok && "iban" in partiel) {
        // La liste se relit côté serveur : la calculer ici demanderait de
        // savoir quelles factures portent quel IBAN, c'est-à-dire de refaire la
        // règle qui vit déjà dans le dépôt (`CLAUDE.md` §3).
        const restantes = await listerAPrevenirAction();
        setASignaler(restantes);
        setPremierJour(restantes.length > 0);
      }
      if (r.ok) {
        setAEcrire((a) => {
          const reste = { ...a };
          for (const cle of Object.keys(partiel)) delete reste[cle as keyof Identite];
          return reste;
        });
      }
    });
  }

  const siren = sirenDepuisSiret(valeurs.siret);

  return (
    // `pb-40` et non `pb-24` : la barre d'enregistrement s'ajoute aux onglets,
    // et sans cette réserve le dernier paragraphe passe dessous — c'est le
    // défaut que `.atlas-contenu` corrige ailleurs.
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

      <Bloc>
        <Champ
          etiquette="Nom de l'entreprise"
          valeur={valeurs.nom}
          onChange={(v) => ecrire("nom", v)}
          onFini={() => enregistrer({ nom: valeurs.nom })}
          manquant={valeurs.nom.trim() === ""}
          empeche="Sans nom, vos documents n'ont pas d'émetteur."
        />
        {/* Elle se CHOISIT depuis le 14 août : « Sas » tapé en minuscules
            partait tel quel sur chaque devis. */}
        <ChampFormeJuridique
          valeur={valeurs.formeJuridique}
          onChange={(v) => ecrire("formeJuridique", v)}
          onFini={(v) => enregistrer({ formeJuridique: v })}
        />
        {/* **Silence, pas grisé** (migration 0072) : les deux champs
            disparaissent entièrement pour une entreprise individuelle ou une
            micro-entreprise, qui n'ont ni capital ni RCS — grisés, ils se
            rempliraient quand même « au cas où ». */}
        {formeADuCapital(valeurs.formeJuridique) && (
          <>
            <Champ
              etiquette="Capital social"
              valeur={valeurs.capitalSocial}
              placeholder="1 000"
              onChange={(v) => ecrire("capitalSocial", v)}
              onFini={() => enregistrer({ capitalSocial: valeurs.capitalSocial })}
            />
            <Champ
              etiquette="Ville du RCS"
              valeur={valeurs.villeRcs}
              placeholder="Versailles"
              onChange={(v) => ecrire("villeRcs", v)}
              onFini={() => enregistrer({ villeRcs: valeurs.villeRcs })}
            />
          </>
        )}
      </Bloc>

      <Bloc>
        {/* **Le composant du client, posé ici le 14 août.** Il existait depuis
            le 7 août et n'avait jamais servi sur cet écran : le patron saisissait
            son propre siège à la main pendant que ses clients avaient la liste.
            Base Adresse Nationale, jamais Google, et le champ reste LIBRE — un
            lieu-dit ne figure dans aucune base. */}
        <ChampAdresse
          apparence="ligne"
          label="Adresse du siège"
          placeholder="10 rue…"
          value={valeurs.adresse}
          onChange={(v) => {
            ecrire("adresse", v);
            // Choisir dans la liste ne fait pas quitter le champ : sans cette
            // écriture, l'adresse choisie d'un doigt ne serait jamais rangée.
            enregistrer({ adresse: v });
          }}
        />
        {valeurs.adresse.trim() === "" && (
          <p className={`pb-[13px] ${texteSituation}`} style={{ color: colors.alert }}>
            Elle figure en tête de chaque devis et de chaque facture.
          </p>
        )}
      </Bloc>

      <Bloc>
        <Champ
          etiquette="SIRET"
          valeur={valeurs.siret}
          placeholder="14 chiffres"
          onChange={(v) => ecrire("siret", v)}
          onFini={() => enregistrer({ siret: valeurs.siret })}
          manquant={valeurs.siret.trim() === ""}
          empeche="Vos factures ne sont pas conformes sans lui."
          /* Le SIREN se MONTRE, il ne se demande pas. */
          sous={siren ? `SIREN ${siren} — les neuf premiers chiffres. Il ne se saisit pas séparément.` : null}
        />
      </Bloc>

      <Bloc titre="Mentions légales">
        <Choix
          nom="Sous le nom"
          detail="Forme juridique, capital et RCS s'impriment juste sous votre nom."
          pris={valeurs.mentionsLegalesPosition === "sous_nom"}
          onChoix={() => {
            ecrire("mentionsLegalesPosition", "sous_nom");
            enregistrer({ mentionsLegalesPosition: "sous_nom" });
          }}
        />
        <Choix
          nom="En bas, avec le SIRET"
          detail="Elles s'impriment avec vos autres coordonnées."
          pris={valeurs.mentionsLegalesPosition === "bas"}
          onChoix={() => {
            ecrire("mentionsLegalesPosition", "bas");
            enregistrer({ mentionsLegalesPosition: "bas" });
          }}
        />
        <Choix
          nom="Ne pas les imprimer"
          detail="Rien ne s'imprime. La forme, le capital et le RCS restent enregistrés."
          pris={valeurs.mentionsLegalesPosition === "aucune"}
          onChoix={() => {
            ecrire("mentionsLegalesPosition", "aucune");
            enregistrer({ mentionsLegalesPosition: "aucune" });
          }}
        />
      </Bloc>

      <Bloc titre="Votre régime de TVA">
        <Choix
          nom="Franchise en base"
          detail="Vous ne facturez pas de TVA. La mention de l'article 293 B s'imprime sur chaque facture."
          pris={valeurs.regimeTva === "franchise"}
          onChoix={() => {
            ecrire("regimeTva", "franchise");
            enregistrer({ regimeTva: "franchise" });
          }}
        />
        <Choix
          nom="Assujettie"
          detail="Vous facturez la TVA. Votre numéro intracommunautaire figure alors sur la facture."
          pris={valeurs.regimeTva === "assujettie"}
          onChoix={() => {
            ecrire("regimeTva", "assujettie");
            enregistrer({ regimeTva: "assujettie" });
          }}
        />
        {/* Le numéro n'existe que pour qui doit en avoir un : le montrer grisé
            sous « franchise » inviterait à remplir un champ jamais imprimé. */}
        {valeurs.regimeTva === "assujettie" && (
          <Champ
            etiquette="Numéro de TVA intracommunautaire"
            valeur={valeurs.numeroTva}
            placeholder="FR…"
            onChange={(v) => ecrire("numeroTva", v)}
            onFini={() => enregistrer({ numeroTva: valeurs.numeroTva })}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            **LA PÉRIODICITÉ EST ENFIN À CÔTÉ DU RÉGIME — 6 septembre 2026.**

            Le 14 août, elle a quitté l'écran d'ensemble des réglages pour
            « rejoindre le régime de TVA », et le commentaire de
            `identite/page.tsx` le dit encore mot pour mot. **Elle ne l'a jamais
            rejoint.** Elle était rendue APRÈS tout le composant, donc après le
            téléphone, l'e-mail et le bloc bancaire.

            **Mesuré au navigateur à 390 × 664, avant et après** — le régime est
            à 994 px dans les deux cas : la périodicité était à **1 734 px**,
            elle est à **1 306**. L'écart entre les deux moitiés d'une même
            question passe de **740 px à 312**, soit un écran de défilement en
            moins.

            C'est exactement la faute que le déplacement du 14 août voulait
            réparer — deux réglages fiscaux à deux endroits —, revenue à
            l'intérieur d'un seul écran. Une prose qui décrit un rangement qui
            n'a pas eu lieu est pire qu'une absence de prose : on s'y fie.

            **Elle arrive en ENFANT, pas en copie.** Le réglage est un composant
            client à lui, monté par la page qui lit la base ; le recopier ici en
            aurait fait deux (`CLAUDE.md` §3). La page le passe, cet écran le
            pose au bon endroit.
            ══════════════════════════════════════════════════════════════════ */}
        {periodicite}
      </Bloc>

      <Bloc>
        <ChampTelephone
          valeur={valeurs.telephone}
          onChange={(v) => ecrire("telephone", v)}
          onFini={() => enregistrer({ telephone: valeurs.telephone })}
        />
        <Champ
          etiquette="Adresse e-mail"
          valeur={valeurs.email}
          onChange={(v) => ecrire("email", v)}
          onFini={() => enregistrer({ email: valeurs.email })}
        />
      </Bloc>

      <Bloc titre="Pour être payé">
        <Champ
          etiquette="IBAN"
          valeur={valeurs.iban}
          onChange={(v) => ecrire("iban", v)}
          onFini={() => enregistrer({ iban: valeurs.iban })}
          manquant={valeurs.iban.trim() === ""}
          empeche="Sans lui, votre client reçoit un devis qu'il ne peut pas payer."
        />
        <Champ
          etiquette="Titulaire du compte"
          valeur={valeurs.titulaireCompte}
          placeholder={valeurs.nom || "Le nom qui figure sur le compte"}
          onChange={(v) => ecrire("titulaireCompte", v)}
          onFini={() => enregistrer({ titulaireCompte: valeurs.titulaireCompte })}
        />

        {/* **Sous le champ, et non ailleurs** : il voit la conséquence à
            l'endroit de la cause. L'alerte reste tant qu'il n'a pas prévenu —
            elle ne dépend d'aucun écran ouvert une fois. */}
        <AlerteAncienIban factures={aSignaler} onPrevenir={prevenirAction} onMaj={setASignaler} />
      </Bloc>

      {/* **La pièce partagée attend un OUI ou NON, pas un compte.** Les trois
          écrans qui portaient chacun leur copie de cette barre ne s'accordaient
          même pas là-dessus : celui-ci comptait les champs modifiés, les deux
          autres répondaient vrai ou faux. Ce que la barre en faisait était
          identique — `> 0` — et la seule chose que le compte ajoutait, c'était
          une façon de plus d'écrire la même question. */}
      {/* **L'écran du premier jour.** Il occupe la page pour qu'on ne le
          traverse pas sans le voir — mais il ne barre rien : « Plus tard » le
          referme, et l'alerte reste sous le champ. */}
      {premierJour && aSignaler.length > 0 && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-5"
          style={{ backgroundColor: colors.cream }}
        >
          <div className="mx-auto w-full max-w-md">
            <h1 className="text-[24px]" style={{ fontFamily: font.display, color: colors.ink }}>
              Votre IBAN a changé
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color: colors.inkSoft }}>
              Les factures ci-dessous sont parties avec l&apos;ancien.
            </p>
            <div className="mt-3.5">
              <AlerteAncienIban
                factures={aSignaler}
                onPrevenir={prevenirAction}
                onMaj={setASignaler}
                variante="ecran"
              />
            </div>
            <button
              type="button"
              onClick={() => setPremierJour(false)}
              className="mt-3.5 w-full rounded-full py-3 text-[15px]"
              style={{ color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            >
              Plus tard
            </button>
          </div>
        </div>
      )}

      <BarreEnregistrer
        aEcrire={Object.keys(aEcrire).length > 0}
        enCours={enCours}
        onEnregistrer={() => enregistrer(aEcrire)}
      />

      {/* Ne s'ouvre que si le SERVEUR a réclamé une identité récente — et il ne
          le fait que lorsque les coordonnées bancaires changent vraiment. */}
      <DemanderPreuve
        ouvert={preuveDemandee !== null}
        motif={preuveDemandee?.motif ?? ""}
        onAbandon={() => setPreuveDemandee(null)}
        onProuve={() => {
          const reprendre = preuveDemandee?.reprendre;
          setPreuveDemandee(null);
          reprendre?.();
        }}
      />
    </div>
  );
}

/**
 * Une rubrique de l'écran, avec ou SANS en-tête.
 *
 * **Sa demande du 24 août 2026, capture à l'appui :** *« supprime la phrase en
 * gris : vos identifiants + comment vous vous nommez + où vous êtes établi +
 * pour vous joindre »*. Quatre en-têtes qui ne disaient rien de plus que le
 * champ juste en dessous — « COMMENT VOUS VOUS NOMMEZ » au-dessus de « Nom de
 * l'entreprise ».
 *
 * **Deux restent, et ce n'est pas un oubli** : « Votre régime de TVA » et
 * « Pour être payé » ne figurent pas dans sa liste. Elles coiffent plusieurs
 * champs dont le lien ne se devine pas — un IBAN et un titulaire, un régime et
 * un numéro intracommunautaire.
 */
function Bloc({ titre, children }: { titre?: string; children: React.ReactNode }) {
  return (
    // `[&>*:last-child]:border-b-0` : LA DERNIÈRE LIGNE PERD SON FILET. Sans
    // cela, elle en pose un que le trait du bloc suivant redouble trente pixels
    // plus bas — deux traits, et une bande vide entre les deux. Vu sur la
    // capture de l'écran réel, jamais par un test (`CLAUDE.md` §5) ; c'est le
    // même défaut que `maquettes/charte.mjs` fait rougir sur les planches.
    // ET LE PREMIER BLOC NE PORTE PAS DE TRAIT : le cheveu de l'en-tête ferme
    // déjà au-dessus de lui, et les deux dessinaient deux filets séparés par
    // trente pixels de vide. Vu sur la capture de l'écran réel — c'est le même
    // défaut que sur la première planche (`ARCHITECTURE.md` §86).
    <section
      className="mx-[26px] mt-[30px] border-t pt-[18px] first-of-type:mt-[26px] first-of-type:border-t-0 first-of-type:pt-0 [&>*:last-child]:border-b-0"
      style={{ borderColor: colors.line }}
    >
      {titre && (
        <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
          {titre}
        </p>
      )}
      {children}
    </section>
  );
}

/** Une ligne de saisie : étiquette, valeur en serif, filet dessous. */
function Champ({
  etiquette, valeur, onChange, onFini, placeholder, long, manquant, empeche, sous,
}: {
  etiquette: string;
  valeur: string;
  onChange: (v: string) => void;
  onFini: () => void;
  placeholder?: string;
  long?: boolean;
  manquant?: boolean;
  /** Ce que l'absence EMPÊCHE. « Champ requis » ne fait agir personne. */
  empeche?: string;
  sous?: string | null;
}) {
  const teinte = manquant ? colors.alert : colors.line;
  const commun = {
    value: valeur,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onBlur: onFini,
    "aria-label": etiquette,
    className: "block w-full border-0 bg-transparent p-0 outline-none",
    // 16 px au moins : en dessous, iOS agrandit la page à la mise au point et le
    // patron se retrouve avec un écran zoomé à rétablir à la main.
    style: { fontFamily: font.display, fontSize: 17, lineHeight: 1.35, color: colors.ink },
  } as const;

  return (
    <label className="block border-b py-[13px]" style={{ borderColor: teinte }}>
      <span className={`mb-[5px] block ${libelleCaps}`} style={{ color: manquant ? colors.alert : colors.inkSoft }}>
        {etiquette}
        {manquant ? " — manquant" : ""}
      </span>
      {long ? (
        <textarea {...commun} rows={2} className={`${commun.className} resize-none`} />
      ) : (
        <input {...commun} type="text" autoComplete="off" spellCheck={false} />
      )}
      {sous && (
        <span className={`mt-1.5 block ${texteSituation}`} style={{ color: colors.inkSoft }}>
          {sous}
        </span>
      )}
      {manquant && empeche && (
        <span className={`mt-1.5 block ${texteSituation}`} style={{ color: colors.alert }}>
          {empeche}
        </span>
      )}
    </label>
  );
}

/** Un choix unique — la pastille se remplit d'or, comme sur la planche. */
function Choix({
  nom, detail, pris, onChoix,
}: { nom: string; detail: string; pris: boolean; onChoix: () => void }) {
  return (
    <button
      type="button"
      onClick={onChoix}
      aria-pressed={pris}
      className="flex w-full items-start gap-[13px] border-b py-[14px] text-left"
      style={{ borderColor: colors.line, minHeight: 54 }}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 h-[19px] w-[19px] flex-none rounded-full"
        style={{ boxShadow: pris ? `inset 0 0 0 6px ${colors.or}` : `inset 0 0 0 1px ${colors.line}` }}
      />
      <span className="min-w-0 flex-1">
        <span className="block" style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.25, color: colors.ink }}>
          {nom}
        </span>
        <span className={`mt-1 block ${texteSituation}`} style={{ color: colors.inkSoft }}>
          {detail}
        </span>
      </span>
    </button>
  );
}
