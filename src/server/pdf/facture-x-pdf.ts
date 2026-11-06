import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFArray, PDFDocument, PDFHexString, PDFName, PDFString, type PDFRef } from "pdf-lib";
import { xmlFactureX } from "@/lib/facture-x";
import { estUneEntreprise } from "@/lib/civilite";
import { logger } from "@/server/logger";
import {
  composerFacturePdf,
  genererPdfFacture,
  mentionLegaleFacture,
  type FacturePdfData,
  type OptionsFacturePdf,
} from "./facture-pdf";
import type { AttestationDocument } from "./document-commun";

/**
 * LA FACTUR-X : le PDF de la facture, rendu PDF/A-3, avec son XML dedans.
 *
 * **Sa décision du 5 novembre 2026** (`ARCHITECTURE.md` §555) : Atlas fabrique
 * la facture électronique d'un client entreprise. Le client ouvre un PDF comme
 * aujourd'hui ; un logiciel, ou la plateforme agréée, lit le fichier
 * `factur-x.xml` joint (`src/lib/facture-x.ts`).
 *
 * **Ce que la norme PDF/A-3 exige, et où chaque exigence se tient :**
 *
 * | exigence | où |
 * |---|---|
 * | toutes les polices embarquées | `composerDocument`, option `archivable` (Liberation renommée pour la typographie d'origine) |
 * | aucun chiffrement, donc **aucun verrou** | `archivable` encore : la facture d'une entreprise ne porte pas le verrou du 31 août |
 * | un profil de couleur de sortie | `srgb.icc`, sRGB écrit par LittleCMS |
 * | des métadonnées XMP qui disent PDF/A-3B et Factur-X, d'accord avec le dictionnaire `Info` | ici, une seule date pour les deux |
 * | un identifiant de fichier dans la remorque | ici, tiré du XML et de la date |
 * | chaque fichier joint relié au catalogue (`/AF`) avec sa relation | ici : le XML en `Alternative`, l'attestation en `Supplement` |
 *
 * **L'attestation décennale devient un fichier joint**, au lieu des pages
 * recopiées de la facture ordinaire : un PDF d'assureur porte souvent des
 * polices non embarquées, et il ferait d'un coup échouer la pièce entière.
 *
 * **`Alternative` pour le XML** : le XML porte la facture entière (profil
 * EN 16931). C'est la valeur que les règles allemandes exigent et que les
 * règles françaises admettent ; `Data` était l'ancienne consigne française.
 *
 * Jugé par veraPDF, profil 3b, et le XML par les règles officielles :
 * `scripts/test-facture-x.ts`.
 */

export type ResultatPdfFactureX = { ok: true; pdf: Uint8Array; xml: string } | { ok: false; raison: string };

export async function fabriquerFactureX(
  data: FacturePdfData,
  options: OptionsFacturePdf = {},
  maintenant: Date = new Date()
): Promise<ResultatPdfFactureX> {
  const r = xmlFactureX(data, mentionLegaleFacture(data));
  if (!r.ok) return r;
  const { pdf } = await composerFacturePdf(data, { ...options, archivable: true });
  const octets = await enPdfA3(pdf, r.xml, {
    titre: `Facture ${data.numeroCommercial}`,
    auteur: data.entrepriseNom,
    attestation: options.attestation ?? null,
    date: maintenant,
  });
  return { ok: true, pdf: octets, xml: r.xml };
}

/**
 * LA PIÈCE QUI PART À L'ÉMISSION : une Factur-X pour une entreprise, le PDF
 * verrouillé pour les autres.
 *
 * **Pour qui** (`ARCHITECTURE.md` §555) : la plateforme ne transmet comme
 * facture que celle d'une entreprise. Un particulier n'en reçoit que les
 * chiffres, une mairie passe par Chorus Pro : tous deux gardent le verrou du
 * 31 août, que la Factur-X ne peut pas porter. `estUneEntreprise` laisse déjà
 * la mairie dehors.
 *
 * **Quand la règle refuse** (une adresse sans code postal, un numéro de TVA
 * absent), la pièce part en PDF ordinaire et le refus se journalise avec sa
 * raison. C'est juste tant que rien ne la transmet à une plateforme : avant
 * septembre 2027, ce PDF reste une facture valable pour une petite
 * entreprise. Le jour où le branchement existe, son choix 3 B s'applique :
 * rien ne part sans la plateforme, et le refus s'affiche (`TODO.md`).
 */
export async function pieceDeLaFacture(
  data: FacturePdfData,
  options: OptionsFacturePdf = {},
  maintenant: Date = new Date()
): Promise<Uint8Array> {
  if (!estUneEntreprise(data.clientNom, data.clientCivilite)) return genererPdfFacture(data, options);
  const r = await fabriquerFactureX(data, options, maintenant);
  if (r.ok) return r.pdf;
  logger.warn("Factur-X refusée, la facture part en PDF ordinaire", {
    facture: data.numeroCommercial,
    raison: r.raison,
  });
  return genererPdfFacture(data, options);
}

type Joint = { nom: string; octets: Uint8Array; mime: string; relation: "Alternative" | "Supplement"; description: string };

const xmlEchappe = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** La date telle que l'écrit `PDFString.fromDate`, à la seconde, en UTC. */
const dateXmp = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

