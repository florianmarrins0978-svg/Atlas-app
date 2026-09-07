"use client";

import { useRef, useState, useTransition } from "react";
import { colors, libelleCaps, surPlein, texteSituation, voile } from "@/lib/design-tokens";
import {
  ALLURE_PAR_DEFAUT,
  estLAllureParDefaut,
  LOGOS_ACCEPTES,
  refusDuLogo,
  TYPOGRAPHIES,
  type Allure,
} from "@/lib/allure-documents";
import {
  majAllureAction,
  poserLogoAction,
  reprendreAllurePhotoAction,
  retirerLogoAction,
} from "../actions";
import { Couleur, Feuille } from "../pieces";

/**
 * « L'ALLURE DE MES DEVIS » — sa demande du 23 août 2026.
 *
 * *« Il faudrait que l'utilisateur puisse avoir un endroit dédié à la
 * modification de son devis. S'il veut rajouter son logo, changer la
 * typographie, changer le fond de page. »*
 *
 * **Ici, et pas dans une rubrique à part** : sa réponse B devant la planche
 * `appli/allure-de-mes-devis.html`. Le découpage du 7 septembre 2026 ne l'en
 * sort pas — cet écran vit SOUS « Devis & factures », le sommaire des réglages
 * garde ses douze lignes. **Le devis et la facture seulement** : la feuille de
 * chantier est interne, et il ne l'a pas demandée.
 *
 * **L'allure s'enregistre SEULE, dès qu'il touche une couleur.** Les conditions
 * engagent l'entreprise ; une couleur ne lie personne. Les faire attendre le
 * même bouton obligerait à valider des conditions pour changer un fond de page.
 */

/**
 * Les `@font-face` des familles retenues — écrits DEPUIS la liste, jamais à la
 * main.
 *
 * Une famille ajoutée à `TYPOGRAPHIES` doit s'afficher sans qu'on y pense :
 * une seconde liste ici finirait par en oublier une, et le patron aurait un
 * choix qui ne montre rien.
 */
const FACES = TYPOGRAPHIES.flatMap((t) =>
  t.famille && t.fichiers
    ? [
        `@font-face{font-family:"${t.famille}";font-weight:400;font-display:swap;src:url("/api/polices/${t.fichiers.normal}") format("truetype")}`,
        `@font-face{font-family:"${t.famille}";font-weight:700;font-display:swap;src:url("/api/polices/${t.fichiers.gras}") format("truetype")}`,
      ]
    : []
).join("");

