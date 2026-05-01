import {
    ConfigPlugin,
    withAndroidManifest,
    withDangerousMod,
    withXcodeProject,
    withInfoPlist,
} from '@expo/config-plugins';
import { generateImageAsync } from '@expo/image-utils';
import * as fs from 'fs';
import * as path from 'path';

interface AndroidAdaptiveIconConfig {
    foregroundImage: string;
    backgroundOption?: 'image' | 'color';
    backgroundImage?: string;
    backgroundColor?: string;
    monochromeImage?: string;
}

interface AndroidIconConfig {
    adaptiveIcon?: AndroidAdaptiveIconConfig;
    icon?: string;
}

interface IosVariants {
    light?: string;
    dark?: string;
    tinted?: string;
}

interface IosIconConfig {
    icon?: IosVariants;
}

export interface IconConfig {
    image?: string;
    android?: string | AndroidAdaptiveIconConfig | AndroidIconConfig;
    androidImage?: string;
    ios?: string | IosVariants | IosIconConfig;
    iosImage?: string;
    label?: string;
    prerendered?: boolean;
}

export interface PluginConfig {
    icons?: Record<string, IconConfig>;
}

interface ResolvedIconConfig {
    iosImagePath: string | undefined;
    iosVariants: IosVariants | null;
    androidImagePath: string | undefined;
    androidAdaptive: AndroidAdaptiveIconConfig | null;
    androidFallbackIcon: string | undefined;
    label: string | undefined;
    prerendered: boolean;
}

interface DensityConfig {
    name: string;
    scale: number;
    size: number;
    foregroundSize: number;
}

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

const IOS_ICON_DIMENSION = { scale: 1, size: 1024 };
const IOS_ASSETS_FOLDER_NAME = "Images.xcassets";

function ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function resolveIconConfig(iconConfig: IconConfig): ResolvedIconConfig {
    let iosImagePath: string | undefined = iconConfig.iosImage || iconConfig.image;
    let iosVariants: IosVariants | null = null;

    if (iconConfig.ios) {
        if (typeof iconConfig.ios === 'string') {
            iosImagePath = iconConfig.ios;
        } else if (typeof iconConfig.ios === 'object') {
            if ('icon' in iconConfig.ios && typeof iconConfig.ios.icon === 'object') {
                const iosIcon = (iconConfig.ios as IosIconConfig).icon;
                if (iosIcon) {
                    iosVariants = iosIcon;
                    iosImagePath = iosIcon.light || iosIcon.dark || iosIcon.tinted;
                }
            } else {
                iosVariants = iconConfig.ios as IosVariants;
                iosImagePath = iosVariants.light || iosVariants.dark || iosVariants.tinted;
            }
        }
    }

    let androidImagePath: string | undefined = iconConfig.androidImage || iconConfig.image;
    let androidAdaptive: AndroidAdaptiveIconConfig | null = null;
    let androidFallbackIcon: string | undefined = undefined;

    if (iconConfig.android) {
        if (typeof iconConfig.android === 'string') {
            androidImagePath = iconConfig.android;
        } else if (typeof iconConfig.android === 'object') {
            if ('adaptiveIcon' in iconConfig.android) {
                const androidConfig = iconConfig.android as AndroidIconConfig;
                if (androidConfig.adaptiveIcon) {
                    androidAdaptive = androidConfig.adaptiveIcon;
                }
                androidFallbackIcon = androidConfig.icon;
            } else if ('foregroundImage' in iconConfig.android) {
                androidAdaptive = iconConfig.android as AndroidAdaptiveIconConfig;
            }
        }
    }

    return {
        iosImagePath,
        iosVariants,
        androidImagePath,
        androidAdaptive,
        androidFallbackIcon,
        label: iconConfig.label,
        prerendered: iconConfig.prerendered !== false,
    };
}

function getIconName(key: string): string {
    return `AppIcon-${key}`;
}

