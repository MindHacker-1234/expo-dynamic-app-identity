package expo.modules.dynamicappidentity

import android.content.pm.PackageManager

/**
 * Shared state between Module and Lifecycle Listener
 * Stores pending icon change information
 */
object SharedObject {
    var packageName: String = ""
    var pendingIcon: String = ""
    var pendingLabel: String = ""
    var pm: PackageManager? = null
    var shouldChangeIcon: Boolean = false
    var showToast: Boolean = true
    
    // Delay in milliseconds before changing icon when app goes to background
    // Default: 5000ms (5 seconds)
    var backgroundDelayMs: Long = 5000L
    
    fun reset() {
        pendingIcon = ""
        pendingLabel = ""
        shouldChangeIcon = false
        showToast = true
        backgroundDelayMs = 5000L
    }
}

