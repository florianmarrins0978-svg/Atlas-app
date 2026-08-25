"use client";

import { colors, font } from "@/lib/design-tokens";
import { jourLisibleCourt } from "@/lib/mois";
import { etatDemi, type Demi, type EtatDemi } from "@/lib/planning-jour";
import { fondDeLEtat } from "@/components/atlas/MoisCharge";
import type { ChantierPlanning } from "@/app/planning/PlanningClient";
import type { JourIso } from "@/server/disponibilites";

/**
 * LA FICHE DU JOUR REGARDÉ, sous le calendrier de l'écran d'envoi.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande du 22 août 2026**, validée sur planche 91 (`appli/choisir-la-
 * date.html`) : *« la possibilité de cliquer sur les jours pour voir quels
 * chantiers y sont déjà affectés — comme ça on peut savoir si oui ou non on
 * peut rajouter des clients sur les jours »*, puis *« cette maquette est
 * parfaite, tu peux coder ça trait pour trait, ne change rien »*.
 *
 * Le calendrier d'avant refusait un jour **sans jamais dire ce qui s'y
 * trouvait** : impossible de juger si l'on pouvait quand même s'y glisser.
 *
 * ─── Trois partis pris, tenus de la planche ───────────────────────────────
 *
 * 1. **Un chantier est nommé UNE fois**, ses demi-journées se lisent dessous.
 *    Deux lignes pour le même client se lisaient comme deux chantiers — sa
 *    correction du 21 août, sur le planning.
 * 2. **Elle ne se manipule pas** — et depuis le 25 août 2026, plus du tout.
 *    Elle portait « Proposer ce jour » ; sa demande — *« je dois pouvoir
 *    sélectionner les jours juste en les touchant, pas besoin de cliquer sur
 *    proposer »* — l'a rendue à son seul rôle : DIRE ce qu'il y a ce jour-là.
 *    C'est la case du calendrier qui engage la date, et elle seule : deux
 *    endroits pour le même geste, et l'on ne sait plus lequel fait foi.
 * 3. **Le verdict est celui du serveur**, jamais recalculé ici : proposer un
 *    jour que l'envoi refuserait ensuite coûte un aller-retour avec le client.
 * ───────────────────────────────────────────────────────────────────────────
 */
