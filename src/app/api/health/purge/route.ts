import { NextResponse } from "next/server";
import { etatDesPurges, HEURES_AVANT_ANOMALIE } from "@/server/journal-purge";
import { logger } from "@/server/logger";
import { idRequeteValideOuGenere, executerAvecContexte } from "@/server/request-context";

export const dynamic = "force-dynamic";

/**
 * LE MÉNAGE SE FAIT-IL ENCORE ?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI CETTE SONDE EST SÉPARÉE DE `/api/health/ready`.**
 *
 * C'était la tentation, et elle aurait été une faute. `ready` décide si
 * l'hébergeur envoie du trafic à cette instance : la faire rougir parce qu'une
 * purge est en retard **mettrait Atlas hors service**. Un artisan ne pourrait
 * plus ouvrir ses chantiers parce que des audios de la semaine dernière
 * traînent — la réponse est sans commune mesure avec le problème.
 *
 * Une purge en retard est une anomalie d'EXPLOITATION, pas une indisponibilité.
 * Elle a donc sa propre adresse, que l'on surveille sans que le produit en
 * dépende.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QU'ELLE RÉVÈLE, ET CE QU'ELLE NE RÉVÈLE PAS.**
 *
 * Elle est ouverte, comme les autres sondes de santé — le `matcher` du
 * middleware exclut `/api/health`, précisément pour qu'on puisse diagnostiquer
 * quand on ne peut plus entrer.
 *
 * Elle ne rend donc **aucune donnée d'artisan, aucun compteur métier, aucune
 * configuration** : une date, un nombre d'heures, un statut. Savoir qu'un
 * ménage a tourné cette nuit n'apprend rien à qui voudrait nuire.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **LE CODE HTTP EST LE SIGNAL.** 200 quand tout va, 503 sinon — c'est ce que
 * n'importe quelle sonde d'hébergeur sait lire sans qu'on lui apprenne à lire
 * du JSON. Le corps est là pour l'humain qui vient regarder après l'alerte.
 */
export async function GET(request: Request) {
  const requestId = idRequeteValideOuGenere(request.headers.get("x-request-id"));
  return executerAvecContexte({ requestId }, async () => {
    try {
      const etat = await etatDesPurges();

      // **Jamais de purge du tout est une ANOMALIE, pas un état neutre.** C'est
      // exactement l'état d'Atlas avant ce lot : le laisser passer pour « rien
      // à signaler » reproduirait le défaut qu'on corrige.
      if (etat.anormal) {
        logger.warn("Le ménage ne se fait plus", {
          dernierSucces: etat.dernierSucces?.toISOString() ?? null,
          heuresDepuis: etat.heuresDepuis,
        });
      }

      return NextResponse.json(
        {
          statut: etat.anormal ? "anomalie" : "ok",
          derniere_purge_reussie: etat.dernierSucces?.toISOString() ?? null,
          heures_depuis: etat.heuresDepuis === null ? null : Math.round(etat.heuresDepuis * 10) / 10,
          seuil_heures: HEURES_AVANT_ANOMALIE,
          // Écrit en toutes lettres : celui qui lit cette réponse à trois heures
          // du matin ne doit pas avoir à retrouver ce que le statut veut dire.
          explication: etat.dernierSucces
            ? etat.anormal
              ? `Aucune purge réussie depuis plus de ${HEURES_AVANT_ANOMALIE} h : les durées de conservation ne sont plus tenues.`
              : "Le ménage se fait."
            : "Aucune purge n'a JAMAIS réussi : le planificateur n'est pas branché.",
        },
        { status: etat.anormal ? 503 : 200, headers: { "x-request-id": requestId } }
      );
    } catch (err) {
      // **Une sonde qui ne peut pas mesurer ne répond pas « tout va bien ».**
      // Sans ce refus, une base injoignable rendrait un 200 rassurant — le faux
      // vert que tout ce lot existe pour empêcher.
      logger.error("État des purges illisible", { erreur: err });
      return NextResponse.json(
        { statut: "illisible", explication: "L'état des purges n'a pas pu être lu." },
        { status: 503, headers: { "x-request-id": requestId } }
      );
    }
  });
}
