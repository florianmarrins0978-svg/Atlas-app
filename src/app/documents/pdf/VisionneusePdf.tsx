"use client";

import { useEffect, useRef, useState } from "react";
import { colors, spacing } from "@/lib/design-tokens";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";

/**
 * Peint un PDF page par page, dans l'application.
 *
 * **Pourquoi pas un `<iframe>`.** Sur iOS, un PDF dans un cadre ne montre que
 * sa première page et ne défile pas — un devis de trois pages y serait
 * illisible. pdf.js dessine chaque page sur une toile, et c'est l'écran qui
 * défile, comme n'importe quel autre.
 *
 * **Le fil de travail vient de `pdfjs-dist/webpack.mjs`**, et non d'une copie
 * dans `public/` : pdf.js refuse un fil dont la version n'est pas la sienne,
 * et une copie faite à la main ne suit pas les mises à jour du paquet.
 *
 * **Chargé à l'appui, jamais au départ.** La bibliothèque pèse plus que tout
 * le reste de l'écran ; elle n'est demandée que quand cet écran s'ouvre.
 */
export default function VisionneusePdf({ fichier }: { fichier: string }) {
  const pages = useRef<HTMLDivElement>(null);
  const [etat, setEtat] = useState<"en cours" | "peint" | { refus: string }>("en cours");

  useEffect(() => {
    const conteneur = pages.current;
    if (!conteneur) return;
    let abandonne = false;
    // En développement, React joue l'effet deux fois : sans ce vidage, chaque
    // page serait peinte en double.
    conteneur.replaceChildren();
    setEtat("en cours");

    (async () => {
      const reponse = await fetch(fichier, { credentials: "same-origin" });
      if (!reponse.ok) {
        // Le refus se DIT avec son code : « introuvable » et « session
        // expirée » ne se réparent pas au même endroit.
        setEtat({ refus: `Le document ne s'ouvre pas (réponse ${reponse.status}).` });
        return;
      }
      const octets = await reponse.arrayBuffer();
      const pdfjs = await import("pdfjs-dist/webpack.mjs");
      const document_ = await pdfjs.getDocument({ data: octets }).promise;
      if (abandonne) return;

      // La toile a la définition de l'écran (Retina : 2 ou 3 points par
      // pixel) ; sans quoi le texte d'une facture se lit flou. Sa largeur
      // affichée suit celle de l'écran en CSS, donc une rotation du téléphone
      // ne laisse pas une page étroite au milieu.
      const definition = window.devicePixelRatio || 1;
      const largeur = conteneur.clientWidth;
      for (let numero = 1; numero <= document_.numPages; numero++) {
        const page = await document_.getPage(numero);
        if (abandonne) return;
        const naturelle = page.getViewport({ scale: 1 });
        const vue = page.getViewport({ scale: (largeur / naturelle.width) * definition });
        const toile = document.createElement("canvas");
        toile.width = Math.ceil(vue.width);
        toile.height = Math.ceil(vue.height);
        toile.style.width = "100%";
        toile.style.height = "auto";
        toile.style.display = "block";
        toile.setAttribute("data-atlas", "page-pdf");
        toile.setAttribute("aria-label", `Page ${numero} sur ${document_.numPages}`);
        await page.render({ canvas: toile, viewport: vue }).promise;
        if (abandonne) return;
        conteneur.appendChild(toile);
      }
      setEtat("peint");
    })().catch((e: unknown) => {
      if (abandonne) return;
      setEtat({ refus: `Le document ne s'ouvre pas (${e instanceof Error ? e.message : String(e)}).` });
    });

    return () => {
      abandonne = true;
    };
  }, [fichier]);

  return (
    <div className={`${spacing.pageX} mt-5`}>
      {etat === "en cours" && (
        <p className="py-6 text-center text-[14px]" style={{ color: colors.muted }}>
          <PointsQuiSoufflent />
        </p>
      )}
      {typeof etat === "object" && (
        <p role="alert" data-atlas="refus-pdf" className="py-6 text-center text-[14px]" style={{ color: colors.alert }}>
          {etat.refus}
        </p>
      )}
      {/* Les pages, l'une sous l'autre, chacune avec l'ombre d'une feuille :
          le fond blanc de la toile ne suit aucune charte, c'est du papier. */}
      <div ref={pages} className="flex flex-col gap-3" style={{ filter: `drop-shadow(0 1px 3px ${colors.line})` }} />
    </div>
  );
}
