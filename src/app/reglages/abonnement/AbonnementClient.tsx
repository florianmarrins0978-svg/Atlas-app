"use client";

import ChoixEnMots from "@/components/atlas/reglages/ChoixEnMots";
import { useState, useTransition } from "react";
import ActionBas from "@/components/atlas/reglages/ActionBas";
import CocheRonde from "@/components/atlas/reglages/CocheRonde";
import Paquet from "@/components/atlas/reglages/Paquet";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import { colors, font, surPlein } from "@/lib/design-tokens";
import {
  FORMULES,
  formule,
  lignesCommunes,
  lignesQuiDistinguent,
  prixALAnnee,
  type FormuleCode,
  type Periodicite,
} from "@/lib/abonnements";
import { sabonnerAction, ouvrirLeGuichetAction, changerDeFormuleAction, nePasArreterAction } from "./actions";
import AvantDePartir from "./AvantDePartir";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import Picto from "@/components/atlas/reglages/Picto";

/**
 * LES TROIS FORMULES — d'après sa planche du 9 septembre 2026,
 * `appli/choisir-son-abonnement.html`, qu'il a validée.
 *
 * **Les prix et les lignes viennent de `src/lib/abonnements.ts`**, jamais
 * recopiés ici : un tarif affiché qui ne serait pas le tarif débité est le
 * pire défaut que cet écran puisse produire.
 *
 * **Aucune flèche au bout des libellés** (`CLAUDE.md` §3), et le moins de mots
 * possible : chaque carte énumère ce qu'elle comprend, et rien d'autre.
 *
 * **La planche des Réglages soignés, 26 octobre 2026** (`appli/soignee/
 * reglages-abonnement.html`, vue Proposé) a allégé les cartes sans rien
 * retirer : ce que les trois formules partagent se lit une fois, au-dessus
 * (`lignesCommunes`) ; chaque carte ne garde que ce qui la distingue, ce qui
 * lui manque toujours barré ; une carte se TOUCHE pour se choisir, et un seul
 * bouton plein, en bas, dit ce qu'il fait (« S’abonner à Entreprise »,
 * « Passer à Illimité ») à la place de trois boutons pareils.
 */