function metadonnees(titre: string, auteur: string, date: Date): string {
  const quand = dateXmp(date);
  const propriete = (nom: string, description: string) =>
    `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${nom}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType>` +
    `<pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${description}</pdfaProperty:description></rdf:li>`;
  return (
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>' +
    '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEchappe(titre)}</rdf:li></rdf:Alt></dc:title>` +
    `<dc:creator><rdf:Seq><rdf:li>${xmlEchappe(auteur)}</rdf:li></rdf:Seq></dc:creator></rdf:Description>` +
    '<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>Atlas</pdf:Producer></rdf:Description>' +
    '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">' +
    `<xmp:CreatorTool>Atlas</xmp:CreatorTool><xmp:CreateDate>${quand}</xmp:CreateDate><xmp:ModifyDate>${quand}</xmp:ModifyDate><xmp:MetadataDate>${quand}</xmp:MetadataDate></rdf:Description>` +
    '<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">' +
    "<fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>" +
    "<fx:Version>1.0</fx:Version><fx:ConformanceLevel>EN 16931</fx:ConformanceLevel></rdf:Description>" +
    '<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">' +
    '<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">' +
    "<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>" +
    "<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>" +
    "<pdfaSchema:prefix>fx</pdfaSchema:prefix><pdfaSchema:property><rdf:Seq>" +
    propriete("DocumentFileName", "The name of the embedded XML document") +
    propriete("DocumentType", "The type of the hybrid document in capital letters, e.g. INVOICE or ORDER") +
    propriete("Version", "The actual version of the standard applying to the embedded XML document") +
    propriete("ConformanceLevel", "The conformance level of the embedded XML document") +
    "</rdf:Seq></pdfaSchema:property></rdf:li></rdf:Bag></pdfaExtension:schemas></rdf:Description>" +
    "</rdf:RDF></x:xmpmeta>\n" +
    '<?xpacket end="w"?>'
  );
}

export async function enPdfA3(
  pdf: Uint8Array,
  xml: string,
  meta: { titre: string; auteur: string; attestation: AttestationDocument | null; date: Date }
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  const contexte = doc.context;

  // Le dictionnaire Info et le XMP disent la même chose : la norme les compare.
  doc.setTitle(meta.titre);
  doc.setAuthor(meta.auteur);
  doc.setProducer("Atlas");
  doc.setCreator("Atlas");
  doc.setCreationDate(meta.date);
  doc.setModificationDate(meta.date);

  const id = PDFHexString.of(createHash("sha256").update(xml).update(meta.date.toISOString()).digest("hex").slice(0, 32));
  contexte.trailerInfo.ID = contexte.obj([id, id]);

  const icc = await readFile(path.join(process.cwd(), "src/server/pdf/srgb.icc"));
  const profil = contexte.register(contexte.flateStream(icc, { N: 3 }));
  const intention = contexte.register(
    contexte.obj({
      Type: "OutputIntent",
      S: "GTS_PDFA1",
      OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
      Info: PDFString.of("sRGB IEC61966-2.1"),
      DestOutputProfile: profil,
    })
  );
  doc.catalog.set(PDFName.of("OutputIntents"), contexte.obj([intention]));

  const joints: Joint[] = [
    { nom: "factur-x.xml", octets: new TextEncoder().encode(xml), mime: "text/xml", relation: "Alternative", description: "Factur-X" },
  ];
  if (meta.attestation) {
    const extension = meta.attestation.mime === "application/pdf" ? "pdf" : meta.attestation.mime === "image/png" ? "png" : "jpg";
    joints.push({
      nom: `attestation-decennale.${extension}`,
      octets: meta.attestation.octets,
      mime: meta.attestation.mime,
      relation: "Supplement",
      description: "Attestation d'assurance décennale",
    });
  }
  const references: [string, PDFRef][] = joints.map((j) => {
    const flux = contexte.register(
      contexte.flateStream(j.octets, {
        Type: "EmbeddedFile",
        Subtype: j.mime,
        Params: { Size: j.octets.length, ModDate: PDFString.fromDate(meta.date) },
      })
    );
    const fiche = contexte.register(
      contexte.obj({
        Type: "Filespec",
        F: PDFString.of(j.nom),
        UF: PDFHexString.fromText(j.nom),
        EF: { F: flux, UF: flux },
        Desc: PDFHexString.fromText(j.description),
        AFRelationship: j.relation,
      })
    );
    return [j.nom, fiche];
  });
  // L'arbre des noms veut ses clés dans l'ordre.
  references.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const noms = PDFArray.withContext(contexte);
  for (const [nom, fiche] of references) {
    noms.push(PDFString.of(nom));
    noms.push(fiche);
  }
  doc.catalog.set(PDFName.of("Names"), contexte.obj({ EmbeddedFiles: contexte.obj({ Names: noms }) }));
  doc.catalog.set(PDFName.of("AF"), contexte.obj(references.map(([, fiche]) => fiche)));

  // **Le XMP n'est pas compressé** : la norme interdit un filtre sur ce flux,
  // pour qu'un outil d'archive le lise sans rien décoder.
  const xmp = new TextEncoder().encode(metadonnees(meta.titre, meta.auteur, meta.date));
  const flux = contexte.stream(xmp, { Type: "Metadata", Subtype: "XML", Length: xmp.length });
  doc.catalog.set(PDFName.of("Metadata"), contexte.register(flux));

  return doc.save();
}
