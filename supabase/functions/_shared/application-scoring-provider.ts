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

const responseSchema = z.object({
  score: z.number().int().min(0).max(100),
  explanation: z.string().trim().min(1).max(4000),
});

export class GeminiApplicationScoringProvider {
  constructor(private readonly apiKey: string, private readonly fetcher: typeof fetch = fetch) {}

  async score(input: ApplicationScoringInput): Promise<ApplicationScoringResult> {
    const response = await this.fetcher("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        store: false,
        input: `Evaluate this approved anonymized CV text against the job criteria. Return only the requested JSON.\nCV:\n${input.cvText}\nCriteria:\n${JSON.stringify(input.criteria)}`,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: { type: "object", properties: { score: { type: "integer" }, explanation: { type: "string" } }, required: ["score", "explanation"] },
        },
      }),
    }).catch(() => { throw new Error("provider_unavailable"); });
    if (!response.ok) throw new Error("provider_unavailable");
    const body = await response.json().catch(() => null) as { output_text?: unknown } | null;
    let output: unknown = null;
    try { output = typeof body?.output_text === "string" ? JSON.parse(body.output_text) : null; } catch { throw new Error("provider_invalid_response"); }
    const parsed = responseSchema.safeParse(output);
    if (!parsed.success) throw new Error("provider_invalid_response");
    return { ...parsed.data, provider: "gemini", model: "gemini-2.5-flash-lite", modelVersion: "v1beta" };
  }

  async analyzeDocuments(input: {
    documents: ApplicationDocumentInput[];
    criteria: ApplicationScoringInput["criteria"];
  }): Promise<ApplicationScoringResult> {
    const documents = prepareApplicationDocuments(input.documents);
    const response = await this.fetcher("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        store: false,
        input: [
          ...documents.map((document) => ({
            type: "document",
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
    if (!response.ok) throw new Error("provider_unavailable");
    const body = await response.json().catch(() => null) as { output_text?: unknown } | null;
    let output: unknown = null;
    try { output = typeof body?.output_text === "string" ? JSON.parse(body.output_text) : null; } catch { throw new Error("provider_invalid_response"); }
    const parsed = responseSchema.safeParse(output);
    if (!parsed.success) throw new Error("provider_invalid_response");
    return { ...parsed.data, provider: "gemini", model: "gemini-2.5-flash-lite", modelVersion: "v1beta" };
  }
}
