"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { colors, couleursDocument, font, voile } from "@/lib/design-tokens";
import ChampAdresse from "@/components/atlas/ChampAdresse";
import ChampTelephone from "./ChampTelephone";
import ChampFormeJuridique from "./ChampFormeJuridique";
import { majIdentiteAction } from "./actions";
import { deposerAttestationAction, retirerAttestationAction } from "./attestation-actions";
import { ATTESTATION_FORMATS, refusDeLAttestation } from "@/lib/attestation-decennale";
import BarreEnregistrer from "@/components/atlas/BarreEnregistrer";
import DemanderPreuve from "@/components/atlas/DemanderPreuve";
import { sirenDepuisSiret } from "@/lib/siren";
import { formeADuCapital, formeConnue } from "@/lib/formes-juridiques";
import { capitalEnBase } from "@/lib/mentions-legales";
import { enTeteDuDocument, type EnTeteDocument } from "@/lib/en-tete-document";
import { ibanEnGroupes } from "@/lib/modalites-paiement";
import { MENTION_FRANCHISE } from "@/lib/franchise-tva";
import AlerteAncienIban from "@/components/atlas/AlerteAncienIban";
import { listerAPrevenirAction, prevenirAction } from "@/app/prevenir-du-nouvel-iban";
import type { FactureAPrevenir } from "@/server/repositories/factures";
import Paquet from "@/components/atlas/reglages/Paquet";
import LigneReglage, { styleValeurReglage } from "@/components/atlas/reglages/LigneReglage";
import CarteChoix from "@/components/atlas/reglages/CarteChoix";
import PlageTon, { teintesDuTon } from "@/components/atlas/reglages/PlageTon";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import ActionBas from "@/components/atlas/reglages/ActionBas";
import ChoixEnMots from "@/components/atlas/reglages/ChoixEnMots";
import VoirUnExemple, { ADRESSE_DE_L_EXEMPLE } from "../VoirUnExemple";
import Picto from "@/components/atlas/reglages/Picto";

/**
 * L'identité de l'entreprise — d'après `maquettes/atlas-reglages-identite.html`,
 * puis la planche soignée `appli/soignee/reglages-identite.html`.
 *
 * **Une seule page en sept paquets** — sa réponse du 26 octobre 2026,
 * « Proposé », et non sept écrans courts. Les dix-huit cases d'avant, dans le
 * même ordre, rangées sous un titre doré : qui vous êtes, ce qui s'imprime, la
 * TVA, vous joindre, être payé, la décennale, le médiateur. Le nom de
 * l'entreprise ouvre la page en carte de visite.
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
 *     que l'absence empêche, en ambre depuis le 26 octobre 2026 (la couleur de
 *     ce qui reste à faire ; le rouge est celle d'une perte). Un exemple
 *     plausible glissé à la place d'une donnée absente finirait imprimé sur une
 *     pièce comptable (`docs/AGENT.md` §3).
 */
type Identite = {
  nom: string;
  formeJuridique: string;
  adresse: string;
  siret: string;
  /** Migration 0128 : facultative, imprimée après le SIRET (`appli/numero-rm.html`). */
  numeroRm: string;
  telephone: string;
  email: string;
  iban: string;
  titulaireCompte: string;
  numeroTva: string;
  regimeTva: "assujettie" | "franchise";
  /** Migration 0071 — n'a de sens que pour une société (`formeADuCapital`). */
  capitalSocial: string;
  villeRcs: string;
  /** La décennale et le médiateur (migration 0094) — voir `src/lib/mentions-obligatoires.ts`. */
  assureurDecennale: string;
  /** Migration 0121 : ses coordonnées (loi 96-603, art. 22-2). */
  adresseAssureurDecennale: string;
  contratDecennale: string;
  couvertureDecennale: string;
  mediateurNom: string;
  mediateurCoordonnees: string;
  mentionsLegalesPosition: "sous_nom" | "bas";
};

/** Les cases que l'écran signale en ambre quand elles sont vides. */
type CaseObligatoire = "nom" | "adresse" | "siret" | "iban" | "adresseAssureur" | "attestation" | "mediateur";

/**
 * **CE QUI MANQUE, DIT PAR UNE SEULE RÈGLE** — celle des alertes de l'écran.
 *
 * Chaque ligne passe en ambre d'après cette liste, et la carte de visite du
 * haut en dit le compte (« Il manque 4 cases », planche du 26 octobre 2026).
 * Deux décisions écrites à part finiraient par annoncer trois cases quand
 * quatre sont en ambre.
 *
 * L'adresse de l'assureur et l'attestation ne se réclament qu'une fois
 * l'assureur ENREGISTRÉ, jamais pendant qu'il tape (sa règle du 5 octobre
 * 2026, voir `assureurEnregistre`).
 */
