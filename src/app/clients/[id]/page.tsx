import Link from "next/link";
import { notFound } from "next/navigation";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { jourNumerique } from "@/lib/jour";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { chargerFicheClient } from "@/server/repositories/fiche-client";

// **Ce que l'application sait déjà d'un client, enfin montré.**
//
// D'où ça vient : le patron, le 16 août 2026, photo d'un « graphe de
// connaissances » à l'appui — *« ça peut me servir pour mon appli ? »*. La
// réponse a été non pour le graphe, et oui pour ce qu'il y avait dessous :
// l'application SAIT qu'un client est venu quatre fois, qu'il doit encore
// 740 €, qu'on lui fait toujours de l'élagage — et elle ne le montrait nulle
// part. Arrangement **B** de `docs/maquettes/66`, qu'il a retenu.
//
// **Pourquoi B et pas un onglet.** Son seul avantage aurait été de répondre à
// « qui me doit de l'argent ? » — et cet écran EXISTE déjà (« En attente de
// paiement », dans Terminés → TVA). Un cinquième onglet aurait coûté de la
// place au pouce pour redire ce qui est là.
//
// **Rien ne s'invente ici.** Un client dont aucun chantier n'est facturé
// n'affiche pas « 0 € » : il affiche qu'il n'y a pas encore eu de facture.
// « 0 € » se lirait comme un mauvais client (`CLAUDE.md` §4).
export const dynamic = "force-dynamic";

export default async function FicheClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const fiche = await chargerFicheClient(ctx, id);
  if (!fiche) notFound();

  const coordonnees = [fiche.client.adresse, fiche.client.telephone].filter(Boolean).join(" · ");

  return (
    <div className="pb-[86px]">
      <EnTeteEcran
        retour={{ href: "/", libelle: "Retour à la liste des chantiers" }}
        surtitre="Client"
        titre={fiche.client.nom}
        precision={coordonnees || undefined}
      />

      <div className="px-[26px]">
        {/* ─── Les trois chiffres, en cases plutôt qu'en phrase ─────────────
            Une phrase se lit ; trois cases se voient. Il ouvre cet écran juste
            avant de rappeler quelqu'un, souvent d'une main. */}
        <div className="flex gap-2.5">
          <Case valeur={String(fiche.chantiers)} quoi={fiche.chantiers > 1 ? "chantiers" : "chantier"} />
          <Case
            valeur={fiche.facture === null ? "—" : enEuros(Number(fiche.facture))}
            quoi="facturés"
            faible={fiche.facture === null}
          />
          <Case
            valeur={fiche.du === null || Number(fiche.du) === 0 ? "—" : enEuros(Number(fiche.du))}
            // « Encore dus » se cassait en deux lignes dans sa case à 390 px —
            // vu à la capture, pas au test. « Reste dû » dit la même chose en
            // trois lettres de moins, et tient sur une ligne.
            quoi="reste dû"
            alerte={fiche.du !== null && Number(fiche.du) > 0}
            faible={fiche.du === null || Number(fiche.du) === 0}
          />
        </div>

        {/* **Rien n'est encore facturé : on le DIT.** Trois tirets sans un mot
            laisseraient croire à une donnée perdue. */}
        {fiche.facture === null && fiche.chantiers > 0 && (
          <p className="mt-2.5 text-[12.5px] leading-snug" style={{ color: colors.muted }}>
            Aucune facture émise pour l’instant — rien n’a encore été compté.
          </p>
        )}

        {fiche.prestations.length > 0 && (
          <>
            <p className={`mt-7 mb-1 ${libelleCaps}`} style={{ color: colors.muted }}>
              Ce qu’on lui fait, et combien de fois
            </p>
            {fiche.prestations.map((p) => (
              <div
                key={p.libelle}
                className="flex items-baseline justify-between gap-3 border-b py-[9px]"
                style={{ borderColor: colors.line }}
              >
                <span className="min-w-0 flex-1 truncate text-[14.5px]">{p.libelle}</span>
                {/* **Pas de prix tant qu'il n'y en a pas.** Une prestation
                    écrite mais pas encore chiffrée vaut 0,00 € en base — et
                    « 1 fois · 0,00 € » se lit comme un travail fait pour rien.
                    Le nombre de fois, lui, reste vrai. */}
                <span className="flex-none text-[12.5px]" style={{ color: colors.muted }}>
                  {p.fois} fois{Number(p.prixMoyen) > 0 ? ` · ${enEuros(Number(p.prixMoyen))}` : ""}
                </span>
              </div>
            ))}
          </>
        )}

        <p className={`mt-7 mb-1 ${libelleCaps}`} style={{ color: colors.muted }}>
          Ses chantiers
        </p>
        {fiche.liste.length === 0 ? (
          <p className="text-[13.5px] leading-relaxed" style={{ color: colors.muted }}>
            Aucun chantier pour ce client. C’est sa fiche, elle se remplira au premier.
          </p>
        ) : (
          fiche.liste.map((c) => (
            <Link
              key={c.id}
              href={`/chantiers/${c.id}`}
              className="flex items-baseline justify-between gap-3 border-b py-[11px]"
              style={{ borderColor: colors.line }}
            >
              <span className="min-w-0 flex-1 truncate" style={{ fontFamily: font.display, fontSize: 16 }}>
                {c.nom}
              </span>
              <span className="flex-none text-[12.5px]" style={{ color: colors.muted }}>
                {c.jour ? jourNumerique(c.jour) : "—"}
                {c.totalTtc !== null && ` · ${enEuros(Number(c.totalTtc))}`}
                {c.reste !== null && Number(c.reste) > 0 && (
                  <span style={{ color: colors.alert }}> — impayé</span>
                )}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Un chiffre et son mot.
 *
 * **`faible` sert au tiret**, pas à un zéro. Un montant absent s'écrit « — » en
 * gris : il n'a pas la même voix qu'un vrai montant, et surtout pas celle d'un
 * zéro.
 */
function Case({
  valeur,
  quoi,
  alerte = false,
  faible = false,
}: {
  valeur: string;
  quoi: string;
  alerte?: boolean;
  faible?: boolean;
}) {
  return (
    <span className="min-w-0 flex-1 rounded-[10px] px-[11px] py-2.5" style={{ backgroundColor: colors.card }}>
      <span
        className="block truncate"
        style={{
          fontFamily: font.display,
          fontSize: 18,
          lineHeight: 1.15,
          color: alerte ? colors.alert : faible ? colors.muted : colors.ink,
        }}
      >
        {valeur}
      </span>
      <span className={`mt-0.5 block ${libelleCaps}`} style={{ color: colors.muted }}>
        {quoi}
      </span>
    </span>
  );
}
