"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BUTTON_STYLES } from "~~/constants/landing";
import { useCursorDistance } from "~~/hooks/landing/useCursorDistance";
import { cn } from "~~/utils/cn";

interface BaseButtonProps {
  children: React.ReactNode;
  className?: string;
  /** Always-on spinning glint border. */
  glint?: boolean;
  /** Glint border only while hovered. */
  glintOnHover?: boolean;
  /** Glint intensity/scale reacts to cursor proximity instead of hover state. */
  proximityIntensity?: boolean;
  /** Silver-metal gradient variant (experimental — see .silver-metal in styles/landing.css). */
  silver?: boolean;
  speed?: number;
  maxDistance?: number;
}

interface LinkButtonProps extends BaseButtonProps {
  href: string;
  as?: "link";
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  target?: React.HTMLAttributeAnchorTarget;
}

interface ActionButtonProps extends BaseButtonProps {
  href?: never;
  as: "button";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

type ButtonProps = LinkButtonProps | ActionButtonProps;

/**
 * The landing-page pill button, with an optional spinning "glint" border
 * (see .glint-button-* in styles/landing.css). `proximityIntensity` makes
 * the glint brighten as the cursor approaches, using useCursorDistance.
 */
export const Button = (props: ButtonProps) => {
  const {
    children,
    className,
    glint = false,
    glintOnHover = false,
    speed = 4,
    proximityIntensity = false,
    maxDistance = 150,
    silver = false,
    onClick,
  } = props;

  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { intensity } = useCursorDistance(wrapperRef, { maxDistance, throttleMs: 16 });

  const hasGlintFeature = glint || glintOnHover || proximityIntensity;
  const shouldShowGlint = glint || (glintOnHover && isHovered) || proximityIntensity;

  const wrapperStyle = useMemo(() => {
    if (!shouldShowGlint) return undefined;
    const baseOpacity = proximityIntensity ? 0.4 + intensity * 0.4 : 0.6;
    const peakOpacity = proximityIntensity ? 0.5 + intensity * 0.7 : 0.7;
    const scaleValue = proximityIntensity ? 1.2 + intensity * 0.5 : 1;
    return {
      "--animation-duration": `${speed}s`,
      "--glint-opacity": baseOpacity,
      "--glint-opacity-peak": peakOpacity,
      "--glint-scale": scaleValue,
    } as React.CSSProperties;
  }, [speed, proximityIntensity, intensity, shouldShowGlint]);

  const buttonClasses = cn(
    BUTTON_STYLES.base,
    silver && "silver-metal",
    shouldShowGlint && BUTTON_STYLES.glintOverrides,
    className,
  );

  const element =
    props.as === "button" ? (
      <button
        className={buttonClasses}
        onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
        type={props.type || "button"}
        disabled={props.disabled}
      >
        {children}
      </button>
    ) : (
      <Link
        href={props.href}
        className={buttonClasses}
        onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}
        target={props.target}
      >
        {children}
      </Link>
    );

  if (!hasGlintFeature) return element;

  return (
    <div
      ref={wrapperRef}
      className={cn(shouldShowGlint && "glint-button-wrapper")}
      style={wrapperStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {shouldShowGlint ? <div className="glint-button-content">{element}</div> : element}
    </div>
  );
};
