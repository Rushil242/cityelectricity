import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, TrendingUp, Activity, Layers } from "lucide-react";
import type { ForecastDataPoint, AlertsResponse, ModelPerformance } from "@shared/types";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: forecastData, isLoading: forecastLoading, isError: forecastError } = useQuery<ForecastDataPoint[]>({
    queryKey: ['/api/v1/forecast/hourly'],
  });

  const { data: alertsData, isLoading: alertsLoading, isError: alertsError } = useQuery<AlertsResponse>({
    queryKey: ['/api/v1/alerts/check'],
    refetchInterval: 60000,
  });

  const { data: performance, isLoading: perfLoading, isError: perfError } = useQuery<ModelPerformance>({
    queryKey: ['/api/v1/model/performance'],
  });

  const kpiCards = [
    {
      title: "Hybrid Model Accuracy",
      value: performance ? `${performance.fusion_mape.toFixed(2)}%` : "—",
      description: "Fusion MAPE Score",
      icon: TrendingUp,
      trend: "10pt improvement over base model",
      loading: perfLoading,
      testId: "card-hybrid-accuracy",
    },
    {
      title: "Peak Load Alert",
      value: alertsData?.alerts?.[0]?.level === 'critical' ? "Active" : "Normal",
      description: alertsData?.alerts?.[0]?.message || "No critical alerts",
      icon: AlertTriangle,
      trend: "",
      loading: alertsLoading,
      isAlert: alertsData?.alerts?.[0]?.level === 'critical',
      testId: "card-peak-alert",
    },
    {
      title: "XGBoost MAPE",
      value: performance ? `${performance.xgboost_mape.toFixed(2)}%` : "—",
      description: "Base Model Score",
      icon: Activity,
      trend: "",
      loading: perfLoading,
      testId: "card-xgboost",
    },
    {
      title: "LSTM MAPE",
      value: performance ? `${performance.lstm_mape.toFixed(2)}%` : "—",
      description: "Sequential Model Score",
      icon: Layers,
      trend: "",
      loading: perfLoading,
      testId: "card-lstm",
    },
  ];

  const chartData = forecastData?.map((point) => ({
    time: format(new Date(point.timestamp), 'HH:mm'),
    power: Math.round(point.predicted_power * 10) / 10,
    fullTime: point.timestamp,
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.title} data-testid={card.testId}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.isAlert ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              {card.loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${card.isAlert ? 'text-destructive' : ''}`} data-testid={`${card.testId}-value`}>
                    {card.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {card.description}
                  </p>
                  {card.trend && (
                    <p className="text-xs text-primary mt-1 font-medium">{card.trend}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Forecast Chart */}
        <Card className="lg:col-span-2" data-testid="card-forecast-chart">
          <CardHeader>
            <CardTitle>24-Hour Demand Forecast (Phase 3)</CardTitle>
            <CardDescription>Predicted power consumption using hybrid AI model</CardDescription>
          </CardHeader>
          <CardContent>
            {forecastLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : forecastError ? (
              <div className="flex h-[350px] flex-col items-center justify-center text-center">
                <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
                <p className="text-sm font-medium text-foreground">Unable to load forecast data</p>
                <p className="text-xs text-muted-foreground mt-1">Please check your connection to the backend server</p>
              </div>
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 'Power (MW)', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="power"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPower)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[350px] items-center justify-center text-muted-foreground">
                No forecast data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts Panel */}
        <Card data-testid="card-alerts-panel">
          <CardHeader>
            <CardTitle>System Status & Alerts</CardTitle>
            <CardDescription>Real-time grid monitoring</CardDescription>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : alertsError ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertTriangle className="h-6 w-6 text-destructive mb-2" />
                <p className="text-sm font-medium">Unable to load alerts</p>
                <p className="text-xs text-muted-foreground mt-1">Check backend connection</p>
              </div>
            ) : alertsData?.alerts && alertsData.alerts.length > 0 ? (
              <div className="space-y-3">
                {alertsData.alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`rounded-md border p-3 ${
                      alert.level === 'critical'
                        ? 'border-destructive bg-destructive/10'
                        : alert.level === 'warning'
                        ? 'border-chart-3 bg-chart-3/10'
                        : 'border-border bg-muted/50'
                    }`}
                    data-testid={`alert-${idx}`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                          alert.level === 'critical'
                            ? 'text-destructive'
                            : alert.level === 'warning'
                            ? 'text-chart-3'
                            : 'text-muted-foreground'
                        }`}
                      />
                      <div className="flex-1">
                        <div className="text-xs font-semibold uppercase tracking-wide">
                          {alert.level}
                        </div>
                        <p className="text-sm mt-1">{alert.message}</p>
                        {alert.timestamp && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(alert.timestamp), 'MMM dd, HH:mm')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-primary/10 p-3 mb-3">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">All Systems Normal</p>
                <p className="text-xs text-muted-foreground mt-1">No active alerts</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
