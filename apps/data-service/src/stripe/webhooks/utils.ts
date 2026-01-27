export function logWebhookError(
  eventType: string,
  eventId: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  console.error(`[WEBHOOK ERROR] ${eventType}`, {
    eventId,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  });
}
