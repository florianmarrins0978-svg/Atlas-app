"use client";

import { useState, useTransition } from "react";
import { colors, font, libelleCaps, voile } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { jourEtMois } from "@/lib/jour";
import { lienTransmission } from "@/lib/message-client";
import { ouvrirAdresse } from "@/lib/ouvrir-messagerie";
import BottomSheet from "@/components/atlas/BottomSheet";
import type { FactureAPrevenir } from "@/server/repositories/factures";

/**
 * QUAND L'IBAN CHANGE — les factures déjà parties, et de quoi prévenir.
 *
 * **Tranché par lui le 8 septembre 2026**, maquette à l'appui
 * (`appli/changer-d-iban.html`) : *« oui je le veux »*, aux **trois** endroits.
 * Cette pièce est la même partout — les réglages, « En attente de paiement », et
 * l'écran du jour où l'IBAN change. Trois copies auraient donné trois listes qui
 * finiraient par ne plus dire la même chose (`CLAUDE.md` §3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI A CORRIGÉ LA PREMIÈRE PROPOSITION, ET C'EST SA QUESTION :** *« si je
 * décide de les relancer plus tard, où je dois aller pour retrouver l'écran ? »*
 *
 * Nulle part. L'écran du premier jour était un cul-de-sac : « Plus tard » ne
 * menait à rien, et il aurait fallu rechanger d'IBAN pour le revoir. Il n'est
 * donc pas une alternative aux deux autres — il en a BESOIN.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **RIEN NE S'AFFICHE QUAND LA LISTE EST VIDE.** Ni « 0 facture », ni coche
 * verte : un avertissement qui parle à tort s'apprend à être ignoré, et le jour
 * où il a raison on ne le lit plus (`CLAUDE.md` §4 ter).
 *
 * **PAS DE « PRÉVENIR LES 3 », et c'est un retrait assumé.** La maquette en
 * portait un ; le coder aurait menti. Chaque message part dans la messagerie de
 * l'artisan, une conversation à la fois : un bouton unique en ouvrirait UNE et
 * laisserait croire que les trois sont parties. Un geste par client, et l'on
 * voit ce qui reste.
 */
