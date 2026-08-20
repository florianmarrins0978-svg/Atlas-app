import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentCtx } from "@/server/session-ctx";
import { db } from "@/server/db/client";
import { imagesPhyto } from "@/server/db/schema";
import { lireObjet } from "@/server/storage";

/**
 * Servir une image de référence de la base phytosanitaire.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi une route à part, et pas `/api/fichiers/[...key]`.**
 *
 * Celle-là vérifie la clé de stockage **contre l'entreprise du contexte** :
 * c'est ce qui protège les photos de chantier et les notes vocales. Ces
 * images-ci n'appartiennent à aucune entreprise — la base phytosanitaire est
 * commune, comme le catalogue de prestations. Les faire passer par le contrôle
 * d'entreprise aurait demandé de l'affaiblir, et `CLAUDE.md` §4 l'interdit :
 * on n'assouplit pas la RLS pour se simplifier la vie, on écrit le chemin qui
 * correspond au besoin.
 *
 * **Ce qui est quand même exigé : une session.** L'image n'est pas secrète,
 * mais elle n'a rien à faire en accès libre non plus — la liste des chemins
 * publics (`src/lib/chemins-publics.ts`) ne la porte pas, donc le middleware
 * exige déjà un compte. `getCurrentCtx()` est appelé pour que ce soit vrai même
 * si quelqu'un déplaçait cette route un jour.
 *
 * **On sert par IDENTIFIANT, jamais par clé de stockage.** Une route qui
 * accepterait une clé arbitraire laisserait quiconque a un compte lire
 * n'importe quel objet du stockage en devinant un chemin — y compris les photos
 * de diagnostic d'une autre société. Ici, seul ce que `images_phyto` désigne
 * peut sortir.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Un identifiant qui n'est pas un UUID ne peut désigner aucune ligne : on
  // refuse avant d'interroger la base, plutôt que de la laisser lever sur une
  // conversion de type.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ erreur: "Image introuvable." }, { status: 404 });
  }

  await getCurrentCtx();

  const [image] = await db
    .select({ storageKey: imagesPhyto.storageKey })
    .from(imagesPhyto)
    .where(eq(imagesPhyto.id, id))
    .limit(1);

  if (!image?.storageKey) {
    return NextResponse.json({ erreur: "Image introuvable." }, { status: 404 });
  }

  try {
    const octets = await lireObjet(image.storageKey);
    return new NextResponse(new Uint8Array(octets), {
      headers: {
        "Content-Type": typeDepuisCle(image.storageKey),
        // Une image de référence ne change pas : elle est remplacée par une
        // autre, avec un autre identifiant. On peut donc la garder longtemps —
        // et c'est ce qui la rend consultable sur un réseau de bord de route.
        "Cache-Control": "private, max-age=86400, immutable",
      },
    });
  } catch {
    return NextResponse.json({ erreur: "Image introuvable." }, { status: 404 });
  }
}

/** Le type est déduit de l'extension posée à l'import, qui est une liste blanche. */
function typeDepuisCle(cle: string): string {
  if (cle.endsWith(".png")) return "image/png";
  if (cle.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
