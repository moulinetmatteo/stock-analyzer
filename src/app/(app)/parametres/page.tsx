import { requireUser } from "@/lib/auth";
import { getCustomWatchlist, getTelegramConfig } from "@/lib/data";
import { TelegramCard } from "./telegram-card";
import { WatchlistCard } from "./watchlist-card";
import { DangerZone } from "./danger-zone";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const user = await requireUser();
  const [custom, tg] = await Promise.all([
    getCustomWatchlist(user.username),
    getTelegramConfig(user.username),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connecté en tant que <strong>{user.name}</strong> ({user.username})
        </p>
      </header>

      <WatchlistCard items={custom} />
      <TelegramCard config={tg} />
      <DangerZone />
    </div>
  );
}