export default function AlerteAncienIban({
  factures,
  onPrevenir,
  onMaj,
  variante = "encart",
}: {
  factures: FactureAPrevenir[];
  /** Note le signalement et rend ce qui reste — l'action serveur partagée. */
  onPrevenir: (factureId: string) => Promise<FactureAPrevenir[]>;
  /**
   * **Quand deux exemplaires vivent sur le même écran, c'est le PARENT qui
   * tient la liste.** Sur les réglages, l'encart et l'écran du premier jour
   * montrent la même chose : chacun avec son état, prévenir dans l'un
   * laisserait l'autre réclamer encore — deux listes qui se contredisent, et
   * c'est celle qu'on voit qu'on croit.
   *
   * Absent, la pièce tient sa liste elle-même : c'est le cas de l'écran des
   * impayés, où elle est seule.
   */
  onMaj?: (restantes: FactureAPrevenir[]) => void;
  /** `encart` sous un champ ; `ecran` quand elle occupe la page entière. */
  variante?: "encart" | "ecran";
}) {
  const [locale, setLocale] = useState(factures);
  const liste = onMaj ? factures : locale;
  const setListe = onMaj ?? setLocale;
  const [ouverte, setOuverte] = useState<FactureAPrevenir | null>(null);
  const [enCours, demarrer] = useTransition();

  if (liste.length === 0) return null;

  /**
   * **Le signalement est noté quand il OUVRE le message, pas après.** Atlas ne
   * voit pas partir un SMS : il ouvre la messagerie, et la suite appartient à
   * l'artisan. Attendre une preuve qu'on n'aura jamais laisserait l'alerte
   * réclamer indéfiniment.
   */
  function envoyer(f: FactureAPrevenir, canal: "sms" | "email") {
    const destinataire = canal === "sms" ? f.clientTelephone : f.clientEmail;
    ouvrirAdresse(
      lienTransmission({
        canal,
        destinataire,
        message: { objet: `Facture ${f.numeroCommercial} — nos coordonnées bancaires`, corps: f.message },
      }),
      canal
    );
    setOuverte(null);
    demarrer(async () => setListe(await onPrevenir(f.id)));
  }

  const titre =
    liste.length === 1
      ? "1 facture envoyée porte l'ancien IBAN"
      : `${liste.length} factures envoyées portent l'ancien IBAN`;

  return (
    <>
      <section
        className={variante === "encart" ? "mt-3 rounded-2xl p-3" : "rounded-2xl p-3"}
        style={{
          border: `1px solid ${voile(colors.alert, 0.28)}`,
          backgroundColor: voile(colors.alert, 0.05),
        }}
      >
        <h2 className="text-[17px]" style={{ fontFamily: font.display, color: colors.ink }}>
          {titre}
        </h2>
        {/* **Deux phrases, pas trois.** La première dit ce qui compte — elles ne
            sont pas réglées, donc l'argent peut encore partir au mauvais
            endroit. La seconde dit pourquoi Atlas ne les corrige pas tout seul,
            et coupe court à la question qui viendrait sinon. */}
        <p className="mt-1.5 text-[13.5px] leading-snug" style={{ color: colors.inkSoft }}>
          Elles ne sont pas encore réglées. Le document que vos clients ont reçu ne peut pas être
          modifié.
        </p>

        <ul className="mt-2.5 flex flex-col">
          {liste.map((f) => (
            /* **Deux lignes, et non trois colonnes.** Sur 390 px, le nom, le
               montant ET le bouton côte à côte écrasaient la date : « émise le
               8 / septembre » passait à la ligne au milieu. Vu sur la capture,
               jamais par un test. */
            <li key={f.id} className="py-2.5" style={{ borderTop: `1px solid ${colors.line}` }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[14.5px]" style={{ color: colors.ink }}>
                  {f.clientNom ?? "Client"}
                </span>
                <span className="flex-none text-[14.5px] tabular-nums" style={{ color: colors.ink }}>
                  {enEuros(f.reste)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="min-w-0 text-[11.5px] leading-[1.45]" style={{ color: colors.muted }}>
                  {f.numeroCommercial} · émise le {jourEtMois(f.dateEmission)}
                </span>
                <button
                  type="button"
                  onClick={() => setOuverte(f)}
                  disabled={enCours}
                  className="flex-none rounded-full px-3.5 text-[13.5px] font-medium disabled:opacity-50"
                  style={{
                    minHeight: 40,
                    color: colors.rust,
                    backgroundColor: colors.rustTint,
                    boxShadow: `inset 0 0 0 1px ${colors.line}`,
                  }}
                >
                  Prévenir
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <FeuillePrevenir facture={ouverte} onFermer={() => setOuverte(null)} onEnvoyer={envoyer} />
    </>
  );
}

/**
 * LA MARQUE SUR UNE LIGNE DE « EN ATTENTE DE PAIEMENT ».
 *
 * **Le deuxième des trois endroits**, et celui où il va déjà : c'est là qu'il
 * regarde qui n'a pas payé. La feuille est la MÊME que celle de l'encart —
 * deux feuilles auraient fini par écrire deux messages différents au même
 * client.
 */
export function MarqueAncienIban({
  facture,
  onPrevenir,
}: {
  facture: FactureAPrevenir | undefined;
  onPrevenir: (factureId: string) => Promise<FactureAPrevenir[]>;
}) {
  const [ouverte, setOuverte] = useState(false);
  const [fait, setFait] = useState(false);
  const [enCours, demarrer] = useTransition();

  // Rien à signaler sur cette facture-là, ou c'est déjà fait : la ligne reste
  // celle qu'elle a toujours été.
  if (!facture || fait) return null;

  function envoyer(f: FactureAPrevenir, canal: "sms" | "email") {
    const destinataire = canal === "sms" ? f.clientTelephone : f.clientEmail;
    ouvrirAdresse(
      lienTransmission({
        canal,
        destinataire,
        message: { objet: `Facture ${f.numeroCommercial} — nos coordonnées bancaires`, corps: f.message },
      }),
      canal
    );
    setOuverte(false);
    demarrer(async () => {
      await onPrevenir(f.id);
      setFait(true);
    });
  }

  return (
    <>
      <div className="mt-1.5 flex items-center gap-2.5">
        <span className={libelleCaps} style={{ color: colors.alert, fontSize: 9.5 }}>
          Ancien IBAN
        </span>
        <button
          type="button"
          onClick={() => setOuverte(true)}
          disabled={enCours}
          className="rounded-full px-3 text-[13px] font-medium disabled:opacity-50"
          style={{
            minHeight: 34,
            color: colors.rust,
            backgroundColor: colors.rustTint,
            boxShadow: `inset 0 0 0 1px ${colors.line}`,
          }}
        >
          Prévenir
        </button>
      </div>
      <FeuillePrevenir
        facture={ouverte ? facture : null}
        onFermer={() => setOuverte(false)}
        onEnvoyer={envoyer}
      />
    </>
  );
}

/** La feuille qui montre le message avant de l'envoyer — une seule, pour les deux. */
function FeuillePrevenir({
  facture,
  onFermer,
  onEnvoyer,
}: {
  facture: FactureAPrevenir | null;
  onFermer: () => void;
  onEnvoyer: (f: FactureAPrevenir, canal: "sms" | "email") => void;
}) {
  const ouverte = facture;
  return (
      <BottomSheet open={ouverte !== null} onBackdropClick={onFermer}>
        {ouverte && (
          <div className="flex flex-col">
            <h3 className="text-[18px]" style={{ fontFamily: font.display, color: colors.ink }}>
              Prévenir {ouverte.clientNom ?? "votre client"}
            </h3>
            {/* **Le message se LIT avant de partir.** Il porte le nouvel IBAN et
                le numéro de facture ; l'artisan doit pouvoir vérifier ce qui
                sort de son téléphone à son nom. */}
            <p
              className="mt-2.5 rounded-xl px-3.5 py-2.5 text-[14.5px] leading-relaxed"
              style={{
                backgroundColor: colors.rustTint,
                boxShadow: `inset 0 0 0 1px ${colors.line}`,
                color: colors.ink,
              }}
            >
              {ouverte.message}
            </p>

            {/* **Un canal sans coordonnée ne s'affiche pas.** Un bouton « SMS »
                sur un client dont on n'a pas le numéro ouvre un message vide,
                et l'artisan ne s'en aperçoit que dans sa messagerie — trop
                tard. C'est le défaut déjà payé sur l'envoi du devis. */}
            <div className="mt-3 flex gap-2">
              {ouverte.clientTelephone && (
                <button
                  type="button"
                  onClick={() => onEnvoyer(ouverte, "sms")}
                  className="atlas-plein flex-1 rounded-full py-3 text-[16px]"
                  style={{ backgroundColor: colors.plein, color: colors.card, fontFamily: font.display }}
                >
                  Envoyer par SMS
                </button>
              )}
              {ouverte.clientEmail && (
                <button
                  type="button"
                  onClick={() => onEnvoyer(ouverte, "email")}
                  className="flex-1 rounded-full py-3 text-[15px] font-medium"
                  style={{ color: colors.rust, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
                >
                  Par e-mail
                </button>
              )}
            </div>

            {/* Ni numéro ni adresse : on le dit, plutôt que de montrer une
                feuille sans issue. */}
            {!ouverte.clientTelephone && !ouverte.clientEmail && (
              <p className={`mt-3 ${libelleCaps}`} style={{ color: colors.alert }}>
                Aucune coordonnée pour ce client
              </p>
            )}
          </div>
        )}
      </BottomSheet>
  );
}
