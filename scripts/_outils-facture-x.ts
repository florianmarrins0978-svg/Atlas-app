// LES CONTRÔLEURS OFFICIELS D'UNE FACTUR-X, posés une fois dans un cache.
//
// Une Factur-X se juge sur deux pièces, et aucune ne s'écrit à la main :
//
// | | ce qu'il juge | d'où il vient |
// |---|---|---|
// | les règles EN 16931 (XSLT) et le schéma CII D16B | le XML : forme, totaux, TVA | ConnectingEurope/eInvoicing-EN16931, la Commission européenne |
// | veraPDF | le PDF : PDF/A-3, polices, couleurs, fichier joint | le validateur de référence de la PDF Association |
//
// **Versions FIXÉES.** Une règle qui change sous nos pieds ferait rougir une
// facture d'hier sans qu'une ligne d'Atlas ait bougé ; on monte de version
// exprès, en le disant.
//
// **Rien n'entre dans le dépôt** : 27 Mo de bibliothèques Java et 10 Mo de
// règles vivent dans `~/.cache/atlas-facture-x` (ou `ATLAS_OUTILS_FACTURE_X`),
// récupérés au premier besoin par Maven et git, puis relus tels quels.
//
// **Maven et git ne sont exigés QUE là où ils servent** : au premier besoin.
// Un cache déjà posé se relit avec Java seul, et une machine qui n'a ni l'un ni
// l'autre mesure quand même (`test-outil-requis.ts`, « un outil déclaré est un
// outil appelé »).
import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { exigerLesOutils } from "./_outil-requis";

export const VERSIONS = {
  verapdf: "1.28.2",
  saxon: "12.5",
  // Schematron 1.3.17, mis à jour le 9 octobre 2026.
  en16931: "b17b2695e5e3e021945c38658326b78a76f80f84",
};

const DEPOT_EN16931 = "https://github.com/ConnectingEurope/eInvoicing-EN16931.git";

export function dossierDesOutils(): string {
  return process.env.ATLAS_OUTILS_FACTURE_X || path.join(os.homedir(), ".cache", "atlas-facture-x");
}

function jouer(commande: string, args: string[], options: SpawnSyncOptions = {}): string {
  exigerLesOutils(commande);
  const r = spawnSync(commande, args, { timeout: 10 * 60 * 1000, ...options, encoding: "utf8" });
  if (r.status !== 0) {
    const sortie = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(-6).join("\n");
    throw new Error(`« ${commande} ${args.slice(0, 3).join(" ")} » a échoué (code ${r.status}).\n${sortie}`);
  }
  return r.stdout;
}

function bibliotheques(racine: string): string {
  const lib = path.join(racine, "lib");
  const attendus = [`Saxon-HE-${VERSIONS.saxon}.jar`, `greenfield-apps-${VERSIONS.verapdf}.jar`];
  const presents = existsSync(lib) ? readdirSync(lib) : [];
  if (attendus.every((a) => presents.includes(a))) return lib;
  mkdirSync(racine, { recursive: true });
  writeFileSync(
    path.join(racine, "pom.xml"),
    `<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion>
<groupId>atlas</groupId><artifactId>outils-facture-x</artifactId><version>1</version>
<dependencies>
<dependency><groupId>org.verapdf.apps</groupId><artifactId>greenfield-apps</artifactId><version>${VERSIONS.verapdf}</version></dependency>
<dependency><groupId>net.sf.saxon</groupId><artifactId>Saxon-HE</artifactId><version>${VERSIONS.saxon}</version></dependency>
</dependencies></project>
`
  );
  jouer("mvn", ["-q", "dependency:copy-dependencies", `-DoutputDirectory=${lib}`], { cwd: racine });
  return lib;
}

function regles(racine: string): { xslt: string; xsd: string } {
  const depot = path.join(racine, `en16931-${VERSIONS.en16931.slice(0, 12)}`);
  const xslt = path.join(depot, "cii", "xslt", "EN16931-CII-validation.xslt");
  const xsd = path.join(
    depot,
    "cii",
    "schema",
    "D16B SCRDM (Subset)",
    "uncoupled clm",
    "CII",
    "uncefact",
    "data",
    "standard",
    "CrossIndustryInvoice_100pD16B.xsd"
  );
  if (existsSync(xslt) && existsSync(xsd)) return { xslt, xsd };
  mkdirSync(racine, { recursive: true });
  if (!existsSync(depot)) jouer("git", ["clone", "-q", "--filter=blob:none", "--no-checkout", DEPOT_EN16931, depot]);
  jouer("git", ["-C", depot, "sparse-checkout", "set", "cii/schema", "cii/xslt"]);
  jouer("git", ["-C", depot, "checkout", "-q", VERSIONS.en16931]);
  return { xslt, xsd };
}

/** Les chemins des contrôleurs, récupérés au besoin. Lève avec la commande fautive. */
export function outilsFactureX(): { classpath: string; xslt: string; xsd: string } {
  const racine = dossierDesOutils();
  const lib = bibliotheques(racine);
  const { xslt, xsd } = regles(racine);
  return { classpath: path.join(lib, "*"), xslt, xsd };
}
