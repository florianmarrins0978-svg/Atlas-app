"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { colors, couleursDocument, font, voile } from "@/lib/design-tokens";
import {
  BORNES,
  ceQueLeDevisDira,
  lireConditions,
  type Conditions,
} from "@/lib/conditions-documents";
import { majConditionsAction } from "../actions";
import {
  TEXTE_ORIGINE_CONDITIONS_GENERALES,
  TITRE_CONDITIONS_GENERALES,
  conditionsGeneralesRemplies,
  crochetsRestants,
  paragraphesConditionsGenerales,
} from "@/lib/conditions-generales";
import type { DonneesMentionsObligatoires } from "@/lib/mentions-obligatoires";
import { MOYENS_ACCEPTES, MOYENS_PROPOSES, estUnMoyenAccepte } from "@/lib/modalites-paiement";
import BarreEnregistrer from "@/components/atlas/BarreEnregistrer";
import BottomSheet from "@/components/atlas/BottomSheet";
import Paquet from "@/components/atlas/reglages/Paquet";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import CocheRonde from "@/components/atlas/reglages/CocheRonde";
import { Chiffre, Etat, Libre, Reglage, stylePapier } from "../pieces";
import Picto from "@/components/atlas/reglages/Picto";

/**
 * « Ce qui s'imprime sur le devis » — le premier des quatre écrans du
 * découpage du 7 septembre 2026.
 *
 * **Il portait trois blocs sur six d'un écran de 4 350 px** : les interrupteurs,
 * le récapitulatif qu'ils produisent, et les mentions qui ne se coupent pas.
 * Les trois vont ensemble (le deuxième RÉSUME le premier, le troisième dit ce
 * que le premier ne pourra jamais éteindre), et c'est précisément pourquoi ils
 * n'ouvrent pas trois lignes du sommaire.
 *
 * **Les sept interrupteurs en trois paquets, dans le même ordre** (sa planche
 * des Réglages soignés, 26 octobre 2026) : Sur le devis, Pour être payé, Vos
 * textes. Sept lignes d'affilée se lisaient comme une liste ; trois paquets se
 * lisent d'un coup d'œil, et aucune ne change de place.
 *
 * **L'APERÇU DIT LA VÉRITÉ DEPUIS LE 25 AOÛT 2026.** Il ne l'a pas toujours
 * dite, et c'est le patron qui l'a vu : *« les autres qui sont en ON doivent-ils
 * être visibles sur le devis ? car je ne vois rien »*. Non. Pendant onze jours,
 * `lignesConditionsDevis` n'était appelée QUE par cet aperçu : il réglait,
 * l'aperçu montrait les phrases, et son client ne recevait que la validité.
 * Depuis, les cinq autres se figent sur le devis à sa création (migration 0064)
 * et le PDF les met en phrases avec CETTE fonction-ci.
 *
 * **Ce qui a laissé passer le défaut onze jours, et qu'il faut retenir :** les
 * contrôles éprouvaient la RÈGLE, les bonnes phrases pour les bons réglages,
 * jamais le CHEMIN entre le réglage et le papier.
 */