function generateIconsetContents(iconName: string, iosVariants: IosVariants | null): object {
    const dimension = IOS_ICON_DIMENSION;
    const images: object[] = [];

    const lightFileName = `${iconName}-light-${dimension.size}x${dimension.size}.png`;
    images.push({
        filename: lightFileName,
        idiom: "universal",
        platform: "ios",
        size: `${dimension.size}x${dimension.size}`,
    });

    if (iosVariants && iosVariants.dark) {
        const darkFileName = `${iconName}-dark-${dimension.size}x${dimension.size}.png`;
        images.push({
            filename: darkFileName,
            idiom: "universal",
            platform: "ios",
            size: `${dimension.size}x${dimension.size}`,
            appearances: [{ appearance: "luminosity", value: "dark" }],
        });
    } else {
        images.push({
            idiom: "universal",
            platform: "ios",
            size: `${dimension.size}x${dimension.size}`,
            appearances: [{ appearance: "luminosity", value: "dark" }],
        });
    }

    if (iosVariants && iosVariants.tinted) {
        const tintedFileName = `${iconName}-tinted-${dimension.size}x${dimension.size}.png`;
        images.push({
            filename: tintedFileName,
            idiom: "universal",
            platform: "ios",
            size: `${dimension.size}x${dimension.size}`,
            appearances: [{ appearance: "luminosity", value: "tinted" }],
        });
    } else {
        images.push({
            idiom: "universal",
            platform: "ios",
            size: `${dimension.size}x${dimension.size}`,
            appearances: [{ appearance: "luminosity", value: "tinted" }],
        });
    }

    return {
        images,
        info: { author: "expo-dynamic-app-identity", version: 1 },
    };
}

function getSafeResourceName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

