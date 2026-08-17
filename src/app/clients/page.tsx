import Link from "next/link";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerFichesClients } from "@/server/repositories/fiche-client";

// **La liste de ses clients — sa remarque du 17 août 2026 au soir.**
//
// *« La catégorie client n'a pas été créée. »* La FICHE d'un client existait
// depuis la veille (arrangement B de `docs/maquettes/66`), mais elle ne
// s'atteignait que depuis un chantier : il n'y avait aucun endroit d'où voir
// ses clients, ni retrouver celui qu'on a en tête sans se rappeler pour quel
// chantier on l'avait noté.
//
// **Sans cinquième onglet, et ce n'est pas un demi-choix.** La barre du bas en
// porte quatre, et le cinquième est déjà décidé pour les outils métier
// (`ARCHITECTURE.md` §125) ; à cinq colonnes sur 360 px, « CHANTIERS » déborde
// déjà. La liste s'ouvre donc depuis l'accueil, là où il est déjà.
//
// **Rien ne s'invente ici** : un client dont aucun chantier n'est facturé
// n'affiche pas « 0 € », il affiche qu'il n'y a pas encore eu de facture. Un
// zéro se lirait comme un mauvais payeur (`CLAUDE.md` §4).
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const ctx = await getCurrentCtx();
  const clients = await listerFichesClients(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-[86px]">
        <EnTeteEcran
          retour={{ href: "/", libelle: "Retour à la liste des chantiers" }}
          surtitre="Vos clients"
          titre={clients.length === 1 ? "1 client" : `${clients.length} clients`}
        />

        {clients.length === 0 ? (
          <p className="mx-[26px] mt-[26px] text-[13px] leading-[1.6]" style={{ color: colors.muted }}>
            Aucun client pour l&apos;instant. Ils naissent avec vos chantiers : le premier que vous créerez
            apparaîtra ici.
          </p>
        ) : (
          <ul className="mx-[26px] mt-[20px] flex flex-col">
            {clients.map((c, i) => (
              <li key={c.id}>
                <Link
                  href={`/clients/${c.id}`}
                  className="flex min-h-[56px] w-full items-center gap-[15px] py-[13px]"
                  style={i === clients.length - 1 ? undefined : { borderBottom: `1px solid ${colors.line}` }}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[17px] leading-[1.25]"
                      style={{ fontFamily: font.display, color: colors.ink }}
                    >
                      {c.nom}
                    </span>
                    <span className="mt-[3px] block text-[11.5px] leading-[1.5]" style={{ color: colors.muted }}>
                      {c.chantiers === 0
                        ? "aucun chantier"
                        : c.chantiers === 1
                          ? "1 chantier"
                          : `${c.chantiers} chantiers`}
                      {c.facture ? ` · ${enEuros(c.facture)} facturés` : " · rien de facturé"}
                    </span>
                  </span>

                  {/* Ce qui reste dû passe avant tout le reste : c'est la seule
                      chose qui demande un geste. Absent quand rien n'est dû —
                      un « 0 € » en face de chaque nom ferait un tableau de bord,
                      exactement ce qu'il refuse. */}
                  {c.du && Number(c.du) > 0 && (
                    <span className={`flex-none ${libelleCaps}`} style={{ color: colors.alert }}>
                      {enEuros(c.du)} dus
                    </span>
                  )}

                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rotate-45"
                    style={{
                      flex: "none",
                      borderRight: `1.5px solid ${colors.chevron}`,
                      borderTop: `1.5px solid ${colors.chevron}`,
                    }}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
