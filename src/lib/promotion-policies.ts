export type OfficialPromotionPolicy = {
  rankBand: "PLT–PLTCOL" | "PSMS–PEMS" | "PCPL–PMSG";
  criteria: { label: string; points: number; detail: string }[];
  /** Qualifying requirements: must be met before a candidate is considered, but carry no points. */
  qualifyingRequirements: { label: string; detail: string }[];
};

export type PromotionScoreBand = "PCPL-PMSG" | "PSMS-PEMS" | "PLT-PLTCOL";
export type PromotionScoreCriterion = "seniority" | "assignment" | "awards" | "iper" | "board" | "reputation";
export type PromotionScoreAge = { years: number; months: number; days: number };
export type PromotionScorePolicy = {
  allocation: Record<PromotionScoreCriterion, number>;
  seniorityRows: { minimum: PromotionScoreAge; points: number }[];
  assignmentRows: { key: string; label: string; pointsPerSixMonths: number; cap: number; regions?: string[] }[];
  awards: { key: string; label: string; points: number }[];
  iperPairs: { ratings: ["Outstanding" | "Very Satisfactory", "Outstanding" | "Very Satisfactory"]; points: number }[];
};

const SENIORITY_ROWS_25: PromotionScorePolicy["seniorityRows"] = [
  { minimum: { years: 3, months: 0, days: 1 }, points: 15 },
  { minimum: { years: 3, months: 6, days: 1 }, points: 16 },
  { minimum: { years: 4, months: 0, days: 1 }, points: 17 },
  { minimum: { years: 4, months: 6, days: 1 }, points: 18 },
  { minimum: { years: 5, months: 0, days: 1 }, points: 20 },
  { minimum: { years: 5, months: 6, days: 1 }, points: 21 },
  { minimum: { years: 6, months: 0, days: 1 }, points: 22 },
  { minimum: { years: 6, months: 6, days: 1 }, points: 23 },
  { minimum: { years: 7, months: 0, days: 0 }, points: 25 },
];

const SENIORITY_ROWS_30: PromotionScorePolicy["seniorityRows"] = [
  { minimum: { years: 3, months: 0, days: 1 }, points: 15 },
  { minimum: { years: 3, months: 6, days: 1 }, points: 16 },
  { minimum: { years: 4, months: 0, days: 1 }, points: 17 },
  { minimum: { years: 4, months: 6, days: 1 }, points: 18 },
  { minimum: { years: 5, months: 0, days: 1 }, points: 20 },
  { minimum: { years: 5, months: 6, days: 1 }, points: 22 },
  { minimum: { years: 6, months: 0, days: 1 }, points: 24 },
  { minimum: { years: 6, months: 6, days: 1 }, points: 26 },
  { minimum: { years: 7, months: 0, days: 1 }, points: 28 },
  { minimum: { years: 7, months: 6, days: 1 }, points: 30 },
];

const COMMON_AWARDS: PromotionScorePolicy["awards"] = [
  { key: "medalya_ng_kagitingan", label: "Medalya ng Kagitingan", points: 10 },
  { key: "medalya_ng_kabayanihan", label: "Medalya ng Kabayanihan", points: 8 },
  { key: "medalya_ng_katapangan", label: "Medalya ng Katapangan", points: 5 },
  { key: "medalya_ng_kadakilaan", label: "Medalya ng Kadakilaan", points: 3 },
  { key: "medalya_ng_kagalingan", label: "Medalya ng Kagalingan", points: 3 },
  { key: "medalya_ng_sugat_na_magiting", label: "Medalya ng Sugatang Magiting", points: 2 },
  { key: "medalya_ng_papuri", label: "Medalya ng Papuri", points: 1 },
  { key: "medalya_ng_katapatan_sa_paglingkod", label: "Medalya ng Katapatan sa Paglilingkod", points: 5 },
  { key: "medalya_ng_katangi_tanging_gawa", label: "Medalya ng Katangi-tanging Gawa", points: 4 },
  { key: "medalya_ng_pambihirang_paglingkod", label: "Medalya ng Pambihirang Paglilingkod", points: 3 },
  { key: "medalya_ng_kasanayan", label: "Medalya ng Kasanayan", points: 2 },
  { key: "medalya_ng_paglingkod", label: "Medalya ng Paglilingkod", points: 3 },
  { key: "medalya_ng_mabuting_asal", label: "Medalya ng Mabuting Asal", points: 2 },
  { key: "medalya_ng_pagtulong_sa_nasalanta", label: "Medalya ng Pagtulong sa Nasalanta", points: 2 },
  { key: "tsapa_ng_natatanging_yunit", label: "Tsapa ng Natatanging Yunit", points: 1 },
  { key: "medalya_ng_ugnayang_pampublisya", label: "Medalya ng Ugnayang Pampublisya", points: 1 },
  { key: "medalya_ng_paglingkod_sa_luzon_visayas_mindanao", label: "Medalya ng Paglilingkod sa Luzon/Visayas/Mindanao", points: 1 },
  { key: "tsapa_ng_kwalipikasyon", label: "Mga Tsapa ng Kwalipikasyon", points: 0.5 },
  { key: "commendation", label: "Commendations", points: 0.2 },
];