function normalizeColor(color: string): string {
    if (!color) return '#FFFFFF';
    let hex = color.replace(/^#/, '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    return `#${hex.toUpperCase()}`;
}

function createBackgroundColorResource(androidResPath: string, iconName: string, color: string): void {
    const valuesDir = path.join(androidResPath, 'values');
    ensureDirectoryExists(valuesDir);
    const colorName = `${iconName}_bg_color`;
    const colorsFilePath = path.join(valuesDir, `${iconName}_colors.xml`);
    const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="${colorName}">${color}</color>
</resources>`;
    fs.writeFileSync(colorsFilePath, colorsXml);
}

const withAndroidManifestMod: ConfigPlugin<PluginConfig> = (config, pluginConfig) => {
    return withAndroidManifest(config, async (config) => {
        const manifest = config.modResults;
        const mainApplication = manifest.manifest.application?.[0];

        if (!mainApplication) {
            throw new Error('[DynamicAppIdentity] Could not find <application> in AndroidManifest.xml');
        }

        const packageName = (manifest.manifest.$ as any)?.package || config.android?.package;
        if (!packageName) {
            throw new Error('[DynamicAppIdentity] Could not determine Android package name');
        }

        const activities = mainApplication.activity || [];
        const mainActivityIndex = activities.findIndex(
            (activity: any) => activity.$?.['android:name'] === '.MainActivity'
        );

        if (mainActivityIndex === -1) {
            throw new Error('[DynamicAppIdentity] Could not find MainActivity in AndroidManifest.xml');
        }

        const mainActivity = activities[mainActivityIndex] as any;
        const originalIntentFilters = mainActivity['intent-filter'] || [];

        const deepLinkFilters: any[] = [];
        for (const filter of originalIntentFilters) {
            const actions = filter.action || [];
            const categories = filter.category || [];
            const isMainLauncher = actions.some((a: any) => a.$?.['android:name'] === 'android.intent.action.MAIN') &&
                categories.some((c: any) => c.$?.['android:name'] === 'android.intent.category.LAUNCHER');
            if (!isMainLauncher) {
                deepLinkFilters.push(filter);
            }
        }

        mainActivity['intent-filter'] = [];
        mainActivity.$ = {
            ...(mainActivity.$ || {}),
            'android:exported': 'true',
            'android:launchMode': 'singleTask',
        };

        const mainApp = mainApplication as any;
        const existingAliases = mainApp['activity-alias'] || [];
        mainApp['activity-alias'] = existingAliases.filter(
            (alias: any) => !alias.$?.['android:name']?.includes('MainActivity')
        );

        const defaultLabel = config.name || 'App';

        const defaultAliasIntentFilters: any[] = [
            {
                action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
            },
        ];

        if (deepLinkFilters.length > 0) {
            defaultAliasIntentFilters.push(...JSON.parse(JSON.stringify(deepLinkFilters)));
        }

        const defaultAlias = {
            $: {
                'android:name': `.MainActivityDEFAULT`,
                'android:enabled': 'true',
                'android:exported': 'true',
                'android:icon': '@mipmap/ic_launcher',
                'android:roundIcon': '@mipmap/ic_launcher',
                'android:label': defaultLabel,
                'android:targetActivity': '.MainActivity',
            },
            'intent-filter': defaultAliasIntentFilters,
        };

        if (!mainApp['activity-alias']) {
            mainApp['activity-alias'] = [];
        }
        mainApp['activity-alias'].push(defaultAlias);

        const icons = pluginConfig.icons || {};
        for (const [iconName, iconConfig] of Object.entries(icons)) {
            const resolved = resolveIconConfig(iconConfig);

            const aliasIntentFilters: any[] = [
                {
                    action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                    category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
                },
            ];

            if (deepLinkFilters.length > 0) {
                aliasIntentFilters.push(...JSON.parse(JSON.stringify(deepLinkFilters)));
            }

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
                    'android:label': defaultLabel,
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

const withAndroidResourcesMod: ConfigPlugin<PluginConfig> = (config, pluginConfig) => {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const androidResPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
            const drawableDirPath = path.join(androidResPath, 'drawable');
            const mipmapAnyDpiV26DirPath = path.join(androidResPath, 'mipmap-anydpi-v26');

            ensureDirectoryExists(drawableDirPath);
            ensureDirectoryExists(mipmapAnyDpiV26DirPath);

            const icons = pluginConfig.icons || {};
            for (const [iconName, iconConfig] of Object.entries(icons)) {
                const resolved = resolveIconConfig(iconConfig);

                if (resolved.androidAdaptive && resolved.androidAdaptive.foregroundImage) {
                    console.log(`[DynamicAppIdentity] Android: Generating adaptive icon "${iconName}"`);
                    await processAdaptiveIcon(
                        config,
                        iconName,
                        resolved.androidAdaptive,
                        drawableDirPath,
                        mipmapAnyDpiV26DirPath,
                        resolved.androidFallbackIcon
                    );
                    continue;
                }

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

                console.log(`[DynamicAppIdentity] Android: Generating regular icon "${iconName}"`);
                await processRegularIcon(config, iconName, fullImagePath, androidResPath);
            }
            return config;
        },
    ]);
};

async function processAdaptiveIcon(
    config: any,
    iconName: string,
    androidConfig: AndroidAdaptiveIconConfig,
    drawableDirPath: string,
    mipmapAnyDpiV26DirPath: string,
    fallbackIconPath?: string
): Promise<void> {
    const projectRoot = config.modRequest.projectRoot;
    const safeIconName = getSafeResourceName(iconName);
    const foregroundBaseName = `${safeIconName}_foreground`;
    const backgroundBaseName = `${safeIconName}_background`;
    const monochromeBaseName = `${safeIconName}_monochrome`;

    const backgroundOption = androidConfig.backgroundOption ||
        (androidConfig.backgroundImage ? 'image' : 'color');
    const backgroundColor = normalizeColor(androidConfig.backgroundColor || '#FFFFFF');

    try {
        const foregroundImageSrc = path.resolve(projectRoot, androidConfig.foregroundImage);
        if (!fs.existsSync(foregroundImageSrc)) {
            console.error(`[DynamicAppIdentity] Error: Foreground image not found at ${foregroundImageSrc}`);
            return;
        }

        const androidResPath = path.dirname(drawableDirPath);
        
        for (const density of ANDROID_DENSITIES) {
            const mipmapDir = path.join(androidResPath, `mipmap-${density.name}`);
            ensureDirectoryExists(mipmapDir);

            const foregroundOutputPath = path.join(mipmapDir, `${foregroundBaseName}.png`);
            try {
                const { source } = await generateImageAsync(
                    { projectRoot, cacheType: `expo-dynamic-app-identity-fg-${safeIconName}-${density.name}` },
                    {
                        src: foregroundImageSrc,
                        removeTransparency: false,
                        backgroundColor: "transparent",
                        width: density.foregroundSize,
                        height: density.foregroundSize,
                        resizeMode: "contain",
                    }
                );
                fs.writeFileSync(foregroundOutputPath, source);
            } catch (error) {
                fs.copyFileSync(foregroundImageSrc, foregroundOutputPath);
            }
        }

        let backgroundDrawableRef: string;

        if (backgroundOption === 'image' && androidConfig.backgroundImage) {
            const backgroundImageSrc = path.resolve(projectRoot, androidConfig.backgroundImage);
            if (fs.existsSync(backgroundImageSrc)) {
                for (const density of ANDROID_DENSITIES) {
                    const mipmapDir = path.join(androidResPath, `mipmap-${density.name}`);
                    const backgroundOutputPath = path.join(mipmapDir, `${backgroundBaseName}.png`);

                    try {
                        const { source } = await generateImageAsync(
                            { projectRoot, cacheType: `expo-dynamic-app-identity-bg-${safeIconName}-${density.name}` },
                            {
                                src: backgroundImageSrc,
                                removeTransparency: false,
                                backgroundColor: "transparent",
                                width: density.foregroundSize,
                                height: density.foregroundSize,
                                resizeMode: "cover",
                            }
                        );
                        fs.writeFileSync(backgroundOutputPath, source);
                    } catch (error) {
                        fs.copyFileSync(backgroundImageSrc, backgroundOutputPath);
                    }
                }
                backgroundDrawableRef = `@mipmap/${backgroundBaseName}`;
            } else {
                createBackgroundColorResource(androidResPath, safeIconName, backgroundColor);
                backgroundDrawableRef = `@color/${safeIconName}_bg_color`;
            }
        } else {
            createBackgroundColorResource(androidResPath, safeIconName, backgroundColor);
            backgroundDrawableRef = `@color/${safeIconName}_bg_color`;
        }

        let monochromeDrawableRef: string | null = null;

        if (androidConfig.monochromeImage) {
            const monochromeImageSrc = path.resolve(projectRoot, androidConfig.monochromeImage);
            if (fs.existsSync(monochromeImageSrc)) {
                for (const density of ANDROID_DENSITIES) {
                    const mipmapDir = path.join(androidResPath, `mipmap-${density.name}`);
                    const monochromeOutputPath = path.join(mipmapDir, `${monochromeBaseName}.png`);

                    try {
                        const { source } = await generateImageAsync(
                            { projectRoot, cacheType: `expo-dynamic-app-identity-mono-${safeIconName}-${density.name}` },
                            {
                                src: monochromeImageSrc,
                                removeTransparency: false,
                                backgroundColor: "transparent",
                                width: density.foregroundSize,
                                height: density.foregroundSize,
                                resizeMode: "contain",
                            }
                        );
                        fs.writeFileSync(monochromeOutputPath, source);
                    } catch (error) {
                        fs.copyFileSync(monochromeImageSrc, monochromeOutputPath);
                    }
                }
                monochromeDrawableRef = `@mipmap/${monochromeBaseName}`;
            }
        }

        ensureDirectoryExists(mipmapAnyDpiV26DirPath);

        let adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="${backgroundDrawableRef}" />
    <foreground android:drawable="@mipmap/${foregroundBaseName}" />`;

        if (monochromeDrawableRef) {
            adaptiveIconXml += `
    <monochrome android:drawable="${monochromeDrawableRef}" />`;
        }

        adaptiveIconXml += `
</adaptive-icon>`;

        fs.writeFileSync(path.join(mipmapAnyDpiV26DirPath, `${iconName}.xml`), adaptiveIconXml);
        fs.writeFileSync(path.join(mipmapAnyDpiV26DirPath, `${iconName}_round.xml`), adaptiveIconXml);

        const fallbackSrc = fallbackIconPath
            ? path.resolve(projectRoot, fallbackIconPath)
            : foregroundImageSrc;

        for (const density of ANDROID_DENSITIES) {
            const mipmapDir = path.join(androidResPath, `mipmap-${density.name}`);
            const iconOutputPath = path.join(mipmapDir, `${iconName}.png`);
            const roundOutputPath = path.join(mipmapDir, `${iconName}_round.png`);

            try {
                const { source } = await generateImageAsync(
                    { projectRoot, cacheType: `expo-dynamic-app-identity-fallback-${iconName}-${density.name}` },
                    {
                        src: fallbackSrc,
                        removeTransparency: true,
                        backgroundColor: backgroundColor,
                        width: density.size,
                        height: density.size,
                        resizeMode: "contain",
                    }
                );
                fs.writeFileSync(iconOutputPath, source);
                fs.writeFileSync(roundOutputPath, source);
            } catch (error) {
                console.warn(`[DynamicAppIdentity] Fallback generation failed for "${iconName}" at ${density.name}`);
            }
        }

        console.log(`[DynamicAppIdentity] Android: Adaptive icon "${iconName}" ready (bg: ${backgroundOption})`);
    } catch (error) {
        console.error(`[DynamicAppIdentity] Error creating adaptive icon "${iconName}":`, error);
    }
}

