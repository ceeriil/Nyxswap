import { CARD_BACKGROUNDS } from "~~/constants/landing";
import { cn } from "~~/utils/cn";

interface InfoCardProps {
  /** e.g. a step number ("01") or a short label. */
  eyebrow?: string;
  title: string;
  description: string;
  className?: string;
  /** Deterministic pick from CARD_BACKGROUNDS; pass e.g. the card's index. */
  backgroundSeed?: number;
}

/** Text-only glint-bordered tile — used for "How it works" steps and the features grid. */
export const InfoCard = ({ eyebrow, title, description, className, backgroundSeed = 0 }: InfoCardProps) => {
  const background = CARD_BACKGROUNDS[Math.abs(backgroundSeed) % CARD_BACKGROUNDS.length];

  return (
    <div className={cn("glint-card-wrapper h-full", className)}>
      <div
        className="glint-card-content h-full p-6 md:p-8 flex flex-col gap-3"
        style={{ background: `url(${background}) center/cover` }}
      >
        {eyebrow && <span className="font-nord text-landing-muted text-sm">{eyebrow}</span>}
        <h3 className="SectionTitle">{title}</h3>
        <p className="LandingParagraph">{description}</p>
      </div>
    </div>
  );
};
