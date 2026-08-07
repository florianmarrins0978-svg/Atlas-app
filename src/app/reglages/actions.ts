"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { creerTarif, modifierTarif, supprimerTarif } from "@/server/repositories/tarifs";
import { exigerProprietaire } from "@/server/autorisation";
import { mettreAJourEntreprise } from "@/server/repositories/entreprises";
import { versionExecutee } from "@/server/version-executee";

export async function creerTarifAction(intitule: string, prix: string) {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "créer un tarif");
  return creerTarif(ctx, { intitule, prix });
}

export async function modifierTarifAction(id: string, data: { intitule?: string; prix?: string; unite?: string }) {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "modifier un tarif");
  return modifierTarif(ctx, id, data);
}

export async function supprimerTarifAction(id: string) {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "supprimer un tarif");
  return supprimerTarif(ctx, id);
}

/**
 * Combien de chantiers l'entreprise mène de front.
 *
 * C'est ce nombre qui autorise deux interventions le même jour — le patron :
 * « si j'ai deux équipes dans ma boîte, je peux avoir deux chantiers le
 * 6 août ». La borne est appliquée dans le dépôt, pas ici : zéro équipe rendrait
 * tout jour indisponible sans qu'aucun écran ne dise pourquoi.
 */
export async function mettreAJourNombreEquipesAction(nombreEquipes: number) {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "modifier le nombre d'équipes");
  const e = await mettreAJourEntreprise(ctx, { nombreEquipes });
  return { nombreEquipes: e?.nombreEquipes ?? 1 };
}

/**
 * Va chercher le code neuf, sans quitter l'application.
 *
 * **Pourquoi ce bouton existe, et pourquoi il vaut son risque.** Trois soirées
 * ont été perdues sur le même malentendu : le patron essaie des correctifs
 * livrés une heure plus tôt, ne voit aucun changement, et conclut — légitimement
 * — que rien n'a été corrigé. L'espace de travail ne récupère le code neuf
 * qu'au DÉMARRAGE (`postStartCommand`) ; recharger la page du navigateur ne le
 * redémarre pas, et rien ne le disait.
 *
 * Le 6 août 2026, au troisième signalement : « tu as corrigé aucun problème, ou
 * alors j'ai quelque chose à faire pour que le terminal ouvre la dernière mise
 * à jour ? » La question était juste, et la réponse était oui — ce qui est une
 * mauvaise réponse. Elle n'a plus lieu d'être.
 *
 * **Banc d'essai uniquement.** Une application déployée ne se met pas à jour
 * elle-même en tirant du code : ce serait une porte d'entrée. La garde est
 * `ATLAS_BANC_ESSAI`, posée dans le seul `.devcontainer/docker-compose.yml`.
 *
 * La prudence vit dans `mettre-a-jour.sh`, déjà éprouvé : jamais par-dessus du
 * travail non enregistré, jamais en forçant, jamais sur un dépôt injoignable.
 */
export type ResultatMiseAJour = { succes: true; etat: string; message: string } | { succes: false; erreur: string };

export async function mettreAJourApplicationAction(): Promise<ResultatMiseAJour> {
  await getCurrentCtx(); // Réservé à quelqu'un de connecté, comme le reste de l'écran.

  if (process.env.ATLAS_BANC_ESSAI !== "1") {
    return { succes: false, erreur: "La mise à jour depuis l'écran n'existe que sur le banc d'essai." };
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const executer = promisify(execFile);
  const racine = process.cwd();

  try {
    const { stdout } = await executer("bash", [`${racine}/.devcontainer/mettre-a-jour.sh`, racine], {
      timeout: 120_000,
    });
    const etat = stdout.trim().split("\n").pop() ?? "";

    if (etat === "faite") {
      // Le code neuf peut attendre une base neuve : servir l'un sans l'autre
      // produit une panne, pas un correctif.
      await executer("npm", ["run", "db:migrate", "--silent"], { cwd: racine, timeout: 180_000 }).catch(() => undefined);
      return {
        succes: true,
        etat,
        message: `Mise à jour récupérée${await suffixeVersion()}. Rechargez la page dans quelques secondes : l'application se recompile.`,
      };
    }
    if (etat.startsWith("impossible")) {
      return { succes: false, erreur: `Mise à jour ${etat}` };
    }
    return { succes: true, etat, message: `Vous étiez déjà à jour${await suffixeVersion()}.` };
  } catch (e) {
    return { succes: false, erreur: e instanceof Error ? e.message.slice(0, 200) : "La mise à jour a échoué." };
  }
}

/**
 * La version obtenue, dite par le bouton lui-même.
 *
 * « Vous étiez déjà à jour » ne prouve rien tout seul — c'est précisément la
 * phrase qu'affiche un espace resté en arrière. Nommer le commit obtenu permet
 * de le comparer à celui annoncé dans le message de livraison, sans terminal.
 *
 * Non exporté : un module `"use server"` n'expose que des fonctions appelables
 * depuis le navigateur, et celle-ci n'a aucune raison de l'être.
 */
async function suffixeVersion(): Promise<string> {
  const version = await versionExecutee();
  return version ? ` — version ${version}` : "";
}
