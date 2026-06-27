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
        "relative shrink-0 overflow-hidden bg-[#06351f] shadow-[0_12px_28px_rgba(24,201,87,0.22)]",
        markSizes[size],
        className,
      )}
    >
      <img
        src="/prospera-mark.png"
        alt=""
        className="absolute inset-0 h-full w-full scale-[1.68] object-cover"
      />
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
