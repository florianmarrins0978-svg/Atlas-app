"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { ACCEPT_PHOTOS } from "@/lib/exif";
import { adresseDeLaVisionneuse } from "@/lib/visionneuse-pdf";
import {
  CONSIGNES_DE_SECOURS,
  DECOUVERTE_FORTUITE,
  ETAPES,
  ETAPES_COURTES,
  FAMILLES_AVEC_AJOUTS,
  LIBELLES,
  LIENS_DE_LA_LOI,
  NOMBRE_D_ETAPES,
  PERIMETRE_DU_DECRET,
  POINTS_DE_VIGILANCE,
  SOULIGNES,
  ajouter,
  cocher,
  estCoche,
  gardeeJusquAu,
  libellesAvecLesSiens,
  manques,
  type ContenuFiche,
  type Famille,
} from "@/lib/fiche-securite";
import { ajouterPhotoDuRetourAction } from "../../retour-actions";
import { enregistrerLaFicheAction, marquerTransmiseAction, signerLaFicheAction, type FicheOuverte } from "../../fiche-securite-actions";
import { transmettreLePdf } from "@/components/atlas/transmettre-le-pdf";
import Signature, { pngDeLaSignature, type Trace } from "./Signature";

/**
 * LE FORMULAIRE DE LA FICHE DE SÉCURITÉ — six écrans, la planche
 * `appli/fiche-de-securite.html` codée mot pour mot (21 septembre 2026).
 *
 * Ce que l'écran ne décide pas : les mots des cases, ce qui manque, ce qui est
 * gardé d'une fiche à l'autre — tout vient de `src/lib/fiche-securite.ts`. Ici
 * on dessine, on coche, on enregistre à chaque « Suivant ».
 *
 * **Chaque partie s'explique en une phrase** — sa demande : *« faut mieux
 * expliquer chaque chose, faut partir du principe que les salariés sont
 * bêtes »*. Les explications sont à nous ; les cases sont à la MSA.
 */

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function dateLongue(d: Date): string {
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}
function jourDepuisIso(iso: string | null): string {
  if (!iso) return "";
  const [, m, j] = iso.split("-").map(Number);
  return `${j} ${MOIS[m - 1]}`;
}

type Ecran = "loi" | "fiche" | "signee";

