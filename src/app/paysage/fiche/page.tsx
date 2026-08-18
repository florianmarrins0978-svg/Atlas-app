import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerPassages } from "@/server/repositories/passages-entretien";
import { listerPrestations } from "@/server/repositories/prestations-entretien";
import { libelleMinutes } from "@/lib/passage-entretien";
import { jourLisible } from "@/lib/jour";
import OuvrirFiche from "./OuvrirFiche";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fiche de chantier — Atlas" };

/**
 * « Fiche de chantier » — ce qu'il retrouve en ouvrant l'outil.
 *
 * **Cet écran existe parce qu'une fiche ne s'ouvre PAS toute seule.** Créer un
 * passage à la simple ouverture d'une page écrirait une fiche en base parce que
 * quelqu'un a appuyé sur un onglet — et lui en laisserait douze vides au bout
 * d'une semaine. C'est la même règle que le modèle fourni, qui ne se pose qu'au
 * geste (`prestations-entretien.ts`).
 *
 * **Les brouillons d'abord.** Une fiche laissée en plan hier soir est ce qu'il
 * vient chercher ; les rapports partis, eux, se consultent.
 */
export default async function FichesPage() {
  const ctx = await getCurrentCtx();
  const [passages, modele] = await Promise.all([listerPassages(ctx), listerPrestations(ctx)]);

  const brouillons = passages.filter((p) => p.envoyeLe === null);
  const partis = passages.filter((p) => p.envoyeLe !== null);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-10" data-atlas="ecran-fiches-chantier">
        <EnTeteEcran
          surtitre="Outils du métier"
          titre="Fiche de chantier"
          retour={{ href: "/paysage", libelle: "Retour à Paysage" }}
        />

        <section className="mx-[26px] mt-[22px]">
          {/* **Le modèle vide se dit ICI, avant le bouton.** Ouvrir une fiche
              sans une seule ligne à cocher donnerait un écran blanc : autant
              l'envoyer composer sa fiche, qui est le geste qui manque. */}
          {modele.length === 0 ? (
            <div
              className="rounded-[18px] px-[18px] py-[16px]"
              style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}` }}
            >
              <p className="text-[13.5px] leading-[1.6]" style={{ color: colors.inkSoft }}>
                Votre fiche n&apos;a encore aucune prestation. Composez-la une fois, dans les
                réglages : elle servira à tous vos passages.
              </p>
              <Link
                href="/reglages/fiche-entretien"
                className="mt-[12px] inline-block text-[13px] font-semibold"
                style={{ color: colors.rust }}
              >
                Composer ma fiche →
              </Link>
            </div>
          ) : (
            <OuvrirFiche />
          )}
        </section>

        {brouillons.length > 0 && (
          <section className="mx-[26px] mt-[28px]">
            <h2 className={smallCaps} style={{ color: colors.muted }}>
              En cours
            </h2>
            <div className="mt-[10px]">
              {brouillons.map((p) => (
                <LignePassage key={p.id} passage={p} />
              ))}
            </div>
          </section>
        )}

        {partis.length > 0 && (
          <section className="mx-[26px] mt-[28px]">
            <h2 className={smallCaps} style={{ color: colors.muted }}>
              Rapports envoyés
            </h2>
            <div className="mt-[10px]">
              {partis.map((p) => (
                <LignePassage key={p.id} passage={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function LignePassage({
  passage,
}: {
  passage: {
    id: string;
    jour: string;
    clientNom: string | null;
    envoyeLe: Date | null;
    minutes: number | null;
    faites: number;
  };
}) {
  // « 3 prestations · 1 h 40 » — ce qui distingue deux fiches du même jour.
  const bouts = [
    `${passage.faites} prestation${passage.faites > 1 ? "s" : ""}`,
    passage.minutes !== null ? libelleMinutes(passage.minutes) : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/paysage/fiche/${passage.id}`}
      className="flex min-h-[56px] w-full items-center gap-[15px] border-b py-[13px] text-left"
      style={{ borderColor: colors.line }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] leading-[1.25]" style={{ fontFamily: font.display }}>
          {passage.clientNom ?? "Sans client"}
        </span>
        <span className="mt-[3px] block text-[11.5px] leading-[1.5]" style={{ color: colors.muted }}>
          {jourLisible(passage.jour)} · {bouts.join(" · ")}
        </span>
      </span>
      {passage.envoyeLe === null ? (
        <span className={libelleCaps} style={{ color: colors.or, opacity: 0.9, flex: "none" }}>
          Brouillon
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="h-2 w-2 rotate-45"
          style={{
            flex: "none",
            borderRight: `1.5px solid ${colors.chevron}`,
            borderTop: `1.5px solid ${colors.chevron}`,
          }}
        />
      )}
    </Link>
  );
}
