/**
 * TRANSMETTRE UN PDF — la feuille de partage du téléphone, avec le FICHIER.
 *
 * Atlas n'envoie rien lui-même : le devis et la facture partent par la feuille
 * de partage (`TransmettreAuClient.tsx`, `PieceDuDossier.tsx`), et c'est lui qui
 * appuie. La fiche de sécurité fait pareil — sa vérification du 21 septembre
 * 2026 : *« dans l'appli il n'est pas possible d'envoyer automatiquement à
 * quelqu'un, il faut le faire manuellement »*.
 *
 * **Le fichier, pas l'adresse.** Les pièces du client se partagent par leur
 * adresse publique, que n'importe qui ouvre. La fiche, elle, vit derrière la
 * connexion : son adresse n'ouvrirait rien chez le donneur d'ordre. On lit donc
 * le PDF, et c'est lui qu'on pose sur la feuille de partage. Un téléphone qui
 * ne sait pas partager un fichier reçoit le téléchargement à la place : la
 * fiche arrive dans ses fichiers, et il l'envoie de là.
 *
 * Rend `true` quand la feuille s'est ouverte ou que le fichier a été remis,
 * `false` quand il a annulé : ce n'est qu'alors que la fiche se marque
 * « transmise ».
 */
export async function transmettreLePdf(adresse: string, nom: string): Promise<boolean> {
  const reponse = await fetch(adresse, { credentials: "same-origin" });
  if (!reponse.ok) throw new Error(`Le PDF n’a pas pu être lu (${reponse.status}).`);
  const fichier = new File([await reponse.blob()], nom, { type: "application/pdf" });
  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: nom });
      return true;
    } catch (e) {
      // Un partage annulé n'est pas une panne : il a changé d'avis.
      if (e instanceof Error && e.name === "AbortError") return false;
      throw e;
    }
  }
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(fichier);
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(lien.href), 10_000);
  return true;
}
