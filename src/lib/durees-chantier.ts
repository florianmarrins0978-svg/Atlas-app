// Les durées qu'un chantier peut prendre : la demi-journée, puis 1 à 100 jours.
//
// **Pourquoi une liste déroulante et non des boutons.** Quatre boutons
// couvraient jusqu'à trois jours ; au-delà il aurait fallu en ajouter, et un
// chantier de vingt jours en aurait demandé vingt. Le patron l'a dit le 3 août :
// « une bande déroulante qui fait défiler le nombre de jours, 100 max — ça
// prendra moins de place ».
//
// **Et pourquoi un `<select>` natif plutôt qu'une bande faite maison.** Sur son
// téléphone, c'est exactement la molette qu'il décrit : elle s'ouvre au bas de
// l'écran, se fait défiler au pouce, et occupe une seule ligne au repos. Une
// bande écrite à la main aurait le même aspect en moins fiable — et ne
// répondrait pas au lecteur d'écran.
//
// La demi-journée reste la première entrée : c'est le cas qui lui a manqué.
//
// **Pourquoi cette liste vit ici.** Elle était enfermée dans l'écran d'envoi.
// Le 4 août, le patron : « la durée du chantier, ½ journée plus bande déroulante
// max 100 jours, elle a disparu !!!! » — elle n'avait pas disparu, elle n'était
// qu'à un seul endroit, et pas celui où il la cherchait. Deux écrans la
// montrent désormais, avec la même liste : deux copies auraient divergé.

/**
 * **Deux cents jours depuis le 22 août 2026**, et c'est lui qui l'a relevé sur
 * la planche 91 : *« pour combien de temps prend ce chantier, faut mettre un
 * bandeau déroulant avec demi-journée et 1 à 200 jours »*.
 *
 * Cent venait de sa demande du 3 août — « 100 max » —, posée quand la molette
 * naissait. Elle a tenu jusqu'au jour où il a regardé le calendrier de ses
 * journées : un chantier de six mois se pose, et la liste s'arrêtait avant.
 */
export const DUREE_MAX_JOURS = 200;

export type ChoixDuree = { demiJournees: number; libelle: string };

export const DUREES: ChoixDuree[] = [
  { demiJournees: 1, libelle: "½ journée" },
  ...Array.from({ length: DUREE_MAX_JOURS }, (_, i) => ({
    demiJournees: (i + 1) * 2,
    // « 1 journée », pas « 1 jour » : c'est ainsi qu'on dit la durée d'un
    // chantier — « ça prend une journée », jamais « ça prend un jour ».
    // Correction demandée par le patron le 2026-08-04, sur capture.
    libelle: i === 0 ? "1 journée" : `${i + 1} jours`,
  })),
];
