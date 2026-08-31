"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import { noterPaiementAction, retirerPaiementAction, soldeFactureAction } from "./actions";

export type FactureAttendue = {
  id: string;
  numeroCommercial: string;
  dateEmission: string;
  clientNom: string | null;
  totalTtc: string;
  reste: string;
  etat: "en_attente" | "partielle" | "soldee";
  paiements: { id: string; date: string; montant: string; origine: "saisi" | "reprise" | "banque" }[];
};

/**
 * « L'endroit en attente » — sa demande du 14 août 2026, mot pour mot.
 *
 * *« Lorsque la facture part, au lieu qu'elle rentre directement dans le relevé
 * de TVA, elle arrive dans un endroit en attente ; lorsque j'ai reçu le
 * paiement, je retourne sur l'endroit en attente, je clique sur valider, et
 * boum, la facture va directement dans le relevé. »*
 *
 * **Deux portes, et il les a demandées toutes les deux :** « Payée » solde en
 * un doigt — c'est le cas de cinquante factures par an —, et « Noter un
 * règlement » ouvre la date et le montant pour un acompte. La seconde ne
 * remplace pas la première : une saisie en deux champs pour un geste qu'on fait
 * cinquante fois serait un impôt sur le temps.
 *
 * **Ce qui n'y figure pas est aussi important :** aucune facture soldée. Cet
 * écran est une file d'attente, pas un journal — ce qui est réglé a rejoint le
 * relevé, et il est juste au-dessus.
 */
