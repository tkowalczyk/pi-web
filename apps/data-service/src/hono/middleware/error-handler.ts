import type { ErrorHandler } from "hono";

export class HttpError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "HttpError";
	}
}

export const errorHandler: ErrorHandler = (err, c) => {
	const requestId = c.get("requestId") ?? c.req.header("X-Request-Id") ?? "unknown";

	if (err instanceof HttpError) {
		return c.json({ error: err.message, status: err.status, requestId }, err.status as 400);
	}

	console.error(`[${requestId}] Unhandled error:`, err);

	return c.json({ error: "Internal Server Error", status: 500, requestId }, 500);
};
