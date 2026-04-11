// Legacy SMS notification scheduling removed in M2-P2.
// New notification delivery uses SchedulerDO + TelegramChannel.

export async function handleScheduled(
	_controller: ScheduledController,
	_env: Env,
	_ctx: ExecutionContext,
) {
	// No-op: legacy SMS cron disabled. SchedulerDO handles scheduling now.
	console.log("Cron triggered — legacy SMS scheduling removed, SchedulerDO active.");
}
