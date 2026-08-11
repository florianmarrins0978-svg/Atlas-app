"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { creerTarif, listerTarifs, modifierTarif, supprimerTarif } from "@/server/repositories/tarifs";
import { lireFichierTarifs } from "@/server/import/lire-fichier-tarifs";
import { montantLu, rapprocher, type LigneImportee, type TarifExistant } from "@/lib/import-tarifs";
import { exigerProprietaire } from "@/server/autorisation";
import { mettreAJourEntreprise } from "@/server/repositories/entreprises";
import { nommerEquipe } from "@/server/repositories/equipes";
import { versionExecutee } from "@/server/version-executee";
import { issueApresMiseAJour } from "@/lib/issue-mise-a-jour";

/**
 * Écrire — ou effacer — le nom d'une équipe, par son RANG.
 *
 * **Vider le champ remet `null`, jamais une chaîne vide** : la base ne doit
 * porter qu'une seule façon de dire « pas de nom », sans quoi `libelleEquipe`
 * devrait connaître les deux. Effacer un nom, c'est revenir au repli
 * « Équipe B » — un état normal (`ARCHITECTURE.md` §51).
 */
export async function nommerEquipeAction(rang: number, nom: string) {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "nommer une équipe");
  const enregistree = await nommerEquipe(ctx, rang, nom);
  return { rang: enregistree.rang, nom: enregistree.nom };
}

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

// --- Reprendre une liste de prix déjà existante ----------------------------
//
// Le patron, le 8 août 2026 : *« si l'utilisateur a déjà un fichier Excel ou un
// PDF avec ces lignes de prix, il doit pouvoir le rentrer dans les réglages via
// une touche, et que les prix s'ajoutent automatiquement. »*
//
// **Deux actions, et cette séparation EST la garantie.** La première lit et
// n'écrit rien ; la seconde écrit ce que le patron a validé. Un import en un
// seul geste aurait remplacé ses tarifs par ceux d'un fichier mal lu, sans
// qu'il l'ait vu passer — et ces tarifs-là partent sur les devis de ses clients.

export type ApercuImport =
  | { statut: "refuse"; raison: string }
  | {
      statut: "lu";
      format: "csv" | "excel";
      aCreer: LigneImportee[];
      aMettreAJour: { id: string; avant: TarifExistant; apres: LigneImportee }[];
      inchangees: LigneImportee[];
      ecartees: { contenu: string; raison: string }[];
    };

/** Lit le fichier et dit ce qu'il ferait. **N'écrit rien.** */
export async function analyserFichierTarifsAction(donnees: FormData): Promise<ApercuImport> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "importer une liste de tarifs");

  const fichier = donnees.get("fichier");
  if (!(fichier instanceof File)) return { statut: "refuse", raison: "Aucun fichier reçu." };
  // Une borne franche : au-delà, ce n'est plus une liste de prix, et un fichier
  // de cent mégaoctets tiendrait la mémoire du serveur pour rien.
  if (fichier.size > 5_000_000) {
    return { statut: "refuse", raison: "Ce fichier dépasse 5 Mo — ce n'est probablement pas une liste de prix." };
  }

  const lecture = lireFichierTarifs(fichier.name, new Uint8Array(await fichier.arrayBuffer()));
  if (lecture.statut === "refuse") return lecture;

  const existants = await listerTarifs(ctx);
  const rapprochement = rapprocher(
    existants.map((t) => ({ id: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite })),
    lecture.lecture.retenues
  );
  return { statut: "lu", format: lecture.format, ...rapprochement, ecartees: lecture.lecture.ecartees };
}

/**
 * Écrit ce que le patron vient de valider.
 *
 * **Rien n'est repris du navigateur sans être relu.** Les montants sont
 * revalidés ici par la même fonction que la lecture : un aperçu falsifié côté
 * client n'écrira donc pas un prix que le serveur n'aurait pas accepté.
 *
 * Les mises à jour sont désignées par l'identifiant du tarif existant, et
 * `modifierTarif` passe par `withEntreprise` : un identifiant appartenant à une
 * autre entreprise ne modifie rien, silencieusement — c'est l'isolation qui
 * tient, pas une vérification de plus.
 */
