package expo.modules.dynamicappidentity

import android.content.Context
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/**
 * Package that registers the lifecycle listener for background icon switching
 */
class ExpoDynamicAppIdentityPackage : Package {
    
    override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> {
        return listOf(ExpoDynamicAppIdentityReactActivityLifecycleListener())
    }
}

