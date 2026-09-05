"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { colors, libelleCaps, surPlein, voile } from "@/lib/design-tokens";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import { ajouterPhotoAction, supprimerPhotoAction } from "./photos-actions";
import { ACCEPT_PHOTOS } from "@/lib/exif";

export type VignettePhoto = { id: string; storageKey: string };

/**
 * La pellicule du tiroir — ajouter, regarder, retirer, **sans quitter la fiche**.
 *
 * *Demandé par le patron le 11 août 2026, capture à l'appui : « quand je clique
 * sur l'encadré doré avec le petit plus, que ça arrête de me faire changer de
 * page, je veux voir apparaître directement le menu photo, et supprime toutes
 * les autres étapes ».*
 *
 * **Ce que ce composant remplace.** L'écran `/chantiers/[id]/photos` tout
 * entier. Le « + » y menait, et l'ajout coûtait alors quatre gestes : toucher le
 * « + », changer de page, toucher « Ajouter une photo », choisir dans notre
 * propre feuille, et seulement là voir le menu du téléphone. Il en coûte deux :
 * le « + », puis le menu du téléphone.
 *
 * **Un seul champ de fichier, et SANS `capture`.** C'est ce qui fait apparaître
 * le menu iOS à trois entrées — Photothèque, Prendre une photo, Choisir les
 * fichiers — que le patron a photographié : les deux chemins qu'il exigeait le
 * 6 août (« il faut bien évidemment pouvoir faire les deux ») y sont, au même
 * endroit, rendus par le système. Deux champs et une feuille maison étaient la
 * réponse d'alors ; le système la donne mieux, et en un geste de moins.
 *
 * **`capture` reste interdit ici.** Sur un iPhone, il n'exprime pas une
 * préférence : il IMPOSE l'appareil photo et retire l'accès à la pellicule. Un
 * artisan qui a photographié le chantier le matin ne pourrait rien joindre
 * l'après-midi — et le menu ci-dessus n'apparaîtrait jamais.
 */
