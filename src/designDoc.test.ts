import { describe, expect, it } from "vitest";
import { DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN, normalizeDesignDoc, parseDesignDoc } from "./designDoc";

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
  it("lists canonical ## headings and forbids generic substitutes", () => {
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("## Overview");
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("## Colors");
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("## Elevation & depth");
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("version: alpha");
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("## Color Palette");
    expect(DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN).toContain("Forbidden inside");
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
