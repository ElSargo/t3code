import { describe, expect, it } from "vitest";

import { parseCodexModelListResult } from "./codexModels";

describe("parseCodexModelListResult", () => {
  it("parses visible app-server models into provider models", () => {
    expect(
      parseCodexModelListResult({
        data: [
          {
            id: "gpt-5.3-codex",
            displayName: "gpt-5.3-codex",
            hidden: false,
            supportedReasoningEfforts: [
              { reasoningEffort: "low" },
              { reasoningEffort: "medium" },
              { reasoningEffort: "high" },
            ],
            defaultReasoningEffort: "medium",
          },
          {
            id: "hidden-model",
            displayName: "Hidden",
            hidden: true,
            supportedReasoningEfforts: [{ reasoningEffort: "low" }],
            defaultReasoningEffort: "low",
          },
        ],
      }),
    ).toEqual([
      {
        slug: "gpt-5.3-codex",
        name: "gpt-5.3-codex",
        isCustom: false,
        capabilities: {
          reasoningEffortLevels: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium", isDefault: true },
            { value: "high", label: "High" },
          ],
          supportsFastMode: true,
          supportsThinkingToggle: false,
          contextWindowOptions: [],
          promptInjectedEffortLevels: [],
        },
      },
    ]);
  });
});
