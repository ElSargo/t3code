import { describe, expect, it } from "vitest";

import { buildCodexDiscoverySnapshot } from "./codexAppServer";

describe("buildCodexDiscoverySnapshot", () => {
  it("defaults models to an empty list when model/list is unavailable", () => {
    expect(
      buildCodexDiscoverySnapshot({
        account: {
          type: "chatgpt",
          planType: "unknown",
          sparkEnabled: false,
        },
        skills: [],
      }),
    ).toEqual({
      account: {
        type: "chatgpt",
        planType: "unknown",
        sparkEnabled: false,
      },
      skills: [],
      models: [],
    });
  });

  it("keeps reported models when model/list succeeds", () => {
    expect(
      buildCodexDiscoverySnapshot({
        account: {
          type: "chatgpt",
          planType: "prolite",
          sparkEnabled: true,
        },
        skills: [],
        models: [
          {
            slug: "gpt-5.3-codex-spark",
            name: "GPT-5.3 Codex Spark",
            isCustom: false,
            capabilities: {
              reasoningEffortLevels: [{ value: "high", label: "High", isDefault: true }],
              supportsFastMode: true,
              supportsThinkingToggle: false,
              contextWindowOptions: [],
              promptInjectedEffortLevels: [],
            },
          },
        ],
      }),
    ).toEqual({
      account: {
        type: "chatgpt",
        planType: "prolite",
        sparkEnabled: true,
      },
      skills: [],
      models: [
        {
          slug: "gpt-5.3-codex-spark",
          name: "GPT-5.3 Codex Spark",
          isCustom: false,
          capabilities: {
            reasoningEffortLevels: [{ value: "high", label: "High", isDefault: true }],
            supportsFastMode: true,
            supportsThinkingToggle: false,
            contextWindowOptions: [],
            promptInjectedEffortLevels: [],
          },
        },
      ],
    });
  });
});
