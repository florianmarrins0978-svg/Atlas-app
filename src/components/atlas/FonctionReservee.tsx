import { colors, font, texteSituation, voile } from "@/lib/design-tokens";
import { phraseDeLaFermeture, type FonctionReservee as Fonction } from "@/lib/abonnements";
import PrimaryButton from "./PrimaryButton";

/**
 * CE QUE VOIT UN ABONNÉ « ARTISAN » à la place d'une fonction d'« Entreprise ».
 *
 * Sa planche du 10 septembre 2026 : l'écran **reste atteignable** — même
 * en-tête, même titre, même flèche de retour. Une rubrique qui disparaît se
 * cherche : il l'a vue hier, il ne la trouve plus, il appelle. Une rubrique
 * qui s'ouvre sur « c'est dans Entreprise » répond en une seconde.
 *
 * **Le même dessin pour les deux fonctions.** Deux écrans fermés qui ne se
 * ressemblent pas donnent l'impression de deux pannes différentes ; ici c'est
 * la même raison, donc le même écran. Les mots viennent de
 * `phraseDeLaFermeture`, la décision de `fonctionOuverte` — rien ici.
 */
export default function FonctionReservee({ fonction }: { fonction: Fonction }) {
  const { titre, detail } = phraseDeLaFermeture(fonction);
  return (
    <section
      data-atlas={`fonction-reservee-${fonction}`}
      className="mx-[26px] mt-[26px] rounded-[10px] px-[22px] py-[26px] text-center"
      style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}`, fontFamily: font.body }}
    >
      <span
        aria-hidden="true"
        className="mx-auto flex h-[46px] w-[46px] items-center justify-center rounded-full"
        style={{ backgroundColor: voile(colors.or, 0.14), color: colors.or }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <h3 className="mt-4 text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
        {titre}
      </h3>
      <p className={`mx-auto mt-2 max-w-[300px] ${texteSituation}`} style={{ color: colors.inkSoft }}>
        {detail}
      </p>
      <div className="mt-5 flex justify-center">
        <PrimaryButton href="/reglages/abonnement" repere="voir-formule-entreprise">
          Voir la formule Entreprise
        </PrimaryButton>
      </div>
    </section>
  );
}