export default function AllureClient({
  allureInitiale,
  logoInitial,
  entrepriseNom,
}: {
  allureInitiale: Allure;
  /** La clef de son logo dans le stockage, ou `null`. */
  logoInitial: string | null;
  entrepriseNom: string;
}) {
  const [allure, setAllure] = useState<Allure>(allureInitiale);
  const [logo, setLogo] = useState<string | null>(logoInitial);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const choixImage = useRef<HTMLInputElement | null>(null);
  const choixPhoto = useRef<HTMLInputElement | null>(null);

  // ── Reprendre l'allure d'un document PHOTOGRAPHIÉ — sa demande du 25 août ──
  // Ce que la photo a repris (couleurs, police, mentions) et ce qu'elle n'a pas
  // su faire (réserve). Le même geste, la même transition que le réglage à la
  // main juste dessous : photographier n'est qu'une autre façon de le remplir.
  const [reprise, setReprise] = useState<{ repris: string[]; reserve: string | null } | null>(null);

  function reprendrePhoto(f: File) {
    setRefus(null);
    setReprise(null);
    const formulaire = new FormData();
    formulaire.append("fichier", f);
    demarrer(async () => {
      const r = await reprendreAllurePhotoAction(formulaire);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      // On affiche ce que la base porte — l'allure et les mentions relues —,
      // jamais ce que la photo a cru voir : c'est ce qui s'imprimera.
      setAllure(r.allure);
      // **Les mentions relues, elles, ne sont plus affichées ICI** : elles
      // vivent dans « Ce qui s'imprime » depuis le découpage. L'action les a
      // écrites en base, et la réserve ci-dessous dit ce que la photo n'a pas
      // su faire — c'est tout ce que cet écran a le droit d'en montrer.
      setReprise({ repris: r.repris, reserve: r.reserve });
    });
  }

  function poserAllure(partiel: Partial<Allure>) {
    const prochaine = { ...allure, ...partiel };
    setAllure(prochaine);
    demarrer(async () => {
      // **On envoie `null` quand c'est le défaut** : la base garde alors ses
      // colonnes vides, et ses documents suivront la charte si elle bouge.
      const r = await majAllureAction(estLAllureParDefaut(prochaine) ? null : prochaine);
      setRefus(r.ok ? null : r.raison);
      // On réaffiche ce que la base porte : une couleur mal formée y est
      // retombée sur le défaut, et l'écran doit montrer ce qui s'imprimera.
      if (r.ok) setAllure(r.allure);
    });
  }

  return (
    <div className="pb-10">
      {/* **Les vraies polices, servies depuis les fichiers du PDF.** Sans elles,
          ce choix est un mensonge : le navigateur ne connaît aucune des
          familles, et « Merriweather » s'afficherait en Georgia. Vu à la
          capture le 24 août 2026, jamais par un test. */}
      <style>{FACES}</style>

      <section className="mx-[26px] mt-[26px]">
        <p className={`mb-3 ${texteSituation}`} style={{ color: colors.inkSoft }}>
          Elle habille votre devis et votre facture. La feuille de chantier, elle,
          ne change pas : personne d&apos;autre que vous ne la lit.
        </p>

        {/* ── PHOTOGRAPHIER UN DEVIS — sa demande du 25 août 2026 ─────────────
            *« faut que l'utilisateur puisse prendre la photo de son devis […]
            pareil pour sa facture »*, après *« on comprend rien, trop compliqué
            pour modifier »*. Dessiné d'abord (`appli/photographier-mon-devis.html`)
            et tranché ainsi : la photo reprend l'ALLURE (couleurs, police) et les
            MENTIONS — jamais les lignes ni les prix, jamais le logo.

            **La photo d'abord, le réglage à la main dessous** : son choix devant
            la question du 25 août. Un seul champ, sans `capture` : le navigateur
            offre alors l'appareil photo OU la photothèque — son devis est parfois
            déjà une image dans sa galerie. */}
        <div
          className="mb-5 rounded-[6px] p-4"
          style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
        >
          <input
            ref={choixPhoto}
            type="file"
            accept="image/*"
            className="hidden"
            data-atlas="photo-fichier"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) reprendrePhoto(f);
            }}
          />
          {/* Deux gestes, un pour chaque document — comme sur la maquette. La
              lecture est la même : ce sont ses mots qui changent, pas le calcul. */}
          <button
            type="button"
            data-atlas="photo-devis"
            disabled={enCours}
            onClick={() => choixPhoto.current?.click()}
            className="atlas-plein flex min-h-[52px] w-full items-center justify-center rounded-full px-4 text-[15px]"
            style={{ backgroundColor: colors.plein, color: surPlein, opacity: enCours ? 0.6 : 1 }}
          >
            {enCours ? "Lecture…" : "Photographier mon devis"}
          </button>
          <button
            type="button"
            data-atlas="photo-facture"
            disabled={enCours}
            onClick={() => choixPhoto.current?.click()}
            className="mt-2 flex min-h-[52px] w-full items-center justify-center rounded-full px-4 text-[15px]"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}`, opacity: enCours ? 0.6 : 1 }}
          >
            Photographier ma facture
          </button>

          {reprise && (
            <div data-atlas="photo-repris" className="mt-3">
              {reprise.repris.length > 0 ? (
                <p className="text-[14px] leading-[1.5]" style={{ color: colors.ink }}>
                  Repris : {reprise.repris.join(", ")}.
                </p>
              ) : (
                <p className="text-[14px] leading-[1.5]" style={{ color: colors.muted }}>
                  Rien n&apos;a pu être repris de cette photo.
                </p>
              )}
              {reprise.reserve && (
                <p className={`mt-1 ${texteSituation}`} style={{ color: colors.inkSoft }}>
                  {reprise.reserve}
                </p>
              )}
            </div>
          )}

          <p className={`mt-2 ${texteSituation}`} style={{ color: colors.inkSoft }}>
            Les couleurs, la police et les mentions. Ni les lignes, ni les prix.
          </p>
        </div>

        {refus && (
          <p role="alert" data-atlas="allure-refus" className={`mb-3 ${texteSituation}`} style={{ color: colors.alert }}>
            {refus}
          </p>
        )}

        {/* ── L'APERÇU EN TÊTE, ET IL RESTE COLLÉ — sa proposition B, 24 août 2026
            ────────────────────────────────────────────────────────────────────
            *« Lorsque je modifie mon devis, je suis obligé de descendre pour
            voir les modifications. »* Trois rangements lui ont été dessinés
            (planche 96, `appli/allure-mieux-rangee.html`), et il a répondu
            **« la B »**.

            **Pourquoi COLLÉ et pas seulement remonté** (la proposition A, qu'il
            n'a pas retenue) : posé en tête sans collage, l'aperçu se voit en
            arrivant puis ressort de l'écran dès qu'on descend aux polices. La
            moitié du problème seulement, et la planche le mesurait.

            **`sticky` et non `fixed`** : la feuille suit tant que CET écran est
            à l'écran. Fixée, elle recouvrirait le bas de page.

            **Il reste collé même après le découpage du 7 septembre 2026.** On
            aurait pu croire l'aperçu inutile sur un écran devenu court : il ne
            l'est pas — six pastilles de typographie et deux nuanciers font
            toujours plus d'un écran de téléphone, et c'est justement en
            descendant qu'on a besoin de voir ce qu'on change. */}
        <div
          data-atlas="allure-apercu-colle"
          className="sticky top-0 z-10 -mx-[26px] mb-5 px-[26px] pb-3 pt-2"
          // **Une ombre courte sous le bord**, et rien de plus : sans elle, les
          // pastilles qui défilent semblent s'effacer au milieu de nulle part.
          style={{
            backgroundColor: colors.cream,
            // **Aucune couleur en clair dans un écran** (`CLAUDE.md` §3) : sept
            // chartes cohabitent, dont deux sombres où une ombre noire posée en
            // dur ne se voit plus. `voile` la fait suivre l'encre de la charte.
            boxShadow: `0 8px 14px -12px ${voile(colors.ink, 0.5)}`,
          }}
        >
          {/* **Un aperçu d'APPARENCE, et rien d'autre.** Il ne porte aucun
              montant calculé, aucune condition : ce serait une seconde écriture
              du devis, qui finirait par ne plus dire ce que le PDF dit. */}
          <p className={`mb-2 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
            L&apos;allure de la page
          </p>
          <Feuille allure={allure} logo={logo} nom={entrepriseNom} />
        </div>

        <p className={`mb-2 ${libelleCaps}`} style={{ color: colors.inkSoft }}>Mon logo</p>
        <div className="mb-1 flex items-center gap-3">
          <span
            data-atlas="logo-case"
            className="flex h-[58px] w-[58px] flex-none items-center justify-center overflow-hidden rounded-[6px] text-[11px]"
            style={{ backgroundColor: colors.card, color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          >
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/fichiers/${logo}`}
                alt="Votre logo"
                className="h-full w-full object-contain"
              />
            ) : (
              "Aucun"
            )}
          </span>
          <input
            ref={choixImage}
            type="file"
            accept={LOGOS_ACCEPTES.join(",")}
            className="hidden"
            data-atlas="logo-fichier"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              // **Refusé ici avec la MÊME fonction que le serveur.** Le laisser
              // partir pour se le voir refuser après le téléversement lui ferait
              // attendre pour rien, sur un forfait de chantier.
              const refusLogo = refusDuLogo(f.type, f.size);
              if (refusLogo) {
                setRefus(refusLogo);
                return;
              }
              setRefus(null);
              const formulaire = new FormData();
              formulaire.append("fichier", f);
              demarrer(async () => {
                const r = await poserLogoAction(formulaire);
                if (r.ok) setLogo(r.logo);
                else setRefus(r.raison);
              });
            }}
          />
          <button
            type="button"
            data-atlas="logo-choisir"
            onClick={() => choixImage.current?.click()}
            className="min-h-[44px] rounded-full px-4 text-[14px]"
            style={{ color: colors.or, boxShadow: `inset 0 0 0 1px ${colors.or}` }}
          >
            {logo ? "Changer" : "Choisir une image"}
          </button>
          {logo && (
            <button
              type="button"
              data-atlas="logo-retirer"
              onClick={() =>
                demarrer(async () => {
                  const r = await retirerLogoAction();
                  if (r.ok) setLogo(null);
                  else setRefus(r.raison);
                })
              }
              className="min-h-[44px] rounded-full px-4 text-[14px]"
              style={{ color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            >
              Retirer
            </button>
          )}
        </div>
        <p className={`mb-5 ${texteSituation}`} style={{ color: colors.inkSoft }}>
          En haut à gauche, au-dessus de vos coordonnées. PNG ou JPEG, 1,5 Mo au plus.
        </p>

        <p className={`mb-2 ${libelleCaps}`} style={{ color: colors.inkSoft }}>Typographie</p>
        <div className="mb-5 grid grid-cols-2 gap-2">
          {TYPOGRAPHIES.map((t) => {
            const choisie = allure.typographie === t.clef;
            return (
              <button
                key={t.clef}
                type="button"
                data-atlas={`typo-${t.clef}`}
                aria-pressed={choisie}
                onClick={() => poserAllure({ typographie: t.clef })}
                // **`rounded-full`, comme tous ses boutons depuis le 12 août
                //   2026.** `test-boutons-arrondis` l'a attrapé ici : un rayon
                //   de 8 px était resté, et un seul bouton carré dans
                //   l'application se voit.
                className="min-h-[62px] rounded-full px-5 py-2.5 text-left"
                style={{
                  backgroundColor: choisie ? colors.card : "transparent",
                  boxShadow: `inset 0 0 0 1px ${choisie ? colors.or : colors.line}`,
                }}
              >
                {/* **Le nom s'écrit DANS la police qu'il nomme.** Une liste de
                    noms en linéale ne montre rien de ce qu'on choisit — et
                    c'est la seule chose qu'il regarde ici. */}
                <span
                  className="block text-[15px]"
                  style={{ color: colors.ink, fontFamily: t.pileCss ?? undefined }}
                >
                  {t.nom}
                </span>
                <span className={`mt-0.5 block ${texteSituation}`} style={{ color: colors.inkSoft }}>
                  {t.clef === ALLURE_PAR_DEFAUT.typographie ? `${t.dit} · par défaut` : t.dit}
                </span>
              </button>
            );
          })}
        </div>

        <Couleur
          titre="Fond de page"
          valeur={allure.fond}
          clef="fond"
          aide="N'importe quelle couleur. Un fond sombre éclaircit le texte tout seul."
          // **Le raccourci « aujourd'hui » vient du défaut, jamais d'un hexa
          //   retapé.** Une teinte recopiée ici aurait fini par désigner une
          //   couleur qui n'est plus celle de ses documents.
          rapides={[
            [ALLURE_PAR_DEFAUT.fond, "Celui d'aujourd'hui"],
            ["#ffffff", "Blanc"],
            ["#ece9e1", "Crème"],
            ["#e8e8e6", "Gris clair"],
          ]}
          onChoisir={(v) => poserAllure({ fond: v })}
        />

        <Couleur
          titre="Couleur d'accent"
          valeur={allure.accent}
          clef="accent"
          // **CETTE PHRASE PROMETTAIT LE TOTAL, ET LE TOTAL EST À L'ENCRE.**
          // Trouvé le 7 septembre 2026 en vérifiant sa remarque sur le doré :
          // `document-commun.ts` ne donne l'accent qu'à `titrePartie` — les
          // intitulés « Émetteur » / « Client » et le trait sous le titre. Le
          // « Total TTC » s'écrit sans couleur (`ecrire`, sans style). Une aide
          // qui annonce ce que le document ne fait pas se paie à la première
          // capture : il change l'accent, regarde son total, et croit à une
          // panne.
          aide="Le trait sous le titre, et les intitulés « Émetteur » / « Client »."
          rapides={[
            // **Le doré EST le défaut de ses documents** (`couleursDocument.accent`),
            // et c'est ce que porte cette première pastille. Sa remarque du
            // 7 septembre — « il manque le doré » — visait la maquette, pas
            // l'application : la planche l'avait perdu en recopiant les
            // pastilles à la main.
            [ALLURE_PAR_DEFAUT.accent, "Celui d'aujourd'hui — le doré"],
            ["#2f3b2f", "Vert pin"],
            ["#6e2433", "Bordeaux"],
            ["#1c1c1a", "Noir"],
          ]}
          onChoisir={(v) => poserAllure({ accent: v })}
        />

        {!estLAllureParDefaut(allure) && (
          <button
            type="button"
            data-atlas="allure-defaut"
            onClick={() => poserAllure({ ...ALLURE_PAR_DEFAUT })}
            className="mt-3 min-h-[44px] w-full rounded-full text-[14px]"
            style={{ color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          >
            Revenir aux réglages d&apos;aujourd&apos;hui
          </button>
        )}

        <p className={`mt-3 ${texteSituation}`} style={{ color: colors.inkSoft }}>
          {enCours ? "Enregistrement…" : "Enregistré au fur et à mesure."}
        </p>
      </section>
    </div>
  );
}
