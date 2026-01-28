import { Link } from "react-router-dom";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssets } from "@/lib/query";
import { formatJPY } from "@/lib/money";
import { useText } from "@/lib/text";

export const AssetsPage = () => {
  const { t } = useText();
  const { data: assets = [] } = useAssets();

  return (
    <div className="flex min-h-0 flex-col">
      <Topbar title={t("assetsTitle")} subtitle={t("assetsSubtitle")} />
      <div className="flex-1">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <Link key={asset.id} to={`/assets/${asset.id}/ledger`}>
              <Card className="transition hover:-translate-y-1 hover:shadow-elevated">
                <CardHeader>
                  <CardTitle className="text-lg">{asset.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {formatJPY(asset.currentBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboardInitialBalance", {
                      amount: formatJPY(asset.initialBalance),
                    })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
