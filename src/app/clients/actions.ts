"use server";

import { exigerMontants } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { apercuSuppressionClient } from "@/server/repositories/donnees-client";

/**
 * CE QUE LA SUPPRESSION DE PLUSIEURS CLIENTS LAISSERAIT, sans rien toucher.
 *
 * Sa demande du 23 octobre 2026 : cocher plusieurs clients et les supprimer
 * d'un coup, *« avec la même mention de sécurité que pour un client »*. La
 * fiche lit `apercuSuppressionClient` en se dessinant ; la liste, elle, ne le
 * lit qu'à l'ouverture de la feuille : le faire pour chaque client à chaque
 * affichage de la liste coûterait quatre requêtes par nom pour un geste rare.
 *
 * **La suppression elle-même n'a pas de seconde version.** La liste rejoue
 * `supprimerClientAction`, client par client : une règle d'effacement écrite
 * deux fois finirait par diverger, et c'est elle qui tient ce que la loi garde.
 */
export async function apercuSuppressionClientsAction(
  clientIds: string[]
): Promise<
  | {
      ok: true;
      clients: { id: string; nom: string; documents: number; conserve: { numero: string; pourquoi: string }[] }[];
    }
  | { ok: false; message: string }
> {
  const ctx = await getCurrentCtx();
  await exigerMontants(ctx, "supprimer un client");

  const clients = [];
  try {
    for (const id of new Set(clientIds)) {
      const apercu = await apercuSuppressionClient(ctx, id);
      // Un client déjà parti (une autre session, un autre onglet) ne se
      // supprime plus : il quitte simplement la feuille.
      if (!apercu) continue;
      clients.push({
        id,
        nom: apercu.nom,
        documents: apercu.documents,
        conserve: apercu.pieces.map((p) => ({ numero: p.numero, pourquoi: p.pourquoi })),
      });
    }
  } catch (err) {
    // **Une panne imprévue se journalise AVANT de rendre une phrase**
    // (`AGENTS.md` : rendre le défaut bavard).
    console.error("[apercuSuppressionClientsAction] échec", { clientIds, err });
    return { ok: false, message: "Impossible de préparer la suppression. Rien n'a été retiré. Réessayez." };
  }
  return { ok: true, clients };
}
