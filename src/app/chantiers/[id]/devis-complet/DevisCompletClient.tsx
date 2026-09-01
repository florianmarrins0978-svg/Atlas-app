"use client";

import Link from "next/link";
import { ligneAttendSonPrix } from "@/lib/preparation-devis";
import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import { adressesDuDocument } from "@/lib/adresses";
import { enEuros } from "@/lib/euros";
import { jourNumerique } from "@/lib/jour";
import LigneRetirable from "@/components/atlas/LigneRetirable";
import NumeroDeDocument from "@/components/atlas/NumeroDeDocument";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import { CIVILITES, type Civilite } from "@/lib/civilite";
import type { Changement } from "@/lib/retouches-devis";
import {
  LIBELLE_REDUCTION,
  lignesParCategorie,
  pourcentValide,
  tauxDeLaLigne,
  tauxLisible,
  tauxTvaValide,
  totauxAvecReduction,
} from "@/lib/reduction-devis";
import DicterDansLeDevis from "./DicterDansLeDevis";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import EnvoiAuClient from "../export/EnvoiAuClient";
import { ouvrirLaMessagerie } from "@/lib/ouvrir-messagerie";
import { libelleRetourDuDevis, retourDuDevis } from "@/lib/retour-du-devis";
import {
  appliquerRetouchesAction,
  majEmetteurAction,
  majClientDuDevisAction,
  majAdresseChantierAction,
  majLigneAction,
  ajouterLigneAction,
  retirerLigneAction,
  majEnTeteDevisAction,
  ajouterCategorieTvaAction,
  changerTauxCategorieAction,
  retirerCategorieTvaAction,
} from "./actions";

// **Le devis, seul sur sa page — et à l'image du papier.**
//
// Le patron, le 5 août 2026 : « une page où il n'y a QUE le devis, celui
// d'Arborea. C'est pour les patrons qui auront envie de le remplir à la main,
// qui n'ont pas envie d'utiliser la note vocale. »
//
// La mise en page reprend `appli/devis-modele.html`, qu'il avait construit
// lui-même : en-tête avec les références à droite, titre, émetteur et client
// côte à côte, tableau avec ses colonnes, totaux alignés à droite, conditions,
// cadre de signature. C'est aussi ce que le PDF imprime (`ARCHITECTURE.md`
// §16) — ce qui est à l'écran est ce que son client recevra.
//
// **Une feuille, pas un formulaire.** Les champs n'ont ni cadre ni fond tant
// qu'on n'y touche pas : ils se soulignent au survol et à la saisie. Un devis
// couvert de boîtes grises ressemble à un écran de saisie, et c'est
// précisément ce qu'il ne voulait plus.
//
// **Ce qui change par rapport au fichier d'origine** : celui-ci gardait tout
// dans le navigateur (`localStorage`). Ici chaque champ part vers SA source —
// l'entreprise, la fiche du client, le chantier, les lignes de prix — pour que
// la facture de fin de chantier et le relevé de TVA continuent d'en découler.

type Ligne = {
  id: string;
  libelle: string;
  quantite: string;
  prixUnitaire: string;
  montant: string;
  unite?: string | null;
  /** Le travail est identifié, son prix ne l'est pas (migration 0070). */
  aChiffrer?: boolean | null;
  /** Le taux de sa catégorie. `null` : la ligne suit le taux du devis (migration 0073). */
  tauxTva?: string | null;
};

/**
 * La clé du prix accordé dans le tiroir des retirés.
 *
 * **Réservée, et elle ne peut croiser aucune ligne** : celles-ci portent un
 * UUID. C'est ce qui permet au « − » de la remise de partager le tiroir des
 * lignes plutôt que d'en fabriquer un second — deux mécaniques de retrait sur
 * le même écran sont exactement ce que le patron a fait disparaître le 10 août
 * 2026.
 */
const CLE_REDUCTION = "prix-accorde-au-client";

type Props = {
  chantierId: string;
  devisId: string;
  numeroCommercial: string;
  dateEmission: string;
  validite: string;
  statut: "brouillon" | "envoye";
  /**
   * La clef de son logo dans le stockage, ou `null`.
   *
   * **Il l'avait posé et ne le voyait pas** (25 août 2026) : le PDF le portait,
   * l'aperçu des réglages aussi, mais l'écran où il RÉDIGE son devis — celui
   * qu'il regarde le plus — ne le montrait nulle part.
   */
  logo: string | null;
  emetteur: { nom: string; adresse: string; siret: string; telephone: string; email: string; iban: string };
  clientId: string | null;
  client: { nom: string; civilite: Civilite | null; adresse: string; telephone: string; email: string };
  /**
   * Par où l'on écrit au client, et depuis quelle adresse.
   *
   * Les deux ne servent qu'à ouvrir sa messagerie au moment de l'envoi — ce
   * geste vit sur cet écran depuis le 20 août 2026. Le canal est un accord avec
   * la PERSONNE, pas une caractéristique du document : il se lit sur la fiche
   * du client, jamais sur le devis. L'origine, elle, est bâtie côté serveur —
   * composée dans le navigateur, elle diffèrerait de ce que le serveur a rendu.
   */
  canalClient: "sms" | "email";
  origine: string;
  adresseChantier: string;
  lignesInitiales: Ligne[];
  tauxTva: string;
  /** Le prix accordé au client, en pourcentage. `null` : aucun. */
  reductionPourcent: string | null;
  conditionsPaiement: string;
  /** La dictée n'a pas été comprise, seulement recopiée — voir `lecture-litterale.ts`. */
  /**
   * Ce que l'agent a retenu des devis passés, par ligne.
   *
   * **Un rappel, jamais un calcul.** `docs/EXEMPLE-DICTEE.md` §9c : l'agent
   * propose le dernier prix comparable en disant d'où il vient, et le patron
   * valide ou corrige d'un geste. La nuance porte tout — un rappel se vérifie
   * d'un coup d'œil, un calcul non sourcé demande qu'on lui fasse confiance.
   *
   * Rien n'est jamais appliqué tout seul : c'est lui qui appuie.
   */
  rappels?: Record<string, { prix: string; phrase: string }>;
  lectureLitterale?: boolean;
};

