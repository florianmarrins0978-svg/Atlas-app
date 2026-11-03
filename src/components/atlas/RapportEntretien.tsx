import type { RapportPublic } from "@/server/repositories/passages-entretien";
import { libelleMinutes } from "@/lib/passage-entretien";
import { parFamilles } from "@/lib/prestations-entretien";
import { jourEnTitre } from "@/lib/jour";
import { colors, font, voile } from "@/lib/design-tokens";
import { CocheFaite, TeteDeLettre } from "./LettreDuClient";
import IconeTrait from "./IconeTrait";

/**
 * Le rapport de passage, tel que le CLIENT le reçoit.
 *
 * **Une seule carte pour deux écrans** : la page du client
 * (`/entretien/<jeton>`) et celle où l'artisan le relit dans l'application
 * (`rapport-dans-l-appli.ts`). Recopiée, la carte de l'artisan aurait fini par
 * montrer autre chose que ce que son client a lu (`CLAUDE.md` §3).
 *
 * **La lettre de l'artisan — sa planche du 31 octobre 2026**
 * (`appli/soignee/client-recoit.html`) : « Retour d'intervention » passe du
 * surtitre doré au grand titre, ses initiales à côté, comme le devis et le
 * contrat. Ce qui a été fait se lit par famille, une coche verte par ligne ;
 * le temps passé et les observations ferment la page. Les couleurs passent par
 * les jetons : la page du client n'en reçoit aucune et retombe sur celles
 * d'Atlas, l'écran de l'artisan suit sa charte.
 */
export default function RapportEntretien({ rapport }: { rapport: RapportPublic }) {
  const familles = parFamilles(rapport.faites);

  return (
    <div className="mx-auto w-full max-w-md" data-atlas="rapport-entretien" style={{ color: colors.ink }}>
      <TeteDeLettre titre="Retour d'intervention" nom={rapport.entrepriseNom} />
      <p className="mt-1.5 text-[14.5px] font-semibold leading-[1.4]">{rapport.entrepriseNom}</p>
      {/* **Une phrase, en noir, le jour en gras** — sa demande du
          22 septembre 2026 : plus de point médian entre la date et le nom
          (`CLAUDE.md` §3). **L'année s'écrit toujours** (25 septembre 2026) :
          le client garde ce rapport, et le relit l'année suivante, où « jeudi
          17 septembre » ne désigne plus rien. */}
      <p className="mt-px text-[14.5px] leading-[1.4]">
        <b className="font-semibold">{jourEnTitre(rapport.jour)}</b>
        {rapport.clientNom ? ` chez ${rapport.clientNom}` : ""}
      </p>

      {familles.map((groupe, rang) => (
        <section key={groupe.famille}>
          <h2
            className={`${rang === 0 ? "mt-[26px]" : "mt-7"} mb-2.5 text-[13px] font-semibold uppercase tracking-[0.12em]`}
            /* Un h2 prend la serif des titres par défaut : la rubrique est un mot
               de rangement, pas un titre. */
            style={{ color: colors.inkSoft, fontFamily: font.body }}
          >
            {groupe.famille}
          </h2>
          <ul className="rounded-md px-[18px] py-1" style={{ backgroundColor: colors.card }}>
            {groupe.lignes.map((l, i) => (
              <li
                key={l.libelle}
                data-atlas="ligne-faite"
                className={`flex min-h-11 items-center gap-3 py-1.5 text-[16px] leading-[1.35] ${i > 0 ? "border-t" : ""}`}
                style={{ borderColor: colors.lineSoft }}
              >
                <CocheFaite />
                <span>{l.libelle}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {rapport.minutes !== null && (
        <p className="mt-6 flex items-center gap-3 rounded-md p-[18px]" style={{ backgroundColor: colors.card }}>
          <span style={{ color: colors.or }}>
            <IconeTrait nom="horloge" taille={22} epaisseur={1.8} />
          </span>
          <span className="flex-1 text-[15px]" style={{ color: colors.inkSoft }}>
            Temps passé
          </span>
          <b className="text-[22px] font-normal leading-none" style={{ fontFamily: font.display, fontVariantNumeric: "tabular-nums lining-nums" }}>
            {libelleMinutes(rapport.minutes)}
          </b>
        </p>
      )}
      {/* Les observations, sur une plage dorée et en serif : c'est le mot de
          l'artisan, la seule chose de la page qu'il a écrite lui-même. */}
      {rapport.observations && (
        <p
          className="mt-4 rounded-md px-4 py-[13px] text-[17px] leading-[1.55]"
          style={{ backgroundColor: voile(colors.or, 0.13), fontFamily: font.display }}
        >
          {rapport.observations}
        </p>
      )}
    </div>
  );
}
