"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { ACCEPT_PHOTOS } from "@/lib/exif";
import { adresseDeLaVisionneuse } from "@/lib/visionneuse-pdf";
import {
  CONSIGNES_DE_SECOURS,
  CONSIGNES_D_UN_ARBRE,
  DANGERS_D_UN_ARBRE,
  DECOUVERTE_FORTUITE,
  ETAPES,
  FAMILLES_AVEC_AJOUTS,
  FORMATIONS,
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
  lecturesManquantes,
  libellesAvecLesSiens,
  minimumLegal,
  refusDeFinaliser,
  refusDuReleveGps,
  validite,
  type ArbreDangereux,
  type ContenuFiche,
  type Famille,
  type Personne,
} from "@/lib/fiche-securite";
import { manquesDuCroquis, type FondDuCroquis } from "@/lib/croquis-securite";
import {
  ajouterPhotoDeLaFicheAction,
  enregistrerLaFicheAction,
  finaliserLaFicheAction,
  marquerAbsentAction,
  noterLaPreventionAction,
  noterUnEnvoiAction,
  retirerPhotoDeLaFicheAction,
  signerLaFicheAction,
  signerUneLectureAction,
  type FicheOuverte,
} from "../../fiche-securite-actions";
import { transmettreLePdf } from "@/components/atlas/transmettre-le-pdf";
import VisionneusePhoto from "@/components/atlas/VisionneusePhoto";
import Signature, { pngDeLaSignature, type Trace } from "./Signature";
import { DessinDuCroquis, EditeurDuCroquis, LegendeDuCroquis, ObligatoiresDuCroquis } from "./Croquis";

