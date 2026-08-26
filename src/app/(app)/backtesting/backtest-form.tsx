"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PERIODS, type PeriodKey } from "@/lib/market/constants";
import type { Strategy } from "@/lib/market/backtest";

const STRATEGIES: { id: Strategy; label: string; hint: string }[] = [
  { id: "rsi", label: "RSI seul", hint: "Achat sous le seuil bas, vente au-dessus du seuil haut." },
  { id: "macd", label: "MACD seul", hint: "Achat au croisement haussier, vente au croisement baissier." },
  { id: "rsi_macd", label: "RSI + MACD", hint: "Les deux doivent s'aligner — moins de trades, plus de conviction." },
];

const BT_PERIODS: PeriodKey[] = ["6mo", "1y", "2y"];

export function BacktestForm({
  universe,
  params,
}: {
  universe: { nom: string; ticker: string }[];
  params: {
    ticker: string;
    period: PeriodKey;
    strategy: Strategy;
    rsiBuy: number;
    rsiSell: number;
    capital: number;
  };
}) {
  const router = useRouter();
  const [s, setS] = useState(params);

  function run() {
    const p = new URLSearchParams({
      ticker: s.ticker,
      periode: s.period,
      strategie: s.strategy,
      rsiBuy: String(s.rsiBuy),
      rsiSell: String(s.rsiSell),
      capital: String(s.capital),
      run: "1",
    });
    router.push(`/backtesting?${p.toString()}`);
  }

  const active = STRATEGIES.find((x) => x.id === s.strategy)!;
  const rsiDisabled = s.strategy === "macd";

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={s.ticker} onValueChange={(v) => setS({ ...s, ticker: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {universe.map((u) => (
                  <SelectItem key={u.ticker} value={u.ticker}>{u.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Période</Label>
            <Select
              value={s.period}
              onValueChange={(v) => setS({ ...s, period: v as PeriodKey })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BT_PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>{PERIODS[p].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Stratégie</Label>
            <Select
              value={s.strategy}
              onValueChange={(v) => setS({ ...s, strategy: v as Strategy })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STRATEGIES.map((x) => (
                  <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bt-cap">Capital initial (€)</Label>
            <Input
              id="bt-cap"
              type="number"
              min={100}
              step={100}
              value={s.capital}
              onChange={(e) => setS({ ...s, capital: Number(e.target.value) })}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{active.hint}</p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Slider
            label="Seuil RSI d'achat"
            value={s.rsiBuy}
            min={10}
            max={40}
            disabled={rsiDisabled}
            onChange={(v) => setS({ ...s, rsiBuy: v })}
          />
          <Slider
            label="Seuil RSI de vente"
            value={s.rsiSell}
            min={60}
            max={90}
            disabled={rsiDisabled}
            onChange={(v) => setS({ ...s, rsiSell: v })}
          />
        </div>

        <Button onClick={run}>
          <Play className="size-4" />
          Lancer le backtest
        </Button>
      </CardContent>
    </Card>
  );
}

function Slider({
  label, value, min, max, disabled, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className={disabled ? "opacity-40" : undefined}>
      <div className="mb-2 flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="tabular text-sm font-medium">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--primary)]"
      />
      <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