function casesQuiManquent(v: Identite, assureurEnregistre: string, attestationDeposee: boolean): Set<CaseObligatoire> {
  const vide = (texte: string) => texte.trim() === "";
  const manquent = new Set<CaseObligatoire>();
  if (vide(v.nom)) manquent.add("nom");
  if (vide(v.adresse)) manquent.add("adresse");
  if (vide(v.siret)) manquent.add("siret");
  if (vide(v.iban)) manquent.add("iban");
  if (assureurEnregistre !== "" && vide(v.adresseAssureurDecennale)) manquent.add("adresseAssureur");
  if (assureurEnregistre !== "" && !attestationDeposee) manquent.add("attestation");
  if (vide(v.mediateurNom)) manquent.add("mediateur");
  return manquent;
}

export default function IdentiteClient({
  initial,
  aPrevenir,
  declarations,
  attestationDeposee: attestationDeposeeInitiale,
  remarquesAttestation,
}: {
  initial: Identite;
  /** Une attestation décennale est-elle déposée (migration 0121) ? */
  attestationDeposee: boolean;
  /** Ce que l'IA a lu sur le fichier déposé, rappelé sans bloquer (7 octobre 2026). */
  remarquesAttestation: string[];
  /**
   * **Les factures parties avec l'ancien IBAN** — sa demande du 8 septembre
   * 2026. C'est ICI que l'alerte vit, tant qu'il n'a pas prévenu : sa question
   * — *« si je les relance plus tard, où je retrouve l'écran ? »* — a montré
   * qu'un écran ouvert une fois ne suffit pas.
   */
  aPrevenir: FactureAPrevenir[];
  /**
   * Les deux déclarations faites aux impôts : le rythme, puis le moment
   * d'exigibilité. Montées par la page — elle seule lit la base — et posées
   * ICI, sous le régime de TVA, parce que les moitiés d'une même question se
   * répondent ensemble ou pas du tout.
   */
  declarations: React.ReactNode;
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

  /**
   * **L'assureur tel que le SERVEUR l'a enregistré** — sa règle du 5 octobre
   * 2026 : *« la décennale ne doit pas apparaître comme étant incomplète tant
   * qu'elle n'est pas enregistrée dans les réglages »*. Rien ne passe en ambre
   * pendant qu'il tape ; l'adresse et l'attestation ne se réclament qu'une fois
   * l'assureur rangé, comme le refus d'envoi qui en découle.
   */
  const [assureurEnregistre, setAssureurEnregistre] = useState(initial.assureurDecennale.trim());
  /** L'attestation déposée : tenue ici, parce que le compte du haut la lit. */
  const [attestationDeposee, setAttestationDeposee] = useState(attestationDeposeeInitiale);

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
      if (r.ok && partiel.assureurDecennale !== undefined) setAssureurEnregistre(partiel.assureurDecennale.trim());
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
  const manquent = casesQuiManquent(valeurs, assureurEnregistre, attestationDeposee);
  const societe = formeADuCapital(valeurs.formeJuridique);
  /**
   * **L'en-tête tel qu'il s'imprime**, par la fonction que le PDF lit
   * (`enTeteDuDocument`). Chaque valeur y entre comme le serveur la range :
   * sans ses blancs, et le capital en nombre (`capitalEnBase`) — « 5 000 »
   * tapé à la main s'imprime « 5 000,00 € ».
   */
  const enTete = enTeteDuDocument({
    nom: valeurs.nom.trim(),
    formeJuridique: valeurs.formeJuridique.trim(),
    capitalSocial: capitalEnBase(valeurs.capitalSocial) ?? null,
    villeRcs: valeurs.villeRcs.trim(),
    siret: valeurs.siret.trim(),
    numeroRm: valeurs.numeroRm.trim(),
    adresse: valeurs.adresse.trim(),
    telephone: valeurs.telephone.trim(),
    email: valeurs.email.trim(),
    numeroTva: valeurs.numeroTva.trim(),
    position: valeurs.mentionsLegalesPosition,
  });

  return (
    <div>
      {refus && (
        <div role="alert" className="mx-[22px] mt-4">
          <PlageTon ton="rouge">{refus}</PlageTon>
        </div>
      )}

      <CarteDeVisite nom={valeurs.nom} adresse={valeurs.adresse} manquent={manquent.size} />

      <Paquet titre="Qui vous êtes">
        <Champ
          etiquette="Nom de l'entreprise"
          valeur={valeurs.nom}
          placeholder="Le nom de vos devis"
          onChange={(v) => ecrire("nom", v)}
          onFini={(duChamp) => enregistrer({ nom: duChamp })}
          manquant={manquent.has("nom")}
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
            rempliraient quand même « au cas où ». Côte à côte, comme sur la
            planche soignée : ils se lisent ensemble sur le papier. */}
        {societe && (
          <CapitalEtRcs
            capital={valeurs.capitalSocial}
            ville={valeurs.villeRcs}
            onCapital={(v) => ecrire("capitalSocial", v)}
            onFiniCapital={(duChamp) => enregistrer({ capitalSocial: duChamp })}
            onVille={(v) => ecrire("villeRcs", v)}
            onFiniVille={(duChamp) => enregistrer({ villeRcs: duChamp })}
          />
        )}
        {/* **Le composant du client, posé ici le 14 août.** Il existait depuis
            le 7 août et n'avait jamais servi sur cet écran : le patron saisissait
            son propre siège à la main pendant que ses clients avaient la liste.
            Base Adresse Nationale, jamais Google, et le champ reste LIBRE — un
            lieu-dit ne figure dans aucune base. */}
        <LigneReglage
          libelle="Adresse du siège"
          manque={manquent.has("adresse")}
          sous={manquent.has("adresse") ? "Elle figure en tête de chaque devis et de chaque facture." : undefined}
        >
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
        </LigneReglage>
        <Champ
          etiquette="SIRET"
          valeur={valeurs.siret}
          placeholder="14 chiffres"
          chiffres
          onChange={(v) => ecrire("siret", v)}
          onFini={(duChamp) => enregistrer({ siret: duChamp })}
          manquant={manquent.has("siret")}
          empeche="Vos factures ne sont pas conformes sans lui."
          /* Le SIREN se MONTRE, il ne se demande pas. La phrase qui disait
             « Il ne se saisit pas séparément » est partie le 26 octobre 2026 :
             le montrer suffit à le dire. */
          sous={siren ? `SIREN ${siren}, les neuf premiers chiffres.` : null}
        />
        {/* **Facultative, jamais réclamée** (son choix B du 9 octobre 2026) :
            aucun texte trouvé ne dit quelle mention un artisan porte depuis le
            RNE. Vide, rien ne s'imprime ; remplie, elle suit le SIRET. */}
        <Champ
          etiquette="Répertoire des métiers"
          valeur={valeurs.numeroRm}
          placeholder="RM 33"
          onChange={(v) => ecrire("numeroRm", v)}
          onFini={(duChamp) => enregistrer({ numeroRm: duChamp })}
        />
      </Paquet>

      {/* **SUR VOS PAPIERS : l'en-tête tel qu'il part chez le client** (planche
          soignée du 26 octobre 2026). Les mentions se voyaient en deux phrases
          sous deux pastilles ; elles se voient à leur place sur le papier, un
          repère doré dessus.

          **Une entreprise individuelle n'a rien à choisir** : sa seule mention
          est « EI », après le nom. Le choix ne se montre que pour une forme qui
          a des mentions (`formeADuCapital`). « En bas, avec le SIRET » : il le
          garde (sa réponse du 26 octobre 2026), et il y descend vraiment. */}
      <Paquet titre="Sur vos papiers" sansPlage>
        {societe && (
          <div className="mb-2.5" data-atlas="mentions-position">
            <ChoixEnMots
              libelle="Où s'impriment vos mentions légales"
              options={[
                { valeur: "sous_nom", libelle: "Sous le nom" },
                { valeur: "bas", libelle: "En bas, avec le SIRET" },
              ]}
              valeur={valeurs.mentionsLegalesPosition}
              onChoix={(position) => {
                ecrire("mentionsLegalesPosition", position);
                enregistrer({ mentionsLegalesPosition: position });
              }}
            />
          </div>
        )}
        <ApercuDuPapier enTete={enTete} nom={valeurs.nom.trim()} />
        {societe ? (
          <p className="mx-0.5 mt-2.5 text-[13.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            Forme juridique, capital et RCS de votre société.
          </p>
        ) : (
          formeConnue(valeurs.formeJuridique) && (
            <p className="mx-0.5 mt-2.5 text-[13.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
              Une entreprise individuelle signe « EI » après son nom. Rien d&apos;autre à choisir.
            </p>
          )
        )}
      </Paquet>

      <Paquet titre="Votre TVA" sansPlage>
        {/* Deux cartes côte à côte : on voit d'un coup d'œil laquelle est prise. */}
        <div className="grid grid-cols-2 gap-2.5">
          <CarteChoix
            pris={valeurs.regimeTva === "franchise"}
            onChoix={() => {
              ecrire("regimeTva", "franchise");
              enregistrer({ regimeTva: "franchise" });
            }}
            titre="Franchise en base"
            detail="Pas de TVA. La mention 293 B s'imprime."
          />
          <CarteChoix
            pris={valeurs.regimeTva === "assujettie"}
            onChoix={() => {
              ecrire("regimeTva", "assujettie");
              enregistrer({ regimeTva: "assujettie" });
            }}
            titre="Assujettie"
            detail="Vous facturez la TVA."
          />
        </div>
        {/* **Le numéro, le rythme et le reversement n'existent que pour qui
            facture la TVA** (planche soignée du 26 octobre 2026). Les montrer
            sous « franchise » inviterait à remplir ce qui ne s'imprime jamais,
            et à déclarer une TVA qu'il ne collecte pas. */}
        {valeurs.regimeTva === "assujettie" ? (
          <>
            <div className="mt-2.5 overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
              <Champ
                etiquette="Numéro de TVA intracommunautaire"
                valeur={valeurs.numeroTva}
                placeholder="FR…"
                chiffres
                onChange={(v) => ecrire("numeroTva", v)}
                onFini={(duChamp) => enregistrer({ numeroTva: duChamp })}
              />
            </div>
            {/* ══════════════════════════════════════════════════════════════
                **LA PÉRIODICITÉ EST À CÔTÉ DU RÉGIME — 6 septembre 2026.**

                Le 14 août, elle a quitté l'écran d'ensemble des réglages pour
                « rejoindre le régime de TVA », et elle ne l'avait jamais
                rejoint : rendue APRÈS tout ce composant, elle était à 740 px du
                régime, mesurés au navigateur. Une prose qui décrit un
                rangement qui n'a pas eu lieu est pire qu'une absence de prose.

                **Elle arrive en ENFANT, pas en copie.** Le réglage est un
                composant client à lui, monté par la page qui lit la base ; le
                recopier ici en aurait fait deux (`CLAUDE.md` §3).
                ══════════════════════════════════════════════════════════════ */}
            {declarations}
          </>
        ) : (
          <div className="mt-2.5">
            <PlageTon ton="vert">Vos factures portent : {MENTION_FRANCHISE}</PlageTon>
          </div>
        )}
      </Paquet>

      <Paquet titre="Vous joindre">
        <ChampTelephone
          valeur={valeurs.telephone}
          onChange={(v) => ecrire("telephone", v)}
          onFini={(duChamp) => enregistrer({ telephone: duChamp })}
        />
        <Champ
          etiquette="Adresse e-mail"
          valeur={valeurs.email}
          placeholder="contact@…"
          onChange={(v) => ecrire("email", v)}
          onFini={(duChamp) => enregistrer({ email: duChamp })}
        />
      </Paquet>

      <Paquet titre="Pour être payé" sansPlage>
        <PlageIban
          iban={valeurs.iban}
          titulaire={valeurs.titulaireCompte}
          nom={valeurs.nom}
          manque={manquent.has("iban")}
          onIban={(v) => ecrire("iban", v)}
          onFiniIban={(duChamp) => enregistrer({ iban: duChamp })}
          onTitulaire={(v) => ecrire("titulaireCompte", v)}
          onFiniTitulaire={(duChamp) => enregistrer({ titulaireCompte: duChamp })}
        />

        {/* **Sous l'IBAN, et non ailleurs** : il voit la conséquence à
            l'endroit de la cause. L'alerte reste tant qu'il n'a pas prévenu —
            elle ne dépend d'aucun écran ouvert une fois. */}
        <AlerteAncienIban factures={aSignaler} onPrevenir={prevenirAction} onMaj={setASignaler} />
      </Paquet>

      {/* **LA DÉCENNALE ET LE MÉDIATEUR — son accord du 14 septembre 2026**
          (`appli/decennale-et-mediateur.html`), après « Pour être payé » comme
          la planche le montre.

          **Ce que ces deux paquets remplacent :** deux crochets à retaper à la
          main dans le texte des conditions générales. Une information
          d'entreprise se saisit une fois, comme le SIRET — la retaper dans un
          texte, c'est la voir diverger au premier changement d'assureur.

          **Le nom de l'assureur ne se réclame pas** : sans lui rien ne
          s'imprime, avec lui la mention tient déjà debout. */}
      <Paquet titre="Assurance décennale">
        <Champ
          etiquette="Assureur"
          valeur={valeurs.assureurDecennale}
          placeholder="AXA, Groupama, MMA…"
          onChange={(v) => ecrire("assureurDecennale", v)}
          onFini={(duChamp) => enregistrer({ assureurDecennale: duChamp })}
        />
        {/* **Son choix A du 5 octobre 2026** (`appli/assurance-et-sous-traitance.html`) :
            la loi veut les coordonnées de l'assureur sur chaque devis et chaque
            facture (loi 96-603, art. 22-2), et l'attestation jointe (L243-2).
            Un assureur nommé les rappelle ; sans lui, rien n'est réclamé. Elles
            ne bloquent plus l'envoi (sa règle du 7 octobre 2026). */}
        <Champ
          etiquette="Adresse de l’assureur"
          valeur={valeurs.adresseAssureurDecennale}
          placeholder="Sur votre attestation"
          onChange={(v) => ecrire("adresseAssureurDecennale", v)}
          onFini={(duChamp) => enregistrer({ adresseAssureurDecennale: duChamp })}
          manquant={manquent.has("adresseAssureur")}
          empeche="Obligatoire sur vos devis et vos factures."
        />
        <Champ
          etiquette="N° de contrat"
          valeur={valeurs.contratDecennale}
          placeholder="Sur votre attestation"
          chiffres
          onChange={(v) => ecrire("contratDecennale", v)}
          onFini={(duChamp) => enregistrer({ contratDecennale: duChamp })}
        />
        <Champ
          etiquette="Couverture géographique"
          valeur={valeurs.couvertureDecennale}
          placeholder="France métropolitaine"
          onChange={(v) => ecrire("couvertureDecennale", v)}
          onFini={(duChamp) => enregistrer({ couvertureDecennale: duChamp })}
        />
        <Attestation
          deposee={attestationDeposee}
          onDeposee={setAttestationDeposee}
          remarquesInitiales={remarquesAttestation}
          manquante={manquent.has("attestation")}
        />
      </Paquet>

      <Paquet titre="Médiateur de la consommation">
        <Champ
          etiquette="Nom"
          valeur={valeurs.mediateurNom}
          placeholder="Celui auquel vous adhérez"
          onChange={(v) => ecrire("mediateurNom", v)}
          onFini={(duChamp) => enregistrer({ mediateurNom: duChamp })}
          manquant={manquent.has("mediateur")}
          empeche="Un client particulier doit pouvoir le saisir. Si vous n'adhérez à aucun médiateur, il faut le faire : c'est obligatoire."
        />
        <Champ
          etiquette="Adresse ou site"
          valeur={valeurs.mediateurCoordonnees}
          placeholder="Son adresse ou son site"
          onChange={(v) => ecrire("mediateurCoordonnees", v)}
          onFini={(duChamp) => enregistrer({ mediateurCoordonnees: duChamp })}
        />
      </Paquet>

      {/* **Voir un exemple, sous le pouce** (planche soignée du 26 octobre
          2026) : il attendait au bout de cinq écrans de défilement. Posé AVANT
          la barre d'enregistrement, qui prend sa place, par-dessus, tant qu'il
          reste quelque chose à enregistrer : un seul bouton plein à la fois. */}
      <ActionBas>
        <VoirUnExemple />
      </ActionBas>

      {/* **L'écran du premier jour.** Il occupe la page pour qu'on ne le
          traverse pas sans le voir — mais il ne barre rien : « Plus tard » le
          referme, et l'alerte reste sous l'IBAN. */}
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

      {/* **La pièce partagée attend un OUI ou NON, pas un compte.** Les trois
          écrans qui portaient chacun leur copie de cette barre ne s'accordaient
          même pas là-dessus : celui-ci comptait les champs modifiés, les deux
          autres répondaient vrai ou faux. */}
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
 * Le capital et la ville du RCS côte à côte, comme sur la planche soignée :
 * ils se lisent ensemble sur le papier (« SARL au capital de … », « RCS … »).
 *
 * **Une seule ligne de réglage pour les deux**, ses deux libellés en tête : deux
 * lignes posées côte à côte dessinaient chacune leur filet, et le trait du
 * dessus se coupait en deux au milieu de la plage.
 */
function CapitalEtRcs({
  capital,
  ville,
  onCapital,
  onFiniCapital,
  onVille,
  onFiniVille,
}: {
  capital: string;
  ville: string;
  onCapital: (v: string) => void;
  onFiniCapital: (valeurDuChamp: string) => void;
  onVille: (v: string) => void;
  onFiniVille: (valeurDuChamp: string) => void;
}) {
  const idCapital = useId();
  const idVille = useId();
  return (
    <LigneReglage
      libelle={
        <span className="grid grid-cols-2 gap-x-[18px]">
          <label htmlFor={idCapital}>Capital social</label>
          <label htmlFor={idVille}>Ville du RCS</label>
        </span>
      }
    >
      <span className="grid grid-cols-2 gap-x-[18px]">
        <input
          id={idCapital}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="1 000"
          value={capital}
          onChange={(e) => onCapital(e.target.value)}
          onBlur={(e) => onFiniCapital(e.currentTarget.value)}
          style={{ ...styleValeurReglage, fontVariantNumeric: "tabular-nums lining-nums" }}
        />
        <input
          id={idVille}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Versailles"
          value={ville}
          onChange={(e) => onVille(e.target.value)}
          onBlur={(e) => onFiniVille(e.currentTarget.value)}
          style={styleValeurReglage}
        />
      </span>
    </LigneReglage>
  );
}

/**
 * La carte de visite qui ouvre la page (planche soignée du 26 octobre 2026) :
 * on sait de qui on parle avant de lire une case.
 *
 * **Ce qui manque y prend la place de l'adresse**, en ambre, compté par la
 * règle des alertes de l'écran (`casesQuiManquent`) : un compte neuf voit d'un
 * coup qu'il lui reste quatre cases, sans faire défiler cinq écrans.
 */
function CarteDeVisite({ nom, adresse, manquent }: { nom: string; adresse: string; manquent: number }) {
  const initiale = nom.trim().charAt(0).toLocaleUpperCase("fr-FR");
  return (
    <section
      data-atlas="carte-entreprise"
      className="mx-[22px] mt-5 flex items-center gap-3.5 rounded-[6px] px-[18px] py-4"
      style={{ backgroundColor: colors.card }}
    >
      <span
        aria-hidden
        className="grid h-14 w-14 flex-none place-items-center rounded-full text-[25px] leading-none"
        style={{ boxShadow: `inset 0 0 0 1.5px ${colors.or}`, color: colors.or, fontFamily: font.display }}
      >
        {initiale || <Picto nom="entreprise" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[23px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
          {nom.trim() || "Votre entreprise"}
        </span>
        {manquent > 0 ? (
          <span className="mt-1 block text-[14px] font-semibold" style={{ color: colors.carteAmbreTexte }}>
            {manquent === 1 ? "Il manque 1 case" : `Il manque ${manquent} cases`}
          </span>
        ) : (
          adresse.trim() !== "" && (
            <span className="mt-1 flex items-center gap-1.5 text-[14.5px] leading-[1.35]" style={{ color: colors.inkSoft }}>
              <span style={{ color: colors.or }}>
                <Picto nom="lieu" taille={17} />
              </span>
              <span className="min-w-0">{adresse.trim()}</span>
            </span>
          )
        )}
      </span>
    </section>
  );
}

/**
 * L'en-tête du devis en miniature, sur son papier.
 *
 * **Le papier est le sien, pas celui de l'écran** : il reste clair sur Nuit
 * comme sur Sylve, parce que c'est ce qui part chez le client
 * (`couleursDocument`). Les lignes viennent de `enTeteDuDocument`, la fonction
 * que le PDF imprime : ce que l'écran montre est ce que le client lit.
 *
 * **Un appui ouvre l'exemple entier**, comme Voir un exemple : la miniature
 * montre la place, la page montre le reste.
 */
function ApercuDuPapier({ enTete, nom }: { enTete: EnTeteDocument; nom: string }) {
  // Les mentions qui se suivent partagent un seul repère, comme sur la planche.
  const blocs: { mention: boolean; textes: string[] }[] = [];
  for (const ligne of enTete.lignes) {
    const dernier = blocs[blocs.length - 1];
    if (dernier && dernier.mention === ligne.mention) dernier.textes.push(ligne.texte);
    else blocs.push({ mention: ligne.mention, textes: [ligne.texte] });
  }
  const repere: React.CSSProperties = {
    backgroundColor: voile(colors.or, 0.2),
    boxShadow: `inset 0 0 0 2px ${colors.or}`,
    borderRadius: 4,
  };
  return (
    <Link
      href={ADRESSE_DE_L_EXEMPLE}
      data-atlas="apercu-du-papier"
      aria-label="Voir l'exemple en entier"
      className="relative block min-h-[120px] overflow-hidden rounded-[10px] no-underline"
      style={{
        backgroundColor: couleursDocument.papier,
        color: couleursDocument.encre,
        boxShadow: `0 1px 3px ${voile(couleursDocument.encre, 0.14)}, inset 0 0 0 1px ${voile(couleursDocument.encre, 0.06)}`,
      }}
    >
      {/* À l'échelle du papier : un point du PDF pour un pixel, d'où des
          lignes fines. C'est une image du devis, pas un texte à lire ; la page
          entière s'ouvre d'un appui. */}
      <span className="block whitespace-nowrap px-5 pb-6 pr-16 pt-6" style={{ fontFamily: font.body }}>
        <span className="block text-[21px] leading-[1.1]">
          {enTete.formeApresLeNom ? (
            <>
              {nom}{" "}
              <span className="inline-block px-1" style={repere}>
                {enTete.formeApresLeNom}
              </span>
            </>
          ) : (
            enTete.nom
          )}
        </span>
        <span className="mt-2 block text-[10px] leading-[13px]">
          {blocs.map((b, rang) =>
            b.mention ? (
              <span key={rang} className="-mx-1 my-0.5 block w-fit px-1 py-px" style={repere}>
                {b.textes.map((t) => (
                  <span key={t} className="block">
                    {t}
                  </span>
                ))}
              </span>
            ) : (
              b.textes.map((t) => (
                <span key={t} className="block">
                  {t}
                </span>
              ))
            )
          )}
        </span>
        {/* Le trait épais qui ferme l'en-tête sur le papier, comme dans le PDF. */}
        <span aria-hidden className="-mr-11 mt-4 block h-[1.5px]" style={{ backgroundColor: couleursDocument.encre }} />
      </span>
      <span
        aria-hidden
        className="absolute bottom-2.5 right-2.5 grid h-10 w-10 place-items-center rounded-full"
        style={{ backgroundColor: colors.or, color: colors.card }}
      >
        <Picto nom="oeil" taille={20} />
      </span>
    </Link>
  );
}

/**
 * L'IBAN et son titulaire, sur la plage verte de l'argent qui rentre (planche
 * soignée du 26 octobre 2026) ; ambre tant que l'IBAN manque.
 *
 * **L'IBAN se lit par groupes de quatre, il ne s'écrit pas ainsi en base.** Le
 * champ montre `ibanEnGroupes` tant qu'on n'y touche pas, et la saisie brute
 * dès qu'on y pose le doigt : ce qui repart au serveur en le quittant est donc
 * ce qui était rangé, au caractère près. Renvoyer la forme groupée ferait
 * croire au serveur que l'IBAN a changé, et lui ferait redemander le mot de
 * passe pour un champ qu'on n'a fait que traverser (`mettreAJourEntreprise`).
 */
function PlageIban({
  iban,
  titulaire,
  nom,
  manque,
  onIban,
  onFiniIban,
  onTitulaire,
  onFiniTitulaire,
}: {
  iban: string;
  titulaire: string;
  nom: string;
  manque: boolean;
  onIban: (v: string) => void;
  onFiniIban: (valeurDuChamp: string) => void;
  onTitulaire: (v: string) => void;
  onFiniTitulaire: (valeurDuChamp: string) => void;
}) {
  const [enSaisie, setEnSaisie] = useState(false);
  const idIban = useId();
  const idTitulaire = useId();
  const { fond, texte } = teintesDuTon(manque ? "ambre" : "vert");
  return (
    <div data-atlas="plage-iban" className="rounded-[6px] px-[18px] py-4" style={{ backgroundColor: fond }}>
      <label htmlFor={idIban} className="flex items-center gap-[7px] text-[14px] font-semibold" style={{ color: texte }}>
        <Picto nom="banque" taille={19} />
        IBAN
      </label>
      <input
        id={idIban}
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="FR76 …"
        value={enSaisie ? iban : ibanEnGroupes(iban)}
        onFocus={() => setEnSaisie(true)}
        onChange={(e) => onIban(e.target.value)}
        onBlur={(e) => {
          onFiniIban(e.currentTarget.value);
          setEnSaisie(false);
        }}
        className="mt-1.5"
        style={{ ...styleValeurReglage, fontVariantNumeric: "tabular-nums lining-nums", letterSpacing: "0.02em", wordSpacing: "0.12em" }}
      />
      {manque && (
        <p className="mt-1 text-[13.5px] font-semibold leading-[1.4]" style={{ color: texte }}>
          Sans lui, votre client reçoit un devis qu&apos;il ne peut pas payer.
        </p>
      )}
      <div className="mt-3 pt-[11px]" style={{ boxShadow: `inset 0 1px 0 ${voile(texte, 0.25)}` }}>
        {/* Le titulaire ne manque jamais : en ambre, son libellé se lirait
            comme une case de plus à remplir. */}
        <label
          htmlFor={idTitulaire}
          className="block text-[14px] font-semibold"
          style={{ color: manque ? colors.inkSoft : texte }}
        >
          Titulaire du compte
        </label>
        <input
          id={idTitulaire}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={nom || "Le nom qui figure sur le compte"}
          value={titulaire}
          onChange={(e) => onTitulaire(e.target.value)}
          onBlur={(e) => onFiniTitulaire(e.currentTarget.value)}
          className="mt-[3px]"
          style={styleValeurReglage}
        />
      </div>
    </div>
  );
}

/**
 * L'attestation décennale : un PDF, ou une photo, jointe à chaque devis et
 * facture dès qu'elle est déposée. Refusée ICI avec la même fonction que le
 * serveur : la laisser partir pour se la voir refuser après le téléversement
 * le ferait attendre pour rien, sur un forfait de chantier.
 *
 * **Elle dit son état** (planche soignée du 26 octobre 2026) : déposée, une
 * pastille verte ; sinon, « Ajouter le PDF ».
 */
function Attestation({
  deposee,
  onDeposee,
  remarquesInitiales,
  manquante,
}: {
  deposee: boolean;
  onDeposee: (deposee: boolean) => void;
  remarquesInitiales: string[];
  manquante: boolean;
}) {
  const [remarques, setRemarques] = useState(remarquesInitiales);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <LigneReglage
      libelle="Attestation"
      dataAtlas="attestation-decennale"
      manque={manquante && !refus}
      sous={manquante && !refus ? "Obligatoire sur vos devis et vos factures." : undefined}
    >
      <input
        id="attestation-fichier"
        type="file"
        accept={ATTESTATION_FORMATS.join(",")}
        className="hidden"
        data-atlas="attestation-fichier"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const r = refusDeLAttestation(f.type, f.size);
          if (r) {
            setRefus(r);
            return;
          }
          setRefus(null);
          const formulaire = new FormData();
          formulaire.append("fichier", f);
          demarrer(async () => {
            const resultat = await deposerAttestationAction(formulaire);
            if (resultat.ok) {
              onDeposee(true);
              setRemarques(resultat.remarques);
            } else setRefus(resultat.raison);
          });
        }}
      />
      {deposee ? (
        <span className="mt-1.5 flex items-center gap-3">
          <PastilleIcone ton="vert">
            <Picto nom="coche" taille={22} />
          </PastilleIcone>
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
              Déposée
            </span>
            <span className="block text-[13.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
              Jointe à vos devis et factures
            </span>
          </span>
          <button
            type="button"
            data-atlas="attestation-retirer"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const resultat = await retirerAttestationAction();
                if (resultat.ok) {
                  onDeposee(false);
                  setRemarques([]);
                } else setRefus(resultat.raison);
              })
            }
            className="min-h-[44px] flex-none px-0.5 text-[15px] font-semibold"
            style={{ color: colors.or }}
          >
            Retirer
          </button>
        </span>
      ) : (
        <label
          htmlFor="attestation-fichier"
          data-atlas="attestation-ajouter"
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-[16px] font-semibold"
          style={{ color: colors.or }}
        >
          <Picto nom="plus" taille={20} />
          {enCours ? "Envoi…" : "Ajouter le PDF"}
        </label>
      )}
      {/* **Un rappel, jamais un refus** (sa règle du 7 octobre 2026) : ce que
          la lecture a trouvé sur le fichier, sous « Déposée », en ambre, la
          couleur de ce qui reste à faire. */}
      {deposee && !refus && remarques.length > 0 && (
        <span
          data-atlas="attestation-remarques"
          className="mt-1 block text-[13.5px] font-semibold leading-[1.4]"
          style={{ color: colors.carteAmbreTexte }}
        >
          {remarques.map((r) => `${r}.`).join(" ")}
        </span>
      )}
      {refus && (
        <span className="mt-1 block text-[13.5px] font-semibold leading-[1.4]" style={{ color: colors.carteRougeTexte }}>
          {refus}
        </span>
      )}
    </LigneReglage>
  );
}

