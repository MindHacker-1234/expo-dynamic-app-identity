/**
 * @praneeth26/expo-dynamic-app-identity
 *
 * Expo Config Plugin for Dynamic App Icon and Label Management
 *
 * Features:
 * - Dynamic app icon switching at runtime
 * - Dynamic app label/name switching (Android)
 * - Safe activity-alias management with DEFAULT fallback
 * - Deep link preservation across icon switches
 * - Adaptive icon support (Android)
 * - Dark mode icon variants (iOS 18+)
 * - Background switching with lifecycle awareness
 * - Native toast notifications
 *
 * 1. ✅ DEFAULT alias - Creates MainActivityDEFAULT to prevent crashes
 * 2. ✅ Intent filter migration - Moves deep links from MainActivity to aliases
 * 3. ✅ App label switching - Supports label property per icon
 * 4. ✅ Immediate switch - No forced 5-second delay
 * 5. ✅ Toast feedback - Shows native toast on switch
 * 6. ✅ Proper resource generation - Uses @expo/image-utils correctly
 * 7. ✅ Lifecycle listener - Background switch for release builds
 * 8. ✅ Label-only mode - Use default icon with custom label
 * 9. ✅ iOS Asset Catalog - Proper .appiconset support
 */

import {
    ConfigPlugin,
    withAndroidManifest,
    withDangerousMod,
    withXcodeProject,
    withInfoPlist,
    AndroidConfig,
} from '@expo/config-plugins';
import { generateImageAsync } from '@expo/image-utils';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface AndroidAdaptiveIconConfig {
    foregroundImage: string;
    backgroundColor: string;
}

interface IosVariants {
    light?: string;
    dark?: string;
    tinted?: string;
}

export interface IconConfig {
    /** Path to the icon image (relative to project root) */
    image?: string;
    /** Optional: Path to Android-specific icon or adaptive config */
    android?: string | AndroidAdaptiveIconConfig;
    androidImage?: string;
    /** Optional: Path to iOS-specific icon or variants */
    ios?: string | IosVariants;
    iosImage?: string;
    /** App label/name to display when this icon is active (Android only) */
    label?: string;
    /** iOS: Whether the icon is prerendered (default: true) */
    prerendered?: boolean;
}

export interface PluginConfig {
    /** Map of icon name to icon configuration */
    icons?: Record<string, IconConfig>;
}

interface ResolvedIconConfig {
    iosImagePath: string | undefined;
    iosVariants: IosVariants | null;
    androidImagePath: string | undefined;
    androidAdaptive: AndroidAdaptiveIconConfig | null;
    label: string | undefined;
    prerendered: boolean;
}

