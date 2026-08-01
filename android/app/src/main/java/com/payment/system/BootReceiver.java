package com.payment.system;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.i(TAG, "Phone booted. Scheduling WorkManager background sync...");
            try {
                Constraints constraints = new Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build();

                PeriodicWorkRequest syncRequest = new PeriodicWorkRequest.Builder(
                        SyncWorker.class,
                        15, TimeUnit.MINUTES
                )
                .setConstraints(constraints)
                .build();

                WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                        "BackgroundDataSync",
                        ExistingPeriodicWorkPolicy.KEEP,
                        syncRequest
                );
                Log.i(TAG, "WorkManager scheduled successfully from BootReceiver.");
            } catch (Exception e) {
                Log.e(TAG, "Failed to schedule WorkManager background sync on boot", e);
            }
        }
    }
}
