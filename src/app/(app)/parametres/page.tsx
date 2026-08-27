import { requireUser } from "@/lib/auth";
import { getCustomWatchlist, getTelegramConfig } from "@/lib/data";
import { TelegramCard } from "./telegram-card";
import { WatchlistCard } from "./watchlist-card";
import { DangerZone } from "./danger-zone";
import { PageHeader } from "@/components/stat-card";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const user = await requireUser();
  const [custom, tg] = await Promise.all([
    getCustomWatchlist(user.username),
    getTelegramConfig(user.username),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Paramètres"
        description={`Connecté en tant que ${user.name} (${user.username})`}
      />

      <WatchlistCard items={custom} />
      <TelegramCard config={tg} />
      <DangerZone />
    </div>
  );
}