interface DensityConfig {
    name: string;
    scale: number;
    size: number;
    foregroundSize: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Android density configurations
// Adaptive icon foreground is 108dp (scales with density)
// Legacy icon size is 48dp (scales with density)
const ADAPTIVE_ICON_FOREGROUND_DP = 108;
const ANDROID_DENSITIES: DensityConfig[] = [
    { name: 'mdpi', scale: 1, size: 48 },
    { name: 'hdpi', scale: 1.5, size: 72 },
    { name: 'xhdpi', scale: 2, size: 96 },
    { name: 'xxhdpi', scale: 3, size: 144 },
    { name: 'xxxhdpi', scale: 4, size: 192 },
].map(density => ({
    ...density,
    foregroundSize: ADAPTIVE_ICON_FOREGROUND_DP * density.scale,
}));

// iOS icon size - using 1024x1024 for best quality
const IOS_ICON_DIMENSION = { scale: 1, size: 1024 };

const IOS_ASSETS_FOLDER_NAME = "Images.xcassets";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Resolve icon configuration to unified format
 * Supports both our format (iosImage, androidImage) and community format (ios, android)
 */
function resolveIconConfig(iconConfig: IconConfig): ResolvedIconConfig {
    // Get iOS image path
    let iosImagePath: string | undefined = iconConfig.iosImage || iconConfig.image;
    let iosVariants: IosVariants | null = null;

    // Support community plugin's `ios` key
    if (iconConfig.ios) {
        if (typeof iconConfig.ios === 'string') {
            iosImagePath = iconConfig.ios;
        } else if (typeof iconConfig.ios === 'object') {
            // Object with light/dark/tinted variants
            iosVariants = iconConfig.ios;
            iosImagePath = iconConfig.ios.light || iconConfig.ios.dark || iconConfig.ios.tinted;
        }
    }

    // Get Android image path
    let androidImagePath: string | undefined = iconConfig.androidImage || iconConfig.image;
    let androidAdaptive: AndroidAdaptiveIconConfig | null = null;

    // Support community plugin's `android` key
    if (iconConfig.android) {
        if (typeof iconConfig.android === 'string') {
            // Legacy string format
            androidImagePath = iconConfig.android;
        } else if (typeof iconConfig.android === 'object') {
            // Adaptive icon format
            androidAdaptive = iconConfig.android;
        }
    }

    return {
        iosImagePath,
        iosVariants,
        androidImagePath,
        androidAdaptive,
        label: iconConfig.label,
        prerendered: iconConfig.prerendered !== false,
    };
}

function getIconName(key: string): string {
    return `AppIcon-${key}`;
}

/**
 * Get icon asset file name
 */
function getIconAssetFileName(key: string, variant: string, dimension: { size: number }): string {
    const name = `${getIconName(key)}-${variant}`;
    const size = `${dimension.size}x${dimension.size}`;
    return `${name}-${size}.png`;
}

/**
 * Generate Contents.json for an iOS app icon set
 * Supports light, dark, and tinted variants (iOS 18+)
 */
function generateIconsetContents(iconName: string, iosVariants: IosVariants | null): object {
    const dimension = IOS_ICON_DIMENSION;
    const images: object[] = [];

    // Light icon (always present)
    const lightFileName = `${iconName}-light-${dimension.size}x${dimension.size}.png`;
    images.push({
        filename: lightFileName,
        idiom: "universal",
        platform: "ios",
        size: `${dimension.size}x${dimension.size}`,
    });

    // Dark icon (optional)
    if (iosVariants && iosVariants.dark) {
        const darkFileName = `${iconName}-dark-${dimension.size}x${dimension.size}.png`;
        images.push({
            filename: darkFileName,
            idiom: "universal",
            platform: "ios",
            size: `${dimension.size}x${dimension.size}`,
            appearances: [
                { appearance: "luminosity", value: "dark" },
            ],
        });
    } else {
        // Placeholder for dark mode
        images.push({
            idiom: "universal",
            platform: "ios",
            size: `${dimension.size}x${dimension.size}`,
            appearances: [
                { appearance: "luminosity", value: "dark" },
            ],
        });
    }

    // Tinted icon (optional - iOS 18+)
    if (iosVariants && iosVariants.tinted) {
        const tintedFileName = `${iconName}-tinted-${dimension.size}x${dimension.size}.png`;
        images.push({
            filename: tintedFileName,
            idiom: "universal",
            platform: "ios",
            size: `${dimension.size}x${dimension.size}`,
            appearances: [
                { appearance: "luminosity", value: "tinted" },
            ],
        });
    } else {
        // Placeholder for tinted mode
        images.push({
            idiom: "universal",
            platform: "ios",
            size: `${dimension.size}x${dimension.size}`,
            appearances: [
                { appearance: "luminosity", value: "tinted" },
            ],
        });
    }

    return {
        images,
        info: {
            author: "expo-dynamic-app-identity",
            version: 1,
        },
    };
}

/**
 * Convert icon name to safe Android resource name
 */
function getSafeResourceName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

// ============================================================================
// ANDROID MANIFEST MOD
// ============================================================================
/**
 * Modifies AndroidManifest.xml to:
 * 1. Remove MAIN/LAUNCHER intent-filter from MainActivity
 * 2. Create MainActivityDEFAULT alias (FIX #1)
 * 3. Add activity-alias for each icon with proper intent-filters
 * 4. Migrate deep links to ALL aliases (FIX #2)
 * 5. Set android:label on each alias (FIX #3)
 */
const withAndroidManifestMod: ConfigPlugin<PluginConfig> = (config, pluginConfig) => {
    return withAndroidManifest(config, async (config) => {
        const manifest = config.modResults;
        const mainApplication = manifest.manifest.application?.[0];

        if (!mainApplication) {
            throw new Error('[@praneeth26/expo-dynamic-app-identity] Could not find <application> in AndroidManifest.xml');
        }

        const packageName = (manifest.manifest.$ as any)?.package || config.android?.package;
        if (!packageName) {
            throw new Error('[@praneeth26/expo-dynamic-app-identity] Could not determine Android package name');
        }

        // Find MainActivity
        const activities = mainApplication.activity || [];
        const mainActivityIndex = activities.findIndex(
            (activity: any) => activity.$?.['android:name'] === '.MainActivity'
        );

        if (mainActivityIndex === -1) {
            throw new Error('[@praneeth26/expo-dynamic-app-identity] Could not find MainActivity in AndroidManifest.xml');
        }

        const mainActivity = activities[mainActivityIndex] as any;

        // Store the original intent-filters for migration
        const originalIntentFilters = mainActivity['intent-filter'] || [];

        // Separate launcher filters from deep link filters
        const deepLinkFilters: any[] = [];
        for (const filter of originalIntentFilters) {
            const actions = filter.action || [];
            const categories = filter.category || [];

            const isMainLauncher = actions.some((a: any) => a.$?.['android:name'] === 'android.intent.action.MAIN') &&
                categories.some((c: any) => c.$?.['android:name'] === 'android.intent.category.LAUNCHER');

            // If it's not the main launcher, it's a deep link or other intent
            if (!isMainLauncher) {
                deepLinkFilters.push(filter);
            }
        }

        // FIX #2: Remove ALL intent-filters from MainActivity
        mainActivity['intent-filter'] = [];

        // Ensure MainActivity has proper attributes
        mainActivity.$ = {
            ...(mainActivity.$ || {}),
            'android:exported': 'true',
            'android:launchMode': 'singleTask',
        };

        // Remove existing activity-aliases that we created before (clean rebuild)
        const mainApp = mainApplication as any;
        const existingAliases = mainApp['activity-alias'] || [];
        mainApp['activity-alias'] = existingAliases.filter(
            (alias: any) => !alias.$?.['android:name']?.includes('MainActivity')
        );

        // Get default app label
        const defaultLabel = config.name || 'App';

        // FIX #1: Create MainActivityDEFAULT alias
        const defaultAliasIntentFilters: any[] = [
            {
                action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
            },
        ];

        // Add deep link filters to DEFAULT alias too
        if (deepLinkFilters.length > 0) {
            defaultAliasIntentFilters.push(...JSON.parse(JSON.stringify(deepLinkFilters)));
        }

        const defaultAlias = {
            $: {
                'android:name': `.MainActivityDEFAULT`,
                'android:enabled': 'true',
                'android:exported': 'true',
                'android:icon': '@mipmap/ic_launcher',
                'android:roundIcon': '@mipmap/ic_launcher_round',
                'android:label': defaultLabel,
                'android:targetActivity': '.MainActivity',
            },
            'intent-filter': defaultAliasIntentFilters,
        };

        if (!mainApp['activity-alias']) {
            mainApp['activity-alias'] = [];
        }
        mainApp['activity-alias'].push(defaultAlias);

        // Create activity-alias for each custom icon
        const icons = pluginConfig.icons || {};
        for (const [iconName, iconConfig] of Object.entries(icons)) {
            const resolved = resolveIconConfig(iconConfig);
            const iconLabel = resolved.label || defaultLabel;

            const aliasIntentFilters: any[] = [
                {
                    action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                    category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
                },
            ];

            if (deepLinkFilters.length > 0) {
                aliasIntentFilters.push(...JSON.parse(JSON.stringify(deepLinkFilters)));
            }

            // FIX #8: If no image provided, use default ic_launcher (label-only mode)
            const hasCustomImage = resolved.androidImagePath || resolved.androidAdaptive;
            const iconResource = hasCustomImage ? `@mipmap/${iconName}` : '@mipmap/ic_launcher';
            const roundIconResource = hasCustomImage ? `@mipmap/${iconName}_round` : '@mipmap/ic_launcher_round';

            const iconAlias = {
                $: {
                    'android:name': `.MainActivity${iconName}`,
                    'android:enabled': 'false',
                    'android:exported': 'true',
                    'android:icon': iconResource,
                    'android:roundIcon': roundIconResource,
                    'android:label': iconLabel,
                    'android:targetActivity': '.MainActivity',
                },
                'intent-filter': aliasIntentFilters,
            };

            mainApp['activity-alias'].push(iconAlias);
        }

        console.log(`[DynamicAppIdentity] Android: Created ${Object.keys(icons).length + 1} activity aliases`);
        return config;
    });
};

// ============================================================================
// ANDROID RESOURCES MOD
// ============================================================================
const withAndroidResourcesMod: ConfigPlugin<PluginConfig> = (config, pluginConfig) => {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const androidResPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
            const drawableDirPath = path.join(androidResPath, 'drawable');
            const mipmapAnyDpiV26DirPath = path.join(androidResPath, 'mipmap-anydpi-v26');

            // Ensure directories exist
            ensureDirectoryExists(drawableDirPath);
            ensureDirectoryExists(mipmapAnyDpiV26DirPath);

            const icons = pluginConfig.icons || {};
            for (const [iconName, iconConfig] of Object.entries(icons)) {
                const resolved = resolveIconConfig(iconConfig);

                // Check if adaptive icon
                if (resolved.androidAdaptive && resolved.androidAdaptive.foregroundImage) {
                    console.log(`[DynamicAppIdentity] Android: Generating adaptive icon "${iconName}"`);
                    await processAdaptiveIcon(config, iconName, resolved.androidAdaptive, drawableDirPath, mipmapAnyDpiV26DirPath);
                    continue;
                }

                // Regular icon
                const imagePath = resolved.androidImagePath;
                if (!imagePath) {
                    console.log(`[DynamicAppIdentity] Android: "${iconName}" configured as label-only`);
                    continue;
                }

                const fullImagePath = path.join(projectRoot, imagePath);
                if (!fs.existsSync(fullImagePath)) {
                    console.error(`[DynamicAppIdentity] Warning: Icon file not found at ${fullImagePath}`);
                    continue;
                }

                console.log(`[DynamicAppIdentity] Android: Generating icon "${iconName}"`);

                // Check if adaptive icon config is provided (legacy check)
                const androidConfig = iconConfig.android;
                const isAdaptive = androidConfig && typeof androidConfig === 'object' && 'foregroundImage' in androidConfig;

                if (isAdaptive) {
                    await processAdaptiveIcon(config, iconName, androidConfig as AndroidAdaptiveIconConfig, drawableDirPath, mipmapAnyDpiV26DirPath);
                } else {
                    await processRegularIcon(config, iconName, fullImagePath, androidResPath);
                }
            }
            return config;
        },
    ]);
};

