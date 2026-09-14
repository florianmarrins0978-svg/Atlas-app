import GardeVerificationEmail from "@/components/atlas/GardeVerificationEmail";
import GardeDocumentsLegaux from "@/components/atlas/GardeDocumentsLegaux";
import GardeAcces from "@/components/atlas/GardeAcces";

/**
 * LES TROIS GARDES SE REJOUENT À CHAQUE DÉPLACEMENT — 14 septembre 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUE CE FICHIER RÉPARE, ET POURQUOI IL N'EST PAS DANS `layout.tsx`.**
 *
 * Les gardes vivaient dans la mise en page racine. Or Next.js ne rejoue pas
 * une mise en page quand on se déplace À L'INTÉRIEUR de l'application : un
 * appui sur un bouton change l'écran sans recharger la page, et la mise en
 * page — donc ses gardes — reste celle du premier chargement. Elles ne
 * s'exécutaient qu'à l'ouverture d'un onglet.
 *
 * Il l'a payé le jour même : compte créé, « Entrer dans Atlas », une heure de
 * travail — et les conditions générales ne lui sont parvenues qu'en
 * RECHARGEANT la page. La première correction avait fait pointer ce bouton
 * vers l'écran des conditions ; c'était boucher un chemin, pas fermer la
 * porte : le prochain bouton, le prochain écran, repasseraient à côté.
 *
 * **Un `template` est refait à chaque navigation**, pas seulement au premier
 * chargement — c'est sa seule différence avec une mise en page, et c'est
 * exactement celle qu'il faut. Posé à la racine, il enveloppe chaque écran :
 * aucun chemin, aujourd'hui ni demain, ne passe plus devant les gardes sans
 * les réveiller.
 *
 * **L'ordre ne bouge pas** : l'adresse prouvée, puis les conditions
 * acceptées, puis le rôle. On ne fait pas lire un contrat à quelqu'un dont on
 * ne sait pas s'il existe, et l'on ne juge pas le rôle d'un compte qui n'est
 * pas encore entré.
 *
 * **Ce qui reste dans `layout.tsx`, et pourquoi** : la charte et la barre de
 * navigation. Elles n'ont pas à être recalculées à chaque appui — ce sont des
 * habits, pas des portes.
 *
 * **Ce que cela coûte, dit franchement** : les lectures en base de ces trois
 * gardes se font désormais à chaque déplacement, et plus seulement à
 * l'ouverture. Quelques requêtes indexées par identifiant, sur des tables de
 * quelques lignes par compte — mesuré sur les suites, aucun écran ne s'en
 * ressent.
 *
 * **Ce qu'il ne change PAS** : après une ACTION serveur qui redirige (la
 * connexion), le second renvoi enchaîné rendait un écran blanc le 25 août
 * 2026 (`accueil-apres-connexion.ts`). La destination de la connexion se
 * choisit donc toujours là-bas, avant ; ce template ne fait que confirmer.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GardeVerificationEmail />
      <GardeDocumentsLegaux />
      <GardeAcces />
      {children}
    </>
  );
}
