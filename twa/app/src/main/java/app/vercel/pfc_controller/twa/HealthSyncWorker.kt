package app.vercel.pfc_controller.twa

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.text.DateFormat
import java.util.Date
import java.util.concurrent.TimeUnit

class HealthSyncWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val settings = HealthSyncSettings(applicationContext)
        val now = DateFormat.getDateTimeInstance().format(Date())
        return try {
            val days = HealthSync.syncRecentDays(applicationContext)
            settings.lastResult = "$now 同期しました（${days}日分）"
            Result.success()
        } catch (e: Exception) {
            settings.lastResult = "$now ${e.message}"
            Result.retry()
        }
    }

    companion object {
        private const val PERIODIC_NAME = "health-sync"
        private val network = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        /** 6 時間ごとの定期同期を登録する（登録済みならそのまま） */
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<HealthSyncWorker>(6, TimeUnit.HOURS)
                .setConstraints(network)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(PERIODIC_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }

        fun syncNow(context: Context) {
            val request = OneTimeWorkRequestBuilder<HealthSyncWorker>()
                .setConstraints(network)
                .build()
            WorkManager.getInstance(context).enqueue(request)
        }
    }
}