export async function appliquerImportTarifsAction(choix: {
  creer: LigneImportee[];
  mettreAJour: { id: string; apres: LigneImportee }[];
}): Promise<{
  crees: number;
  misAJour: number;
  refuses: number;
  /**
   * La liste complète après écriture.
   *
   * Rendue par le serveur plutôt que reconstruite par l'écran : c'est lui qui a
   * écrit, et lui seul sait ce qui l'a été. Un écran qui devine le résultat
   * afficherait un tarif refusé au dernier contrôle comme s'il existait.
   */
  tarifs: TarifExistant[];
}> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "importer une liste de tarifs");

  let crees = 0;
  let misAJour = 0;
  let refuses = 0;

  for (const ligne of choix.creer ?? []) {
    const prix = montantLu(ligne.prix);
    const intitule = ligne.intitule?.trim();
    if (!prix || !intitule) {
      refuses++;
      continue;
    }
    await creerTarif(ctx, { intitule, prix, ...(ligne.unite?.trim() ? { unite: ligne.unite.trim() } : {}) });
    crees++;
  }

  for (const { id, apres } of choix.mettreAJour ?? []) {
    const prix = montantLu(apres.prix);
    if (!prix || !id) {
      refuses++;
      continue;
    }
    await modifierTarif(ctx, id, { prix, ...(apres.unite?.trim() ? { unite: apres.unite.trim() } : {}) });
    misAJour++;
  }

  const tarifs = await listerTarifs(ctx);
  return {
    crees,
    misAJour,
    refuses,
    tarifs: tarifs.map((t) => ({ id: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite })),
  };
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
    await noterIssue(etat);

    if (etat === "faite") {
      // **Le code neuf attend une base neuve, et l'échec ne s'avale plus.**
      //
      // Cet appel lançait `npm run db:migrate` avec la variable ambiante — donc
      // sous `atlas_app`, le rôle applicatif, qui n'a délibérément aucun droit
      // de créer une table. Il échouait sur « permission denied for schema
      // public », et le `.catch(() => undefined)` faisait disparaître l'échec :
      // le patron lisait « Mise à jour récupérée », puis un écran tombait sur
      // une table absente sans que rien ne relie les deux (9 août 2026).
      //
      // Le script choisit maintenant le rôle propriétaire et rend son verdict.
      const migrations = await executer(
        "bash",
        [`${racine}/.devcontainer/appliquer-migrations.sh`, racine],
        { timeout: 180_000 }
      )
        .then((r) => r.stdout.trim().split("\n").pop() ?? "")
        .catch((e) => `échec : ${e instanceof Error ? e.message : String(e)}`);

      if (migrations.startsWith("échec")) {
        // Succès de la récupération, échec de la base : le dire tel quel. Une
        // demi-vérité sur cet écran envoie chercher la panne au mauvais endroit.
        return {
          succes: true,
          etat,
          message:
            `Code récupéré${await suffixeVersion()}, mais LA BASE N'A PAS SUIVI — ${migrations}. ` +
            `Les écrans qui touchent une table neuve vont tomber : c'est ça, et rien d'autre.`,
        };
      }

      // **La version RAPIDE ne se recompile jamais**, et ce message le
      // promettait. La règle — quoi dire, et s'il faut couper le serveur pour
      // que le code neuf soit servi — vit dans `src/lib/issue-mise-a-jour.ts`,
      // où elle s'éprouve sans base ni serveur.
      //
      // `NODE_ENV` tranche sans ambiguïté : `next start` impose `production`,
      // c'est écrit dans `demarrer.sh`.
      const issue = issueApresMiseAJour({
        versionBatie: process.env.NODE_ENV === "production",
        veilleurPresent: await veilleurEnVie(),
        suffixeVersion: await suffixeVersion(),
      });
      if (issue.couperLeServeur) programmerReconstruction();
      return { succes: true, etat, message: issue.message };
    }
    if (etat.startsWith("impossible")) {
      return { succes: false, erreur: `Mise à jour ${etat}` };
    }
    return { succes: true, etat, message: `Vous étiez déjà à jour${await suffixeVersion()}.` };
  } catch (e) {
    const raison = e instanceof Error ? e.message.slice(0, 200) : "la mise à jour a échoué";
    await noterIssue(`impossible : ${raison}`);
    return { succes: false, erreur: raison };
  }
}

