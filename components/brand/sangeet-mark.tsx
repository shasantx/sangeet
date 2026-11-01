import Image from "next/image";

export function SangeetMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return <Image unoptimized src="/brand/sangeet-logo.png" alt="" aria-hidden="true" width={size} height={size} className={`shrink-0 rounded-md bg-white object-cover ${className}`} />;
}
