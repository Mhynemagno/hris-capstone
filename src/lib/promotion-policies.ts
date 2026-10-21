export type OfficialPromotionPolicy = {
  rankBand: "PLT–PLTCOL" | "PSMS–PEMS" | "PCPL–PMSG";
  criteria: { label: string; points: number; detail: string }[];
};

/** Fixed promotion-board matrices transcribed from Final Revisions.pdf pp. 18–20. */
export const OFFICIAL_PROMOTION_POLICIES: OfficialPromotionPolicy[] = [
  {
    rankBand: "PLT–PLTCOL",
    criteria: [
      { label: "Seniority", points: 25, detail: "Time in grade" },
      { label: "Diversity of assignment", points: 25, detail: "Field, administrative, and geographic assignments" },
      { label: "Awards and recognition", points: 10, detail: "Awards held at present rank" },
      { label: "IPER", points: 5, detail: "Two consecutive rating periods" },
      { label: "Competence to assume position / leadership experience", points: 10, detail: "Rated by the Promotion Board during interview" },
      { label: "Service reputation", points: 25, detail: "Administrative/criminal records and derogatory information" },
    ],
  },
  {
    rankBand: "PSMS–PEMS",
    criteria: [
      { label: "Seniority", points: 25, detail: "Time in grade" },
      { label: "Diversity of assignment", points: 25, detail: "Field, administrative, and geographic assignments" },
      { label: "Awards and recognition", points: 10, detail: "Awards held at present rank" },
      { label: "IPER", points: 5, detail: "Two consecutive rating periods" },
      { label: "Competence to assume position / leadership experience", points: 10, detail: "Rated by the Promotion Board during interview" },
      { label: "Service reputation", points: 25, detail: "Administrative/criminal records and derogatory information" },
    ],
  },
  {
    rankBand: "PCPL–PMSG",
    criteria: [
      { label: "Seniority", points: 30, detail: "Time in grade" },
      { label: "Diversity of assignment", points: 20, detail: "Field and administrative duty" },
      { label: "Awards and recognition", points: 10, detail: "Awards held at present rank" },
      { label: "IPER", points: 5, detail: "Two consecutive rating periods" },
      { label: "Interview", points: 15, detail: "Rated by the Promotion Board during interview" },
      { label: "Service reputation", points: 20, detail: "Administrative/criminal records and derogatory information" },
    ],
  },
];
