import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantierPourHub } from "@/server/repositories/chantiers";

export const dynamic = "force-dynamic";

/**
 * Le devis est-il prêt ? — une question qu'on peut poser autant de fois qu'on
 * veut, sans rien déclencher.
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
 * « Atlas prépare le devis… », indéfiniment. Le rechargement n'a rien réparé :
 * il a simplement montré un devis déjà écrit.
 *
 * Un long aller-retour tenu ouvert est fragile par nature — un mandataire qui
 * coupe au bout d'une minute suffit à le perdre, et le travail continue sans
 * personne pour en recueillir le résultat. **On cesse donc d'en dépendre :**
 * l'écran demande périodiquement si le devis est là, et y va dès qu'il l'est.
 *
 * `devisGenereAt` est le bon témoin : il est posé au moment où le devis ET ses
 * lignes sont écrits (`repositories/devis.ts`). Avant lui, il n'y aurait rien à
 * montrer ; après lui, la page du devis a de quoi s'afficher.
 */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ chantierId: string }> }
) {
  const { chantierId } = await params;
  try {
    const ctx = await getCurrentCtx();
    const chantier = await getChantierPourHub(ctx, chantierId);
    if (!chantier) return NextResponse.json({ pret: false, connu: false }, { status: 404 });
    return NextResponse.json({ pret: !!chantier.devisGenereAt, connu: true }, { status: 200 });
  } catch {
    // **Ne jamais lever ici.** Cette route est interrogée en boucle depuis un
    // écran qui attend : une exception y ferait un flot d'erreurs sans qu'aucune
    // n'apprenne quoi que ce soit. Un « pas prêt » est la réponse honnête quand
    // on ne sait pas — l'écran continue d'attendre, puis renonce en le disant.
    return NextResponse.json({ pret: false, connu: false }, { status: 401 });
  }
}
