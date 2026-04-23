import { describe, expect, it } from "vitest";
import atmosphericGlassDesignSample from "./fixtures/atmosphericGlassDesignSample.md?raw";
import {
  DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN,
  DESIGN_DOC_AGENT_STUDIO_HINT_COMPACT_EN,
  normalizeDesignDoc,
  parseDesignDoc,
} from "./designDoc";

const SAMPLE_FM = `version: alpha
name: Test
description: Example
colors:
  primary: "#111111"
  secondary: "#666666"
typography:
  body-md:
    fontFamily: "Inter"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: 4px
spacing:
  sm: 8px
components:
  button-primary:
    backgroundColor: "{ colors.primary }"
    textColor: "#ffffff"
    rounded: "{ rounded.sm }"
    padding: 12px
`;

function doc(body: string): string {
  return `---\n${SAMPLE_FM}\n---\n\n${body.trim()}\n`;
}

describe("parseDesignDoc", () => {
  it("flags duplicate canonical ## sections as error", () => {
    const r = parseDesignDoc(
      doc(`
## Overview
A

## Overview
B
`),
    );
    expect(r.diagnostics.some((d) => d.severity === "error" && d.path.includes("body.sections"))).toBe(true);
  });

  it("warns when canonical sections are out of order", () => {
    const r = parseDesignDoc(
      doc(`
## Typography
T

## Colors
C
`),
    );
    expect(r.diagnostics.some((d) => d.path === "body.section-order")).toBe(true);
  });

  it("preserves unknown ## headings without error", () => {
    const r = parseDesignDoc(
      doc(`
## Overview
O

## Release Notes
R
`),
    );
    expect(r.diagnostics.some((d) => d.severity === "error")).toBe(false);
  });
});

describe("DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN", () => {
  it("documents accepted ## aliases and forbids generic substitutes", () => {
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("## Brand & Style");
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("## Overview");
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("## Colors");
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("## Layout & Spacing");
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("## Elevation & depth");
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("version: alpha");
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("## Color Palette");
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("Forbidden inside");
  });
});

describe("DESIGN_DOC_AGENT_STUDIO_HINT_COMPACT_EN", () => {
  it("stays under daemon design-hint truncation budget", () => {
    expect(DESIGN_DOC_AGENT_STUDIO_HINT_COMPACT_EN.length).toBeGreaterThan(200);
    expect(DESIGN_DOC_AGENT_STUDIO_HINT_COMPACT_EN.length).toBeLessThan(4000);
  });
});

describe("reference DESIGN.md sample (Atmospheric Glass)", () => {
  it("parses without errors (aliases + full YAML)", () => {
    const r = parseDesignDoc(atmosphericGlassDesignSample);
    expect(r.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(r.tokens.name).toBe("Atmospheric Glass");
    expect(r.tokens.colors.primary).toBe("#ffffff");
    expect(r.tokens.typographyKeys).toContain("display-lg");
    expect(r.tokens.components["button-primary"]).toEqual(
      expect.arrayContaining(["backgroundColor", "textColor", "typography", "rounded", "height", "padding"]),
    );
  });
});

describe("normalizeDesignDoc", () => {
  it("normalizes token ref spacing and reorders known sections", () => {
    const input = doc(`
## Components
C

## Colors
Col

## Overview
Ov
`);
    const out = normalizeDesignDoc(input);
    expect(out).toContain('backgroundColor: "{colors.primary}"');
    const overviewIdx = out.indexOf("## Overview");
    const colorsIdx = out.indexOf("## Colors");
    const componentsIdx = out.indexOf("## Components");
    expect(overviewIdx).toBeGreaterThan(-1);
    expect(colorsIdx).toBeGreaterThan(overviewIdx);
    expect(componentsIdx).toBeGreaterThan(colorsIdx);
  });
});