/**
 * LE FORMULAIRE DE LA FICHE DE SÉCURITÉ — six écrans, tout à la suite.
 *
 * **La fiche complète, codée le 14 octobre 2026** d'après la planche
 * `appli/fiche-de-securite-mieux.html`, qu'il a éprouvée remarque après
 * remarque. D'abord la première version, en sous-catégories à la Kleyk, qu'il a
 * écartée : *« on clique sur une catégorie, puis sur une autre, puis sur une
 * autre pour arriver sur les cases ; ce que j'aimais dans notre appli, c'est que
 * tout est à la suite »*. On garde donc les six écrans, et les sujets de Kleyk
 * y deviennent des titres, pas des portes.
 *
 * Ce que l'écran ne décide pas : les mots des cases, le minimum légal, qui doit
 * encore signer, ce qui est gardé d'une fiche à l'autre — tout vient de
 * `src/lib/fiche-securite.ts` et `croquis-securite.ts`. Ici on dessine, on coche,
 * on enregistre pendant qu'il écrit.
 *
 * **Chaque partie s'explique en une phrase** — sa demande : *« faut partir du
 * principe que l'utilisateur ne connaît pas la loi, il faut tout lui expliquer
 * pour qu'il soit en règle »*.
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
}: {
  chantierId: string;
  ouverte: FicheOuverte;
  paysageOuvert: boolean;
}) {
  const router = useRouter();
  const { contexte } = ouverte;
  const [contenu, setContenu] = useState<ContenuFiche>(() => preremplir(ouverte));
  const [etapeVue, setEtapeVue] = useState(ouverte.fiche.etapeVue);
  const [etape, setEtape] = useState(Math.min(Math.max(ouverte.fiche.etapeVue + 1, 1), NOMBRE_D_ETAPES));
  const [ecran, setEcran] = useState<Ecran>(!ouverte.fiche.loiLue ? "loi" : ouverte.fiche.signeeLe ? "signee" : "fiche");
  const [signeeLe, setSigneeLe] = useState<Date | null>(ouverte.fiche.signeeLe);
  const [photos, setPhotos] = useState(ouverte.photos);
  const [rangOuvert, setRangOuvert] = useState<number | null>(null);
  const [trace, setTrace] = useState<Trace>([]);
  const [occupe, setOccupe] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<Famille | null>(null);
  const [consignesOuvertes, setConsignesOuvertes] = useState(false);
  const [releveEnCours, setReleveEnCours] = useState(false);
  const [gpsAEcrire, setGpsAEcrire] = useState(false);
  const [editionDuCroquis, setEditionDuCroquis] = useState(false);
  const [personneOuverte, setPersonneOuverte] = useState<number | null>(null);
  const [lecteur, setLecteur] = useState<string | null>(null);
  const [traceDuLecteur, setTraceDuLecteur] = useState<Trace>([]);
  // Le bloc où emmène une ligne de « Pour pouvoir signer » : une référence, pas un état, pour ne pas
  // relancer l'effet de défilement quand on la vide.
  const viser = useRef<string | null>(null);
  const choixDuFond = useRef<HTMLInputElement>(null);
  const fondDemande = useRef<FondDuCroquis | null>(null);
  useEffect(() => {
    const bloc = viser.current;
    viser.current = null;
    if (bloc) document.getElementById(`bloc-${bloc}`)?.scrollIntoView({ block: "start" });
    else window.scrollTo({ top: 0 });
  }, [etape, ecran]);

  const adresseDuPdf = `/planning/fiche-de-securite/${chantierId}/pdf`;
  const aujourdhui = new Date();

  /**
   * ON ENREGISTRE PENDANT QU’IL ÉCRIT — sa demande du 22 septembre 2026.
   *
   * Deux secondes de silence, et la fiche part ; on renvoie aussi dès que
   * l’onglet passe en arrière-plan. `dejaEnvoye` garde CE QUI A ÉTÉ ÉCRIT : un
   * envoi refusé ne marque rien, donc la frappe suivante réessaie toute seule.
   */
  const dejaEnvoye = useRef(JSON.stringify(contenu));
  useEffect(() => {
    if (ecran !== "fiche" || signeeLe) return;
    const aEnvoyer = JSON.stringify(contenu);
    if (aEnvoyer === dejaEnvoye.current) return;
    let vivant = true;
    async function envoyer() {
      const r = await enregistrerLaFicheAction(chantierId, { contenu, etapeVue, loiLue: true, rafraichirLesEcrans: false });
      if (r.ok) dejaEnvoye.current = aEnvoyer;
      else if (vivant) setRefus(r.raison);
    }
    const minuterie = setTimeout(() => void envoyer(), 2_000);
    const enPartant = () => {
      if (document.visibilityState === "hidden") void envoyer();
    };
    document.addEventListener("visibilitychange", enPartant);
    return () => {
      vivant = false;
      clearTimeout(minuterie);
      document.removeEventListener("visibilitychange", enPartant);
    };
  }, [contenu, ecran, signeeLe, chantierId, etapeVue]);

  async function enregistrer(prochaineEtapeVue: number) {
    const r = await enregistrerLaFicheAction(chantierId, { contenu, etapeVue: prochaineEtapeVue, loiLue: true });
    if (r.ok) dejaEnvoye.current = JSON.stringify(contenu);
    else setRefus(r.raison);
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

  /** Une ligne de « Pour pouvoir signer » emmène à l'étape, et au bloc, où se remplit ce qui manque. */
  function aller(etapeCible: number, bloc: string) {
    viser.current = bloc;
    if (etapeCible === etape) document.getElementById(`bloc-${bloc}`)?.scrollIntoView({ block: "start" });
    else setEtape(etapeCible);
  }

  const legal = minimumLegal(contenu, contexte);

  async function signer() {
    setRefus(null);
    // Le bouton reste visible, grisé : un appui DIT ce qui manque, au lieu de ne rien faire.
    if (legal.length > 0) {
      setRefus(`Il manque ${legal.length} élément${legal.length > 1 ? "s" : ""} que la loi exige. Touchez-${legal.length > 1 ? "les" : "le"} ci-dessus pour ${legal.length > 1 ? "les" : "le"} remplir.`);
      return;
    }
    const png = pngDeLaSignature(trace);
    const points = trace.reduce((n, t) => n + t.length, 0);
    if (!png) {
      setRefus("Signez dans le cadre d’abord.");
      return;
    }
    setOccupe(true);
    const r = await signerLaFicheAction(chantierId, { contenu, signaturePng: png, points });
    setOccupe(false);
    if (!r.ok) {
      setRefus(r.raison);
      return;
    }
    setSigneeLe(new Date(r.signeeLe));
    setEtapeVue(NOMBRE_D_ETAPES);
    setEcran("signee");
  }

  async function signerLaLecture() {
    if (!lecteur) return;
    const png = pngDeLaSignature(traceDuLecteur);
    const points = traceDuLecteur.reduce((n, t) => n + t.length, 0);
    if (!png) {
      setRefus("Signez dans le cadre d’abord.");
      return;
    }
    setOccupe(true);
    setRefus(null);
    const r = await signerUneLectureAction(chantierId, { nom: lecteur, signaturePng: png, points });
    setOccupe(false);
    if (!r.ok) {
      setRefus(r.raison);
      return;
    }
    setContenu((c) => ({ ...c, lectures: [...c.lectures, { nom: lecteur, png, le: r.le }] }));
    setLecteur(null);
    setTraceDuLecteur([]);
  }

  async function marquerAbsent(nom: string) {
    setRefus(null);
    const r = await marquerAbsentAction(chantierId, nom);
    if (!r.ok) setRefus(r.raison);
    else setContenu((c) => ({ ...c, equipe: c.equipe.map((p) => (p.nom.trim() === nom ? { ...p, present: false } : p)) }));
  }

  async function envoyer(a: string) {
    setOccupe(true);
    setRefus(null);
    try {
      const parti = await transmettreLePdf(adresseDuPdf, "fiche-de-securite.pdf");
      if (parti) {
        const r = await noterUnEnvoiAction(chantierId, a);
        if (!r.ok) setRefus(r.raison);
        else {
          setContenu((c) => ({ ...c, envois: c.envois.includes(a) ? c.envois : [...c.envois, a] }));
        }
      }
    } catch (e) {
      setRefus(e instanceof Error ? e.message : "L’envoi n’a pas abouti.");
    }
    setOccupe(false);
  }

  async function repondreALaPrevention(reponse: "oui" | "non") {
    setRefus(null);
    const r = await noterLaPreventionAction(chantierId, reponse);
    if (!r.ok) setRefus(r.raison);
    else setContenu((c) => ({ ...c, prevention: reponse }));
  }

  async function finaliser() {
    setRefus(null);
    const avant = refusDeFinaliser(contenu, signeeLe !== null, contexte);
    if (avant) {
      setRefus(avant);
      return;
    }
    setOccupe(true);
    const r = await finaliserLaFicheAction(chantierId);
    setOccupe(false);
    if (!r.ok) setRefus(r.raison);
    else setContenu((c) => ({ ...c, finaliseeLe: new Date().toISOString() }));
  }

  async function televerser(fichiers: File[]): Promise<{ id: string; storageKey: string }[]> {
    const posees: { id: string; storageKey: string }[] = [];
    for (const fichier of fichiers) {
      const corps = new FormData();
      corps.set("chantierId", chantierId);
      corps.set("fichier", fichier);
      const r = await ajouterPhotoDeLaFicheAction(corps);
      if (!r.ok) {
        setRefus(r.raison);
        continue;
      }
      posees.push({ id: r.id, storageKey: r.storageKey });
    }
    if (posees.length) {
      setPhotos((avant) => [...avant, ...posees]);
      setContenu((c) => ({ ...c, photoIds: [...c.photoIds, ...posees.map((p) => p.id)] }));
    }
    return posees;
  }

  /** Le fond du croquis : une photo du chantier, ou un croquis papier importé, passe par le chemin commun des photos. */
  function choisirLeFond(fond: FondDuCroquis) {
    setRefus(null);
    if (fond === "blanc") {
      setContenu((c) => ({ ...c, croquis: { ...c.croquis, fond: "blanc", fondPhotoId: null } }));
      setEditionDuCroquis(true);
      return;
    }
    fondDemande.current = fond;
    choixDuFond.current?.click();
  }
  async function fondChoisi(fichiers: File[]) {
    const fond = fondDemande.current;
    if (!fond || fichiers.length === 0) return;
    const [posee] = await televerser(fichiers.slice(0, 1));
    if (!posee) return;
    setContenu((c) => ({ ...c, croquis: { ...c.croquis, fond, fondPhotoId: posee.id } }));
    setEditionDuCroquis(true);
  }

  async function retirerLaPhoto(photoId: string) {
    setRefus(null);
    const r = await retirerPhotoDeLaFicheAction(chantierId, photoId);
    if (!r.ok) {
      setRefus(r.raison);
      return;
    }
    setPhotos((avant) => avant.filter((p) => p.id !== photoId));
    setContenu((c) => ({ ...c, photoIds: c.photoIds.filter((id) => id !== photoId) }));
    setRangOuvert(null);
  }

  const champ = (cle: keyof ContenuFiche) => ({
    value: String(contenu[cle] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContenu((c) => ({ ...c, [cle]: e.target.value })),
  });

  const g = { contenu, setContenu, enCours, setEnCours };

  // La photo sous le croquis n'est pas une photo du balisage : elle ne se montre pas dans leur rangée.
  const sesPhotos = contenu.photoIds
    .filter((id) => id !== contenu.croquis.fondPhotoId)
    .map((id) => photos.find((x) => x.id === id))
    .filter((p): p is { id: string; storageKey: string } => p !== undefined);
  const fondUrl = (() => {
    const p = photos.find((x) => x.id === contenu.croquis.fondPhotoId);
    return p ? `/api/fichiers/${p.storageKey}` : null;
  })();

  const changerLEquipe = (equipe: Personne[]) =>
    setContenu((c) => ({ ...c, equipe, nombreDeTravailleurs: Math.max(1, equipe.filter((p) => p.present).length) }));
  const changerUnArbre = (rang: number, arbre: Partial<ArbreDangereux>) =>
    setContenu((c) => ({ ...c, arbres: c.arbres.map((a, i) => (i === rang ? { ...a, ...arbre } : a)) }));

  const presents = contenu.equipe.filter((p) => p.present);
  const sansSst = presents.filter((p) => !validite(p.sst, aujourdhui).ok).map((p) => p.nom.trim()).filter(Boolean);
  const unGsa = presents.some((p) => validite(p.gsa, aujourdhui).ok);

  const champInvisibleDuFond = (
    <input ref={choixDuFond} type="file" accept={ACCEPT_PHOTOS} hidden onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void fondChoisi(f); }} />
  );

  // ══════════════════ CE QUE DEMANDE LA LOI — à la première ouverture ══════════════════
  if (ecran === "loi") {
    return (
      <Cadre pied={<Vert onClick={() => { if (!signeeLe) void enregistrer(etapeVue); setEcran(signeeLe ? "signee" : "fiche"); }}>Compris, je remplis</Vert>}>
        <h2 className="m-0 mb-3.5 text-[24px] leading-[1.15]" style={{ fontFamily: font.display }}>Décret 2021-1833, en vigueur depuis le 1er mars 2022</h2>
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
        <Loi>La fiche peut être sur le téléphone. Sans ces éléments, elle ne se signe pas : l’écran dit ce qui manque, et où le remplir.</Loi>
        <Loi>Elle ne vaut que pour l’élagage et l’abattage, dans les parcs, jardins et arbres d’alignement. Pas pour une tonte, une haie, une création.</Loi>
        <Loi><b style={{ fontWeight: 600 }}>Ce que vous cochez et écrivez est repris sur votre prochaine fiche</b>, votre équipe et ses compétences aussi. Vérifiez chaque case à chaque chantier : c’est votre signature.</Loi>
        <div className="mt-[18px] flex flex-col gap-2">
          <LienDeLaLoi href={LIENS_DE_LA_LOI.decret}>Lire le décret sur Légifrance</LienDeLaLoi>
          <LienDeLaLoi href={LIENS_DE_LA_LOI.formulaire}>Voir le formulaire de la MSA</LienDeLaLoi>
        </div>
      </Cadre>
    );
  }

  // ══════════════════ FICHE SIGNÉE : l'équipe signe, on l'envoie, on l'enregistre ══════════════════
  if (ecran === "signee" && signeeLe) {
    const manquent = lecturesManquantes(contenu);
    const autresEntreprises = contenu.entreprisesSurPlace === "oui" ? contenu.entreprises.filter((x) => x.presente && x.nom.trim()) : [];
    const finalisee = contenu.finaliseeLe !== null;
    const envoyerA = (cle: string, mot: string) =>
      contenu.envois.includes(cle) ? (
        <p className="m-0 mt-2.5 flex items-center gap-2 text-[14px] font-semibold" style={{ color: colors.rust }}>
          <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full" style={{ background: colors.plein, color: surPlein }}><Coche /></span>
          Envoyée
        </p>
      ) : (
        <Creux data-atlas={`envoyer-${cle}`} disabled={occupe} onClick={() => void envoyer(cle)}>{mot}</Creux>
      );
    return (
      <Cadre
        pied={
          <div className="flex flex-col gap-2">
            {refus && <p className="m-0 text-center text-[13px] font-semibold" style={{ color: colors.alert }}>{refus}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Link href={adresseDeLaVisionneuse(adresseDuPdf, { surtitre: "Fiche de sécurité", titre: contexte.chantierNom })} data-atlas="ouvrir-le-pdf-de-la-fiche" className="flex min-h-[46px] items-center justify-center rounded-full px-2.5 text-[15px] no-underline" style={{ fontFamily: font.display, color: colors.rust, boxShadow: `inset 0 0 0 1.5px ${colors.vertPale}` }}>
                Ouvrir le PDF
              </Link>
              {finalisee ? (
                <span data-atlas="fiche-enregistree" className="flex min-h-[46px] items-center justify-center gap-2 rounded-full text-[15px]" style={{ fontFamily: font.display, color: colors.rust, boxShadow: `inset 0 0 0 1.5px ${colors.vertPale}` }}>
                  <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full" style={{ background: colors.plein, color: surPlein }}><Coche /></span>
                  Enregistrée
                </span>
              ) : (
                <button type="button" data-atlas="enregistrer-la-fiche" aria-disabled={manquent.length > 0} disabled={occupe} onClick={finaliser} className="flex min-h-[46px] items-center justify-center rounded-full text-[15px]" style={{ fontFamily: font.display, background: manquent.length ? "transparent" : colors.plein, color: manquent.length ? colors.rust : surPlein, boxShadow: manquent.length ? `inset 0 0 0 1.5px ${colors.vertPale}` : "none", opacity: manquent.length ? 0.45 : 1 }}>
                  Enregistrer
                </button>
              )}
            </div>
            <Link href="/planning" data-atlas="retour-au-planning" className="mx-auto block w-max px-3 py-1.5 text-[14px] font-bold no-underline" style={{ color: colors.ink }}>
              {finalisee ? "Retour au planning" : "Plus tard"}
            </Link>
          </div>
        }
      >
        <h2 data-atlas="fiche-signee" className="m-0 text-[26px] leading-[1.15]" style={{ fontFamily: font.display }}>{manquent.length ? "Signatures en attente" : "Fiche signée"}</h2>
        <p className="m-0 mt-1.5 text-[14px]" style={{ color: colors.muted }}>
          {manquent.length ? "Elle s’enregistre quand tout le monde a signé." : finalisee ? `Enregistrée. Gardée jusqu’au ${dateLongue(gardeeJusquAu(signeeLe))}.` : "Tout le monde a signé : enregistrez-la."}
        </p>
        <Bloc id="signatures" titre="Les signatures">
          <Personnage nom={contenu.signataire} detail={`Chef d’entreprise. A signé la fiche le ${dateLongue(signeeLe)} à ${heure(signeeLe)}.`} signe />
          {(presents.length > 0 || contenu.lectures.length > 0) && <Aide haut>Chacun signe qu’il a lu la fiche, avant de commencer.</Aide>}
          {contenu.lectures.map((l) => (
            <Personnage key={l.nom} nom={l.nom} detail={`A lu la fiche à ${heure(new Date(l.le))}.`} signe image={l.png} />
          ))}
          {manquent.map((nom) => (
            <div key={nom} className="flex min-h-[52px] items-center gap-3 border-t" style={{ borderColor: colors.lineSoft }}>
              <span aria-hidden="true" className="h-6 w-6 flex-none rounded-full" style={{ boxShadow: `inset 0 0 0 1.5px ${colors.vertPale}` }} />
              <span className="min-w-0 flex-1 text-[15px]">{nom}</span>
              <button type="button" data-atlas="absent" onClick={() => void marquerAbsent(nom)} className="min-h-[40px] px-1 text-[13px] font-bold" style={{ color: colors.muted }}>Absent</button>
              <button type="button" data-atlas="faire-signer" onClick={() => { setRefus(null); setTraceDuLecteur([]); setLecteur(nom); }} className="min-h-[40px] flex-none rounded-full px-4 text-[14px]" style={{ background: colors.plein, color: surPlein }}>Signer</button>
            </div>
          ))}
          {manquent.length > 0 && <p className="m-0 mt-2.5 text-[13px] font-semibold" style={{ color: colors.alert }}>{manquent.join(" et ")} {manquent.length > 1 ? "doivent" : "doit"} signer avant d’enregistrer la fiche. Quelqu’un n’est pas venu ? Touchez « Absent ».</p>}
        </Bloc>
        <Bloc id="envoi" titre="À qui l’envoyer" explication="Ce que la loi demande, destinataire par destinataire.">
          <Destinataire titre="Votre équipe" obligation="Obligatoire, avant de commencer">
            Chacun doit l’avoir lue avant le premier coup de tronçonneuse. {manquent.length ? "Faites signer chacun ci-dessus." : "C’est fait : tout le monde a signé."}
            {envoyerA("equipe", "Envoyer à l’équipe")}
          </Destinataire>
          <Destinataire titre="Les entreprises sur place" obligation={autresEntreprises.length ? "Obligatoire, avant de commencer" : "Rien à faire"} libre={autresEntreprises.length === 0}>
            {autresEntreprises.length ? "Montrez-leur la fiche : les secours s’organisent ensemble. Chacune fait aussi la sienne." : "Aucune autre entreprise sur ce chantier."}
            {autresEntreprises.map((x) => <span key={x.nom} className="block">{envoyerA(`entreprise:${x.nom}`, `Envoyer à ${x.nom}`)}</span>)}
          </Destinataire>
          <Destinataire titre="Votre client">
            Ce client (une entreprise, une mairie, un syndic) vous a-t-il fait remplir un plan de prévention ?
            <span className="mt-1 block text-[13px]" style={{ color: colors.muted }}>C’est le document qu’un client professionnel vous fait signer avant de travailler sur son site.</span>
            <span className="mt-2.5 grid grid-cols-2 gap-1.5">
              <Choix actif={contenu.prevention === "non"} onClick={() => void repondreALaPrevention("non")}>Non</Choix>
              <Choix actif={contenu.prevention === "oui"} onClick={() => void repondreALaPrevention("oui")}>Oui</Choix>
            </span>
            {contenu.prevention === "oui" && <span className="mt-2.5 block"><b className="font-semibold" style={{ color: colors.ink }}>Obligatoire</b> : envoyez-lui la fiche.{envoyerA("client", "Envoyer au client")}</span>}
            {contenu.prevention === "non" && <span className="mt-2.5 block">Rien à envoyer. Un particulier n’a pas à la recevoir.</span>}
          </Destinataire>
          <Destinataire titre="La garder" obligation={finalisee ? "Fait par Atlas" : "Après toutes les signatures"} libre={finalisee}>
            Elle doit rester sur le chantier pendant les travaux : votre téléphone suffit. {finalisee ? `Atlas la garde deux ans, jusqu’au ${dateLongue(gardeeJusquAu(signeeLe))}, rangée dans Paysage.` : "Atlas la garde deux ans, dès qu’elle est enregistrée."}
            {finalisee && paysageOuvert && <> <Link href="/paysage/fiches-securite" className="font-bold no-underline" style={{ color: colors.ink }}>Voir où</Link></>}
          </Destinataire>
        </Bloc>
        {lecteur && (
          <div className="fixed inset-0 z-[60] flex items-end" style={{ background: voile(colors.ink, 0.35) }}>
            <div data-atlas="feuillet-de-lecture" className="w-full rounded-t-[20px] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[18px]" style={{ background: colors.cream }}>
              <p className="m-0 text-[20px] leading-[1.2]" style={{ fontFamily: font.display }}>{lecteur}</p>
              <p className="m-0 mt-1 text-[13.5px]" style={{ color: colors.muted }}>J’ai pris connaissance de la fiche.</p>
              <div className="mt-3"><Signature trace={traceDuLecteur} onTrace={setTraceDuLecteur} /></div>
              {refus && <p className="m-0 mt-2 text-[13px] font-semibold" style={{ color: colors.alert }}>{refus}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Creux onClick={() => { setLecteur(null); setRefus(null); }}>Annuler</Creux>
                <Vert pleine data-atlas="valider-la-lecture" disabled={occupe} onClick={signerLaLecture}>Valider</Vert>
              </div>
            </div>
          </div>
        )}
      </Cadre>
    );
  }

  // ══════════════════ LES SIX ÉCRANS ══════════════════
  const entete = (
    <div className="flex items-center gap-1.5 px-2.5 pt-2" style={{ minHeight: 58 }}>
      <button type="button" aria-label="Retour" data-atlas="retour-de-la-fiche" data-geste-retour="" onClick={retour} className="grid h-11 w-11 flex-none place-items-center" style={{ color: colors.rust }}>
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
  const manquesCroquis = manquesDuCroquis(contenu.croquis);

  return (
    <Cadre
      entete={<>{entete}{avancee}</>}
      pied={
        etape < NOMBRE_D_ETAPES ? (
          <Vert data-atlas="suivant" disabled={occupe} onClick={suivant}>Suivant</Vert>
        ) : (
          <button type="button" data-atlas="signer-la-fiche" aria-disabled={legal.length > 0} disabled={occupe} onClick={signer} className="mx-auto flex min-h-[46px] w-max max-w-full items-center justify-center rounded-full px-[26px] text-[15.5px]" style={{ fontFamily: font.display, background: legal.length ? "transparent" : colors.plein, color: legal.length ? colors.rust : surPlein, boxShadow: legal.length ? `inset 0 0 0 1.5px ${colors.vertPale}` : "none", opacity: legal.length ? 0.45 : 1 }}>
            Signer la fiche
          </button>
        )
      }
    >
      {champInvisibleDuFond}
      <h2 className="m-0 mb-1 text-[24px] leading-[1.15]" style={{ fontFamily: font.display }}>{ETAPES[etape - 1]}</h2>
      {refus && etape < NOMBRE_D_ETAPES && <p className="m-0 mb-2 text-[13px]" style={{ color: colors.alert }}>{refus}</p>}

      {etape === 1 && (
        <>
          <Bloc id="identification" titre="Identification" explication="Déjà rempli d’après le chantier. Rien à écrire.">
            <Fixe nom="Nom du chantier">{contexte.chantierNom}</Fixe>
            <Fixe nom="N° de devis et/ou de commande afférent" vide={!contexte.numeroDevis}>{contexte.numeroDevis ?? "aucun devis"}</Fixe>
          </Bloc>
          <Bloc id="entreprise" titre="Entreprise réalisant le chantier" explication="Vous. Le numéro est celui qu’on appelle s’il arrive quelque chose.">
            <Fixe nom="Raison sociale">{contexte.entreprise.nom}</Fixe>
            <Champ nom="Téléphone (en cas d’incident ou d’accident)" {...champ("telephoneIncident")} type="tel" />
          </Bloc>
          <Bloc id="donneur" titre="Donneur d’ordre" explication="Qui vous a commandé les travaux ? Le client du devis, ou quelqu’un d’autre : une entreprise qui vous sous-traite, un syndic, une mairie.">
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
                <div className="mt-2.5 grid grid-cols-2 gap-2 [&>*]:mt-0 [&>*]:min-w-0">
                  <Champ nom="Nom" {...champ("donneurNom")} placeholder="Exemple : Dubeaujardin" />
                  <Champ nom="Prénom" {...champ("donneurPrenom")} placeholder="Exemple : Marc" />
                </div>
                <Champ nom="Téléphone (en cas d’incident ou d’accident)" {...champ("donneurTel")} type="tel" placeholder="Exemple : 06 00 00 00 00" />
              </>
            )}
            {contenu.donneur && <Champ nom="Ce qu’il est pour le chantier" {...champ("donneurRole")} placeholder="Exemple : propriétaire, syndic, mairie" />}
          </Bloc>
          <Bloc id="lieu" titre="Identification du chantier" explication="Où est le chantier, et quand. Relevez la position GPS sur place : elle guide les secours.">
            <Fixe nom="Lieu (adresse)" vide={!contexte.adresse}>{contexte.adresse ?? "non renseignée"}</Fixe>
            <div className="mt-2.5">
              <span className="mb-[3px] block text-[12.5px]" style={{ color: colors.muted }}>Coordonnées GPS</span>
              {contenu.gps ? (
                <Champ nom="" {...champ("gps")} placeholder="Exemple : 48.94123, 1.72004" />
              ) : (
                <>
                  <button type="button" data-atlas="relever-gps" disabled={releveEnCours} onClick={() => { setReleveEnCours(true); setRefus(null); releverLaPosition((gps) => setContenu((c) => ({ ...c, gps })), (r) => { setRefus(r); setGpsAEcrire(true); }, () => setReleveEnCours(false)); }} className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full text-[15px]" style={{ background: colors.card, color: releveEnCours ? colors.muted : colors.rust, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
                    <Cible /> {releveEnCours ? "Relevé en cours…" : "Relever ici"}
                  </button>
                  {gpsAEcrire && <Champ nom="" {...champ("gps")} placeholder="Exemple : 48.94123, 1.72004" />}
                </>
              )}
            </div>
            <Champ nom="Adresse d’accès des secours, si elle est différente" {...champ("adresseSecours")} placeholder="Exemple : portail arrière, chemin des Saules" />
            <Aide haut>Dates d’exécution, d’après le planning</Aide>
            <div className="mt-2.5 grid grid-cols-2 gap-2 [&>*]:mt-0 [&>*]:min-w-0">
              <Fixe nom="Début, jour" vide={!contexte.datePlanifiee}>{jourDepuisIso(contexte.datePlanifiee) || "pas encore planifié"}</Fixe>
              <Fixe nom="Fin, jour" vide={!contexte.datePlanifiee}>{jourDepuisIso(contexte.datePlanifiee) || "pas encore planifié"}</Fixe>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 [&>*]:mt-0 [&>*]:min-w-0">
              <Champ nom="Début, heures" {...champ("heureDebut")} type="time" />
              <Champ nom="Fin, heures" {...champ("heureFin")} type="time" />
            </div>
            <Vigilance>{POINTS_DE_VIGILANCE.horaires}</Vigilance>
          </Bloc>
          <Bloc id="responsables" titre="Responsables de l’entreprise sur le chantier" explication="Qui commande sur place. Il peut y en avoir plusieurs.">
            <div className="grid grid-cols-2 gap-2 [&>*]:mt-0 [&>*]:min-w-0">
              <Champ nom="Nom" {...champ("responsableNom")} />
              <Champ nom="Prénom" {...champ("responsablePrenom")} />
            </div>
            <Champ nom="Téléphone" {...champ("responsableTel")} type="tel" />
            {contenu.autresResponsables.map((r, i) => (
              <Carte key={i} titre={`Responsable ${i + 2}`} onRetirer={() => setContenu((c) => ({ ...c, autresResponsables: c.autresResponsables.filter((_, k) => k !== i) }))}>
                <div className="grid grid-cols-2 gap-2 [&>*]:mt-0 [&>*]:min-w-0">
                  <Champ nom="Nom et prénom" value={r.nom} onChange={(e) => setContenu((c) => ({ ...c, autresResponsables: c.autresResponsables.map((x, k) => (k === i ? { ...x, nom: e.target.value } : x)) }))} />
                  <Champ nom="Téléphone" type="tel" value={r.tel} onChange={(e) => setContenu((c) => ({ ...c, autresResponsables: c.autresResponsables.map((x, k) => (k === i ? { ...x, tel: e.target.value } : x)) }))} />
                </div>
              </Carte>
            ))}
            <Ajout data-atlas="ajouter-un-responsable" onClick={() => setContenu((c) => ({ ...c, autresResponsables: [...c.autresResponsables, { nom: "", tel: "" }] }))}>Ajouter un responsable</Ajout>
            <Aide haut>Gardés pour vos prochaines fiches.</Aide>
          </Bloc>
          <Bloc id="entreprises" titre="Sous-traitants et autres entreprises" explication="Toute entreprise qui travaille avec vous sur le chantier. Les secours s’organisent ensemble, et elle doit voir cette fiche.">
            <div className="grid grid-cols-2 gap-1.5">
              <Choix actif={contenu.entreprisesSurPlace === "aucune"} onClick={() => setContenu((c) => ({ ...c, entreprisesSurPlace: "aucune" }))}>Aucune</Choix>
              <Choix actif={contenu.entreprisesSurPlace === "oui"} onClick={() => setContenu((c) => ({ ...c, entreprisesSurPlace: "oui" }))}>Oui</Choix>
            </div>
            {contenu.entreprisesSurPlace === "oui" && (
              <>
                {contenu.entreprises.some((x) => x.nom.trim()) && (
                  <>
                    <Aide haut>Vos entreprises habituelles. Un appui, et sa fiche revient.</Aide>
                    <div className="flex flex-wrap gap-1.5">
                      {contenu.entreprises.map((x, i) => x.nom.trim() && (
                        <Pastille key={i} active={x.presente} onClick={() => setContenu((c) => ({ ...c, entreprises: c.entreprises.map((y, k) => (k === i ? { ...y, presente: !y.presente } : y)) }))}>{x.nom}</Pastille>
                      ))}
                    </div>
                  </>
                )}
                {contenu.entreprises.map((x, i) => (x.presente || !x.nom.trim()) && (
                  <Carte key={i} titre={x.nom.trim() || "Nouvelle entreprise"} onRetirer={() => setContenu((c) => ({ ...c, entreprises: c.entreprises.filter((_, k) => k !== i) }))}>
                    <Champ nom="Raison sociale" value={x.nom} placeholder="Exemple : Élec Services" onChange={(e) => setContenu((c) => ({ ...c, entreprises: c.entreprises.map((y, k) => (k === i ? { ...y, nom: e.target.value } : y)) }))} />
                    <div className="mt-2.5 grid grid-cols-2 gap-2 [&>*]:mt-0 [&>*]:min-w-0">
                      <Champ nom="Téléphone" type="tel" value={x.tel} onChange={(e) => setContenu((c) => ({ ...c, entreprises: c.entreprises.map((y, k) => (k === i ? { ...y, tel: e.target.value } : y)) }))} />
                      <Champ nom="Ce qu’elle fait" value={x.quoi} placeholder="Exemple : coupe la ligne" onChange={(e) => setContenu((c) => ({ ...c, entreprises: c.entreprises.map((y, k) => (k === i ? { ...y, quoi: e.target.value } : y)) }))} />
                    </div>
                    <Case cochee={x.montree} onClick={() => setContenu((c) => ({ ...c, entreprises: c.entreprises.map((y, k) => (k === i ? { ...y, montree: !y.montree } : y)) }))}>Fiche présentée à son responsable</Case>
                  </Carte>
                ))}
                <Ajout data-atlas="nouvelle-entreprise" onClick={() => setContenu((c) => ({ ...c, entreprises: [...c.entreprises, { nom: "", tel: "", quoi: "", presente: true, montree: false }] }))}>Nouvelle entreprise</Ajout>
                <Aide haut>Chaque entreprise est gardée pour vos prochaines fiches. Elle fait aussi sa propre fiche.</Aide>
              </>
            )}
          </Bloc>
          <Bloc id="equipe" titre="L’équipe et ses compétences" explication="Cochez qui vient sur ce chantier. Les compétences s’écrivent une fois, et reviennent sur chaque fiche.">
            {contenu.equipe.map((p, i) => {
              const sst = validite(p.sst, aujourdhui), gsa = validite(p.gsa, aujourdhui);
              const bien = [...p.formations, sst.ok && sst.fin && `SST jusqu’au ${dateLongue(sst.fin)}`, gsa.ok && gsa.fin && `GSA jusqu’au ${dateLongue(gsa.fin)}`].filter(Boolean).join(", ");
              const mal = [!sst.ok && (sst.fin ? `SST dépassé depuis le ${dateLongue(sst.fin)}.` : "Pas de SST."), !gsa.ok && (gsa.fin ? `GSA dépassé depuis le ${dateLongue(gsa.fin)}.` : "Pas de GSA.")].filter(Boolean).join(" ");
              return (
                <div key={i} data-atlas="personne-de-l-equipe" className="flex items-start gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: colors.lineSoft }}>
                  <button type="button" aria-pressed={p.present} aria-label={`${p.nom || "Cette personne"} vient`} onClick={() => changerLEquipe(contenu.equipe.map((x, k) => (k === i ? { ...x, present: !x.present } : x)))} className="mt-[1px] grid h-6 w-6 flex-none place-items-center rounded-full" style={{ background: p.present ? colors.plein : colors.card, boxShadow: p.present ? "none" : `inset 0 0 0 1.5px ${colors.vertPale}`, color: p.present ? surPlein : "transparent" }}><Coche /></button>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">{p.nom || "Sans nom"}</span>
                    {bien && <span className="mt-0.5 block text-[12.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>{bien}</span>}
                    {mal && <span className="mt-0.5 block text-[12.5px] font-semibold leading-[1.4]" style={{ color: colors.alert }}>{mal}</span>}
                  </span>
                  <button type="button" data-atlas="competences" onClick={() => setPersonneOuverte(i)} className="min-h-[44px] flex-none px-0.5 text-[13.5px] font-bold" style={{ color: colors.ink }}>Compétences</button>
                </div>
              );
            })}
            <Ajout data-atlas="ajouter-une-personne" onClick={() => { changerLEquipe([...contenu.equipe, { nom: "", present: true, formations: [], sst: "", gsa: "" }]); setPersonneOuverte(contenu.equipe.length); }}>Ajouter une personne</Ajout>
            {contenu.equipe.length === 0 && (
              <div className="mt-2.5">
                <span className="mb-[3px] block text-[12.5px]" style={{ color: colors.muted }}>Nombre de travailleurs de l’entreprise</span>
                <div className="flex items-center gap-2.5">
                  <Compteur signe="moins" onClick={() => setContenu((c) => ({ ...c, nombreDeTravailleurs: Math.max(1, c.nombreDeTravailleurs - 1) }))} />
                  <span data-atlas="nombre-de-travailleurs" className="min-w-[34px] text-center text-[24px] leading-none" style={{ fontFamily: font.display }}>{contenu.nombreDeTravailleurs}</span>
                  <Compteur signe="plus" onClick={() => setContenu((c) => ({ ...c, nombreDeTravailleurs: c.nombreDeTravailleurs + 1 }))} />
                </div>
              </div>
            )}
            <Vigilance>{POINTS_DE_VIGILANCE.mainDOeuvre}</Vigilance>
            <Champ nom="Autres précisions sur l’équipe" {...champ("mainDOeuvre")} lignes={2} placeholder="Exemple : 3 personnes en CDI, un intérimaire" />
            <Aide haut>L’équipe, ses compétences et ce texte sont gardés pour vos prochaines fiches.</Aide>
          </Bloc>
        </>
      )}

      {etape === 2 && (
        <>
          <Bloc id="travaux" titre="Travaux à réaliser" explication="Cochez ce que vous allez faire sur ce chantier.">
            {contexte.lignesDuDevis.length > 0 && (
              <Aide>Le devis dit : <b style={{ color: colors.inkSoft, fontWeight: 600 }}>{contexte.lignesDuDevis.join(", ")}</b>.</Aide>
            )}
            <Groupe {...g} famille="travaux" genre="pastilles" />
            <Vigilance>{POINTS_DE_VIGILANCE.activites}</Vigilance>
          </Bloc>
          <Bloc id="epi" titre="Les EPI" explication="Les équipements de protection que l’équipe porte sur ce chantier. Pour les vêtements anti-coupure, précisez la classe 1, 2 ou 3 avec « Ajouter ».">
            <Groupe {...g} famille="epi" genre="pastilles" />
          </Bloc>
          <Bloc id="materiel" titre="Matériels" explication="Cochez le matériel que vous allez utiliser sur ce chantier.">
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
          <Bloc id="situation" titre="La situation des travaux" explication="Où se passe le chantier. Une voie ferrée, une ligne électrique ou un site classé demandent des autorisations à part.">
            <Groupe {...g} famille="situation" genre="pastilles" />
          </Bloc>
          <Bloc id="arbres-dangereux" titre="Les arbres dangereux" explication="Un arbre mort, creux, fissuré, qui peut casser pendant le travail. Chacun prend son numéro sur le croquis.">
            <div className="grid grid-cols-2 gap-1.5">
              <Choix actif={contenu.arbresDangereux === "non"} onClick={() => setContenu((c) => ({ ...c, arbresDangereux: "non" }))}>Non</Choix>
              <Choix actif={contenu.arbresDangereux === "oui"} onClick={() => setContenu((c) => ({ ...c, arbresDangereux: "oui", arbres: c.arbres.length ? c.arbres : [arbreVide(false)] }))}>Oui</Choix>
            </div>
            {contenu.arbresDangereux === "oui" && (
              <>
                {contenu.arbres.map((a, i) => (
                  <Carte key={i} titre={`${a.groupe ? "Groupe d’arbres" : "Arbre"} ${i + 1}`} precision={`numéro ${i + 1} sur le croquis`} onRetirer={() => setContenu((c) => ({ ...c, arbres: c.arbres.filter((_, k) => k !== i) }))}>
                    <Aide haut>Intervention</Aide>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Choix actif={a.intervention === "Abattage"} onClick={() => changerUnArbre(i, { intervention: "Abattage" })}>Abattage</Choix>
                      <Choix actif={a.intervention === "Élagage"} onClick={() => changerUnArbre(i, { intervention: "Élagage" })}>Élagage</Choix>
                    </div>
                    <Aide haut>Dangers vus</Aide>
                    <div className="flex flex-wrap gap-1.5">
                      {DANGERS_D_UN_ARBRE.map((d) => <Pastille key={d} active={a.dangers.includes(d)} onClick={() => changerUnArbre(i, { dangers: basculer(a.dangers, d) })}>{d}</Pastille>)}
                    </div>
                    <Aide haut>Consignes</Aide>
                    <div className="flex flex-wrap gap-1.5">
                      {CONSIGNES_D_UN_ARBRE.map((d) => <Pastille key={d} active={a.consignes.includes(d)} onClick={() => changerUnArbre(i, { consignes: basculer(a.consignes, d) })}>{d}</Pastille>)}
                    </div>
                    <Champ nom="Autres consignes pour cet arbre" value={a.autres} placeholder="Exemple : démonter par le haut, côté maison" onChange={(e) => changerUnArbre(i, { autres: e.target.value })} />
                  </Carte>
                ))}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Ajout data-atlas="ajouter-un-arbre" onClick={() => setContenu((c) => ({ ...c, arbres: [...c.arbres, arbreVide(false)] }))}>Un arbre</Ajout>
                  <Ajout onClick={() => setContenu((c) => ({ ...c, arbres: [...c.arbres, arbreVide(true)] }))}>Un groupe d’arbres</Ajout>
                </div>
              </>
            )}
          </Bloc>
        </>
      )}

      {etape === 3 && (
        <>
          <Bloc id="croquis" titre="Le croquis" explication="Une carte, un croquis ou une photo du chantier : par où on entre, par où on passe, les arbres à traiter.">
            {!contenu.croquis.fond ? (
              <>
                <Aide>Obligatoire sur le croquis : les accès, les voies de circulation, les arbres à traiter.</Aide>
                <div className="flex flex-col gap-2">
                  <Vert pleine data-atlas="croquis-sur-photo" onClick={() => choisirLeFond("photo")}>Dessiner sur une photo du chantier</Vert>
                  <Creux data-atlas="croquis-page-blanche" onClick={() => choisirLeFond("blanc")}>Dessiner sur une page blanche</Creux>
                  <Creux data-atlas="croquis-importe" onClick={() => choisirLeFond("import")}>Importer un croquis déjà fait</Creux>
                </div>
              </>
            ) : (
              <>
                <ObligatoiresDuCroquis croquis={contenu.croquis} />
                <button type="button" data-atlas="apercu-du-croquis" onClick={() => setEditionDuCroquis(true)} aria-label="Ouvrir le croquis" className="mt-2.5 block w-full overflow-hidden rounded-[12px] p-0" style={{ aspectRatio: "4 / 3", boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
                  <DessinDuCroquis croquis={contenu.croquis} fondUrl={fondUrl} />
                </button>
                {manquesCroquis.length > 0 && <p className="m-0 mt-2 text-[13px] font-semibold" style={{ color: colors.alert }}>Croquis à finir. Il manque : {manquesCroquis.join(", ")}.</p>}
                <Creux data-atlas="modifier-le-croquis" onClick={() => setEditionDuCroquis(true)}>{manquesCroquis.length ? "Finir le croquis" : "Modifier le croquis"}</Creux>
                {contenu.croquis.marques.map((m, i) => m.t === "danger" && (
                  <Champ key={i} nom={`Zone de danger ${contenu.croquis.marques.slice(0, i + 1).filter((x) => x.t === "danger").length}, ce que c’est`} value={m.mot} placeholder="Exemple : chute de branches" onChange={(e) => { const mot = e.target.value.slice(0, 80); setContenu((c) => ({ ...c, croquis: { ...c.croquis, marques: c.croquis.marques.map((x, k) => (k === i && x.t === "danger" ? { ...x, mot } : x)) } })); }} />
                ))}
                <LegendeDuCroquis croquis={contenu.croquis} />
                {contenu.arbresDangereux === "oui" && contenu.croquis.marques.some((m) => m.t === "abattre" || m.t === "tailler") && <Aide haut>Les numéros des arbres sont ceux des arbres dangereux.</Aide>}
              </>
            )}
          </Bloc>
          <Bloc id="photos" titre="Photos du balisage" explication="Le balisage, les zones sensibles, un document. Prenez la photo, ou choisissez-la dans la photothèque.">
            <div className="mt-2 flex flex-wrap items-center gap-[7px]">
              {sesPhotos.map((p, i) => (
                <button key={p.id} type="button" onClick={() => setRangOuvert(i)} aria-label={`Photo ${i + 1} en grand`} data-atlas="photo-de-la-fiche" className="h-[46px] w-[46px] flex-none overflow-hidden rounded-[9px] p-0" style={{ boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
                  <img src={`/api/fichiers/${p.storageKey}`} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
              <label data-atlas="prendre-une-photo" className="grid h-[46px] w-[72px] flex-none cursor-pointer place-items-center rounded-[9px]" style={{ background: voile(colors.plein, 0.16), color: colors.rust, boxShadow: `inset 0 0 0 1px ${colors.vertPale}` }}>
                <Appareil />
                <input type="file" accept={ACCEPT_PHOTOS} multiple hidden onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void televerser(f); }} />
              </label>
            </div>
            {rangOuvert !== null && (
              <VisionneusePhoto photos={sesPhotos.map((p) => p.storageKey)} rang={rangOuvert} onRang={setRangOuvert} onFermer={() => setRangOuvert(null)}>
                {signeeLe === null && sesPhotos[rangOuvert] && (
                  <button type="button" data-atlas="retirer-photo-de-la-fiche" onClick={() => void retirerLaPhoto(sesPhotos[rangOuvert]!.id)} aria-label="Retirer cette photo" className="flex h-11 items-center justify-center rounded-full px-4 text-[11px] font-semibold uppercase" style={{ backgroundColor: voile(surPlein, 0.12), color: colors.orSurEncre, letterSpacing: "0.26em" }}>
                    Retirer
                  </button>
                )}
              </VisionneusePhoto>
            )}
          </Bloc>
          <Bloc id="balisage" titre="La délimitation du chantier" explication="Obligatoire : ce que vous mettez en place pour que personne n’entre dans la zone de danger.">
            <Rappel titre="Périmètre de sécurité, d’après le décret" lignes={PERIMETRE_DU_DECRET} />
            <Groupe {...g} famille="balisage" genre="cases" sous={{ [LIBELLES.balisage[2]]: <Champ nom="" {...champ("communication")} placeholder="Exemple : casques communicants à 3" /> }} />
          </Bloc>
        </>
      )}

      {etape === 4 && (
        <>
          <Aide>Répondez pour chaque risque. « Rien à signaler » est une réponse : il dit que vous avez regardé.</Aide>
          <Bloc id="risques-arbres" titre="Les arbres pendant l’intervention" explication="Ce qui peut tomber, casser ou céder pendant le travail.">
            <Groupe {...g} famille="risquesArbres" genre="pastilles" />
            <Aide haut>État sanitaire et physiologique des arbres</Aide>
            <Groupe {...g} famille="matieres" genre="cases" />
            <Vigilance>{POINTS_DE_VIGILANCE.matieres}</Vigilance>
            <Champ nom="Autres (à préciser)" {...champ("matieresAutres")} lignes={2} placeholder="Exemple : rien vu sur les chênes, à confirmer sur place" />
          </Bloc>
          <Bloc id="risques-biologiques" titre="Les risques biologiques" explication="Des bêtes ou des plantes dangereuses sur place ? Cochez-les, puis ce que vous faites contre.">
            <Groupe {...g} famille="biologique" genre="pastilles" />
            {aDesRisques(contenu, "biologique") && (
              <>
                <Aide haut>Mesures de prévention spécifiques au chantier</Aide>
                <Groupe {...g} famille="biologiqueMesures" genre="pastilles" />
              </>
            )}
          </Bloc>
          <Bloc id="risques-reseaux" titre="Les réseaux" precision="aériens et souterrains" explication="Des lignes électriques, des câbles ou des canalisations près des arbres, en l’air ou sous terre ?">
            <Groupe {...g} famille="reseaux" genre="pastilles" sous={{ Électrique: <Groupe {...g} famille="tensions" genre="pastilles" /> }} />
            {aDesRisques(contenu, "reseaux") && (
              <>
                <Aide haut>Mesures</Aide>
                <Groupe {...g} famille="reseauxMesures" genre="cases" sous={{ [LIBELLES.reseauxMesures[2]]: <Groupe {...g} famille="distances" genre="cases" /> }} />
                <Aide haut>Au cas où : <a href={DECOUVERTE_FORTUITE.url} target="_blank" rel="noopener" className="font-semibold" style={{ color: colors.rust, textDecoration: "underline", textDecorationColor: colors.or, textUnderlineOffset: 3 }}>{DECOUVERTE_FORTUITE.mot}</a></Aide>
              </>
            )}
          </Bloc>
          <Bloc id="risques-noyade" titre="La noyade" explication="Une piscine, une rivière, un bassin près des arbres ?">
            <Groupe {...g} famille="noyade" genre="pastilles" />
          </Bloc>
          <Bloc id="risques-environnement" titre="L’environnement du chantier" explication="Ce qui, autour du chantier, peut gêner ou blesser : la route, les passants, le bruit, un sol glissant.">
            <Groupe {...g} famille="environnement" genre="pastilles" />
            {(aDesRisques(contenu, "environnement") || aDesRisques(contenu, "noyade")) && (
              <>
                <Aide haut>Mesures</Aide>
                <Groupe {...g} famille="environnementMesures" genre="pastilles" sous={{ [LIBELLES.environnementMesures[4]]: <Champ nom="" {...champ("environnementPreciser")} placeholder="Exemple : gilets haute visibilité" /> }} />
              </>
            )}
          </Bloc>
          <Bloc id="coactivite" titre="Co-activité dans la zone de sécurité du chantier" explication="D’autres personnes travaillent en même temps dans la zone ? Une machine peut happer ou projeter ?">
            <Groupe {...g} famille="coactivite" genre="cases" />
            <Aide haut>Règles organisationnelles à mettre en place</Aide>
            <Groupe {...g} famille="organisation" genre="cases" sous={{ [LIBELLES.organisation[2]]: <Champ nom="" {...champ("organisationCommunication")} placeholder="Exemple : casques communicants" /> }} />
            <Vigilance>{POINTS_DE_VIGILANCE.manuel}</Vigilance>
          </Bloc>
          <Bloc id="autres-risques" titre="Risques autres identifiés, mesures de prévention autres" explication="Ce qui n’est dans aucune liste, et ce que vous faites contre.">
            <Champ nom="Risques autres identifiés" {...champ("risquesAutres")} lignes={2} placeholder="Exemple : coups de vent possibles" />
            <Champ nom="Mesures de prévention autres" {...champ("mesuresAutres")} lignes={2} placeholder="Exemple : rubalise autour de la propriété" />
            <Aide haut>Ces deux textes sont gardés pour vos prochaines fiches.</Aide>
          </Bloc>
        </>
      )}

      {etape === 5 && (
        <>
          <Bloc id="protocole" titre="Entrer dans une zone de danger" explication="Zone de chute, zone de broyage, zone avec engin : comment on y entre sans se faire blesser. Un texte modèle, à adapter au chantier.">
            <Champ nom="Protocole d’entrée en zone de danger" {...champ("protocole")} lignes={6} />
            <Aide haut>Votre version est gardée pour vos prochaines fiches.</Aide>
          </Bloc>
          <Bloc id="meteo" titre="Consignes sur la conduite à tenir en cas de phénomènes météorologiques imprévus" explication="La marche à suivre si le vent, l’orage ou une pluie forte arrive pendant le chantier.">
            <Vigilance>{POINTS_DE_VIGILANCE.bulletins}</Vigilance>
            <Groupe {...g} famille="meteo" genre="cases" />
          </Bloc>
          <Bloc id="secours" titre="Organisation des secours. Ressources humaines et matérielles" explication="Ce qu’il y a sur place pour porter secours, et où. Le Point de Rencontre des Secours, c’est l’endroit précis où les pompiers vous retrouvent.">
            {presents.length > 0 && (sansSst.length > 0 || !unGsa) && (
              <p className="m-0 mb-2 text-[13px] font-semibold" style={{ color: colors.alert }}>
                {sansSst.length > 0 && `${sansSst.join(" et ")} ${sansSst.length > 1 ? "n’ont" : "n’a"} pas de SST à jour. `}
                {!unGsa && "Personne n’a de GSA à jour sur ce chantier."}
              </p>
            )}
            <Groupe {...g} famille="secours" genre="cases" />
            <Champ nom="Préciser le lieu où se trouve la trousse de secours :" {...champ("lieuTrousse")} placeholder="Exemple : dans la cabine du camion" />
            <Aide>Gardé pour vos prochaines fiches.</Aide>
            <Champ nom="Préciser le Point de Rencontre des Secours :" {...champ("pointDeRencontre")} placeholder="Exemple : devant le portail du client" />
          </Bloc>
          <Bloc id="consignes" titre="Organisation des secours. Consignes et procédures" explication="La marche à suivre, dans l’ordre. Elle est imprimée sur la fiche : à lire avant de commencer.">
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
                        <a key={n} href={`tel:${n}`} className="flex min-h-[56px] flex-col items-center justify-center rounded-full no-underline" style={{ background: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
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
          <Bloc id="observations" titre="Observations / Consignes particulières" explication="Ce que l’équipe doit savoir en plus, pour ce chantier-là.">
            <Champ nom="" {...champ("observations")} lignes={3} placeholder="Exemple : prévenir le chef si quelque chose change" />
            <Aide haut>Ce texte est gardé pour vos prochaines fiches.</Aide>
          </Bloc>
        </>
      )}

      {etape === 6 && (
        <>
          {legal.length > 0 ? (
            <Bloc id="minimum-legal" titre="Pour pouvoir signer">
              <p className="m-0 mb-2 text-[13.5px] font-semibold leading-[1.45]" style={{ color: colors.alert }}>La loi exige ces éléments. Sans eux, la fiche ne peut être ni signée ni enregistrée.</p>
              <ul className="m-0 list-none p-0">
                {legal.map((x) => (
                  <li key={x.quoi} className="m-0">
                    <button type="button" data-atlas="manque-de-la-fiche" onClick={() => aller(x.etape, x.bloc)} className="flex min-h-[52px] w-full items-center gap-2.5 border-t py-2 text-left first:border-t-0" style={{ borderColor: colors.lineSoft }}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px]" style={{ color: colors.ink }}>{x.quoi}</span>
                        <span className="mt-0.5 block text-[12.5px] leading-[1.4]" style={{ color: colors.orTexte }}>{x.faire}</span>
                      </span>
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-none" style={{ color: colors.muted }}><path d="M7.5 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            </Bloc>
          ) : (
            <Bloc id="minimum-legal" titre="Le minimum légal">
              <div className="flex min-h-[44px] items-center gap-2.5 text-[14.5px]" style={{ color: colors.rust }}>
                <span aria-hidden="true" className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full" style={{ background: colors.plein, color: surPlein }}><Coche /></span>
                Tout ce que la loi exige est rempli
              </div>
            </Bloc>
          )}
          <Bloc id="enregistrement" titre="Signature du chef d’entreprise" explication="Le chef d’entreprise signe. Sa signature engage sa responsabilité. Ensuite, chaque personne de l’équipe signera l’avoir lue, sur ce téléphone.">
            <Champ nom="Nom et prénom du chef d’entreprise (ou de son représentant)" {...champ("signataire")} />
            <Fixe nom="Date">{dateLongue(new Date())}</Fixe>
            <div className="mt-2.5">
              <Signature trace={trace} onTrace={setTrace} />
            </div>
            {refus && <p className="m-0 mt-2 text-[13px] font-semibold" style={{ color: colors.alert }}>{refus}</p>}
          </Bloc>
        </>
      )}

      {editionDuCroquis && (
        <EditeurDuCroquis
          croquis={contenu.croquis}
          fondUrl={fondUrl}
          onChange={(croquis) => setContenu((c) => ({ ...c, croquis }))}
          onFond={choisirLeFond}
          onFermer={() => setEditionDuCroquis(false)}
        />
      )}
      {personneOuverte !== null && contenu.equipe[personneOuverte] && (
        <FeuilletDesCompetences
          personne={contenu.equipe[personneOuverte]}
          onChange={(p) => changerLEquipe(contenu.equipe.map((x, k) => (k === personneOuverte ? p : x)))}
          onRetirer={() => { changerLEquipe(contenu.equipe.filter((_, k) => k !== personneOuverte)); setPersonneOuverte(null); }}
          onFermer={() => setPersonneOuverte(null)}
        />
      )}
    </Cadre>
  );
}

const arbreVide = (groupe: boolean): ArbreDangereux => ({ groupe, intervention: null, dangers: [], consignes: [], autres: "" });
const basculer = (liste: readonly string[], mot: string) => (liste.includes(mot) ? liste.filter((x) => x !== mot) : [...liste, mot]);
/** Un vrai risque coché dans la famille, autre que la réponse « rien » : c'est ce qui ouvre les mesures. */
const aDesRisques = (contenu: ContenuFiche, famille: Famille) => (contenu.coches[famille] ?? []).some((x) => x !== "Rien à signaler" && x !== "Pas de risque de noyade");

function FeuilletDesCompetences({ personne, onChange, onRetirer, onFermer }: { personne: Personne; onChange: (p: Personne) => void; onRetirer: () => void; onFermer: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end" style={{ background: voile(colors.ink, 0.35) }}>
      <div data-atlas="feuillet-des-competences" className="max-h-[88%] w-full overflow-y-auto rounded-t-[20px] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[18px]" style={{ background: colors.cream }}>
        <Champ nom="Nom et prénom" value={personne.nom} placeholder="Exemple : Kevin Morel" onChange={(e) => onChange({ ...personne, nom: e.target.value })} />
        <Aide haut>Formations et diplômes</Aide>
        <div className="flex flex-wrap gap-1.5">
          {[...FORMATIONS, ...personne.formations.filter((f) => !(FORMATIONS as readonly string[]).includes(f))].map((f) => (
            <Pastille key={f} active={personne.formations.includes(f)} onClick={() => onChange({ ...personne, formations: basculer(personne.formations, f) })}>{f}</Pastille>
          ))}
        </div>
        <AjoutDeFormation onValider={(mot) => mot.trim() && onChange({ ...personne, formations: personne.formations.includes(mot.trim()) ? personne.formations : [...personne.formations, mot.trim()] })} />
        <div className="mt-2.5 grid grid-cols-2 gap-2 [&>*]:mt-0 [&>*]:min-w-0">
          <Champ nom="SST obtenu le" type="date" value={personne.sst} onChange={(e) => onChange({ ...personne, sst: e.target.value })} />
          <Champ nom="GSA obtenu le" type="date" value={personne.gsa} onChange={(e) => onChange({ ...personne, gsa: e.target.value })} />
        </div>
        <Aide haut>Les 24 mois se comptent tout seuls. Gardé pour vos prochaines fiches.</Aide>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Creux onClick={onRetirer}>Retirer de l’équipe</Creux>
          <Vert pleine data-atlas="valider-les-competences" onClick={onFermer}>Valider</Vert>
        </div>
      </div>
    </div>
  );
}

function AjoutDeFormation({ onValider }: { onValider: (mot: string) => void }) {
  const [mot, setMot] = useState("");
  return (
    <div className="mt-2 flex gap-2">
      <input type="text" autoComplete="off" value={mot} placeholder="Exemple : CACES grue" onChange={(e) => setMot(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onValider(mot); setMot(""); } }} className="min-h-[46px] min-w-0 flex-1 rounded-[10px] border-0 px-3 py-2.5 text-[16px] outline-none" style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}`, color: colors.ink, caretColor: colors.or }} />
      <button type="button" onClick={() => { onValider(mot); setMot(""); }} className="flex min-h-[46px] items-center justify-center rounded-full px-[18px] text-[15px]" style={{ fontFamily: font.display, background: colors.plein, color: surPlein }}>Ajouter</button>
    </div>
  );
}

function Personnage({ nom, detail, signe, image }: { nom: string; detail: string; signe?: boolean; image?: string }) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 border-t py-1.5 first:border-t-0" style={{ borderColor: colors.lineSoft }}>
      <span aria-hidden="true" className="grid h-6 w-6 flex-none place-items-center rounded-full" style={{ background: signe ? colors.plein : "transparent", color: surPlein, boxShadow: signe ? "none" : `inset 0 0 0 1.5px ${colors.vertPale}` }}><Coche /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{nom}</span>
        <span className="block text-[12px]" style={{ color: colors.muted }}>{detail}</span>
      </span>
      {image && <img src={image} alt={`Signature de ${nom}`} className="h-10 w-[84px] flex-none rounded-[6px] object-contain" style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.lineSoft}` }} />}
    </div>
  );
}

function Destinataire({ titre, obligation, libre, children }: { titre: string; obligation?: string; libre?: boolean; children: React.ReactNode }) {
  return (
    <div className="mt-2.5 rounded-[14px] px-3.5 py-3 first:mt-0" style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
      <p className="m-0 flex flex-wrap items-center gap-2">
        <span className="text-[17px] leading-[1.2]" style={{ fontFamily: font.display }}>{titre}</span>
        {obligation && <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: libre ? voile(colors.plein, 0.16) : voile(colors.or, 0.13), color: libre ? colors.rust : colors.orTexte }}>{obligation}</span>}
      </p>
      <div className="mt-1.5 text-[14px] leading-[1.45]" style={{ color: colors.inkSoft }}>{children}</div>
    </div>
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
  // Le signataire se propose même sur une fiche commencée : celles d'avant le
  // 22 septembre 2026 ne l'ont pas dans leur contenu, et l'écran le proposait.
  const signataire = fiche.contenu.signataire || `${contexte.patron.prenom ?? ""} ${contexte.patron.nom ?? ""}`.trim();
  if (fiche.etapeVue > 0 || fiche.signeeLe) return { ...fiche.contenu, signataire };
  return {
    ...fiche.contenu,
    signataire,
    telephoneIncident: fiche.contenu.telephoneIncident || contexte.entreprise.telephone || "",
    responsableNom: fiche.contenu.responsableNom || contexte.patron.nom || "",
    responsablePrenom: fiche.contenu.responsablePrenom || contexte.patron.prenom || "",
    responsableTel: fiche.contenu.responsableTel || contexte.entreprise.telephone || "",
    nombreDeTravailleurs: Math.max(1, contexte.equipes.length, fiche.contenu.nombreDeTravailleurs),
    equipe: fiche.contenu.equipe.length
      ? fiche.contenu.equipe
      : signataire ? [{ nom: signataire, present: true, formations: [], sst: "", gsa: "" }] : [],
    donneur: fiche.contenu.donneur ?? (contexte.client ? "client" : null),
  };
}

/**
 * LE RELEVÉ, ET SON RATTRAPAGE.
 *
 * La haute précision interroge la puce GPS : sous un couvert d’arbres, dans un
 * hangar ou une camionnette, elle dépasse le délai alors que la position du
 * réseau, elle, répond tout de suite. On redemande donc une fois sans l’exiger
 * — dix mètres d’écart guident les secours, une case vide non.
 *
 * Et le code du navigateur n’est plus jeté : `refusDuReleveGps` en fait une
 * phrase par cause (`fiche-securite.ts`).
 */
function releverLaPosition(pose: (gps: string) => void, refus: (r: string) => void, fini: () => void) {
  if (!navigator.geolocation) {
    refus("Ce téléphone ne donne pas sa position.");
    fini();
    return;
  }
  const ecrire = (p: GeolocationPosition) => {
    pose(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`);
    fini();
  };
  const abandonner = (e: GeolocationPositionError) => {
    refus(refusDuReleveGps(e.code));
    fini();
  };
  navigator.geolocation.getCurrentPosition(
    ecrire,
    (e) => {
      if (e.code !== e.TIMEOUT) {
        abandonner(e);
        return;
      }
      navigator.geolocation.getCurrentPosition(ecrire, abandonner, { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 });
    },
    { enableHighAccuracy: true, timeout: 12_000 }
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
function Bloc({ id, titre, precision, explication, children }: { id: string; titre: string; precision?: string; explication?: string; children: React.ReactNode }) {
  return (
    <div id={`bloc-${id}`} className="mt-4 scroll-mt-[96px] border-t pt-3.5 first-of-type:mt-2 first-of-type:border-t-0 first-of-type:pt-0" style={{ borderColor: colors.lineSoft }}>
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
    <a href={href} target="_blank" rel="noopener" className="flex min-h-[48px] items-center rounded-full px-5 text-[15px] font-semibold no-underline" style={{ background: colors.card, color: colors.rust, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
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
function Fixe({ nom, children, vide }: { nom: string; children: React.ReactNode; vide?: boolean }) {
  return (
    <div className="mt-2.5 first:mt-0">
      {nom && <span className="mb-[3px] block text-[12.5px]" style={{ color: colors.muted }}>{nom}</span>}
      <span className="flex min-h-[46px] items-center rounded-[10px] px-3 py-2.5 text-[16px] leading-[1.4]" style={{ background: colors.rustTint, boxShadow: `inset 0 0 0 1px ${colors.lineSoft}`, color: vide ? colors.muted : colors.ink, fontStyle: vide ? "italic" : "normal" }}>{children}</span>
    </div>
  );
}
function Champ({ nom, lignes, type, ...reste }: { nom: string; lignes?: number; type?: string; value: string; placeholder?: string; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void }) {
  // **LE CADRE SE DESSINE SUR LA BOÎTE, PAS SUR LE CHAMP — sinon il n’y a qu’un
  // encart.** Le 22 septembre 2026, le patron demande « deux encarts séparés »
  // pour les heures. Sur son iPhone, début et fin se lisaient comme une seule
  // barre blanche, alors que Nom et Prénom — le MÊME composant, deux lignes
  // plus bas — montraient bien deux cadres. Safari habille
  // `input[type="time"]` à sa façon et jette le trait qu’on pose dessus ; les
  // champs de texte, eux, le gardent. Et nos deux fonds sont trop proches
  // (`card` #faf9f5 sur `cream` #f5f3ee) pour que l’œil retrouve la séparation
  // sans ce trait.
  //
  // Un `<span>` n’est pas un contrôle de formulaire : aucun navigateur ne le
  // rhabille. Le cadre y vit donc, et il tient partout — y compris pour le
  // prochain `type` que le téléphone décidera d’habiller. `appearance: none`
  // reste pour que le CHAMP, lui, garde nos mesures.
  const dedans = { color: colors.ink, caretColor: colors.or, WebkitAppearance: "none", appearance: "none", background: "transparent" } as const;
  const classe = "block w-full min-h-[46px] rounded-[10px] border-0 px-3 py-2.5 text-[16px] leading-[1.4] outline-none";
  return (
    <label className="mt-2.5 block first:mt-0">
      {nom && <span className="mb-[3px] block text-[12.5px]" style={{ color: colors.muted }}>{nom}</span>}
      <span className="block rounded-[10px]" style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
        {lignes ? <textarea rows={lignes} className={`${classe} resize-none`} style={dedans} {...reste} /> : <input type={type ?? "text"} autoComplete="off" className={classe} style={dedans} {...reste} />}
      </span>
    </label>
  );
}
function Choix({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={actif} onClick={onClick} className="flex min-h-[46px] items-center justify-center rounded-full px-2.5 py-1.5 text-center text-[14.5px] leading-[1.2]" style={{ background: actif ? voile(colors.plein, 0.16) : colors.card, boxShadow: `inset 0 0 0 ${actif ? "1.5px" : "1px"} ${actif ? colors.rust : colors.line}`, color: actif ? colors.rust : colors.ink, fontWeight: actif ? 600 : 400 }}>
      {children}
    </button>
  );
}
function Compteur({ signe, onClick }: { signe: "plus" | "moins"; onClick: () => void }) {
  return (
    <button type="button" aria-label={signe === "plus" ? "Un de plus" : "Un de moins"} onClick={onClick} className="grid h-[46px] w-[46px] place-items-center rounded-full" style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}`, color: colors.rust }}>
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

function Creux({ children, onClick, disabled, ...reste }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; "data-atlas"?: string }) {
  return (
    <button type="button" {...reste} disabled={disabled} onClick={onClick} className="mt-2.5 flex min-h-[46px] w-full items-center justify-center rounded-full px-2.5 text-[15px]" style={{ fontFamily: font.display, color: colors.rust, boxShadow: `inset 0 0 0 1.5px ${colors.vertPale}`, opacity: disabled ? 0.45 : 1 }}>
      {children}
    </button>
  );
}
function Ajout({ children, onClick, ...reste }: { children: React.ReactNode; onClick: () => void; "data-atlas"?: string }) {
  return (
    <button type="button" {...reste} onClick={onClick} className="mt-2.5 inline-flex min-h-[44px] items-center gap-1.5 rounded-full py-2 pl-2.5 pr-3.5 text-[14px]" style={{ background: voile(colors.plein, 0.16), color: colors.rust, boxShadow: `inset 0 0 0 1px ${colors.vertPale}` }}>
      <Plus /> {children}
    </button>
  );
}
function Pastille({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className="inline-flex min-h-[44px] items-center gap-[7px] rounded-full py-2 pl-3 pr-3.5 text-left text-[14px] leading-[1.2]" style={{ background: active ? voile(colors.plein, 0.16) : colors.card, boxShadow: `inset 0 0 0 ${active ? "1.5px" : "1px"} ${active ? colors.plein : colors.line}`, color: colors.ink }}>
      <span aria-hidden="true" className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full" style={{ background: active ? colors.plein : "transparent", boxShadow: active ? "none" : `inset 0 0 0 1.5px ${colors.vertPale}`, color: active ? surPlein : "transparent" }}><Coche /></span>
      {children}
    </button>
  );
}
function Case({ cochee, onClick, children }: { cochee: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={cochee} onClick={onClick} className="mt-1.5 flex min-h-[44px] w-full items-start gap-3 py-[6px] text-left text-[14.5px] leading-[1.45]" style={{ color: colors.ink }}>
      <span aria-hidden="true" className="mt-[-1px] grid h-6 w-6 flex-none place-items-center rounded-full" style={{ background: cochee ? colors.plein : colors.card, boxShadow: cochee ? "none" : `inset 0 0 0 1.5px ${colors.vertPale}`, color: cochee ? surPlein : "transparent" }}><Coche /></span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}
function Carte({ titre, precision, onRetirer, children }: { titre: string; precision?: string; onRetirer: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-2.5 rounded-[14px] px-3.5 py-3" style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 text-[17px] leading-[1.2]" style={{ fontFamily: font.display }}>{titre}</span>
        {precision && <span className="flex-none text-[12px]" style={{ color: colors.muted }}>{precision}</span>}
        <button type="button" onClick={onRetirer} className="min-h-[40px] flex-none px-1 text-[13px] font-bold" style={{ color: colors.alert }}>Retirer</button>
      </div>
      {children}
    </div>
  );
}
