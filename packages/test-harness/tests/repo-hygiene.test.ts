import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";

/**
 * Repo-hygiene invariants that Phase M1-P2 (CI/CD regression gate) promises
 * to the rest of the project. These tests describe the *public interface*
 * that the rest of the monorepo relies on:
 *
 *   - Quality gates (Biome, Knip, Taze) are configured and runnable from root.
 *   - CI and deploy workflows exist in .github/workflows so every PR is gated
 *     and every merge produces a stage deploy + a gated prod deploy.
 *
 * Tests assert on file presence and package.json script names — not on the
 * internals of any config — so they survive config rewrites and tool swaps
 * as long as the contract holds.
 *
 * Repo root is resolved from this file's location rather than from cwd so
 * the test is stable under any working directory the runner chooses.
 */

const REPO_ROOT = resolve(__dirname, "../../..");

function repoPath(relative: string): string {
	return resolve(REPO_ROOT, relative);
}

function readRootPackageJson(): { scripts?: Record<string, string> } {
	const raw = readFileSync(repoPath("package.json"), "utf8");
	return JSON.parse(raw);
}

describe("M1-P2: quality gate configuration", () => {
	it("has a Biome config at the repo root", () => {
		expect(existsSync(repoPath("biome.json"))).toBe(true);
	});

	it("has a Knip config at the repo root", () => {
		expect(existsSync(repoPath("knip.json"))).toBe(true);
	});

	it("exposes lint, lint:ci, knip, deps, and types scripts from the root package", () => {
		const { scripts = {} } = readRootPackageJson();
		expect(scripts.lint).toBeDefined();
		expect(scripts["lint:ci"]).toBeDefined();
		expect(scripts.knip).toBeDefined();
		expect(scripts.deps).toBeDefined();
		expect(scripts.types).toBeDefined();
	});
});

describe("M1-P3: SaaS payment debt is purged", () => {
	const PAYMENT_TERMS = ["stripe", "blik", "subscription_plans", "webhook_events"];

	for (const term of PAYMENT_TERMS) {
		it(
			`has zero hits for "${term}" outside docs/archive/ and migrations/`,
			{ timeout: 15_000 },
			() => {
				const result = execSync(
					`grep -riw "${term}" --include="*.ts" --include="*.tsx" --include="*.json" -l "${REPO_ROOT}" || true`,
					{ encoding: "utf8" },
				);
				const hits = result
					.split("\n")
					.filter(Boolean)
					.filter((f) => !f.includes("docs/archive/"))
					.filter((f) => !f.includes("/migrations/"))
					.filter((f) => !f.includes("node_modules/"))
					.filter((f) => !f.includes("pnpm-lock.yaml"))
					.filter((f) => !f.includes("repo-hygiene.test.ts"))
					.filter((f) => !f.includes("/dist/"))
					.filter((f) => !f.includes(".vite/"))
					.filter((f) => !f.includes("worker-configuration.d.ts"))
					.filter((f) => !f.includes("routeTree.gen.ts"));
				expect(hits, `Files still referencing "${term}":\n${hits.join("\n")}`).toEqual([]);
			},
		);
	}

	it("has no stripe npm dependencies in any package.json", () => {
		const pkgPaths = [
			"apps/user-application/package.json",
			"apps/data-service/package.json",
			"packages/data-ops/package.json",
		];
		for (const p of pkgPaths) {
			const content = readFileSync(repoPath(p), "utf8");
			expect(content).not.toContain("stripe");
		}
	});

	it("has no payment-related query files in data-ops", () => {
		const removedFiles = [
			"packages/data-ops/src/queries/stripe-customer.ts",
			"packages/data-ops/src/queries/payment.ts",
			"packages/data-ops/src/queries/payments.ts",
			"packages/data-ops/src/queries/subscription.ts",
			"packages/data-ops/src/queries/webhook-events.ts",
		];
		for (const f of removedFiles) {
			expect(existsSync(repoPath(f)), `${f} should not exist`).toBe(false);
		}
	});

	it("has no payment-related frontend routes", () => {
		const removedPaths = [
			"apps/user-application/src/routes/_auth/app/pricing.tsx",
			"apps/user-application/src/routes/_auth/app/payment",
			"apps/user-application/src/routes/_auth/app/payment-success.tsx",
			"apps/user-application/src/routes/_auth/app/payment-cancel.tsx",
		];
		for (const f of removedPaths) {
			expect(existsSync(repoPath(f)), `${f} should not exist`).toBe(false);
		}
	});
});