export default function ConditionsClient({
  initial,
  mentions,
}: {
  initial: Conditions;
  /**
   * Ce que « Mon entreprise » sait déjà (migration 0094). Les articles 9 et 11
   * s'en remplissent à l'impression : un crochet couvert par ces champs n'est
   * plus un crochet à remplir, et l'annoncer serait envoyer le patron chercher
   * un travail qu'il a déjà fait.
   */
  mentions: DonneesMentionsObligatoires;
}) {
  const [c, setC] = useState<Conditions>(initial);
  // **Ce qui RESTE après remplissage**, jamais ce que le texte porte : depuis
  // la migration 0094, l'assureur et le médiateur viennent de Mon entreprise.
  // Compter les crochets bruts annoncerait du travail déjà fait.
  const remplies = conditionsGeneralesRemplies(c.conditionsGenerales, mentions);
  const restants = crochetsRestants(remplies);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [aEcrire, setAEcrire] = useState(false);
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);

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
        conditionsGenerales: prochain.conditionsGenerales,
      });
      setRefus(r.ok ? null : r.raison);
      // **On affiche ce que la base porte, jamais ce qu'on a demandé.** Un refus
      // silencieux laisserait un réglage coché qui n'existe pas.
      if (r.ok) {
        setC(lireConditions(r.conditions));
        setAEcrire(false);
      }
    });
  }

  const dira = ceQueLeDevisDira(c);
  // **Le début se lit, le texte entier s'ouvre au doigt** (sa planche) : les
  // onze articles défilaient dans une case qui défilait dans l'écran. Le
  // début montré est celui qui s'imprime, crochets remplis par Mon entreprise.
  const paragraphes = paragraphesConditionsGenerales(remplies);
  const articles = paragraphes.filter((p) => /^\d+\./.test(p)).length;

  // **La réserve du bas suit la barre**, sans quoi `pb-40` laissait 160 px de
  // vide au bout de l'écran. Elle ne compte PAS les deux secondes et demie où
  // la barre s'attarde pour dire « Enregistré ✓ » : cet instant-là suit un
  // appui, pas une lecture du bas de page.
  const barreVisible = aEcrire || enCours;

  return (
    <div className={barreVisible ? "pb-40" : "pb-10"}>
      {refus && (
        <div role="alert" className="mx-[22px] mt-4">
          <PlageTon ton="rouge">{refus}</PlageTon>
        </div>
      )}

      <Paquet titre="Sur le devis">
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
      </Paquet>

      <Paquet titre="Pour être payé">
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

        {/* **Trois choix, plus de champ libre : sa décision du 18 septembre
            2026**, la même liste qu'à la porte (`MOYENS_ACCEPTES`). Ce qui a été
            écrit AVANT (à la main, par l'assistant, ou lu sur la photo d'un
            devis) n'est pas de la liste : on le montre tel quel, coché, et il
            part dès qu'un autre choix est touché. Rien ne se réécrit à son
            insu, rien ne se cache. */}
        <Reglage
          nom="Moyens de paiement acceptés"
          dit="Listés sous vos coordonnées bancaires"
          allume={c.moyensPaiement !== null}
          onBascule={(v) => enregistrer({ moyensPaiement: v ? MOYENS_PROPOSES : null })}
        >
          <div className="px-0.5" role="group" aria-label="Moyens de paiement acceptés">
            {[
              ...MOYENS_ACCEPTES,
              ...(c.moyensPaiement && !estUnMoyenAccepte(c.moyensPaiement)
                ? [{ valeur: c.moyensPaiement, titre: c.moyensPaiement }]
                : []),
            ].map((m, i) => {
              const choisi = c.moyensPaiement === m.valeur;
              return (
                <button
                  key={m.valeur}
                  type="button"
                  data-atlas={`moyens-${m.valeur}`}
                  aria-pressed={choisi}
                  onClick={() => enregistrer({ moyensPaiement: m.valeur })}
                  className="relative flex min-h-[52px] w-full items-center gap-3 py-3 text-left"
                >
                  {i > 0 && (
                    <span aria-hidden className="absolute left-[34px] right-0 top-0 h-px" style={{ backgroundColor: colors.line }} />
                  )}
                  <CocheRonde pris={choisi} />
                  <span className="text-[17.5px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                    {m.titre}
                  </span>
                </button>
              );
            })}
          </div>
        </Reglage>

        <Reglage
          nom="Rappeler les pénalités sur le devis"
          dit="Elles figurent de toute façon sur la facture"
          allume={c.rappelerPenalites}
          onBascule={(v) => enregistrer({ rappelerPenalites: v })}
        />
      </Paquet>

      <Paquet titre="Vos textes">
        <Reglage
          nom="Texte en bas de vos documents"
          dit="Ajouté tel quel à chaque devis"
          allume={c.textePied !== null}
          onBascule={(v) => enregistrer({ textePied: v ? "" : null })}
        >
          <Libre
            valeur={c.textePied ?? ""}
            exemple="Sous réserve d'accès au chantier."
            lignes={3}
            onEcrire={(t) => poser({ textePied: t })}
            onFini={(t) => enregistrer({ textePied: t })}
          />
        </Reglage>

        {/* **Ses conditions générales, sa demande du 12 septembre 2026** : la
            case arrive REMPLIE du texte d'origine, il l'efface ou la réécrit.
            Éteindre vide ; rallumer remet le texte d'origine. Imprimées après
            le bon pour accord (`devis-pdf.ts`, annexe). Le texte lui-même ne
            change pas d'une lettre : il est publié, et des comptes l'ont
            accepté. */}
        <Reglage
          nom="Conditions générales de vente et de règlement"
          dit="Imprimées après le bon pour accord"
          allume={c.conditionsGenerales !== ""}
          onBascule={(v) => enregistrer({ conditionsGenerales: v ? TEXTE_ORIGINE_CONDITIONS_GENERALES : "" })}
        >
          <div aria-hidden className="relative max-h-[196px] overflow-hidden px-4 pt-4" style={stylePapier}>
            <p className="mb-2 text-[13px] font-bold tracking-[0.06em]">{TITRE_CONDITIONS_GENERALES}</p>
            {paragraphes.slice(0, 2).map((p) => (
              <p key={p} className="mb-2 text-[14px] leading-[1.5]">
                {p}
              </p>
            ))}
            <span
              className="absolute inset-x-0 bottom-0 h-[72px]"
              style={{ background: `linear-gradient(to bottom, ${voile(couleursDocument.papier, 0)}, ${couleursDocument.papier})` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2.5">
            <span className="text-[14px]" style={{ color: colors.inkSoft }}>
              {articles > 0 ? `${articles} article${articles > 1 ? "s" : ""}` : "Votre texte"}
            </span>
            <button
              type="button"
              data-atlas="cgv-lire"
              onClick={() => setFeuilleOuverte(true)}
              className="inline-flex min-h-[48px] items-center gap-1.5 whitespace-nowrap rounded-full px-1 text-[16px] font-semibold"
              style={{ color: colors.or }}
            >
              <Picto nom="crayon" taille={18} />
              Lire et modifier
            </button>
          </div>
          {restants > 0 && (
            <div className="mt-2.5">
              <PlageTon ton="ambre" dataAtlas="crochets-a-remplir">
                <b>
                  {restants} crochet{restants > 1 ? "s" : ""}
                </b>{" "}
                à remplir dans{" "}
                <Link href="/reglages/identite" className="font-semibold underline underline-offset-[3px]">
                  Mon entreprise
                </Link>
                .
              </PlageTon>
            </div>
          )}
        </Reglage>
      </Paquet>

      {/* **CE RÉCAPITULATIF A REMONTÉ SOUS LES INTERRUPTEURS LE 6 SEPTEMBRE
          2026.** Il vivait 3 000 pixels plus bas, après le message au client, le
          numéro et l'allure : on le lisait sans savoir de quoi il parlait, ou
          on ne le lisait jamais. Le découpage du 7 septembre le garde ici,
          collé à ce qu'il résume.

          Il se RECALCULE (`ceQueLeDevisDira`), il ne se recopie pas : deux
          rédactions du même engagement finiraient par diverger, et c'est le
          client qui lirait la mauvaise (`CLAUDE.md` §3).

          **Il nomme la validité et les conditions générales depuis le
          26 octobre 2026** : il annonçait « Rien ne s'ajoutera » alors que les
          deux s'imprimaient. Sur la feuille que le client recevra. */}
      <Paquet titre="Ce que votre devis dira" sansPlage>
        <div className="px-[18px] pb-3.5 pt-4" style={stylePapier} data-atlas="devis-dira">
          {[
            dira.validite && (
              <p key="validite" className="flex items-baseline justify-between gap-2.5 text-[14px]">
                <span className="font-bold">Validité</span>
                <span>{dira.validite}</span>
              </p>
            ),
            dira.lignes.length > 0 && (
              <ul key="lignes">
                {dira.lignes.map((l) => (
                  <li key={l} className="relative py-[3px] pl-3.5 text-[14px] leading-[1.5]">
                    <span
                      aria-hidden
                      className="absolute left-px top-3 h-[5px] w-[5px] rounded-full"
                      style={{ backgroundColor: couleursDocument.accent }}
                    />
                    {l}
                  </li>
                ))}
              </ul>
            ),
            dira.conditionsGenerales && (
              <p key="annexe" className="text-[14px] leading-[1.45]">
                Après le bon pour accord : <b>les conditions générales de vente et de règlement</b>.
              </p>
            ),
            dira.rien && (
              <p key="rien" className="text-[14px] leading-[1.5]" style={{ color: couleursDocument.etiquette }}>
                Rien ne s&apos;ajoutera : votre devis portera ses lignes, ses totaux et sa mention de signature,
                sans condition supplémentaire.
              </p>
            ),
          ]
            .filter(Boolean)
            .map((morceau, i) => (
              // Un filet entre deux morceaux qui s'impriment, jamais deux de suite.
              <div
                key={i}
                className={i > 0 ? "mt-2.5 pt-[9px]" : undefined}
                style={i > 0 ? { boxShadow: `inset 0 1px 0 ${voile(couleursDocument.encre, 0.12)}` } : undefined}
              >
                {morceau}
              </div>
            ))}
        </div>
        {c.acomptePourcent !== null && (
          <p className="mx-0.5 mt-2.5 text-[14px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            Le montant de l&apos;acompte se calcule sur chaque devis. Il n&apos;est pas écrit ici : il dépend du
            total.
          </p>
        )}
      </Paquet>

      {/* **CE QUI N'A PAS D'INTERRUPTEUR, dit à l'endroit exact où on le
          chercherait.** Le patron, le 13 août : des interrupteurs *« seulement
          à celles où la désactivation n'entraîne pas de problème juridique ou
          moral »*. Les retirer d'une facture la rendrait irrégulière ; un
          bouton ici serait « rendre ma facture irrégulière », posé dans un écran
          où l'on vient changer un pourcentage. */}
      <Paquet titre="Ce qui ne se coupe pas">
        <div className="py-[18px]">
          <div className="flex items-start gap-3.5">
            <PastilleIcone>
              <Picto nom="cadenas" taille={22} />
            </PastilleIcone>
            <span className="min-w-0 flex-1">
              <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display }}>
                Mentions légales de la facture
              </span>
              <span className="mt-1.5 block">
                <Etat ton="or">Obligatoire</Etat>
              </span>
            </span>
          </div>
          <p className="mt-3 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            Pénalités de retard, indemnité de 40 € pour une entreprise, et la franchise de l&apos;article 293 B
            quand vous n&apos;êtes pas assujetti.
          </p>
          <p className="mt-3 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            Elles s&apos;écrivent seules et suivent votre régime de TVA. Les retirer rendrait la facture
            irrégulière.
          </p>
        </div>
      </Paquet>

      <BarreEnregistrer
        aEcrire={aEcrire}
        enCours={enCours}
        refus={null}
        onEnregistrer={() => enregistrer({})}
      />

      {/* Le texte entier, sur la feuille que le client recevra. Il s'enregistre
          en quittant la case, comme le texte de pied : refermer la feuille, au
          doigt ou d'un appui à côté, la quitte. */}
      <BottomSheet open={feuilleOuverte} onBackdropClick={() => setFeuilleOuverte(false)}>
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 text-[22px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
            Conditions générales de vente et de règlement
          </h2>
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setFeuilleOuverte(false)}
            className="grid h-12 w-12 flex-none place-items-center rounded-full"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          >
            <Picto nom="croix" taille={22} />
          </button>
        </div>
        <div className="mt-4">
          <Libre
            valeur={c.conditionsGenerales}
            exemple=""
            lignes={16}
            aria="Conditions générales de vente et de règlement"
            papier
            onEcrire={(t) => poser({ conditionsGenerales: t })}
            onFini={(t) => enregistrer({ conditionsGenerales: t })}
          />
        </div>
      </BottomSheet>
    </div>
  );
}
