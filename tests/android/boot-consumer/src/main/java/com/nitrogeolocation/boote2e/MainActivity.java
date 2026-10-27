package com.nitrogeolocation.boote2e;

import android.app.Activity;
import android.app.job.JobScheduler;
import android.os.Bundle;
import android.widget.TextView;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** A native consumer of the real library; never initializes background tracking or React Native. */
public class MainActivity extends Activity {
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        TextView text = new TextView(this);
        text.setTextSize(20);
        text.setPadding(24, 48, 24, 24);
        text.setText("Installed and launched. Ready for a real device reboot.\nBackground API unused.");
        if (getIntent().getBooleanExtra("verify_boot", false)) {
            try {
                JSONObject result = new JSONObject();
                result.put("pendingJobs", getSystemService(JobScheduler.class).getAllPendingJobs().size());
                result.put("backgroundDatabase", getDatabasePath("nitro_background_location.db").exists());
                try (FileOutputStream output = new FileOutputStream(new File(getFilesDir(), "boot-state.json"))) {
                    output.write(result.toString().getBytes(StandardCharsets.UTF_8));
                }
                text.setText("After reboot\n" + result.toString(2));
            } catch (Exception error) {
                throw new RuntimeException("Failed to record post-boot state", error);
            }
        }
        setContentView(text);
    }
}
