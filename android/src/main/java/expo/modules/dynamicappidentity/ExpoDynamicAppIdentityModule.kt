package expo.modules.dynamicappidentity

import android.app.Activity
import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

/**
 * ExpoDynamicAppIdentityModule
 * 
 * Native Android module for dynamic app icon/label switching.
 * 
 * FIXES implemented:
 * - FIX #1: DEFAULT alias support (MainActivityDEFAULT)
 * - FIX #4: Immediate switch with IMPROVED ordering (enable first, disable others)
 * - FIX #5: Toast notifications for feedback
 * - FIX #7: Background switch via lifecycle listener (no app crash in release)
 */
class ExpoDynamicAppIdentityModule : Module() {
    
    companion object {
        private const val TAG = "ExpoDynamicAppIdentity"
        private const val DEFAULT_ICON = "DEFAULT"
    }
    
    // Store current icon name
    private var currentIconName: String = DEFAULT_ICON
    
    override fun definition() = ModuleDefinition {
        Name("ExpoDynamicAppIdentity")
        
        // Initialize SharedObject when module loads
        OnCreate {
            appContext.currentActivity?.let { activity ->
                SharedObject.packageName = activity.packageName
                SharedObject.pm = activity.packageManager
            }
        }
        
        /**
         * Set the app icon and label
         * 
         * @param iconName - Name of the icon to switch to, or "DEFAULT"
         * @param immediate - Whether to switch immediately (true) or on background (false)
         * @param showToast - Whether to show a toast notification
         * @param delayMs - Delay in milliseconds before switching when immediate=false (default: 5000)
         */
        AsyncFunction("setAppIdentity") { iconName: String, immediate: Boolean, showToast: Boolean, delayMs: Double?, promise: Promise ->
            try {
                val activity = appContext.currentActivity
                if (activity == null) {
                    promise.reject("ERR_NO_ACTIVITY", "No current activity", null)
                    return@AsyncFunction
                }
                
                val packageManager = activity.packageManager
                val packageName = activity.packageName
                
                // Update SharedObject
                SharedObject.packageName = packageName
                SharedObject.pm = packageManager
                
                if (immediate) {
                    // FIX #4 + #7: Immediate switch with IMPROVED ordering
                    performIconSwitchImproved(activity, packageManager, packageName, iconName, showToast)
                    currentIconName = iconName
                    promise.resolve(true)
                } else {
                    // FIX #7: Schedule for background switch via lifecycle listener
                    SharedObject.pendingIcon = iconName
                    SharedObject.showToast = showToast
                    SharedObject.shouldChangeIcon = true
                    // Use provided delay or default to 5000ms (5 seconds)
                    SharedObject.backgroundDelayMs = delayMs?.toLong() ?: 5000L
                    
                    // Don't show toast here - lifecycle listener will show it after switch completes
                    // (only if showToast is true)
                    
                    currentIconName = iconName
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                promise.reject("ERR_SWITCH_FAILED", "Failed to switch icon: ${e.message}", e)
            }
        }
        
        /**
         * Get the current app icon name
         */
        Function("getAppIdentity") {
            return@Function currentIconName
        }
        
        /**
         * Get list of available icons
         */
        Function("getAvailableIcons") {
            val activity = appContext.currentActivity ?: return@Function listOf<String>()
            val packageManager = activity.packageManager
            val packageName = activity.packageName
            
            val icons = mutableListOf<String>()
            
            try {
                val packageInfo = packageManager.getPackageInfo(
                    packageName,
                    PackageManager.GET_ACTIVITIES or PackageManager.GET_DISABLED_COMPONENTS
                )
                
                packageInfo.activities?.forEach { activityInfo ->
                    val name = activityInfo.name
                    if (name.contains("MainActivity") && name != ".MainActivity") {
                        // Extract icon name from MainActivity{IconName}
                        val iconName = name.substringAfter("MainActivity")
                        if (iconName.isNotEmpty() && iconName != DEFAULT_ICON) {
                            icons.add(iconName)
                        }
                    }
                }
            } catch (e: Exception) {
                // Return empty list on error
            }
            
            return@Function icons
        }
    }
    
    /**
     * IMPROVED icon switch with correct ordering:
     * 1. ENABLE target alias FIRST (ensures always ≥1 launcher active)
     * 2. DISABLE other aliases SECOND
     * 
     * This prevents app crash/exit in release builds.
     */
    private fun performIconSwitchImproved(
        activity: Activity,
        packageManager: PackageManager,
        packageName: String,
        iconName: String,
        showToast: Boolean
    ) {
        val targetAlias = if (iconName == DEFAULT_ICON || iconName.isEmpty()) {
            "DEFAULT"
        } else {
            iconName
        }
        
        val targetComponentName = ComponentName(packageName, "$packageName.MainActivity$targetAlias")
        
        // ============================================================
        // STEP 1: ENABLE TARGET FIRST (ensures always ≥1 launcher)
        // ============================================================
        packageManager.setComponentEnabledSetting(
            targetComponentName,
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            PackageManager.DONT_KILL_APP
        )
        
        // ============================================================
        // STEP 2: DISABLE all OTHER aliases (skip the one we just enabled)
        // ============================================================
        val aliasNames = getActivityAliases(packageManager, packageName)
        for (alias in aliasNames) {
            if (alias != targetAlias) {
                val componentName = ComponentName(packageName, "$packageName.MainActivity$alias")
                try {
                    packageManager.setComponentEnabledSetting(
                        componentName,
                        PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                        PackageManager.DONT_KILL_APP
                    )
                } catch (e: Exception) {
                    // Alias might not exist, ignore
                }
            }
        }
        
        // FIX #5: Show toast notification
        if (showToast) {
            Handler(Looper.getMainLooper()).post {
                val message = if (targetAlias == DEFAULT_ICON) {
                    "Switched to default icon"
                } else {
                    "Switched to $targetAlias"
                }
                Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    /**
     * Get list of activity alias names
     */
    private fun getActivityAliases(packageManager: PackageManager, packageName: String): List<String> {
        val aliases = mutableListOf<String>()
        aliases.add(DEFAULT_ICON) // Always include DEFAULT
        
        try {
            val packageInfo = packageManager.getPackageInfo(
                packageName,
                PackageManager.GET_ACTIVITIES or PackageManager.GET_DISABLED_COMPONENTS
            )
            
            packageInfo.activities?.forEach { activityInfo ->
                val name = activityInfo.name
                if (name.contains("MainActivity") && !name.endsWith(".MainActivity")) {
                    val aliasName = name.substringAfterLast("MainActivity")
                    if (aliasName.isNotEmpty() && !aliases.contains(aliasName)) {
                        aliases.add(aliasName)
                    }
                }
            }
        } catch (e: Exception) {
            // Return at least DEFAULT
        }
        
        return aliases
    }
}
