import type { Civilite } from "./civilite";

/**
 * La fiche client porte-t-elle une saisie à ENREGISTRER avant d'en sortir ?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa remarque du 22 septembre 2026 :** *« Je crée un devis, je remplis la
 * fiche client, je fais retour, mais elle n'apparaît plus dans mes clients en
 * cours !! »*
 *
 * Depuis le 17 septembre, seul « Je rédige à la main » enregistrait : la flèche
 * de retour jetait ce qu'il venait de taper, sans un mot. Dans la feuille de
 * l'accueil, aucun chantier ne naissait ; sur la fiche rouverte depuis un devis,
 * le chantier restait « Chantier du … », sans son client.
 *
 * **Ce qui décide, c'est l'écart avec ce que l'écran portait en s'ouvrant** —
 * jamais « un champ est rempli ». Venu de la fiche d'un client, tout est déjà
 * posé : ressortir sans rien toucher ne doit créer aucun chantier. Et une
 * feuille ouverte par erreur puis refermée ne doit pas en laisser un vide.
 *
 * Les espaces ne comptent pas : un nom retouché d'un blanc n'est pas une saisie,
 * et l'enregistrement les retire de toute façon (`reprendreChantierAction`).
 */
export type SaisieFicheClient = {
  nomClient: string;
  civilite: Civilite | null;
  telephone: string;
  email: string;
  canal: "sms" | "email" | null;
  adresseChantier: string;
  adresseClient: string;
  /** Photos de la dernière fois qu'il a cochées : elles aussi partent à l'enregistrement. */
  photosCochees: number;
};

export function saisieAEnregistrer(depart: SaisieFicheClient, actuelle: SaisieFicheClient): boolean {
  const texte = (v: string) => v.trim();
  return (
    texte(actuelle.nomClient) !== texte(depart.nomClient) ||
    actuelle.civilite !== depart.civilite ||
    texte(actuelle.telephone) !== texte(depart.telephone) ||
    texte(actuelle.email) !== texte(depart.email) ||
    actuelle.canal !== depart.canal ||
    texte(actuelle.adresseChantier) !== texte(depart.adresseChantier) ||
    texte(actuelle.adresseClient) !== texte(depart.adresseClient) ||
    actuelle.photosCochees !== depart.photosCochees
  );
}
