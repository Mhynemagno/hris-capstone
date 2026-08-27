export type ApplicationDocumentInput = {
  fileName: string;
  mimeType: "application/pdf" | "image/png" | "image/jpeg";
  bytes: Uint8Array;
};

const supportedMimeTypes = new Set<ApplicationDocumentInput["mimeType"]>([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);
const MAX_DOCUMENTS = 10;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_ENCODED_BYTES = 24 * 1024 * 1024;

function encodedSize(bytes: number) {
  return Math.ceil(bytes / 3) * 4;
}

export function prepareApplicationDocuments(documents: ApplicationDocumentInput[]) {
  if (!documents.length || documents.length > MAX_DOCUMENTS) throw new Error("provider_invalid_response");
  let encodedBytes = 0;
  for (const document of documents) {
    if (!supportedMimeTypes.has(document.mimeType) || !document.fileName.trim() || !document.bytes.byteLength || document.bytes.byteLength > MAX_DOCUMENT_BYTES) {
      throw new Error("provider_invalid_response");
    }
    encodedBytes += encodedSize(document.bytes.byteLength);
    if (encodedBytes > MAX_ENCODED_BYTES) throw new Error("provider_invalid_response");
  }
  return documents;
}
