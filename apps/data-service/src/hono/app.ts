import { env } from "cloudflare:workers";
import { Hono } from "hono";

export const app = new Hono<{ Bindings: Env }>();

app.get("/worker", (c) =>
  c.json({
    name: "powiadomienia-info Worker",
    version: "0.0.1",
    description: "Simple notification service on top of Cloudflare Workers",
  }),
);
