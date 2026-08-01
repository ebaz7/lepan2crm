package com.payment.system;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class SyncWorker extends Worker {
    private static final String TAG = "SyncWorker";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String DEFAULT_SERVER_URL = "https://dlkam.ir";

    public SyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.d(TAG, "Background synchronization started...");
        
        try {
            // Retrieve configuration values from preferences (synchronized from web interface via Capacitor Storage API)
            SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            
            // Retrieve server url
            String serverUrl = prefs.getString("_cap_server_url", null);
            if (serverUrl == null) {
                serverUrl = prefs.getString("server_url", DEFAULT_SERVER_URL);
            }
            if (serverUrl == null || serverUrl.isEmpty()) {
                serverUrl = DEFAULT_SERVER_URL;
            }
            if (serverUrl.endsWith("/")) {
                serverUrl = serverUrl.substring(0, serverUrl.length() - 1);
            }

            // Retrieve username
            String username = prefs.getString("_cap_user_username", null);
            if (username == null) {
                username = prefs.getString("user_username", "");
            }

            // Retrieve role
            String role = prefs.getString("_cap_user_role", null);
            if (role == null) {
                role = prefs.getString("user_role", "");
            }

            // If no user is logged in, exit gracefully without errors
            if (username == null || username.isEmpty() || role == null || role.isEmpty()) {
                Log.d(TAG, "No user credentials synced yet. Skipping background sync.");
                return Result.success();
            }

            Log.d(TAG, "Syncing background notifications for " + username + " (" + role + ") with Server: " + serverUrl);
            
            // Fetch unread notifications with correct querying parameters expected by server.js
            String queryUrl = serverUrl + "/api/notifications?username=" + java.net.URLEncoder.encode(username, "UTF-8") + "&role=" + java.net.URLEncoder.encode(role, "UTF-8");
            URL url = new URL(queryUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("Content-Type", "application/json");
            
            int responseCode = conn.getResponseCode();
            if (responseCode == HttpURLConnection.HTTP_OK) {
                BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();

                Log.d(TAG, "Raw Response: " + response.toString());
                
                // Parse the response
                JSONArray notifications = new JSONArray(response.toString());
                int newNotifCount = 0;
                
                for (int i = 0; i < notifications.length(); i++) {
                    JSONObject notif = notifications.getJSONObject(i);
                    String id = notif.optString("id", "");
                    String title = notif.optString("title", "اعلان جدید");
                    String body = notif.optString("body", "");
                    
                    if (id.isEmpty()) continue;

                    // 1. Check if already marked as read by this user on the server
                    boolean isRead = false;
                    JSONArray readBy = notif.optJSONArray("readBy");
                    if (readBy != null && username != null && !username.isEmpty()) {
                        for (int j = 0; j < readBy.length(); j++) {
                            if (username.equalsIgnoreCase(readBy.optString(j, ""))) {
                                isRead = true;
                                break;
                            }
                        }
                    }

                    if (isRead) {
                        continue; // Already seen/read on the server, skip entirely!
                    }

                    // 2. Otherwise, check if already notified on this device locally (coherently shared with WebView)
                    String shownKey = "_cap_shown_" + id;
                    boolean isShown = false;
                    try {
                        String val = prefs.getString(shownKey, null);
                        if (val != null) {
                            isShown = "true".equalsIgnoreCase(val);
                        } else {
                            isShown = prefs.getBoolean(shownKey, false);
                        }
                    } catch (Exception castEx) {
                        try {
                            isShown = prefs.getBoolean(shownKey, false);
                        } catch (Exception ignored) {}
                    }

                    if (!isShown) {
                        if (newNotifCount < 3) {
                            // Show native notification
                            showNativeNotification(id, title, body);
                        }
                        
                        // Mark as shown locally
                        prefs.edit().putString(shownKey, "true").apply();
                        newNotifCount++;

                        // Mark as read/seen on the server immediately so other devices don't notify!
                        if (username != null && !username.isEmpty()) {
                            markNotificationAsReadOnServer(id, serverUrl, username);
                        }
                    }
                }
                Log.d(TAG, "Background sync completed successfully. Displayed/Marked " + newNotifCount + " new notifications.");
                return Result.success();
            } else {
                Log.e(TAG, "Server returned response code: " + responseCode);
                return Result.failure(); // Fail instead of retry to prevent WorkManager spam loop
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error performing background synchronization", e);
            return Result.failure(); // Clean failure so we do not spam retry sequence
        }
    }

    private void markNotificationAsReadOnServer(String id, String serverUrl, String username) {
        try {
            String readUrlStr = serverUrl + "/api/notifications/read";
            URL url = new URL(readUrlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setRequestProperty("Content-Type", "application/json");
            
            JSONObject body = new JSONObject();
            body.put("username", username);
            body.put("id", id);
            
            byte[] outputBytes = body.toString().getBytes("UTF-8");
            conn.getOutputStream().write(outputBytes);
            conn.getOutputStream().flush();
            conn.getOutputStream().close();
            
            int responseCode = conn.getResponseCode();
            Log.d(TAG, "Sent read status to server for notification: " + id + ". Response code: " + responseCode);
            
        } catch (Exception e) {
            Log.e(TAG, "Error marking notification as read on server: " + id, e);
        }
    }

    private void showNativeNotification(String id, String title, String body) {
        Context context = getApplicationContext();
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "fcm_default_channel";

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = notificationManager.getNotificationChannel(channelId);
            if (channel == null) {
                channel = new NotificationChannel(channelId, "اعلان‌های سیستم خروج و پرداخت", NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("کانال اصلی اعلان‌های پرداخت و برگه خروج کارخانه");
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{100, 200, 300, 400, 500, 400, 300, 200, 400});
                notificationManager.createNotificationChannel(channel);
            }
        }

        // Action when notification is clicked - Open MainActivity
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntent = PendingIntent.getActivity(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        } else {
            pendingIntent = PendingIntent.getActivity(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setOnlyAlertOnce(true)
                .setVibrate(new long[]{100, 200, 300, 400, 500});

        notificationManager.notify(id.hashCode(), builder.build());
    }
}
