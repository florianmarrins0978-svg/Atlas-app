"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import IconeTrait, { type NomIcone } from "@/components/atlas/IconeTrait";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors, font, voile } from "@/lib/design-tokens";
import { enEuros, enMontant } from "@/lib/euros";
import { LIBELLES_MOYEN, type MoyenDePaiement } from "@/lib/acomptes-facture";
import { recuLePaiementAction } from "../actions";

const majuscule = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);

/**
 * LE RUBAN « COMMENT » — sa planche du 2 novembre 2026, où il a répondu
 * *« la A »* entre la barre et la liste, après avoir écarté les cartes. Un seul
 * ruban, quatre cases, une icône au-dessus du mot ; la case prise se soulève et
 * son icône passe en or.
 *
 * Les quatre moyens qu'on choisissait déjà au déroulant (`MOYENS_PROPOSES`),
 * dans l'ordre de la planche. « autre » n'y est pas, comme avant : la base
 * l'accepte, mais c'est le nom d'un règlement sans moyen (« règlement »), et
 * aucun écran ne l'a jamais proposé au doigt.
 */
const RUBAN: readonly { moyen: MoyenDePaiement; icone: NomIcone }[] = [
  { moyen: "virement", icone: "banque" },
  { moyen: "cheque", icone: "crayon" },
  { moyen: "especes", icone: "euro" },
  { moyen: "carte", icone: "carte" },
];

/** Les rubriques de la planche : petites capitales, gris doux. */
const rubrique = "mb-2.5 block text-[13px] font-semibold uppercase";
const styleRubrique = { letterSpacing: "0.12em", color: colors.inkSoft } as const;

/**
 * Une case de saisie de la planche (`.case-doc`). Le liseré et l'anneau du
 * focus vivent dans la même propriété : posé en style, le liseré écraserait
 * l'anneau, que seule une classe sait poser au focus.
 */
const caseDoc =
  "block min-h-[52px] w-full rounded-[10px] border-0 px-[15px] py-[13px] text-[16px] outline-none " +
  "shadow-[inset_0_0_0_1.5px_var(--atlas-line)] focus:shadow-[inset_0_0_0_2px_var(--atlas-rust)]";

