package id.alamin.yayasan;

import android.content.Intent;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.app.NotificationManager;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends ComponentActivity {

  private static final String HOME_URL =
          "https://yayasan-alamin-almaarif.netlify.app/app.html";

  private WebView webView;

  private ValueCallback<Uri[]> filePathCallback;

  private final ActivityResultLauncher<String> notificationPermissionLauncher =
          registerForActivityResult(
                  new ActivityResultContracts.RequestPermission(),
                  granted -> subscribeToAnnouncements()
          );

  // =========================================================
  // FILE PICKER
  // =========================================================

  private final ActivityResultLauncher<Intent> fileChooserLauncher =
          registerForActivityResult(
                  new ActivityResultContracts.StartActivityForResult(),
                  result -> {

                    if (filePathCallback == null) {
                      return;
                    }

                    Uri[] results = new Uri[0];

                    if (result.getResultCode() == RESULT_OK
                            && result.getData() != null) {

                      Intent data = result.getData();

                      if (data.getClipData() != null) {

                        int count =
                                data.getClipData().getItemCount();

                        results = new Uri[count];

                        for (int i = 0; i < count; i++) {
                          results[i] =
                                  data.getClipData()
                                          .getItemAt(i)
                                          .getUri();
                        }

                      } else if (data.getData() != null) {

                        results = new Uri[]{
                                data.getData()
                        };
                      }
                    }

                    filePathCallback.onReceiveValue(results);
                    filePathCallback = null;
                  }
          );

  // =========================================================
  // ON CREATE
  // =========================================================

  @Override
  protected void onCreate(Bundle savedInstanceState) {

    super.onCreate(savedInstanceState);

    webView = new WebView(this);

    setContentView(webView);

    configureWebView();
    setupNotifications();

    if (savedInstanceState == null) {

      webView.loadUrl(HOME_URL);

    } else {

      webView.restoreState(savedInstanceState);
    }

    setupBackButton();
  }

  private void setupNotifications() {

    NotificationManager notificationManager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

    YayasanMessagingService.createChannel(notificationManager);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED) {

      notificationPermissionLauncher.launch(
              android.Manifest.permission.POST_NOTIFICATIONS
      );
      return;
    }

    subscribeToAnnouncements();
  }

  private void subscribeToAnnouncements() {

    FirebaseMessaging.getInstance()
            .subscribeToTopic("all")
            .addOnFailureListener(error -> {
              // Pengguna tetap dapat memakai aplikasi bila FCM sedang tidak tersedia.
            });
  }

  // =========================================================
  // WEBVIEW CONFIGURATION
  // =========================================================

  private void configureWebView() {

    // JavaScript diperlukan oleh aplikasi web
    webView.getSettings().setJavaScriptEnabled(true);

    // Supabase/session/localStorage
    webView.getSettings().setDomStorageEnabled(true);

    // Tampilan mengikuti layar HP
    webView.getSettings().setLoadWithOverviewMode(false);
    webView.getSettings().setUseWideViewPort(false);

    // Nonaktifkan zoom bawaan
    webView.getSettings().setBuiltInZoomControls(false);
    webView.getSettings().setDisplayZoomControls(false);

    // Keamanan akses file
    webView.getSettings().setAllowFileAccess(false);
    webView.getSettings().setAllowContentAccess(true);

    // =====================================================
    // COOKIE
    // =====================================================

    CookieManager cookieManager =
            CookieManager.getInstance();

    cookieManager.setAcceptCookie(true);

    cookieManager.setAcceptThirdPartyCookies(
            webView,
            true
    );

    // =====================================================
    // WEBVIEW CLIENT
    // =====================================================

    webView.setWebViewClient(new WebViewClient() {

      @Override
      public boolean shouldOverrideUrlLoading(
              WebView view,
              WebResourceRequest request) {

        return handleUrl(
                view,
                request.getUrl()
        );
      }
    });

    // =====================================================
    // FILE UPLOAD
    // =====================================================

    webView.setWebChromeClient(new WebChromeClient() {

      @Override
      public boolean onShowFileChooser(
              WebView webView,
              ValueCallback<Uri[]> callback,
              FileChooserParams fileChooserParams) {

        if (filePathCallback != null) {

          filePathCallback.onReceiveValue(
                  new Uri[0]
          );
        }

        filePathCallback = callback;

        try {

          Intent intent =
                  fileChooserParams.createIntent();

          fileChooserLauncher.launch(intent);

          return true;

        } catch (Exception e) {

          filePathCallback = null;

          return false;
        }
      }
    });
  }

  // =========================================================
  // URL HANDLER
  // =========================================================

  private boolean handleUrl(
          WebView view,
          Uri uri) {

    String scheme = uri.getScheme();
    String host = uri.getHost();

    // =====================================================
    // WHATSAPP
    // =====================================================

    if ("whatsapp".equalsIgnoreCase(scheme)
            || "wa.me".equalsIgnoreCase(host)
            || "api.whatsapp.com".equalsIgnoreCase(host)
            || "web.whatsapp.com".equalsIgnoreCase(host)) {

      try {

        Intent intent =
                new Intent(
                        Intent.ACTION_VIEW,
                        uri
                );

        startActivity(intent);

      } catch (Exception ignored) {
      }

      return true;
    }

    // =====================================================
    // LINK NON HTTP/HTTPS
    // Contoh: tel:, mailto:, intent:, dll.
    // =====================================================

    if (!"http".equalsIgnoreCase(scheme)
            && !"https".equalsIgnoreCase(scheme)) {

      try {

        Intent intent =
                new Intent(
                        Intent.ACTION_VIEW,
                        uri
                );

        startActivity(intent);

      } catch (Exception ignored) {
      }

      return true;
    }

    // =====================================================
    // WEBSITE YAYASAN
    // Tetap di dalam WebView
    // =====================================================

    if ("yayasan-alamin-almaarif.netlify.app"
            .equalsIgnoreCase(host)) {

      String path = uri.getPath();

      // Google OAuth untuk PPDB dan Arsip harus berjalan di Chrome,
      // bukan di Android WebView.
      if (path != null
              && (path.startsWith("/dashboard/")
              || path.startsWith("/arsip/"))) {

        openExternalApp(uri);
        return true;
      }

      return false;
    }

    // =====================================================
    // WEBSITE EKSTERNAL
    // Buka di browser/aplikasi eksternal
    // =====================================================

    openExternalApp(uri);

    return true;
  }

  private void openExternalApp(Uri uri) {

    try {

      Intent intent =
              new Intent(
                      Intent.ACTION_VIEW,
                      uri
              );

      startActivity(intent);

    } catch (Exception ignored) {
    }
  }

  // =========================================================
  // BACK BUTTON
  // =========================================================

  private void setupBackButton() {

    getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {

              @Override
              public void handleOnBackPressed() {

                if (webView == null) {
                  finish();
                  return;
                }

                // Jika masih punya history,
                // kembali ke halaman sebelumnya.
                if (webView.canGoBack()) {

                  webView.goBack();

                  return;
                }

                String currentUrl =
                        webView.getUrl();

                // Jika bukan Home,
                // kembali ke Home terlebih dahulu.
                if (currentUrl == null
                        || !currentUrl.equals(HOME_URL)) {

                  webView.loadUrl(HOME_URL);

                  return;
                }

                // Kalau sudah Home,
                // baru tutup APK.
                finish();
              }
            }
    );
  }

  // =========================================================
  // SAVE WEBVIEW STATE
  // =========================================================

  @Override
  protected void onSaveInstanceState(
          Bundle outState) {

    if (webView != null) {

      webView.saveState(outState);
    }

    super.onSaveInstanceState(outState);
  }

  // =========================================================
  // CLEANUP
  // =========================================================

  @Override
  protected void onDestroy() {

    if (webView != null) {

      webView.stopLoading();

      webView.destroy();

      webView = null;
    }

    super.onDestroy();
  }
}
