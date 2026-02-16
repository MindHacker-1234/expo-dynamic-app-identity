/**
 * @praneeth26/expo-dynamic-app-identity
 *
 * Runtime API for switching app icon and label dynamically.
 *
 * Usage:
 *   import { setAppIdentity, getAppIdentity } from '@praneeth26/expo-dynamic-app-identity';
 *
 *   // Switch to a named icon (defined in app.json)
 *   await setAppIdentity('iconName');
 *
 *   // Switch back to default
 *   await setAppIdentity(null);
 *
 *   // Get current icon name
 *   const current = getAppIdentity();
 */

import { requireNativeModule, Platform } from 'expo-modules-core';

// Types for the native module
interface ExpoDynamicAppIdentityModuleType {
    setAppIdentity(iconName: string, immediate: boolean, showToast: boolean, delayMs?: number): Promise<boolean>;
    getAppIdentity(): string;
    getAvailableIcons(): string[];
}

// Try to load native module, with fallback for web
let ExpoDynamicAppIdentityModule: ExpoDynamicAppIdentityModuleType | null = null;
try {
    ExpoDynamicAppIdentityModule = requireNativeModule('ExpoDynamicAppIdentity');
} catch (error) {
    // Module not available (web or native module not linked)
    console.warn('[@praneeth26/expo-dynamic-app-identity] Native module not available. Using no-op fallback.');
}

/**
 * Options for setAppIdentity
 */
export interface SetAppIdentityOptions {
    /**
     * Whether to show a toast notification after switching (Android only)
     * Default: true
     */
    showToast?: boolean;
    /**
     * Whether to switch immediately or wait for app to go to background
     * Default: true (immediate)
     *
     * FIX #4: We support immediate switching, unlike community plugins
     */
    immediate?: boolean;
    /**
     * Delay in milliseconds before switching when immediate=false (Android only)
     * Default: 5000 (5 seconds)
     * Only used when immediate=false
     */
    delay?: number;
}

/**
 * Set the app icon and label
 *
 * @param iconName - The name of the icon to switch to, or null/undefined/'DEFAULT' for default
 * @param options - Optional configuration for the switch
 * @returns Promise that resolves when the switch is complete
 *
 * @example
 * // Switch to "premium" icon
 * await setAppIdentity('premium');
 *
 * // Switch back to default
 * await setAppIdentity(null);
 *
 * // Switch without toast notification
 * await setAppIdentity('premium', { showToast: false });
 *
 * // Switch when app goes to background (old behavior)
 * await setAppIdentity('premium', { immediate: false });
 *
 * // Switch with custom delay (3 seconds instead of default 5)
 * await setAppIdentity('premium', { immediate: false, delay: 3000 });
 */
export async function setAppIdentity(
    iconName: string | null | undefined,
    options: SetAppIdentityOptions = {}
): Promise<boolean> {
    const { showToast = true, immediate = true, delay } = options;

    // Normalize icon name
    const normalizedName = iconName === null || iconName === undefined || iconName === ''
        ? 'DEFAULT'
        : iconName;

    // Web fallback - no-op
    if (Platform.OS === 'web' || !ExpoDynamicAppIdentityModule) {
        console.log(`[@praneeth26/expo-dynamic-app-identity] Would switch to: ${normalizedName} (no-op on web)`);
        return true;
    }

    try {
        // FIX #4 & #5: Call native module with immediate flag, toast option, and delay
        // delay is only used when immediate=false (Android background switch)
        const delayMs = delay !== undefined ? delay : undefined;
        const result = await ExpoDynamicAppIdentityModule.setAppIdentity(
            normalizedName,
            immediate,
            showToast,
            delayMs
        );
        return result;
    } catch (error) {
        console.error('[@praneeth26/expo-dynamic-app-identity] Error switching icon:', error);
        return false;
    }
}

/**
 * Alias for setAppIdentity for backward compatibility with community plugins
 */
export const setAppIcon = setAppIdentity;

/**
 * Get the current app icon name
 *
 * @returns The current icon name, or 'DEFAULT' if using default icon
 *
 * @example
 * const currentIcon = getAppIdentity();
 * console.log(currentIcon); // 'premium' or 'DEFAULT'
 */
export function getAppIdentity(): string {
    if (Platform.OS === 'web' || !ExpoDynamicAppIdentityModule) {
        return 'DEFAULT';
    }
    try {
        return ExpoDynamicAppIdentityModule.getAppIdentity() || 'DEFAULT';
    } catch (error) {
        console.error('[@praneeth26/expo-dynamic-app-identity] Error getting current icon:', error);
        return 'DEFAULT';
    }
}

/**
 * Alias for getAppIdentity for backward compatibility with community plugins
 */
export const getAppIcon = getAppIdentity;

/**
 * Get list of available icon names (as configured in app.json)
 *
 * @returns Array of available icon names, always includes 'DEFAULT'
 */
export function getAvailableIcons(): string[] {
    if (Platform.OS === 'web' || !ExpoDynamicAppIdentityModule) {
        return ['DEFAULT'];
    }
    try {
        const icons = ExpoDynamicAppIdentityModule.getAvailableIcons() || [];
        return ['DEFAULT', ...icons];
    } catch (error) {
        console.error('[@praneeth26/expo-dynamic-app-identity] Error getting available icons:', error);
        return ['DEFAULT'];
    }
}

// Default export
export default {
    setAppIdentity,
    setAppIcon,
    getAppIdentity,
    getAppIcon,
    getAvailableIcons,
};
