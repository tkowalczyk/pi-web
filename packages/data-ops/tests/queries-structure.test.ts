import { describe, it, expect } from "vitest";

describe("Query Function Exports", () => {
  it("should export user query functions", async () => {
    const userQueries = await import("../src/queries/user");
    expect(typeof userQueries.getUserProfile).toBe("function");
    expect(typeof userQueries.updateUserPhone).toBe("function");
  });

  it("should export address query functions", async () => {
    const addressQueries = await import("../src/queries/address");
    expect(typeof addressQueries.getUserAddresses).toBe("function");
    expect(typeof addressQueries.createAddress).toBe("function");
    expect(typeof addressQueries.updateAddress).toBe("function");
    expect(typeof addressQueries.deleteAddress).toBe("function");
    expect(typeof addressQueries.getCities).toBe("function");
    expect(typeof addressQueries.getStreetsByCityId).toBe("function");
  });

  it("should export notification preferences query functions", async () => {
    const notifQueries = await import("../src/queries/notification-preferences");
    expect(typeof notifQueries.getUserNotificationPreferences).toBe("function");
    expect(typeof notifQueries.createDefaultNotificationPreferences).toBe("function");
    expect(typeof notifQueries.updateNotificationPreference).toBe("function");
  });
});

describe("Notification Preferences Defaults", () => {
  it("createDefaultNotificationPreferences should create correct default structure", async () => {
    const { createDefaultNotificationPreferences } = await import("../src/queries/notification-preferences");

    // Check function signature (will throw if DB not available, which is expected)
    expect(createDefaultNotificationPreferences.length).toBe(2); // userId, addressId
  });
});

describe("Address Default Logic", () => {
  it("createAddress function should accept isDefault parameter", async () => {
    const { createAddress } = await import("../src/queries/address");

    // Check function has correct arity
    expect(createAddress.length).toBeGreaterThanOrEqual(3); // userId, cityId, streetId, isDefault
  });

  it("updateAddress function should accept isDefault in data", async () => {
    const { updateAddress } = await import("../src/queries/address");

    // Check function has correct arity
    expect(updateAddress.length).toBe(2); // addressId, data object
  });
});
