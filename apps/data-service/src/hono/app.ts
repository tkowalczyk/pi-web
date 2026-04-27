import { Hono } from "hono";
import { requestId } from "./middleware/request-id";
import { errorHandler } from "./middleware/error-handler";
import { createCorsMiddleware } from "./middleware/cors";
import { rateLimit } from "./middleware/rate-limit";
import { healthHandler } from "./handlers/health";
import { sourcesApp } from "./handlers/sources";

export const app = new Hono<{ Bindings: Env }>();

// Global middleware stack
app.use("*", requestId());
app.onError(errorHandler);

// Public endpoint middleware
app.use("/worker/*", createCorsMiddleware());
app.use("/worker/*", rateLimit(100, 60_000));

// Routes
app.get("/worker/health", healthHandler);
app.route("/worker/sources", sourcesApp);