/**
 * L'issue du dernier essai, déposée là où elle survit à la réponse.
 *
 * **Pourquoi un fichier et pas seulement la réponse de l'action.** Tirer le
 * code neuf remplace des centaines de fichiers sous le serveur en train de
 * tourner : il se recompile aussitôt, et la réponse en cours de route est
 * coupée. Le patron a donc lu « La mise à jour n'a pas abouti » sur une mise à
 * jour qui, elle, avait parfaitement abouti — et il est reparti redémarrer un
 * espace qui n'en avait pas besoin.
 *
 * L'issue est écrite AVANT que quoi que ce soit puisse couper la réponse.
 * L'écran la relit au rendu suivant : la vérité ne dépend plus d'une connexion
 * qui tient.
 *
 * **Dans `/tmp`, jamais dans le dépôt** — un fichier déposé à la racine rendrait
 * l'arbre git sale, et `mettre-a-jour.sh` refuserait *toutes* les mises à jour
 * suivantes en disant « des modifications non enregistrées sont présentes ».
 * Le remède aurait créé la panne, définitivement.
 */
/**
 * Le veilleur est-il là pour relever le serveur qu'on s'apprête à couper ?
 *
 * Son verrou porte un identifiant de processus, précisément pour qu'un fichier
 * resté d'un conteneur précédent ne mente pas (`veiller.sh`). On vérifie donc
 * que le processus vit, pas que le fichier existe.
 */
async function veilleurEnVie(): Promise<boolean> {
  try {
    const { readFile } = await import("node:fs/promises");
    const pid = Number((await readFile("/tmp/atlas-veilleur.pid", "utf8")).trim());
    if (!Number.isInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0); // Ne tue rien : demande seulement s'il existe.
    return true;
  } catch {
    return false;
  }
}

/**
 * Coupe le serveur bâti — après avoir rendu sa réponse.
 *
 * **Le délai n'est pas une précaution vague** : sans lui, on tuerait le
 * processus en train d'écrire la réponse, et le patron lirait un échec sur une
 * mise à jour réussie — le malentendu exact que cet écran existe pour éteindre.
 *
 * Détaché et délié : l'ordre doit survivre à la mort de celui qui le donne.
 *
 * Le motif ne vise QUE la version bâtie (`next-server`, `next start`) : un
 * `next dev` n'a rien à faire ici, et cette branche ne s'exécute de toute façon
 * qu'en production.
 */
function programmerReconstruction(): void {
  void import("node:child_process").then(({ spawn }) => {
    const enfant = spawn(
      "bash",
      ["-c", 'sleep 3; pkill -f "[n]ext(-server| start)" 2>/dev/null || true'],
      { detached: true, stdio: "ignore" }
    );
    enfant.unref();
  });
}

// Non exporté : un module `"use server"` n'expose QUE des fonctions async — une
// constante exportée ici fait échouer la compilation.
const FICHIER_ISSUE = "/tmp/atlas-mise-a-jour.txt";

async function noterIssue(etat: string): Promise<void> {
  try {
    const { writeFile } = await import("node:fs/promises");
    const heure = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    await writeFile(FICHIER_ISSUE, `${heure} — ${etat}\n`, "utf8");
  } catch {
    // Ne jamais faire échouer une mise à jour parce qu'on n'a pas pu noter son
    // issue : le journal sert le diagnostic, il ne commande rien.
  }
}

/** Ce que le dernier essai a donné, pour l'écran. `null` si aucun essai. */
export async function derniereIssueMiseAJour(): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    return (await readFile(FICHIER_ISSUE, "utf8")).trim() || null;
  } catch {
    return null;
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
