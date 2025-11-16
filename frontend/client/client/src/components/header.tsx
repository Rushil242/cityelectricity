import { Bell } from "lucide-react";
import { SidebarTrigger } from "./ui/sidebar";
import { Button } from "./ui/button";
import { useQuery } from "@tanstack/react-query";
import type { AlertsResponse } from "C:/Users/dhanu/OneDrive/Dokumen/projects/City_Electricity_Demand_Forecasting/frontend/shared/shared/types.ts";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { data: alertsData } = useQuery<AlertsResponse>({
    queryKey: ['/api/v1/alerts/check'],
    refetchInterval: 60000, // Refetch every minute
  });

  const hasCriticalAlerts = alertsData?.alerts?.some(
    (alert) => alert.level === 'critical'
  );

  return (
    <header className="flex items-center justify-between border-b bg-background p-4">
      <div className="flex items-center gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-alerts"
          aria-label="View alerts"
        >
          <Bell className="h-5 w-5" />
          {hasCriticalAlerts && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" data-testid="indicator-critical-alert" />
          )}
        </Button>
      </div>
    </header>
  );
}