export default function PaiementClient({
  chantierId,
  factureId,
  reste,
  aujourdHui,
}: {
  chantierId: string;
  factureId: string;
  reste: string;
  aujourdHui: string;
}) {
  const router = useRouter();
  const [moyen, setMoyen] = useState<MoyenDePaiement>("cheque");
  const [numero, setNumero] = useState("");
  const [date, setDate] = useState(aujourdHui);
  // Déjà rempli de ce qui reste, écrit comme un montant (« 2 026,40 ») : sa
  // planche, « le montant en grand, déjà rempli de ce qui reste ».
  const [montant, setMontant] = useState(enMontant(reste));
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Ce qui part au serveur, et ce que « Tout le reste » compare : le même
  // montant, sans ses espaces ni sa virgule.
  const montantSaisi = montant.replace(/\s/g, "").replace(",", ".");
  const toutLeReste = montantSaisi !== "" && Number(montantSaisi) === Number(reste);
  const rang = Math.max(0, RUBAN.findIndex((r) => r.moyen === moyen));

  async function noter() {
    setEnCours(true);
    setErreur(null);
    // Le refus (montant qui dépasse, date d'avant la facture) vient de la règle
    // du serveur, `refusDuPaiement` : l'écran ne la recopie pas.
    const r = await recuLePaiementAction(factureId, {
      date,
      montant: montantSaisi,
      moyen,
      numero: moyen === "cheque" ? numero : null,
    });
    if (!r.succes) {
      setErreur(r.erreur);
      setEnCours(false);
      return;
    }
    // **Retour à Terminés, devant sa case** — sa demande du 25 septembre 2026 :
    // *« une fois validé, on quitte la page de la facture et on retourne sur
    // Terminés »*. La planche ramenait à la facture ; c'est lui qui tranche.
    router.push(`/termines?chantier=${chantierId}`);
  }

  return (
    <div className="px-[22px] pb-10 pt-5" data-atlas="paiement-saisie">
      <p id="paiement-comment" className={rubrique} style={styleRubrique}>
        Comment
      </p>
      <div
        role="group"
        aria-labelledby="paiement-comment"
        className="relative grid grid-cols-4 rounded-[18px] p-1"
        style={{ backgroundColor: voile(colors.ink, 0.06) }}
        data-atlas="paiement-moyen"
      >
        {/* Le fond qui glisse sous la case prise : la case se soulève, elle ne
            s'encadre pas. Sans animation pour qui l'a demandé à son téléphone. */}
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1 top-1 rounded-[14px] transition-transform duration-[240ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none"
          style={{
            width: "calc((100% - 8px) / 4)",
            transform: `translateX(${rang * 100}%)`,
            backgroundColor: colors.card,
            boxShadow: `0 1px 2px ${voile(colors.ink, 0.08)}, 0 4px 12px ${voile(colors.ink, 0.08)}`,
          }}
        />
        {RUBAN.map(({ moyen: m, icone }) => {
          const pris = m === moyen;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={pris}
              onClick={() => setMoyen(m)}
              className="relative z-[1] flex min-h-[74px] flex-col items-center justify-center gap-[5px] text-[13.5px] font-semibold transition-colors duration-200 motion-reduce:transition-none"
              style={{ color: pris ? colors.ink : colors.inkSoft }}
              data-atlas={`paiement-moyen-${m}`}
            >
              <span className="transition-colors duration-200 motion-reduce:transition-none" style={{ color: pris ? colors.or : undefined }}>
                <IconeTrait nom={icone} taille={22} />
              </span>
              {majuscule(LIBELLES_MOYEN[m])}
            </button>
          );
        })}
      </div>

      {moyen === "cheque" && (
        <div className="mt-4">
          <label htmlFor="numero-cheque" className={rubrique} style={styleRubrique}>
            N° de chèque
          </label>
          <input
            id="numero-cheque"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Facultatif"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            className={caseDoc}
            style={{ backgroundColor: colors.card, color: colors.ink }}
            data-atlas="paiement-numero"
          />
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="date-paiement" className={rubrique} style={styleRubrique}>
          Le
        </label>
        <input
          id="date-paiement"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={caseDoc}
          style={{ backgroundColor: colors.card, color: colors.ink }}
        />
      </div>

      <div className="mt-4">
        <label htmlFor="montant-paiement" className={rubrique} style={styleRubrique}>
          Combien
        </label>
        {/* La grande case des feuilles du devis (planche) : serif 40, le « € »
            à droite, le pavé de chiffres, au lieu de la petite case d'avant. */}
        <div
          className="flex h-[68px] items-baseline justify-end gap-2 rounded-[14px] px-[18px] shadow-[inset_0_0_0_1.5px_var(--atlas-line)] focus-within:shadow-[inset_0_0_0_2px_var(--atlas-rust)]"
          style={{ backgroundColor: colors.card }}
        >
          <input
            id="montant-paiement"
            inputMode="decimal"
            autoComplete="off"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-right outline-none"
            style={{ fontFamily: font.display, fontSize: 40, lineHeight: "68px", color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}
            data-atlas="paiement-montant"
          />
          <span aria-hidden="true" style={{ fontFamily: font.display, fontSize: 26, lineHeight: 1, color: colors.inkSoft }}>
            €
          </span>
        </div>
        <button
          type="button"
          aria-pressed={toutLeReste}
          onClick={() => setMontant(enMontant(reste))}
          className="mt-2 inline-flex min-h-[44px] items-center rounded-full px-4 text-[14.5px] font-semibold active:scale-[0.98]"
          style={{ color: colors.ink, boxShadow: toutLeReste ? `inset 0 0 0 2px ${colors.ink}` : `inset 0 0 0 1.5px ${colors.line}` }}
          data-atlas="paiement-tout-le-reste"
        >
          Tout le reste, {enEuros(reste)}
        </button>
      </div>

      {erreur && (
        <p className="mt-4 text-center text-[13.5px]" style={{ color: colors.alert }} role="alert">
          {erreur}
        </p>
      )}
      <div className="mt-7">
        <PrimaryButton onClick={noter} disabled={enCours} repere="paiement-noter">
          C&apos;est noté
        </PrimaryButton>
      </div>
    </div>
  );
}
