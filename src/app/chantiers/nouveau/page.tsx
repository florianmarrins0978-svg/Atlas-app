import { getCurrentCtx } from "@/server/session-ctx";
import { getClient } from "@/server/repositories/clients";
import { photosDesAutresChantiers } from "@/server/repositories/photos";
import { abonnementDeLEntreprise } from "@/server/repositories/abonnements";
import { enLectureSeule } from "@/lib/abonnements";
import EcranLectureSeule from "@/components/atlas/EcranLectureSeule";
import FormulaireNouveauChantier, { type ClientDeDepart } from "./FormulaireNouveauChantier";

// La route reste, et c'est délibéré : les suites de bout en bout y vont
// directement, et un lien profond — celui d'un signet, celui d'une invitation —
// doit continuer d'ouvrir un écran entier. Depuis l'accueil, le même formulaire
// monte en feuille par-dessus la liste (`src/app/EcranChantiers.tsx`).
//
// ───────────────────────────────────────────────────────────────────────────
// **`?client=…` — « Autre chantier », sa décision du 8 septembre 2026.**
//
// *« Si c'est un client déjà enregistré en tant que client on ne va pas recréer
// une fiche client ! »* Depuis sa fiche, cet écran s'ouvre avec ses coordonnées
// déjà posées, et le chantier s'accrochera à SA fiche — sans passer par le
// rapprochement, puisqu'on tient l'identifiant.
//
// **Cette page est devenue un composant SERVEUR pour cela**, et le formulaire
// reste client. Lire le client dans le navigateur aurait demandé un aller-retour
// de plus, donc un écran qui se remplit sous les yeux après coup : sur un
// téléphone de chantier, c'est un écran qui a l'air vide au moment où on le
// regarde.
export const dynamic = "force-dynamic";

export default async function NouveauChantierPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametres = await searchParams;
  // Essai terminé : cet écran est la porte que l'accueil vient d'éteindre. Un
  // formulaire qu'on remplit en entier pour un refus au bout serait une panne
  // déguisée ; on le dit ici, avant la première case.
  const ctx = await getCurrentCtx();
  if (enLectureSeule(await abonnementDeLEntreprise(ctx), new Date())) {
    return <EcranLectureSeule titre="Nouveau chantier" />;
  }
  const brut = parametres.client;
  const clientId = Array.isArray(brut) ? brut[0] : brut;

  // **`?facture=1` — facturer sans passer par la case devis (10 septembre
  // 2026).** L'accueil fait monter cet écran en feuille ; ce paramètre est ce
  // qui le rend atteignable AUTREMENT — sans JavaScript, dans un nouvel onglet,
  // depuis un signet. Sans lui, l'anneau « Créer une facture » aurait mené à la
  // fiche qui prépare un DEVIS dès que le geste ne joue pas, et rien n'aurait
  // dit pourquoi (`AGENTS.md` : un cul-de-sac muet coûte deux fois).
  const pour = parametres.facture ? "facture" : "devis";

  let depuisClient: ClientDeDepart | undefined;
  if (clientId) {
    const client = await getClient(ctx, clientId);
    // Un client effacé — ou d'une autre entreprise, ce que la RLS rend
    // indiscernable — ouvre simplement l'écran vierge. Pas de 404 : il voulait
    // créer un chantier, il en crée un.
    if (client) {
      const anciennes = await photosDesAutresChantiers(ctx, client.id, null);
      depuisClient = {
        clientId: client.id,
        nomClient: client.nom,
        civilite: client.civilite ?? null,
        telephone: client.telephone ?? "",
        email: client.email ?? "",
        canal: (client.canalCommunication as "sms" | "email" | null) ?? null,
        adresseClient: client.adresse ?? "",
        anciennesPhotos: anciennes.map((p) => ({
          id: p.id,
          storageKey: p.storageKey,
          chantierNom: p.chantierNom,
        })),
      };
    }
  }

  return <FormulaireNouveauChantier depuisClient={depuisClient} pour={pour} />;
}
