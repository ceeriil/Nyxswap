"use client";

import { useRef, useState } from "react";
import { SHOWCASE_STYLES } from "~~/constants/landing";
import { cn } from "~~/utils/cn";

interface VideoBoxProps {
  src: string;
  poster?: string;
  className?: string;
  border?: boolean;
}

/** Bordered, click-to-play video showcase (used for the About page reel). */
export const VideoBox = ({ src, poster, className, border = true }: VideoBoxProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const handlePlay = () => {
    if (hasStarted) return;
    videoRef.current?.play().catch(() => {});
    setHasStarted(true);
  };

  return (
    <div
      className={cn(
        "relative w-full aspect-video overflow-hidden",
        border && SHOWCASE_STYLES.border,
        border && SHOWCASE_STYLES.borderRadius,
        className,
      )}
      onClick={handlePlay}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls={hasStarted}
        className="w-full h-full object-cover"
        playsInline
        preload="metadata"
      />
      {!hasStarted && <div className="absolute inset-0 cursor-pointer" />}
    </div>
  );
};
