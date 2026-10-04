import Image from "next/image";

export function BrandLogos({ priority = false, size = 80 }: { priority?: boolean; size?: number }) {
  return (
    <div className="flex items-center gap-4">
      <Image alt="San Juan City Police Station logo" className="object-contain drop-shadow-md" height={size} priority={priority} src="/san-juan-police-logo.png" style={{ height: size, width: size }} width={size} />
      <span aria-hidden="true" className="h-12 w-px bg-white/20" />
      {/* The wordmark is dark blue, so it sits on a light chip to stay legible on navy. */}
      <span className="rounded-xl bg-white p-2 shadow-md">
        <Image alt="Bagong Pilipinas logo" className="w-auto object-contain" height={size - 16} priority={priority} src="/bagong-pilipinas-logo.png" style={{ height: size - 16 }} width={Math.round(((size - 16) * 330) / 308)} />
      </span>
    </div>
  );
}
