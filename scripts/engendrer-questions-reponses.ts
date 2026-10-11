import { writeFileSync } from "node:fs";
import path from "node:path";
import { chercherFiches, ficheParId, fichesDeLEcran, visiteDemandee } from "../src/lib/mode-emploi";
import { QUESTIONS_PAR_ZONE } from "./_questions-mode-emploi";
import { jourIso } from "../src/lib/jour";

/**
 * La liste des questions auxquelles l'assistant sait répondre, et sa réponse.
 *
 *   npx tsx scripts/engendrer-questions-reponses.ts
 *
 * **Sa demande du 29 septembre 2026 :** *« sors-moi la liste des questions et
 * réponses auxquelles il est capable de répondre »*.
 *
 * **Engendrée, jamais écrite à la main.** Les questions sont celles que
 * `test-mode-emploi.ts` exige ; la réponse est la fiche que la recherche rend
 * vraiment, telle que l'assistant la récite. Recopiée à la main, la liste
 * dirait une chose et l'assistant une autre dès la première fiche corrigée.
 * Une question dont la fiche ne sort plus parmi les trois premières n'y entre
 * pas : la liste ne promet que ce que le contrôle tient.
 */

const TITRES: Record<string, string> = {
  securite: "La sécurité",
  fonctionnement: "Vos données",
  exploiter: "Tirer le maximum d'Atlas",
  planningExplique: "Le planning expliqué",
  artisan: "Questions d'artisan",
  lieux: "Où se trouve chaque chose",
  chantier: "Les chantiers et la dictée",
  devis: "Les devis",
  facture: "Les factures et la TVA",
  planning: "Le planning et les équipes",
  paysage: "Paysage, clients, diagnostic, arrosage",
  reglages: "Les réglages et l'assistant",
  anciennes: "Divers",
};
const ORDRE = Object.keys(TITRES);

function reponse(id: string): string {
  const f = ficheParId(id);
  if (!f) throw new Error(`fiche absente : ${id}`);
  // Comme le service le demande au modèle : l'endroit d'abord quand le geste
  // ne le dit pas, la réserve ensuite quand la fiche en porte une. Une fiche
  // qui informe (« Atlas ne voit jamais votre carte ») n'a pas d'endroit à
  // donner : seul un geste à faire en réclame un.
  const unGeste = /^(Touchez|Appuyez|Ouvrez|Glissez|Choisissez|Cochez|Dans|Sous|Sur|Depuis|À côté)/.test(f.geste);
  const ditDejaOu = /barre du bas|Réglages|Terminés|Planning|Chantiers|Paysage/.test(f.geste);
  const ou = unGeste && !ditDejaOu && f.ou.includes("«") ? `*${f.ou}.* ` : "";
  return `${ou}${f.geste}${f.reserve ? ` ${f.reserve}` : ""}`.replace(/\|/g, "/");
}

const zones = [...ORDRE, ...Object.keys(QUESTIONS_PAR_ZONE).filter((z) => !ORDRE.includes(z))];
let total = 0;
const sections: string[] = [];
for (const zone of zones) {
  const questions = (QUESTIONS_PAR_ZONE[zone] ?? []).filter(([q, id]) =>
    chercherFiches(q, 5).slice(0, 3).some((f) => f.id === id)
  );
  if (questions.length === 0) continue;
  total += questions.length;
  const lignes = questions.map(([q, id]) => `| ${q.charAt(0).toUpperCase()}${q.slice(1)} | ${reponse(id)} |`);
  sections.push(`## ${TITRES[zone] ?? zone}\n\n| Question | Réponse de l'assistant |\n|---|---|\n${lignes.join("\n")}`);
}

// **« Comment fonctionne le planning »** reçoit l'écran entier (sa colère du
// 29 septembre 2026) : l'assistant en présente les gestes, puis détaille celui
// qu'on lui redemande. La question passe par `visiteDemandee`, comme chez lui.
const VISITES = ["comment fonctionne le planning", "comment fonctionnent les chantiers", "comment fonctionne le devis", "comment fonctionne la facture", "comment fonctionne la tva", "comment fonctionne l'onglet terminés"];
const visites = VISITES.map((q) => {
  const ecran = visiteDemandee(q);
  if (!ecran) throw new Error(`« ${q} » n'ouvre plus de visite`);
  const gestes = fichesDeLEcran(ecran).map((f) => `- ${f.intitule}`).join("\n");
  return `### « ${q.charAt(0).toUpperCase()}${q.slice(1)} ? »\n\nIl présente l'écran ${ecran}, geste par geste, puis détaille celui qu'on lui redemande :\n\n${gestes}`;
});
sections.unshift(`## Comment fonctionne un écran\n\n${visites.join("\n\n")}`);

const texte = `# Ce que l'assistant sait répondre

*Engendré le ${jourIso(new Date())} par \`npx tsx scripts/engendrer-questions-reponses.ts\`.
Ne pas corriger à la main : corriger la fiche, puis relancer.*

**${total} questions**, posées comme un artisan les pose. Pour chacune, la
réponse est la fiche que l'assistant trouve et récite. Chaque fiche est
confrontée au code de l'application : le jour où un bouton change de nom, le
contrôle rougit au lieu de laisser l'assistant enseigner un geste mort.

Ce qui n'est pas dans cette liste, il le cherche dans le sommaire de ses
fiches. S'il ne trouve rien, il le dit, et donne l'adresse à qui écrire. Il
répond aussi sur vos données (qui vous doit, ce que vous avez encaissé, votre
planning), qu'il lit dans l'application : ces réponses-là changent chaque jour,
elles ne sont donc pas ici.

${sections.join("\n\n")}
`;

const sortie = path.join(__dirname, "..", "docs", "assistant-questions-reponses.md");
writeFileSync(sortie, texte);
console.log(`✅ ${total} questions écrites dans docs/assistant-questions-reponses.md`);