export default function FormulaireFicheDeSecurite({
  chantierId,
  ouverte,
  paysageOuvert,
  loiDemandee,
}: {
  chantierId: string;
  ouverte: FicheOuverte;
  paysageOuvert: boolean;
  loiDemandee: boolean;
}) {
  const router = useRouter();
  const { contexte } = ouverte;
  const [contenu, setContenu] = useState<ContenuFiche>(() => preremplir(ouverte));
  const [loiLue, setLoiLue] = useState(ouverte.fiche.loiLue);
  const [etapeVue, setEtapeVue] = useState(ouverte.fiche.etapeVue);
  const [etape, setEtape] = useState(Math.min(Math.max(ouverte.fiche.etapeVue + 1, 1), NOMBRE_D_ETAPES));
  const [ecran, setEcran] = useState<Ecran>(loiDemandee || !ouverte.fiche.loiLue ? "loi" : ouverte.fiche.signeeLe ? "signee" : "fiche");
  const [signeeLe, setSigneeLe] = useState<Date | null>(ouverte.fiche.signeeLe);
  const [transmise, setTransmise] = useState(ouverte.fiche.transmiseLe !== null);
  const [photos, setPhotos] = useState(ouverte.photos);
  const [trace, setTrace] = useState<Trace>([]);
  const [signataire, setSignataire] = useState(ouverte.fiche.signataire ?? `${contexte.patron.prenom ?? ""} ${contexte.patron.nom ?? ""}`.trim());
  const [occupe, setOccupe] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<Famille | null>(null);
  const [consignesOuvertes, setConsignesOuvertes] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [etape, ecran]);

  const adresseDuPdf = `/planning/fiche-de-securite/${chantierId}/pdf`;

  async function enregistrer(prochaineEtapeVue: number) {
    const r = await enregistrerLaFicheAction(chantierId, { contenu, etapeVue: prochaineEtapeVue, loiLue: true });
    if (!r.ok) setRefus(r.raison);
    return r.ok;
  }

  async function suivant() {
    setOccupe(true);
    setRefus(null);
    const vue = Math.max(etapeVue, etape);
    if (await enregistrer(vue)) {
      setEtapeVue(vue);
      setEtape((e) => Math.min(e + 1, NOMBRE_D_ETAPES));
    }
    setOccupe(false);
  }

  async function retour() {
    if (etape > 1) {
      setEtape((e) => e - 1);
      return;
    }
    setOccupe(true);
    await enregistrer(etapeVue);
    router.push("/planning");
  }

  async function signer() {
    const png = pngDeLaSignature(trace);
    const points = trace.reduce((n, t) => n + t.length, 0);
    if (!png) return;
    setOccupe(true);
    setRefus(null);
    const r = await signerLaFicheAction(chantierId, { contenu, signaturePng: png, points, signataire });
    setOccupe(false);
    if (!r.ok) {
      setRefus(r.raison);
      return;
    }
    setSigneeLe(new Date(r.signeeLe));
    setEtapeVue(NOMBRE_D_ETAPES);
    setEcran("signee");
  }

  async function transmettre() {
    setOccupe(true);
    setRefus(null);
    try {
      const parti = await transmettreLePdf(adresseDuPdf, "fiche-de-securite.pdf");
      if (parti) {
        const r = await marquerTransmiseAction(chantierId);
        if (r.ok) setTransmise(true);
        else setRefus(r.raison);
      }
    } catch (e) {
      setRefus(e instanceof Error ? e.message : "La transmission n’a pas abouti.");
    }
    setOccupe(false);
  }

  async function ajouterDesPhotos(fichiers: File[]) {
    setRefus(null);
    for (const fichier of fichiers) {
      const corps = new FormData();
      corps.set("chantierId", chantierId);
      corps.set("fichier", fichier);
      const r = await ajouterPhotoDuRetourAction(corps);
      if (!r.ok) {
        setRefus(r.raison);
        continue;
      }
      setPhotos((avant) => [...avant, { id: r.id, storageKey: r.storageKey }]);
      setContenu((c) => ({ ...c, photoIds: [...c.photoIds, r.id] }));
    }
  }

  const champ = (cle: keyof ContenuFiche) => ({
    value: String(contenu[cle] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContenu((c) => ({ ...c, [cle]: e.target.value })),
  });

  const g = { contenu, setContenu, enCours, setEnCours };

  const m = manques(contenu);

  // ══════════════════ CE QUE DEMANDE LA LOI — à la première ouverture ══════════════════
  if (ecran === "loi") {
    return (
      <Cadre pied={<Vert onClick={() => { if (!loiLue) { setLoiLue(true); void enregistrer(etapeVue); } setEcran(signeeLe ? "signee" : "fiche"); }}>{loiLue ? "Retour" : "Compris, je remplis"}</Vert>}>
        <h2 className="m-0 text-[24px] leading-[1.15]" style={{ fontFamily: font.display }}>Ce que demande la loi</h2>
        <p className="m-0 mb-3.5 text-[13px]" style={{ color: colors.muted }}>Décret 2021-1833, en vigueur depuis le 1er mars 2022</p>
        <Loi>Avant un chantier d’élagage ou d’abattage, le chef d’entreprise remplit une fiche d’intervention, la signe, la montre à son équipe, la garde sur le chantier, la transmet à l’entreprise qui l’a fait venir quand il y a un plan de prévention, et la conserve deux ans. Elle doit dire :</Loi>
        <ol className="m-0 mt-2.5 list-none p-0">
          {[
            "où est le chantier, quels travaux, avec quel matériel, quels jours",
            "une carte, un croquis ou une photo : les accès, les passages, les arbres à traiter",
            "les risques propres à ce chantier et à ce qui l’entoure",
            "les mesures de sécurité prises",
            "la marche à suivre en cas d’accident",
            "comment les secours s’organisent",
            "la marche à suivre si le temps tourne",
          ].map((x, i) => (
            <Consigne key={x} numero={i + 1}>{x}</Consigne>
          ))}
        </ol>
        <Loi>La fiche peut être sur le téléphone. Aucune liste de matériel, de risques ou de mesures n’est imposée : celles de l’application viennent du formulaire de la MSA, et vous y ajoutez les vôtres.</Loi>
        <Loi>Elle ne vaut que pour l’élagage et l’abattage, dans les parcs, jardins et arbres d’alignement. Pas pour une tonte, une haie, une création.</Loi>
        <Loi><b style={{ fontWeight: 600 }}>Ce que vous cochez et écrivez est repris sur votre prochaine fiche.</b> Vérifiez chaque case à chaque chantier : c’est votre signature.</Loi>
        <div className="mt-[18px] flex flex-col gap-2">
          <LienDeLaLoi href={LIENS_DE_LA_LOI.decret}>Lire le décret sur Légifrance</LienDeLaLoi>
          <LienDeLaLoi href={LIENS_DE_LA_LOI.formulaire}>Voir le formulaire de la MSA</LienDeLaLoi>
        </div>
      </Cadre>
    );
  }

  // ══════════════════ FICHE SIGNÉE ══════════════════
  if (ecran === "signee" && signeeLe) {
    return (
      <Cadre
        pied={
          <div className="flex flex-col gap-2">
            {!transmise && (
              <Vert data-atlas="transmettre-la-fiche" pleine disabled={occupe} onClick={transmettre}>
                Transmettre le PDF
              </Vert>
            )}
            <Link href={adresseDeLaVisionneuse(adresseDuPdf, { surtitre: "Fiche de sécurité", titre: contexte.chantierNom })} data-atlas="ouvrir-le-pdf-de-la-fiche" className="flex min-h-[46px] w-full items-center justify-center rounded-full px-2.5 text-[15px] no-underline" style={{ fontFamily: font.display, color: colors.rust, boxShadow: `inset 0 0 0 1.5px ${colors.vertPale}` }}>
              Ouvrir le PDF
            </Link>
            <Link href="/planning" data-atlas="retour-au-planning" className="mx-auto block w-max px-3 py-2 text-[14px] font-bold no-underline" style={{ color: colors.ink }}>
              {transmise ? "Retour au planning" : "Plus tard"}
            </Link>
            {refus && <p className="m-0 text-center text-[13px]" style={{ color: colors.alert }}>{refus}</p>}
          </div>
        }
      >
        <div className="pb-1.5 pt-[26px] text-center">
          <span aria-hidden="true" className="mx-auto mb-3.5 grid h-[54px] w-[54px] place-items-center rounded-full" style={{ background: colors.plein, color: surPlein }}>
            <svg width="26" height="26" viewBox="0 0 20 20" fill="none"><path d="M4 10.4 8.2 14.6 16 5.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <h2 data-atlas="fiche-signee" className="m-0 text-[26px] leading-[1.15]" style={{ fontFamily: font.display }}>Fiche signée</h2>
          <p className="m-0 mt-1.5 text-[14px]" style={{ color: colors.muted }}>{contexte.chantierNom}, le {dateLongue(signeeLe)} à {heure(signeeLe)}</p>
        </div>
        <ul className="m-0 mt-[18px] list-none p-0">
          {m.length > 0 && <Ligne>{m.length} partie{m.length > 1 ? "s" : ""} vide{m.length > 1 ? "s" : ""} : {m.map((x) => x.quoi.toLowerCase()).join(", ")}.</Ligne>}
          {contexte.equipes.length > 0 && <Ligne>À montrer à {contexte.equipes.join(" et ")} avant de commencer.</Ligne>}
          <Ligne>Enregistrée, et gardée jusqu’au {dateLongue(gardeeJusquAu(signeeLe))}.{paysageOuvert && <> <Link href="/paysage/fiches-securite" className="font-bold no-underline" style={{ color: colors.ink }}>Voir où</Link></>}</Ligne>
          {!transmise && <Ligne>« Transmettre le PDF » ouvre la feuille de partage du téléphone : Mail, SMS, WhatsApp. C’est vous qui envoyez.</Ligne>}
          {transmise && (
            <Ligne>
              <span aria-hidden="true" className="mr-3 inline-grid h-[22px] w-[22px] place-items-center rounded-full align-middle" style={{ background: colors.plein, color: surPlein }}><Coche /></span>
              Transmise{contexte.client ? ` à ${contexte.client.nom}` : ""}.
            </Ligne>
          )}
        </ul>
      </Cadre>
    );
  }

  // ══════════════════ LES SIX ÉCRANS ══════════════════
  const entete = (
    <div className="flex items-center gap-1.5 px-2.5 pt-2" style={{ minHeight: 58 }}>
      <button type="button" aria-label="Retour" data-atlas="retour-de-la-fiche" onClick={retour} className="grid h-11 w-11 flex-none place-items-center" style={{ color: colors.rust }}>
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none"><path d="M12.5 4 6.5 10l6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <span className="min-w-0 flex-1 leading-[1.15]">
        <span className="block text-[17px]" style={{ fontFamily: font.display }}>Fiche de sécurité</span>
        <span className="mt-[1px] block text-[12px]" style={{ color: colors.muted }}>{contexte.chantierNom}</span>
      </span>
      <span data-atlas="etape-de-la-fiche" className="flex-none text-[12.5px] font-semibold" style={{ color: colors.orTexte }}>{etape} sur {NOMBRE_D_ETAPES}</span>
    </div>
  );
  const avancee = (
    <div aria-hidden="true" className="grid gap-1 px-4 pt-2" style={{ gridTemplateColumns: `repeat(${NOMBRE_D_ETAPES}, 1fr)` }}>
      {ETAPES.map((_, i) => (
        <i key={i} className="block h-[3px] rounded-[2px]" style={{ background: i + 1 < etape ? colors.or : i + 1 === etape ? colors.rust : colors.line }} />
      ))}
    </div>
  );

  return (
    <Cadre
      entete={<>{entete}{avancee}</>}
      pied={
        etape < NOMBRE_D_ETAPES ? (
          <Vert data-atlas="suivant" disabled={occupe} onClick={suivant}>Suivant</Vert>
        ) : (
          <Vert data-atlas="signer-la-fiche" disabled={occupe || trace.reduce((n, t) => n + t.length, 0) === 0} onClick={signer}>Signer la fiche</Vert>
        )
      }
    >
      <h2 className="m-0 mb-1 text-[24px] leading-[1.15]" style={{ fontFamily: font.display }}>{ETAPES[etape - 1]}</h2>
      {refus && <p className="m-0 mb-2 text-[13px]" style={{ color: colors.alert }}>{refus}</p>}

      {etape === 1 && (
        <>
          <Bloc titre="Identification" explication="Déjà rempli d’après le chantier. Rien à écrire.">
            <Fixe nom="Nom du chantier">{contexte.chantierNom}</Fixe>
            <Fixe nom="N° de devis et/ou de commande afférent" vide={!contexte.numeroDevis}>{contexte.numeroDevis ?? "aucun devis"}</Fixe>
          </Bloc>
          <Bloc titre="Entreprise réalisant le chantier" explication="Vous. Le numéro est celui qu’on appelle s’il arrive quelque chose.">
            <Fixe nom="Raison sociale">{contexte.entreprise.nom}</Fixe>
            <Champ nom="Téléphone (en cas d’incident ou d’accident)" {...champ("telephoneIncident")} type="tel" />
          </Bloc>
          <Bloc titre="Donneur d’ordre" explication="Qui vous a commandé les travaux ? Le client du devis, ou quelqu’un d’autre : une entreprise qui vous sous-traite, un syndic, une mairie.">
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <Choix actif={contenu.donneur === "client"} onClick={() => setContenu((c) => ({ ...c, donneur: "client" }))}>Le client du devis</Choix>
              <Choix actif={contenu.donneur === "autre"} onClick={() => setContenu((c) => ({ ...c, donneur: "autre" }))}>Quelqu’un d’autre</Choix>
            </div>
            {contenu.donneur === "client" && (
              <>
                <Fixe nom="Raison sociale" vide={!contexte.client}>{contexte.client?.nom ?? "aucun client sur ce chantier"}</Fixe>
                <Fixe nom="Téléphone (en cas d’incident ou d’accident)" vide={!contexte.client?.telephone}>{contexte.client?.telephone ?? "non renseigné"}</Fixe>
              </>
            )}
            {contenu.donneur === "autre" && (
              <>
                <div className="mt-2.5 grid grid-cols-2 gap-2 [&>*]:mt-0">
                  <Champ nom="Nom" {...champ("donneurNom")} placeholder="Exemple : Dubeaujardin" />
                  <Champ nom="Prénom" {...champ("donneurPrenom")} placeholder="Exemple : Marc" />
                </div>
                <Champ nom="Téléphone (en cas d’incident ou d’accident)" {...champ("donneurTel")} type="tel" placeholder="Exemple : 06 00 00 00 00" />
              </>
            )}
          </Bloc>
          <Bloc titre="Identification du chantier" explication="Où est le chantier, et quand. Relevez la position GPS sur place : elle guide les secours.">
            <Fixe nom="Lieu (adresse)" vide={!contexte.adresse}>{contexte.adresse ?? "non renseignée"}</Fixe>
            <div className="mt-2.5">
              <span className="mb-[3px] block text-[12.5px]" style={{ color: colors.muted }}>Coordonnées GPS</span>
              {contenu.gps ? (
                <Fixe nom="">{contenu.gps}</Fixe>
              ) : (
                <button type="button" data-atlas="relever-gps" onClick={() => releverLaPosition((gps) => setContenu((c) => ({ ...c, gps })), setRefus)} className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[10px] text-[15px]" style={{ background: colors.card, color: colors.rust, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
                  <Cible /> Relever ici
                </button>
              )}
            </div>
            <Aide haut>Dates d’exécution, d’après le planning</Aide>
            <div className="mt-2.5 grid grid-cols-2 gap-2 [&>*]:mt-0">
              <Fixe nom="Début, jour" vide={!contexte.datePlanifiee}>{jourDepuisIso(contexte.datePlanifiee) || "pas encore planifié"}</Fixe>
              <Fixe nom="Fin, jour" vide={!contexte.datePlanifiee}>{jourDepuisIso(contexte.datePlanifiee) || "pas encore planifié"}</Fixe>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 [&>*]:mt-0">
              <Champ nom="Début, heures" {...champ("heureDebut")} type="time" />
              <Champ nom="Fin, heures" {...champ("heureFin")} type="time" />
            </div>
            <Vigilance>{POINTS_DE_VIGILANCE.horaires}</Vigilance>
          </Bloc>
          <Bloc titre="Main d’œuvre" explication="Qui est le chef sur place, et combien de personnes de l’entreprise sont là.">
            <Aide>Responsable de l’entreprise sur le chantier</Aide>
            <div className="mt-2.5 grid grid-cols-2 gap-2 [&>*]:mt-0">
              <Champ nom="Nom" {...champ("responsableNom")} />
              <Champ nom="Prénom" {...champ("responsablePrenom")} />
            </div>
            <Champ nom="Téléphone" {...champ("responsableTel")} type="tel" />
            <div className="mt-2.5">
              <span className="mb-[3px] block text-[12.5px]" style={{ color: colors.muted }}>Nombre de travailleurs de l’entreprise</span>
              <div className="flex items-center gap-2.5">
                <Compteur signe="moins" onClick={() => setContenu((c) => ({ ...c, nombreDeTravailleurs: Math.max(1, c.nombreDeTravailleurs - 1) }))} />
                <span data-atlas="nombre-de-travailleurs" className="min-w-[34px] text-center text-[24px] leading-none" style={{ fontFamily: font.display }}>{contenu.nombreDeTravailleurs}</span>
                <Compteur signe="plus" onClick={() => setContenu((c) => ({ ...c, nombreDeTravailleurs: c.nombreDeTravailleurs + 1 }))} />
                <span className="flex-1 text-[12.5px] leading-[1.35]" style={{ color: colors.muted }}>
                  {contexte.equipes.length > 0 ? `${contexte.equipes.join(", ")}, d’après le planning` : contenu.nombreDeTravailleurs === 1 ? "Seul" : ""}
                </span>
              </div>
            </div>
            <Vigilance>{POINTS_DE_VIGILANCE.mainDOeuvre}</Vigilance>
            <Champ nom="Pour chaque personne : sa formation, depuis quand elle travaille, ce qu’elle a le droit de faire" {...champ("mainDOeuvre")} lignes={3} placeholder="Exemple : 3 personnes en CDI, CACES nacelle OK, autorisation de conduite OK" />
            <Aide haut>Ce texte est gardé pour toutes vos prochaines fiches. Corrigez-le ici quand l’équipe change.</Aide>
          </Bloc>
        </>
      )}

      {etape === 2 && (
        <>
          <Bloc titre="Travaux à réaliser" explication="Cochez ce que vous allez faire aujourd’hui sur ce chantier.">
            {contexte.lignesDuDevis.length > 0 && (
              <Aide>Le devis dit : <b style={{ color: colors.inkSoft, fontWeight: 600 }}>{contexte.lignesDuDevis.join(", ")}</b>.</Aide>
            )}
            <Groupe {...g} famille="travaux" genre="pastilles" />
            <Vigilance>{POINTS_DE_VIGILANCE.activites}</Vigilance>
          </Bloc>
          <Bloc titre="Matériels" explication="Cochez le matériel que vous allez utiliser sur ce chantier.">
            <Vigilance>{POINTS_DE_VIGILANCE.materiels}</Vigilance>
            <Aide haut>Moyens d’élévation</Aide>
            <Vigilance>{POINTS_DE_VIGILANCE.elevation}</Vigilance>
            <Groupe {...g} famille="elevation" genre="pastilles" />
            <Vigilance>{POINTS_DE_VIGILANCE.echelle}</Vigilance>
            <Aide haut>Matériels de coupe</Aide>
            <Vigilance>{POINTS_DE_VIGILANCE.distanceMateriels}</Vigilance>
            <Groupe {...g} famille="coupe" genre="pastilles" />
            <Aide haut>Matériels autres</Aide>
            <Vigilance>{POINTS_DE_VIGILANCE.distanceMateriels}</Vigilance>
            <Groupe {...g} famille="autresMateriels" genre="pastilles" />
            <Aide haut>Ce que vous ajoutez reste pour vos prochaines fiches.</Aide>
          </Bloc>
          <Bloc titre="Matières. État sanitaire et physiologique des arbres" explication="Ce que vous avez regardé sur les arbres avant de monter. Cochez ce qui a été vérifié.">
            <Groupe {...g} famille="matieres" genre="cases" />
            <Vigilance>{POINTS_DE_VIGILANCE.matieres}</Vigilance>
            <Aide>Ce que vous ajoutez reste pour vos prochaines fiches.</Aide>
            <Champ nom="Autres (à préciser)" {...champ("matieresAutres")} lignes={2} placeholder="Exemple : rien vu sur les chênes, à confirmer sur place" />
          </Bloc>
        </>
      )}

      {etape === 3 && (
        <>
          <Bloc titre="Carte / croquis / photo du chantier indiquant les accès, voies de circulation et les végétaux à traiter" explication="Une photo du chantier, prise sur place. On doit y voir par où on entre, par où on passe, et les arbres à traiter.">
            <div className="mt-2 flex flex-wrap items-center gap-[7px]">
              {contenu.photoIds.map((id) => {
                const p = photos.find((x) => x.id === id);
                return p ? (
                  <span key={id} data-atlas="photo-de-la-fiche" className="h-[46px] w-[46px] flex-none overflow-hidden rounded-[9px]" style={{ boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
                    <img src={`/api/fichiers/${p.storageKey}`} alt="" className="h-full w-full object-cover" />
                  </span>
                ) : null;
              })}
              {/* L'appareil OU la photothèque : « image/* » sans « capture », le téléphone propose les deux. */}
              <label data-atlas="prendre-une-photo" className="grid h-[46px] w-[72px] flex-none cursor-pointer place-items-center rounded-[9px]" style={{ background: voile(colors.plein, 0.16), color: colors.rust, boxShadow: `inset 0 0 0 1px ${colors.vertPale}` }}>
                <Appareil />
                <input type="file" accept={ACCEPT_PHOTOS} multiple hidden onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void ajouterDesPhotos(f); }} />
              </label>
            </div>
            <Aide haut>Prenez la photo, ou choisissez-la dans la photothèque.</Aide>
          </Bloc>
          <Bloc titre="Zones du chantier" explication="Ce que vous mettez en place pour que personne ne soit blessé : le balisage, la communication entre vous, la surveillance des passants.">
            <Aide>Délimitation matérielle du chantier obligatoire</Aide>
            <Rappel titre="Périmètre de sécurité, d’après le décret" lignes={PERIMETRE_DU_DECRET} />
            <Groupe {...g} famille="balisage" genre="cases" sous={{ [LIBELLES.balisage[2]]: <Champ nom="" {...champ("communication")} placeholder="Exemple : casques communicants à 3" /> }} />
          </Bloc>
          <Bloc titre="Risques spécifiques au chantier. Risque biologique" explication="Des bêtes ou des plantes dangereuses sur place ? Cochez-les, puis cochez ce que vous faites contre.">
            <Groupe {...g} famille="biologique" genre="pastilles" />
            {(contenu.coches.biologique?.length ?? 0) > 0 && (
              <>
                <Aide haut>Mesures de prévention spécifiques au chantier</Aide>
                <Groupe {...g} famille="biologiqueMesures" genre="pastilles" />
              </>
            )}
          </Bloc>
        </>
      )}

      {etape === 4 && (
        <>
          <Bloc titre="Risques liés aux réseaux" precision="aériens et souterrains" explication="Des lignes électriques, des câbles ou des canalisations près des arbres, en l’air ou sous terre ? Cochez-les.">
            <Groupe {...g} famille="reseaux" genre="pastilles" sous={{ Électrique: <Groupe {...g} famille="tensions" genre="pastilles" /> }} />
            {(contenu.coches.reseaux?.length ?? 0) > 0 && (
              <>
                <Aide haut>Mesures</Aide>
                <Groupe {...g} famille="reseauxMesures" genre="cases" sous={{ [LIBELLES.reseauxMesures[2]]: <Groupe {...g} famille="distances" genre="cases" /> }} />
                <Aide haut>Au cas où : <a href={DECOUVERTE_FORTUITE.url} target="_blank" rel="noopener" className="font-semibold" style={{ color: colors.rust, textDecoration: "underline", textDecorationColor: colors.or, textUnderlineOffset: 3 }}>{DECOUVERTE_FORTUITE.mot}</a></Aide>
              </>
            )}
          </Bloc>
          <Bloc titre="Risques liés à l’environnement du chantier" explication="Ce qui, autour du chantier, peut gêner ou blesser : la route, le bruit, la chaleur, un sol glissant, un plan d’eau. Cochez, puis cochez ce que vous faites contre.">
            <Groupe {...g} famille="environnement" genre="pastilles" />
            {(contenu.coches.environnement?.length ?? 0) > 0 && (
              <>
                <Aide haut>Mesures</Aide>
                <Groupe {...g} famille="environnementMesures" genre="pastilles" sous={{ [LIBELLES.environnementMesures[4]]: <Champ nom="" {...champ("environnementPreciser")} placeholder="Exemple : gilets haute visibilité" /> }} />
              </>
            )}
          </Bloc>
          <Bloc titre="Co-activité dans la zone de sécurité du chantier" explication="D’autres personnes travaillent en même temps dans la zone ? Une machine peut happer ou projeter ?">
            <Groupe {...g} famille="coactivite" genre="cases" />
          </Bloc>
          <Bloc titre="Règles organisationnelles à mettre en place" explication="Comment l’équipe s’organise pour ne pas se gêner ni se mettre en danger.">
            <Groupe {...g} famille="organisation" genre="cases" sous={{ [LIBELLES.organisation[2]]: <Champ nom="" {...champ("organisationCommunication")} placeholder="Exemple : casques communicants" /> }} />
            <Vigilance>{POINTS_DE_VIGILANCE.manuel}</Vigilance>
          </Bloc>
          <Bloc titre="Risques autres identifiés, mesures de prévention autres" explication="Ce qui n’est dans aucune liste, et ce que vous faites contre.">
            <Champ nom="Risques autres identifiés" {...champ("risquesAutres")} lignes={2} placeholder="Exemple : coups de vent possibles" />
            <Champ nom="Mesures de prévention autres" {...champ("mesuresAutres")} lignes={2} placeholder="Exemple : rubalise autour de la propriété" />
            <Aide haut>Ces deux textes sont gardés pour vos prochaines fiches.</Aide>
          </Bloc>
          <Bloc titre="Consignes sur la conduite à tenir en cas de phénomènes météorologiques imprévus" explication="La marche à suivre si le vent, l’orage ou une pluie forte arrive pendant le chantier.">
            <Vigilance>{POINTS_DE_VIGILANCE.bulletins}</Vigilance>
            <Groupe {...g} famille="meteo" genre="cases" />
          </Bloc>
        </>
      )}

      {etape === 5 && (
        <>
          <Bloc titre="Organisation des secours. Ressources humaines et matérielles" explication="Ce qu’il y a sur place pour porter secours, et où. Le Point de Rencontre des Secours, c’est l’endroit précis où les pompiers vous retrouvent.">
            <Groupe {...g} famille="secours" genre="cases" />
            <Champ nom="Préciser le lieu où se trouve la trousse de secours :" {...champ("lieuTrousse")} placeholder="Exemple : dans la cabine du camion" />
            <Aide>Gardé pour vos prochaines fiches.</Aide>
            <Champ nom="Préciser le Point de Rencontre des Secours :" {...champ("pointDeRencontre")} placeholder="Exemple : devant le portail du client" />
          </Bloc>
          <Bloc titre="Organisation des secours. Consignes et procédures" explication="La marche à suivre, dans l’ordre. Elle est imprimée sur la fiche : à lire avant de commencer.">
            <div className="overflow-hidden rounded-[12px]" style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
              <button type="button" aria-expanded={consignesOuvertes} onClick={() => setConsignesOuvertes((o) => !o)} className="flex min-h-[54px] w-full items-center gap-2.5 pl-4 pr-3.5 text-left" style={{ background: voile(colors.plein, 0.16) }}>
                <span className="min-w-0 flex-1 text-[16px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.rust }}>Protéger, alerter, secourir</span>
                <span className="flex-none text-[12.5px] font-semibold" style={{ color: colors.rust }}>15, 18, 112</span>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-none transition-transform duration-300" style={{ color: colors.rust, transform: consignesOuvertes ? "rotate(180deg)" : "none" }}><path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <div className="grid transition-[grid-template-rows] duration-300" style={{ gridTemplateRows: consignesOuvertes ? "1fr" : "0fr" }}>
                <div className="min-h-0 overflow-hidden px-3.5">
                  <div className="pb-3.5 pt-3">
                    <TitreDeConsigne>1. Protéger</TitreDeConsigne>
                    <ol className="m-0 list-none p-0">{CONSIGNES_DE_SECOURS.proteger.map((x, i) => <Consigne key={x} numero={i + 1}>{x}</Consigne>)}</ol>
                    <TitreDeConsigne>2. Alerter</TitreDeConsigne>
                    <div className="mb-3 mt-2 grid grid-cols-5 gap-1.5">
                      {CONSIGNES_DE_SECOURS.urgences.map(([n, q]) => (
                        <a key={n} href={`tel:${n}`} className="flex min-h-[56px] flex-col items-center justify-center rounded-[10px] no-underline" style={{ background: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
                          <b className="text-[20px] font-normal leading-none" style={{ fontFamily: font.display }}>{n}</b>
                          <span className="mt-[3px] px-[2px] text-center text-[9.5px] leading-[1.1]" style={{ color: colors.muted }}>{q}</span>
                        </a>
                      ))}
                    </div>
                    <ol className="m-0 list-none p-0">{CONSIGNES_DE_SECOURS.alerter.map((x, i) => <Consigne key={x} numero={i + 1}>{x}</Consigne>)}</ol>
                    <TitreDeConsigne>3. Secourir</TitreDeConsigne>
                    <ol className="m-0 list-none p-0">{CONSIGNES_DE_SECOURS.secourir.map((x, i) => <Consigne key={x} numero={i + 1}>{x}</Consigne>)}</ol>
                    <Aide haut>{CONSIGNES_DE_SECOURS.permanentes[0]}</Aide>
                    <Aide><b style={{ color: colors.inkSoft, fontWeight: 600 }}>{CONSIGNES_DE_SECOURS.permanentes[1]}</b></Aide>
                  </div>
                </div>
              </div>
            </div>
          </Bloc>
          <Bloc titre="Observations / Consignes particulières" explication="Ce que l’équipe doit savoir en plus, pour ce chantier-là.">
            <Champ nom="" {...champ("observations")} lignes={3} placeholder="Exemple : prévenir le chef si quelque chose change" />
            <Aide haut>Ce texte est gardé pour vos prochaines fiches.</Aide>
          </Bloc>
        </>
      )}

      {etape === 6 && (
        <>
          <Bloc titre={m.length ? "Encore vide" : "Tout est renseigné"} explication={m.length ? "Ce qui n’est pas rempli. Touchez une ligne pour y aller." : undefined}>
            {m.length ? (
              <ul className="m-0 list-none p-0">
                {m.map((x) => (
                  <li key={x.quoi} className="m-0">
                    <button type="button" data-atlas="manque-de-la-fiche" onClick={() => setEtape(x.etape)} className="flex min-h-[44px] w-full items-center gap-2.5 py-1.5 text-left text-[14.5px]" style={{ color: colors.inkSoft }}>
                      <span aria-hidden="true" className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full" style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.muted }}>–</span>
                      <span>{x.quoi}</span>
                      <span className="ml-auto flex-none text-[12px]" style={{ color: colors.orTexte }}>{ETAPES_COURTES[x.etape - 1]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex min-h-[44px] items-center gap-2.5 text-[14.5px]" style={{ color: colors.rust }}>
                <span aria-hidden="true" className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full" style={{ background: colors.plein, color: surPlein }}><Coche /></span>
                Les sept éléments du décret sont là
              </div>
            )}
          </Bloc>
          <Bloc titre="Enregistrement" explication="Le chef d’entreprise signe. Sa signature engage sa responsabilité. La note de la feuille sera imprimée au bas du PDF : présentée aux travailleurs, disponible sur le chantier, transmise s’il y a un plan de prévention, conservée deux ans.">
            <Champ nom="Nom et prénom du chef d’entreprise (ou de son représentant)" value={signataire} onChange={(e) => setSignataire(e.target.value)} />
            <Fixe nom="Date">{dateLongue(new Date())}</Fixe>
            <div className="mt-2.5">
              <Signature trace={trace} onTrace={setTrace} />
            </div>
          </Bloc>
        </>
      )}
    </Cadre>
  );
}

// ─── Un groupe de cases : les mots de la MSA, les siens, « Ajouter », et ce
// qui dépend d'une case juste dessous. Un appui ne change que sa case : React
// ne redessine que ce qui bouge, l'écran ne remonte pas. Défini HORS du
// formulaire, sinon React le prendrait pour un composant neuf à chaque rendu et
// remonterait tout ce qu'il contient. ───
type Cocheur = { contenu: ContenuFiche; setContenu: React.Dispatch<React.SetStateAction<ContenuFiche>>; enCours: Famille | null; setEnCours: (f: Famille | null) => void };
function Groupe({ contenu, setContenu, enCours, setEnCours, famille, genre, sous }: Cocheur & { famille: Famille; genre: "pastilles" | "cases"; sous?: Partial<Record<string, React.ReactNode>> }) {
  const liste = libellesAvecLesSiens(contenu, famille);
  const enPastilles = genre === "pastilles";
  return (
    <div data-atlas={`groupe-${famille}`} className={enPastilles ? "flex flex-wrap gap-1.5" : ""}>
      {liste.map((libelle) => {
        const cochee = estCoche(contenu, famille, libelle);
        const liens = SOULIGNES[libelle];
        const texte = liens ? avecLiens(libelle, liens) : libelle;
        const basculer = () => setContenu((c) => cocher(c, famille, libelle));
        const contenuDeLaCase = enPastilles ? (
          <>
            <span aria-hidden="true" className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full" style={{ background: cochee ? colors.plein : "transparent", boxShadow: cochee ? "none" : `inset 0 0 0 1.5px ${colors.vertPale}`, color: cochee ? surPlein : "transparent" }}>
              <Coche />
            </span>
            <span>{texte}</span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="mt-[-1px] grid h-6 w-6 flex-none place-items-center rounded-full" style={{ background: cochee ? colors.plein : colors.card, boxShadow: cochee ? "none" : `inset 0 0 0 1.5px ${colors.vertPale}`, color: cochee ? surPlein : "transparent" }}>
              <Coche />
            </span>
            <span className="min-w-0 flex-1">{texte}</span>
          </>
        );
        const classe = enPastilles
          ? "inline-flex min-h-[44px] items-center gap-[7px] rounded-full py-2 pl-3 pr-3.5 text-left text-[14px] leading-[1.2]"
          : "flex min-h-[44px] w-full items-start gap-3 py-[6px] text-left text-[14.5px] leading-[1.45]";
        const style = enPastilles
          ? { background: cochee ? voile(colors.plein, 0.16) : colors.card, boxShadow: `inset 0 0 0 ${cochee ? "1.5px" : "1px"} ${cochee ? colors.plein : colors.line}`, color: colors.ink }
          : { color: colors.ink };
        return (
          <span key={libelle} className={enPastilles ? "contents" : "block"}>
            {liens ? (
              // Un lien dans un bouton n'est pas permis : la ligne est une boîte,
              // le mot souligné ouvre le site, tout le reste coche.
              <div
                role="checkbox"
                aria-checked={cochee}
                tabIndex={0}
                data-atlas="case-avec-lien"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a")) return;
                  basculer();
                }}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    basculer();
                  }
                }}
                className={`${classe} cursor-pointer`}
                style={style}
              >
                {contenuDeLaCase}
              </div>
            ) : (
              <button type="button" aria-pressed={cochee} data-atlas="case-de-la-fiche" onClick={basculer} className={classe} style={style}>
                {contenuDeLaCase}
              </button>
            )}
            {sous?.[libelle] && cochee && <div className={enPastilles ? "basis-full pl-[18px]" : "pl-9"}>{sous[libelle]}</div>}
          </span>
        );
      })}
      {!FAMILLES_AVEC_AJOUTS.includes(famille) ? null : enCours === famille ? (
        <AjoutEnCours famille={famille} onValider={(mot) => { setContenu((c) => ajouter(c, famille, mot)); setEnCours(null); }} />
      ) : (
        <button
          type="button"
          data-atlas={`ajouter-${famille}`}
          onClick={() => setEnCours(famille)}
          className={`${enPastilles ? "inline-flex" : "mt-1 inline-flex"} min-h-[44px] items-center gap-1.5 rounded-full py-2 pl-2.5 pr-3.5 text-[14px]`}
          style={{ background: voile(colors.plein, 0.16), color: colors.rust, boxShadow: `inset 0 0 0 1px ${colors.vertPale}` }}
        >
          <Plus /> Ajouter
        </button>
      )}
    </div>
  );
}


// ─── ce qu'Atlas sait déjà, posé sur une fiche neuve ; jamais sur une fiche commencée ───
function preremplir(ouverte: FicheOuverte): ContenuFiche {
  const { fiche, contexte } = ouverte;
  if (fiche.etapeVue > 0 || fiche.signeeLe) return fiche.contenu;
  return {
    ...fiche.contenu,
    telephoneIncident: fiche.contenu.telephoneIncident || contexte.entreprise.telephone || "",
    responsableNom: fiche.contenu.responsableNom || contexte.patron.nom || "",
    responsablePrenom: fiche.contenu.responsablePrenom || contexte.patron.prenom || "",
    responsableTel: fiche.contenu.responsableTel || contexte.entreprise.telephone || "",
    nombreDeTravailleurs: Math.max(1, contexte.equipes.length, fiche.contenu.nombreDeTravailleurs),
    donneur: fiche.contenu.donneur ?? (contexte.client ? "client" : null),
  };
}

function releverLaPosition(pose: (gps: string) => void, refus: (r: string) => void) {
  if (!navigator.geolocation) {
    refus("Ce téléphone ne donne pas sa position.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (p) => pose(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`),
    () => refus("La position n’a pas pu être relevée. Autorisez la localisation, ou écrivez-la."),
    { enableHighAccuracy: true, timeout: 15_000 }
  );
}

function avecLiens(libelle: string, liens: readonly (readonly [string, string])[]): React.ReactNode {
  const [mot, url] = liens[0];
  const i = libelle.indexOf(mot);
  if (i < 0) return libelle;
  return (
    <>
      {libelle.slice(0, i)}
      <a href={url} target="_blank" rel="noopener" className="font-semibold" style={{ color: colors.rust, textDecoration: "underline", textDecorationColor: colors.or, textUnderlineOffset: 3, textDecorationThickness: 1.5 }}>
        {mot}
      </a>
      {libelle.slice(i + mot.length)}
    </>
  );
}

function heure(d: Date): string {
  return d.toLocaleTimeString("fr-FR", { hour: "numeric", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", " h ");
}

// ─── les briques de l'écran ───
// La page défile comme les autres écrans de l'application ; l'en-tête reste en
// haut, le pied reste au-dessus de la barre de navigation — le même geste que
// la facture (`FactureClient.tsx`), avec `--atlas-barre` pour la hauteur réelle
// de la barre, indicateur d'accueil compris.
function Cadre({ entete, pied, children }: { entete?: React.ReactNode; pied: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      {entete && <div className="sticky top-0 z-10" style={{ background: colors.cream }}>{entete}</div>}
      <div data-atlas="corps-de-la-fiche" className="px-4 pb-6 pt-3.5">{children}</div>
      <div className="sticky bottom-0 z-10 px-4 pb-[calc(12px+var(--atlas-barre))] pt-2.5 [body:not(:has(.atlas-nav-basse))_&]:pb-3" style={{ background: `linear-gradient(to top, ${colors.cream} 68%, ${voile(colors.cream, 0)})` }}>{pied}</div>
    </div>
  );
}
function Vert({ children, onClick, disabled, pleine, ...reste }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; pleine?: boolean; "data-atlas"?: string }) {
  return (
    <button type="button" {...reste} disabled={disabled} onClick={onClick} className={`${pleine ? "w-full" : "mx-auto w-max max-w-full px-[26px]"} flex min-h-[46px] items-center justify-center gap-2 rounded-full text-[15.5px] transition-opacity`} style={{ fontFamily: font.display, background: colors.plein, color: surPlein, opacity: disabled ? 0.45 : 1 }}>
      {children}
    </button>
  );
}
function Bloc({ titre, precision, explication, children }: { titre: string; precision?: string; explication?: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t pt-3.5 first-of-type:mt-2 first-of-type:border-t-0 first-of-type:pt-0" style={{ borderColor: colors.lineSoft }}>
      <p className="m-0 mb-2 text-[10px] font-semibold uppercase leading-none tracking-[0.16em]" style={{ color: colors.ink }}>
        {titre}
        {precision && <span className="ml-1.5 text-[11.5px] font-medium normal-case tracking-[0.02em]" style={{ color: colors.muted }}>{precision}</span>}
      </p>
      {explication && <p className="m-0 mb-3 mt-[-2px] text-[14px] leading-[1.45]" style={{ color: colors.inkSoft }}>{explication}</p>}
      {children}
    </div>
  );
}
function Aide({ children, haut }: { children: React.ReactNode; haut?: boolean }) {
  return <p className={`m-0 mb-2.5 text-[12.5px] leading-[1.45] ${haut ? "mt-3" : ""}`} style={{ color: colors.muted }}>{children}</p>;
}
function Vigilance({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 my-2 pl-3 text-[13.5px] leading-[1.45]" style={{ color: colors.inkSoft, borderLeft: `2px solid ${colors.or}` }}>
      <b className="mr-1 font-semibold" style={{ color: colors.orTexte }}>Point de vigilance</b>
      {children}
    </p>
  );
}
function Loi({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mt-3 text-[15px] leading-[1.5]">{children}</p>;
}
function LienDeLaLoi({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="flex min-h-[48px] items-center rounded-[12px] px-4 text-[15px] font-semibold no-underline" style={{ background: colors.card, color: colors.rust, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
      {children}
    </a>
  );
}
function Consigne({ numero, children }: { numero: number; children: React.ReactNode }) {
  return (
    <li className="relative py-1 pl-[26px] text-[14px] leading-[1.45]">
      <span aria-hidden="true" className="absolute left-0 top-[5px] grid h-[18px] w-[18px] place-items-center rounded-full text-[11px] font-bold" style={{ background: voile(colors.or, 0.13), color: colors.orTexte }}>{numero}</span>
      {children}
    </li>
  );
}
function TitreDeConsigne({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mb-1 mt-3.5 text-[16px] font-semibold leading-[1.2] first:mt-0" style={{ fontFamily: font.display }}>{children}</p>;
}
function Ligne({ children }: { children: React.ReactNode }) {
  return <li className="flex min-h-[44px] items-center gap-3 border-t py-2 text-[14.5px] leading-[1.4] first:border-t-0" style={{ borderColor: colors.lineSoft }}><span className="min-w-0 flex-1">{children}</span></li>;
}
function Fixe({ nom, children, vide }: { nom: string; children: React.ReactNode; vide?: boolean }) {
  return (
    <div className="mt-2.5 first:mt-0">
      {nom && <span className="mb-[3px] block text-[12.5px]" style={{ color: colors.muted }}>{nom}</span>}
      <span className="flex min-h-[46px] items-center rounded-[10px] px-3 py-2.5 text-[16px] leading-[1.4]" style={{ background: colors.rustTint, boxShadow: `inset 0 0 0 1px ${colors.lineSoft}`, color: vide ? colors.muted : colors.ink, fontStyle: vide ? "italic" : "normal" }}>{children}</span>
    </div>
  );
}
function Champ({ nom, lignes, type, ...reste }: { nom: string; lignes?: number; type?: string; value: string; placeholder?: string; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void }) {
  const style = { background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}`, color: colors.ink, caretColor: colors.or };
  const classe = "block w-full min-h-[46px] rounded-[10px] border-0 px-3 py-2.5 text-[16px] leading-[1.4] outline-none";
  return (
    <label className="mt-2.5 block first:mt-0">
      {nom && <span className="mb-[3px] block text-[12.5px]" style={{ color: colors.muted }}>{nom}</span>}
      {lignes ? <textarea rows={lignes} className={`${classe} resize-none`} style={style} {...reste} /> : <input type={type ?? "text"} autoComplete="off" className={classe} style={style} {...reste} />}
    </label>
  );
}
function Choix({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={actif} onClick={onClick} className="flex min-h-[46px] items-center justify-center rounded-[10px] px-2.5 py-1.5 text-center text-[14.5px] leading-[1.2]" style={{ background: actif ? voile(colors.plein, 0.16) : colors.card, boxShadow: `inset 0 0 0 ${actif ? "1.5px" : "1px"} ${actif ? colors.rust : colors.line}`, color: actif ? colors.rust : colors.ink, fontWeight: actif ? 600 : 400 }}>
      {children}
    </button>
  );
}
function Compteur({ signe, onClick }: { signe: "plus" | "moins"; onClick: () => void }) {
  return (
    <button type="button" aria-label={signe === "plus" ? "Un de plus" : "Un de moins"} onClick={onClick} className="grid h-[46px] w-[46px] place-items-center rounded-[10px]" style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}`, color: colors.rust }}>
      {signe === "plus" ? <Plus /> : <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>}
    </button>
  );
}
function Rappel({ titre, lignes }: { titre: string; lignes: readonly (readonly [string, string])[] }) {
  return (
    <div className="mb-3 rounded-[10px] px-3 py-2.5 text-[13.5px] leading-[1.5]" style={{ background: voile(colors.or, 0.13), color: colors.inkSoft }}>
      <b className="font-semibold" style={{ color: colors.ink }}>{titre}</b>
      <table className="w-full border-collapse"><tbody>{lignes.map(([a, b]) => <tr key={a}><td className="py-[2px] align-top">{a}</td><td className="py-[2px] text-right align-top font-semibold" style={{ color: colors.ink }}>{b}</td></tr>)}</tbody></table>
    </div>
  );
}
function AjoutEnCours({ famille, onValider }: { famille: Famille; onValider: (mot: string) => void }) {
  const [mot, setMot] = useState("");
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => champ.current?.focus(), []);
  const exemples: Partial<Record<Famille, string>> = { matieres: "Exemple : nid de frelons", travaux: "Exemple : taille de réduction", biologique: "Exemple : rats", balisage: "Exemple : sortie du garage bloquée", environnement: "Exemple : pente forte", coactivite: "Exemple : livraison prévue à 10 h", secours: "Exemple : couverture de survie", meteo: "Exemple : on arrête dès 40 km/h de vent" };
  return (
    <div className="mt-2 flex w-full basis-full gap-2">
      <input ref={champ} type="text" autoComplete="off" data-atlas={`mot-ajoute-${famille}`} value={mot} placeholder={exemples[famille] ?? "Exemple : camion-grue"} onChange={(e) => setMot(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onValider(mot); } }} className="min-h-[46px] min-w-0 flex-1 rounded-[10px] border-0 px-3 py-2.5 text-[16px] outline-none" style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.or}`, color: colors.ink, caretColor: colors.or }} />
      <button type="button" data-atlas={`valider-ajout-${famille}`} onClick={() => onValider(mot)} className="flex min-h-[46px] items-center justify-center rounded-full px-[18px] text-[15px]" style={{ fontFamily: font.display, background: colors.plein, color: surPlein }}>Ajouter</button>
    </div>
  );
}
function Coche() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.4 6.3 11.7 13 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Plus() {
  return <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;
}
function Cible() {
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="10" cy="10" r="5.5" /><circle cx="10" cy="10" r="1.6" /><path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3" /></svg>;
}
function Appareil() {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7.5a1.5 1.5 0 0 1 1.5-1.5H7l1.3-2h3.4L13 6h2.5A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z" /><circle cx="10" cy="11" r="2.6" /></svg>;
}
