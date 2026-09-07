import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, texteSituation } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import RubriqueReservee from "../RubriqueReservee";
import Sommaire from "../Sommaire";
import { SOUS_RUBRIQUES_DOCUMENTS } from "@/lib/rubriques-reglages";

export const dynamic = "force-dynamic";

/**
 * « DEVIS & FACTURES » — un sommaire de quatre lignes, depuis le 7 septembre 2026.
 *
 * **C'était l'écran le plus long de l'application : 4 350 px, six écrans et
 * demi de son téléphone**, et il portait six sujets sans rapport — ce qui
 * s'imprime, ce que le devis dira, ce qui ne se coupe pas, son message, le
 * numéro, l'allure. Pour changer son logo, il traversait tout.
 *
 * **Il a tranché lui-même, planche en main** (`appli/couper-devis-et-factures.html`) :
 * *« on coupe »*. Quatre lignes, quatre écrans courts.
 *
 * **CE QUE LE DÉCOUPAGE NE FAIT PAS, et c'est ce qui a permis de le faire :**
 * rien ne sort de « Devis & factures ». Ses trois réponses des 23 et 25 août —
 * l'allure *« ici et pas dans une rubrique à part »* (B), le message *« ici »*
 * (A), l'aperçu collé (B) — tiennent toujours : le sommaire des réglages garde
 * ses douze lignes, et ces réglages vivent un cran plus bas, pas ailleurs.
 *
 * **Les quatre titres sont ceux de ses six blocs, mot pour mot.** Deux blocs ne
 * se touchent pas — le récapitulatif se recalcule, les mentions sont
 * obligatoires — et n'ouvrent donc aucune ligne : ils vivent dans le premier
 * écran, sous les interrupteurs qu'ils commentent.
 *
 * **L'écran refuse un non-propriétaire avant de lire quoi que ce soit** : ces
 * conditions engagent l'entreprise sur un document que le client garde
 * (`docs/QUESTIONS.md` §10). Le refus est répété sur les quatre écrans — chacun
 * a son adresse, et une adresse se tape.
 */
export default async function DocumentsPage() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Devis & factures"
        quoi="Ces conditions engagent l'entreprise sur un document que le client garde."
      />
    );
  }

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran
          surtitre="Réglages"
          titre="Devis & factures"
          retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
        />

        {/* **Le même composant que le sommaire des réglages**, et pas une liste
            recopiée : le jour où la ligne change de hauteur ou de chevron, elle
            change aux deux endroits. Un seul ensemble, sans intertitre — quatre
            lignes n'ont pas de familles à séparer. */}
        <Sommaire ensembles={[{ titre: "", rubriques: SOUS_RUBRIQUES_DOCUMENTS }]} />

        {/* **La phrase qui fermait l'ancien écran reste ici, et nulle part
            ailleurs.** Elle vaut pour les quatre : la répéter sur chacun ferait
            quatre fois la même mise en garde, et la mettre sur un seul la
            cacherait aux trois autres. */}
        <p
          className={`mx-[26px] mt-[30px] border-t pt-[18px] ${texteSituation}`}
          style={{ borderColor: colors.line, color: colors.inkSoft }}
        >
          Chaque devis garde <b style={{ color: colors.ink, fontWeight: 400 }}>ce que ces
          réglages disaient le jour où il a été créé</b> : les corriger aujourd&apos;hui
          ne change aucun document déjà fait.
        </p>
      </div>
    </div>
  );
}
