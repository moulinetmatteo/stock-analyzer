"use client";

import { useActionState, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TelegramConfig } from "@/lib/data";
import { saveTelegramAction, testTelegramAction, type ActionResult } from "./actions";

export function TelegramCard({ config }: { config: TelegramConfig | null }) {
  const [token, setToken] = useState(config?.token ?? "");
  const [chatId, setChatId] = useState(config?.chat_id ?? "");
  const [testing, startTest] = useTransition();

  const [, action] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const res = await saveTelegramAction(prev, fd);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      return res;
    },
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notifications Telegram</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>
            Dans Telegram, ouvre <strong>@BotFather</strong> et envoie{" "}
            <code className="text-xs">/newbot</code> pour obtenir un token.
          </li>
          <li>
            Ouvre <strong>@userinfobot</strong> et envoie{" "}
            <code className="text-xs">/start</code> pour lire ton chat ID.
          </li>
        </ol>

        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tg-token">Token du bot</Label>
            <Input
              id="tg-token"
              name="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456:ABC-DEF…"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tg-chat">Chat ID</Label>
            <Input
              id="tg-chat"
              name="chat_id"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="123456789"
              className="font-mono text-sm"
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit">Enregistrer</Button>
            <Button
              type="button"
              variant="outline"
              disabled={testing}
              onClick={() =>
                startTest(async () => {
                  const res = await testTelegramAction(token, chatId);
                  if (res.ok) toast.success(res.message);
                  else toast.error(res.message);
                })
              }
            >
              <Send className="size-4" />
              Envoyer un test
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
