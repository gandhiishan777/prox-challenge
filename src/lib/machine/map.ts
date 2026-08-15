import mapJson from "../../../knowledge/machine_map.json";

import type { MachineMap, MachineView, MachinePart } from "./types";

/**
 * The one machine map, imported from the knowledge pack so there is a single
 * source of truth. Both the chat app and the bundled artifact runner import
 * this; the `_comment` field in the JSON is ignored.
 */
export const MACHINE_MAP = mapJson as unknown as MachineMap;

export const MACHINE_VIEWS = Object.keys(MACHINE_MAP.views);

export function getView(view: string): MachineView | undefined {
  return MACHINE_MAP.views[view];
}

export function getPart(view: string, partId: string): MachinePart | undefined {
  return MACHINE_MAP.views[view]?.parts.find((p) => p.id === partId);
}

/** All (view, part) pairs, for tool validation and keyword matching. */
export function allParts(): { view: string; part: MachinePart }[] {
  return MACHINE_VIEWS.flatMap((view) =>
    MACHINE_MAP.views[view].parts.map((part) => ({ view, part })),
  );
}
