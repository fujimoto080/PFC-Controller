package app.vercel.pfc_controller.twa

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

/** ヘルスコネクトから 1 日分の値を読み、PFC Controller の /api/health-sync に送る。 */
object HealthSync {
    private val JST = ZoneId.of("Asia/Tokyo")

    /** 遅れて届いたデータも拾えるよう、今日に加えて何日前まで送り直すか */
    private const val RESEND_DAYS = 1L

    val PERMISSIONS = setOf(
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(BodyFatRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND,
    )

    /** 今日と RESEND_DAYS 日前までを送る。送った日数を返す。 */
    suspend fun syncRecentDays(context: Context): Int {
        val settings = HealthSyncSettings(context)
        check(settings.configured) { "メールアドレスとトークンが未設定です" }
        val client = HealthConnectClient.getOrCreate(context)
        val granted = client.permissionController.getGrantedPermissions()
        check(granted.containsAll(PERMISSIONS)) { "ヘルスコネクトの権限が許可されていません" }

        val today = LocalDate.now(JST)
        var sent = 0
        for (offset in RESEND_DAYS downTo 0) {
            val body = readDay(client, today.minusDays(offset)) ?: continue
            body.put("email", settings.email)
            put(context, settings.token, body)
            sent++
        }
        return sent
    }

    /** その日に値がある項目だけを入れた body。1 つも無ければ null。 */
    private suspend fun readDay(client: HealthConnectClient, date: LocalDate): JSONObject? {
        val start = date.atStartOfDay(JST).toInstant()
        val end = minOf(date.plusDays(1).atStartOfDay(JST).toInstant(), Instant.now())
        val range = TimeRangeFilter.between(start, end)

        val totals = client.aggregate(
            AggregateRequest(
                metrics = setOf(
                    StepsRecord.COUNT_TOTAL,
                    ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,
                ),
                timeRangeFilter = range,
            ),
        )
        val weight = client.readRecords(
            ReadRecordsRequest(WeightRecord::class, range, ascendingOrder = false, pageSize = 1),
        ).records.firstOrNull()
        val bodyFat = client.readRecords(
            ReadRecordsRequest(BodyFatRecord::class, range, ascendingOrder = false, pageSize = 1),
        ).records.firstOrNull()

        val body = JSONObject().put("date", date.toString())
        var hasValue = false
        totals[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.let {
            body.put("caloriesBurned", it.inKilocalories)
            hasValue = true
        }
        totals[StepsRecord.COUNT_TOTAL]?.let {
            body.put("steps", it)
            hasValue = true
        }
        weight?.let {
            body.put("weightKg", it.weight.inKilograms)
            hasValue = true
        }
        bodyFat?.let {
            body.put("bodyFatPercent", it.percentage.value)
            hasValue = true
        }
        return if (hasValue) body else null
    }

    private suspend fun put(context: Context, token: String, body: JSONObject) =
        withContext(Dispatchers.IO) {
            val url = URL("https://${context.getString(R.string.hostName)}/api/health-sync")
            val connection = url.openConnection() as HttpURLConnection
            try {
                connection.requestMethod = "PUT"
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true
                connection.outputStream.use { it.write(body.toString().toByteArray()) }
                val code = connection.responseCode
                if (code !in 200..299) {
                    val message = connection.errorStream?.bufferedReader()?.readText().orEmpty()
                    error("同期に失敗しました（$code）$message")
                }
            } finally {
                connection.disconnect()
            }
        }
}
