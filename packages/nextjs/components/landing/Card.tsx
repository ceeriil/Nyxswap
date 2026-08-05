"use client";

import { useId, useRef, useState } from "react";
import { Button } from "~~/components/landing/Button";
import { LineSweepText } from "~~/components/landing/LineSweepText";
import { CARD_BACKGROUNDS } from "~~/constants/landing";
import { cn } from "~~/utils/cn";

export interface CardProps {
  image: { src: string; alt: string };
  /** Optional muted looping video that plays in place of the image on hover. */
  video?: { src: string };
  title: string;
  subtitle: string;
  /** Small label in the top-right corner, e.g. a date. */
  meta?: string;
  ctaLabel?: string;
  onClick?: () => void;
  className?: string;
  /** Deterministic pick from CARD_BACKGROUNDS; pass e.g. the card's index. */
  backgroundSeed?: number;
}

export const Card = ({
  image,
  video,
  title,
  subtitle,
  meta,
  ctaLabel = "View",
  onClick,
  className,
  backgroundSeed = 0,
}: CardProps) => {
  const clipId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const background = CARD_BACKGROUNDS[Math.abs(backgroundSeed) % CARD_BACKGROUNDS.length];

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (video && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (video && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <article
      className={cn("group glint-card-wrapper cursor-pointer w-full", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <div
        className="glint-card-content p-3 sm:p-4 md:p-5 lg:p-6 xl:p-5 2xl:p-6"
        style={{ background: `url(${background}) center/cover` }}
      >
        <figure className="relative aspect-video w-full rounded-xl overflow-hidden">
          <svg className="absolute w-0 h-0" aria-hidden="true">
            <defs>
              <clipPath id={clipId} clipPathUnits="objectBoundingBox">
                <path d="M0,0 L0.69,0 Q0.72,0 0.73,0.015 L0.985,0.27 Q1,0.285 1,0.31 L1,1 L0,1 Z" />
              </clipPath>
            </defs>
          </svg>

          <img
            src={image.src}
            alt={image.alt}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-300",
              video && videoReady && isHovered && "opacity-0",
            )}
            style={{ clipPath: `url(#${clipId})` }}
          />

          {video && (
            <video
              ref={videoRef}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                isHovered ? "opacity-100" : "opacity-0",
              )}
              style={{ clipPath: `url(#${clipId})` }}
              src={video.src}
              muted
              loop
              playsInline
              preload="metadata"
              onCanPlay={() => setVideoReady(true)}
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

          <figcaption className="absolute bottom-0 left-0 p-6">
            <div className="flex items-center gap-4">
              <div className="w-px bg-landing-border self-stretch min-h-[40px]" />
              <div className="flex-1">
                <h3
                  className={cn(
                    "font-nord text-xl font-bold italic mb-1 transition-colors duration-300",
                    isHovered ? "text-landing-muted" : "text-white",
                  )}
                >
                  <LineSweepText animate={isHovered} className="text-sm 2xl:text-base">
                    {title}
                  </LineSweepText>
                </h3>
                <p className="font-nord text-white font-light text-xs 2xl:text-sm">{subtitle}</p>
              </div>
            </div>
          </figcaption>

          {meta && (
            <div className="absolute top-[5%] left-[90%]">
              <time className="text-landing-muted font-nord font-light text-[11px] sm:text-sm md:text-lg xl:text-sm 2xl:text-lg">
                {meta}
              </time>
            </div>
          )}

          <div className="absolute bottom-8 right-8 transform translate-x-full opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 ease-out">
            <Button glint proximityIntensity maxDistance={200} as="button" onClick={onClick} speed={3}>
              {ctaLabel}
            </Button>
          </div>
        </figure>
      </div>
    </article>
  );
};
