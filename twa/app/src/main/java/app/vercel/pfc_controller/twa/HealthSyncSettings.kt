package app.vercel.pfc_controller.twa

import android.content.Context

/** ヘルスケア連携の送信先（ログインメールと共有トークン）と、直近の同期結果を端末に持つ。 */
class HealthSyncSettings(context: Context) {
    private val prefs = context.getSharedPreferences("health_sync", Context.MODE_PRIVATE)

    var email: String
        get() = prefs.getString("email", "") ?: ""
        set(value) = prefs.edit().putString("email", value.trim()).apply()

    var token: String
        get() = prefs.getString("token", "") ?: ""
        set(value) = prefs.edit().putString("token", value.trim()).apply()

    var lastResult: String
        get() = prefs.getString("last_result", "") ?: ""
        set(value) = prefs.edit().putString("last_result", value).apply()

    val configured: Boolean get() = email.isNotEmpty() && token.isNotEmpty()
}
