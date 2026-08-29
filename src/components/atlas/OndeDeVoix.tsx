"use client";

import { useEffect, useRef } from "react";
import { colors } from "@/lib/design-tokens";

/**
 * LE ZIGZAG QUI BOUGE PENDANT QU'IL PARLE.
 *
 * **Sa demande du 27 août 2026, capture de WhatsApp à l'appui :** *« lorsque
 * l'on parle, il y a le petit zigzag qui se met en route »*.
 *
 * **Ce n'est pas de l'ornement, et c'est tout le sujet.** Le 13 août, il avait
 * déjà signalé la même chose sur une autre dictée : *« on ne sait pas ce qui se
 * passe, les trois petits points sont fixes, on ne sait pas si ça bug »*. Un
 * écran qui ne bouge pas pendant qu'on parle se lit comme une panne — et il
 * repose la question, ou il abandonne.
 *
 * **Il montre le SON, pas le temps.** Une animation qui tourne toute seule
 * rassurerait à tort : elle bougerait autant micro coupé. Ici les barres
 * suivent le niveau réel capté — s'il ne sort rien, elles restent plates, et
 * c'est une information.
 *
 * **Sur un `canvas`, pas soixante `div`.** Repeindre soixante éléments
 * cinquante fois par seconde sur un téléphone de chantier coûte plus cher que
 * le reste de l'écran réuni.
 */
export default function OndeDeVoix({ flux }: { flux: MediaStream | null }) {
  const toile = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!flux) return;
    const canvas = toile.current;
    if (!canvas) return;

    type FenetreAudio = Window & { webkitAudioContext?: typeof AudioContext };
    const Constructeur = window.AudioContext ?? (window as FenetreAudio).webkitAudioContext;
    if (!Constructeur) return;

    const contexte = new Constructeur();
    const source = contexte.createMediaStreamSource(flux);
    const analyseur = contexte.createAnalyser();
    analyseur.fftSize = 256;
    source.connect(analyseur);

    const echantillons = new Uint8Array(analyseur.frequencyBinCount);
    // **On garde un historique**, comme WhatsApp : les barres défilent vers la
    // gauche. Une seule barre qui monte et descend ne dit pas qu'on a parlé il
    // y a deux secondes.
    const barres: number[] = [];
    let vivant = true;

    function peindre() {
      if (!vivant || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      analyseur.getByteTimeDomainData(echantillons);
      // L'écart au silence (128 = ligne plate), moyenné : c'est le niveau.
      let somme = 0;
      for (const v of echantillons) somme += Math.abs(v - 128);
      const niveau = Math.min(1, somme / echantillons.length / 40);

      const largeurBarre = 3;
      const espace = 2;
      const maximum = Math.floor(canvas.width / (largeurBarre + espace));
      barres.push(niveau);
      if (barres.length > maximum) barres.shift();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = colors.rust;
      const milieu = canvas.height / 2;
      barres.forEach((n, i) => {
        // Un plancher de 2 px : une barre de zéro pixel ne se voit pas, et un
        // silence doit rester une LIGNE, pas un trou.
        const hauteur = Math.max(2, n * canvas.height * 0.9);
        const x = i * (largeurBarre + espace);
        ctx.fillRect(x, milieu - hauteur / 2, largeurBarre, hauteur);
      });
      requestAnimationFrame(peindre);
    }
    peindre();

    return () => {
      vivant = false;
      source.disconnect();
      // **Le contexte se ferme.** Un contexte audio laissé ouvert garde le
      // micro actif aux yeux du téléphone, et le voyant reste allumé.
      void contexte.close().catch(() => undefined);
    };
  }, [flux]);

  return (
    <canvas
      ref={toile}
      width={220}
      height={28}
      data-atlas="onde-de-voix"
      aria-hidden
      className="h-7 flex-1"
      style={{ width: "100%" }}
    />
  );
}
