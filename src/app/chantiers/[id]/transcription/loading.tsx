import ScreenHeader from "@/components/ScreenHeader";

export default function Chargement() {
  return (
    <div>
      <ScreenHeader title="Transcription" />
      <div className="p-4">
        <p className="text-xs text-ink/40">Chargement…</p>
      </div>
    </div>
  );
}
