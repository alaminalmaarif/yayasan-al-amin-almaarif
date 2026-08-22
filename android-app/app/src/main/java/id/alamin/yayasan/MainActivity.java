package id.alamin.yayasan;

import android.app.Activity;
import android.os.Bundle;
import android.net.Uri;
import androidx.browser.customtabs.CustomTabsIntent;

public class MainActivity extends Activity {
  private static final String APP_URL = "https://yayasan-alamin-almaarif.netlify.app/app.html";
  @Override protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    try {
      CustomTabsIntent intent = new CustomTabsIntent.Builder().build();
      intent.launchUrl(this, Uri.parse(APP_URL));
    } catch (Exception e) {
      startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse(APP_URL)));
    }
  }
}
