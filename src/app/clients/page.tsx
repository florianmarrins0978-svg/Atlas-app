import { colors, font } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerFichesClients } from "@/server/repositories/fiche-client";
import ListeClients from "./ListeClients";

// **La liste de ses clients — sa remarque du 17 août 2026 au soir.**
//
// *« La catégorie client n'a pas été créée. »* La FICHE d'un client existait
// depuis la veille (arrangement B de `docs/maquettes/66`), mais elle ne
// s'atteignait que depuis un chantier : il n'y avait aucun endroit d'où voir
// ses clients, ni retrouver celui qu'on a en tête sans se rappeler pour quel
// chantier on l'avait noté.
//
// **Sans cinquième onglet, et ce n'est pas un demi-choix.** La barre du bas en
// porte quatre, et le cinquième est déjà décidé pour les outils métier
// (`ARCHITECTURE.md` §125) ; à cinq colonnes sur 360 px, « CHANTIERS » déborde
// déjà. La liste s'ouvre donc depuis l'accueil, là où il est déjà.
//
// **Rien ne s'invente ici** : un client dont aucun chantier n'est facturé
// n'affiche pas « 0 € », il affiche qu'il n'y a pas encore eu de facture. Un
// zéro se lirait comme un mauvais payeur (`CLAUDE.md` §4).
//
// **Cette page ne fait plus que LIRE.** Le champ de recherche a besoin du
// navigateur — il filtre à chaque frappe —, et il vit donc dans
// `ListeClients.tsx`. Sa demande du 20 août 2026 : *« il faut une barre de
// recherche où je peux taper le nom d'un client »*, sur une liste de vingt et
// un noms dont quatre s'appellent Martins.

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const ctx = await getCurrentCtx();
  const clients = await listerFichesClients(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-[86px]">
        <EnTeteEcran
          retour={{ href: "/", libelle: "Retour à la liste des chantiers" }}
          surtitre="Vos clients"
          titre={clients.length === 1 ? "1 client" : `${clients.length} clients`}
        />

        {clients.length === 0 ? (
          <p className="mx-[26px] mt-[26px] text-[13px] leading-[1.6]" style={{ color: colors.muted }}>
            Aucun client pour l&apos;instant. Ils naissent avec vos chantiers : le premier que vous créerez
            apparaîtra ici.
          </p>
        ) : (
          <ListeClients
            clients={clients.map((c) => ({
              id: c.id,
              nom: c.nom,
              chantiers: c.chantiers,
              // Les montants voyagent tels que le dépôt les rend : leur mise en
              // forme vit dans `enEuros`, appelée une seule fois, à l'écran.
              facture: c.facture ?? null,
              du: c.du ?? null,
            }))}
          />
        )}
      </div>
    </div>
  );
}
