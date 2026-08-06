import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import { exporterEntreprise, type ExportEntreprise } from "@/server/repositories/export-entreprise";
import { ecrireArchiveZip, type EntreeArchive } from "@/lib/archive-zip";
import { lireObjet } from "@/server/storage";

// « Télécharger mes données » — voir TODO.md §0.
//
// Une adresse ouverte dans le navigateur, jamais une action serveur : le
// téléchargement d'un fichier n'a pas à traverser le mécanisme qui a déjà coûté
// vingt échanges au patron (« Invalid Server Actions request. », CLAUDE.md §5).
// Un lien, une réponse, un fichier.

export const dynamic = "force-dynamic";
// Le flux est écrit à la volée : rien ne doit tenter de le mettre en cache ni
// de le rassembler pour en calculer la longueur.
export const revalidate = 0;

/** Nom de fichier lisible, et sûr partout — un accent ou une apostrophe dans le
 *  nom de la société suffirait à faire arriver l'archive sous un nom illisible. */
function partieDeNom(texte: string): string {
  return (
    texte
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 40) || "entreprise"
  );
}

const LISEZ_MOI = (donnees: ExportEntreprise, nomEntreprise: string) => `SAUVEGARDE ATLAS — ${nomEntreprise}
Exportée le ${donnees.exporteLe}

CE QU'IL Y A DANS CE FICHIER
----------------------------
  donnees.json   Toutes les données de votre entreprise : clients, chantiers,
                 devis, factures, tarifs, transcriptions. Un fichier texte —
                 il s'ouvre dans n'importe quel éditeur, sans Atlas.
  fichiers/      Vos photos, vos enregistrements et vos PDF. Ils portent le
                 nom sous lequel l'application les connaît ; « donnees.json »
                 dit à quel chantier chacun appartient.

CE QU'IL CONTIENT DE SENSIBLE
-----------------------------
Les noms, adresses, téléphones et adresses e-mail de vos clients — et les liens
d'accès aux devis que vous leur avez envoyés, tant qu'ils n'ont pas expiré. Ce
fichier se range comme un dossier client : il ne se met pas dans un dépôt
public, il ne s'envoie pas par messagerie sans raison.

CE QU'IL NE CONTIENT PAS
------------------------
  - Vos identifiants de connexion (ils ne sont pas des données d'entreprise).
  - Le catalogue de prestations, identique sur toute installation d'Atlas.

CE QU'ON EN FAIT
----------------
Le garder. Le jour où l'application passe chez un hébergeur, ce fichier est ce
qui permet de retrouver ce qui a été saisi ici. Le refaire de temps en temps :
il ne contient que ce qui existait à la date écrite en haut.

COMBIEN DE LIGNES
-----------------
${Object.entries(donnees.compte)
  .map(([table, n]) => `  ${table.padEnd(26)} ${n}`)
  .join("\n")}
  ${"fichiers joints".padEnd(26)} ${donnees.fichiers.length}
`;

export async function GET() {
  const ctx = await getCurrentCtx();
  // Toutes les données de la société, pas seulement celles d'un membre : la
  // même barrière que pour les tarifs et les paramètres.
  await exigerProprietaire(ctx, "télécharger les données de l'entreprise");

  const maintenant = new Date();
  const [donnees, entreprise] = await Promise.all([
    exporterEntreprise(ctx, maintenant),
    getEntreprise(ctx),
  ]);
  const nomEntreprise = entreprise?.nom ?? "Entreprise";

  async function* entrees(): AsyncGenerator<EntreeArchive> {
    const encodeur = new TextEncoder();
    yield { nom: "LISEZ-MOI.txt", contenu: encodeur.encode(LISEZ_MOI(donnees, nomEntreprise)) };
    yield { nom: "donnees.json", contenu: encodeur.encode(JSON.stringify(donnees, null, 2)) };

    // Les fichiers, un par un — jamais tous ensemble en mémoire.
    const introuvables: string[] = [];
    for (const fichier of donnees.fichiers) {
      try {
        const octets = await lireObjet(fichier.storageKey);
        yield { nom: `fichiers/${fichier.storageKey}`, contenu: new Uint8Array(octets) };
      } catch {
        // Un fichier manquant n'interrompt pas la sauvegarde. L'audio est purgé
        // après transcription (docs/RGPD.md §4) : une absence est ici le cas
        // NORMAL, et faire échouer l'export dessus reviendrait à interdire
        // toute sauvegarde à qui a laissé tourner la purge une fois.
        introuvables.push(`${fichier.storageKey} (${fichier.origine})`);
      }
    }

    if (introuvables.length > 0) {
      yield {
        nom: "fichiers-absents.txt",
        contenu: encodeur.encode(
          "Ces fichiers sont référencés dans donnees.json mais n'existent pas\n" +
            "sur le disque.\n\n" +
            "  - Un enregistrement audio : c'est NORMAL. Il est effacé une fois\n" +
            "    la transcription obtenue, et la transcription, elle, est dans\n" +
            "    donnees.json.\n" +
            "  - Une photo : ce n'est PAS normal, sauf sur le jeu de démonstration\n" +
            "    dont les photos n'ont jamais eu de fichier. Sur vos propres\n" +
            "    chantiers, cela signifie que l'espace de travail a été supprimé\n" +
            "    puis recréé — la base a survécu, les fichiers non.\n\n" +
            introuvables.join("\n") +
            "\n"
        ),
      };
    }
  }

  // Le générateur est construit UNE fois, hors du flux : le placer dans `pull`
  // le recréerait à chaque morceau demandé, et l'archive repartirait sans fin
  // de son premier octet.
  const archive = ecrireArchiveZip(entrees(), maintenant);

  const flux = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await archive.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    async cancel() {
      // Téléchargement interrompu : refermer le générateur, sinon la lecture de
      // fichier en cours resterait suspendue jusqu'à la fin du processus.
      await archive.return(undefined);
    },
  });

  const jour = maintenant.toISOString().slice(0, 10);
  const nomFichier = `atlas-${partieDeNom(nomEntreprise)}-${jour}.zip`;

  return new NextResponse(flux, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
      "Cache-Control": "no-store",
    },
  });
}
