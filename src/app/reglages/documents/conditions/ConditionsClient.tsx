"use client";

import { useState, useTransition } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import {
  BORNES,
  lireConditions,
  lignesConditionsDevis,
  type Conditions,
} from "@/lib/conditions-documents";
import { majConditionsAction } from "../actions";
import BarreEnregistrer from "@/components/atlas/BarreEnregistrer";
import { Bloc, Chiffre, Libre, Reglage } from "../pieces";

/**
 * « Ce qui s'imprime sur le devis » — le premier des quatre écrans du
 * découpage du 7 septembre 2026.
 *
 * **Il portait trois blocs sur six d'un écran de 4 350 px** : les six
 * interrupteurs, le récapitulatif qu'ils produisent, et les mentions qui ne se
 * coupent pas. Les trois vont ensemble — le deuxième RÉSUME le premier, le
 * troisième dit ce que le premier ne pourra jamais éteindre —, et c'est
 * précisément pourquoi ils n'ouvrent pas trois lignes du sommaire.
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
 * contrôles éprouvaient la RÈGLE — les bonnes phrases pour les bons réglages —,
 * jamais le CHEMIN entre le réglage et le papier.
 */
export default function ConditionsClient({ initial }: { initial: Conditions }) {
  const [c, setC] = useState<Conditions>(initial);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [aEcrire, setAEcrire] = useState(false);

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

  const apercu = lignesConditionsDevis(c);

  // **La réserve du bas suit la barre**, sans quoi `pb-40` laissait 160 px de
  // vide au bout de l'écran. Elle ne compte PAS les deux secondes et demie où
  // la barre s'attarde pour dire « Enregistré ✓ » : cet instant-là suit un
  // appui, pas une lecture du bas de page.
  const barreVisible = aEcrire || enCours;

  return (
    <div className={barreVisible ? "pb-40" : "pb-10"}>
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

      {/* **CE RÉCAPITULATIF A REMONTÉ SOUS LES INTERRUPTEURS LE 6 SEPTEMBRE
          2026.** Il vivait 3 000 pixels plus bas, après le message au client, le
          numéro et l'allure : on le lisait sans savoir de quoi il parlait, ou
          on ne le lisait jamais. Le découpage du 7 septembre le garde ici,
          collé à ce qu'il résume.

          Il se RECALCULE (`lignesConditionsDevis`), il ne se recopie pas : deux
          rédactions du même engagement finiraient par diverger, et c'est le
          client qui lirait la mauvaise (`CLAUDE.md` §3). */}
      <Bloc titre="Ce que votre devis dira">
        {apercu.length === 0 ? (
          <p className={texteSituation} style={{ color: colors.inkSoft }}>
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
        <p className={`mt-3 ${texteSituation}`} style={{ color: colors.inkSoft }}>
          Le montant de l&apos;acompte se calcule sur chaque devis. Il n&apos;est pas
          écrit ici : il dépend du total.
        </p>
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
            <span className={`mt-1 block ${texteSituation}`} style={{ color: colors.inkSoft }}>
              Pénalités de retard, indemnité forfaitaire de 40 €, et la franchise de
              l&apos;article 293 B quand vous n&apos;êtes pas assujetti.
            </span>
          </span>
          <span className={libelleCaps} style={{ color: colors.or, flex: "none", paddingTop: 4 }}>
            Obligatoire
          </span>
        </div>
        <p className={texteSituation} style={{ color: colors.inkSoft }}>
          Elles s&apos;écrivent seules et suivent votre régime de TVA. Les retirer rendrait
          la facture irrégulière.
        </p>
      </Bloc>

      <p className={`mx-[26px] mt-[30px] border-t pt-[18px] ${texteSituation}`}
         style={{ borderColor: colors.line, color: colors.inkSoft }}>
        Chaque devis garde <b style={{ color: colors.ink, fontWeight: 400 }}>ce que ces
        réglages disaient le jour où il a été créé</b> : les corriger aujourd&apos;hui
        ne change aucun document déjà fait.
      </p>

      <BarreEnregistrer
        aEcrire={aEcrire}
        enCours={enCours}
        refus={null}
        onEnregistrer={() => enregistrer({})}
      />
    </div>
  );
}