export default function EnAttenteDePaiement({
  factures,
  aujourdHui,
  regime,
}: {
  factures: FactureAttendue[];
  /** Le jour, calculé sur le serveur : le téléphone peut être à l'heure d'ailleurs. */
  aujourdHui: string;
  regime: "encaissements" | "debits";
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const router = useRouter();

  // **Aux débits, cet écran n'a pas lieu d'être** — tout est déjà déclaré à
  // l'émission. Le montrer quand même ferait croire qu'un geste reste à faire.
  if (regime === "debits") return null;

  async function solder(id: string) {
    setEnCours(id);
    setErreur(null);
    try {
      const r = await soldeFactureAction(id, aujourdHui);
      if (!r.ok) setErreur(r.raison);
      else router.refresh();
    } catch {
      setErreur("Ce règlement n'a pas pu être enregistré. Réessayez.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="mt-6 px-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px]" style={{ color: colors.ink, fontFamily: font.display }}>
          En attente de paiement
        </h2>
        <span className="text-[12px]" style={{ color: colors.muted }}>
          {factures.length === 0 ? "rien" : `${factures.length} facture${factures.length > 1 ? "s" : ""}`}
        </span>
      </div>
      <p className="mt-1 text-[13px] leading-snug" style={{ color: colors.muted }}>
        Ces factures sont parties chez vos clients. Elles entreront au relevé{" "}
        <strong style={{ color: colors.ink }}>le jour où vous serez payé</strong>, pas avant.
      </p>

      {erreur && (
        <p role="alert" className="mt-3 text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {factures.length === 0 ? (
        <div className="mt-3 rounded-[4px] px-5 py-6 text-center" style={{ backgroundColor: colors.card }}>
          <p className="text-[14px]" style={{ color: colors.muted }}>
            Tout est réglé. Rien n&apos;attend son paiement.
          </p>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {factures.map((f) => (
            <li key={f.id} className="rounded-[4px] px-4 py-3" style={{ backgroundColor: colors.card }}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium" style={{ color: colors.ink }}>
                    {f.clientNom ?? "Client"}
                  </p>
                  <p className="text-[11.5px]" style={{ color: colors.muted }}>
                    {f.numeroCommercial} · émise le {enClair(f.dateEmission)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-medium" style={{ color: colors.ink, fontVariantNumeric: "tabular-nums" }}>
                    {euros(f.reste)}
                  </p>
                  {/* Un acompte déjà reçu se dit : sans cela, « 940 € » sur une
                      facture de 1 440 € se lirait comme une erreur de montant. */}
                  {f.etat === "partielle" && (
                    <p className="text-[11px]" style={{ color: colors.or }}>
                      reste sur {euros(f.totalTtc)}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={enCours === f.id}
                  onClick={() => solder(f.id)}
                  className="atlas-plein min-h-[40px] rounded-full px-5 py-2 text-[14px] font-medium disabled:opacity-40"
                  style={{ backgroundColor: colors.rust, color: colors.card }}
                >
                  {enCours === f.id ? "…" : "Payée"}
                </button>
                <button
                  type="button"
                  onClick={() => setOuverte(ouverte === f.id ? null : f.id)}
                  aria-expanded={ouverte === f.id}
                  className="min-h-[40px] px-2 py-2 text-[14px]"
                  style={{ color: colors.muted }}
                >
                  Noter un règlement
                </button>
              </div>

              {ouverte === f.id && (
                <SaisieDuReglement
                  facture={f}
                  aujourdHui={aujourdHui}
                  onErreur={setErreur}
                  onFini={() => {
                    setOuverte(null);
                    router.refresh();
                  }}
                />
              )}

              {f.paiements.length > 0 && (
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {f.paiements.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-[12px]" style={{ color: colors.muted }}>
                      <span className="flex-1">
                        {euros(p.montant)} le {enClair(p.date)}
                        {/* **Ce que la migration a SUPPOSÉ se dit.** Ces
                            règlements-là n'ont jamais été constatés : ils
                            existent pour que le relevé du trimestre passé ne
                            bouge pas. Les taire ferait passer une supposition
                            pour une observation. */}
                        {p.origine === "reprise" && " · supposé réglé à l'émission"}
                      </span>
                      <button
                        type="button"
                        aria-label={`Retirer le règlement de ${euros(p.montant)} du ${enClair(p.date)}`}
                        onClick={async () => {
                          await retirerPaiementAction(p.id);
                          router.refresh();
                        }}
                        // 36 px : une cible isolée dans un rang serré, visée du pouce.
                        className="flex h-9 w-9 flex-none items-center justify-center text-[15px]"
                        style={{ color: colors.muted }}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Un acompte : une date, un montant. Rien de plus n'entre au calcul. */
function SaisieDuReglement({
  facture,
  aujourdHui,
  onErreur,
  onFini,
}: {
  facture: FactureAttendue;
  aujourdHui: string;
  onErreur: (m: string | null) => void;
  onFini: () => void;
}) {
  const [date, setDate] = useState(aujourdHui < facture.dateEmission ? facture.dateEmission : aujourdHui);
  const [montant, setMontant] = useState(facture.reste);
  const [enCours, setEnCours] = useState(false);

  return (
    <div className="mt-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          min={facture.dateEmission}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date du règlement"
          className="min-w-0 flex-1 rounded-[4px] border-0 px-3 py-2.5 outline-none"
          style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
        />
        <input
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          inputMode="decimal"
          aria-label="Montant reçu, en euros"
          className="w-28 rounded-[4px] border-0 px-3 py-2.5 text-right outline-none"
          style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
        />
        <span className="text-[13px]" style={{ color: colors.muted }}>
          €
        </span>
      </div>
      <button
        type="button"
        disabled={enCours}
        onClick={async () => {
          setEnCours(true);
          onErreur(null);
          try {
            const r = await noterPaiementAction(facture.id, date, montant);
            if (!r.ok) onErreur(r.raison);
            else onFini();
          } catch {
            onErreur("Ce règlement n'a pas pu être enregistré. Réessayez.");
          } finally {
            setEnCours(false);
          }
        }}
        className="atlas-plein min-h-[44px] self-start rounded-full px-5 py-2.5 text-[14px] font-medium disabled:opacity-40"
        style={{ backgroundColor: colors.rust, color: colors.card }}
      >
        Enregistrer ce règlement
      </button>
      <p className="text-[12px] leading-snug" style={{ color: colors.muted }}>
        Un acompte se note comme un solde : seule la part reçue entre au relevé, le reste attend.
      </p>
    </div>
  );
}

/** « 2026-08-14 » → « 14 août 2026 ». Le patron ne lit pas de dates à l'envers. */
function enClair(iso: string): string {
  const [a, m, j] = iso.split("-").map(Number);
  const mois = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${j} ${mois[(m ?? 1) - 1]} ${a}`;
}

const formatEuros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
function euros(montant: string): string {
  return formatEuros.format(Number(montant || "0"));
}
