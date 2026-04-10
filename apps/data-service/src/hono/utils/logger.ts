export interface Logger {
	info(message: string, context?: Record<string, unknown>): void;
	warn(message: string, context?: Record<string, unknown>): void;
	error(message: string, context?: Record<string, unknown>): void;
}

export function createLogger(requestId: string): Logger {
	function log(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>) {
		const entry = JSON.stringify({
			level,
			requestId,
			message,
			timestamp: new Date().toISOString(),
			...context,
		});

		if (level === "error") {
			console.error(entry);
		} else if (level === "warn") {
			console.warn(entry);
		} else {
			console.log(entry);
		}
	}

	return {
		info: (message, context) => log("info", message, context),
		warn: (message, context) => log("warn", message, context),
		error: (message, context) => log("error", message, context),
	};
}
