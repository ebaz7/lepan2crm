package com.payment.system;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final String PREFS_NAME = "CapacitorStorage";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Log.d(TAG, "Initializing MainActivity...");

        // Save server URL in native SharedPreferences on start so SyncWorker has immediate access to it
        saveWebServerUrlToSharedPreferences();

        // Enqueue the WorkManager background synchronization task
        setupScheduler();
    }

    private void saveWebServerUrlToSharedPreferences() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            // Save the production server URL as default so that it is persists immediately
            String existingUrl = prefs.getString("server_url", "");
            if (existingUrl == null || existingUrl.isEmpty()) {
                prefs.edit().putString("server_url", "https://dlkam.ir").apply();
                Log.d(TAG, "Stored fallback server URL (https://dlkam.ir) in Capacitor SharedPreferences.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to store server URL in SharedPreferences", e);
        }
    }

    private void setupScheduler() {
        Log.i(TAG, "Scheduling WorkManager Background Sync Task...");
        try {
            // Setup WorkManager Constraints
            Constraints constraints = new Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build();

            // Setup Periodic Work Request (Minimum interval is 15 minutes by Android specification)
            PeriodicWorkRequest syncRequest = new PeriodicWorkRequest.Builder(
                    SyncWorker.class,
                    15, TimeUnit.MINUTES
            )
            .setConstraints(constraints)
            .build();

            // Enqueue unique periodic work to avoid duplicate schedulers on restart
            WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                    "BackgroundDataSync",
                    ExistingPeriodicWorkPolicy.KEEP,
                    syncRequest
            );
            
            Log.i(TAG, "WorkManager Background Sync Task successfully registered.");
        } catch (Exception e) {
            Log.e(TAG, "Error setting up WorkManager Background Sync Task", e);
        }
    }
}
