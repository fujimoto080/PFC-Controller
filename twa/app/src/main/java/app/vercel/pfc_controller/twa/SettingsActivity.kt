package app.vercel.pfc_controller.twa

import android.os.Bundle
import android.text.InputType
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

/** ヘルスコネクト連携の送信先を入れて、権限を許可し、同期を始める画面。 */
class SettingsActivity : ComponentActivity() {
    private lateinit var settings: HealthSyncSettings
    private lateinit var email: EditText
    private lateinit var token: EditText
    private lateinit var status: TextView

    private val requestPermissions = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract(),
    ) { granted ->
        if (granted.containsAll(HealthSync.PERMISSIONS)) {
            HealthSyncWorker.schedule(this)
            HealthSyncWorker.syncNow(this)
            status.text = "同期を開始しました。結果はこの画面を開き直すと表示されます"
        } else {
            status.text = "ヘルスコネクトの権限がすべては許可されませんでした"
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = HealthSyncSettings(this)

        val padding = (16 * resources.displayMetrics.density).toInt()
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
        }
        email = EditText(this).apply {
            hint = "PFC Controller のログインメールアドレス"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            setText(settings.email)
        }
        token = EditText(this).apply {
            hint = "HEALTH_SYNC_TOKEN"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setText(settings.token)
        }
        val save = Button(this).apply {
            text = "保存して許可・同期"
            setOnClickListener { saveAndRequestPermissions() }
        }
        status = TextView(this).apply { text = settings.lastResult }

        listOf(email, token, save, status).forEach {
            layout.addView(
                it,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ),
            )
        }
        setContentView(layout)
    }

    private fun saveAndRequestPermissions() {
        settings.email = email.text.toString()
        settings.token = token.text.toString()
        if (!settings.configured) {
            status.text = "メールアドレスとトークンを入力してください"
            return
        }
        if (HealthConnectClient.getSdkStatus(this) != HealthConnectClient.SDK_AVAILABLE) {
            status.text = "ヘルスコネクトが利用できません（Play ストアでインストール・更新してください）"
            return
        }
        lifecycleScope.launch {
            val client = HealthConnectClient.getOrCreate(this@SettingsActivity)
            val granted = client.permissionController.getGrantedPermissions()
            if (granted.containsAll(HealthSync.PERMISSIONS)) {
                HealthSyncWorker.schedule(this@SettingsActivity)
                HealthSyncWorker.syncNow(this@SettingsActivity)
                status.text = "同期を開始しました"
            } else {
                requestPermissions.launch(HealthSync.PERMISSIONS)
            }
        }
    }
}