/**
 * Process adaptive icon (foreground + background)
 */
async function processAdaptiveIcon(
    config: any,
    iconName: string,
    androidConfig: AndroidAdaptiveIconConfig,
    drawableDirPath: string,
    mipmapAnyDpiV26DirPath: string
): Promise<void> {
    const projectRoot = config.modRequest.projectRoot;
    const safeIconName = getSafeResourceName(iconName);
    const foregroundBaseName = `ic_launcher_adaptive_${safeIconName}_fg`;
    const backgroundBaseName = `ic_launcher_adaptive_${safeIconName}_bg`;
    const adaptiveIconBaseName = `ic_launcher_adaptive_${safeIconName}`;

    try {
        // Process foreground image
        const foregroundImageSrc = path.resolve(projectRoot, androidConfig.foregroundImage);
        const foregroundImageDest = path.join(drawableDirPath, `${foregroundBaseName}.png`);

        const { source: foregroundSource } = await generateImageAsync(
            {
                projectRoot,
                cacheType: `expo-dynamic-app-identity-fg-${safeIconName}`,
            },
            {
                src: foregroundImageSrc,
                removeTransparency: false,
                backgroundColor: "transparent",
                width: 432,
                height: 432,
                resizeMode: "contain",
            }
        );
        fs.writeFileSync(foregroundImageDest, foregroundSource);

        // Create background color drawable
        const backgroundColor = androidConfig.backgroundColor || "#FFFFFF";
        const backgroundColorXml = `<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="${backgroundColor}" />
</shape>`;
        const backgroundDrawablePath = path.join(drawableDirPath, `${backgroundBaseName}.xml`);
        fs.writeFileSync(backgroundDrawablePath, backgroundColorXml);

        // Create adaptive icon XML
        const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/${backgroundBaseName}" />
    <foreground android:drawable="@drawable/${foregroundBaseName}" />
</adaptive-icon>`;
        const adaptiveIconXmlPath = path.join(mipmapAnyDpiV26DirPath, `${adaptiveIconBaseName}.xml`);
        fs.writeFileSync(adaptiveIconXmlPath, adaptiveIconXml);

        // Also create the round adaptive icon XML
        const roundAdaptiveIconXmlPath = path.join(mipmapAnyDpiV26DirPath, `${adaptiveIconBaseName}_round.xml`);
        fs.writeFileSync(roundAdaptiveIconXmlPath, adaptiveIconXml);

        // Create fallback mipmap PNGs for older Android versions
        const androidResPath = path.dirname(drawableDirPath);
        for (const density of ANDROID_DENSITIES) {
            const mipmapDir = path.join(androidResPath, `mipmap-${density.name}`);
            ensureDirectoryExists(mipmapDir);

            const iconOutputPath = path.join(mipmapDir, `${iconName}.png`);
            const roundOutputPath = path.join(mipmapDir, `${iconName}_round.png`);

            try {
                const { source } = await generateImageAsync(
                    {
                        projectRoot,
                        cacheType: `expo-dynamic-app-identity-fallback-${iconName}-${density.name}`,
                    },
                    {
                        src: foregroundImageSrc,
                        removeTransparency: true,
                        backgroundColor: backgroundColor,
                        width: density.size,
                        height: density.size,
                        resizeMode: "contain",
                    }
                );

                fs.writeFileSync(iconOutputPath, source);
                fs.writeFileSync(roundOutputPath, source);
            } catch (fallbackError) {
                console.warn(`[DynamicAppIdentity] Warning: Fallback generation failed for "${iconName}" at ${density.name}`);
            }
        }

        console.log(`[DynamicAppIdentity] Android: Adaptive icon "${iconName}" ready`);
    } catch (error) {
        console.error(`[DynamicAppIdentity] Error creating adaptive icon "${iconName}":`, error);
    }
}

/**
 * Process regular icon for all densities using @expo/image-utils
 * Generates both legacy mipmap icons AND adaptive icon resources for Android 8.0+
 */
async function processRegularIcon(
    config: any,
    iconName: string,
    fullImagePath: string,
    androidResPath: string
): Promise<void> {
    const projectRoot = config.modRequest.projectRoot;
    const backgroundColor = "#FFFFFF";

    // === STEP 1: Generate foreground images for each density ===
    for (const density of ANDROID_DENSITIES) {
        const mipmapDir = path.join(androidResPath, `mipmap-${density.name}`);
        ensureDirectoryExists(mipmapDir);

        // Generate foreground image for adaptive icon (108dp at each density)
        const foregroundOutputPath = path.join(mipmapDir, `${iconName}_foreground.png`);
        try {
            const { source: foregroundSource } = await generateImageAsync(
                {
                    projectRoot,
                    cacheType: `expo-dynamic-app-identity-fg-${iconName}-${density.name}`,
                },
                {
                    src: fullImagePath,
                    removeTransparency: false,
                    backgroundColor: "transparent",
                    width: density.foregroundSize,
                    height: density.foregroundSize,
                    resizeMode: "cover",
                }
            );
            fs.writeFileSync(foregroundOutputPath, foregroundSource);
        } catch (error) {
            // Fallback: copy original
            fs.copyFileSync(fullImagePath, foregroundOutputPath);
        }

        // Generate legacy fallback icons (for pre-API 26)
        const iconOutputPath = path.join(mipmapDir, `${iconName}.png`);
        const roundOutputPath = path.join(mipmapDir, `${iconName}_round.png`);

        try {
            const { source } = await generateImageAsync(
                {
                    projectRoot,
                    cacheType: `expo-dynamic-app-identity-${iconName}-${density.name}`,
                },
                {
                    src: fullImagePath,
                    removeTransparency: true,
                    backgroundColor: backgroundColor,
                    width: density.size,
                    height: density.size,
                    resizeMode: "cover",
                }
            );

            fs.writeFileSync(iconOutputPath, source);
            fs.writeFileSync(roundOutputPath, source);
        } catch (error) {
            console.warn(`[DynamicAppIdentity] Warning: Resize failed for "${iconName}" at ${density.name}, using original`);
            const sourceBuffer = fs.readFileSync(fullImagePath);
            fs.writeFileSync(iconOutputPath, sourceBuffer);
            fs.writeFileSync(roundOutputPath, sourceBuffer);
        }
    }

    // === STEP 2: Generate adaptive icon XML for API 26+ ===
    const mipmapAnyDpiV26Dir = path.join(androidResPath, 'mipmap-anydpi-v26');
    ensureDirectoryExists(mipmapAnyDpiV26Dir);

    // Create background color in values/
    const valuesDir = path.join(androidResPath, 'values');
    ensureDirectoryExists(valuesDir);

    // Add color resource for this icon's background
    const colorName = `${iconName}_background`;
    const colorsFilePath = path.join(valuesDir, `${iconName}_colors.xml`);
    const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="${colorName}">${backgroundColor}</color>
</resources>`;
    fs.writeFileSync(colorsFilePath, colorsXml);

    // Create adaptive icon XML
    const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/${colorName}"/>
    <foreground android:drawable="@mipmap/${iconName}_foreground"/>
</adaptive-icon>`;

    const adaptiveIconPath = path.join(mipmapAnyDpiV26Dir, `${iconName}.xml`);
    const adaptiveIconRoundPath = path.join(mipmapAnyDpiV26Dir, `${iconName}_round.xml`);
    fs.writeFileSync(adaptiveIconPath, adaptiveIconXml);
    fs.writeFileSync(adaptiveIconRoundPath, adaptiveIconXml);

    console.log(`[DynamicAppIdentity] Android: Icon "${iconName}" ready`);
}

// ============================================================================
// IOS XCODE PROJECT MOD
// ============================================================================
const withIOSXcodeProject: ConfigPlugin<PluginConfig> = (config, pluginConfig) => {
    return withXcodeProject(config, async (config) => {
        const project = config.modResults;
        const configurations = project.hash.project.objects["XCBuildConfiguration"];

        // Collect icon names for alternate icons
        const iconNames: string[] = [];
        const icons = pluginConfig.icons || {};
        for (const [iconName, iconConfig] of Object.entries(icons)) {
            const resolved = resolveIconConfig(iconConfig);
            if (resolved.iosImagePath || resolved.iosVariants) {
                iconNames.push(getIconName(iconName));
            }
        }

        // Update all build configurations
        for (const id of Object.keys(configurations)) {
            const configuration = configurations[id];
            if (typeof configuration !== "object") continue;

            const buildSettings = configuration.buildSettings;
            if (!buildSettings) continue;

            // Remove old settings first
            delete buildSettings["ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES"];
            delete buildSettings["ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS"];

            // Add new settings
            buildSettings["ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS"] = "YES";
            if (iconNames.length > 0) {
                buildSettings["ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES"] = JSON.stringify(iconNames.join(" "));
            }
            buildSettings["ASSETCATALOG_COMPILER_APPICON_NAME"] = "AppIcon";

            project.hash.project.objects["XCBuildConfiguration"][id].buildSettings = buildSettings;
        }

        console.log(`[DynamicAppIdentity] iOS: Configured ${iconNames.length} alternate icon(s)`);
        return config;
    });
};

// ============================================================================
// IOS INFO.PLIST MOD
// ============================================================================
const withIOSInfoPlistMod: ConfigPlugin<PluginConfig> = (config, pluginConfig) => {
    return withInfoPlist(config, (config) => {
        const iconsMap: Record<string, any> = {};
        const icons = pluginConfig.icons || {};

        for (const [iconName, iconConfig] of Object.entries(icons)) {
            const resolved = resolveIconConfig(iconConfig);
            if (!resolved.iosImagePath && !resolved.iosVariants) {
                console.log(`[DynamicAppIdentity] iOS: "${iconName}" configured as label-only`);
                continue;
            }
            // Use the asset catalog icon name
            const assetIconName = getIconName(iconName);
            iconsMap[iconName] = {
                CFBundleIconFiles: [assetIconName],
                UIPrerenderedIcon: resolved.prerendered,
            };
        }

        const existingBundleIcons = (config.modResults.CFBundleIcons || {}) as Record<string, any>;
        config.modResults.CFBundleIcons = {
            ...existingBundleIcons,
            CFBundleAlternateIcons: iconsMap,
        };

        // Also set for iPad
        const existingIPadIcons = (config.modResults['CFBundleIcons~ipad'] || {}) as Record<string, any>;
        config.modResults['CFBundleIcons~ipad'] = {
            ...existingIPadIcons,
            CFBundleAlternateIcons: iconsMap,
        };

        console.log(`[DynamicAppIdentity] iOS: Updated Info.plist with ${Object.keys(iconsMap).length} icon(s)`);
        return config;
    });
};

// ============================================================================
// IOS ASSET CATALOG MOD
// ============================================================================
const withIOSAssetCatalogMod: ConfigPlugin<PluginConfig> = (config, pluginConfig) => {
    return withDangerousMod(config, [
        'ios',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const projectName = config.modRequest.projectName || config.name || 'App';
            const assetsPath = path.join(projectRoot, 'ios', projectName, IOS_ASSETS_FOLDER_NAME);
            const dimension = IOS_ICON_DIMENSION;

            const icons = pluginConfig.icons || {};
            for (const [iconName, iconConfig] of Object.entries(icons)) {
                const resolved = resolveIconConfig(iconConfig);

                if (!resolved.iosImagePath && !resolved.iosVariants) {
                    continue; // Skip label-only
                }

                const assetIconName = getIconName(iconName);
                const iconsetPath = path.join(assetsPath, `${assetIconName}.appiconset`);

                // Remove old iconset if exists
                if (fs.existsSync(iconsetPath)) {
                    fs.rmSync(iconsetPath, { recursive: true, force: true });
                }

                // Create iconset directory
                ensureDirectoryExists(iconsetPath);

                // Generate Contents.json (with dark mode support)
                const contents = generateIconsetContents(assetIconName, resolved.iosVariants);
                fs.writeFileSync(
                    path.join(iconsetPath, 'Contents.json'),
                    JSON.stringify(contents, null, 2)
                );

                // Determine which variants to generate
                const variants: Record<string, string | undefined> = resolved.iosVariants
                    ? (resolved.iosVariants as Record<string, string | undefined>)
                    : { light: resolved.iosImagePath };

                // Generate icon images for each variant (light, dark, tinted)
                for (const [variant, imageSrc] of Object.entries(variants)) {
                    if (!imageSrc) continue;

                    const fullImagePath = path.join(projectRoot, imageSrc);
                    if (!fs.existsSync(fullImagePath)) {
                        console.error(`[DynamicAppIdentity] Warning: iOS ${variant} icon not found at ${fullImagePath}`);
                        continue;
                    }

                    const outputFileName = `${assetIconName}-${variant}-${dimension.size}x${dimension.size}.png`;
                    const outputPath = path.join(iconsetPath, outputFileName);
                    const isTransparent = variant === 'dark' || variant === 'tinted';

                    try {
                        // Use @expo/image-utils to resize the image
                        const { source } = await generateImageAsync(
                            {
                                projectRoot,
                                cacheType: `expo-dynamic-app-identity-ios-${iconName}-${variant}`,
                            },
                            {
                                name: outputFileName,
                                src: fullImagePath,
                                removeTransparency: !isTransparent,
                                backgroundColor: isTransparent ? "transparent" : "#ffffff",
                                resizeMode: "cover",
                                width: dimension.size,
                                height: dimension.size,
                            }
                        );
                        fs.writeFileSync(outputPath, source);
                    } catch (error) {
                        // Fallback: just copy the original image
                        console.warn(`[DynamicAppIdentity] Warning: iOS resize failed for ${variant}, using original`);
                        fs.copyFileSync(fullImagePath, outputPath);
                    }
                }

                console.log(`[DynamicAppIdentity] iOS: Icon "${assetIconName}" ready`);
            }

            return config;
        },
    ]);
};

// ============================================================================
// CONFIG NORMALIZATION
// ============================================================================
/**
 * Normalize plugin config to support both formats:
 *
 * Standard format (with 'icons' wrapper):
 * {
 *   "icons": {
 *     "icon1": { "image": "./icon.png", "label": "My App" }
 *   }
 * }
 *
 * Simplified format (without 'icons' wrapper):
 * {
 *   "icon1": { "android": "./icon.png", "ios": "./icon.png" }
 * }
 */
function normalizePluginConfig(pluginConfig: any): PluginConfig {
    if (!pluginConfig || typeof pluginConfig !== 'object') {
        return { icons: {} };
    }

    // Standard format with 'icons' wrapper
    if (pluginConfig.icons && typeof pluginConfig.icons === 'object') {
        return pluginConfig;
    }

    // Simplified format (icon definitions at root level)
    const potentialIconKeys = Object.keys(pluginConfig).filter(key => {
        const value = pluginConfig[key];
        if (typeof value !== 'object' || value === null) return false;

        // Check if it looks like an icon config
        return (
            'android' in value ||
            'ios' in value ||
            'image' in value ||
            'androidImage' in value ||
            'iosImage' in value ||
            'prerendered' in value ||
            'label' in value
        );
    });

    if (potentialIconKeys.length > 0) {
        // Convert simplified format to standard format
        const icons: Record<string, IconConfig> = {};
        for (const key of potentialIconKeys) {
            icons[key] = pluginConfig[key];
        }
        return { icons };
    }

    // No valid icon configuration found
    console.warn('[DynamicAppIdentity] No icon configurations found in plugin config');
    return { icons: {} };
}

// ============================================================================
// MAIN PLUGIN
// ============================================================================
const withDynamicAppIdentity: ConfigPlugin<PluginConfig | Record<string, IconConfig>> = (config, pluginConfig) => {
    // Normalize config to support both standard and simplified formats
    const normalizedConfig = normalizePluginConfig(pluginConfig);

    // Validate config
    if (!normalizedConfig.icons || Object.keys(normalizedConfig.icons).length === 0) {
        console.warn('[DynamicAppIdentity] No icons configured, skipping plugin');
        return config;
    }

    console.log(`[DynamicAppIdentity] Configuring ${Object.keys(normalizedConfig.icons).length} icon(s): ${Object.keys(normalizedConfig.icons).join(', ')}`);

    // Apply Android mods
    config = withAndroidManifestMod(config, normalizedConfig);
    config = withAndroidResourcesMod(config, normalizedConfig);

    // Apply iOS mods
    config = withIOSXcodeProject(config, normalizedConfig);
    config = withIOSInfoPlistMod(config, normalizedConfig);
    config = withIOSAssetCatalogMod(config, normalizedConfig);

    return config;
};

export default withDynamicAppIdentity;
