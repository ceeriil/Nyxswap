import Link from "next/link";

interface NavLinkProps {
  href: string;
  label: string;
  onClick?: () => void;
  className?: string;
}

/** Nav item that fades to the muted gray on hover. */
export const NavLink = ({ href, label, onClick, className = "" }: NavLinkProps) => {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`cursor-pointer rounded-sm LandingButtonText transition-colors hover:text-landing-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-landing-bg ${className}`}
    >
      {label}
    </Link>
  );
};
