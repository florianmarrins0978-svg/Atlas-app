"use client";

import { useState } from "react";
import { colors } from "@/lib/design-tokens";
import {
  adresseDeTelechargement,
  messageDeTelechargementRate,
  nomAnnonceParLeServeur,
} from "@/lib/remise-de-fichier";

/**
 * « Télécharger » — le seul geste qui range VRAIMENT un document sur un iPhone.
 *
 * ─── POURQUOI UN LIEN NE POUVAIT PAS SUFFIRE ────────────────────────────────
 *
 * **Sa capture du 12 septembre 2026 :** *« Je peux plus télécharger en cliquant
 * sur télécharger »*, sous une facture. Troisième fois sur le même bouton, et
 * les deux corrections précédentes tournaient autour du même point aveugle :
 *
 *   · le 7 septembre, le serveur s'est mis à mentir sur le TYPE du fichier pour
 *     forcer l'enregistrement. Le fichier descendait — et se rouvrait blanc,
 *     parce que le mensonge colle au fichier enregistré ;
 *   · le 10 septembre, ce mensonge a été défait. Le PDF redevient lisible, et
 *     **Safari recommence à le peindre au lieu de le ranger** : un PDF servi en
 *     `Content-Disposition: attachment` reste un document qu'iOS sait ouvrir.
 *
 * Les deux états sont vrais en même temps, et c'est ce qui fermait la boucle :
 * tant que c'est un LIEN qui remet le fichier au navigateur, on ne choisit
 * qu'entre un document illisible et un document qui ne descend pas.
 *
 * ─── CE QUI RANGE UN FICHIER SUR IOS ────────────────────────────────────────
 *
 * La feuille de partage, avec le fichier lui-même — « Enregistrer dans
 * Fichiers ». C'est la voie que `TODO.md` nommait déjà comme la seule restante,
 * et la seule qui garde au document son vrai type.
 *
 * Le fichier est donc **récupéré par la page**, puis remis :
 *
 *   1. à la feuille de partage quand le navigateur sait partager un fichier
 *      (iOS, Android) ;
 *   2. sinon à un lien d'objet local, qui range sans passer par le réseau
 *      (ordinateur) ;
 *   3. et si rien n'aboutit, **l'écran le DIT**. C'est la moitié qui manquait :
 *      un lien ne rapporte rien, et un refus de la route — session expirée,
 *      document archivé absent — se lisait comme « le bouton ne marche pas ».
 *
 * **Ce qui n'est pas éprouvé ici, et qui s'écrit comme tel** (`AGENTS.md`) :
 * aucun WebKit n'est installable dans l'environnement de l'agent. Ce qui est
 * prouvé, c'est la voie 2 et le message de la voie 3, dans un vrai navigateur
 * (`scripts/test-telecharger-document-e2e.ts`). Le passage par la feuille de
 * partage se juge sur son téléphone à lui.
 */
export default function BoutonTelechargerDocument({
  fichier,
  nom,
  children,
  className,
  style,
  dataAtlas,
  onFini,
}: {
  /** L'adresse du document, sans `?telecharger=1` — il est posé ici. */
  fichier: string;
  /**
   * Le nom sous lequel il se range, **si le serveur n'en annonce pas**.
   *
   * Il porte le numéro, jamais « facture.pdf » : il en aura des centaines dans
   * le même dossier. La route reste la source — le devis du client porte un nom
   * qu'elle seule connaît.
   */
  nom: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  dataAtlas?: string;
  /** Appelé quand le document est parti — pour refermer une feuille, par exemple. */
  onFini?: () => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function auClic() {
    if (enCours) return;
    setErreur(null);
    setEnCours(true);
    try {
      const reponse = await fetch(adresseDeTelechargement(fichier));
      if (!reponse.ok) {
        setErreur(messageDeTelechargementRate(reponse.status));
        return;
      }
      const contenu = await reponse.blob();
      const commeIlSAppelle = nomAnnonceParLeServeur(reponse.headers.get("content-disposition")) ?? nom;
      const piece = new File([contenu], commeIlSAppelle, { type: contenu.type || "application/pdf" });

      if (!(await partager(piece))) enregistrerParLienLocal(contenu, commeIlSAppelle);
      onFini?.();
    } catch (panne) {
      // **Jamais muet.** C'est ce silence qui a coûté trois allers-retours :
      // le réseau tombe, la page ne bouge pas, et le bouton passe pour cassé.
      setErreur(panne instanceof TypeError ? "Pas de réseau. Réessayez." : "Le document n'est pas arrivé.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <button type="button" onClick={auClic} data-atlas={dataAtlas} className={className} style={style}>
        {enCours ? "Un instant…" : children}
      </button>
      {erreur && (
        <p role="alert" className="mt-2 text-center text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}
    </>
  );
}

/** Ce que le navigateur sait faire d'un fichier, quand il sait en faire quelque chose. */
type PartageDeFichiers = {
  share?: (donnees: { files: File[] }) => Promise<void>;
  canShare?: (donnees: { files: File[] }) => boolean;
};

/**
 * La feuille de partage — « Enregistrer dans Fichiers » sur un iPhone.
 *
 * Rend `true` dès que le document a été remis au système, **y compris quand le
 * patron referme la feuille sans rien choisir** : il a vu son document, il a
 * décidé de ne pas le ranger. Lui en faire descendre une copie par la voie 2
 * serait faire l'inverse de ce qu'il vient de demander.
 */
async function partager(piece: File): Promise<boolean> {
  const navigateur = navigator as Navigator & PartageDeFichiers;
  if (!navigateur.share || !navigateur.canShare?.({ files: [piece] })) return false;
  try {
    await navigateur.share({ files: [piece] });
    return true;
  } catch (refus) {
    if (refus instanceof DOMException && refus.name === "AbortError") return true;
    // Le partage exige parfois que le geste soit encore « chaud » : la
    // récupération du fichier a pris trop de temps, et iOS refuse. Le lien
    // local, lui, n'a pas cette contrainte.
    return false;
  }
}

/**
 * Le fichier est déjà dans la page : on le range sans redemander au serveur.
 *
 * C'est ce qui rend l'attribut `download` enfin décisif — il porte sur un objet
 * local, pas sur une réponse dont le navigateur peut faire ce qu'il veut.
 */
function enregistrerParLienLocal(contenu: Blob, nom: string) {
  const adresse = URL.createObjectURL(contenu);
  const lien = window.document.createElement("a");
  lien.href = adresse;
  lien.download = nom;
  window.document.body.append(lien);
  lien.click();
  lien.remove();
  // La mémoire se rend au tour suivant : révoquer dans la foulée retirerait
  // l'objet au navigateur avant qu'il ait fini de le lire.
  setTimeout(() => URL.revokeObjectURL(adresse), 0);
}
