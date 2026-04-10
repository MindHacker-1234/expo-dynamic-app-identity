import { requireNativeModule, Platform } from 'expo-modules-core';

interface ExpoDynamicAppIdentityModuleType {
    setAppIdentity(iconName: string, immediate: boolean, showToast: boolean, delayMs?: number): Promise<boolean>;
    getAppIdentity(): string;
    getAvailableIcons(): string[];
}

let ExpoDynamicAppIdentityModule: ExpoDynamicAppIdentityModuleType | null = null;
try {
    ExpoDynamicAppIdentityModule = requireNativeModule('ExpoDynamicAppIdentity');
} catch (error) {
    console.warn('[expo-dynamic-app-identity] Native module not available. Using no-op fallback.');
}

export interface SetAppIdentityOptions {
    showToast?: boolean;
    immediate?: boolean;
    delay?: number;
}

export async function setAppIdentity(
    iconName: string | null | undefined,
    options: SetAppIdentityOptions = {}
): Promise<boolean> {
    const { showToast = true, immediate = true, delay } = options;

    const normalizedName = iconName === null || iconName === undefined || iconName === ''
        ? 'DEFAULT'
        : iconName;

    if (Platform.OS === 'web' || !ExpoDynamicAppIdentityModule) {
        console.log(`[expo-dynamic-app-identity] Would switch to: ${normalizedName} (no-op on web)`);
        return true;
    }

    try {
        const delayMs = delay !== undefined ? delay : undefined;
        const result = await ExpoDynamicAppIdentityModule.setAppIdentity(
            normalizedName,
            immediate,
            showToast,
            delayMs
        );
        return result;
    } catch (error) {
        console.error('[expo-dynamic-app-identity] Error switching icon:', error);
        return false;
    }
}

export const setAppIcon = setAppIdentity;

export function getAppIdentity(): string {
    if (Platform.OS === 'web' || !ExpoDynamicAppIdentityModule) {
        return 'DEFAULT';
    }
    try {
        return ExpoDynamicAppIdentityModule.getAppIdentity() || 'DEFAULT';
    } catch (error) {
        console.error('[expo-dynamic-app-identity] Error getting current icon:', error);
        return 'DEFAULT';
    }
}

export const getAppIcon = getAppIdentity;

export function getAvailableIcons(): string[] {
    if (Platform.OS === 'web' || !ExpoDynamicAppIdentityModule) {
        return ['DEFAULT'];
    }
    try {
        const icons = ExpoDynamicAppIdentityModule.getAvailableIcons() || [];
        return ['DEFAULT', ...icons];
    } catch (error) {
        console.error('[expo-dynamic-app-identity] Error getting available icons:', error);
        return ['DEFAULT'];
    }
}

export default {
    setAppIdentity,
    setAppIcon,
    getAppIdentity,
    getAppIcon,
    getAvailableIcons,
};
