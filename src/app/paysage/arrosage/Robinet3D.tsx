"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { colors } from "@/lib/design-tokens";
import { departEn3D, type Depart } from "@/lib/arrosage/robinet";

/**
 * LA PILE DU ROBINET EN 3D, À L'ÉCRAN DU PLAN — sa planche
 * `appli/arrosage-robinet-3d.html` (« Parfait, tu peux faire toutes les autres
 * combinaisons »), puis son « Parfait, code ça » du 23 novembre 2026.
 *
 * Comme la nourrice (`Nourrice3D`), la 3D n'est pas recopiée ici : c'est le
 * module de la planche (`appli/robinet-3d/vue.js`), qui prend la scène et le
 * toucher de la nourrice. Un toucher éclate la pile, un second la remonte ; elle
 * se tourne au doigt.
 *
 * Ce qui change par rapport à la planche : rien ne se choisit ici. Le plan dit
 * le montage (le programmateur Solem au nez de robinet, ou rien quand la
 * nourrice reste), la double sortie (son interrupteur) et le départ. Le
 * programmateur de l'écran est le Solem BL-NR, le seul que le plan connaît.
 *
 * **Ce que la 3D ne montre pas** : une pièce changée ou supprimée dans la liste
 * reste dessinée telle qu'elle était proposée, comme sur la nourrice
 * (`TODO.md`). La liste dessous dit ce qui part.
 *
 * **Quand l'appareil ne sait pas afficher la 3D** (WebGL 2 absent, chargement
 * raté, une pile qui ne se compose pas), l'écran montre la pile en photos d'avant
 * (`repli`) : l'artisan garde son montage, plutôt qu'une phrase à la place.
 */
type Vue = "face" | "biais" | "";
type Choix = { programmateur: string | null; double: boolean; depart: "r16" | "s16" | "pe25" };
type RobinetOuvert = {
  montrer(choix: Choix): void;
  eclater(oui: boolean): void;
  regarder(vue: Vue): void;
  detruire(): void;
  surEtat(f: (e: { eclatee: boolean; vue: Vue }) => void): void;
  scene: { surImage(f: () => void): void };
};

const VUES: { cle: Exclude<Vue, "">; nom: string }[] = [
  { cle: "face", nom: "De face" },
  { cle: "biais", nom: "De biais" },
];

export default function Robinet3D({
  nez,
  double,
  depart,
  repli,
  onPrete,
}: {
  /** Au nez de robinet : le programmateur se visse sous le robinet. Sinon la nourrice reste, et rien ne s'y visse que le départ. */
  nez: boolean;
  double: boolean;
  depart: Depart;
  repli: ReactNode;
  /** La 3D s'affiche, ou la pile en photos la remplace. */
  onPrete: (oui: boolean) => void;
}) {
  const toile = useRef<HTMLCanvasElement>(null);
  const ouverte = useRef<RobinetOuvert | null>(null);
  const [etat, setEtat] = useState<"chargement" | "prete" | "repli">("chargement");
  const [eclatee, setEclatee] = useState(false);
  const [vue, setVue] = useState<Vue>("face");
  // Le dernier montage demandé : s'il change pendant le chargement, c'est lui que la scène pose.
  const programmateur = nez ? "solem" : null, depart3D = departEn3D(depart);
  const demande = useRef<Choix>({ programmateur, double, depart: depart3D });

  useEffect(() => {
    const canvas = toile.current;
    if (!canvas) return;
    let fini = false;
    import("../../../../appli/robinet-3d/vue.js")
      .then((m) => {
        if (fini) return;
        const v = m.ouvrirRobinet(canvas, {
          hdri: new URL("../../../../appli/vendor/hdri/studio.exr", import.meta.url).href,
        }) as RobinetOuvert;
        ouverte.current = v;
        v.surEtat((e) => {
          setEclatee(e.eclatee);
          setVue(e.vue);
        });
        v.montrer(demande.current);
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
        console.error("La pile du robinet en 3D ne s'affiche pas, les photos la remplacent :", erreur);
        if (!fini) setEtat("repli");
      });
    return () => {
      fini = true;
      ouverte.current?.detruire();
      ouverte.current = null;
    };
  }, []);

  useEffect(() => {
    if (etat !== "chargement") onPrete(etat === "prete");
  }, [etat, onPrete]);

  useEffect(() => {
    demande.current = { programmateur, double, depart: depart3D };
    const v = ouverte.current;
    if (!v) return;
    // Par une promesse, comme l'ouverture : un refus de recomposer prend le même chemin vers le repli.
    Promise.resolve()
      .then(() => v.montrer(demande.current))
      .catch((erreur: unknown) => {
        console.error("La pile du robinet en 3D ne se recompose pas, les photos la remplacent :", erreur);
        setEtat("repli");
      });
  }, [programmateur, double, depart3D]);

  if (etat === "repli") return <>{repli}</>;

  const bouton = (presse: boolean) => ({
    backgroundColor: presse ? colors.ink : colors.card,
    color: presse ? colors.card : colors.ink,
    boxShadow: `inset 0 0 0 1px ${presse ? colors.ink : colors.line}`,
  });

  return (
    <div data-atlas="robinet-3d" data-pret={etat === "prete"}>
      <div className="relative mt-[10px] w-full overflow-hidden rounded-[6px]" style={{ aspectRatio: "4 / 5", maxHeight: "76vh", backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
        <canvas
          ref={toile}
          tabIndex={0}
          role="img"
          aria-label="La pile du robinet en 3D. Un toucher l’éclate, un second la remonte."
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
            data-atlas={oui ? "robinet-eclater" : "robinet-monter"}
            onClick={() => ouverte.current?.eclater(oui)}
            className="min-h-[44px] min-w-0 flex-1 rounded-full border-0 text-[15px]"
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
            className="min-h-[44px] min-w-0 flex-1 rounded-full border-0 text-[15px]"
            style={bouton(vue === v.cle)}
          >
            {v.nom}
          </button>
        ))}
      </div>
    </div>
  );
}
