"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearDataAction } from "./actions";

const CONFIRM = "SUPPRIMER";

const OPTIONS = [
  {
    scope: "transactions" as const,
    label: "Vider l'historique",
    hint: "Supprime les transactions, garde les positions.",
  },
  {
    scope: "positions" as const,
    label: "Vider les positions",
    hint: "Supprime les positions, garde l'historique.",
  },
  {
    scope: "tout" as const,
    label: "Tout vider",
    hint: "Supprime positions et transactions.",
  },
];

export function DangerZone() {
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const armed = typed.trim().toUpperCase() === CONFIRM;

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="size-4" />
          Zone de danger
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Ces suppressions sont définitives et ne touchent que ton compte. Tape{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{CONFIRM}</code> pour
          débloquer les boutons.
        </p>

        <div className="max-w-xs space-y-2">
          <Label htmlFor="dz-confirm">Confirmation</Label>
          <Input
            id="dz-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM}
            autoComplete="off"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {OPTIONS.map((o) => (
            <div key={o.scope} className="space-y-1.5">
              <Button
                variant="destructive"
                className="w-full"
                disabled={!armed || pending}
                onClick={() =>
                  start(async () => {
                    const res = await clearDataAction(o.scope);
                    if (res.ok) { toast.success(res.message); setTyped(""); }
                    else toast.error(res.message);
                  })
                }
              >
                {o.label}
              </Button>
              <p className="text-xs text-muted-foreground">{o.hint}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
