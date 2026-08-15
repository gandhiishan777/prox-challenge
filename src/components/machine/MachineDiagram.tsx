"use client";

import * as React from "react";

import { getView } from "@/lib/machine/map";

/**
 * Interactive overlay on the manual's own machine drawings.
 *
 * The image is the manual's line art; this adds a hotspot layer on top of it —
 * pulsing rings on the parts a caller wants to point at, faint dots on the rest,
 * and a hover label. It is deliberately self-contained (one image, one SVG, no
 * app dependencies beyond the map) because the same component is exposed inside
 * the artifact sandbox, so a generated troubleshooting flow can highlight the
 * exact part for each step.
 *
 * Coordinates in the map are normalized 0..1. The SVG uses a viewBox of
 * 100 x 100*(H/W) so that a radius expressed as a fraction of width stays a
 * circle regardless of the render size.
 */

export interface MachineDiagramProps {
  view: string;
  /** Part ids to highlight. */
  highlight?: string[];
  /** Base URL for the images. Defaults to the app's knowledge route. */
  imageBase?: string;
  /** Show faint markers on the parts that are not highlighted. */
  showAll?: boolean;
  className?: string;
}

export function MachineDiagram({
  view,
  highlight = [],
  imageBase = "/api/knowledge",
  showAll = true,
  className,
}: MachineDiagramProps) {
  const v = getView(view);
  const [hover, setHover] = React.useState<string | null>(null);

  // Core Tailwind classes only (slate/orange, not the app's custom steel/arc),
  // because this same component is bundled into the artifact sandbox, where only
  // the default Tailwind theme is available.
  if (!v) {
    return (
      <div className="rounded-lg border border-slate-300 bg-slate-100 p-3 text-sm text-slate-500">
        Unknown machine view: {view}
      </div>
    );
  }

  const [W, H] = v.px;
  const vh = (100 * H) / W;
  const highlighted = new Set(highlight);
  const active = hover ?? (highlight.length === 1 ? highlight[0] : null);
  const activePart = v.parts.find((p) => p.id === active);

  // Normalized part geometry -> SVG user units (x in 0..100, y in 0..vh).
  const toUnits = (p: (typeof v.parts)[number]) => {
    if (p.shape === "circle") {
      return { cx: (p.cx ?? 0) * 100, cy: (p.cy ?? 0) * vh, r: (p.r ?? 0.04) * 100 };
    }
    return {
      x: (p.x ?? 0) * 100,
      y: (p.y ?? 0) * vh,
      w: (p.w ?? 0) * 100,
      h: (p.h ?? 0) * vh,
    };
  };

  return (
    <figure className={`overflow-hidden rounded-xl border border-slate-700 bg-white ${className ?? ""}`}>
      <div className="relative">
        <img
          src={`${imageBase}/${v.image}`}
          alt={v.title}
          className="block w-full select-none"
          draggable={false}
        />
        <svg
          viewBox={`0 0 100 ${vh}`}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {v.parts.map((p) => {
            const isOn = highlighted.has(p.id);
            const isHover = hover === p.id;
            if (!isOn && !showAll) return null;
            const u = toUnits(p);
            const stroke = isOn ? "#f97316" : "#64748b";
            const opacity = isOn ? 1 : isHover ? 0.9 : 0.35;

            return (
              <g
                key={p.id}
                className="pointer-events-auto cursor-pointer"
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                style={{ opacity }}
              >
                {p.shape === "circle" ? (
                  <>
                    {isOn && (
                      <circle cx={u.cx} cy={u.cy} r={u.r} fill="none" stroke={stroke} strokeWidth={0.8}>
                        <animate attributeName="r" values={`${u.r};${u.r! * 1.5};${u.r}`} dur="1.6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.9;0;0.9" dur="1.6s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle
                      cx={u.cx}
                      cy={u.cy}
                      r={u.r}
                      fill={isOn ? "rgba(249,115,22,0.18)" : "transparent"}
                      stroke={stroke}
                      strokeWidth={isOn ? 1.2 : 0.6}
                    />
                  </>
                ) : (
                  <rect
                    x={u.x}
                    y={u.y}
                    width={u.w}
                    height={u.h}
                    rx={1}
                    fill={isOn ? "rgba(249,115,22,0.14)" : "transparent"}
                    stroke={stroke}
                    strokeWidth={isOn ? 1.2 : 0.6}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <figcaption className="border-t border-slate-800 bg-slate-900 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-100">{v.title}</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-orange-400">
            p. {v.page.replace(/^om-0?/, "")}
          </span>
        </div>
        {activePart ? (
          <p className="mt-1 text-xs text-slate-300">
            <span className="font-medium text-orange-400">{activePart.label}.</span>{" "}
            {activePart.note}
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">{v.caption} Hover a marker for detail.</p>
        )}
      </figcaption>
    </figure>
  );
}
