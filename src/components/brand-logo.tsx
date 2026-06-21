import { cn } from "@/lib/utils";

interface BrandMarkProps {
  size?: "sm" | "md";
  className?: string;
}

const markSizes = {
  sm: "h-8 w-8 rounded-[0.85rem] text-base",
  md: "h-10 w-10 rounded-[1rem] text-lg",
};

export function BrandMark({ size = "md", className }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center bg-primary text-primary-foreground shadow-[0_10px_22px_rgba(24,201,87,0.24)] ring-1 ring-primary/20",
        markSizes[size],
        className,
      )}
    >
      <span className="font-display font-extrabold leading-none tracking-normal">P</span>
    </span>
  );
}

interface BrandLogoProps {
  markSize?: BrandMarkProps["size"];
  className?: string;
  textClassName?: string;
}

export function BrandLogo({ markSize = "md", className, textClassName }: BrandLogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={markSize} />
      <span className={cn("font-display font-bold tracking-tight text-foreground", textClassName)}>
        Prospera
      </span>
    </span>
  );
}
