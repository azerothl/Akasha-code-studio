import { describe, expect, it } from "vitest";
import { bufferDirty, filterPaths, markBufferSaved, searchTextFiles, upsertBuffer } from "./editorSession";
import { resolveDeliveryFocus } from "./deliveryCycle";
import { buildForkNodes } from "./forkTree";
import { parseAtFileRefs, redactSecrets, summarizeSendContext } from "./sendContext";
import { classifyReviewChecks } from "./taskReviewModel";

describe("delivery cycle", () => {
  it("points to project creation when nothing is loaded", () => {
    const focus = resolveDeliveryFocus({
      hasProject: false,
      taskRunning: false,
      taskFinished: false,
      dirty: false,
      hasEvolution: false,
      verifyRan: false,
    });
    expect(focus.current).toBe("ask");
    expect(focus.next).toMatch(/projet/i);
  });

  it("follows a running task, then review, then merge", () => {
    expect(
      resolveDeliveryFocus({
        hasProject: true,
        taskRunning: true,
        taskFinished: false,
        dirty: false,
        hasEvolution: false,
        verifyRan: false,
      }).current,
    ).toBe("follow");
    expect(
      resolveDeliveryFocus({
        hasProject: true,
        taskRunning: false,
        taskFinished: true,
        dirty: true,
        hasEvolution: true,
        verifyRan: false,
      }).current,
    ).toBe("review");
    expect(
      resolveDeliveryFocus({
        hasProject: true,
        taskRunning: false,
        taskFinished: true,
        dirty: false,
        hasEvolution: true,
        verifyRan: true,
      }).current,
    ).toBe("merge");
  });
});

describe("editor session", () => {
  it("keeps independent dirty state and filters paths", () => {
    const saved = { path: "src/a.ts", text: "one", savedText: "one", binary: false };
    const dirty = upsertBuffer([saved], { ...saved, text: "two" });
    expect(bufferDirty(dirty[0])).toBe(true);
    expect(filterPaths(["src/a.ts", "README.md"], "read")).toEqual(["README.md"]);
    expect(searchTextFiles([{ path: "src/a.ts", text: "alpha\nbeta" }], "beta")).toEqual([
      { path: "src/a.ts", line: 2, text: "beta" },
    ]);
  });
});

describe("send context", () => {
  it("resolves file refs and hides secrets", () => {
    expect(parseAtFileRefs("voir @src/app.ts et @src/app.ts")).toEqual(["src/app.ts"]);
    expect(redactSecrets("token: sk-live-123")).toBe("token: [masqué]");
    const summary = summarizeSendContext({
      message: "lis @src/app.ts et @missing.ts",
      files: ["src/app.ts"],
      includeFileRefs: true,
      includeCriteria: true,
      criteriaRaw: "api_key: secret-value",
      includeDesign: false,
      includePolicy: true,
      policyHint: "",
      agent: "studio_frontend",
      codeMode: "implement",
      modelLabel: "",
      providerLabel: "",
      permissionMode: "ask_me",
      ragStatus: null,
      ragError: "down",
    });
    expect(summary.fileRefs).toEqual([
      { path: "src/app.ts", available: true },
      { path: "missing.ts", available: false },
    ]);
    expect(summary.criteriaPreview).toContain("[masqué]");
    expect(summary.criteriaPreview).not.toContain("secret-value");
    expect(summary.designIncluded).toBe(false);
    expect(summary.ragLabel).toBe("Index indisponible");
    expect(summary.permissionMode).toBe("ask_me");
  });
});

describe("fork tree", () => {
  it("keeps parent and child without dropping either task", () => {
    const nodes = buildForkNodes(
      [
        { role: "user", text: "première demande", task_id: "parent" },
        {
          role: "user",
          text: "autre direction",
          task_id: "child",
          fork_parent_task_id: "parent",
          fork_cut_index: 0,
        },
      ],
      [{ event_type: "session_fork_created", task_id: "child", payload: { fork_parent_task_id: "parent", fork_cut_index: 0 } }],
      "child",
    );
    expect(nodes.map((node) => node.taskId).sort()).toEqual(["child", "parent"]);
    expect(nodes.find((node) => node.taskId === "child")).toMatchObject({
      parentTaskId: "parent",
      cutIndex: 0,
      active: true,
    });
  });
});

describe("task review checks", () => {
  it("does not treat a proposed command as execution evidence or a nonzero exit as success", () => {
    expect(classifyReviewChecks({ progress: ["À faire : npm run test"], missingManual: [], buildLog: "" })[0].state).toBe("not_run");
    expect(classifyReviewChecks({ progress: [], missingManual: [], buildLog: "Code de sortie: 17" })[0].state).toBe("failed");
  });
  it("separates executed, failed, manual and not-run checks", () => {
    expect(classifyReviewChecks({ progress: [], missingManual: [], buildLog: "" })[0].state).toBe("not_run");
    const mixed = classifyReviewChecks({
      progress: ["verify command_ok exit code 0"],
      missingManual: ["relire le texte"],
      buildLog: "npm run build failed",
    });
    expect(mixed.map((row) => row.state)).toEqual(["executed", "failed", "manual"]);
  });
});

it("keeps text typed while a save is in flight as a dirty draft", () => {
  const buffers = [{ path: "app.ts", text: "newer text", savedText: "old text", binary: false }];
  const saved = markBufferSaved(buffers, "app.ts", "sent text");
  expect(saved[0].text).toBe("newer text");
  expect(saved[0].savedText).toBe("sent text");
  expect(bufferDirty(saved[0])).toBe(true);
});

it("redacts headers, quoted secrets, provider tokens and URL credentials", () => {
  const output = redactSecrets('Authorization: Bearer my-secret\npassword="two words" token=hf_123456789abcdef https://user:pwd@example.test');
  for (const value of ["my-secret", "two words", "hf_123456789abcdef", "user:pwd"]) expect(output).not.toContain(value);
  expect(output).toContain("[masqué]");
});
