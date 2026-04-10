import ExpoModulesCore
import UIKit

public class ExpoDynamicAppIdentityModule: Module {
    
    private var currentIconName: String = "DEFAULT"
    
    public func definition() -> ModuleDefinition {
        Name("ExpoDynamicAppIdentity")
        
        AsyncFunction("setAppIdentity") { (iconName: String, immediate: Bool, showToast: Bool, delayMs: Double?, promise: Promise) in
            DispatchQueue.main.async {
                guard UIApplication.shared.supportsAlternateIcons else {
                    promise.reject("ERR_NOT_SUPPORTED", "This device does not support alternate icons")
                    return
                }
                
                var targetIconName: String? = nil
                if iconName != "DEFAULT" && !iconName.isEmpty {
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
        
        Function("getAppIdentity") { () -> String in
            if let alternateIconName = UIApplication.shared.alternateIconName {
                if alternateIconName.hasPrefix("AppIcon-") {
                    return String(alternateIconName.dropFirst(8))
                }
                return alternateIconName
            }
            return "DEFAULT"
        }
        
        Function("getAvailableIcons") { () -> [String] in
            var icons: [String] = []
            
            if let bundleIcons = Bundle.main.object(forInfoDictionaryKey: "CFBundleIcons") as? [String: Any],
               let alternateIcons = bundleIcons["CFBundleAlternateIcons"] as? [String: Any] {
                icons = Array(alternateIcons.keys)
            }
            
            return icons
        }
    }
}
