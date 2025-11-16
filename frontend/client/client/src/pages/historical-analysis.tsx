import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarIcon, PlayCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import type { HistoricalDataPoint } from "@shared/types";

export default function HistoricalAnalysis() {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date('2021-08-01'));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date('2021-08-17'));
  const [shouldFetch, setShouldFetch] = useState(false);

  const buildHistoricalUrl = () => {
    if (!startDate || !endDate) return '/api/v1/data/historical';
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    return `/api/v1/data/historical?start=${start}&end=${end}`;
  };

  const { data: historicalData, isLoading, isError, refetch } = useQuery<HistoricalDataPoint[]>({
    queryKey: [buildHistoricalUrl()],
    enabled: shouldFetch && !!startDate && !!endDate,
  });

  const handleRunAnalysis = () => {
    setShouldFetch(true);
    refetch();
  };

  const chartData = historicalData?.map((point) => ({
    time: point._time ? format(new Date(point._time), 'MM/dd') : '',
    power: point.Phase3_power ? Math.round(point.Phase3_power * 10) / 10 : null,
    fullTime: point._time,
  })).filter(point => point.power !== null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = historicalData ? Math.ceil(historicalData.length / itemsPerPage) : 0;
  const paginatedData = historicalData?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Controls */}
      <Card data-testid="card-controls">
        <CardHeader>
          <CardTitle>Analysis Parameters</CardTitle>
          <CardDescription>Select date range for historical data analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-start-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-end-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button
              onClick={handleRunAnalysis}
              disabled={!startDate || !endDate}
              className="min-w-[160px]"
              data-testid="button-run-analysis"
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Run Analysis
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card data-testid="card-historical-chart">
        <CardHeader>
          <CardTitle>Historical Phase 3 Power Consumption</CardTitle>
          <CardDescription>
            {startDate && endDate
              ? `Data from ${format(startDate, 'MMM dd, yyyy')} to ${format(endDate, 'MMM dd, yyyy')}`
              : 'Select dates and run analysis to view chart'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[350px] w-full" />
          ) : isError ? (
            <div className="flex h-[350px] flex-col items-center justify-center text-center">
              <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm font-medium text-foreground">Failed to load historical data</p>
              <p className="text-xs text-muted-foreground mt-1">Please verify the date range and backend connection</p>
            </div>
          ) : chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
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
                <Line
                  type="monotone"
                  dataKey="power"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[350px] items-center justify-center text-muted-foreground">
              {shouldFetch ? 'No data available for selected range' : 'Click "Run Analysis" to load data'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      {historicalData && historicalData.length > 0 && (
        <Card data-testid="card-data-table">
          <CardHeader>
            <CardTitle>Raw Historical Data</CardTitle>
            <CardDescription>Detailed view of {historicalData.length} data points</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-right">Phase 3 Power (MW)</TableHead>
                    <TableHead className="text-right">Phase 3 Voltage (V)</TableHead>
                    <TableHead className="text-right">Phase 3 Frequency (Hz)</TableHead>
                    <TableHead className="text-right">Power Factor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData?.map((row, idx) => (
                    <TableRow key={idx} data-testid={`table-row-${idx}`}>
                      <TableCell className="font-mono text-xs">
                        {row._time ? format(new Date(row._time), 'yyyy-MM-dd HH:mm') : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {row.Phase3_power?.toFixed(2) ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.Phase3_voltage?.toFixed(1) ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.Phase3_frequency?.toFixed(2) ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.Phase3_pf?.toFixed(3) ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, historicalData.length)} of {historicalData.length} entries
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
