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
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground" id={id}>{title}</h2>
      {description ? <p className="mt-3 text-base leading-7 text-muted-foreground">{description}</p> : null}
    </div>
  );
}
