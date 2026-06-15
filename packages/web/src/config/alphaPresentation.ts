/** Deployed alpha — hide internal tooling and unsafe affordances in production builds. */
export function isDeployedAlpha(): boolean {
  return import.meta.env.PROD;
}

/** Interaction attachments use unauthenticated /api/uploads in the API — hide in deployed alpha. */
export function showInteractionAttachments(): boolean {
  return !import.meta.env.PROD;
}