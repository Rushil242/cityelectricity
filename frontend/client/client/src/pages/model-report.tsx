import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, TrendingDown, AlertTriangle } from "lucide-react";
import type { ModelPerformance } from "@shared/types";

export default function ModelReport() {
  const { data: performance, isLoading, isError } = useQuery<ModelPerformance>({
    queryKey: ['/api/v1/model/performance'],
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Performance Metrics */}
      <Card data-testid="card-performance-metrics">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Hybrid Fusion Model Performance</CardTitle>
              <CardDescription>Advanced ensemble learning for electricity demand prediction</CardDescription>
            </div>
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Primary Model
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
              <p className="text-base font-medium text-foreground">Unable to load model performance data</p>
              <p className="text-sm text-muted-foreground mt-2">Please check your connection to the Flask backend server</p>
            </div>
          ) : performance ? (
            <div className="space-y-6">
              {/* Key Achievement */}
              <div className="rounded-lg border-2 border-primary bg-primary/5 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingDown className="h-6 w-6 text-primary" />
                  <h3 className="text-lg font-semibold">Significant Improvement Achieved</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  The Hybrid Fusion model demonstrates superior accuracy by intelligently combining XGBoost and LSTM predictions through a meta-learning ensemble approach.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-md bg-background p-4">
                    <div className="text-xs font-medium text-muted-foreground mb-1">XGBoost MAPE</div>
                    <div className="text-2xl font-bold" data-testid="metric-xgboost">
                      {performance.xgboost_mape.toFixed(2)}%
                    </div>
                  </div>
                  <div className="rounded-md bg-background p-4">
                    <div className="text-xs font-medium text-muted-foreground mb-1">LSTM MAPE</div>
                    <div className="text-2xl font-bold" data-testid="metric-lstm">
                      {performance.lstm_mape.toFixed(2)}%
                    </div>
                  </div>
                  <div className="rounded-md bg-primary/10 border-2 border-primary p-4">
                    <div className="text-xs font-medium text-primary mb-1">Fusion MAPE</div>
                    <div className="text-2xl font-bold text-primary" data-testid="metric-fusion">
                      {performance.fusion_mape.toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-md bg-primary/10 border border-primary/20">
                  <p className="text-sm font-semibold text-primary">
                    ✓ {(performance.xgboost_mape - performance.fusion_mape).toFixed(2)} percentage point improvement over base XGBoost model
                  </p>
                </div>
              </div>

              {/* Model Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-md border p-4">
                  <h4 className="text-sm font-semibold mb-2">Model Architecture</h4>
                  <p className="text-sm text-muted-foreground">
                    Ensemble of gradient boosting (XGBoost) and deep learning (LSTM) models with meta-learner fusion layer
                  </p>
                </div>
                <div className="rounded-md border p-4">
                  <h4 className="text-sm font-semibold mb-2">Last Training</h4>
                  <p className="text-sm text-muted-foreground">
                    {performance.last_trained}
                  </p>
                </div>
              </div>

              {/* Metric Explanation */}
              <div className="rounded-md bg-muted/50 p-4">
                <h4 className="text-sm font-semibold mb-2">About MAPE (Mean Absolute Percentage Error)</h4>
                <p className="text-sm text-muted-foreground">
                  MAPE measures prediction accuracy as a percentage. Lower values indicate better performance. 
                  The hybrid model's {performance.fusion_mape.toFixed(2)}% MAPE means predictions are typically within ±{performance.fusion_mape.toFixed(1)}% of actual values, 
                  representing excellent accuracy for real-time grid management.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Unable to load performance metrics
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison Chart */}
      <Card data-testid="card-comparison-chart">
        <CardHeader>
          <CardTitle>Model Prediction Comparison</CardTitle>
          <CardDescription>Visual comparison of XGBoost, LSTM, and Hybrid Fusion model predictions against actual values</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-muted/10 p-4">
            <img
              src="/api/v1/static/plots/fusion_model_prediction.png"
              alt="Fusion Model Prediction Comparison"
              className="w-full h-auto"
              data-testid="image-model-comparison"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = '<div class="flex items-center justify-center h-64 text-muted-foreground">Comparison chart image not available</div>';
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            The chart demonstrates how the fusion model (green) more closely tracks actual power consumption (blue) 
            compared to individual XGBoost (orange) and LSTM (red) predictions, especially during peak demand periods.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
