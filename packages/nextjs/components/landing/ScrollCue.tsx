import { ArrowDownIcon } from "@heroicons/react/24/outline";

interface ScrollCueProps {
  href?: string;
  className?: string;
}

/** Bottom-right hero scroll indicator — rings fade in and expand out on hover. */
export const ScrollCue = ({ href = "#problem", className }: ScrollCueProps) => {
  return (
    <a
      href={href}
      aria-label="Scroll down"
      className={`group flex h-[6rem] w-[6rem] items-center justify-center ${className ?? ""}`}
    >
      <span className="absolute inset-0 scale-100 rounded-full border border-white/15 opacity-0 transition-all duration-500 ease-out group-hover:scale-[1.2] group-hover:opacity-100" />
      <span className="absolute inset-0 scale-100 rounded-full border border-white/10 opacity-0 transition-all duration-500 delay-100 ease-out group-hover:scale-[1.4] group-hover:opacity-100" />
      <span className="absolute inset-0 rounded-full border border-white/25 bg-transparent transition-colors duration-300 group-hover:border-landing-button-border group-hover:bg-landing-button-hover" />
      <ArrowDownIcon className="relative h-5 w-5 text-white transition-transform duration-300 group-hover:translate-y-0.5" />
    </a>
  );
};
