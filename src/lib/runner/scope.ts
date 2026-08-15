"use client";

import * as React from "react";
import * as Recharts from "recharts";
import * as LucideAll from "lucide-react";

import { UI_KIT } from "./ui-kit";
import { MachineDiagram } from "@/components/machine/MachineDiagram";

/**
 * The module allow-list available to artifact code.
 *
 * Deliberately narrow, and it mirrors what claude.ai stocks — the model has
 * strong priors about exactly this set (React + recharts + lucide + shadcn), so
 * matching it is what makes generated artifacts work on the first try.
 */

/**
 * lucide-react exports hundreds of icons and the model routinely invents plausible
 * names that do not exist ("WeldIcon", "SparkPlug"). An undefined component crashes
 * React with a useless error, so unknown names resolve to a neutral fallback icon
 * instead — a cosmetic downgrade rather than a blank error card.
 */
const lucideProxy = new Proxy(LucideAll as Record<string, unknown>, {
  get(target, prop: string) {
    if (prop in target) return target[prop];
    if (prop === "__esModule" || typeof prop === "symbol") return undefined;
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[artifact] unknown lucide icon "${prop}" — using CircleHelp`);
    }
    return (target as Record<string, unknown>).CircleHelp;
  },
  has() {
    return true;
  },
});

/**
 * Recharts animates series on mount by growing the stroke from zero length. If
 * that animation never advances — a backgrounded tab, a remount mid-flight, a
 * screenshot taken too early — the series renders as an invisible zero-length
 * path while the axes and grid around it look perfectly fine. That failure is
 * silent and was reproducible here, which is unacceptable for a chart whose
 * whole job is to communicate a duty-cycle limit.
 *
 * Turning animation off by default makes charts render synchronously and
 * deterministically. It is set through defaultProps rather than by wrapping the
 * components because recharts locates its children by component identity
 * (findAllByType); a wrapper component would be invisible to the parent chart
 * and the series would disappear entirely. These are class components, so
 * defaultProps is still honoured under React 19.
 *
 * An artifact that explicitly passes isAnimationActive still wins.
 */
const ANIMATED_SERIES = [
  "Line",
  "Bar",
  "Area",
  "Pie",
  "Radar",
  "Scatter",
  "RadialBar",
  "Funnel",
] as const;

type WithDefaults = { defaultProps?: Record<string, unknown> };

function withAnimationDisabled(recharts: typeof Recharts): typeof Recharts {
  const bag = recharts as unknown as Record<string, unknown>;
  for (const name of ANIMATED_SERIES) {
    const component = bag[name];
    if (typeof component !== "function") continue;
    const target = component as unknown as WithDefaults;
    target.defaultProps = { ...target.defaultProps, isAnimationActive: false };
  }
  return recharts;
}

export const ARTIFACT_SCOPE: Record<string, unknown> = {
  react: { ...React, default: React },
  "lucide-react": lucideProxy,
  recharts: withAnimationDisabled(Recharts),
  "@/components/ui": UI_KIT,
  // The interactive machine diagram is available to artifacts too, so a generated
  // troubleshooting flow can highlight the exact part for each step:
  //   import { MachineDiagram } from "@/components/machine";
  //   <MachineDiagram view="interior" highlight={["feed-tensioner"]} />
  "@/components/machine": { MachineDiagram },
};

/** Human-readable list used in error messages and the system prompt. */
export const AVAILABLE_MODULES = [
  "react",
  "recharts",
  "lucide-react",
  "@/components/ui/*",
];
