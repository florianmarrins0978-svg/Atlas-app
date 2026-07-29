import { colors } from "@/lib/design-tokens";

export default function PrimaryButton({
  children,
  onClick,
  href,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const className =
    "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[16px] font-medium transition-colors";

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={`${className} cursor-not-allowed`}
        style={{ backgroundColor: colors.line, color: colors.muted }}
      >
        {children}
      </button>
    );
  }

  const style = { backgroundColor: colors.rust };

  if (href) {
    return (
      <a href={href} className={`${className} text-white`} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${className} text-white`} style={style}>
      {children}
    </button>
  );
}
