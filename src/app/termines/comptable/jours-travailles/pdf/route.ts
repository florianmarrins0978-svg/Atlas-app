import { NextResponse } from "next/server";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerOuverture } from "@/server/garde-route";
import { peutOuvrir } from "@/server/autorisation";
import { moisDesSalaries } from "@/server/repositories/jours-travailles";
import { pdfDesJoursTravailles } from "@/server/pdf/jours-travailles-pdf";
import { enTetesDeRemise, veutTelecharger } from "@/lib/remise-de-fichier";
import { jourIso } from "@/lib/jour";
import { moisDuJour, moisValide, nomDuMois } from "@/lib/jours-travailles";

/**
 * LE PDF DES JOURS TRAVAILLÉS D'UN MOIS — « Envoyer à mon comptable ». Il lit le
 * même chargement que l'écran (`moisDesSalaries`), sous la RLS, et il est
 * réservé à qui ouvre Pour mon comptable. Rien ne part sans son appui : la
 * feuille de partage du téléphone envoie, pas Atlas.
 */
export async function GET(req: Request) {
  const ctx = await getCurrentCtx();
  const refus = await exigerOuverture(ctx);
  if (refus) return refus;
  if (!(await peutOuvrir(ctx, "/termines/comptable"))) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const maintenant = new Date();
  const ceMois = moisDuJour(jourIso(maintenant));
  const demande = new URL(req.url).searchParams.get("mois");
  if (!moisValide(demande) || demande > ceMois) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const lu = await moisDesSalaries(ctx, demande);
  const prepareLe = maintenant.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  const octets = await pdfDesJoursTravailles(lu, demande === ceMois, prepareLe);
  const nom = nomDuMois(demande);
  return new NextResponse(new Uint8Array(octets), {
    headers: {
      ...enTetesDeRemise({
        telecharger: veutTelecharger(req.url),
        nom: `Jours travaillés, ${nom.charAt(0).toUpperCase() + nom.slice(1)}.pdf`,
        type: "application/pdf",
      }),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
