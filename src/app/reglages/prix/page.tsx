import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireGrillePrix } from "@/server/repositories/grille-prix";
import { lireGrilles } from "@/server/repositories/grilles-reglables";
import GrillesPrixClient from "./GrillesPrixClient";

export const dynamic = "force-dynamic";

/**
 * « Mes prix » — les trois grilles du patron.
 *
 * Le patron, le 8 août 2026 : *« pour la fente, ils devraient demander la
 * hauteur de l'arbre et son diamètre, et on crée une liste de prix en fonction
 * de la hauteur et du diamètre, comme ça il n'invente rien. »* Puis : *« par
 * contre il faut faire plus de tranche. »* — d'où 8 diamètres × 6 hauteurs.
 *
 * Le soir même, il a étendu le principe : **l'abattage** à la technique × le
 * diamètre (24 cases, parce que chez lui le même chêne vaut 600, 1 000 ou
 * 1 400 € selon la technique), et **la haie** à un prix au mètre linéaire.
 *
 * **Visible par l'entreprise, pas réservée à l'éditeur.** Ce ne sont pas des
 * mots de métier partagés (`/reglages/vocabulaire`), ce sont SES prix de vente :
 * chaque artisan aura les siens, et l'isolation par entreprise le garantit
 * (`docs/QUESTIONS.md` §10).
 */
export default async function GrillesPrixPage() {
  const ctx = await getCurrentCtx();
  // Ses grilles à lui depuis le 14 août 2026 : titres, tranches et façons
  // viennent de la base, avec les valeurs de départ tant qu'il n'a rien touché.
  const grilles = await lireGrilles(ctx);
  const cases = await lireGrillePrix(ctx, grilles);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <div className="px-6 pt-8">
          {/* **Le retour ramène d'où l'on vient, pas à la racine.** Le patron,
              le 17 août 2026 : *« lorsque je vais dans mes prix et que je fais
              un retour, je retourne directement dans l'application et pas dans
              la catégorie tarif »*. Cet écran n'a qu'une porte —
              `/reglages/tarifs` —, et la flèche renvoyait deux étages plus
              haut : il fallait rouvrir Tarifs pour reprendre où il en était. */}
          <Link
            href="/reglages/tarifs"
            aria-label="Retour aux tarifs"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <div className="px-6 pt-5">
          {/* **Le surtitre dit d'où l'on vient**, jamais où l'on est — c'est la
              grammaire des écrans (« Mes mesures » porte « Mes prix »). Celui-ci
              répétait son propre titre : « MES PRIX / Mes prix ». Vu à la
              capture en corrigeant la flèche, le 17 août 2026. */}
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Tarifs &amp; catalogue
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Mes prix
          </h1>
          <p className="mt-3 text-[14px] leading-snug" style={{ color: colors.muted }}>
            Abattre, enlever les grumes, fendre, dessoucher, tailler une haie. Atlas y prend le montant au lieu de
            l&apos;inventer — et{" "}
            <strong>une case vide reste une question</strong>, jamais une estimation.
          </p>
          <p className="mt-2 text-[14px] leading-snug" style={{ color: colors.muted }}>
            Vous n&apos;avez rien à remplir d&apos;avance : chaque prix que vous écrivez sur un devis vient se ranger
            tout seul dans la bonne case.
          </p>
        </div>

        <GrillesPrixClient
          grilles={grilles}
          initiales={cases.map((c) => ({
            nature: c.nature,
            cle: c.cellule.cle,
            prix: c.prix,
            origine: c.origine,
          }))}
        />
      </div>
    </div>
  );
}
