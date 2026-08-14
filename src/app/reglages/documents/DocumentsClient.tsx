"use client";

import { useState, useTransition } from "react";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import {
  BORNES,
  lireConditions,
  lignesConditionsDevis,
  type Conditions,
} from "@/lib/conditions-documents";
import { majConditionsAction } from "./actions";

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
export default function DocumentsClient({ initial }: { initial: Conditions }) {
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
          disabled={!aEcrire && !enCours}
          className="block w-full rounded-full py-[15px] text-center text-[16px]"
          style={{
            backgroundColor: !aEcrire && !enCours ? colors.card : colors.rust,
            color: !aEcrire && !enCours ? colors.muted : colors.cream,
            boxShadow: !aEcrire && !enCours ? `inset 0 0 0 1px ${colors.line}` : "none",
          }}
        >
          {enCours ? "Enregistrement…" : !aEcrire ? "Enregistré ✓" : "Enregistrer"}
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