async function processRegularIcon(
    config: any,
    iconName: string,
    fullImagePath: string,
    androidResPath: string
): Promise<void> {
    const projectRoot = config.modRequest.projectRoot;
    const backgroundColor = "#FFFFFF";

    for (const density of ANDROID_DENSITIES) {
        const mipmapDir = path.join(androidResPath, `mipmap-${density.name}`);
        ensureDirectoryExists(mipmapDir);

        const foregroundOutputPath = path.join(mipmapDir, `${iconName}_foreground.png`);
        try {
            const { source: foregroundSource } = await generateImageAsync(
                { projectRoot, cacheType: `expo-dynamic-app-identity-fg-${iconName}-${density.name}` },
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
            fs.copyFileSync(fullImagePath, foregroundOutputPath);
        }

        const iconOutputPath = path.join(mipmapDir, `${iconName}.png`);
        const roundOutputPath = path.join(mipmapDir, `${iconName}_round.png`);

        try {
            const { source } = await generateImageAsync(
                { projectRoot, cacheType: `expo-dynamic-app-identity-${iconName}-${density.name}` },
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
            const sourceBuffer = fs.readFileSync(fullImagePath);
            fs.writeFileSync(iconOutputPath, sourceBuffer);
            fs.writeFileSync(roundOutputPath, sourceBuffer);
        }
    }

    const mipmapAnyDpiV26Dir = path.join(androidResPath, 'mipmap-anydpi-v26');
    ensureDirectoryExists(mipmapAnyDpiV26Dir);

    const valuesDir = path.join(androidResPath, 'values');
    ensureDirectoryExists(valuesDir);

    const colorName = `${iconName}_background`;
    const colorsFilePath = path.join(valuesDir, `${iconName}_colors.xml`);
    const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="${colorName}">${backgroundColor}</color>
</resources>`;
    fs.writeFileSync(colorsFilePath, colorsXml);

    const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/${colorName}"/>
    <foreground android:drawable="@mipmap/${iconName}_foreground"/>
</adaptive-icon>`;

    fs.writeFileSync(path.join(mipmapAnyDpiV26Dir, `${iconName}.xml`), adaptiveIconXml);
    fs.writeFileSync(path.join(mipmapAnyDpiV26Dir, `${iconName}_round.xml`), adaptiveIconXml);

    console.log(`[DynamicAppIdentity] Android: Icon "${iconName}" ready`);
}

const withIOSXcodeProject: ConfigPlugin<PluginConfig> = (config, pluginConfig) => {
    return withXcodeProject(config, async (config) => {
        const project = config.modResults;
        const configurations = project.hash.project.objects["XCBuildConfiguration"];

        const iconNames: string[] = [];
        const icons = pluginConfig.icons || {};
        for (const [iconName, iconConfig] of Object.entries(icons)) {
            const resolved = resolveIconConfig(iconConfig);
            if (resolved.iosImagePath || resolved.iosVariants) {
                iconNames.push(getIconName(iconName));
            }
        }

        for (const id of Object.keys(configurations)) {
            const configuration = configurations[id];
            if (typeof configuration !== "object") continue;

            const buildSettings = configuration.buildSettings;
            if (!buildSettings) continue;

            delete buildSettings["ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES"];
            delete buildSettings["ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS"];

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

const withIOSInfoPlistMod: ConfigPlugin<PluginConfig> = (config, pluginConfig) => {
    return withInfoPlist(config, (config) => {
        const iconsMap: Record<string, any> = {};
        const icons = pluginConfig.icons || {};

        for (const [iconName, iconConfig] of Object.entries(icons)) {
            const resolved = resolveIconConfig(iconConfig);
            if (!resolved.iosImagePath && !resolved.iosVariants) {
                continue;
            }
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

        const existingIPadIcons = (config.modResults['CFBundleIcons~ipad'] || {}) as Record<string, any>;
        config.modResults['CFBundleIcons~ipad'] = {
            ...existingIPadIcons,
            CFBundleAlternateIcons: iconsMap,
        };

        console.log(`[DynamicAppIdentity] iOS: Updated Info.plist with ${Object.keys(iconsMap).length} icon(s)`);
        return config;
    });
};

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
                    continue;
                }

                const assetIconName = getIconName(iconName);
                const iconsetPath = path.join(assetsPath, `${assetIconName}.appiconset`);

                if (fs.existsSync(iconsetPath)) {
                    fs.rmSync(iconsetPath, { recursive: true, force: true });
                }

                ensureDirectoryExists(iconsetPath);

                const contents = generateIconsetContents(assetIconName, resolved.iosVariants);
                fs.writeFileSync(
                    path.join(iconsetPath, 'Contents.json'),
                    JSON.stringify(contents, null, 2)
                );

                const variants: Record<string, string | undefined> = resolved.iosVariants
                    ? (resolved.iosVariants as Record<string, string | undefined>)
                    : { light: resolved.iosImagePath };

                for (const [variant, imageSrc] of Object.entries(variants)) {
                    if (!imageSrc) continue;

                    const fullImagePath = path.join(projectRoot, imageSrc);
                    if (!fs.existsSync(fullImagePath)) {
                        console.error(`[DynamicAppIdentity] iOS ${variant} icon not found at ${fullImagePath}`);
                        continue;
                    }

                    const outputFileName = `${assetIconName}-${variant}-${dimension.size}x${dimension.size}.png`;
                    const outputPath = path.join(iconsetPath, outputFileName);
                    const isTransparent = variant === 'dark' || variant === 'tinted';

                    try {
                        const { source } = await generateImageAsync(
                            { projectRoot, cacheType: `expo-dynamic-app-identity-ios-${iconName}-${variant}` },
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
                        fs.copyFileSync(fullImagePath, outputPath);
                    }
                }

                console.log(`[DynamicAppIdentity] iOS: Icon "${assetIconName}" ready`);
            }

            return config;
        },
    ]);
};

function normalizePluginConfig(pluginConfig: any): PluginConfig {
    if (!pluginConfig || typeof pluginConfig !== 'object') {
        return { icons: {} };
    }

    if (pluginConfig.icons && typeof pluginConfig.icons === 'object') {
        return pluginConfig;
    }

    const potentialIconKeys = Object.keys(pluginConfig).filter(key => {
        const value = pluginConfig[key];
        if (typeof value !== 'object' || value === null) return false;
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
        const icons: Record<string, IconConfig> = {};
        for (const key of potentialIconKeys) {
            icons[key] = pluginConfig[key];
        }
        return { icons };
    }

    console.warn('[DynamicAppIdentity] No icon configurations found');
    return { icons: {} };
}

const withDynamicAppIdentity: ConfigPlugin<PluginConfig | Record<string, IconConfig>> = (config, pluginConfig) => {
    const normalizedConfig = normalizePluginConfig(pluginConfig);

    if (!normalizedConfig.icons || Object.keys(normalizedConfig.icons).length === 0) {
        console.warn('[DynamicAppIdentity] No icons configured, skipping');
        return config;
    }

    console.log(`[DynamicAppIdentity] Configuring ${Object.keys(normalizedConfig.icons).length} icon(s): ${Object.keys(normalizedConfig.icons).join(', ')}`);

    config = withAndroidManifestMod(config, normalizedConfig);
    config = withAndroidResourcesMod(config, normalizedConfig);
    config = withIOSXcodeProject(config, normalizedConfig);
    config = withIOSInfoPlistMod(config, normalizedConfig);
    config = withIOSAssetCatalogMod(config, normalizedConfig);

    return config;
};

export default withDynamicAppIdentity;
