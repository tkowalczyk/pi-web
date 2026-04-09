import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

	it("has a Taze config at the repo root", () => {
		expect(existsSync(repoPath("taze.config.ts"))).toBe(true);
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

describe("M1-P2: GitHub Actions workflows", () => {
	it("has a CI workflow that gates every pull request", () => {
		expect(existsSync(repoPath(".github/workflows/ci.yml"))).toBe(true);
	});

	it("has a stage deploy workflow that runs on merge to main", () => {
		expect(existsSync(repoPath(".github/workflows/deploy-stage.yml"))).toBe(true);
	});

	it("has a prod deploy workflow guarded by manual approval", () => {
		expect(existsSync(repoPath(".github/workflows/deploy-prod.yml"))).toBe(true);
	});
});
