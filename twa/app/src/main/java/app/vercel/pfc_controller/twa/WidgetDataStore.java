package app.vercel.pfc_controller.twa;

import android.content.Context;
import android.content.SharedPreferences;

class WidgetDataStore {
    private static final String PREF_NAME = "widget_data";
    private static final String KEY_CALORIES = "calories";
    private static final String KEY_PROTEIN = "protein";
    private static final String KEY_FAT = "fat";
    private static final String KEY_CARBS = "carbs";
    private static final String KEY_DATE = "date";

    static void save(Context context, WidgetData data) {
        SharedPreferences preferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        preferences.edit()
                .putString(KEY_CALORIES, data.calories)
                .putString(KEY_PROTEIN, data.protein)
                .putString(KEY_FAT, data.fat)
                .putString(KEY_CARBS, data.carbs)
                .putString(KEY_DATE, data.date)
                .apply();
    }

    static WidgetData load(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return new WidgetData(
                preferences.getString(KEY_CALORIES, "0"),
                preferences.getString(KEY_PROTEIN, "0"),
                preferences.getString(KEY_FAT, "0"),
                preferences.getString(KEY_CARBS, "0"),
                preferences.getString(KEY_DATE, "未同期")
        );
    }

    static class WidgetData {
        final String calories;
        final String protein;
        final String fat;
        final String carbs;
        final String date;

        WidgetData(String calories, String protein, String fat, String carbs, String date) {
            this.calories = calories;
            this.protein = protein;
            this.fat = fat;
            this.carbs = carbs;
            this.date = date;
        }
    }
}
