"use client";

import { useEffect, useRef } from "react";
import { colors } from "@/lib/design-tokens";
import { segmentsDuModele } from "@/lib/segments-message";

/**
 * L'ÉDITEUR DE SON MESSAGE — sa demande du 25 août 2026.
 *
 * *« Le message au client doit comporter les phrases par défaut et l'utilisateur
 * les modifiera s'il le désire ; seuls les mots en doré ne peuvent être
 * modifiés. »*
 *
 * Il écrit dans un vrai texte, en clair — le bonjour, la formule de fin, tout ce
 * qu'il veut ajouter. Ce qu'Atlas remplit tout seul (le prénom, la phrase du
 * document qui s'adapte au devis comme à la facture, le lien, son nom) est posé
 * en DORÉ et **verrouillé** : on ne peut ni le couper en deux, ni le retaper.
 *
 * ## Pourquoi un champ « riche » et pas un simple `<textarea>`
 *
 * Un `<textarea>` ne sait pas colorer une partie de son texte, ni empêcher d'en
 * modifier un morceau. Pour tenir sa règle — « les mots en doré ne se modifient
 * pas » —, il faut des pastilles inertes au milieu d'un texte qui, lui, se
 * modifie. C'est ce que fait un `contenteditable` avec des `<span
 * contenteditable="false">`.
 *
 * **Le piège du `contenteditable`, désamorcé : les retours à la ligne.** Laissé
 * à lui-même, le navigateur insère un `<div>` (Chrome) ou un `<br>` (Firefox)
 * quand on appuie sur Entrée, et les deux se relisent différemment. On intercepte
 * donc Entrée pour poser un simple « \n » de texte : la relecture n'a plus alors
 * qu'à concaténer les nœuds de texte et les pastilles, et rend exactement le
 * modèle. Le collage est ramené à du texte brut pour la même raison.
 */
export default function EditeurMessage({
  valeur,
  libelles,
  invalide,
  onChange,
}: {
  /** Le modèle courant (`Bonjour [client], …`). */
  valeur: string;
  /** Ce que CHAQUE pastille affiche dans le cadre, en doré. */
  libelles: Record<string, string>;
  /** Vrai quand le message est refusé : le cadre se souligne d'alerte. */
  invalide: boolean;
  /** Rappelé à chaque frappe, avec le modèle reconstruit. */
  onChange: (modele: string) => void;
}) {
  const cadre = useRef<HTMLDivElement>(null);
  // Le dernier modèle que NOUS avons sérialisé. Sert à ne pas réécrire le DOM
  // pendant qu'il tape (ce qui ferait sauter son curseur) : on ne reconstruit
  // que lorsque `valeur` change pour une autre raison (le bouton « Remettre »).
  const dernierSerialise = useRef<string | null>(null);

  useEffect(() => {
    if (valeur === dernierSerialise.current) return;
    const el = cadre.current;
    if (!el) return;
    el.textContent = "";
    for (const seg of segmentsDuModele(valeur)) {
      if (seg.type === "texte") {
        el.appendChild(document.createTextNode(seg.valeur));
      } else {
        const puce = document.createElement("span");
        puce.contentEditable = "false";
        puce.dataset.jeton = seg.valeur;
        puce.textContent = libelles[seg.valeur] ?? seg.valeur;
        puce.style.color = colors.or;
        puce.style.fontWeight = "600";
        puce.style.borderRadius = "4px";
        puce.style.padding = "0 4px";
        // Un voile doré très léger : la puce se lit comme un bloc, sans crier.
        puce.style.backgroundColor = "color-mix(in srgb, currentColor 12%, transparent)";
        puce.style.whiteSpace = "nowrap";
        puce.style.userSelect = "none";
        el.appendChild(puce);
      }
    }
    dernierSerialise.current = valeur;
  }, [valeur, libelles]);

  /** Relit le cadre → un modèle, en concaténant texte et pastilles. */
  function serialiser(): string {
    const el = cadre.current;
    if (!el) return "";
    let out = "";
    el.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        out += n.nodeValue ?? "";
      } else if (n instanceof HTMLElement) {
        // Une pastille rend son jeton ; un <br> résiduel, un saut de ligne ;
        // tout autre élément (un collage mal filtré) rend son texte nu.
        if (n.dataset.jeton) out += n.dataset.jeton;
        else if (n.tagName === "BR") out += "\n";
        else out += n.textContent ?? "";
      }
    });
    return out;
  }

  function auInput() {
    const modele = serialiser();
    dernierSerialise.current = modele;
    onChange(modele);
  }

  function auClavier(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter") {
      // On pose un « \n » de texte plutôt que de laisser le navigateur créer un
      // bloc : c'est ce qui rend la relecture fiable (voir l'en-tête).
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const plage = sel.getRangeAt(0);
      plage.deleteContents();
      const saut = document.createTextNode("\n");
      plage.insertNode(saut);
      plage.setStartAfter(saut);
      plage.collapse(true);
      sel.removeAllRanges();
      sel.addRange(plage);
      auInput();
    }
  }

  function auCollage(e: React.ClipboardEvent<HTMLDivElement>) {
    // Toujours en texte brut : un collage riche amènerait des balises que la
    // relecture ne saurait pas rendre, et des styles étrangers à la charte.
    e.preventDefault();
    const texte = e.clipboardData.getData("text/plain");
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const plage = sel.getRangeAt(0);
    plage.deleteContents();
    const noeud = document.createTextNode(texte);
    plage.insertNode(noeud);
    plage.setStartAfter(noeud);
    plage.collapse(true);
    sel.removeAllRanges();
    sel.addRange(plage);
    auInput();
  }

  return (
    <div
      ref={cadre}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Votre message au client"
      data-atlas="message-client"
      onInput={auInput}
      onKeyDown={auClavier}
      onPaste={auCollage}
      className="w-full rounded-[6px] px-[13px] py-[11px]"
      style={{
        // **16 px, jamais moins.** En dessous, iOS grossit la page à la première
        // frappe et l'écran saute sous son doigt.
        fontSize: 16,
        lineHeight: 1.5,
        minHeight: 200,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        backgroundColor: colors.card,
        color: colors.ink,
        border: `1px solid ${invalide ? colors.alert : colors.line}`,
        outline: "none",
      }}
    />
  );
}
