"use client";

import { useMemo, useState } from "react";
import { colors, font, libelleCaps, surPlein } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import VisionneusePhoto from "@/components/atlas/VisionneusePhoto";
import {
  anneesDesRetours,
  compteDesTaches,
  rangerLesRetours,
  type RetourEnListe,
} from "@/lib/retour-intervention";
import { marquerLeRetourVuAction } from "./actions";

/**
 * LA LISTE DES RETOURS — rangée par client, filtrée d'un doigt.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CET ÉCRAN NE DÉCIDE DE RIEN.** Ce qui range, ce qui filtre et ce qui compte
 * vit dans `src/lib/retour-intervention.ts` et s'éprouve sans navigateur. Ici
 * on affiche, et l'on choisit où le doigt se pose.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI PAR CLIENT** — sa demande, et sa raison valait mieux que celle
 * qu'on défendait : un retour se garde des ANNÉES. Rangés par date, les deux
 * passages chez le même homme seraient à quinze mois d'écart dans la liste ;
 * rangés par client, ils se lisent côte à côte — et c'est ainsi qu'on retrouve
 * ce qu'on avait fait la dernière fois.
 *
 * **Deux filtres, et ils font deux métiers.** Le champ sert quand il sait qui
 * il cherche ; les années servent quand il ne sait plus quand. Un seul des deux
 * l'aurait obligé à taper de mémoire, avec des doigts épais.
 */