describe("M1-P4: import boundary enforcement", () => {
	const FORBIDDEN_IMPORTS = [
		{
			pattern: "drizzle-orm",
			allowedIn: ["packages/data-ops/", "packages/test-harness/"],
			description: "drizzle-orm must only be imported inside data-ops and test-harness",
		},
		{
			pattern: "drizzle-orm/neon-http",
			allowedIn: ["packages/data-ops/", "packages/test-harness/"],
			description: "drizzle neon driver must only be imported inside data-ops and test-harness",
		},
	];

	for (const rule of FORBIDDEN_IMPORTS) {
		it(`enforces: ${rule.description}`, () => {
			const result = execSync(
				`grep -r "from \\"${rule.pattern}" --include="*.ts" --include="*.tsx" -l "${REPO_ROOT}" || true`,
				{ encoding: "utf8" },
			);
			const violations = result
				.split("\n")
				.filter(Boolean)
				.filter((f) => !f.includes("node_modules/"))
				.filter((f) => !f.includes("/dist/"))
				.filter((f) => !f.includes(".vite/"))
				.filter((f) => !rule.allowedIn.some((allowed) => f.includes(allowed)));

			expect(
				violations,
				`Import boundary violation for "${rule.pattern}":\n${violations.join("\n")}`,
			).toEqual([]);
		});
	}
});

describe("M1-P2: GitHub Actions workflows + manual deploy contract", () => {
	it("has a CI workflow that gates every pull request", () => {
		expect(existsSync(repoPath(".github/workflows/ci.yml"))).toBe(true);
	});

	it("exposes manual deploy:stage scripts for both apps", () => {
		const { scripts = {} } = readRootPackageJson();
		expect(scripts["deploy:stage:user-application"]).toBeDefined();
		expect(scripts["deploy:stage:data-service"]).toBeDefined();
	});

	it("exposes manual deploy:prod scripts for both apps", () => {
		const { scripts = {} } = readRootPackageJson();
		expect(scripts["deploy:prod:user-application"]).toBeDefined();
		expect(scripts["deploy:prod:data-service"]).toBeDefined();
	});
});

describe("M1-P8: stage + prod deploy readiness", () => {
	function readWranglerConfig(): Record<string, unknown> {
		const raw = readFileSync(repoPath("apps/data-service/wrangler.jsonc"), "utf8");
		return parseJsonc(raw);
	}

	it("has SchedulerDO durable object binding in base wrangler config", () => {
		const config = readWranglerConfig();
		const bindings = (
			config.durable_objects as { bindings: { name: string; class_name: string }[] }
		).bindings;
		expect(bindings).toContainEqual(
			expect.objectContaining({ name: "SCHEDULER", class_name: "SchedulerDO" }),
		);
	});

	it("has SchedulerDO durable object binding in stage environment", () => {
		const config = readWranglerConfig();
		const stage = (config.env as Record<string, Record<string, unknown>>).stage;
		const bindings = (stage.durable_objects as { bindings: { name: string; class_name: string }[] })
			.bindings;
		expect(bindings).toContainEqual(
			expect.objectContaining({ name: "SCHEDULER", class_name: "SchedulerDO" }),
		);
	});

	it("has SchedulerDO durable object binding in production environment", () => {
		const config = readWranglerConfig();
		const prod = (config.env as Record<string, Record<string, unknown>>).prod;
		const bindings = (prod.durable_objects as { bindings: { name: string; class_name: string }[] })
			.bindings;
		expect(bindings).toContainEqual(
			expect.objectContaining({ name: "SCHEDULER", class_name: "SchedulerDO" }),
		);
	});

	it(
		"has zero legacy tenant/SaaS terms outside archive and migrations",
		{ timeout: 15_000 },
		() => {
			const pattern = "saas-kit|saas_kit|multi-tenant|multi_tenant|organization_id|workspace_id";
			const result = execSync(
				`grep -riEw "${pattern}" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.jsonc" -l "${REPO_ROOT}" || true`,
				{ encoding: "utf8" },
			);
			const hits = result
				.split("\n")
				.filter(Boolean)
				.filter((f) => !f.includes("docs/archive/"))
				.filter((f) => !f.includes("/migrations/"))
				.filter((f) => !f.includes("node_modules/"))
				.filter((f) => !f.includes("pnpm-lock.yaml"))
				.filter((f) => !f.includes("repo-hygiene.test.ts"))
				.filter((f) => !f.includes("/dist/"))
				.filter((f) => !f.includes(".vite/"));
			expect(hits, `Files still referencing legacy terms:\n${hits.join("\n")}`).toEqual([]);
		},
	);

	it("docs/m1-retro.md exists and lists at least three back-port candidates", () => {
		const retroPath = repoPath("docs/m1-retro.md");
		expect(existsSync(retroPath), "docs/m1-retro.md must exist").toBe(true);
		const content = readFileSync(retroPath, "utf8");
		const candidateMatches = content.match(/^###?\s+.*back-?port|^###?\s+.*candidate|^-\s+\*\*/gim);
		expect(
			(candidateMatches?.length ?? 0) >= 3,
			"retro must list at least three concrete back-port candidates",
		).toBe(true);
	});

	it("docs/m1-retro.md references saas-on-cf-delta.md as baseline", () => {
		const content = readFileSync(repoPath("docs/m1-retro.md"), "utf8");
		expect(content).toContain("saas-on-cf-delta");
	});

	it("M2 stub PRD contains a pointer to the retro", () => {
		const content = readFileSync(repoPath("docs/prd-m2-notification-hub.md"), "utf8");
		expect(content).toContain("m1-retro");
	});
});
