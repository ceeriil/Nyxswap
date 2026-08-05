interface LineSweepTextProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  animate?: boolean;
}

/**
 * Wraps text with a looping light-sweep highlight, layered on top of the
 * base text via a gradient background-clip. Used on hero/section headings.
 */
export const LineSweepText = ({ children, className = "", duration = 6, animate = true }: LineSweepTextProps) => {
  if (!animate) return <span className={className}>{children}</span>;

  return (
    <span className={`relative inline-block ${className}`}>
      <span>{children}</span>
      <span
        className="absolute inset-0 text-white"
        style={{
          background: "linear-gradient(90deg, transparent 0%, white 20%, transparent 40%)",
          backgroundSize: "300% 100%",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
          animation: `lightSweep ${duration}s linear infinite`,
        }}
      >
        {children}
      </span>
    </span>
  );
};
