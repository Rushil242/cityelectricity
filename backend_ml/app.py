import pandas as pd
import numpy as np
import joblib
import os
import tensorflow as tf
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS # Needed for Replit to talk to itself

print("--- Initializing Backend Flask Server ---")

# --- Initialize Flask App ---
app = Flask(__name__)
# Enable Cross-Origin Resource Sharing (CORS)
CORS(app) 

# --- Configuration (Must match training scripts) ---
TARGET_COLUMN = 'Phase3_power'
N_LOOKBACK = 72 # From LSTM
FEATURES_LSTM = [
    'Phase2_current', 'Phase2_voltage', 'Phase3_frequency', 
    'Phase3_pf', 'Phase3_power', 'Phase3_voltage'
]
FEATURES_XGB = [
    'Phase2_current', 'Phase2_voltage', 'Phase3_frequency', 'Phase3_pf', 'Phase3_voltage',
    'hour', 'dayofweek', 'month', 'quarter', 'year', 'dayofyear',
    f'{TARGET_COLUMN}_lag_1h', f'{TARGET_COLUMN}_lag_3h', f'{TARGET_COLUMN}_lag_24h',
    f'{TARGET_COLUMN}_roll_avg_3h', f'{TARGET_COLUMN}_roll_avg_6h', f'{TARGET_COLUMN}_roll_avg_24h',
]
CRITICAL_LOAD_THRESHOLD = 500 


#
# --- FIX IS HERE ---
#

# --- Step 1: Load Historical Data (Essential) ---
print("Loading historical data...")
try:
    full_data = pd.read_csv('data/cleaned_bangalore_data.csv', index_col='_time', parse_dates=True)
    print("Historical data loaded successfully.")
except FileNotFoundError:
    print("CRITICAL ERROR: 'data/cleaned_bangalore_data.csv' not found.")
    full_data = None # Set to None so app can still run but endpoints will fail gracefully
except Exception as e:
    print(f"CRITICAL ERROR loading data: {e}")
    full_data = None

# --- Step 2: Load All Models & Scalers (on startup) ---
print("Loading all models and scalers into memory...")
try:
    # Load Models
    model_xgb = joblib.load('xgboost_model_final.joblib')
    model_lstm = tf.keras.models.load_model('lstm_model_1step.keras')
    model_fusion = joblib.load('fusion_model.joblib')

    # Load Scalers
    scaler_x = joblib.load('lstm_x_scaler_1step.joblib')
    scaler_y = joblib.load('lstm_y_scaler_1step.joblib')
    
    print("All models loaded successfully.")
except FileNotFoundError as e:
    print(f"ERROR: Missing a model file. {e}")
    print("Please ensure all .joblib and .keras files are in the root directory.")
    # You might want to set models to None here if you want the app to run in a degraded state
except Exception as e:
    print(f"An error occurred during model loading: {e}")

#
# --- END OF FIX ---
#

# --- Re-implement Helper Functions ---
# We need these to process new data "on-the-fly"

def create_features_xgb(df, target_col):
    """Creates time and lag/rolling features for XGBoost"""
    df_copy = df.copy()
    df_copy['hour'] = df_copy.index.hour
    df_copy['dayofweek'] = df_copy.index.dayofweek
    df_copy['month'] = df_copy.index.month
    df_copy['quarter'] = df_copy.index.quarter
    df_copy['year'] = df_copy.index.year
    df_copy['dayofyear'] = df_copy.index.dayofyear
    df_copy[f'{target_col}_lag_1h'] = df_copy[target_col].shift(1)
    df_copy[f'{target_col}_lag_3h'] = df_copy[target_col].shift(3)
    df_copy[f'{target_col}_lag_24h'] = df_copy[target_col].shift(24)
    df_copy[f'{target_col}_roll_avg_3h'] = df_copy[target_col].rolling(window=3).mean().shift(1)
    df_copy[f'{target_col}_roll_avg_6h'] = df_copy[target_col].rolling(window=6).mean().shift(1)
    df_copy[f'{target_col}_roll_avg_24h'] = df_copy[target_col].rolling(window=24).mean().shift(1)
    return df_copy

def create_sequences_lstm(x_data, n_lookback):
    """Creates 3D sequences for LSTM"""
    X = []
    for i in range(len(x_data) - n_lookback + 1):
        X.append(x_data[i : (i + n_lookback)])
    return np.array(X)

# --- API Endpoints ---

