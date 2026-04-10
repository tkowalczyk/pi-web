import { cors } from "hono/cors";

export function createCorsMiddleware() {
	return cors({
		origin: (origin, c) => {
			const env = c.env.CLOUDFLARE_ENV;
			if (env === "dev") return origin;
			if (env === "stage" && origin === c.env.CLOUDFLARE_ENV_STAGE_ADDRESS) return origin;
			if (env === "prod" && origin === c.env.CLOUDFLARE_ENV_PROD_ADDRESS) return origin;
			return null;
		},
	});
}
