package id.alamin.yayasan;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class YayasanMessagingService extends FirebaseMessagingService {

    public static final String CHANNEL_ID = "pengumuman_yayasan";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        String title = message.getNotification() != null
                ? message.getNotification().getTitle()
                : message.getData().get("title");
        String body = message.getNotification() != null
                ? message.getNotification().getBody()
                : message.getData().get("body");

        showNotification(
                title == null || title.trim().isEmpty() ? "Yayasan Al-Amin" : title,
                body == null ? "Ada pengumuman baru." : body
        );
    }

    public static void createChannel(NotificationManager manager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Pengumuman Yayasan",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Informasi penting dari Yayasan Al-Amin Al-Ma'arif.");
            manager.createNotificationChannel(channel);
        }
    }

    private void showNotification(String title, String body) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.logo)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        NotificationManagerCompat.from(this).notify(
                (int) (System.currentTimeMillis() & 0xfffffff),
                builder.build()
        );
    }
}
