package expo.modules.dynamicappidentity

import android.content.pm.PackageManager

object SharedObject {
    var packageName: String = ""
    var pendingIcon: String = ""
    var pendingLabel: String = ""
    var pm: PackageManager? = null
    var shouldChangeIcon: Boolean = false
    var showToast: Boolean = true
    var backgroundDelayMs: Long = 5000L
    
    fun reset() {
        pendingIcon = ""
        pendingLabel = ""
        shouldChangeIcon = false
        showToast = true
        backgroundDelayMs = 5000L
    }
}

