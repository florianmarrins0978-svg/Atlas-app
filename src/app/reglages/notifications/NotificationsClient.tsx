"use client";

import { useState, useTransition } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { BORNES_RAPPELS, type ReglagesRappels } from "@/lib/rappels";
import { ecrireRappelsAction } from "./actions";

/**
 * « Notifications » — `maquettes/atlas-reglages-notifications.html`.
 *
 * **L'écran dit d'abord CE QUI EXISTE, et il ne le règle pas.** Deux familles
 * d'alertes vivent déjà sur l'accueil — la réponse d'un client, le lien de
 * devis expiré — et elles n'ont pas d'interrupteur : les couper, ce serait ne
 * plus savoir qu'on a été refusé. Sa règle du 13 août 2026 : *« [des
 * interrupteurs] seulement à celles où la désactivation n'entraîne pas de
 * problème juridique ou moral ou de dysfonctionnement à l'appli »*.
 *
 * **Puis ce qui se règle**, et c'est vraiment réglable : trois rappels de
 * confort, qui apparaissent sur l'accueil et se coupent sans rien perdre.
 *
 * **Et ce qui n'existe pas est dit, pas dessiné.** Six familles de la planche
 * attendent une donnée absente — au premier rang « cette facture est payée ».
 * Les dessiner avec un interrupteur aurait fait valider un écran qui ne règle
 * rien.
 */
export default function NotificationsClient({ initial }: { initial: ReglagesRappels }) {
  const [reglages, setReglages] = useState<ReglagesRappels>(initial);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function ecrire(partiel: Partial<ReglagesRappels>) {
    const vise = { ...reglages, ...partiel };
    setReglages(vise);
    demarrer(async () => {
      const r = await ecrireRappelsAction(vise);
      if (r.ok) {
        setRefus(null);
        // **On reprend ce que le SERVEUR a retenu**, pas ce qu'on lui a envoyé :
        // une valeur hors bornes est ramenée dans les bornes, et l'écran doit
        // montrer le nombre qui sera vraiment employé.
        setReglages(r.reglages);
      } else {
        setRefus(r.raison);
        setReglages(reglages);
      }
    });
  }

  return (
    <div className="pb-24">
      {refus && (
        <p
          role="alert"
          className={`mx-[26px] mt-4 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}`, color: colors.alert }}
        >
          {refus}
        </p>
      )}

      <p className={`mx-[26px] mt-[26px] ${texteSituation}`} style={{ color: colors.muted }}>
        Tout se passe <b style={{ color: colors.ink, fontWeight: 500 }}>dans l&apos;application</b>, sur
        l&apos;écran d&apos;accueil. Rien ne part sur votre téléphone ni par e-mail : Atlas n&apos;envoie ni SMS
        ni courriel.
      </p>

      <Bloc titre="Ce qui vous est toujours signalé">
        <Fixe
          nom="Réponse à un devis"
          dit="Accepté, corrigé ou refusé — avec le message du client"
        />
        <Fixe
          nom="Lien de devis expiré"
          dit="Quand le client n'a pas pu l'ouvrir à temps"
        />
        <p className={`pt-3 ${texteSituation}`} style={{ color: colors.muted }}>
          Ces deux-là <b style={{ color: colors.ink, fontWeight: 500 }}>ne se coupent pas</b>. Les éteindre, ce
          serait accepter de ne plus savoir qu&apos;un client vous a refusé.
        </p>
      </Bloc>

      <Bloc titre="Ce que vous réglez">
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
          dit="Le chantier est ouvert et vous n'avez pas encore envoyé de devis"
          unite="jours"
          valeur={reglages.chantierSansDevisJours}
          bornes={BORNES_RAPPELS.chantierSansDevisJours}
          enCours={enCours}
          onChange={(v) => ecrire({ chantierSansDevisJours: v })}
        />
        <Rappel
          nom="Devis sans réponse"
          dit="Un devis parti, toujours valable, dont le client n'a rien dit"
          unite="jours"
          valeur={reglages.devisSansReponseJours}
          bornes={BORNES_RAPPELS.devisSansReponseJours}
          enCours={enCours}
          onChange={(v) => ecrire({ devisSansReponseJours: v })}
        />
        <Rappel
          nom="Chantier fini, pas facturé"
          dit="Le chantier est terminé et aucune facture n'est partie"
          unite="jours"
          valeur={reglages.chantierNonFactureJours}
          bornes={BORNES_RAPPELS.chantierNonFactureJours}
          enCours={enCours}
          onChange={(v) => ecrire({ chantierNonFactureJours: v })}
        />
        <p className={`pt-3 ${texteSituation}`} style={{ color: colors.muted }}>
          Ceux-là se coupent sans rien perdre : le chantier reste dans votre liste, le devis reste sur sa fiche,
          et le chantier fini reste dans « Terminés ».
        </p>
      </Bloc>

      {/* **CE QUI MANQUE SE DIT.** Le dépôt interdit de laisser croire qu'une
          chose fonctionne ; il interdit aussi de laisser croire qu'elle
          n'existera jamais. Le patron doit savoir ce qui bloque, parce que
          c'est LUI qui le débloque. */}
      <Bloc titre="Ce qui manque encore">
        <p className={texteSituation} style={{ color: colors.muted }}>
          <b style={{ color: colors.ink, fontWeight: 500 }}>« Facture impayée »</b> est le rappel le plus utile,
          et il est impossible aujourd&apos;hui : rien dans Atlas n&apos;enregistre qu&apos;une facture a été
          payée. Tant que ce geste n&apos;existe pas, l&apos;alerte crierait sur toutes vos factures, pour
          toujours.
        </p>
      </Bloc>
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    // Le premier bloc ne porte pas de trait : le cheveu de l'en-tête ferme déjà
    // au-dessus, et les deux dessineraient une bande morte.
    <section
      className="mx-[26px] mt-[30px] border-t pt-[18px] first-of-type:mt-[26px] first-of-type:border-t-0 first-of-type:pt-0"
      style={{ borderColor: colors.line }}
    >
      <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
        {titre}
      </p>
      {children}
    </section>
  );
}

