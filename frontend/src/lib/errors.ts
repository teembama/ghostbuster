import { ApiError } from "@/lib/api";

/** Map an unknown error to a user-facing message. */
export function friendlyApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return "Could not reach the server. Please check your connection and try again.";
    }
    if (err.status === 400) {
      // Use the actual detail from the backend (e.g. CSV validation messages).
      return err.detail || "The request was invalid. Please check your input.";
    }
    if (err.status === 404) {
      return "The requested data could not be found.";
    }
    if (err.status >= 500) {
      return "Something went wrong on our end. Please try again.";
    }
    return err.detail || `Request failed (${err.status}).`;
  }
  return "Something went wrong. Please try again.";
}

/** Friendly fallback for upload-flow errors specifically. */
export function friendlyUploadError(err: unknown): string {
  if (err instanceof ApiError && err.status === 400) {
    // Surface backend CSV validation message verbatim.
    return err.detail || "Upload failed. Please try again with a valid CSV file.";
  }
  if (err instanceof ApiError) return friendlyApiError(err);
  return "Upload failed. Please try again with a valid CSV file.";
}
