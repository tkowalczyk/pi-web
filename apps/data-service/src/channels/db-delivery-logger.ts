import type { DeliveryLogger } from "./telegram";
import { insertDeliveryLog, insertDeliveryFailure } from "@repo/data-ops/queries/delivery";

export class DbDeliveryLogger implements DeliveryLogger {
	logDelivery(entry: {
		sourceId: number;
		channel: string;
		status: string;
		error?: string;
		retryCount: number;
	}): void {
		insertDeliveryLog(entry).catch(() => {
			// fire-and-forget: delivery logging must not break the send path
		});
	}

	logFailure(entry: {
		sourceId: number;
		channel: string;
		error: string;
		retryCount: number;
		payload: Record<string, unknown>;
	}): void {
		insertDeliveryFailure(entry).catch(() => {
			// fire-and-forget: failure logging must not break the send path
		});
	}
}