export default function Pellicule({
  chantierId,
  assurerChantier,
  initiales,
}: {
  /**
   * Le chantier, s'il existe déjà. **`null` sur la fiche client** : il n'est
   * créé qu'au premier geste — voir `assurerChantier`.
   */
  chantierId: string | null;
  /**
   * Fait exister le chantier, et rend son identifiant.
   *
   * **Sa demande du 21 août 2026 met les photos AVANT la création** : il
   * photographie chez le client, puis il dicte, et le chantier naît de ces
   * gestes-là. Une photo n'a nulle part où aller tant qu'aucun chantier
   * n'existe ; on le crée donc à la première photo, sans rien lui demander de
   * plus. Appelée plusieurs fois, elle rend le MÊME chantier — sans quoi trois
   * photos feraient trois chantiers.
   */
  assurerChantier?: () => Promise<string>;
  initiales: VignettePhoto[];
}) {
  const router = useRouter();
  // L'état de départ vient du serveur, puis cet écran vit seul : ce qu'on
  // ajoute ou retire ici ne doit pas être écrasé par un rendu du serveur qui
  // arriverait en retard (le `router.refresh()` ci-dessous en déclenche un).
  const [photos, setPhotos] = useState<VignettePhoto[]>(initiales);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  // **Le retrait reste réversible, et l'écriture attend la fermeture du
  // tiroir** (`useRetraits`) : la photo met son fichier en file de purge dans la
  // même transaction que sa suppression, donc appeler le serveur au moment du
  // geste rendrait « Annuler » menteur — la ligne reviendrait, le fichier non.
  const retraits = useRetraits({
    valider: async (id) => {
      try {
        await supprimerPhotoAction(id);
        setPhotos((p) => p.filter((ph) => ph.id !== id));
        // La fiche compte les photos pour dire où en est le chantier : sans ce
        // rafraîchissement, le résumé du tiroir annoncerait encore une étape
        // franchie qui ne l'est plus.
        router.refresh();
      } catch {
        // Déjà répercutée visuellement ; une resynchronisation complète en cas
        // d'échec réseau est laissée à un lot ultérieur.
      }
    },
  });
  const visibles = photos.filter((p) => !retraits.estRetire(p.id));

  async function onFichiersChoisis(e: ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(e.target.files ?? []);
    e.target.value = ""; // permet de resélectionner le même fichier ensuite
    if (fichiers.length === 0) return;
    setEnCours(true);
    for (const fichier of fichiers) {
      const fd = new FormData();
      fd.set("fichier", fichier);
      try {
        const cible = chantierId ?? (await assurerChantier?.());
        if (!cible) break;
        const { id, storageKey } = await ajouterPhotoAction(cible, fd);
        setPhotos((p) => [...p, { id, storageKey }]);
      } catch {
        // Une photo en échec parmi plusieurs n'interrompt pas les autres.
      }
    }
    setEnCours(false);
    // Le statut du chantier et l'étape suivante se déduisent du nombre de
    // photos : sans cela, la fiche continuerait de réclamer ce qu'on vient de
    // faire.
    router.refresh();
  }

  const photoOuverte = visibles.find((p) => p.id === ouverte);

  return (
    <>
      {/* La pellicule. Les marges négatives la font courir d'un bord à l'autre
          pendant que son contenu reste aligné sur le retrait de l'écran.

          **-mx-6, et non plus -mx-[26px].** Les écrans qui la portent ont 24 px de
          retrait (`px-6`) : à 26, la pellicule dépassait le corps de deux pixels
          de chaque côté — mesuré le 30 août 2026. Deux pixels ne se voient pas,
          mais ils suffisent à faire glisser l'écran de droite à gauche partout
          où rien ne les recoupe, et c'est exactement ce qu'il a demandé de faire
          cesser. */}
      <div className="atlas-pellicule -mx-6 px-6 pb-1">
        <input
          ref={champ}
          // **Une marque STABLE pour les contrôles**, comme
          // `anneau-note-vocale` juste à côté. `test-devis-main-depuis-creation`
          // visait `accept="image/*"` en dur : la liste blanche du 24 août l'a
          // fait rougir sur du code juste, pour une correction de sécurité. Ce
          // qu'une suite doit fixer, c'est la RÈGLE — « le carré photo est sur
          // la fiche » — pas la valeur d'un attribut (`CLAUDE.md` §5 bis).
          data-atlas="carre-photo"
          type="file"
          accept={ACCEPT_PHOTOS}
          multiple
          hidden
          aria-label="Ajouter des photos"
          onChange={onFichiersChoisis}
        />
        {/* **Un bouton, plus un lien.** C'était un lien vers un autre écran ;
            il ouvre désormais le menu du téléphone, sur place. */}
        <button
          type="button"
          onClick={() => champ.current?.click()}
          disabled={enCours}
          // Pendant l'envoi, le libellé dit l'envoi. Il annonçait « Ajouter des
          // photos » sur un bouton qui n'ajoutait plus rien : ce que l'écran
          // montre et ce qu'il annonce doivent raconter le même instant.
          aria-label={enCours ? "Envoi des photos en cours" : "Ajouter des photos"}
          className="atlas-ajouter"
          // ─── PLEIN DORÉ — sa demande du 4 septembre 2026 ─────────────────
          //
          // *« Seulement pour le carré photo, je le veux plein doré. »* Il
          // tranche entre deux dessins : le liseré en TIRETS d'avant, et le
          // carré plein et sobre que proposait la planche « A — Épurée ». Ni
          // l'un ni l'autre : l'aplat, mais en or.
          //
          // **Ce qui disparaît avec les tirets**, et qu'il faut avoir en tête :
          // ils disaient « il n'y a rien encore ». L'aplat, lui, dit « posez
          // ici » — c'est une invitation plus qu'un vide, et c'est ce qu'il
          // veut d'un bouton qu'il touche sur un chantier.
          //
          // **`surPlein` et jamais une couleur écrite en clair** (`CLAUDE.md`
          // §3) : c'est le jeton de ce qu'on pose SUR un aplat. Il tient ici
          // sans réserve, parce que l'or est le seul jeton FIXE des huit
          // chartes (`chartes.ts`) — le fond de ce carré ne bouge donc jamais,
          // et ce qu'on écrit dessus non plus.
          style={{ border: `1px solid ${colors.or}`, background: colors.or, color: surPlein }}
        >
          {/* **Le même souffle que la dictée**, sur sa demande du 13 août 2026 :
              *« oui souffle aussi pour la photo »*. C'était ici le même
              caractère « … » immobile, à la lettre près — donc le même défaut,
              et il n'y a aucune raison que deux attentes du même produit se
              disent de deux façons. Les points prennent la couleur du bouton
              (`currentColor`), l'or et non le vert de la dictée. */}
          {enCours ? <PointsQuiSoufflent /> : "+"}
        </button>
        {visibles.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOuverte(p.id)}
            aria-label={`Voir la photo ${i + 1}`}
            className="atlas-vue"
            style={{ backgroundColor: colors.cream }}
          >
            {/* Conservé en <img> : `next/image` réécrit le `src` via
                `/_next/image`, ce qui romprait la correspondance exacte
                attendue par la visionneuse (éprouvée de bout en bout). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/fichiers/${p.storageKey}`} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {/* Le tiroir des retirés pousse les étapes vers le bas plutôt que de les
          recouvrir — même règle que partout ailleurs. */}
      <TiroirDesRetires
        dernier={retraits.dernier}
        nombre={retraits.nombre}
        onAnnuler={retraits.annuler}
        className="mb-3"
      />

      {/* **La visionneuse sort du tiroir par un portail, et il le faut.** Le
          tiroir de la fiche porte un `z-index`, donc il ouvre son propre
          contexte d'empilement : une visionneuse « plein écran » rendue à
          l'intérieur reste plafonnée au niveau du tiroir, et la barre de
          navigation — posée plus loin dans le document, au même niveau — se
          peint par-dessus. On verrait « Chantiers / Planning » en travers de la
          photo. */}
      {/* `document` n'existe pas au rendu serveur. Le garde ne masque aucun
          écart d'hydratation : au premier rendu, aucune photo n'est ouverte —
          des deux côtés. */}
      {/* ─── CET ÉCRAN RETOURNE LES PÔLES, ET C'EST TOUT LE PIÈGE ──────────
          La visionneuse prend `ink` pour FOND, pour qu'on ne voie que la photo.
          Sur les six chartes claires l'encre est presque noire ; sur Nuit et
          Sylve elle est CLAIRE. Rien de ce qu'on pose dessus ne peut donc être
          écrit en clair — la croix était `#F6F1E6` et les pastilles
          `rgba(255,255,255,0.12)`, soit un crème sur un crème : 1,09 sur Nuit,
          1,12 sur Sylve. On ne voyait plus comment sortir de la photo.

          C'est la faute du 22 août 2026 — celle de la pastille d'équipe, qui a
          fait naître `surPlein` (`design-tokens.ts`) —, écrite ici le 11 août
          et oubliée par la passe qui a corrigé les huit autres endroits.
          Pourquoi elle a survécu : **aucune capture ne la montrait**, la
          visionneuse demandant qu'une photo soit ouverte, et aucune suite ne
          l'ouvre. Trouvée le 5 septembre 2026 par l'audit de santé, sur les
          valeurs de `chartes.ts` — pas à l'écran.

          `orSurEncre` plutôt que `surPlein` pour le mot « Retirer » : il garde
          son doré. Voir le jeton dans `chartes.ts`. */}
      {photoOuverte && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: colors.ink }}>
              <div className="flex items-center justify-between px-[26px] pt-8">
                <button
                  onClick={() => setOuverte(null)}
                  aria-label="Fermer"
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: voile(surPlein, 0.12) }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={surPlein} strokeWidth="2.2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
                {/* La photo se retire d'où on la regarde : le mot « Retirer »,
                    sa couleur, et le tiroir qui rattrape.
                    **`orSurEncre`, et non `orClair`.** `orClair` sert les traits
                    posés sur le vert pin ; ici l'or porte un MOT, sur l'encre.
                    Sur les six claires il vaut l'or d'Origine au caractère
                    près — son doré ne bouge pas (sa consigne du 31 août). */}
                <button
                  onClick={() => {
                    const id = photoOuverte.id;
                    setOuverte(null);
                    retraits.retirer(id, "cette photo");
                  }}
                  aria-label="Retirer cette photo"
                  className={`flex h-11 items-center justify-center rounded-full px-4 ${libelleCaps}`}
                  style={{ backgroundColor: voile(surPlein, 0.12), color: colors.orSurEncre, letterSpacing: "0.26em" }}
                >
                  Retirer
                </button>
              </div>
              <div className="flex flex-1 items-center justify-center">
                {/* Conservé en <img> : dimensions intrinsèques inconnues à
                    l'avance (photos de tailles arbitraires) dans un conteneur
                    flexible non dimensionné. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/fichiers/${photoOuverte.storageKey}`}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