/** Une alerte qui existe et ne se règle pas — elle se LIT, elle ne se touche pas. */
function Fixe({ nom, dit }: { nom: string; dit: string }) {
  return (
    <div className="flex items-start gap-3 border-b py-[13px] last:border-b-0" style={{ borderColor: colors.line }}>
      <span
        aria-hidden="true"
        className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full"
        style={{ backgroundColor: colors.or }}
      />
      <span className="min-w-0 flex-1">
        <span className="block" style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.25 }}>
          {nom}
        </span>
        <span className={`mt-1 block ${texteSituation}`} style={{ color: colors.muted }}>
          {dit}
        </span>
      </span>
    </div>
  );
}

/**
 * Un rappel réglable : un interrupteur, et un délai quand il est allumé.
 *
 * **Le délai disparaît quand le rappel est éteint.** Le laisser grisé
 * inviterait à le régler, et le patron croirait avoir allumé quelque chose.
 */
function Rappel({
  nom,
  dit,
  unite,
  valeur,
  bornes,
  enCours,
  onChange,
}: {
  nom: string;
  dit: string;
  unite: string;
  valeur: number | null;
  bornes: { min: number; max: number };
  enCours: boolean;
  onChange: (v: number | null) => void;
}) {
  const allume = valeur !== null;
  return (
    <div className="border-b py-[13px] last:border-b-0" style={{ borderColor: colors.line }}>
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          {/* Repéré pour `test-devis-qui-tarde-e2e`, qui refuse que deux
              réglages commencent par le même mot — la crainte du patron du
              16 août 2026, et la seule façon de la tenir. */}
          <span
            data-atlas="rappel-nom"
            className="block"
            style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.25 }}
          >
            {nom}
          </span>
          <span className={`mt-1 block ${texteSituation}`} style={{ color: colors.muted }}>
            {dit}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={allume}
          aria-label={nom}
          disabled={enCours}
          // Rallumé, il reprend le délai d'origine plutôt que zéro : un rappel
          // « au bout de 0 jour » se déclencherait le jour même.
          onClick={() => onChange(allume ? null : bornes.min > 7 ? bornes.min : 7)}
          // 44 px de haut sous le pouce, gants compris.
          className="relative mt-0.5 h-[28px] w-[48px] flex-none rounded-full py-2 transition-colors"
          style={{
            backgroundColor: allume ? colors.rust : colors.line,
            boxShadow: allume ? "none" : `inset 0 0 0 1px ${colors.line}`,
          }}
        >
          <span
            aria-hidden="true"
            className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-all"
            style={{ backgroundColor: colors.cream, left: allume ? 23 : 3 }}
          />
        </button>
      </div>

      {allume && (
        <label className="mt-2.5 flex items-center gap-2.5">
          <span className={texteSituation} style={{ color: colors.muted }}>
            Au bout de
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={bornes.min}
            max={bornes.max}
            value={valeur}
            aria-label={`Délai du rappel « ${nom} », en ${unite}`}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(n);
            }}
            className="w-[68px] rounded-[4px] border-0 px-2.5 py-2 text-right outline-none"
            // 16 px au moins : en dessous, iOS agrandit la page à la mise au point.
            style={{ backgroundColor: colors.card, color: colors.ink, fontSize: 16 }}
          />
          <span className={texteSituation} style={{ color: colors.muted }}>
            {unite}
          </span>
        </label>
      )}
    </div>
  );
}
