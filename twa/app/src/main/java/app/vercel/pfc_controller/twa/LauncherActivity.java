/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package app.vercel.pfc_controller.twa;

import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        syncWidgetData(getIntent() != null ? getIntent().getData() : null);
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        Uri uri = super.getLaunchingUrl();
        if (uri != null && "pfcwidget".equals(uri.getScheme()) && "sync".equals(uri.getHost())) {
            return Uri.parse(getString(R.string.launchUrl));
        }
        return uri;
    }

    private void syncWidgetData(Uri uri) {
        if (uri == null || !"pfcwidget".equals(uri.getScheme()) || !"sync".equals(uri.getHost())) {
            return;
        }

        String calories = getQueryValue(uri, "calories", "0");
        String protein = getQueryValue(uri, "protein", "0");
        String fat = getQueryValue(uri, "fat", "0");
        String carbs = getQueryValue(uri, "carbs", "0");
        String date = getQueryValue(uri, "date", "未同期");

        WidgetDataStore.save(this, new WidgetDataStore.WidgetData(calories, protein, fat, carbs, date));
        NutritionWidgetProvider.updateAllWidgets(this);
    }

    private String getQueryValue(Uri uri, String key, String defaultValue) {
        String value = uri.getQueryParameter(key);
        return value == null || value.trim().isEmpty() ? defaultValue : value;
    }
}
