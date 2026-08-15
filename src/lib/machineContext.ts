/**
 * The machine context bar: what the user's welder is actually set to.
 *
 * This exists because of a tension the agent hits constantly. Most real
 * questions ("what settings for 1/8 steel?", "what's my duty cycle?") have no
 * answer until you know the process and the input voltage, so the agent has to
 * stop and ask — correct, but tiresome when the answer is the same every time.
 * Setting it once at the top of the screen means the agent can answer directly
 * and the clarifying question is reserved for genuinely new information.
 *
 * It is deliberately NOT a silent default: the strip is always visible, so an
 * answer filtered to 240V flux-cored never looks like a general claim.
 */
export type Voltage = "120" | "240";
export type ProcessId = "MIG" | "FLUX_CORED" | "TIG" | "STICK";

export interface MachineContext {
  voltage: Voltage | null;
  process: ProcessId | null;
  wire: string | null;
  gas: string | null;
}

export const EMPTY_MACHINE: MachineContext = {
  voltage: null,
  process: null,
  wire: null,
  gas: null,
};

export const PROCESS_LABEL: Record<ProcessId, string> = {
  MIG: "MIG",
  FLUX_CORED: "FLUX-CORED",
  TIG: "TIG",
  STICK: "STICK",
};

export const VOLTAGE_OPTIONS: Voltage[] = ["120", "240"];
export const PROCESS_OPTIONS: ProcessId[] = ["MIG", "FLUX_CORED", "TIG", "STICK"];

/** Wire sizes the manual lists, split by what the process can actually take. */
export const WIRE_OPTIONS: Record<ProcessId, string[]> = {
  MIG: ['.025 in', '.030 in', '.035 in'],
  FLUX_CORED: ['.030 in', '.035 in', '.045 in'],
  TIG: ['.040 in', '1/16 in', '3/32 in'],
  STICK: ['1/16 in', '3/32 in', '1/8 in'],
};

export const GAS_OPTIONS = ["C25", "C100", "Argon", "Tri-Mix", "None"];

/** True when the process runs gasless, so the gas chip should not be offered. */
export function isGasless(process: ProcessId | null): boolean {
  return process === "FLUX_CORED" || process === "STICK";
}

/**
 * Rendered into the prompt so the agent can answer without re-asking. Kept
 * terse and explicit about the fact that the user set it, not the agent.
 */
export function describeMachine(m: MachineContext): string | null {
  const parts: string[] = [];
  if (m.voltage) parts.push(`input voltage ${m.voltage}V`);
  if (m.process) parts.push(`process ${PROCESS_LABEL[m.process]}`);
  if (m.wire) parts.push(`consumable ${m.wire}`);
  if (m.gas && !isGasless(m.process)) parts.push(`shielding gas ${m.gas}`);
  if (!parts.length) return null;
  return parts.join(", ");
}

/** Short chips for the header strip. */
export function machineChips(m: MachineContext): { key: keyof MachineContext; label: string }[] {
  const chips: { key: keyof MachineContext; label: string }[] = [];
  chips.push({ key: "voltage", label: m.voltage ? `${m.voltage} V` : "SET VOLTAGE" });
  chips.push({ key: "process", label: m.process ? PROCESS_LABEL[m.process] : "SET PROCESS" });
  chips.push({ key: "wire", label: m.wire ? `${m.wire} WIRE` : "SET WIRE" });
  if (!isGasless(m.process)) {
    chips.push({ key: "gas", label: m.gas ? m.gas : "+ gas" });
  }
  return chips;
}
