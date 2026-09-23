/* =======================================================================
   Retirer les commentaires d'un fichier TypeScript, sans déplacer une
   seule ligne.

   **Pourquoi un module et pas une fonction dans chaque contrôle.** Deux
   contrôles lisent les écrans pour y chercher un caractère interdit — les
   flèches décoratives, les points du milieu de phrase — et les deux
   doivent ignorer les commentaires : ce dépôt y CITE les libellés d'hier
   pour dire pourquoi ils sont partis. Un contrôle qui interdirait
   d'expliquer se ferait contourner.

   Deux implémentations de la même lecture auraient divergé (`CLAUDE.md`
   §3, « jamais de règle dupliquée ») : la première ne connaissait pas les
   chaînes, et prenait le « // » d'une adresse `https://…` pour le début
   d'un commentaire — tout ce qui suivait sur la ligne devenait invisible
   au contrôle, y compris un libellé fautif.

   Les numéros de ligne restent ceux du fichier d'origine : ce qui est
   retiré est remplacé par des espaces, jamais supprimé. Sans cela, le
   message d'échec enverrait chercher à la mauvaise ligne.
   ======================================================================= */

/** Le fichier, ligne à ligne, ses commentaires remplacés par du blanc. */
export function sansCommentaires(source: string): string[] {
  const sortie = source.split("");
  let i = 0;
  let etat: "code" | "ligne" | "bloc" | "html" | "chaine" | "gabarit" = "code";
  let guillemet = "";

  while (i < source.length) {
    const c = source[i];
    const d = source[i + 1];

    if (etat === "code") {
      /* **`https://` n'est pas un commentaire.** Une adresse écrite en texte
         dans une maquette coupait la ligne en deux pour tout contrôle qui lit
         par ici, et ce qui suivait devenait invisible. Le « : » qui précède
         suffit à les distinguer, et aucun commentaire de ce dépôt ne s'ouvre
         collé à un deux-points. */
      if (c === "/" && d === "/" && source[i - 1] !== ":") {
        etat = "ligne";
        sortie[i] = " ";
        sortie[i + 1] = " ";
        i += 2;
        continue;
      }
      // Le commentaire HTML des maquettes, qui n'a pas la même forme.
      if (c === "<" && source.startsWith("<!--", i)) {
        etat = "html";
        sortie[i] = " ";
        i++;
        continue;
      }
      if (c === "/" && d === "*") {
        etat = "bloc";
        sortie[i] = " ";
        sortie[i + 1] = " ";
        i += 2;
        continue;
      }
      if (c === '"' || c === "'") {
        etat = "chaine";
        guillemet = c;
        i++;
        continue;
      }
      if (c === "`") {
        etat = "gabarit";
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (etat === "ligne") {
      if (c === "\n") etat = "code";
      else sortie[i] = " ";
      i++;
      continue;
    }

    if (etat === "html") {
      if (c === "-" && source.startsWith("-->", i)) {
        sortie[i] = " ";
        sortie[i + 1] = " ";
        sortie[i + 2] = " ";
        etat = "code";
        i += 3;
        continue;
      }
      if (c !== "\n") sortie[i] = " ";
      i++;
      continue;
    }

    if (etat === "bloc") {
      if (c === "*" && d === "/") {
        sortie[i] = " ";
        sortie[i + 1] = " ";
        etat = "code";
        i += 2;
        continue;
      }
      // Le retour à la ligne se garde : c'est lui qui tient la numérotation.
      if (c !== "\n") sortie[i] = " ";
      i++;
      continue;
    }

    /* **Une chaîne simple s'arrête À LA FIN DE SA LIGNE, et c'est ce qui rend
       cette lecture sûre.** Les littéraux d'expression régulière ne sont pas
       reconnus ici — `/['"]/` ouvre donc une chaîne qui n'existe pas. Sans
       cette borne, tout le reste du fichier passait pour du texte : deux
       commentaires de `dev.ts` échappaient au contrôle des flèches, cinq cents
       lignes plus bas. La règle du langage suffit à la poser : seul un gabarit
       `\`…\`` peut contenir un retour à la ligne. */
    if (c === "\n" && etat === "chaine") {
      etat = "code";
      i++;
      continue;
    }
    // Un caractère échappé ne ferme pas la chaîne.
    if (c === "\\") {
      i += 2;
      continue;
    }
    if ((etat === "chaine" && c === guillemet) || (etat === "gabarit" && c === "`")) {
      etat = "code";
    }
    i++;
  }

  return sortie.join("").split("\n");
}
