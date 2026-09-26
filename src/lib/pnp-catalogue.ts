/**
 * Philippine National Police (PNP) reference values offered as dropdown choices
 * wherever HR records or requires a qualification, so the same wording is used
 * everywhere. Promotion checks match credentials by name, which is why the
 * personnel record forms and the promotion criteria share these lists.
 *
 * The database keeps these columns as free text, so any saved value that is no
 * longer listed is still shown as its own choice (see `withSavedValue`).
 */

export const PNP_QUALIFICATIONS = [
  "Baccalaureate Degree",
  "Master's Degree",
  "Doctorate Degree",
  "Registered Criminologist (RCrim) Licensure",
  "NAPOLCOM Police Entrance Examination",
  "NAPOLCOM Promotional Examination – Police Officer",
  "NAPOLCOM Promotional Examination – Senior Police Officer",
  "NAPOLCOM Promotional Examination – Police Inspector",
  "NAPOLCOM Promotional Examination – Police Superintendent",
  "CSC Professional Eligibility",
  "RA 1080 Board or Bar Eligibility",
  "RA 6506 (Licensed Criminologist) Eligibility",
  "PD 907 (Honor Graduate) Eligibility",
] as const;

export const PNP_CERTIFICATIONS = [
  "Firearms Proficiency Certification",
  "Marksmanship Qualification",
  "Basic Life Support and First Aid Certification",
  "Explosive Ordnance Disposal (EOD) Certification",
  "K9 Handler Certification",
  "SWAT Operations Certification",
  "Cybercrime Investigator Certification",
  "Scene of the Crime Operations (SOCO) Certification",
  "Professional Driver's License",
  "Drug Test Clearance",
  "Neuro-Psychiatric Examination Clearance",
  "Physical Fitness Test Clearance",
] as const;

export const PNP_TRAININGS = [
  "Public Safety Basic Recruit Course (PSBRC)",
  "Field Training Program (FTP)",
  "Public Safety Junior Leadership Course (PSJLC)",
  "Public Safety Senior Leadership Course (PSSLC)",
  "Public Safety Officer Candidate Course (PSOCC)",
  "Public Safety Officer Basic Course (PSOBC)",
  "Public Safety Officers Advance Course (PSOAC)",
  "Public Safety Officers Senior Executive Course (PSOSEC)",
  "Criminal Investigation Course (CIC)",
  "Basic Intelligence Course (BIC)",
  "Traffic Management and Investigation Course",
  "Anti-Illegal Drugs Operations Course",
  "Women and Children Protection Desk Course",
  "Human Rights Education Course",
  "Basic Internal Security Operations Course (BISOC)",
  "Special Action Force Commando Course",
  "Police Community Relations Course",
] as const;

/** Schools and bodies that award qualifications. */
export const PNP_INSTITUTIONS = [
  "Philippine National Police Academy (PNPA)",
  "Philippine Public Safety College (PPSC)",
  "National Police Commission (NAPOLCOM)",
  "Professional Regulation Commission (PRC)",
  "Civil Service Commission (CSC)",
  "State University or College",
  "Private College or University",
] as const;

/** Agencies that issue certifications. */
export const PNP_ISSUERS = [
  "PNP Directorate for Human Resource and Doctrine Development (DHRDD)",
  "PNP Training Service",
  "PNP Health Service",
  "PNP Crime Laboratory",
  "PNP Explosive Ordnance Disposal and Canine Group",
  "PNP Anti-Cybercrime Group",
  "PNP Firearms and Explosives Office",
  "Land Transportation Office (LTO)",
  "Philippine Red Cross",
] as const;

/** Schools that run training courses. */
export const PNP_TRAINING_PROVIDERS = [
  "National Police Training Institute (NPTI)",
  "Regional Training Center",
  "Philippine National Police Academy (PNPA)",
  "Philippine Public Safety College (PPSC)",
  "PNP Training Service",
  "Special Action Force Training School",
  "PNP Directorate for Intelligence",
  "Commission on Human Rights",
] as const;

export const PNP_FIELDS_OF_STUDY = [
  "Criminology",
  "Criminal Justice",
  "Public Administration",
  "Public Safety Administration",
  "Law",
  "Psychology",
  "Political Science",
  "Information Technology",
  "Engineering",
  "Nursing",
  "Education",
  "Business Administration",
] as const;

/** Job-opening qualification criteria, grouped by criterion type. */
export const PNP_JOB_CRITERIA = {
  education: [
    "Baccalaureate degree from a recognized institution",
    "Baccalaureate degree in Criminology",
    "Master's degree in Public Administration or related field",
    "Completed at least 72 units of college education",
  ],
  eligibility: [
    "NAPOLCOM Police Entrance Examination passer",
    "CSC Professional Eligibility",
    "RA 6506 (Licensed Criminologist) Eligibility",
    "RA 1080 Board or Bar Eligibility",
    "PD 907 (Honor Graduate) Eligibility",
    "Filipino citizen of good moral character",
    "21 to 30 years old at the time of appointment",
    "Height of at least 1.57 m (male) or 1.52 m (female)",
    "Passed the neuro-psychiatric, medical, and drug tests",
    "No pending criminal or administrative case",
  ],
  experience: [
    "No experience required",
    "At least 1 year of police service",
    "At least 2 years of police service",
    "At least 3 years in investigation or detective work",
    "At least 5 years of police service",
    "Prior assignment in patrol or community policing",
  ],
  skill: [
    "Firearms handling and marksmanship",
    "Report and blotter writing",
    "Basic computer and records management",
    "Traffic direction and control",
    "Crime scene preservation",
    "Community relations and public communication",
    "Physically fit (passed the Physical Fitness Test)",
  ],
  certification: [...PNP_CERTIFICATIONS, ...PNP_TRAININGS],
  other: [
    "Willing to be assigned anywhere in the region",
    "Willing to render shift and holiday duty",
    "Valid driver's license",
  ],
} as const satisfies Record<string, readonly string[]>;

export type PnpJobCriterionKind = keyof typeof PNP_JOB_CRITERIA;

/** Credential names a promotion criterion can require, by personnel record type. */
export const PNP_CREDENTIALS_BY_KIND = {
  qualification: PNP_QUALIFICATIONS,
  certification: PNP_CERTIFICATIONS,
  training: PNP_TRAININGS,
} as const;

/** Minimum years of service choices for promotion criteria. */
export const SERVICE_YEAR_CHOICES = Array.from({ length: 31 }, (_, years) => years);

/** The listed choices, with a saved value that is no longer listed kept first. */
export function withSavedValue(choices: readonly string[], saved: string | null | undefined): string[] {
  return saved && !choices.some((choice) => choice.toLowerCase() === saved.toLowerCase()) ? [saved, ...choices] : [...choices];
}
