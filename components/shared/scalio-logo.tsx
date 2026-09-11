import Image from "next/image";

export default function ScalioLogo({ className = "", width = 144 }: { className?: string; width?: number }) {
  return <Image src="/scalio-logo.png" alt="Scalio" width={width} height={Math.round(width * 219 / 796)} className={`h-auto shrink-0 ${className}`} priority />;
}
