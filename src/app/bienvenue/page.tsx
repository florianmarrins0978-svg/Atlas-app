import Image from "next/image";
import Link from "next/link";

/**
 * LA PORTE, EN PLEIN AIR — l'écran qu'on voit avant d'avoir un compte.
 *
 * **Sa décision du 8 septembre 2026**, après avoir comparé deux planches :
 * *« c'était la deuxième maquette, la porte en plein air »*. Codée trait pour
 * trait d'après `appli/la-porte-en-plein-air.html`, écran 1.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI CET ÉCRAN N'EST PAS `/login`, ET C'EST LA SEULE CHOSE QUI A ÉTÉ
 * DÉCIDÉE SANS LUI.** La planche montre la porte EN PREMIER, puis « Se
 * connecter » qui ouvre le formulaire. Le porter tel quel sur `/login`
 * demandait de toucher **140 navigations** vers cette adresse, réparties dans
 * 129 scripts — captures, suites de bout en bout, et `verifier-connexion.mjs`,
 * le seul contrôle qui éprouve une vraie connexion derrière une origine
 * étrangère. Un lot d'apparence qui réécrit cent vingt-neuf contrôles ne se
 * relit plus : on ne sait plus ce qui a changé de ce qui a été déplacé.
 *
 * L'ordre qu'il a choisi est donc respecté — le visiteur sans compte arrive
 * ICI, `src/middleware.ts` l'y envoie — et `/login` garde son formulaire à son
 * adresse, avec l'allure de l'écran 3 de la planche.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LA PHOTO EST FIXE, ET C'EST ASSUMÉ** (planche, §4) : la porte serait sinon
 * le seul écran qui ne suit pas la charte choisie dans les réglages. Elle est
 * servie par `next/image` en `priority` : c'est le premier écran de
 * l'application, et une photo qui se peint en retard donne un carré noir puis
 * une forêt — exactement l'effet qu'on remarque.
 *
 * **CE QUI A ÉTÉ RETIRÉ À SA DEMANDE, ET QUI NE DOIT PAS REVENIR** : l'accroche
 * sous le nom, et le sceau à l'étoile. `scripts/test-porte-bienvenue.ts` le
 * garde — un contrôle qui ne vérifie que ce qui est présent laisse revenir ce
 * qu'on a fait enlever, sans que ça se voie.
 */
/**
 * **LA MARGE DU BAS RÉSERVE L'INDICATEUR D'ACCUEIL** — vu sur la capture du
 * 8 septembre. `globals.css` pose `env(safe-area-inset-*)` sur le corps de la
 * page, mais PAS en bas : c'est la barre d'onglets qui s'en charge partout
 * ailleurs. Ici il n'y en a pas, et « Se connecter » finissait sous le trait
 * blanc de l'iPhone, là où l'appui ferme l'application au lieu d'ouvrir la
 * page.
 */
export default function BienvenuePage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden atlas-bas-sans-barre px-[22px] text-white">
      <Image
        src="/images/porte-foret.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      {/* **Deux voiles, et ils ne font pas le même travail** — planche, en
          commentaire : le premier assombrit l'ensemble, sans quoi le rai de
          soleil mange le mot ATLAS ; le second noircit le bas, seule zone où
          un texte de 11,5 px doit rester lisible dehors, sur un chantier. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg,rgba(10,14,10,.52) 0%,rgba(10,14,10,.30) 34%,rgba(10,14,10,.48) 62%,rgba(8,11,8,.90) 100%)",
        }}
      />

      <div className="relative z-[2] flex flex-1 flex-col items-center justify-center text-center">
        <span
          className="text-[34px] leading-none"
          style={{
            fontFamily: "ui-serif, Georgia, serif",
            letterSpacing: "0.28em",
            textIndent: "0.28em",
            textShadow: "0 2px 18px rgba(0,0,0,.55)",
          }}
        >
          ATLAS
        </span>
      </div>

      <div className="relative z-[2]">
        {/* La phrase, et non une case à cocher : point 3 de la planche, encore
            à trancher par lui. En attendant, c'est la forme qu'elle porte. */}
        <p className="mb-[14px] text-center text-[11.5px] leading-[1.5] text-white/[.88]">
          En appuyant sur «&nbsp;Créer un compte&nbsp;» ou «&nbsp;Se
          connecter&nbsp;», vous acceptez nos{" "}
          {/* **Servies telles qu'elles ont été écrites le 8 septembre**, dans
              `public/`, plutôt que recopiées en TSX. Deux raisons : le texte
              qu'on accepte doit être EXACTEMENT celui qu'il a relu, et une
              recopie de huit cents lignes de juridique introduit des écarts
              que personne ne relit. Elles restent à faire valider — c'est
              écrit dans `TODO.md`, et ce n'est pas du code. */}
          <a href="/conditions-utilisation.html" className="text-white underline underline-offset-2">
            Conditions d’utilisation
          </a>
          . Pour savoir comment vos données sont traitées, consultez notre{" "}
          <a href="/confidentialite.html" className="text-white underline underline-offset-2">
            Politique de confidentialité
          </a>
          .
        </p>

        <Link
          href="/creer-un-compte"
          className="block w-full rounded-full bg-white py-[17px] text-center text-[16.5px] font-medium leading-none text-[#12160f] transition-transform active:scale-[0.985]"
        >
          Créer un compte
        </Link>
        <Link
          href="/login"
          className="block w-full bg-transparent pb-[2px] pt-[15px] text-center text-[15.5px] font-semibold leading-none text-white"
        >
          Se connecter
        </Link>
      </div>
    </div>
  );
}
