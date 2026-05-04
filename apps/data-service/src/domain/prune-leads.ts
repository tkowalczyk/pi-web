export interface PruneLeadsDeps {
	now(): Date;
	deleteLeadsOlderThan(cutoff: Date): Promise<number>;
}

export interface PruneLeadsResult {
	deletedCount: number;
}

export function computeLeadCutoff(now: Date): Date {
	const cutoff = new Date(now.getTime());
	cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
	return cutoff;
}

export async function pruneOldLeads(deps: PruneLeadsDeps): Promise<PruneLeadsResult> {
	const cutoff = computeLeadCutoff(deps.now());
	const deletedCount = await deps.deleteLeadsOlderThan(cutoff);
	return { deletedCount };
}
