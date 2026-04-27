export interface ImportOptions {
	file: string;
	householdId?: number;
	address?: string;
	year?: number;
	schedulerUrl?: string;
	dryRun: boolean;
}

export function parseImportArgs(argv: string[]): ImportOptions {
	const opts: Partial<ImportOptions> & { dryRun: boolean } = { dryRun: false };

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--file":
				opts.file = argv[++i];
				break;
			case "--household-id": {
				const raw = argv[++i];
				const n = Number(raw);
				if (!Number.isInteger(n) || n <= 0) {
					throw new Error(`Invalid --household-id "${raw}" — must be a positive integer`);
				}
				opts.householdId = n;
				break;
			}
			case "--address":
				opts.address = argv[++i];
				break;
			case "--year": {
				const raw = argv[++i];
				if (!/^\d{4}$/.test(raw ?? "")) {
					throw new Error(`Invalid --year "${raw}" — must be a 4-digit year`);
				}
				opts.year = Number(raw);
				break;
			}
			case "--scheduler-url":
				opts.schedulerUrl = argv[++i];
				break;
			case "--dry-run":
				opts.dryRun = true;
				break;
			default:
				throw new Error(`Unknown argument: ${arg}`);
		}
	}

	if (!opts.file) {
		throw new Error("Missing required --file flag");
	}

	return opts as ImportOptions;
}
