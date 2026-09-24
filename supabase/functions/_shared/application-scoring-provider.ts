import { z } from "npm:zod@^4.4.3";
import { prepareApplicationDocuments, type ApplicationDocumentInput } from "./application-document-analysis.ts";

export type ApplicationScoringInput = {
  cvText: string;
  criteria: Array<{ kind: string; requirement: string; isRequired: boolean }>;
};

export type ApplicationScoringResult = {
  score: number;
  explanation: string;
  provider: "gemini";
  model: string;
  modelVersion: string;
};

export type { ApplicationDocumentInput } from "./application-document-analysis.ts";

// gemini-2.5 models are restricted to accounts that used them before; 3.5 Flash-Lite is the
// current stable low-cost model (https://ai.google.dev/gemini-api/docs/models).
const MODEL = "gemini-3.5-flash-lite";
const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

const responseSchema = z.object({
  score: z.number().int().min(0).max(100),
  explanation: z.string().trim().min(1).max(4000),
});

export class GeminiApplicationScoringProvider {
  constructor(private readonly apiKey: string, private readonly fetcher: typeof fetch = fetch) {}

  async score(input: ApplicationScoringInput): Promise<ApplicationScoringResult> {
    const response = await this.fetcher(INTERACTIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        model: MODEL,
        store: false,
        input: `Evaluate this approved anonymized CV text against the job criteria. Return only the requested JSON.\nCV:\n${input.cvText}\nCriteria:\n${JSON.stringify(input.criteria)}`,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: { type: "object", properties: { score: { type: "integer" }, explanation: { type: "string" } }, required: ["score", "explanation"] },
        },
      }),
    }).catch(() => { throw new Error("provider_unavailable"); });
    return readRecommendation(response);
  }

  async analyzeDocuments(input: {
    documents: ApplicationDocumentInput[];
    criteria: ApplicationScoringInput["criteria"];
  }): Promise<ApplicationScoringResult> {
    const documents = prepareApplicationDocuments(input.documents);
    const response = await this.fetcher(INTERACTIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        model: MODEL,
        store: false,
        input: [
          ...documents.map((document) => ({
            type: document.mimeType === "application/pdf" ? "document" : "image",
            mime_type: document.mimeType,
            data: btoa(Array.from(document.bytes, (byte) => String.fromCharCode(byte)).join("")),
          })),
          {
            type: "text",
            text: `OCR the submitted CV and credentials, then evaluate only against these job criteria. Return only the requested JSON. Criteria: ${JSON.stringify(input.criteria)}`,
          },
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: { type: "object", properties: { score: { type: "integer" }, explanation: { type: "string" } }, required: ["score", "explanation"] },
        },
      }),
    }).catch(() => { throw new Error("provider_unavailable"); });
    return readRecommendation(response);
  }
}

type InteractionBody = {
  output_text?: unknown;
  steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: unknown }> }>;
};

/** The model's text: the documented `output_text`, or else the last model_output step's text parts. */
function outputText(body: InteractionBody | null) {
  if (typeof body?.output_text === "string") return body.output_text;
  const step = body?.steps?.filter((candidate) => candidate.type === "model_output").at(-1);
  const text = step?.content?.filter((part) => part.type === "text" && typeof part.text === "string").map((part) => part.text).join("");
  return text || null;
}

async function readRecommendation(response: Response): Promise<ApplicationScoringResult> {
  if (!response.ok) {
    // Gemini error bodies describe the request problem (model, quota, key); they never echo documents.
    const detail = await response.text().catch(() => "");
    console.error(`Gemini request failed with HTTP ${response.status}: ${detail.slice(0, 500)}`);
    throw new Error("provider_unavailable");
  }
  const text = outputText(await response.json().catch(() => null) as InteractionBody | null);
  let output: unknown = null;
  try { output = text ? JSON.parse(text) : null; } catch { throw new Error("provider_invalid_response"); }
  const parsed = responseSchema.safeParse(output);
  if (!parsed.success) throw new Error("provider_invalid_response");
  return { ...parsed.data, provider: "gemini", model: MODEL, modelVersion: "v1beta" };
}
