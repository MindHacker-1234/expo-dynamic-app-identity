import ExpoModulesCore
import UIKit

/**
 * ExpoDynamicAppIdentityModule
 *
 * Native iOS module for dynamic app icon switching.
 *
 * Uses UIApplication.shared.setAlternateIconName for icon switching.
 * 
 * FIX: iOS Asset Catalogs require "AppIcon-{iconName}" format
 */
public class ExpoDynamicAppIdentityModule: Module {
    
    private var currentIconName: String = "DEFAULT"
    
    public func definition() -> ModuleDefinition {
        Name("ExpoDynamicAppIdentity")
        
        /**
         * Set the app icon
         *
         * @param iconName - Name of the icon to switch to, or "DEFAULT" for primary icon
         * @param immediate - Whether to switch immediately (iOS always switches immediately)
         * @param showToast - Whether to show toast (iOS: ignored - system alert always shown; Android: controls toast)
         * @param delayMs - Delay in milliseconds (iOS: ignored - always immediate; Android: used when immediate=false)
         * 
         * NOTE: iOS system alert cannot be suppressed - it's shown automatically by iOS when changing icons.
         * The showToast and delayMs parameters are only used on Android.
         */
        AsyncFunction("setAppIdentity") { (iconName: String, immediate: Bool, showToast: Bool, delayMs: Double?, promise: Promise) in
            DispatchQueue.main.async {
                guard UIApplication.shared.supportsAlternateIcons else {
                    promise.reject("ERR_NOT_SUPPORTED", "This device does not support alternate icons")
                    return
                }
                
                // FIX: Convert iconName to Asset Catalog format
                // User passes "icon2", but iOS Asset Catalog expects "AppIcon-icon2"
                var targetIconName: String? = nil
                if iconName != "DEFAULT" && !iconName.isEmpty {
                    // Check if it already has AppIcon prefix
                    if iconName.hasPrefix("AppIcon-") {
                        targetIconName = iconName
                    } else {
                        targetIconName = "AppIcon-\(iconName)"
                    }
                }
                
                print("[ExpoDynamicAppIdentity] Switching to icon: \(targetIconName ?? "primary")")
                
                UIApplication.shared.setAlternateIconName(targetIconName) { error in
                    if let error = error {
                        print("[ExpoDynamicAppIdentity] Error: \(error.localizedDescription)")
                        promise.reject("ERR_SWITCH_FAILED", "Failed to switch icon: \(error.localizedDescription)")
                    } else {
                        self.currentIconName = iconName.isEmpty ? "DEFAULT" : iconName
                        print("[ExpoDynamicAppIdentity] Successfully switched to: \(self.currentIconName)")
                        promise.resolve(true)
                    }
                }
            }
        }
        
        /**
         * Get the current app icon name
         */
        Function("getAppIdentity") { () -> String in
            if let alternateIconName = UIApplication.shared.alternateIconName {
                // Strip "AppIcon-" prefix for consistency with user's icon names
                if alternateIconName.hasPrefix("AppIcon-") {
                    return String(alternateIconName.dropFirst(8))
                }
                return alternateIconName
            }
            return "DEFAULT"
        }
        
        /**
         * Get list of available icons
         */
        Function("getAvailableIcons") { () -> [String] in
            var icons: [String] = []
            
            // Try Info.plist first
            if let bundleIcons = Bundle.main.object(forInfoDictionaryKey: "CFBundleIcons") as? [String: Any],
               let alternateIcons = bundleIcons["CFBundleAlternateIcons"] as? [String: Any] {
                icons = Array(alternateIcons.keys)
            }
            
            // If empty, try to find AppIcon-* asset catalogs
            if icons.isEmpty {
                // Return known icons from build settings
                // Note: This is a fallback, actual icons are defined at build time
                print("[ExpoDynamicAppIdentity] No icons found in Info.plist, using Asset Catalog naming")
            }
            
            return icons
        }
    }
}
