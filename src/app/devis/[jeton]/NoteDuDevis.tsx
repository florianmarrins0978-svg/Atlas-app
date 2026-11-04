"use client";

import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import IconeTrait from "@/components/atlas/IconeTrait";
import { colors, font, voile } from "@/lib/design-tokens";

/**
 * LA NOTE DE L'ARTISAN, SUR LA PAGE DU CLIENT — sa planche du 3 novembre 2026
 * (`appli/soignee/devis-note-client.html`), tranchée le 4 : en A, juste avant
 * « J'accepte ce devis ».
 *
 * **Pourquoi elle existe.** Ce que le patron écrit dans « Notes / conditions »
 * ne partait que sur le PDF : le client acceptait le devis depuis cette page
 * sans l'avoir lu, sauf à télécharger le document. Une consigne comme
 * « libérez la place de parking le jour de l'intervention » n'arrivait donc
 * jamais à celui qui devait la suivre.
 *
 * **Deux lignes au plus**, parce que la page doit tenir dans 390 × 664 (sa
 * règle du 31 octobre). Coupée, elle s'ouvre en entier d'un appui, dans la
 * feuille de la maison : une note dont la fin disparaîtrait sans moyen de la
 * lire cacherait au client ce que l'artisan lui demande. Le chevron et l'appui
 * ne paraissent que si elle est RÉELLEMENT coupée, mesuré sur le texte posé.
 */
export default function NoteDuDevis({ note }: { note: string }) {
  const texte = useRef<HTMLParagraphElement>(null);
  const [coupee, setCoupee] = useState(false);
  const [ouverte, setOuverte] = useState(false);

  // Mesuré après la mise en page, et à chaque changement de largeur : une
  // note qui tient en portrait peut ne plus tenir à 360 px, et l'inverse.
  useLayoutEffect(() => {
    const p = texte.current;
    if (!p) return;
    // **Mesurée SANS la coupe, puis comparée.** Coupé par `line-clamp`, le
    // texte ne déborde pas aux yeux du navigateur : `scrollHeight` y vaut
    // `clientHeight`, et la note longue restait coupée sans s'ouvrir (vu sur
    // l'écran le 4 novembre 2026, sa fin cachée au client). La coupe se lève
    // le temps d'une lecture, dans la même image : rien ne clignote.
    const mesurer = () => {
      const coupe = p.clientHeight;
      // Rendues telles qu'écrites par React (`style` ci-dessous) : les vider
      // lèverait la coupe pour de bon.
      const { webkitLineClamp, display } = p.style;
      p.style.webkitLineClamp = "unset";
      p.style.display = "block";
      const entiere = p.scrollHeight;
      p.style.webkitLineClamp = webkitLineClamp;
      p.style.display = display;
      setCoupee(entiere > coupe + 1);
    };
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(p);
    return () => observateur.disconnect();
  }, [note]);

  const contenu = (
    <>
      <span className="flex-none" style={{ color: colors.orTexte }} aria-hidden>
        <IconeTrait nom="note" taille={20} />
      </span>
      <p
        ref={texte}
        className="min-w-0 flex-1 text-[14px] leading-[1.36]"
        style={{ color: colors.ink, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        <strong className="font-bold" style={{ color: colors.orTexte }}>
          À savoir :
        </strong>{" "}
        {note}
      </p>
      {coupee && (
        <span className="flex-none" style={{ color: colors.orTexte }} aria-hidden>
          <IconeTrait nom="suivant" taille={18} epaisseur={2} />
        </span>
      )}
    </>
  );

  const style: React.CSSProperties = { backgroundColor: voile(colors.or, 0.13) };
  const classe = "mt-1.5 flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2";

  // **Le même élément, coupée ou non** — et c'est ce qui la fait marcher.
  // Basculer d'un `div` à un `button` remplaçait le texte mesuré : l'ancien,
  // détaché de la page, se remesurait à zéro et déclarait la note entière.
  // Elle restait donc coupée sans s'ouvrir (vu sur l'écran, 4 novembre 2026).
  // Coupée, elle se touche et se clavier comme un bouton ; entière, rien.
  const ouvrir = () => setOuverte(true);
  return (
    <>
      <div
        data-atlas="note-du-devis"
        className={classe}
        style={{ ...style, cursor: coupee ? "pointer" : undefined }}
        role={coupee ? "button" : undefined}
        tabIndex={coupee ? 0 : undefined}
        aria-label={coupee ? "Lire toute la note de votre artisan" : undefined}
        onClick={coupee ? ouvrir : undefined}
        onKeyDown={
          coupee
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  ouvrir();
                }
              }
            : undefined
        }
      >
        {contenu}
      </div>
      <BottomSheet open={ouverte} onBackdropClick={() => setOuverte(false)}>
        <h2 className="text-[26px] leading-tight" style={{ fontFamily: font.display, color: colors.ink }}>
          À savoir
        </h2>
        {/* Ses retours à la ligne gardés : il a pu écrire une liste. */}
        <p className="mt-3 whitespace-pre-line text-[16px] leading-[1.5]" style={{ color: colors.ink }}>
          {note}
        </p>
        <button
          type="button"
          onClick={() => setOuverte(false)}
          className="mt-6 min-h-[52px] w-full rounded-full text-[16px] font-semibold"
          style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${voile(colors.ink, 0.45)}` }}
        >
          Revenir au devis
        </button>
      </BottomSheet>
    </>
  );
}
