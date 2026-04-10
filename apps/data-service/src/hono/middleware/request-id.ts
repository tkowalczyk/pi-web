import type { MiddlewareHandler } from "hono";

const HEADER = "X-Request-Id";

declare module "hono" {
	interface ContextVariableMap {
		requestId: string;
	}
}

export function requestId(): MiddlewareHandler {
	return async (c, next) => {
		const id = c.req.header(HEADER) || crypto.randomUUID();
		c.set("requestId", id);
		await next();
		c.header(HEADER, id);
	};
}
