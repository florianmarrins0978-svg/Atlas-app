"use client";

import { useState, useTransition } from "react";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors, font, libelleCaps, surPlein, texteSituation } from "@/lib/design-tokens";
import { FORMULES, montantDu, type FormuleCode, type Periodicite } from "@/lib/abonnements";
import { sabonnerAction, ouvrirLeGuichetAction, changerDeFormuleAction } from "./actions";

/**
 * LES TROIS FORMULES — d'après sa planche du 9 septembre 2026,
 * `appli/choisir-son-abonnement.html`, qu'il a validée.
 *
 * **Les prix et les lignes viennent de `src/lib/abonnements.ts`**, jamais
 * recopiés ici : un tarif affiché qui ne serait pas le tarif débité est le
 * pire défaut que cet écran puisse produire.
 *
 * **Aucune flèche au bout des libellés** (`CLAUDE.md` §3), et le moins de mots
 * possible : chaque carte énumère ce qu'elle comprend, et rien d'autre.
 */
export default function AbonnementClient({
  formuleActuelle,
  periodiciteActuelle,
  paiementBranche,
}: {
  /** `null` quand il n'a pas d'abonnement. */
  formuleActuelle: FormuleCode | null;
  periodiciteActuelle: Periodicite | null;
  /** Faux tant que la clé du prestataire n'est pas posée : on le DIT. */
  paiementBranche: boolean;
}) {
  const [periodicite, setPeriodicite] = useState<Periodicite>(periodiciteActuelle ?? "mensuelle");
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function choisir(code: FormuleCode) {
    setMessage(null);
    demarrer(async () => {
      // **Deux gestes différents derrière le même bouton, et c'est voulu.**
      // Ouvrir une page de paiement pour qui est déjà abonné créerait un
      // SECOND abonnement, et il serait prélevé deux fois.
      const r = formuleActuelle
        ? await changerDeFormuleAction(code, periodicite)
        : await sabonnerAction(code, periodicite);
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      // Le changement de formule ne renvoie nulle part : il est fait, et
      // l'écran se recharge pour montrer le nouvel état.
      if (r.url) window.location.href = r.url;
      else window.location.reload();
    });
  }

  function guichet() {
    setMessage(null);
    demarrer(async () => {
      const r = await ouvrirLeGuichetAction();
      if (!r.ok) setMessage(r.message);
      else if (r.url) window.location.href = r.url;
    });
  }

  return (
    // **Aucun retrait en bas, et c'est la capture qui l'a montré.** Ce bloc en
    // portait un (`pb-24`) alors que le dernier paragraphe de l'écran en porte
    // déjà un : les deux s'ajoutaient, et laissaient trois cents pixels de vide
    // sous la dernière carte. Vert dans tous les tests, visible en une image
    // (`CLAUDE.md` §5).
    <div>
      {formuleActuelle && (
        <div className="mx-[26px] mt-[26px]">
          {/* **Éteint aussi quand le paiement n'est pas branché**, comme les
              trois cartes — vu à la capture : un bouton vert au-dessus de trois
              boutons gris promet quelque chose que l'écran vient de démentir
              deux lignes plus bas. */}
          <PrimaryButton onClick={guichet} disabled={enCours || !paiementBranche} repere="guichet-abonnement">
            Gérer mon abonnement
          </PrimaryButton>
          <p className={`mt-2.5 ${texteSituation}`} style={{ color: colors.inkSoft }}>
            Changer de carte, vos factures Atlas, résilier.
          </p>
        </div>
      )}

      <section className="mx-[26px] mt-[30px] border-t pt-[18px]" style={{ borderColor: colors.line }}>
        <p className={`mb-3 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
          {formuleActuelle ? "Changer de formule" : "Choisir une formule"}
        </p>

        <Bascule choisie={periodicite} choisir={setPeriodicite} />

        <div className="mt-4 flex flex-col gap-3">
          {FORMULES.map((f) => {
            const ici = f.code === formuleActuelle && periodicite === periodiciteActuelle;
            return (
              <article
                key={f.code}
                className="rounded-[4px] p-5"
                style={{
                  backgroundColor: colors.card,
                  border: `1px solid ${ici ? colors.plein : colors.line}`,
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 style={{ fontFamily: font.display, fontSize: 20, lineHeight: 1.2 }}>{f.nom}</h3>
                  <span style={{ fontFamily: font.display, fontSize: 20 }}>
                    {montantDu(f, periodicite)} €{" "}
                    <span className={texteSituation} style={{ color: colors.muted }}>
                      {periodicite === "annuelle" ? "/an HT" : "/mois HT"}
                    </span>
                  </span>
                </div>

                <p className={`mt-1 ${texteSituation}`} style={{ color: colors.inkSoft }}>
                  {f.accroche}
                </p>

                <ul className="mt-3.5 flex flex-col gap-1.5">
                  {f.compris.map((c) => (
                    <li
                      key={c.texte}
                      className={texteSituation}
                      style={{ color: c.neuf ? colors.ink : colors.inkSoft, fontWeight: c.neuf ? 500 : 400 }}
                    >
                      {c.texte}
                    </li>
                  ))}
                </ul>

                <div className="mt-4">
                  {ici ? (
                    <span className={libelleCaps} style={{ color: colors.plein }}>
                      Votre formule
                    </span>
                  ) : (
                    <PrimaryButton
                      onClick={() => choisir(f.code)}
                      disabled={enCours || !paiementBranche}
                      repere={`choisir-${f.code}`}
                    >
                      {formuleActuelle ? "Passer à cette formule" : "S’abonner"}
                    </PrimaryButton>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* **On DIT que le paiement n'est pas branché.** Un bouton éteint sans
          raison se lit comme une panne, et il rappuierait. */}
      {!paiementBranche && (
        <p className={`mx-[26px] mt-5 ${texteSituation}`} style={{ color: colors.inkSoft }}>
          Le paiement n’est pas encore branché : vous ne pouvez rien régler pour l’instant.
        </p>
      )}

      {message && (
        <p className={`mx-[26px] mt-5 ${texteSituation}`} style={{ color: colors.alert }} role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * Mensuel ou annuel. **Deux mois offerts sur l'année** — c'est ce que dit la
 * grille (290 au lieu de 348), et c'est le seul argument de cette bascule.
 */
function Bascule({ choisie, choisir }: { choisie: Periodicite; choisir: (p: Periodicite) => void }) {
  return (
    <div className="flex gap-2">
      {(["mensuelle", "annuelle"] as const).map((p) => {
        const active = p === choisie;
        return (
          <button
            key={p}
            type="button"
            onClick={() => choisir(p)}
            aria-pressed={active}
            className="rounded-full px-4 py-2.5 text-[13px]"
            style={{
              minHeight: 44,
              backgroundColor: active ? colors.plein : colors.card,
              color: active ? surPlein : colors.inkSoft,
              border: `1px solid ${active ? colors.plein : colors.line}`,
            }}
          >
            {p === "mensuelle" ? "Au mois" : "À l’année, 2 mois offerts"}
          </button>
        );
      })}
    </div>
  );
}
