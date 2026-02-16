package expo.modules.dynamicappidentity

import android.app.Activity
import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/**
 * Lifecycle listener that applies icon changes when app goes to background.
 * This prevents the app from crashing/exiting when icon is changed.
 * 
 * FIX: Unlike community plugin, we ENABLE target first, then DISABLE others.
 * This ensures there's always at least one enabled launcher activity.
 */
class ExpoDynamicAppIdentityReactActivityLifecycleListener : ReactActivityLifecycleListener {

    companion object {
        private const val TAG = "DynamicAppIdentity"
        private const val DEFAULT_ICON = "DEFAULT"
    }

    private var currentActivity: Activity? = null
    private var isInBackground = false
    private val handler = Handler(Looper.getMainLooper())
    
    private val backgroundCheckRunnable = Runnable {
        if (isInBackground && SharedObject.shouldChangeIcon) {
            Log.i(TAG, "Background delay complete, applying icon change")
            currentActivity?.let { applyIconChange(it) }
        }
    }

    override fun onPause(activity: Activity) {
        currentActivity = activity
        isInBackground = true
        
        if (SharedObject.shouldChangeIcon) {
            val delay = SharedObject.backgroundDelayMs
            Log.i(TAG, "onPause: Scheduling icon change with ${delay}ms delay")
            handler.postDelayed(backgroundCheckRunnable, delay)
        }
    }

    override fun onResume(activity: Activity) {
        currentActivity = activity
        isInBackground = false
        handler.removeCallbacks(backgroundCheckRunnable)
        Log.i(TAG, "onResume: Cancelled pending icon change")
    }

    override fun onDestroy(activity: Activity) {
        handler.removeCallbacks(backgroundCheckRunnable)
        
        if (SharedObject.shouldChangeIcon) {
            Log.i(TAG, "onDestroy: Applying pending icon change")
            applyIconChange(activity)
        }
        
        if (currentActivity === activity) {
            currentActivity = null
        }
    }

    /**
     * Apply the icon change with IMPROVED ordering:
     * 1. ENABLE target alias FIRST
     * 2. DISABLE other aliases SECOND
     * 
     * This ensures there's always at least one enabled launcher activity.
     */
    private fun applyIconChange(activity: Activity) {
        val targetIcon = SharedObject.pendingIcon
        if (targetIcon.isEmpty()) {
            Log.w(TAG, "No pending icon to apply")
            SharedObject.reset()
            return
        }

        val pm = SharedObject.pm ?: activity.packageManager
        val packageName = SharedObject.packageName.ifEmpty { activity.packageName }
        
        // Determine target alias name
        val targetAlias = if (targetIcon == DEFAULT_ICON || targetIcon.isEmpty()) {
            "$packageName.MainActivityDEFAULT"
        } else {
            "$packageName.MainActivity$targetIcon"
        }

        try {
            // Get all activities including disabled ones
            val packageInfo = pm.getPackageInfo(
                packageName,
                PackageManager.GET_ACTIVITIES or PackageManager.GET_DISABLED_COMPONENTS
            )

            val targetComponent = ComponentName(packageName, targetAlias)
            
            // Verify target exists
            val targetExists = packageInfo.activities?.any { 
                it.name == targetAlias || it.name == ".MainActivity${if (targetIcon == DEFAULT_ICON) "DEFAULT" else targetIcon}"
            } == true
            
            if (!targetExists) {
                Log.e(TAG, "Target alias does not exist: $targetAlias")
                SharedObject.reset()
                return
            }

            // ============================================================
            // FIX: ENABLE TARGET FIRST (ensures always ≥1 launcher active)
            // ============================================================
            Log.i(TAG, "Step 1: Enabling target alias: $targetAlias")
            pm.setComponentEnabledSetting(
                targetComponent,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP
            )

            // ============================================================
            // Step 2: DISABLE all other MainActivity* aliases
            // ============================================================
            packageInfo.activities?.forEach { activityInfo ->
                val activityName = activityInfo.name
                
                // Only process MainActivity aliases (not the base MainActivity)
                if (activityName.contains("MainActivity") && 
                    activityName != ".MainActivity" &&
                    activityName != "$packageName.MainActivity" &&
                    activityName != targetAlias &&
                    !activityName.endsWith(".MainActivity${if (targetIcon == DEFAULT_ICON) "DEFAULT" else targetIcon}")) {
                    
                    val componentName = ComponentName(packageName, activityName)
                    val currentState = pm.getComponentEnabledSetting(componentName)
                    
                    if (currentState != PackageManager.COMPONENT_ENABLED_STATE_DISABLED) {
                        Log.i(TAG, "Step 2: Disabling alias: $activityName")
                        pm.setComponentEnabledSetting(
                            componentName,
                            PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                            PackageManager.DONT_KILL_APP
                        )
                    }
                }
            }

            Log.i(TAG, "Icon change complete: $targetIcon")

            // Show toast if requested
            if (SharedObject.showToast) {
                Handler(Looper.getMainLooper()).post {
                    val message = if (targetIcon == DEFAULT_ICON) {
                        "Switched to default icon"
                    } else {
                        "Switched to $targetIcon"
                    }
                    Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error applying icon change", e)
        } finally {
            SharedObject.reset()
        }
    }
}

