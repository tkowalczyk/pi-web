import { WorkerEntrypoint } from "cloudflare:workers";
import { app } from "@/hono/app";
import { initDatabase } from "@repo/data-ops/database/setup";
import { initStripe } from "@/stripe/client";
import { handleScheduled } from "./scheduled";
import { handleQueue } from "./queues";

export default class DataService extends WorkerEntrypoint<Env> {
  constructor(ctx: ExecutionContext, env: Env) {
		super(ctx, env)
		initDatabase({
      host: env.DATABASE_HOST,
      username: env.DATABASE_USERNAME,
      password: env.DATABASE_PASSWORD,
    })
		initStripe(env.STRIPE_SECRET_KEY);
	}
  fetch(request: Request) {
    return app.fetch(request, this.env, this.ctx);
  }

  async scheduled(controller: ScheduledController) {
    await handleScheduled(controller, this.env, this.ctx);
  }

  async queue(batch: MessageBatch<NotificationMessage>) {
    await handleQueue(batch, this.env);
  }
}
