import Image from "next/image";

export function SangeetMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return <Image src="/sangeet-mark.svg" alt="" aria-hidden="true" width={size} height={size} className={`shrink-0 ${className}`} />;
}
