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

  it("should use same schema for all environments", () => {
    expect(devConfig.schema).toEqual(stageConfig.schema);
    expect(stageConfig.schema).toEqual(prodConfig.schema);
  });
});
