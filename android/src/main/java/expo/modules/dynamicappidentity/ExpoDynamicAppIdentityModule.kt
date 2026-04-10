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

class ExpoDynamicAppIdentityModule : Module() {
    
    companion object {
        private const val TAG = "ExpoDynamicAppIdentity"
        private const val DEFAULT_ICON = "DEFAULT"
    }
    
    private var currentIconName: String = DEFAULT_ICON
    
    override fun definition() = ModuleDefinition {
        Name("ExpoDynamicAppIdentity")
        
        OnCreate {
            appContext.currentActivity?.let { activity ->
                SharedObject.packageName = activity.packageName
                SharedObject.pm = activity.packageManager
            }
        }
        
        AsyncFunction("setAppIdentity") { iconName: String, immediate: Boolean, showToast: Boolean, delayMs: Double?, promise: Promise ->
            try {
                val activity = appContext.currentActivity
                if (activity == null) {
                    promise.reject("ERR_NO_ACTIVITY", "No current activity", null)
                    return@AsyncFunction
                }
                
                val packageManager = activity.packageManager
                val packageName = activity.packageName
                
                SharedObject.packageName = packageName
                SharedObject.pm = packageManager
                
                if (immediate) {
                    performIconSwitchImproved(activity, packageManager, packageName, iconName, showToast)
                    currentIconName = iconName
                    promise.resolve(true)
                } else {
                    SharedObject.pendingIcon = iconName
                    SharedObject.showToast = showToast
                    SharedObject.shouldChangeIcon = true
                    SharedObject.backgroundDelayMs = delayMs?.toLong() ?: 5000L
                    currentIconName = iconName
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                promise.reject("ERR_SWITCH_FAILED", "Failed to switch icon: ${e.message}", e)
            }
        }
        
        Function("getAppIdentity") {
            return@Function currentIconName
        }
        
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
                                val iconName = name.substringAfter("MainActivity")
                                if (iconName.isNotEmpty() && iconName != DEFAULT_ICON) {
                                    icons.add(iconName)
                                }
                            }
                        }
                    } catch (e: Exception) {
                    }
            
            return@Function icons
        }
    }
    
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
        
        packageManager.setComponentEnabledSetting(
            targetComponentName,
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            PackageManager.DONT_KILL_APP
        )
        
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
                }
            }
        }
        
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
    
    private fun getActivityAliases(packageManager: PackageManager, packageName: String): List<String> {
        val aliases = mutableListOf<String>()
        aliases.add(DEFAULT_ICON)
        
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
        }
        
        return aliases
    }
}
