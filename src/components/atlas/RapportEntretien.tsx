import type { RapportPublic } from "@/server/repositories/passages-entretien";
import { libelleMinutes } from "@/lib/passage-entretien";
import { parFamilles } from "@/lib/prestations-entretien";
import { jourEnTitre } from "@/lib/jour";
import { couleursDocument } from "@/lib/design-tokens";

/**
 * Le rapport de passage, tel que le CLIENT le reçoit.
 *
 * **Une seule carte pour deux écrans** : la page du client
 * (`/entretien/<jeton>`) et celle où l'artisan le relit dans l'application
 * (`rapport-dans-l-appli.ts`). Recopiée, la carte de l'artisan aurait fini par
 * montrer autre chose que ce que son client a lu (`CLAUDE.md` §3).
 */
export default function RapportEntretien({ rapport }: { rapport: RapportPublic }) {
  const familles = parFamilles(rapport.faites);

  return (
    <div
      className="mx-auto w-full max-w-md rounded-2xl bg-white px-6 py-7 shadow-sm"
      data-atlas="rapport-entretien"
      style={{ color: couleursDocument.encre }}
    >
      {/* Centré et doré, sa demande du 22 septembre 2026 : l'or des
          documents (`couleursDocument.accent`), pas celui de la charte, qui
          changerait avec les réglages de l'artisan. */}
      <p
        className="text-center text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: couleursDocument.accent }}
      >
        Retour d&apos;intervention
      </p>
      <h1 className="mt-2 text-[21px]" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
        {rapport.entrepriseNom}
      </h1>
      {/* **Une phrase, en noir, le jour en gras** — sa demande du
          22 septembre 2026 : plus de point médian entre la date et le nom
          (`CLAUDE.md` §3, « ni point médian, ni tiret : des phrases »).
          **L'année y est toujours** (25 septembre 2026, « ça serait bien
          d'avoir l'année aussi ») : le client garde ce rapport, et le relit
          l'année suivante, où « jeudi 17 septembre » ne désigne plus rien. */}
      <p className="mt-1 text-[14px]" style={{ color: couleursDocument.encre }}>
        <b>{jourEnTitre(rapport.jour)}</b>
        {rapport.clientNom ? ` chez ${rapport.clientNom}` : ""}
      </p>

      <div className="mt-6">
        {familles.map((groupe) => (
          <section key={groupe.famille} className="mt-5 first:mt-0">
            <h2
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: couleursDocument.etiquette }}
            >
              {groupe.famille}
            </h2>
            <ul className="mt-2">
              {groupe.lignes.map((l) => (
                <li key={l.libelle} className="flex gap-2 py-[5px] text-[15px] leading-[1.4]">
                  <span aria-hidden="true" style={{ color: couleursDocument.etiquette }}>
                    ✓
                  </span>
                  <span>{l.libelle}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {rapport.minutes !== null && (
        <p
          className="mt-6 border-t pt-4 text-[14px]"
          style={{ borderColor: "rgba(28,28,26,0.12)", color: couleursDocument.etiquette }}
        >
          Temps passé&nbsp;: <b style={{ color: couleursDocument.encre }}>{libelleMinutes(rapport.minutes)}</b>
        </p>
      )}

      {rapport.observations && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-[14px] leading-[1.6]"
          style={{ backgroundColor: "#F7F5F0" }}
        >
          {rapport.observations}
        </div>
      )}
    </div>
  );
}