/**
 * Une ligne de saisie : le libellé en toutes lettres, la valeur en serif.
 *
 * **`onFini` reçoit ce que le champ porte** — jamais l'état React, qui est
 * celui du dernier rendu (leçon du 30 août 2026, `ChampsDuDevis`). Ce sont le
 * SIRET, le numéro de TVA et l'IBAN qui passent ici : une valeur en retard
 * d'une frappe part sur toutes ses factures.
 */
function Champ({
  etiquette, valeur, onChange, onFini, placeholder, manquant, empeche, sous, chiffres,
}: {
  etiquette: string;
  valeur: string;
  onChange: (v: string) => void;
  onFini: (valeurDuChamp: string) => void;
  placeholder?: string;
  manquant?: boolean;
  /** Ce que l'absence EMPÊCHE. « Champ requis » ne fait agir personne. */
  empeche?: string;
  sous?: string | null;
  /** Des chiffres qui se comparent ligne à ligne : SIRET, capital, numéros. */
  chiffres?: boolean;
}) {
  const id = useId();
  return (
    <LigneReglage
      libelle={etiquette}
      htmlFor={id}
      manque={manquant}
      sous={manquant && empeche ? empeche : (sous ?? undefined)}
    >
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={valeur}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onFini(e.currentTarget.value)}
        // 18 px : en dessous de 16, iOS agrandit la page à la mise au point et
        // le patron se retrouve avec un écran zoomé à rétablir à la main.
        style={chiffres ? { ...styleValeurReglage, fontVariantNumeric: "tabular-nums lining-nums" } : styleValeurReglage}
      />
    </LigneReglage>
  );
}