const IPER_PAIRS: PromotionScorePolicy["iperPairs"] = [
  { ratings: ["Outstanding", "Outstanding"], points: 5 },
  { ratings: ["Outstanding", "Very Satisfactory"], points: 3.5 },
  { ratings: ["Very Satisfactory", "Very Satisfactory"], points: 2 },
];

const FIELD_AND_ADMIN_ASSIGNMENTS: PromotionScorePolicy["assignmentRows"] = [
  { key: "field_or_quad", label: "Field Duty/QUAD Staff", pointsPerSixMonths: 1, cap: 10 },
  { key: "administrative", label: "Administrative Duty", pointsPerSixMonths: 1, cap: 10 },
];

const ASSIGNMENTS_WITH_GEOGRAPHY: PromotionScorePolicy["assignmentRows"] = [
  ...FIELD_AND_ADMIN_ASSIGNMENTS,
  { key: "geographic_luzon_visayas", label: "Geographical Assignment (Luzon or Visayas)", pointsPerSixMonths: 0.75, cap: 1.5, regions: ["Luzon", "Visayas"] },
  { key: "geographic_mindanao", label: "Geographical Assignment (Mindanao)", pointsPerSixMonths: 1, cap: 2, regions: ["Mindanao"] },
];

/** Complete, immutable transcription of Final Revisions.pdf pp. 18–20. */
export const PROMOTION_SCORECARD_POLICIES: Record<PromotionScoreBand, PromotionScorePolicy> = {
  "PCPL-PMSG": {
    allocation: { seniority: 30, assignment: 20, awards: 10, iper: 5, board: 15, reputation: 20 },
    seniorityRows: SENIORITY_ROWS_30,
    assignmentRows: FIELD_AND_ADMIN_ASSIGNMENTS,
    awards: COMMON_AWARDS,
    iperPairs: IPER_PAIRS,
  },
  "PSMS-PEMS": {
    allocation: { seniority: 25, assignment: 25, awards: 10, iper: 5, board: 10, reputation: 25 },
    seniorityRows: SENIORITY_ROWS_25,
    assignmentRows: ASSIGNMENTS_WITH_GEOGRAPHY,
    awards: COMMON_AWARDS,
    iperPairs: IPER_PAIRS,
  },
  "PLT-PLTCOL": {
    allocation: { seniority: 25, assignment: 25, awards: 10, iper: 5, board: 10, reputation: 25 },
    seniorityRows: SENIORITY_ROWS_25,
    assignmentRows: ASSIGNMENTS_WITH_GEOGRAPHY,
    awards: COMMON_AWARDS,
    iperPairs: IPER_PAIRS,
  },
};

/** Eligibility is required for every band (client chat clarification); its rating is shown, not scored. */
const ELIGIBILITY_REQUIREMENT = {
  label: "Eligibility",
  detail: "Required: appropriate eligibility (e.g. NAPOLCOM) with rating. Qualifying requirement, not scored.",
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
    qualifyingRequirements: [ELIGIBILITY_REQUIREMENT],
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
    qualifyingRequirements: [ELIGIBILITY_REQUIREMENT],
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
    qualifyingRequirements: [ELIGIBILITY_REQUIREMENT],
  },
];
