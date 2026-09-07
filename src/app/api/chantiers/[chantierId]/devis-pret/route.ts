import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { getChantierPourHub } from "@/server/repositories/chantiers";
import { listerLignesPrix } from "@/server/repositories/lignes-prix";
import { questionsRestantes } from "@/server/services/devis-depuis-dictee";

export const dynamic = "force-dynamic";

/**
 * Où en est la préparation ? — une question qu'on peut poser autant de fois
 * qu'on veut, sans rien déclencher.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi elle existe.** Le patron, le 12 août 2026 : *« entre le moment où
 * je clique mon devis et le moment où le devis apparaît, la première fois il
 * s'est passé plus de six minutes et j'ai dû recharger la page pour que le
 * devis arrive. »*
 *
 * **Le serveur, lui, avait fini depuis longtemps.** Chaque appel à un modèle
 * est borné à trente secondes ; la chaîne entière ne peut pas durer six
 * minutes. Ce qui a duré six minutes, c'est SON ATTENTE — la réponse de
 * l'action n'est jamais revenue jusqu'à sa page, et le bouton est resté sur
 * « Atlas prépare le devis… », indéfiniment.
 *
 * Un long aller-retour tenu ouvert est fragile par nature — un mandataire qui
 * coupe au bout d'une minute suffit à le perdre, et le travail continue sans
 * personne pour en recueillir le résultat. **On cesse donc d'en dépendre :**
 * l'écran demande périodiquement où en est la préparation, et agit dès qu'elle
 * a quelque chose à lui montrer.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **ELLE RÉPONDAIT SUR LE MAUVAIS TÉMOIN — sa capture du 1ᵉʳ septembre 2026.**
 *
 * Elle lisait `devisGenereAt`. Deux défauts, et les deux ont mordu :
 *
 * 1. **Ce témoin est posé par la PAGE, pas par la chaîne.** `getOuCreerDevisBrouillon`
 *    l'écrit (`repositories/devis.ts`), et l'écran du devis l'appelle en
 *    s'ouvrant. Sur cette page, la route répondait donc « prêt » avant que la
 *    dictée ait produit la moindre ligne : l'attente s'arrêtait sur une feuille
 *    vide.
 * 2. **Il ne dit rien des cinq autres issues de la chaîne.** Elle s'arrête
 *    légitimement sans écrire de devis quand la dictée n'est pas transcrite,
 *    quand le brouillon a été corrigé à la main, quand elle échoue, et surtout
 *    **quand elle atteint l'arrêt d'avant-chiffrage** — l'endroit où elle lui
 *    pose les deux questions qui valent 800 € sur un abattage. C'est le cas le
 *    plus fréquent d'une vraie dictée, et l'attente ne pouvait alors jamais
 *    aboutir : cinq minutes de compteur devant un serveur qui avait fini.
 *
 * **Elle répond donc désormais sur ce que l'ÉCRAN regarde** — le nombre de
 * lignes, exactement le critère de `devis-a-preparer.ts` (`CLAUDE.md` §3 : une
 * seule lecture d'une même question) — **et elle rapporte l'arrêt**, avec ses
 * questions, pour que le patron puisse y répondre au lieu d'attendre en vain.
 *
 * `questionsRestantes` est LA fonction du service, pas une seconde rédaction :
 * une copie ici poserait des questions que la chaîne ne pose pas, ou l'inverse.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ chantierId: string }> }
) {
  const { chantierId } = await params;
  try {
    const ctx = await getCurrentCtx();
    // Le rôle referme ce que la barre du bas ne montre plus : une adresse d'API
    // se tape, et une page retirée du sommaire répondait quand même.
    const refus = await exigerOuverture(ctx);
    if (refus) return refus;
    const chantier = await getChantierPourHub(ctx, chantierId);
    if (!chantier) return NextResponse.json({ pret: false, connu: false }, { status: 404 });

    const lignes = await listerLignesPrix(ctx, chantierId);
    if (lignes.length > 0) {
      return NextResponse.json({ pret: true, connu: true, questions: [] }, { status: 200 });
    }

    // **Les prestations en base font foi, et le brouillon n'est pas relu ici.**
    // Sans prestation écrite, la chaîne n'a pas atteint son arrêt : la liste
    // revient vide, et l'attente continue — ce qui est la bonne réponse.
    const questions = await questionsRestantes(ctx, chantierId, []);
    return NextResponse.json({ pret: false, connu: true, questions }, { status: 200 });
  } catch {
    // **Ne jamais lever ici.** Cette route est interrogée en boucle depuis un
    // écran qui attend : une exception y ferait un flot d'erreurs sans qu'aucune
    // n'apprenne quoi que ce soit. Un « pas prêt » est la réponse honnête quand
    // on ne sait pas — l'écran continue d'attendre, puis renonce en le disant.
    return NextResponse.json({ pret: false, connu: false }, { status: 401 });
  }
}
