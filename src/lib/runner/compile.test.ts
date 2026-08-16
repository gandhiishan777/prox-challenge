import { describe, expect, it } from "vitest";
import * as React from "react";

import { compileArtifact } from "./compile";

/**
 * The compiler is the seam every artifact passes through, so it is tested as a
 * pure function — no browser, no API key, no network.
 */

const scope = {
  react: { ...React, default: React },
  recharts: { LineChart: () => null, Line: () => null },
  "lucide-react": { Flame: () => null },
  "@/components/ui": { Card: () => null, Button: () => null },
};

describe("compileArtifact", () => {
  it("compiles JSX with a default export into a component", () => {
    const result = compileArtifact(
      `import React from "react";
       export default function Hello() { return <div>hi</div>; }`,
      scope,
    );
    expect(result.error).toBeUndefined();
    expect(typeof result.component).toBe("function");
  });

  it("supports hooks, TypeScript syntax and arrow-function components", () => {
    const result = compileArtifact(
      `import React, { useState } from "react";
       type Props = { label?: string };
       const C: React.FC<Props> = () => {
         const [n, setN] = useState<number>(0);
         return <button onClick={() => setN(n + 1)}>{n}</button>;
       };
       export default C;`,
      scope,
    );
    expect(result.error).toBeUndefined();
    expect(typeof result.component).toBe("function");
  });

  it("resolves any @/components/ui/* specifier onto the shared kit", () => {
    const result = compileArtifact(
      `import React from "react";
       import { Card } from "@/components/ui/card";
       import { Button } from "@/components/ui/button";
       export default () => <Card><Button /></Card>;`,
      scope,
    );
    expect(result.error).toBeUndefined();
  });

  it("reports a compile error with a line number for malformed syntax", () => {
    const result = compileArtifact(
      `export default function Broken() { return <div>unclosed; }`,
      scope,
    );
    expect(result.error?.phase).toBe("compile");
    expect(result.component).toBeUndefined();
  });

  it("rejects imports outside the allow-list and names what is available", () => {
    const result = compileArtifact(
      `import React from "react";
       import axios from "axios";
       export default () => <div>{typeof axios}</div>;`,
      scope,
    );
    expect(result.error?.phase).toBe("execute");
    expect(result.error?.message).toContain("axios");
    expect(result.error?.message).toContain("recharts");
  });

  it("rejects module names that are Object.prototype properties", () => {
    // `name in scope` walked the prototype chain, so require("constructor")
    // resolved to Object's machinery instead of failing like any other
    // unstocked module. The allow-list must mean own properties only.
    const result = compileArtifact(
      `import React from "react";
       const C = require("constructor");
       export default () => <div>{typeof C}</div>;`,
      scope,
    );
    expect(result.error?.phase).toBe("execute");
    expect(result.error?.message).toContain("constructor");
  });

  it("tolerates an unknown import that is never referenced", () => {
    // Sucrase elides unused imports, so a stray `import "axios"` that the
    // artifact never actually uses costs nothing. Failing here would reject
    // otherwise-working artifacts over a leftover import line.
    const result = compileArtifact(
      `import React from "react";
       import axios from "axios";
       export default () => <div>ok</div>;`,
      scope,
    );
    expect(result.error).toBeUndefined();
  });

  it("explains itself when the artifact forgets to export a component", () => {
    const result = compileArtifact(
      `import React from "react";
       const x = 1;`,
      scope,
    );
    expect(result.error?.phase).toBe("execute");
    expect(result.error?.message).toContain("export default");
  });

  it("does not leak host globals into artifact scope", () => {
    // `require` inside an artifact must only see the allow-list, never Node's.
    const result = compileArtifact(
      `export default function T() { return null; }
       const fs = require("node:fs");`,
      scope,
    );
    expect(result.error?.phase).toBe("execute");
    expect(result.error?.message).toContain("node:fs");
  });
});