export default function AbonnementClient({
  formuleActuelle,
  periodiciteActuelle,
  annulationDemandee,
  paiementBranche,
}: {
  /** `null` quand il n'a pas d'abonnement. */
  formuleActuelle: FormuleCode | null;
  periodiciteActuelle: Periodicite | null;
  /** Une résiliation est demandée : l'abonnement s'arrêtera à l'échéance. */
  annulationDemandee: boolean;
  /** Faux tant que la clé du prestataire n'est pas posée : on le DIT. */
  paiementBranche: boolean;
}) {
  const [periodicite, setPeriodicite] = useState<Periodicite>(periodiciteActuelle ?? "mensuelle");
  // Abonné, sa formule est touchée d'avance ; sinon la moins chère, la
  // première, comme les cartes se lisent.
  const [choisie, setChoisie] = useState<FormuleCode>(formuleActuelle ?? FORMULES[0].code);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [partir, setPartir] = useState(false);

  function nePasArreter() {
    setMessage(null);
    demarrer(async () => {
      const r = await nePasArreterAction();
      if (!r.ok) setMessage(r.message);
      else window.location.reload();
    });
  }

  function choisir(code: FormuleCode) {
    setMessage(null);
    demarrer(async () => {
      // **Deux gestes différents derrière le même bouton, et c'est voulu.**
      // Ouvrir une page de paiement pour qui est déjà abonné créerait un
      // SECOND abonnement, et il serait prélevé deux fois.
      const r = formuleActuelle
        ? await changerDeFormuleAction(code, periodicite)
        : await sabonnerAction(code, periodicite);
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      // Le changement de formule ne renvoie nulle part : il est fait, et
      // l'écran se recharge pour montrer le nouvel état.
      if (r.url) window.location.href = r.url;
      else window.location.reload();
    });
  }

  function guichet() {
    setMessage(null);
    demarrer(async () => {
      const r = await ouvrirLeGuichetAction();
      if (!r.ok) setMessage(r.message);
      else if (r.url) window.location.href = r.url;
    });
  }

  // **Le bouton du bas dit ce qu'il fait, pour la carte touchée.** Sa propre
  // formule, à son propre rythme, ne se « change » pas : le bouton se retire
  // plutôt que de proposer un geste qui ne ferait rien.
  const nomChoisi = formule(choisie)?.nom ?? choisie;
  const dejaLaSienne = choisie === formuleActuelle && periodicite === periodiciteActuelle;
  // Sa formule à l'autre rythme : le bouton dit le rythme, dans les deux sens.
  const libelleDuBas = !formuleActuelle
    ? `S’abonner à ${nomChoisi}`
    : choisie === formuleActuelle
      ? periodicite === "annuelle"
        ? "Passer à l’année"
        : "Passer au mois"
      : `Passer à ${nomChoisi}`;

  return (
    <div className="pb-24">
      {formuleActuelle && (
        <div className="mx-[22px] mt-2">
          {/* **Éteint aussi quand le paiement n'est pas branché**, comme le
              bouton du bas — vu à la capture : une ligne qui s'ouvre au-dessus
              d'un bouton éteint promet quelque chose que l'écran vient de
              démentir deux lignes plus bas. */}
          <div className="overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
            <button
              type="button"
              onClick={guichet}
              disabled={enCours || !paiementBranche}
              data-atlas="guichet-abonnement"
              className="flex min-h-[76px] w-full items-center gap-3.5 py-3 text-left disabled:opacity-50"
            >
              <PastilleIcone>
                <Picto nom="carte" />
              </PastilleIcone>
              <span className="min-w-0 flex-1">
                <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                  Gérer mon abonnement
                </span>
                <span className="mt-[3px] block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                  Changer de carte, vos factures Atlas.
                </span>
              </span>
              <span style={{ color: colors.chevron }}>
                <Picto nom="suivant" taille={20} epaisseur={2} />
              </span>
            </button>
          </div>

          {/* **Le mot « factures » désigne deux choses opposées**, et la
              confusion se paierait par un appel affolé un soir de trimestre.
              Rangé sous la seule ligne qui parle des factures d'Atlas (planche
              du 26 octobre 2026) : posé sous les formules, il contredisait
              « Devis et factures illimités », qui parle des siennes. */}
          <div className="mt-2">
            <PlageTon ton="bleu">
              <b style={{ color: colors.ink }}>Attention au mot.</b> Ici, « factures » désigne celles qu&apos;Atlas vous
              envoie. Celles de vos clients sont dans « Terminés ».
            </PlageTon>
          </div>

          {/* Résilier se fait ICI, et non chez le prestataire : « Avant de
              partir » propose une formule moins chère et demande pourquoi
              (planche du 18 octobre 2026). Une résiliation demandée se retire
              tant que l'échéance n'est pas passée. */}
          <div className="mt-2.5">
            {annulationDemandee ? (
              <button
                type="button"
                onClick={nePasArreter}
                disabled={enCours || !paiementBranche}
                data-atlas="ne-pas-arreter"
                className="min-h-[56px] w-full rounded-full px-[22px] text-[17px] font-semibold disabled:opacity-50"
                style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
              >
                Ne pas arrêter
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPartir(true)}
                disabled={enCours || !paiementBranche}
                data-atlas="resilier"
                className="min-h-[48px] px-1 text-[16px] font-semibold disabled:opacity-50"
                style={{ color: colors.alert }}
              >
                Résilier
              </button>
            )}
          </div>
        </div>
      )}

      {partir && formuleActuelle && periodiciteActuelle && (
        <AvantDePartir
          formuleActuelle={formuleActuelle}
          periodicite={periodiciteActuelle}
          fermer={() => setPartir(false)}
        />
      )}

      <Paquet titre={formuleActuelle ? "Changer de formule" : "Choisir une formule"} sansPlage>
        {/* **Deux mois offerts sur l'année** : c'est ce que dit la grille (390
            au lieu de 468), et c'est le seul argument de ce choix. */}
        <ChoixEnMots
          libelle="Payer au mois ou à l’année"
          options={[
            { valeur: "mensuelle", libelle: "Au mois", base: "34%" },
            { valeur: "annuelle", libelle: "À l’année, 2 mois offerts" },
          ]}
          valeur={periodicite}
          onChoix={setPeriodicite}
        />

        <div className="mt-3 rounded-[6px] px-[18px] py-3.5" style={{ backgroundColor: colors.card }}>
          <p className="mb-1 text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
            Dans les trois formules
          </p>
          <ul>
            {lignesCommunes().map((texte) => (
              <LigneOffre key={texte} texte={texte} manque={false} />
            ))}
          </ul>
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          {FORMULES.map((f) => {
            const ici = f.code === formuleActuelle && periodicite === periodiciteActuelle;
            const prise = f.code === choisie;
            const annee = prixALAnnee(f);
            return (
              // **Un `div` qui se comporte en bouton, et non un `<button>`** :
              // la carte porte une liste, qu'un bouton n'a pas le droit de
              // contenir. Il se touche, et se choisit au clavier.
              <div
                key={f.code}
                role="button"
                tabIndex={0}
                aria-pressed={prise}
                data-atlas={`formule-${f.code}`}
                onClick={() => setChoisie(f.code)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setChoisie(f.code);
                  }
                }}
                className="cursor-pointer rounded-[12px] px-[18px] pb-3 pt-4 text-left transition-shadow duration-200"
                style={{
                  backgroundColor: colors.card,
                  boxShadow: prise ? `inset 0 0 0 2px ${colors.rust}` : `inset 0 0 0 1px ${colors.lineSoft}`,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <CocheRonde pris={prise} />
                  <span className="min-w-0 flex-1 text-[21px] leading-[1.2]" style={{ fontFamily: font.display }}>
                    {f.nom}
                  </span>
                  {periodicite === "annuelle" ? (
                    // **Douze mois barrés au-dessus du prix de dix** — sa
                    // demande du 26 octobre 2026. Les deux chiffres viennent de
                    // `prixALAnnee`, jamais écrits ici.
                    <span className="inline-grid justify-items-end gap-y-0.5 whitespace-nowrap">
                      <s className="text-[14px]" style={{ color: colors.inkSoft, fontVariantNumeric: "tabular-nums lining-nums" }}>
                        {annee.douzeMois} €
                      </s>
                      <Prix montant={annee.annuel} unite="/an HT" />
                    </span>
                  ) : (
                    <Prix montant={f.prixMensuel} unite="/mois HT" />
                  )}
                </div>
                {ici && (
                  <p className="ml-8 mt-2.5">
                    <EtatEcrit ton="vert">Votre formule</EtatEcrit>
                  </p>
                )}
                <p className="ml-8 mt-1.5 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                  {f.accroche}
                </p>
                {periodicite === "annuelle" && (
                  <p className="ml-8 mt-2">
                    <EtatEcrit ton="vert">Vous gagnez {annee.gain} €</EtatEcrit>
                  </p>
                )}
                {/* Ce que la formule n'ouvre pas reste écrit, barré : sa
                    demande du 24 septembre 2026, « qu'il voie ce qu'il loupe ». */}
                <ul className="ml-8 mt-2">
                  {lignesQuiDistinguent(f).map((l) => (
                    <LigneOffre key={l.texte} texte={l.texte} manque={l.manque} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* **On DIT que le paiement n'est pas branché.** Un bouton éteint sans
            raison se lit comme une panne, et il rappuierait. */}
        {!paiementBranche && (
          <div className="mt-3.5">
            <PlageTon ton="bleu">Le paiement n’est pas encore branché : vous ne pouvez rien régler pour l’instant.</PlageTon>
          </div>
        )}

        {message && (
          <div className="mt-3.5" role="alert">
            <PlageTon ton="rouge">{message}</PlageTon>
          </div>
        )}
      </Paquet>

      {!dejaLaSienne && (
        <ActionBas>
          <button
            type="button"
            onClick={() => choisir(choisie)}
            disabled={enCours || !paiementBranche}
            data-atlas={`choisir-${choisie}`}
            className="atlas-plein min-h-[56px] w-full rounded-full px-[22px] text-[17px] font-semibold disabled:cursor-default"
            // Sans paiement branché, le bouton s'ÉTEINT (gris), et la plage
            // bleue dit pourquoi ; pendant l'envoi, il pâlit seulement.
            style={
              paiementBranche
                ? { backgroundColor: colors.plein, color: surPlein, opacity: enCours ? 0.6 : 1 }
                : { backgroundColor: colors.line, color: colors.inkSoft }
            }
          >
            {libelleDuBas}
          </button>
        </ActionBas>
      )}
    </div>
  );
}

function Prix({ montant, unite }: { montant: number; unite: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[24px] leading-none" style={{ fontFamily: font.display, fontVariantNumeric: "tabular-nums lining-nums" }}>
        {montant} €
      </span>
      <span className="ml-[3px] text-[13px]" style={{ color: colors.inkSoft }}>
        {unite}
      </span>
    </span>
  );
}

/** Une ligne d'offre : une coche verte, ou un rond gris et le texte barré. */
function LigneOffre({ texte, manque }: { texte: string; manque: boolean }) {
  return (
    <li
      data-atlas={manque ? "ligne-manque" : "ligne-comprise"}
      className="flex items-start gap-2.5 py-[5px] text-[15px] leading-[1.4]"
      style={{ color: manque ? colors.inkSoft : colors.ink, textDecoration: manque ? "line-through" : "none" }}
    >
      {manque ? (
        <span aria-hidden className="mt-px grid h-[18px] w-[18px] flex-none place-items-center">
          <span className="block h-2.5 w-2.5 rounded-full" style={{ boxShadow: `inset 0 0 0 1.5px ${colors.inkSoft}` }} />
        </span>
      ) : (
        <span className="mt-px" style={{ color: colors.carteVertTexte }}>
          <Picto nom="coche" taille={18} epaisseur={2.2} />
        </span>
      )}
      <span>{texte}</span>
    </li>
  );
}

