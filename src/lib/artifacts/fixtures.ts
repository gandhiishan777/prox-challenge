/**
 * Hand-written artifact fixtures.
 *
 * These exist so the whole rendering path — transpile, module resolution, the
 * ui kit, Tailwind, charts, icons, error reporting — can be developed and
 * regression-tested without spending a single API call. They are written the
 * way the model actually writes artifacts (ES imports, default export, shadcn
 * components, recharts, lucide icons), so if a fixture renders, real output
 * will too.
 */

export const DUTY_CYCLE_CALCULATOR = `
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Flame, Timer } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from "recharts";

// Rated points for MIG on 240V input, from the specification table (p. 7).
const RATED = [
  { amps: 115, duty: 100 },
  { amps: 200, duty: 25 },
];

export default function DutyCycleCalculator() {
  const [amps, setAmps] = useState(200);

  const duty = amps <= 115 ? 100 : 25;
  const weldMin = (duty / 100) * 10;
  const restMin = 10 - weldMin;

  const curve = [];
  for (let a = 30; a <= 220; a += 10) {
    curve.push({ amps: a, duty: a <= 115 ? 100 : 25 });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5" /> MIG Duty Cycle — 240V
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-slate-500">Welding current</span>
            <Badge>{amps} A</Badge>
          </div>
          <Slider min={30} max={220} step={5} value={[amps]} onValueChange={([v]) => setAmps(v)} />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-2xl font-semibold">{duty}%</div>
            <div className="text-xs text-slate-500">Duty cycle</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-2xl font-semibold">{weldMin.toFixed(1)}</div>
            <div className="text-xs text-slate-500">Min welding</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-2xl font-semibold">{restMin.toFixed(1)}</div>
            <div className="text-xs text-slate-500">Min resting</div>
          </div>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="amps" label={{ value: "Amps", position: "insideBottom", offset: -4 }} />
              <YAxis domain={[0, 110]} />
              <Tooltip />
              <Line type="stepAfter" dataKey="duty" stroke="#f97316" strokeWidth={2} dot={false} />
              <ReferenceDot x={amps} y={duty} r={5} fill="#f97316" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="flex items-start gap-2 text-xs text-slate-500">
          <Timer className="mt-0.5 h-4 w-4 shrink-0" />
          The manual publishes two rated points per process; between them, use the
          lower duty cycle as your bound.
        </p>
      </CardContent>
    </Card>
  );
}
`.trim();

export const POLARITY_TABLE = `
import React from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const ROWS = [
  { process: "MIG (solid wire + gas)", polarity: "DCEP", gun: "(+) positive", clamp: "(-) negative" },
  { process: "Flux-cored (self-shielded)", polarity: "DCEN", gun: "(-) negative", clamp: "(+) positive" },
];

export default function PolarityTable() {
  return (
    <Card>
      <CardHeader><CardTitle>Polarity by process</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Process</TableHead>
              <TableHead>Polarity</TableHead>
              <TableHead>Gun lead</TableHead>
              <TableHead>Work clamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((r) => (
              <TableRow key={r.process}>
                <TableCell className="font-medium">{r.process}</TableCell>
                <TableCell>{r.polarity}</TableCell>
                <TableCell>{r.gun}</TableCell>
                <TableCell>{r.clamp}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
`.trim();

/** Deliberately broken: exercises the error card and the Fix-it flow. */
export const BROKEN_ARTIFACT = `
import React from "react";
export default function Broken() {
  const rows = null;
  return <div>{rows.map((r) => <span key={r}>{r}</span>)}</div>;
}
`.trim();

/** Imports a package we do not stock: exercises the module allow-list error. */
export const UNKNOWN_IMPORT_ARTIFACT = `
import React from "react";
import axios from "axios";
export default function Nope() { return <div>{typeof axios}</div>; }
`.trim();

export const FIXTURES = [
  { id: "duty-cycle-calculator", title: "Duty Cycle Calculator", code: DUTY_CYCLE_CALCULATOR },
  { id: "polarity-table", title: "Polarity Table", code: POLARITY_TABLE },
  { id: "broken", title: "Broken (runtime error)", code: BROKEN_ARTIFACT },
  { id: "unknown-import", title: "Unknown import", code: UNKNOWN_IMPORT_ARTIFACT },
];
