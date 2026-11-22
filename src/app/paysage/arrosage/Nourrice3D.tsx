"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { colors } from "@/lib/design-tokens";
import { CATALOGUE } from "@/lib/arrosage/catalogue.js";

/**
 * LA NOURRICE EN 3D, À L'ÉCRAN DU PLAN — sa demande du 22 novembre 2026 :
 * *« j'aimerais que tu me mettes exactement cette planche dans l'application
 * [...] quand je clique, on a les pièces qui s'éclatent, je reclique, ça se
 * remet en place. Pouvoir le déplacer, zoomer. »*
 *
 * La 3D n'est pas recopiée ici : c'est le module de la planche
 * (`appli/nourrice-3d/vue.js`), le même que montre la page des outils du site.
 * Trois copies d'une pièce relevée au dixième de millimètre auraient divergé à
 * la première retouche (`CLAUDE.md` §3). Il vit dans `appli/` parce que GitHub
 * Pages ne publie que ce dossier ; ses modules de three importent `three`, qui
 * se résout ici dans `node_modules` à la même version (0.160.0, épinglée).
 *
 * Ce qui change par rapport à la planche : le nombre de voies et le
 * goutte-à-goutte viennent du plan, ils ne se choisissent pas ici.
 *
 * **Quand l'appareil ne sait pas afficher la 3D** (WebGL 2 absent, chargement
 * raté), l'écran montre le dessin d'avant (`repli`) : l'artisan garde sa
 * nourrice, plutôt qu'une phrase à la place.
 */
type Vue = "biais" | "dessus" | "face" | "";
type NourriceOuverte = {
  montrer(voies: number, goutte: number): unknown;
  eclater(oui: boolean): void;
  regarder(vue: Vue): void;
  detruire(): void;
  surEtat(f: (e: { eclatee: boolean; vue: Vue }) => void): void;
  scene: { surImage(f: () => void): void };
};

const CAT = CATALOGUE as unknown as { ficheNourrice(n: number, goutte: number): unknown };

const VUES: { cle: Exclude<Vue, "">; nom: string }[] = [
  { cle: "biais", nom: "De biais" },
  { cle: "dessus", nom: "Dessus" },
  { cle: "face", nom: "De face" },
];

export default function Nourrice3D({ voies, nbGoutte, repli }: { voies: number; nbGoutte: number; repli: ReactNode }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const ouverte = useRef<NourriceOuverte | null>(null);
  const [etat, setEtat] = useState<"chargement" | "prete" | "repli">("chargement");
  const [eclatee, setEclatee] = useState(false);
  const [vue, setVue] = useState<Vue>("biais");
  // Les dernières voies demandées : si elles changent pendant le chargement, c'est elles que la scène pose.
  const demandees = useRef({ voies, nbGoutte });

  useEffect(() => {
    const canvas = toile.current;
    if (!canvas) return;
    let fini = false;
    import("../../../../appli/nourrice-3d/vue.js")
      .then((m) => {
        if (fini) return;
        const v = m.ouvrirNourrice(canvas, {
          ficheNourrice: CAT.ficheNourrice,
          hdri: new URL("../../../../appli/vendor/hdri/studio.exr", import.meta.url).href,
        }) as NourriceOuverte;
        ouverte.current = v;
        v.surEtat((e) => {
          setEclatee(e.eclatee);
          setVue(e.vue);
        });
        v.montrer(demandees.current.voies, demandees.current.nbGoutte);
        let vue = false;
        v.scene.surImage(() => {
          if (vue) return;
          vue = true;
          setEtat("prete");
        });
      })
      .catch((erreur: unknown) => {
        // Une panne imprévue se journalise avant de se replier : sans quoi le
        // repli serait muet, et personne ne saurait pourquoi la 3D manque.
        console.error("La nourrice en 3D ne s'affiche pas, le dessin la remplace :", erreur);
        if (!fini) setEtat("repli");
      });
    return () => {
      fini = true;
      ouverte.current?.detruire();
      ouverte.current = null;
    };
  }, []);

  useEffect(() => {
    demandees.current = { voies, nbGoutte };
    const v = ouverte.current;
    if (!v) return;
    // Par une promesse, comme l'ouverture : un refus de recomposer prend le même chemin vers le repli.
    Promise.resolve()
      .then(() => v.montrer(voies, nbGoutte))
      .catch((erreur: unknown) => {
        console.error("La nourrice en 3D ne se recompose pas, le dessin la remplace :", erreur);
        setEtat("repli");
      });
  }, [voies, nbGoutte]);

  if (etat === "repli") return <>{repli}</>;

  const bouton = (presse: boolean) => ({
    backgroundColor: presse ? colors.ink : colors.card,
    color: presse ? colors.card : colors.ink,
    boxShadow: `inset 0 0 0 1px ${presse ? colors.ink : colors.line}`,
  });

  return (
    <div data-atlas="nourrice-3d" data-pret={etat === "prete"}>
      <div className="relative w-full overflow-hidden rounded-[6px]" style={{ aspectRatio: "4 / 5", maxHeight: "76vh", backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
        <canvas
          ref={toile}
          tabIndex={0}
          role="img"
          aria-label="La nourrice en 3D. Un toucher l’éclate, un second la remonte."
          className="block h-full w-full outline-none"
          style={{ touchAction: "none", cursor: "grab", WebkitTapHighlightColor: "transparent" }}
        />
        <div
          role="status"
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[14px] transition-opacity duration-300"
          style={{ backgroundColor: colors.card, color: colors.inkSoft, opacity: etat === "prete" ? 0 : 1 }}
        >
          Chargement
        </div>
      </div>

      <div className="mt-3 flex gap-1.5" role="group" aria-label="Montage">
        {[false, true].map((oui) => (
          <button
            key={String(oui)}
            type="button"
            aria-pressed={eclatee === oui}
            data-atlas={oui ? "nourrice-eclater" : "nourrice-monter"}
            onClick={() => ouverte.current?.eclater(oui)}
            className="min-h-[44px] min-w-0 flex-1 rounded-[10px] border-0 text-[15px]"
            style={bouton(eclatee === oui)}
          >
            {oui ? "Éclatée" : "Montée"}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Point de vue">
        {VUES.map((v) => (
          <button
            key={v.cle}
            type="button"
            aria-pressed={vue === v.cle}
            onClick={() => ouverte.current?.regarder(v.cle)}
            className="min-h-[44px] min-w-0 flex-1 rounded-[10px] border-0 text-[15px]"
            style={bouton(vue === v.cle)}
          >
            {v.nom}
          </button>
        ))}
      </div>
    </div>
  );
}
