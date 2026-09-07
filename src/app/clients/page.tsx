import { colors, font } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerFichesClients } from "@/server/repositories/fiche-client";
import { jourIso } from "@/lib/jour";
import ListeClients, { CompteClients, FournisseurClients } from "./ListeClients";

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
// ─────────────────────────────────────────────────────────────────────────────
// **REFONDU LE 3 SEPTEMBRE 2026, sur maquette retenue** (`appli/vos-clients.html`,
// *« tu peux coder exactement cette maquette »*). Trois choses changent ICI ; le
// reste vit dans `ListeClients.tsx`, qui porte le détail et son pourquoi.
//
//   1. **Le titre nomme l'écran, le compte passe dessous.** Il portait
//      « 21 clients » à 36 px et « VOS CLIENTS » en capitales dorées en dessous
//      — le compte à la place du nom, et deux fois la même chose en deux voix.
//      Les deux fentes d'`EnTeteEcran` existaient déjà : on échange ce qu'on y
//      met. Le compte s'anime (`CompteClients`) et suit la frappe, là où l'œil
//      est ; il était écrit sous le DERNIER résultat, donc hors de l'écran au
//      moment précis où il sert.
//   2. **Le lieu et la date descendent jusqu'à l'écran.** `adresse` était en
//      base sans être chargée ; `dernierJour` était calculé, rendu par le dépôt,
//      et abandonné ici — c'est lui qui commande l'ordre de la liste, et rien ne
//      l'annonçait.
//   3. **Le jour se lit au SERVEUR** (`jourIso`, à l'heure de son atelier) et
//      descend en accessoire. Le lire dans le navigateur donnerait l'horloge du
//      téléphone : entre minuit et deux heures, l'heure d'été sépare les deux, et
//      la bande d'août clignoterait en septembre à l'hydratation.

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const ctx = await getCurrentCtx();
  const clients = await listerFichesClients(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-[86px]">
        {clients.length === 0 ? (
          <>
            <EnTeteEcran
              retour={{ href: "/", libelle: "Retour à la liste des chantiers" }}
              titre="Vos clients"
            />
            {/* **Deux phrases, plus trois.** La troisième — « le premier que
                vous créerez apparaîtra ici » — redisait la deuxième avec
                d'autres mots. Ce qui reste enseigne ce qui ne se devine pas :
                on ne crée pas un client, il naît d'un chantier. */}
            <p
              className="mx-[26px] mt-[26px] max-w-[31ch] text-[13px] leading-[1.6]"
              style={{ color: colors.inkSoft }}
            >
              Aucun client pour l&apos;instant. Ils naissent avec vos chantiers.
            </p>
          </>
        ) : (
          <FournisseurClients
            aujourdHui={jourIso(new Date())}
            clients={clients.map((c) => ({
              id: c.id,
              nom: c.nom,
              adresse: c.adresse,
              chantiers: c.chantiers,
              // Les montants voyagent tels que le dépôt les rend : leur mise en
              // forme vit dans `enEuros`, appelée une seule fois, à l'écran.
              facture: c.facture ?? null,
              du: c.du ?? null,
              dernierJour: c.dernierJour,
            }))}
          >
            <EnTeteEcran
              retour={{ href: "/", libelle: "Retour à la liste des chantiers" }}
              titre="Vos clients"
              precision={<CompteClients />}
            />
            <ListeClients />
          </FournisseurClients>
        )}
      </div>
    </div>
  );
}
