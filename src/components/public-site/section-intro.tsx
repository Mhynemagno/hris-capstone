type SectionIntroProps = {
  eyebrow: string;
  title: string;
  /** id of the h2, used by the section's aria-labelledby. */
  id: string;
  description?: string;
  align?: "start" | "center";
};

export function SectionIntro({ align = "start", description, eyebrow, id, title }: SectionIntroProps) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-sm font-bold tracking-[0.18em] text-cta uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white" id={id}>{title}</h2>
      {description ? <p className="mt-3 text-base leading-7 text-slate-300">{description}</p> : null}
    </div>
  );
}