export default function DevisCompletClient(props: Props) {
  const fige = props.statut === "envoye";
  const router = useRouter();

  /**
   * La feuille des dates, ouverte ICI et non deux écrans plus loin.
   *
   * *Sa demande du 20 août 2026, trois captures à l'appui :* **« le bouton
   * envoyer au client, tu vas me le modifier par Choisir la date […] j'arrive
   * directement sur la page où je peux choisir la date […] on supprime la page
   * qui est entre les deux. On va raccourcir les étapes. »**
   *
   * **Il avait raison sur le doublon.** L'écran qu'on saute redisait le client,
   * les lignes et le total que ce devis-ci vient d'afficher en entier. On ne
   * relit pas un devis qu'on vient de fermer.
   *
   * **C'est la MÊME feuille**, pas une copie : `EnvoiAuClient` ne demande que le
   * chantier, le devis et le nom du client, tous trois présents ici. La copier
   * aurait donné deux calendriers à tenir d'accord — et c'est exactement ce que
   * `CLAUDE.md` §3 interdit.
   */
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);

  const [emetteur, setEmetteur] = useState(props.emetteur);
  const [client, setClient] = useState(props.client);
  const [adresseChantier, setAdresseChantier] = useState(props.adresseChantier);
  const [lignes, setLignes] = useState<Ligne[]>(
    props.lignesInitiales.map((l) => ({ ...l, quantite: sansZerosInutiles(l.quantite), prixUnitaire: sansZerosInutiles(l.prixUnitaire) }))
  );
  const [tauxTva, setTauxTva] = useState(sansZerosInutiles(props.tauxTva));
  // Le prix accordé au client — son geste commercial, arrangement B du 16 août.
  const [reduction, setReduction] = useState(
    props.reductionPourcent === null ? "" : sansZerosInutiles(props.reductionPourcent)
  );
  /**
   * La ligne de remise est-elle à l'écran ?
   *
   * **Elle ne peut pas dépendre du montant calculé, et c'est un défaut payé.**
   * Vider la case ramenait la réduction à `null`, ce qui démontait la ligne —
   * donc le champ — AVANT que `onBlur` ait pu enregistrer. Le retrait n'arrivait
   * jamais au serveur, et la remise revenait au rechargement, sans un mot.
   * Trouvé par `test-reduction-devis-e2e.ts`, invisible au typage.
   *
   * La ligne reste donc ouverte tant qu'il n'a pas quitté le champ, et ne se
   * referme qu'une fois le retrait enregistré.
   */
  const [remiseOuverte, setRemiseOuverte] = useState(props.reductionPourcent !== null);

  async function enregistrerRemise() {
    const valeur = reduction.trim() || null;
    await majEnTeteDevisAction(props.devisId, { reductionPourcent: valeur });
    // **On se referme sur ce que le serveur a RETENU, pas sur ce qu'il a tapé.**
    // La case vide n'est pas le seul moyen d'annuler : « 0 », « 0,00 », ou une
    // saisie illisible valent tous « aucune réduction » (`reduction-devis.ts`).
    // Comparer la chaîne brute à `null` laissait donc une ligne or « Prix
    // accordé au client 0 % » sans montant, pendant que la base n'en portait
    // plus aucune — et c'est ce que le patron a vu le 17 août 2026 : *« il n'y
    // a aucun moyen de retirer les cinq pour cent, si ce n'est en écrivant zéro
    // pour cent à la place »*. Écrire zéro ne le retirait pas non plus.
    if (pourcentValide(valeur) === null) {
      setReduction("");
      setRemiseOuverte(false);
    }
  }
  const [conditions, setConditions] = useState(props.conditionsPaiement);

  // Deux adresses identiques ne s'impriment pas deux fois. Comparaison
  // indulgente : ce sont deux champs saisis à la main, à deux moments
  // différents — une majuscule ou un espace de plus ne font pas une seconde
  // adresse.
  const { chantierSepare } = adressesDuDocument({ clientAdresse: client.adresse, adresseChantier });

  // **Déclaré AVANT les totaux, et ce n'est pas un détail de style** : ils le
  // lisent. Placé après, il produisait un « Cannot access before
  // initialization » que ni `tsc` ni `eslint` ne voient — l'écran répondait 500
  // et rien d'autre ne le disait.
  //
  // Le retrait réversible, comme partout depuis le 10 août 2026. Ici l'enjeu
  // est direct : ces lignes SONT le devis que le client recevra, et une croix
  // nue sans retour possible est le geste le plus coûteux de l'application.
  const retraits = useRetraits({
    valider: async (id) => {
      // **Le prix accordé passe par LE MÊME tiroir que les lignes**, et c'est
      // délibéré : une seconde mécanique de retrait sur le même écran est
      // exactement ce que le patron a fait disparaître le 10 août 2026. Sa clé
      // réservée ne peut croiser aucune ligne — celles-ci portent un UUID.
      if (id === CLE_REDUCTION) {
        // Posé AVANT l'attente : `fermer()` vide la pile puis appelle ceci dans
        // le même tour. Repousser ces deux états après le serveur laisserait
        // une image où la ligne or est revenue avec son ancien pourcentage.
        setReduction("");
        setRemiseOuverte(false);
        await majEnTeteDevisAction(props.devisId, { reductionPourcent: null });
        return;
      }
      await retirerLigneAction(id);
      setLignes((cur) => cur.filter((l) => l.id !== id));
    },
  });

  // **Rien n'est écrit tant que le tiroir est ouvert** (`useRetraits`) : le
  // devis doit donc afficher son prix plein dès l'appui, sans quoi « Annuler »
  // porterait sur un total qui n'a pas bougé — et le geste semblerait sans
  // effet, ce qui est précisément la plainte du 17 août.
  const remiseVisible = remiseOuverte && !retraits.estRetire(CLE_REDUCTION);

  // Les totaux se recalculent sous ses yeux, à chaque frappe : un devis dont le
  // total n'apparaît qu'après enregistrement se relit deux fois.
  //
  // **Ils suivent ce qui reste.** Un total qui ne bouge pas après un
  // retrait fait douter que le retrait ait eu lieu — et ici il ferait douter du
  // montant même du devis.
  //
  // **Le prix accordé au client passe par la MÊME règle que le serveur**
  // (`src/lib/reduction-devis.ts`). Recalculer ici « juste pour l'affichage »
  // ferait diverger l'écran du PDF au premier arrondi — et c'est le client qui
  // verrait la différence (`CLAUDE.md` §3).
  const lignesVisibles = lignes.filter((l) => !retraits.estRetire(l.id));
  const totaux = totauxAvecReduction(
    lignesVisibles.map((l) => ({ montant: montantDeLaLigne(l).toFixed(2), tauxTva: l.tauxTva })),
    String(nombre(tauxTva)),
    remiseVisible ? reduction : null
  );
  const brutHt = Number(totaux.brutHt);
  const totalHt = Number(totaux.totalHt);
  const totalTva = Number(totaux.totalTva);

  // ─── Les catégories de TVA (migration 0073) ──────────────────────────────
  //
  // **Le groupement passe par la MÊME fonction que le PDF.** Deux tris écrits
  // séparément auraient fini par ranger différemment, et il aurait relu un
  // document qui ne ressemble plus à son écran (`CLAUDE.md` §3).
  //
  // Le taux du devis reste la catégorie d'accueil : c'est là que retombent les
  // lignes sans taux — toutes celles écrites avant ce lot.
  // **NORMALISÉ À DEUX DÉCIMALES, et ce n'est pas cosmétique.** `String(nombre())`
  // rendait « 20 » pendant que les catégories portent « 20.00 » : la comparaison
  // qui masque le « − » sur la catégorie d'accueil échouait, et un bouton
  // « retirer » s'affichait sur elle — un bouton qui ne pouvait rien faire, le
  // dépôt refusant de retirer la catégorie où tout retombe. Vu à la capture,
  // pas au test (`CLAUDE.md` §5).
  const tauxDuDevis = tauxTvaValide(tauxTva) ?? "20.00";
  const categories = lignesParCategorie(lignes, tauxDuDevis);
  // **Une seule catégorie ne se DESSINE pas.** Son écran d'aujourd'hui ne
  // change pas d'un pixel tant qu'il n'a pas appuyé sur « Ajouter une TVA » —
  // un titre « TVA 20 % » au-dessus d'un tableau qui n'a qu'un taux serait du
  // bruit sur tous ses devis (`CLAUDE.md` §3, le moins de mots possible).
  const plusieursTva = categories.length > 1;

  function majLigneLocale(id: string, champ: keyof Ligne, valeur: string) {
    setLignes((cur) => cur.map((l) => (l.id === id ? { ...l, [champ]: valeur } : l)));
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * **UN PRIX TAPÉ PUIS QUITTÉ PARTAIT À ZÉRO — 30 août 2026.**
   *
   * `onFini` se déclenche à la perte du focus, et il lisait `l` — la ligne du
   * DERNIER RENDU. Or React ne rend pas au moment de la frappe : il le
   * programme. Entre la dernière touche et la sortie du champ, rien ne
   * garantit que `l` porte ce qui vient d'être tapé.
   *
   * Sur une machine reposée, le rendu arrive à temps. Sous charge, non — et le
   * serveur reçoit alors l'ANCIENNE valeur, un zéro sur une ligne neuve,
   * **pendant que l'écran continue d'afficher le prix tapé**. Rien ne dit
   * qu'il est perdu : on le découvre au rechargement, ou sur le devis parti
   * chez le client.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * **CE DÉFAUT A COÛTÉ SIX ENQUÊTES, ET IL A ÉTÉ MANQUÉ UNE FOIS DE PLUS.**
   *
   * `test-lecons-prix-e2e` tombait depuis le 26 août sur « le prix 1400 n'est
   * arrivé sur aucune ligne », et six fois de suite on a conclu à la lenteur de
   * la machine — le contrôle ne disait pas ce que le navigateur avait envoyé.
   * Le 30 août, une hypothèse juste a même été écrite **puis retirée**, faute
   * d'une sonde capable de la reproduire.
   *
   * C'est le contrôle rendu bavard qui l'a nommé en une ligne, à l'occurrence
   * suivante : `{"prixUnitaire":"0"}` posté, réponse 200. La requête partait
   * bien — avec la mauvaise valeur.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * **LA VALEUR VIENT DU CHAMP, PLUS D'UN RENDU.** Le DOM porte déjà ce qui a
   * été tapé au moment où l'on quitte le champ : c'est la seule source qui ne
   * puisse pas être en retard. Le reste de la ligne continue de venir de
   * l'état — seul le champ qu'on quitte a pu changer sans être encore rendu.
   *
   * **Ce n'est pas une attente qu'on allonge, c'est une course qu'on retire.**
   * Allonger aurait déplacé le seuil sans le supprimer : le piège que
   * `TODO.md` décrit depuis le 26 août, et qui accusait la machine.
   */
  async function persisterLigne(
    l: Ligne,
    frais?: Partial<Pick<Ligne, "libelle" | "quantite" | "prixUnitaire">>
  ) {
    const ligne = { ...l, ...frais };
    await majLigneAction(ligne.id, {
      libelle: ligne.libelle,
      quantite: normaliser(ligne.quantite, "1"),
      prixUnitaire: normaliser(ligne.prixUnitaire, "0"),
    });
  }

  /**
   * Reprend le prix rappelé — d'un geste, et sans rien décider à sa place.
   *
   * L'état local est mis à jour **avant** l'enregistrement pour que le chiffre
   * apparaisse à l'instant où il appuie : sur un téléphone, une valeur qui met
   * une seconde à s'afficher se lit comme un bouton qui n'a pas marché, et il
   * appuie une seconde fois.
   */
  async function reprendreRappel(l: Ligne, prix: string) {
    majLigneLocale(l.id, "prixUnitaire", prix);
    // Le serveur l'éteint aussi (`modifierLignePrix`) ; l'écran ne doit pas
    // continuer d'annoncer « à chiffrer » sur une ligne qu'il vient de chiffrer.
    if (Number(prix) > 0) setLignes((cur) => cur.map((x) => (x.id === l.id ? { ...x, aChiffrer: false } : x)));
    await majLigneAction(l.id, {
      libelle: l.libelle,
      quantite: normaliser(l.quantite, "1"),
      prixUnitaire: prix,
    });
  }

  async function ajouter(tauxDeLaCategorie?: string | null) {
    const creee = await ajouterLigneAction(props.chantierId, tauxDeLaCategorie ?? null);
    setLignes((cur) => [
      ...cur,
      {
        id: creee.id,
        libelle: "",
        quantite: "1",
        prixUnitaire: "",
        montant: "0.00",
        aChiffrer: false,
        tauxTva: creee.tauxTva ?? null,
      },
    ]);
  }

  /**
   * « Ajouter une TVA » — sa demande du 1er septembre 2026.
   *
   * *« Lorsque j'ai plusieurs choses à rajouter ou une seule en TVA à 10,
   * j'appuie sur ajouter une TVA, une catégorie s'ajoute et là je mets toutes
   * mes lignes qui seront en TVA à 10. »*
   *
   * **10 % par défaut, et ce n'est pas un chiffre pris au hasard** : c'est
   * l'exemple qu'il a donné deux fois, et le taux des végétaux qu'il achète.
   * S'il en veut un autre, le champ du titre se corrige d'un doigt — proposer
   * une liste de taux aurait fait un écran de plus avant le premier mot écrit.
   */
  async function ajouterUneTva() {
    const dejaPris = categories.map((c) => c.taux);
    const propose = ["10.00", "5.50", "20.00", "0.00"].find((t) => !dejaPris.includes(t)) ?? "10.00";
    const creee = await ajouterCategorieTvaAction(props.chantierId, propose);
    if (!creee) return;
    setLignes((cur) => [
      ...cur,
      {
        id: creee.id,
        libelle: "",
        quantite: "1",
        prixUnitaire: "",
        montant: "0.00",
        aChiffrer: false,
        tauxTva: creee.tauxTva ?? propose,
      },
    ]);
  }

  /** Le taux d'une catégorie change : toutes ses lignes suivent, d'un geste. */
  async function changerTaux(ancien: string, saisi: string) {
    const nouveau = tauxTvaValide(saisi);
    if (nouveau === null || nouveau === ancien) return;
    setLignes((cur) =>
      cur.map((l) =>
        tauxDeLaLigne({ tauxTva: l.tauxTva }, tauxDuDevis) === ancien ? { ...l, tauxTva: nouveau } : l
      )
    );
    await changerTauxCategorieAction(props.chantierId, ancien, nouveau, tauxDuDevis);
  }

  /**
   * Retirer une catégorie — SES LIGNES RESTENT, elles reviennent au taux du devis.
   *
   * Les supprimer serait la faute : il retirerait une TVA posée par erreur et
   * perdrait du même geste le travail qu'il venait de chiffrer.
   */
  async function retirerLaTva(taux: string) {
    setLignes((cur) =>
      cur.map((l) =>
        tauxDeLaLigne({ tauxTva: l.tauxTva }, tauxDuDevis) === taux ? { ...l, tauxTva: null } : l
      )
    );
    await retirerCategorieTvaAction(props.chantierId, taux, tauxDuDevis);
  }


  /**
   * Les changements dictés, appliqués d'un seul geste.
   *
   * L'écran se recale sur **ce que la base rend**, pas sur ce qu'il espérait :
   * un retrait refusé ou une ligne qu'une autre session aurait bougée entre
   * temps se verrait sinon appliquée à l'écran et nulle part ailleurs.
   */
  async function appliquerRetouches(changements: Changement[]) {
    const apres = await appliquerRetouchesAction(props.chantierId, changements);
    setLignes(
      apres.lignes.map((l) => ({
        ...l,
        quantite: sansZerosInutiles(l.quantite),
        prixUnitaire: sansZerosInutiles(l.prixUnitaire),
      }))
    );
    // **Le prix accordé se recale lui aussi**, et il ne s'en déduit pas : il ne
    // tombe sur aucune ligne. Sans ces deux lignes, « retire-moi les cinq pour
    // cent » était compris, coché, enregistré — et l'écran continuait de les
    // afficher, jusqu'à les réécrire en base au premier passage dans la case.
    setReduction(apres.reductionPourcent === null ? "" : sansZerosInutiles(apres.reductionPourcent));
    setRemiseOuverte(apres.reductionPourcent !== null);
  }

  return (
    <>
      {/* **Le retour à gauche, l'assistant et le micro à droite** — la seule
          rangée de cet écran qui n'appartienne pas au devis, et elle reste
          minuscule : sans le retour, la page n'a pas de sortie sur un
          téléphone.

          **L'assistant, depuis le 30 août 2026** : sa demande, depuis cette
          page même. Même bouton (`BoutonAssistant`) que dans l'en-tête des
          autres écrans — il se tait tout seul hors du fournisseur ou pour un
          rôle qui n'y a pas droit (`assistant-contexte.tsx`), donc rien à
          re-vérifier ici.

          Le micro disparaît sur un devis parti : cet écran ne se modifie plus,
          et un micro qui écouterait pour ne rien pouvoir changer serait une
          promesse fausse. L'assistant, lui, reste utile même figé — relire un
          prix passé ne modifie rien.

          **LE RETOUR MÈNE À LA FICHE CLIENT, TOUJOURS — 31 août 2026, le
          soir.** *« Je veux tout le temps revenir à cette page et seulement
          celle-là ! La page fiche client »*. Le matin même, le détour n'avait
          été posé que pour un devis SANS client ; l'autre moitié le déposait
          sur la fiche du chantier, où il n'a rien à faire. La règle est
          ailleurs, sans écran ni base (`src/lib/retour-du-devis.ts`) — et elle
          referme le chemin : enregistrer la fiche ramène ici. */}
      <div className="mx-auto mb-3 flex w-full max-w-[820px] items-start justify-between sm:mb-4">
        <a
          href={retourDuDevis({ chantierId: props.chantierId })}
          aria-label={libelleRetourDuDevis(props.clientId)}
          data-atlas="retour-du-devis"
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.rustTint }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <div className="flex items-start gap-2">
          <BoutonAssistant />
          {!fige && <DicterDansLeDevis chantierId={props.chantierId} onApplique={appliquerRetouches} />}
        </div>
      </div>

      <article
      className="mx-auto w-full max-w-[820px] rounded-[10px] px-5 py-7 sm:px-12 sm:py-12"
      style={{ backgroundColor: colors.card, boxShadow: "0 12px 40px rgba(28,28,26,0.10)" }}
    >
      {props.lectureLitterale && !fige && (
        <p className="mb-6 rounded-lg px-4 py-3 text-[13px]" style={{ backgroundColor: colors.rustTint, color: colors.rust }}>
          Votre dictée a été recopiée mot à mot : aucun modèle n&apos;était disponible pour la comprendre. Relisez les
          lignes de près avant d&apos;envoyer.
        </p>
      )}

      {/* **Le message EST la porte — et ce n'était pas le cas.**
          Le patron, le 13 août 2026, capture à l'appui : *« le message dit de
          consulter la case devis mais aucune case devis existe »*. Il avait
          raison sur le fond : l'écran Devis existe bien
          (`/chantiers/[id]/export`), mais il vit dans le tiroir de la fiche —
          **aucune porte n'y menait d'ici**, et la phrase décrivait donc un
          itinéraire à reconstituer seul.

          Pire : deux écrans s'appellent « Devis » de son point de vue — celui
          qu'il regarde, et celui où l'on corrige. « Ouvrez l'écran Devis »
          était donc introuvable ET ambigu.

          Il a choisi la proposition A de
          `docs/maquettes/40-le-message-du-devis-fige.html` : la phrase dit
          pourquoi c'est figé, la ligne dessous y emmène. Quatre lignes
          deviennent deux, et le mot « écran Devis » disparaît.

          **Le message reste**, et c'était l'autre branche de sa question. Cet
          écran est celui où l'on RÉDIGE : le jour où il touche un prix, sans
          cette phrase il ne se passerait rien et rien ne dirait pourquoi. */}
      {fige && (
        <div className="mb-6 rounded-lg px-4 py-3" style={{ backgroundColor: colors.rustTint, color: colors.rust }}>
          <p className="text-[13px]">Ce devis est parti chez votre client : il ne se modifie plus.</p>
          <Link
            href={`/chantiers/${props.chantierId}/export`}
            className="mt-2 block text-[13px] font-semibold"
            style={{ color: colors.rust }}
          >
            Le corriger et le renvoyer
          </Link>
        </div>
      )}

      {/* --- En-tête : l'entreprise à gauche, les références à droite -------- */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {/* **Le logo AU-DESSUS du nom**, comme sur le document imprimé
              (`document-commun.ts` : « Le logo, au-dessus du nom »). Une hauteur
              fixe et une largeur libre : un logo en bandeau et un logo carré
              n'ont rien à voir, et imposer une boîte carrée écraserait le
              premier. Même règle que le PDF, à l'échelle de l'écran. */}
          {props.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/fichiers/${props.logo}`}
              alt=""
              data-atlas="logo-devis"
              className="mb-2 h-[44px] w-auto max-w-[180px] object-contain object-left"
            />
          )}
          <ChampNu
            valeur={emetteur.nom}
            fige={fige}
            placeholder="Votre entreprise"
            aria="Nom de l'entreprise"
            grand
            onChange={(v) => setEmetteur({ ...emetteur, nom: v })}
            onFini={() => majEmetteurAction({ nom: emetteur.nom })}
          />
          {/* **Toute son identité ICI, et une seule fois** (25 août 2026). Sa
              question : *« pourquoi il y a deux fois l'émetteur sur l'aperçu ? »*
              — l'adresse et le SIRET vivaient dans un bloc « Émetteur » plus
              bas, pendant que le nom, le téléphone et l'e-mail vivaient ici.
              L'ordre est celui du document : nom, adresse, téléphone, e-mail,
              SIRET, **une ligne par information**. */}
          <ChampNu long valeur={emetteur.adresse} fige={fige} placeholder="Adresse du siège social" aria="Adresse de l'entreprise"
            onChange={(v) => setEmetteur({ ...emetteur, adresse: v })}
            onFini={() => majEmetteurAction({ adresse: emetteur.adresse })} />
          <ChampNu valeur={emetteur.telephone} fige={fige} placeholder="Téléphone" aria="Téléphone de l'entreprise"
            onChange={(v) => setEmetteur({ ...emetteur, telephone: v })}
            onFini={() => majEmetteurAction({ telephone: emetteur.telephone })} />
          <ChampNu valeur={emetteur.email} fige={fige} placeholder="E-mail" aria="E-mail de l'entreprise"
            onChange={(v) => setEmetteur({ ...emetteur, email: v })}
            onFini={() => majEmetteurAction({ email: emetteur.email })} />
          <ChampNu valeur={emetteur.siret} fige={fige} placeholder="N° SIREN / SIRET" aria="SIREN / SIRET"
            onChange={(v) => setEmetteur({ ...emetteur, siret: v })}
            onFini={() => majEmetteurAction({ siret: emetteur.siret })} />
        </div>

        <div className="w-full sm:w-[280px] sm:shrink-0">
          <Reference libelle="Devis n°" valeur={<NumeroDeDocument valeur={props.numeroCommercial} />} />
          <Reference libelle="Date" valeur={jourNumerique(props.dateEmission)} />
          <Reference libelle="Validité" valeur={props.validite} />
        </div>
      </header>

      <div className="my-6" style={{ borderTop: `2px solid ${colors.ink}` }} />

      <h1 className="mb-8 text-center text-[26px] tracking-[0.14em] sm:text-[30px]" style={{ fontFamily: font.display }}>
        DEVIS
      </h1>

      {/* --- Le client, seul : l'émetteur est déjà en haut ------------------
          Sa question du 25 août 2026 : *« est-ce que c'est normal qu'il y ait
          2 fois l'émetteur ? »*. Non — l'en-tête le porte en entier, et ce bloc
          le réécrivait juste dessous. Le client passe donc à gauche, à la place
          qu'occupait l'émetteur : une colonne restée à droite avec un vide en
          face se lirait comme un bloc oublié. Le document imprimé fait
          exactement pareil (`document-commun.ts`). */}
      <section className="grid gap-7 sm:grid-cols-2">
        <div>
          <Intertitre>Client</Intertitre>
          {props.clientId ? (
            <>
              {/* **La civilité SE LIT ici, elle ne se choisit pas.**

                  Le patron, le 13 août 2026 : *« il ne faut pas qu'il y ait les
                  pastilles cliquables sur le devis. En gros quand on rentre les
                  informations dans la fiche client, si on clique sur monsieur,
                  sur le devis ça sera marqué monsieur. »*

                  Les pastilles y avaient été posées la veille pour offrir une
                  seconde porte — corriger un client déjà créé. Il a tranché
                  autrement, et son raisonnement se tient : cet écran est le
                  DOCUMENT, pas la fiche. Un devis ne se remplit pas comme un
                  formulaire ; il montre ce qui partira.

                  Le mot est donc du texte, posé devant le nom sur la même
                  ligne, comme il le sera sur le papier. Il vient de la même
                  règle que le PDF et le message (`src/lib/civilite.ts`) — le
                  recopier ici ferait dire « Mme Roux » à l'écran et
                  « Mr. Roux » sur le document qu'elle garde.

                  **Conséquence assumée, et signalée au patron :** la civilité
                  ne se corrige plus après coup, faute d'écran de fiche client.
                  Elle se choisit à la création, et là seulement. */}
              <ChampNu
                valeur={client.nom}
                fige={fige}
                placeholder="Nom complet"
                aria="Nom du client"
                prefixe={client.civilite ? CIVILITES[client.civilite] : ""}
                onChange={(v) => setClient({ ...client, nom: v })}
                onFini={() => majClientDuDevisAction(props.clientId!, { nom: client.nom })} />
              {/* **L'ordre est celui d'une lettre, et le patron l'a demandé
                  ainsi le 6 août 2026 : « le numéro de téléphone devrait être
                  en dernier ».** C'est aussi l'ordre du modèle d'Arborea — on
                  lit d'abord à qui on écrit et où il habite, la façon de le
                  joindre vient après. */}
              <ChampNu long valeur={client.adresse} fige={fige} placeholder="Adresse" aria="Adresse du client"
                onChange={(v) => setClient({ ...client, adresse: v })}
                onFini={() => majClientDuDevisAction(props.clientId!, { adresse: client.adresse })} />
              <ChampNu valeur={client.email} fige={fige} placeholder="E-mail" aria="E-mail du client"
                onChange={(v) => setClient({ ...client, email: v })}
                onFini={() => majClientDuDevisAction(props.clientId!, { email: client.email })} />
              <ChampNu valeur={client.telephone} fige={fige} placeholder="Téléphone" aria="Téléphone du client"
                onChange={(v) => setClient({ ...client, telephone: v })}
                onFini={() => majClientDuDevisAction(props.clientId!, { telephone: client.telephone })} />
            </>
          ) : (
            <p className="text-[13px]" style={{ color: colors.muted }}>
              Aucun client rattaché à ce chantier.
            </p>
          )}
          {/* **L'adresse des travaux ne s'affiche que si elle diffère.**
              Sinon elle réapparaissait plus bas, sans étiquette, comme une
              seconde adresse surgie de nulle part — c'est ce que le patron a
              vu : « l'adresse n'est pas au bon endroit ». Quand elle diffère,
              elle porte son titre, parce qu'une adresse nue sur un devis ne
              dit pas de quoi elle est l'adresse. */}
          {(chantierSepare !== null || !props.clientId) && (
            <div style={{ marginTop: props.clientId ? 14 : 0 }}>
              <Intertitre>Chantier</Intertitre>
              <ChampNu long valeur={adresseChantier} fige={fige} placeholder="Adresse des travaux" aria="Adresse du chantier"
                onChange={setAdresseChantier}
                onFini={() => majAdresseChantierAction(props.chantierId, adresseChantier)} />
            </div>
          )}
        </div>
      </section>

      {/* --- Le tableau ------------------------------------------------------ */}
      <section className="mt-9">
        {/* Les en-têtes de colonnes n'apparaissent qu'à partir du format
            tablette : sur six pouces, chaque cellule porte son propre libellé,
            comme le fait le modèle d'origine. */}
        <div
          className="hidden pb-2 sm:grid sm:grid-cols-[1fr_70px_130px_130px_28px] sm:gap-3"
          style={{ borderBottom: `1px solid ${colors.ink}` }}
        >
          <Colonne>Description</Colonne>
          <Colonne droite>Qté</Colonne>
          <Colonne droite>Prix unitaire HT</Colonne>
          <Colonne droite>Montant HT</Colonne>
          <span />
        </div>

        {lignesVisibles.length === 0 && (
          <p className="py-4 text-[13px]" style={{ color: colors.muted }}>
            Aucune ligne pour l&apos;instant.
          </p>
        )}

        {categories.map((categorie) => (
        <div key={categorie.taux}>

        {/* **Le titre de la catégorie — seulement s'il y en a plusieurs.**
            Sa demande du 1er septembre 2026 : le taux se pose par catégorie, pas
            par ligne. Le champ est nu comme le reste de la feuille : c'est un
            document, pas un formulaire. */}
        {plusieursTva && (
          <div
            className="mt-5 flex items-center justify-between gap-3 rounded-md px-3 py-1.5"
            style={{ backgroundColor: colors.rustTint }}
          >
            <span
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: colors.rust }}
            >
              TVA
              <input
                defaultValue={tauxLisible(categorie.taux)}
                readOnly={fige}
                inputMode="decimal"
                aria-label={`Taux de TVA de la catégorie ${tauxLisible(categorie.taux)} %`}
                onBlur={(e) => void changerTaux(categorie.taux, e.target.value)}
                className="w-9 border-0 bg-transparent p-0 text-right outline-none focus:bg-[rgba(0,0,0,0.04)]"
                style={{ color: colors.ink, fontSize: "16px" }}
              />
              %
            </span>
            {/* **Le « − », comme celui du prix accordé** (sa proposition B du
                17 août 2026) : 26 px, sans quoi on le rate au doigt. Il ne
                s'affiche pas sur la catégorie d'accueil — c'est là que les
                lignes retombent, elle n'a nulle part où aller. */}
            {!fige && categorie.taux !== tauxDuDevis && (
              <button
                type="button"
                aria-label={`Retirer la TVA à ${tauxLisible(categorie.taux)} %`}
                onClick={() => void retirerLaTva(categorie.taux)}
                className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[15px] leading-none"
                style={{ border: `1px solid ${colors.or}`, color: colors.or }}
              >
                −
              </button>
            )}
          </div>
        )}

        {categorie.lignes.map((l) => {
          const i = lignes.indexOf(l);
          return (
          <LigneRetirable
            key={l.id}
            libelle={l.libelle ? `« ${l.libelle.split("\n")[0]} »` : `la ligne ${i + 1}`}
            retiree={retraits.estRetire(l.id)}
            onRetirer={() =>
              retraits.retirer(l.id, l.libelle ? `« ${l.libelle.split("\n")[0]} »` : `la ligne ${i + 1}`)
            }
            // Une ligne de devis porte un libellé sur plusieurs lignes, une
            // quantité, un prix : elle monte bien au-delà des 170 px par défaut,
            // et l'enveloppe la tronquerait au repos.
            hauteurMax={420}
            className="flex"
          >
          <div
            className="grid w-full gap-2 py-3 sm:grid-cols-[1fr_70px_130px_130px] sm:items-start sm:gap-3"
            style={{ borderBottom: `1px solid ${colors.lineSoft}` }}
          >
            {/* La ligne principale réunit plusieurs travaux, un par ligne
                (« abattage / broyage / évacuation »). Compter les retours à la
                ligne ne suffisait pas : un seul travail au libellé long en
                occupe deux à l'écran. Voir `ZoneQuiGrandit`. */}
            <ZoneQuiGrandit
              valeur={l.libelle}
              fige={fige}
              aria={`Description ${i + 1}`}
              placeholder="Ex : Élagage d'un tilleul — taille architecturée"
              onChange={(v) => majLigneLocale(l.id, "libelle", v)}
              onFini={(fraiche) => {
                void persisterLigne(l, { libelle: fraiche });
              }}
              className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none focus:bg-[rgba(0,0,0,0.03)]"
              style={{ color: colors.ink, fontSize: "16px", lineHeight: 1.45 }}
            />

            <Cellule libelle="Qté">
              <ChiffreSaisi
                valeur={l.quantite}
                fige={fige}
                aria={`Quantité ${i + 1}`}
                placeholder="1"
                onChange={(v) => majLigneLocale(l.id, "quantite", v)}
                onFini={(fraiche) => {
                  void persisterLigne(l, { quantite: fraiche });
                }}
              />
            </Cellule>

            <Cellule libelle="Prix unitaire HT">
              <ChiffreSaisi
                valeur={l.prixUnitaire}
                fige={fige}
                aria={`Prix unitaire ${i + 1}`}
                placeholder="0,00"
                onChange={(v) => majLigneLocale(l.id, "prixUnitaire", v)}
                onFini={(fraiche) => {
                  void persisterLigne(l, { prixUnitaire: fraiche });
                }}
              />
            </Cellule>

            <Cellule libelle="Montant HT">
              {/* **« À chiffrer » n'est pas « 0,00 € ».** Un zéro se lit
                  « gratuit », et le devis pouvait partir ainsi (26 août 2026).
                  Dès qu'il pose un montant, l'état tombe de lui-même. */}
              {ligneAttendSonPrix({ libelle: l.libelle, montant: montantDeLaLigne(l).toFixed(2), aChiffrer: l.aChiffrer }) ? (
                <span className="text-[16px]" style={{ color: colors.or }}>
                  à chiffrer
                </span>
              ) : (
                <span className="text-[16px]">{enEuros(montantDeLaLigne(l))}</span>
              )}
            </Cellule>

            {/* Ce que l'agent a retenu la dernière fois, sur un travail
                comparable. Discret et sous la ligne : c'est un rappel, pas une
                consigne — il regarde s'il veut, il ignore s'il sait mieux. */}
            {!fige && props.rappels?.[l.id] && (
              <div className="sm:col-span-5" style={{ marginTop: -4, marginBottom: 6 }}>
                <span className="text-[12px] leading-snug" style={{ color: colors.muted }}>
                  {props.rappels[l.id]!.phrase}{" "}
                </span>
                <button
                  type="button"
                  onClick={() => reprendreRappel(l, props.rappels![l.id]!.prix)}
                  className="text-[12px] font-medium underline"
                  style={{ color: colors.rust }}
                >
                  Reprendre ce prix
                </button>
              </div>
            )}

          </div>
          </LigneRetirable>
          );
        })}

        {!fige && (
          <button
            type="button"
            onClick={() => void ajouter(plusieursTva ? categorie.taux : null)}
            className="mt-4 text-[14px] font-medium"
            style={{ color: colors.rust }}
          >
            + Ajouter une ligne
          </button>
        )}

        {/* **Le sous-total permet au client de refaire le calcul de SA TVA.**
            Sans lui, la ligne « TVA (10 %) » des totaux ne se vérifie qu'en
            additionnant soi-même les montants de la catégorie. */}
        {plusieursTva && (
          <div className="mt-2 flex justify-end gap-4 text-[13px]" style={{ color: colors.muted }}>
            <span>Sous-total HT</span>
            <span style={{ color: colors.ink }}>
              {enEuros(
                categorie.lignes
                  .filter((l) => !retraits.estRetire(l.id))
                  .reduce((somme, l) => somme + montantDeLaLigne(l), 0)
              )}
            </span>
          </div>
        )}
        </div>
        ))}

        {/* **« Ajouter une TVA » — le geste qu'il a décrit.** Discret et sous
            le tableau, même vocabulaire que « + Ajouter une ligne ». */}
        {!fige && (
          <button
            type="button"
            onClick={() => void ajouterUneTva()}
            className="mt-5 block text-[14px] font-medium"
            style={{ color: colors.or }}
          >
            + Ajouter une TVA
          </button>
        )}

        <TiroirDesRetires
          dernier={retraits.dernier}
          nombre={retraits.nombre}
          onAnnuler={retraits.annuler}
          className="mt-4 !mx-0"
        />
      </section>

      {/* --- Les totaux, alignés à droite comme sur le papier ---------------- */}
      <section className="mt-8 flex justify-end">
        <div className="w-full sm:w-[320px]">
          {/* **Le prix accordé au client — arrangement B, choisi le 16 août 2026.**
              *« Sous le total et prix accordé au client. »*

              Le prix plein d'abord, ce qui a été consenti dessous, puis le net :
              c'est ce qui permet au client de refaire le calcul.

              **Sans réduction, RIEN ne s'affiche ici** — et c'est une correction
              faite en regardant l'écran, pas en lisant le code. Une première
              version laissait une ligne « Prix accordé au client — % » sur tous
              les devis : le PDF, lui, n'imprimait rien. L'écran et le document
              se contredisaient, et cette feuille est censée être le papier.

              Pour en poser une à la main, la ligne discrète plus bas — même
              vocabulaire que « + Ajouter une ligne ». Il l'a demandée à la VOIX ;
              ceci n'est que le chemin de secours quand on n'a pas envie de
              parler.

              **Et pour la retirer, le « − » en face — sa proposition B du
              17 août** (`docs/maquettes/68`). Il n'y avait avant que deux
              chemins, et il ne les a trouvés ni l'un ni l'autre : vider une case
              de 36 px au doigt, ou le dire au micro. */}
          {remiseVisible ? (
            <>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[15px]">Total HT</span>
                <span className="text-[15px]">{enEuros(brutHt)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5" style={{ color: colors.or }}>
                <span className="flex items-center gap-1 text-[15px]">
                  {/* **Le « − », sa proposition B, retenue le 17 août 2026.**
                      26 px : en dessous de 24, on le rate au doigt, et c'est sur
                      un téléphone qu'il s'en sert. Il ne paraît pas sur un devis
                      parti — cet écran ne se modifie plus. */}
                  {!fige && (
                    <button
                      type="button"
                      aria-label={`Retirer le ${LIBELLE_REDUCTION.toLowerCase()}`}
                      onClick={() => retraits.retirer(CLE_REDUCTION, `le ${LIBELLE_REDUCTION.toLowerCase()}`)}
                      className="mr-1 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[15px] leading-none"
                      style={{ border: `1px solid ${colors.or}`, color: colors.or }}
                    >
                      −
                    </button>
                  )}
                  {LIBELLE_REDUCTION}
                  <input
                    value={reduction}
                    readOnly={fige}
                    inputMode="decimal"
                    aria-label="Prix accordé au client, en pourcentage"
                    onChange={(e) => setReduction(e.target.value)}
                    onBlur={enregistrerRemise}
                    className="w-9 border-0 bg-transparent p-0 text-right outline-none focus:bg-[rgba(0,0,0,0.03)]"
                    style={{ color: colors.or, fontSize: "16px" }}
                  />
                  %
                </span>
                <span className="text-[15px]">
                  {totaux.reductionMontant === null ? "" : `− ${enEuros(Number(totaux.reductionMontant))}`}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[15px]">
                  {totaux.reductionPourcent === null ? "Total HT" : "Total HT après remise"}
                </span>
                <span className="text-[15px]">{enEuros(totalHt)}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[15px]">Total HT</span>
              <span className="text-[15px]">{enEuros(totalHt)}</span>
            </div>
          )}
          {/* **UNE LIGNE PAR CATÉGORIE — sa demande du 1er septembre 2026.**

              À un seul taux, c'est EXACTEMENT la ligne d'avant : le champ y
              reste modifiable, et son écran d'aujourd'hui ne bouge pas.

              Dès qu'il y a deux catégories, le taux ne se corrige plus ici mais
              dans le titre de sa catégorie — le laisser modifiable aux deux
              endroits aurait donné deux façons de changer la même chose, dont
              une qui écrase silencieusement l'autre. */}
          {plusieursTva ? (
            totaux.parTaux.map((categorie) => (
              <div key={categorie.taux} className="flex items-center justify-between py-1.5">
                <span className="text-[15px]">TVA ({tauxLisible(categorie.taux)} %)</span>
                <span className="text-[15px]">{enEuros(Number(categorie.tva))}</span>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between py-1.5">
              <span className="flex items-center gap-1 text-[15px]">
                TVA (
                <input
                  value={tauxTva}
                  readOnly={fige}
                  inputMode="decimal"
                  aria-label="Taux de TVA"
                  onChange={(e) => setTauxTva(e.target.value)}
                  onBlur={() => majEnTeteDevisAction(props.devisId, { tauxTva })}
                  // Collé au « ( » : aligné à droite dans une boîte fixe, le taux
                  // laissait un blanc et se lisait « TVA (    20 %) ».
                  className="w-9 border-0 bg-transparent p-0 text-left outline-none focus:bg-[rgba(0,0,0,0.03)]"
                  style={{ color: colors.ink, fontSize: "16px" }}
                />
                %)
              </span>
              <span className="text-[15px]">{enEuros(totalTva)}</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between pt-2.5" style={{ borderTop: `2px solid ${colors.ink}` }}>
            <span className="text-[17px] font-semibold">Total TTC</span>
            <span className="text-[20px] font-semibold" style={{ fontFamily: font.display }}>
              {enEuros(totalHt + totalTva)}
            </span>
          </div>

          {/* Discret, et seulement quand il n'y en a pas : un devis qui porte
              déjà sa remise n'a pas besoin qu'on lui propose d'en poser une. */}
          {!fige && !remiseOuverte && (
            <button
              type="button"
              onClick={() => {
                setRemiseOuverte(true);
                setReduction("5");
                majEnTeteDevisAction(props.devisId, { reductionPourcent: "5" });
              }}
              className="mt-2.5 text-[13.5px]"
              style={{ color: colors.or }}
            >
              + {LIBELLE_REDUCTION}
            </button>
          )}
        </div>
      </section>

      {/* --- Notes, modalités --------------------------------------------- */}
      <section className="mt-9">
        <Intertitre>Notes / conditions</Intertitre>
        <ZoneQuiGrandit
          valeur={conditions}
          fige={fige}
          aria="Notes et conditions"
          placeholder="Acompte de 30 % à la signature, solde à réception des travaux. Devis gratuit et sans engagement."
          onChange={setConditions}
          onFini={() => majEnTeteDevisAction(props.devisId, { conditionsPaiement: conditions })}
          className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none focus:bg-[rgba(0,0,0,0.03)]"
          style={{ color: colors.ink, fontSize: "16px", lineHeight: 1.5 }}
        />
      </section>

      <section className="mt-7">
        <Intertitre>Modalités de paiement</Intertitre>
        <p className="text-[15px]">Paiement par virement bancaire</p>
        <ChampNu
          valeur={emetteur.iban}
          fige={fige}
          placeholder="IBAN : FR76 …"
          aria="IBAN"
          onChange={(v) => setEmetteur({ ...emetteur, iban: v })}
          onFini={() => majEmetteurAction({ iban: emetteur.iban })}
        />
      </section>

      {/* --- Le pied du document ------------------------------------------- */}
      <footer className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-[46ch] text-[12px] leading-relaxed" style={{ color: colors.muted }}>
          Devis établi par {emetteur.nom || "votre entreprise"}, valable {props.validite}. Bon pour accord précédé de la
          mention manuscrite, daté et signé par le client.
        </p>
        <div className="sm:w-[300px]">
          <div className="h-24 rounded" style={{ border: `1px dashed ${colors.line}` }} aria-hidden="true" />
          <p className="mt-1.5 text-center text-[12px]" style={{ color: colors.muted }}>
            Bon pour accord — signature du client
          </p>
        </div>
      </footer>

      {/* Les seules actions de la page, discrètes, sous le document. */}
      <div className="mt-10 flex flex-col items-center gap-3" style={{ borderTop: `1px solid ${colors.lineSoft}` }}>
        {/* **« Choisir la date » EN PREMIER, et l'aperçu en dessous** — sa
            demande du 20 août 2026, planche `docs/maquettes/82`, proposition A.
            Un seul geste saute aux yeux : c'est celui qu'il fait neuf fois sur
            dix. L'aperçu reste un lien parce que ce n'est pas une action, c'est
            une vérification.

            **Sans flèche**, il l'a dit en toutes lettres. La flèche annonçait
            un écran de plus ; il n'y en a justement plus. */}
        {!fige && (
          <div className="w-full px-6 pt-6">
            <PrimaryButton onClick={() => setFeuilleOuverte(true)}>Choisir la date</PrimaryButton>
          </div>
        )}
        <a
          href={`/api/devis/${props.devisId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${fige ? "pt-6" : "pt-3"} text-[14px] font-medium`}
          style={{ color: colors.rust }}
        >
          Aperçu du PDF
        </a>
      </div>
      </article>

      {/* **La feuille des dates, montée ici.** Elle vivait sur l'écran
          récapitulatif ; c'est le même composant, ouvert plus tôt. Après
          l'envoi, on mène à l'écran du devis parti — c'est lui qui porte le
          lien à transmettre au client, et il n'a pas bougé. */}
      <EnvoiAuClient
        chantierId={props.chantierId}
        devisId={props.devisId}
        clientNom={client.nom}
        ouvert={feuilleOuverte}
        onFermer={() => setFeuilleOuverte(false)}
        onEnvoye={(envoi) => {
          setFeuilleOuverte(false);
          // **Sa messagerie s'ouvre ICI, dans la foulée du doigt.** Sa demande
          // du 18 août 2026 : *« quand je clique sur le bouton envoyer le devis,
          // tout de suite ça m'ouvre l'application, soit SMS soit email »*. Le
          // départ ayant changé d'écran le 20 août, l'ouverture l'a suivi — sans
          // être recopiée (`src/lib/ouvrir-messagerie.ts`).
          //
          // AVANT la navigation : un navigateur peut refuser une ouverture de
          // `sms:` qui ne suit pas le geste d'assez près, et sur iOS il la
          // refuse sans un mot.
          // **LE CANAL VIENT DU SERVEUR, jamais de la page.** Défaut signalé le
          // 20 août 2026 : *« sur la fiche client j'ai choisi d'envoyer le devis
          // par email […] c'est l'application SMS qui s'est ouverte »*.
          //
          // Deux sources décidaient du même canal, et elles divergeaient : la
          // feuille d'envoi refuse de partir tant que la fiche du client n'en
          // porte aucun (`preparerEnvoi`, blocage « canal_absent »), tandis que
          // cet écran retombait sur un `?? "sms"` chargé AVEC LA PAGE. Un canal
          // changé sur la fiche du client entre-temps — ou lu par défaut faute
          // de mieux — ouvrait donc la mauvaise application.
          //
          // L'envoi rend maintenant le canal ET le destinataire qu'il vient de
          // relire en base. Une seule source, la bonne, et rien à rafraîchir.
          const ouverture = ouvrirLaMessagerie({
            chemin: envoi.lien,
            origine: props.origine,
            canalClient: envoi.canal,
            clientTelephone: envoi.canal === "sms" ? envoi.destinataire ?? "" : client.telephone,
            clientEmail: envoi.canal === "email" ? envoi.destinataire ?? "" : client.email,
            clientNom: client.nom,
            clientCivilite: client.civilite,
            entrepriseNom: emetteur.nom,
          });

          // **UNE ADRESSE LOCALE NE RAMÈNE PAS À L'ACCUEIL — posé le 24 août
          // 2026.** L'accueil ne dirait rien, et le devis serait parti avec un
          // lien mort (`ARCHITECTURE.md` §169). On l'envoie donc là où la
          // phrase l'attend : l'écran du devis parti, qui porte le message tout
          // prêt et, ici, la raison de son absence. Le devis, lui, est bien
          // envoyé — rien à défaire.
          if (!ouverture.ok && ouverture.motif === "adresse-locale") {
            router.push(`/chantiers/${props.chantierId}/export`);
            return;
          }
          // **DROIT À L'ACCUEIL — sa demande du 21 août 2026**, capture à
          // l'appui : *« juste derrière, il y a cette page-là qui s'affiche et je
          // n'ai pas besoin qu'elle s'affiche […] il faut qu'une fois que le devis
          // est envoyé, on retourne directement sur la première page, l'accueil. »*
          //
          // Elle ne lui apprenait rien qu'il ne sache : il venait d'appuyer, et sa
          // messagerie s'était ouverte par-dessus. Au retour de Messages, il
          // tombait sur un récapitulatif à refermer avant de reprendre son
          // travail — un écran de plus entre lui et le chantier suivant.
          //
          // L'accueil, lui, porte l'état du chantier : c'est là que « devis parti,
          // en attente de réponse » se lit, au milieu des autres.
          router.push("/");
        }}
      />
    </>
  );
}

/** Le montant d'une ligne — quantité × prix unitaire, comme sur le modèle. */
function montantDeLaLigne(l: { quantite: string; prixUnitaire: string }): number {
  return nombre(l.quantite) * nombre(l.prixUnitaire);
}

/**
 * « 3.00 » s'écrit « 3 », « 250.00 » s'écrit « 250 ».
 *
 * La base stocke deux décimales — c'est juste pour de l'argent, et illisible
 * sur un devis : personne n'écrit « 3,00 tilleuls ». Le patron voit donc le
 * nombre tel qu'il l'aurait écrit, et reste libre de taper « 1,5 ».
 */
function sansZerosInutiles(valeur: string): string {
  if (!valeur) return "";
  const n = Number(String(valeur).replace(",", "."));
  if (!Number.isFinite(n)) return valeur;
  return String(n).replace(".", ",");
}

/** Lit un nombre saisi à la française (« 1,5 ») comme à l'anglaise (« 1.5 »). */
function nombre(valeur: string): number {
  const n = Number(String(valeur).replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

/** Une valeur vide vaut le défaut, jamais `NaN` en base. */
function normaliser(valeur: string, defaut: string): string {
  const n = nombre(valeur);
  return valeur.trim() === "" ? defaut : String(n);
}

/**
 * Une zone de texte HAUTE DE CE QU'ELLE CONTIENT — jamais de ce qu'on estime.
 *
 * **Les trois zones du devis estimaient leur hauteur, et les trois estimaient
 * mal.** L'adresse comptait les caractères (`ceil(longueur / 34)`), la
 * description comptait les retours à la ligne, les conditions ne comptaient
 * rien du tout (`rows={2}`). Or un texte ne se coupe ni au caractère ni au
 * retour à la ligne : il se coupe au mot, quand il touche le bord. Deux lignes
 * estimées en font trois à l'écran, la zone se met à défiler, et le patron
 * relit un devis amputé du bas.
 *
 * C'est très exactement le défaut que la zone d'adresse existait pour
 * corriger — *« le patron lit une adresse amputée sur son propre devis »* —
 * revenu par une autre porte.
 *
 * **Trouvé le 11 août 2026 par le balayage des barres de défilement**, qui
 * cherchait tout autre chose. La barre grise était le symptôme ; le texte caché
 * était le défaut. La masquer aurait rendu la coupure silencieuse — c'eût été
 * le pire des deux.
 *
 * On mesure donc au lieu d'estimer. `scrollHeight` donne la hauteur réelle une
 * fois le texte reporté à la ligne. La remise à `auto` avant de lire est
 * indispensable : sans elle la hauteur ne redescend jamais quand on efface.
 */
function ZoneQuiGrandit({
  valeur,
  onChange,
  onFini,
  placeholder,
  aria,
  fige,
  className,
  style,
}: {
  valeur: string;
  onChange: (v: string) => void;
  /** Reçoit ce que le CHAMP porte — voir `persisterLigne`, jamais un rendu. */
  onFini: (valeurDuChamp: string) => void;
  placeholder: string;
  aria: string;
  fige: boolean;
  className: string;
  style: React.CSSProperties;
}) {
  const zone = useRef<HTMLTextAreaElement>(null);

  // À chaque frappe ET au premier rendu : le contenu vient du serveur, il est
  // déjà long avant qu'on ait touché quoi que ce soit.
  //
  // `useLayoutEffect` et non `useEffect` : la mesure doit être posée avant que
  // le navigateur peigne, sinon la feuille sursaute au chargement.
  useLayoutEffect(() => {
    const el = zone.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [valeur]);

  return (
    <textarea
      ref={zone}
      value={valeur}
      readOnly={fige}
      placeholder={placeholder}
      aria-label={aria}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onFini(e.currentTarget.value)}
      className={className}
      style={style}
    />
  );
}

/**
 * Un champ sans cadre : le devis reste une feuille, pas un formulaire.
 * Il ne se signale qu'au moment où on écrit dedans.
 */
function ChampNu({
  valeur,
  onChange,
  onFini,
  placeholder,
  aria,
  fige,
  grand,
  long,
  prefixe,
}: {
  valeur: string;
  onChange: (v: string) => void;
  onFini: () => void;
  placeholder: string;
  aria: string;
  fige: boolean;
  grand?: boolean;
  /**
   * Écrit devant la valeur, et **hors du champ** : c'est ce que le document
   * porte sans qu'on l'ait tapé — la civilité, aujourd'hui. Le mettre DANS le
   * champ le rendrait modifiable, et le patron enregistrerait « Mr. Roux »
   * comme nom du client : la civilité s'y retrouverait deux fois au premier
   * document suivant.
   */
  prefixe?: string;
  /**
   * Passe à plusieurs lignes plutôt que de couper. Réservé aux adresses : dans
   * un `<input>`, « 10 rue Denfert-Rochereau 78200 Mantes-la-Jolie » s'arrête
   * au bord de l'écran, et le patron lit une adresse amputée sur son propre
   * devis. Le PDF, lui, la reporte à la ligne depuis toujours — l'écran devait
   * dire la même chose que le papier.
   */
  long?: boolean;
}) {
  if (long) {
    return (
      <ZoneQuiGrandit
        valeur={valeur}
        onChange={onChange}
        onFini={onFini}
        placeholder={placeholder}
        aria={aria}
        fige={fige}
        className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 py-0.5 outline-none focus:bg-[rgba(0,0,0,0.03)]"
        style={{ color: colors.ink, fontSize: "16px", lineHeight: 1.4 }}
      />
    );
  }
  const champ = (
    <input
      value={valeur}
      readOnly={fige}
      placeholder={placeholder}
      aria-label={aria}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onFini}
      className="block w-full border-0 bg-transparent p-0 py-0.5 outline-none focus:bg-[rgba(0,0,0,0.03)]"
      style={{
        color: colors.ink,
        // 16 px au minimum : en dessous, iOS agrandit la page au premier appui.
        fontSize: grand ? "22px" : "16px",
        fontFamily: grand ? font.display : undefined,
      }}
    />
  );

  if (!prefixe) return champ;

  // `items-baseline` : le mot et le nom reposent sur la même ligne d'écriture,
  // comme sur le papier. Alignés par le haut, « Mr. » flotterait au-dessus du
  // nom dès que les deux n'ont pas exactement la même taille.
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        style={{
          color: colors.ink,
          fontSize: grand ? "22px" : "16px",
          fontFamily: grand ? font.display : undefined,
        }}
      >
        {prefixe}
      </span>
      {champ}
    </span>
  );
}

function Intertitre({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: colors.rust }}
    >
      {children}
    </p>
  );
}

function Colonne({ children, droite }: { children: React.ReactNode; droite?: boolean }) {
  return (
    <span
      className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${droite ? "text-right" : ""}`}
      style={{ color: colors.muted }}
    >
      {children}
    </span>
  );
}

/** Sur téléphone, chaque cellule porte son libellé — comme le modèle d'origine. */
/**
 * Un chiffre qu'on saisit — et qu'on VOIT qu'on peut saisir.
 *
 * Le 6 août 2026, le patron : « quand j'essaye de cliquer pour mettre un prix,
 * ce n'est pas cliquable ». Il l'était pourtant. Mais le champ était vide, sans
 * repère, sans placeholder, et haut de 24 pixels dans un coin de l'écran —
 * mesuré : 96 × 24. Apple recommande 44 pixels pour une cible tactile, et un
 * champ invisible n'invite personne à le toucher. Un contrôle automatique
 * répondait « éditable : oui » et n'y voyait donc rien.
 *
 * D'où les trois changements, tous nécessaires ensemble : une hauteur de doigt,
 * un trait sous le champ tant qu'il est vide, et un exemple en gris. Le trait
 * disparaît dès qu'un chiffre est écrit — sur le papier, un devis rempli n'a
 * pas de cases.
 */
function ChiffreSaisi({
  valeur,
  onChange,
  onFini,
  placeholder,
  aria,
  fige,
}: {
  valeur: string;
  onChange: (v: string) => void;
  /** Reçoit ce que le CHAMP porte — voir `persisterLigne`, jamais un rendu. */
  onFini: (valeurDuChamp: string) => void;
  placeholder: string;
  aria: string;
  fige: boolean;
}) {
  const vide = valeur.trim() === "";
  return (
    <input
      value={valeur}
      readOnly={fige}
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={aria}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onFini(e.currentTarget.value)}
      className="w-24 border-0 bg-transparent px-1 text-right outline-none focus:bg-[rgba(0,0,0,0.03)] sm:w-full"
      style={{
        color: colors.ink,
        fontSize: "16px",
        minHeight: 44,
        borderBottom: vide && !fige ? `1px solid ${colors.lineSoft}` : "1px solid transparent",
      }}
    />
  );
}

function Cellule({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:block sm:text-right">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.1em] sm:hidden"
        style={{ color: colors.muted }}
      >
        {libelle}
      </span>
      {children}
    </div>
  );
}

function Reference({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-1"
      style={{ borderBottom: `1px solid ${colors.lineSoft}` }}
    >
      <span className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: colors.muted }}>
        {libelle}
      </span>
      <span className="text-[14px]">{valeur}</span>
    </div>
  );
}
