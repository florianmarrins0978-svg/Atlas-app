import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";

export const dynamic = "force-dynamic";

/**
 * « Apparence » — d'après `maquettes/atlas-reglages-reste.html`, écran 3.
 *
 * **CET ÉCRAN NE RÈGLE RIEN, ET C'EST DÉLIBÉRÉ.** La planche proposait deux
 * choses : une teinte d'accent au choix, et un mode sombre. Aucune des deux
 * n'est codée, et poser un interrupteur qui ne ferait rien serait pire qu'une
 * absence — sa propre phrase sur la planche : *« on le touche, rien ne bouge,
 * et on croit à une panne »*.
 *
 * **Alors pourquoi ouvrir la rubrique ?** Parce qu'une ligne « Bientôt » dans
 * le sommaire ne dit ni ce qui viendra, ni pourquoi ce n'est pas là. Cet écran
 * le dit, et il donne au patron de quoi trancher ce qui vient en premier —
 * c'est LUI qui décide, et il a envoyé une planche sombre le 14 août.
 *
 * **Ce qu'il faudra vraiment faire, et qu'il ne faut pas sous-estimer** :
 * `colors.rust` et `colors.or` sont écrits en clair dans 352 endroits, en style
 * en ligne. Les rendre réglables demande de les faire passer par une variable
 * CSS — un balayage de toute l'application, à faire d'un coup et à éprouver
 * d'un coup. Ce n'est pas un écran de réglages, c'est un lot.
 *
 * **Aucune garde de rôle** : c'est la rubrique de la personne.
 */
export default async function ApparencePage() {
  await getCurrentCtx();

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Moi"
        titre="Apparence"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />

      <div className="pb-24">
        <p className={`mx-[26px] mt-[26px] ${texteSituation}`} style={{ color: colors.muted }}>
          L&apos;application n&apos;a qu&apos;une apparence pour l&apos;instant : le fond crème, l&apos;encre
          sombre, le vert pin sur ce qu&apos;on touche et l&apos;or sur ce qu&apos;on lit.
        </p>

        <section className="mx-[26px] mt-[30px] border-t pt-[18px]" style={{ borderColor: colors.line }}>
          <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
            Ce qui viendra
          </p>

          <AVenir
            nom="Mode sombre"
            dit="Suivre le réglage de votre téléphone, ou le forcer"
            quoi="Vous aviez envoyé une planche sombre le 14 août : c'est faisable, mais il faut reprendre chaque écran, un à un."
          />
          <AVenir
            nom="Votre accent"
            dit="La couleur de ce qu'on touche : boutons, onglet où vous êtes"
            quoi="Le fond crème ne changerait pas — c'est lui qui donne son calme à l'application."
            derniere
          />
        </section>

        {/* **Pourquoi rien n'est proposé ici plutôt qu'un interrupteur gris.**
            Le dépôt interdit de laisser croire qu'une chose fonctionne. Il
            interdit aussi de laisser croire qu'elle ne viendra jamais : le
            patron doit savoir ce qu'il peut demander. */}
        <p
          className={`mx-[26px] mt-[30px] border-t pt-[18px] ${texteSituation}`}
          style={{ borderColor: colors.line, color: colors.muted }}
        >
          Aucun interrupteur ici tant que rien n&apos;est branché derrière : un bouton qu&apos;on touche et qui
          ne bouge pas se lit comme une panne. Dites-moi lequel des deux vous voulez d&apos;abord, et je le
          fais.
        </p>
      </div>
    </div>
  );
}

/** Une chose annoncée, avec ce qu'elle coûte — jamais un « Bientôt » nu. */
function AVenir({
  nom,
  dit,
  quoi,
  derniere,
}: {
  nom: string;
  dit: string;
  quoi: string;
  derniere?: boolean;
}) {
  return (
    <div className={derniere ? "py-[13px]" : "border-b py-[13px]"} style={{ borderColor: colors.line }}>
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1" style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.25 }}>
          {nom}
        </span>
        <span className={libelleCaps} style={{ color: colors.or }}>
          Bientôt
        </span>
      </div>
      <p className={`mt-1 ${texteSituation}`} style={{ color: colors.muted }}>
        {dit}
      </p>
      <p className={`mt-1.5 ${texteSituation}`} style={{ color: colors.muted }}>
        {quoi}
      </p>
    </div>
  );
}
