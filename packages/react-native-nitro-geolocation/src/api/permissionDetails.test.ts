import { describe, expect, it } from "vitest";
import { buildPermissionDetails } from "./permissionDetails";

describe("buildPermissionDetails", () => {
  it("reports full background scope on iOS Always permission", () => {
    expect(
      buildPermissionDetails({
        platform: "ios",
        foreground: "granted",
        background: "granted",
        accuracy: "full"
      })
    ).toEqual({
      status: "granted",
      scope: "background",
      accuracy: "full",
      canAskAgain: false,
      settingsGuidance: "none"
    });
  });

  it("reports reduced foreground scope on iOS When In Use permission", () => {
    expect(
      buildPermissionDetails({
        platform: "ios",
        foreground: "granted",
        background: "denied",
        accuracy: "reduced"
      })
    ).toEqual({
      status: "granted",
      scope: "foreground",
      accuracy: "reduced",
      canAskAgain: false,
      settingsGuidance: "none"
    });
  });

  it("keeps the iOS first prompt actionable without opening settings", () => {
    expect(
      buildPermissionDetails({
        platform: "ios",
        foreground: "undetermined",
        background: "undetermined",
        accuracy: "unknown"
      })
    ).toEqual({
      status: "undetermined",
      scope: "none",
      accuracy: "unknown",
      canAskAgain: true,
      settingsGuidance: "requestPermission"
    });
  });

  it("directs an iOS denial to app settings", () => {
    expect(
      buildPermissionDetails({
        platform: "ios",
        foreground: "denied",
        background: "denied",
        accuracy: "full"
      })
    ).toEqual({
      status: "denied",
      scope: "none",
      accuracy: "unknown",
      canAskAgain: false,
      settingsGuidance: "reviewSettings"
    });
  });

  it("does not claim settings can remove an iOS managed restriction", () => {
    expect(
      buildPermissionDetails({
        platform: "ios",
        foreground: "restricted",
        background: "restricted",
        accuracy: "reduced"
      })
    ).toMatchObject({
      status: "restricted",
      scope: "none",
      accuracy: "unknown",
      canAskAgain: false,
      settingsGuidance: "managedRestriction"
    });
  });

  it("reports Android coarse permission as reduced foreground scope", () => {
    expect(
      buildPermissionDetails({
        platform: "android",
        foreground: "granted",
        background: "denied",
        accuracy: "reduced"
      })
    ).toMatchObject({
      status: "granted",
      scope: "foreground",
      accuracy: "reduced",
      canAskAgain: false,
      settingsGuidance: "none"
    });
  });

  it("reports Android fine background permission without remediation", () => {
    expect(
      buildPermissionDetails({
        platform: "android",
        foreground: "granted",
        background: "granted",
        accuracy: "full"
      })
    ).toMatchObject({
      status: "granted",
      scope: "background",
      accuracy: "full",
      canAskAgain: false,
      settingsGuidance: "none"
    });
  });

  it("preserves Android first-run and permanent-denial ambiguity", () => {
    expect(
      buildPermissionDetails({
        platform: "android",
        foreground: "denied",
        background: "denied",
        accuracy: "unknown"
      })
    ).toEqual({
      status: "denied",
      scope: "none",
      accuracy: "unknown",
      canAskAgain: null,
      settingsGuidance: "requestPermissionOrReviewSettings"
    });
  });

  it("reports a normal Android denial as requestable when rationale is available", () => {
    expect(
      buildPermissionDetails({
        platform: "android",
        foreground: "denied",
        background: "denied",
        accuracy: "unknown",
        canAskAgain: true
      })
    ).toEqual({
      status: "denied",
      scope: "none",
      accuracy: "unknown",
      canAskAgain: true,
      settingsGuidance: "requestPermission"
    });
  });

  it("reports an unsupported Web environment without implying a prompt", () => {
    expect(
      buildPermissionDetails({
        platform: "web",
        foreground: "denied",
        background: "unsupported",
        accuracy: "unknown",
        environmentSupported: false
      })
    ).toEqual({
      status: "denied",
      scope: "none",
      accuracy: "unknown",
      canAskAgain: false,
      settingsGuidance: "useSupportedEnvironment"
    });
  });
});
