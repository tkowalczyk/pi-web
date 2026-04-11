// Legacy SMS queue consumer removed in M2-P2.
// New notification delivery uses SchedulerDO + TelegramChannel.

export async function handleQueue(batch: MessageBatch<unknown>, _env: Env) {
	// Ack all messages — legacy queue should be drained, not processed.
	for (const message of batch.messages) {
		console.log("Legacy queue message acked");
		message.ack();
	}
}
