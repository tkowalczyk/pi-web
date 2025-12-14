import { describe, it, expect } from "vitest";
import devConfig from "../drizzle-dev.config";
import stageConfig from "../drizzle-stage.config";
import prodConfig from "../drizzle-prod.config";

describe("Drizzle Config", () => {
  it("should have separate output paths per environment", () => {
    expect(devConfig.out).toBe("./src/drizzle/migrations/dev");
    expect(stageConfig.out).toBe("./src/drizzle/migrations/stage");
    expect(prodConfig.out).toBe("./src/drizzle/migrations/prod");
  });

  it("should use same schema files for all environments", () => {
    expect(Array.isArray(devConfig.schema)).toBe(true);
    expect(devConfig.schema).toEqual(stageConfig.schema);
    expect(stageConfig.schema).toEqual(prodConfig.schema);
  });

  it("should include all required schema files", () => {
    expect(devConfig.schema).toContain("./src/drizzle/auth-schema.ts");
    expect(devConfig.schema).toContain("./src/drizzle/schema.ts");
    expect(devConfig.schema).toContain("./src/drizzle/relations.ts");
  });
});
