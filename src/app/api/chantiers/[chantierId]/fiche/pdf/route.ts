import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { chargerFicheChantierPourPdf } from "@/server/repositories/fiche-chantier-pdf";
import { genererPdfFicheChantier } from "@/server/pdf/fiche-chantier-pdf";

// Le PDF de la fiche d'un chantier — le troisième document d'Atlas, demandé par
// le patron le 20 août 2026.
//
// **Toujours régénéré, jamais stocké**, et c'est ce qui la distingue du devis et
// de la facture. Ces deux-là servent le fichier figé au moment de l'envoi : ce
// sont des engagements, et un devis qui changerait après son envoi ne vaudrait
// rien. La fiche, elle, rend compte de travaux — si le patron ajoute une
// prestation oubliée ou corrige une observation, c'est la version corrigée
// qu'il veut imprimer, pas celle d'avant.
//
// Le jour où elle sera ENVOYÉE à un client, il faudra la figer comme les deux
// autres : ce qui est parti ne se réécrit pas. Elle ne s'envoie pas encore.

export async function GET(
  requete: Request,
  { params }: { params: Promise<{ chantierId: string }> }
) {
  // **`chantierId`, et non `id`** : le dossier voisin `devis-pret` emploie déjà
  // ce nom, et Next.js refuse deux noms différents pour le même segment
  // dynamique. La première version a été écrite sous `[id]` — et cela ne cassait
  // pas seulement cette route : **le serveur entier refusait de démarrer**,
  // « You cannot use different slug names for the same dynamic path ». Cinq
  // écrans échouaient au préchauffage, et la suite accusait un bouton
  // introuvable trois écrans plus loin.
  const { chantierId: id } = await params;
  const ctx = await getCurrentCtx();

  const fiche = await chargerFicheChantierPourPdf(ctx, id);
  // Chantier inexistant, supprimé, ou appartenant à une autre entreprise : les
  // trois se répondent de la même façon. Distinguer « il existe mais pas chez
  // vous » de « il n'existe pas » dirait à un curieux qu'il a visé juste.
  if (!fiche) {
    return NextResponse.json({ error: "Chantier introuvable" }, { status: 404 });
  }

  // « Aperçu » et « Télécharger » ne sont pas le même geste — la leçon du
  // 7 août 2026 sur le devis : « quand je clique sur télécharger le PDF, ça me
  // propose pas de l'enregistrer, ça ouvre juste une page de plus ».
  const enPieceJointe = new URL(requete.url).searchParams.get("telecharger") === "1";
  const disposition = enPieceJointe ? "attachment" : "inline";

  const pdf = await genererPdfFicheChantier(fiche);

  // Le nom du fichier porte le jour et le chantier : c'est ce qu'on cherche
  // dans un dossier de téléchargements deux ans plus tard. Les caractères
  // interdits par les systèmes de fichiers sont remplacés, et rien d'autre —
  // un nom vidé de ses accents serait illisible.
  const morceau = fiche.chantierNom
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  const nom = `fiche-chantier-${fiche.jour ?? "sans-date"}-${morceau}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // L'en-tête HTTP n'accepte que l'ASCII : `filename*` porte le vrai nom,
      // accents compris, et `filename` sa version dégradée pour les vieux
      // navigateurs. Sans les deux, un accent fait tomber la réponse entière.
      "Content-Disposition":
        `${disposition}; filename="${nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "")}"; ` +
        `filename*=UTF-8''${encodeURIComponent(nom)}`,
    },
  });
}
