package app.vercel.pfc_controller.twa;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class NutritionWidgetProvider extends AppWidgetProvider {
    static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, NutritionWidgetProvider.class);
        int[] appWidgetIds = manager.getAppWidgetIds(componentName);
        onUpdateViews(context, manager, appWidgetIds);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        onUpdateViews(context, appWidgetManager, appWidgetIds);
    }

    private static void onUpdateViews(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        WidgetDataStore.WidgetData data = WidgetDataStore.load(context);

        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_nutrition);
            views.setTextViewText(R.id.widget_calories_value, data.calories + " kcal");
            views.setTextViewText(R.id.widget_protein_value, "P " + data.protein + " g");
            views.setTextViewText(R.id.widget_fat_value, "F " + data.fat + " g");
            views.setTextViewText(R.id.widget_carbs_value, "C " + data.carbs + " g");
            views.setTextViewText(R.id.widget_sync_date, "同期日: " + data.date);

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(context.getString(R.string.launchUrl)));
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    appWidgetId,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);

            manager.updateAppWidget(appWidgetId, views);
        }
    }
}