export default function JourneeRegardee({
  jour,
  occupationDe,
  nomEquipe,
  verdict,
  dejaRetenu,
}: {
  jour: JourIso;
  occupationDe: (jour: JourIso, demi: Demi) => { pris: readonly unknown[]; charge: number };
  /** Le nom d'une équipe par son rang — la MÊME fonction que le planning. */
  nomEquipe: (rang: number) => string;
  /** Ce que le serveur répond pour CE jour : `null` tant qu'il n'a pas répondu. */
  verdict: { retenable: boolean; raison: string | null } | null;
  dejaRetenu: boolean;
}) {
  // **Un samedi se regarde et se propose comme un mardi.** Sa règle du 23 août
  // 2026 : *« s'il a des salariés qui font des extras, il doit pouvoir
  // sélectionner ces deux jours »*. Cette fiche répondait « Jamais proposé. »
  // et s'arrêtait là — alors que `jourRetenable` accepte le week-end depuis
  // toujours. C'était l'écran qui interdisait ce que la règle permettait.
  //
  // L'avertissement demeure, et il suffit : `verifierJourPropose` rend
  // « C'est un week-end — vous pouvez le proposer, mais vérifiez que c'est
  // voulu », qui s'affiche juste sous ce bloc.

  // Un chantier occupe souvent les deux demi-journées : on le nomme une fois.
  const parNom: { chantier: ChantierPlanning; demies: Demi[] }[] = [];
  for (const demi of ["matin", "apres_midi"] as Demi[]) {
    for (const c of occupationDe(jour, demi).pris as ChantierPlanning[]) {
      const deja = parNom.find((b) => b.chantier.id === c.id);
      if (deja) deja.demies.push(demi);
      else parNom.push({ chantier: c, demies: [demi] });
    }
  }

  const nomDe = (c: ChantierPlanning) => c.clientNom ?? c.nom;
  const equipeDe = (c: ChantierPlanning, demi: Demi) => {
    const rangs = demi === "matin" ? c.equipes.matin : c.equipes.apres_midi;
    if (rangs.length === 0) return "—";
    return rangs.map((r) => nomEquipe(r)).join(" · ");
  };

  return (
    <Cadre jour={jour}>
      {parNom.length === 0 ? (
        <p className="m-0 text-center text-[13px]" style={{ color: colors.muted }}>
          Personne. La journée est entière.
        </p>
      ) : (
        parNom.map(({ chantier, demies }) => (
          <div key={chantier.id} className="mb-3 last:mb-0">
            <p className="m-0 text-[18px] leading-tight" style={{ fontFamily: font.display }}>
              {nomDe(chantier)}
              {chantier.adresseChantier && (
                <span className="block text-[12.5px] leading-snug" style={{ color: colors.muted }}>
                  {chantier.adresseChantier}
                </span>
              )}
            </p>
            {demies.map((d) => (
              <div key={d} className="mt-[7px] flex items-center gap-2">
                <span
                  className="w-[74px] flex-shrink-0 text-[10px] font-semibold uppercase leading-[1.15]"
                  style={{ letterSpacing: "0.06em", color: colors.ink }}
                >
                  {d === "matin" ? "Matin" : "Après-midi"}
                </span>
                <span
                  className="flex-shrink-0 whitespace-nowrap rounded-full px-[11px] py-[5px] text-[12.5px]"
                  style={{ backgroundColor: colors.rust, color: colors.card }}
                >
                  {equipeDe(chantier, d)}
                </span>
              </div>
            ))}
          </div>
        ))
      )}

      {(["matin", "apres_midi"] as Demi[]).map((d) => {
        const o = occupationDe(jour, d);
        return (
          <div key={`compte-${d}`} className="mt-2 flex items-center gap-2">
            <span
              className="w-[74px] flex-shrink-0 text-[10px] font-semibold uppercase leading-[1.15]"
              style={{ letterSpacing: "0.06em", color: colors.ink }}
            >
              {d === "matin" ? "Matin" : "Après-midi"}
            </span>
            <Pastille etat={etatDemi(o)} />
            <span className="ml-auto text-[12px]" style={{ color: colors.muted }}>
              {compteLisible(o)}
            </span>
          </div>
        );
      })}

      {/* Le verdict pour CE chantier-ci : ce que le calendrier nu ne disait
          pas. Tant que le serveur n'a pas répondu, on ne promet rien. */}
      <div
        className="mt-3.5 flex items-center gap-2.5 pt-3"
        style={{ borderTop: `1px solid ${colors.lineSoft}` }}
        data-atlas="verdict-du-jour"
      >
        <span
          className="flex-1 text-[13px] leading-snug"
          // **Un avertissement se VOIT, sinon ce n'est pas un avertissement.**
          //
          // Depuis sa règle du 23 août 2026 — *« si l'utilisateur juge qu'il
          // peut rajouter un chantier, il doit pouvoir le faire quand même »* —
          // un jour plein rend `retenable: true` : il est signalé, plus refusé.
          // La couleur, elle, ne regardait que `retenable` : « ce jour est
          // complet » passait donc en gris doux, la teinte des notes de bas de
          // page, sur la seule phrase qu'il ne faut pas manquer avant d'envoyer.
          //
          // Le gris reste pour ce qui ne l'engage à rien — « il reste de la
          // place », la remarque du week-end.
          style={{
            color:
              verdict && (!verdict.retenable || /complet/i.test(verdict.raison ?? ""))
                ? colors.bordeaux
                : colors.inkSoft,
          }}
        >
          {!verdict
            ? "Vérification de votre planning…"
            : verdict.raison
              ? verdict.raison
              : dejaRetenu
                ? "Ce jour est proposé à votre client."
                : "Il reste de la place."}
        </span>
        {/* **Plus un bouton, un ÉTAT** — sa demande du 25 août 2026 : *« je dois
            pouvoir sélectionner les jours juste en les touchant, pas besoin de
            cliquer sur proposer »*. La case du calendrier engage la date ; il
            reste à DIRE ici que ce jour-là est engagé, car la phrase de gauche
            appartient au serveur et cède la place à un avertissement dès qu'il
            y en a un. Sans ce mot, un jour proposé ET signalé complet ne se
            lisait plus que par la teinte de sa case. */}
        {dejaRetenu && (
          <span
            data-atlas="jour-propose"
            className="flex-shrink-0 text-[11px] font-semibold uppercase leading-none"
            style={{ letterSpacing: "0.12em", color: colors.rust }}
          >
            proposé
          </span>
        )}
      </div>
    </Cadre>
  );
}

function Cadre({ jour, children }: { jour: JourIso; children: React.ReactNode }) {
  return (
    <div
      data-atlas="journee-regardee"
      // **`data-journee`, et non `data-jour`.** Les cases du calendrier portent
      // déjà `data-jour` : les deux ensemble rendaient DEUX éléments pour le
      // même jour, et une suite qui touche « le 3 août » ne savait plus lequel
      // viser. Trouvé le 22 août 2026, par la suite elle-même.
      data-journee={jour}
      className="mt-4 rounded-[10px] px-[15px] py-[14px]"
      style={{ background: colors.card }}
    >
      <p
        className="mb-3.5 text-center text-[12.5px] font-bold uppercase leading-none"
        style={{ letterSpacing: "0.14em", color: colors.ink }}
      >
        {jourLisibleCourt(jour)}
      </p>
      {children}
    </div>
  );
}

function Pastille({ etat }: { etat: EtatDemi }) {
  return (
    <i
      className="inline-block h-[11px] w-[11px] flex-shrink-0 rounded-[3px]"
      style={
        etat === "libre"
          ? { background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }
          : { background: fondDeLEtat(etat) }
      }
    />
  );
}

/** Le même compte que le planning, mot pour mot — deux formules divergeraient. */
function compteLisible(o: { pris: readonly unknown[]; charge: number }): string {
  if (o.pris.length === 0) return "libre";
  const chantiers = `${o.pris.length} chantier${o.pris.length > 1 ? "s" : ""}`;
  if (o.charge > 1) return `${chantiers} · ${Math.round(o.charge * 100)} % de vos équipes`;
  if (o.charge === 1) return `${chantiers} · complet`;
  return chantiers;
}