@app.route('/api/v1/forecast/hourly', methods=['GET'])
def get_hourly_forecast():
    """
    Runs the full recursive forecast for the next 24 hours.
    This is the main prediction engine.
    """
    print("Received request for 24-hour forecast...")
    
    # Add check for failed data load
    if full_data is None:
        return jsonify({"error": "Historical data not loaded on server. Cannot make prediction."}), 500

    try:
        # 1. Get the most recent data (last 72+24 hours) from our historical DB
        # We need N_LOOKBACK (72) + N_LAG_MAX (24) = 96 hours
        base_data = full_data.iloc[-96:].copy()
        
        forecast_results = []
        
        # 2. Loop 24 times to predict the next 24 hours
        for _ in range(24):
            # 3. Get the most recent data available
            current_data_xgb = create_features_xgb(base_data, TARGET_COLUMN).iloc[-1:]
            current_data_lstm_raw = base_data[FEATURES_LSTM].iloc[-N_LOOKBACK:]
            
            # 4. Predict with XGBoost
            X_xgb = current_data_xgb[FEATURES_XGB]
            pred_xgb = model_xgb.predict(X_xgb)[0]
            
            # 5. Predict with LSTM
            X_lstm_scaled = scaler_x.transform(current_data_lstm_raw)
            X_lstm_seq = np.array([X_lstm_scaled]) # Reshape for one sample
            pred_lstm_scaled = model_lstm.predict(X_lstm_seq)
            pred_lstm = scaler_y.inverse_transform(pred_lstm_scaled)[0][0]
            
            # 6. Predict with Fusion Model
            X_meta = pd.DataFrame({'xgb_pred': [pred_xgb], 'lstm_pred': [pred_lstm]})
            pred_fusion = model_fusion.predict(X_meta)[0]
            
            # 7. Store the result
            next_timestamp = base_data.index[-1] + pd.Timedelta(hours=1)
            forecast_results.append({
                "timestamp": next_timestamp.isoformat(),
                "predicted_power": float(pred_fusion)
            })
            
            # 8. Add this prediction back to the data for the next loop (recursive)
            
            # Create a new row (a bit simplified)
            new_row = base_data.iloc[-1:].copy()
            new_row.index = [next_timestamp]
            new_row[TARGET_COLUMN] = pred_fusion
            # In a real system, you'd also predict other columns or use a multi-output model
            # For now, we'll just update the target and hope the lags cover the rest
            
            # Update other columns (e.g., set to last known value)
            for col in new_row.columns:
                if col != TARGET_COLUMN:
                    new_row[col] = base_data[col].iloc[-1]

            # Append the new predicted row
            base_data = pd.concat([base_data, new_row])
            
        print("Forecast generated successfully.")
        return jsonify(forecast_results)

    except Exception as e:
        print(f"Error in forecast: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/v1/alerts/check', methods=['GET'])
def check_alerts():
    """
    Checks the upcoming forecast for critical load alerts.
    """
    print("Received request for alert check...")
    
    # Add check for failed data load
    if full_data is None:
        return jsonify({"alerts": [{"level": "error", "message": "Cannot check alerts, data not loaded."}]})

    forecast_data = [] # Mock: In production, this would call get_hourly_forecast()
    
    alerts = []
    if not forecast_data:
        alerts.append({
            "timestamp": (pd.Timestamp.now() + pd.Timedelta(hours=4)).isoformat(),
            "level": "critical",
            "message": f"Demo Alert: Predicted load 512.5 MW exceeds {CRITICAL_LOAD_THRESHOLD} MW threshold."
        })
    
    return jsonify({"alerts": alerts})

@app.route('/api/v1/data/historical', methods=['GET'])
def get_historical_data():
    """
    Serves historical data for charts.
    """
    print("Received request for historical data...")
    
    # Add check for failed data load
    if full_data is None:
        return jsonify({"error": "Historical data not loaded on server."}), 500

    start_date = request.args.get('start', full_data.index.min().isoformat())
    end_date = '2021-08-17' # Hardcoding end date for stability
    
    try:
        data_subset = full_data.loc[start_date:end_date]
        if len(data_subset) > 1000:
            data_subset = data_subset.resample('D').mean()
            
        # Convert to records, handling NaNs for JSON
        data_subset = data_subset.reset_index()
        data_subset = data_subset.replace({np.nan: None})
        return jsonify(data_subset.to_dict('records'))
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/v1/model/performance', methods=['GET'])
def get_model_performance():
    """
    Serves the final MAPE scores for the frontend KPI cards.
    """
    print("Received request for model performance...")
    performance_metrics = {
        "xgboost_mape": 40.5542,
        "lstm_mape": 49.3340,
        "fusion_mape": 30.3778,
        "mape_unit": "%",
        "primary_model": "Hybrid Fusion",
        "last_trained": "2025-11-15" 
    }
    return jsonify(performance_metrics)

@app.route('/api/v1/static/plots/<path:filename>', methods=['GET'])
def get_plot(filename):
    """
    Serves the static plot images from your repository.
    """
    print(f"Received request for static plot: {filename}")
    try:
        return send_from_directory(app.root_path, filename)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404

# --- Main execution ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)