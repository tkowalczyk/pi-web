import { env } from "cloudflare:workers";
import { Hono } from "hono";

export const app = new Hono<{ Bindings: Env }>();

app.get("/worker/:id", (c) =>
  c.json({
    name: "powiadomienia-info Worker",
    version: "0.0.1",
    description: "Simple notification service on top of Cloudflare Workers",
    id: c.req.param("id"),
    var: env.MY_VAR
  }),
);
