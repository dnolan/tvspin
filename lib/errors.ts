export function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const code = "code" in error ? String(error.code) : null;
    const message = "message" in error ? String(error.message) : "Unknown Firebase error";
    return code ? `${code}: ${message}` : message;
  }
  return String(error);
}
