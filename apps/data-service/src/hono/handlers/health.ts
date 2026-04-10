import type { Handler } from "hono";
import { createLogger } from "../utils/logger";

export const healthHandler: Handler = (c) => {
	const logger = createLogger(c.get("requestId"));
	logger.info("health check", { handler: "health" });

	return c.json({
		name: "powiadomienia.info Worker",
		version: "0.0.1",
		description: "powiadomienia.info backend worker",
	});
};