export default function ListeDesRetours({ retours }: { retours: RetourEnListe[] }) {
  const [cherche, setCherche] = useState("");
  const [annee, setAnnee] = useState<string | null>(null);

  const annees = useMemo(() => anneesDesRetours(retours), [retours]);
  const groupes = useMemo(
    () => rangerLesRetours(retours, { client: cherche, annee }),
    [retours, cherche, annee]
  );

  return (
    <div className="pb-10" data-atlas="liste-des-retours">
      <EnTeteEcran titre="Retours d'intervention" retour={{ href: "/termines", libelle: "Retour aux chantiers terminés" }}
        allure="commune" />

      {/* **Le champ d'abord, les années ensuite.** Quand il sait qui il cherche,
          il tape ; le reste du temps il touche une année. L'ordre inverse
          l'aurait fait lire trois pastilles avant d'arriver à ce qu'il voulait. */}
      <div className="relative mx-[22px] mt-4">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
          style={{ color: colors.muted }}
        >
          <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
            <circle cx="7.6" cy="7.6" r="5.4" stroke="currentColor" strokeWidth="1.6" />
            <path d="m11.6 11.6 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          value={cherche}
          onChange={(e) => setCherche(e.target.value)}
          placeholder="Un nom de client"
          aria-label="Chercher un client"
          data-atlas="chercher-un-client"
          className="h-12 w-full rounded-full border-0 pl-11 pr-4 text-[16px] outline-none"
          style={{
            backgroundColor: colors.card,
            color: colors.ink,
            boxShadow: `inset 0 0 0 1px ${colors.line}`,
          }}
        />
      </div>

      {/* **`flex-none` sur la rangée, et ce n'est pas décoratif** : dans une
          colonne flexible, une rangée qui défile horizontalement se laisse
          écraser à zéro pixel. Elle répond alors au doigt sans s'afficher nulle
          part — payé sur la maquette du 8 septembre, vu à la capture. */}
      {annees.length > 1 && (
        <div
          className="mt-2.5 flex flex-none gap-[7px] overflow-x-auto px-[22px]"
          style={{ scrollbarWidth: "none" }}
          data-atlas="annees-des-retours"
        >
          <Pastille actif={annee === null} onClick={() => setAnnee(null)}>
            Tout
          </Pastille>
          {annees.map((a) => (
            <Pastille key={a} actif={annee === a} onClick={() => setAnnee(a)}>
              {a}
            </Pastille>
          ))}
        </div>
      )}

      {groupes.length === 0 ? (
        <p className="mx-[22px] mt-7 text-[13.5px] leading-[1.65]" style={{ color: colors.muted }}>
          {retours.length === 0
            ? "Rien encore. Un retour arrive ici quand un salarié pose « c'est fini » sur sa fiche."
            : "Aucun retour ne correspond."}
        </p>
      ) : (
        groupes.map((groupe) => (
          <section key={groupe.client} className="mt-6" data-atlas="groupe-de-retours">
            <p
              className="mx-[22px] mb-0 text-[19px] leading-[1.2]"
              style={{ fontFamily: font.display }}
            >
              {groupe.client}
            </p>
            {groupe.retours.map((r) => (
              <Carte key={r.id} retour={r} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function Pastille({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      // Quarante pixels : la mesure que tout le reste de l'application tient
      // pour un pouce. Les serrer pour faire tenir une année de plus se paierait
      // à chaque appui, sur un écran sale.
      className="h-10 flex-none rounded-full px-[15px] text-[13.5px]"
      style={
        actif
          ? { backgroundColor: colors.plein, color: surPlein, WebkitTapHighlightColor: "transparent" }
          : {
              backgroundColor: "transparent",
              color: colors.inkSoft,
              boxShadow: `inset 0 0 0 1px ${colors.line}`,
              WebkitTapHighlightColor: "transparent",
            }
      }
    >
      {children}
    </button>
  );
}

/**
 * UN RETOUR SUR LA LISTE — et ce qu'il contient, quand il l'ouvre.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **SA PROPOSITION A, tranchée le 9 septembre 2026** :
 * *« la A c'est bien, mais tu peux faire en sorte qu'elle s'ouvre en grand et
 * qu'elle puisse se replier »* (`appli/voir-un-retour.html`).
 *
 * **Ce qu'elle répare.** La carte annonçait « tout fait · 2 photos » : un
 * résumé qu'il ne pouvait pas vérifier, et deux photos qui n'existaient qu'en
 * chiffre. Or ce qu'il regarde ici décide s'il facture un travail qui a eu lieu.
 *
 * **CE QUI N'A PAS ÉTÉ FAIT S'ÉCRIT**, plutôt que de se déduire d'une
 * soustraction : c'est la seule ligne qui l'arrêtera avant d'envoyer une
 * facture de trop.
 *
 * **« Replier » vit au BAS de la feuille**, là où son doigt arrive une fois
 * qu'il a tout lu — en haut, il faudrait remonter pour refermer ce qu'on vient
 * de parcourir.
 */
function Carte({ retour }: { retour: RetourEnListe }) {
  const [ouvert, setOuvert] = useState(false);
  /**
   * **La pastille s’éteint sous le doigt, pas quand le serveur répond.**
   *
   * Ouvrir EST la lecture : rien ne peut la refuser. Attendre l’aller-retour
   * ferait clignoter la pastille sur un réseau de chantier, et il croirait
   * avoir mal appuyé. Si l’appel échoue, le retour reste non lu — le bon côté
   * de l’erreur : il le rouvrira.
   */
  const [lu, setLu] = useState(retour.vu);
  /**
   * **La photo qu'il regarde en grand.** Sa demande du 11 septembre 2026,
   * capture à l'appui : *« ce qui serait bien, c'est qu'on puisse cliquer
   * dessus pour qu'elle apparaisse en grand »*. Deux colonnes de 132 pixels
   * disent qu'il y a eu une photo ; elles ne disent pas si la haie est taillée
   * droit — et c'est sur cette image qu'il décide de facturer.
   */
  const [enGrand, setEnGrand] = useState<string | null>(null);
  const compte = compteDesTaches(retour.taches);
  const jour = new Date(retour.poseLe).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-[22px] mt-2.5">
      {/* **CE N'EST PLUS UN BLOC MUET, ET CE N'EST PAS UN LIEN NON PLUS.** Il
          ouvre ce qu'il porte, ici même : le chantier, lui, s'atteint par des
          règles d'accès qui vivent déjà dans `portesDuPlanning`, et les
          recopier ferait la seconde vérité que `CLAUDE.md` §3 interdit. */}
      <button
        type="button"
        onClick={() => {
          const prochain = !ouvert;
          setOuvert(prochain);
          if (prochain && !lu) {
            setLu(true);
            void marquerLeRetourVuAction(retour.id);
          }
        }}
        data-atlas="carte-de-retour"
        aria-expanded={ouvert}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
        style={{
          backgroundColor: colors.card,
          color: colors.ink,
          boxShadow: `inset 0 0 0 1px ${colors.line}`,
          borderRadius: ouvert ? "13px 13px 0 0" : 13,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span
          aria-hidden="true"
          className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full"
          style={{ backgroundColor: colors.rustTint, color: colors.orTexte }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8.4 6.3 11.7 13 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            {/* **LA PASTILLE DES NON-LUS — sa demande du 9 septembre 2026 :**
                *« comme pour les SMS sur notre téléphone »*. Elle vit AVANT le
                jour, sur la colonne que l’œil descend : placée à droite, il
                faudrait lire chaque ligne en entier pour la trouver.

                Elle est en `or` et non en `alert` : un retour non lu n’est pas
                un incident, c’est du courrier. */}
            {!lu && (
              <span
                aria-hidden="true"
                data-atlas="retour-non-lu"
                className="h-[9px] w-[9px] flex-none rounded-full"
                style={{ backgroundColor: colors.or }}
              />
            )}
            <span
              className="block text-[14px] leading-[1.3]"
              style={{ fontWeight: lu ? 500 : 600 }}
            >
              {jour}
            </span>
          </span>
          <span className="mt-[3px] block text-[12.5px] leading-[1.45]" style={{ color: colors.muted }}>
            {[retour.posePar, compte, phrasePhotos(retour.photos.length)].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="mt-1.5 flex-none"
          style={{
            color: colors.muted,
            transform: ouvert ? "rotate(90deg)" : "none",
            transition: "transform .18s cubic-bezier(.22,.9,.3,1)",
          }}
        >
          <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
            <path
              d="m1.5 1.5 6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {ouvert && (
        <div
          data-atlas="retour-deplie"
          className="px-3.5 pb-3.5 pt-0.5"
          style={{
            backgroundColor: colors.card,
            boxShadow: `inset 0 0 0 1px ${colors.line}`,
            borderRadius: "0 0 13px 13px",
          }}
        >
          {retour.taches.length > 0 && (
            <>
              <p className={`mt-3 ${libelleCaps}`} style={{ color: colors.muted }}>
                Ce qui a été fait
              </p>
              <ul className="m-0 mt-2 list-none p-0">
                {retour.taches.map((t, rang) => (
                  <li
                    key={`${t.libelle}-${rang}`}
                    className="flex items-start gap-2.5 py-[5px] text-[13.5px] leading-[1.35]"
                    data-atlas={t.faite ? "tache-faite" : "tache-pas-faite"}
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[1px] grid h-[17px] w-[17px] flex-none place-items-center rounded-[5px]"
                      style={
                        t.faite
                          ? { backgroundColor: colors.plein, color: surPlein }
                          : { boxShadow: `inset 0 0 0 1.5px ${colors.line}` }
                      }
                    >
                      {t.faite && (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2 6.3 4.7 9 10 3"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span style={{ color: t.faite ? colors.ink : colors.muted }}>
                      {t.libelle}
                      {/* **Ce qui n'a pas été fait le DIT.** Une case vide se lit
                          comme un oubli de lecture ; ces deux mots l'arrêtent
                          avant de facturer un travail qui n'a pas eu lieu. */}
                      {!t.faite && <span style={{ color: colors.orTexte }}> — pas fait</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {retour.photos.length > 0 && (
            <>
              <p className={`mt-4 ${libelleCaps}`} style={{ color: colors.muted }}>
                Photos
              </p>
              {/* **EN GRAND, et c'est sa demande.** Des vignettes de 62 px ne
                  montrent pas si la haie est taillée ; deux colonnes le font.

                  **Conservé en `<img>`, comme la pellicule des chantiers** :
                  `next/image` réécrit le `src` via `/_next/image`, or ces
                  fichiers sortent d'une route gardée qui vérifie à qui ils
                  appartiennent. Les faire passer par l'optimiseur, c'est
                  poser un second chemin vers des photos de chantier — et une
                  photo visible par le mauvais jeton est le défaut de plus
                  haute priorité de ce produit. */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {retour.photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setEnGrand(photo.storageKey)}
                    aria-label="Voir la photo en grand"
                    data-atlas="ouvrir-la-photo"
                    className="block h-[132px] w-full overflow-hidden rounded-[11px] p-0"
                    style={{ backgroundColor: colors.rustTint, WebkitTapHighlightColor: "transparent" }}
                  >
                    <img
                      src={`/api/fichiers/${photo.storageKey}`}
                      alt=""
                      data-atlas="photo-du-retour"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </>
          )}

          {retour.aSignaler && (
            <>
              <p className={`mt-4 ${libelleCaps}`} style={{ color: colors.muted }}>
                À signaler
              </p>
              <p
                className="mt-2 rounded-[12px] px-3 py-2.5 text-[13.5px] leading-[1.45]"
                style={{ backgroundColor: colors.rustTint, color: colors.inkSoft }}
              >
                « {retour.aSignaler} »
              </p>
            </>
          )}

          <button
            type="button"
            onClick={() => setOuvert(false)}
            data-atlas="replier-le-retour"
            className="mt-3.5 h-[42px] w-full rounded-full text-[13.5px]"
            style={{
              color: colors.orTexte,
              boxShadow: `inset 0 0 0 1px ${colors.orTexte}`,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Replier
          </button>
        </div>
      )}

      {/* **La visionneuse est celle de la pellicule des chantiers**, sortie
          dans `components/atlas/VisionneusePhoto.tsx` plutôt que recopiée : une
          seule façon de regarder une photo, une seule façon d'en sortir.

          **Sans « Retirer » ici, et c'est délibéré** : un retour est le compte
          rendu d'un salarié. Ce qu'il a photographié n'est pas à effacer depuis
          l'écran qui sert à le vérifier. */}
      {enGrand && <VisionneusePhoto storageKey={enGrand} onFermer={() => setEnGrand(null)} />}
    </div>
  );
}

/** « 3 photos », « 1 photo », ou rien du tout. */
function phrasePhotos(combien: number): string {
  if (combien === 0) return "";
  return combien === 1 ? "1 photo" : `${combien} photos`;
}
