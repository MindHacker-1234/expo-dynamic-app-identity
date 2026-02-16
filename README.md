# @praneeth26/expo-dynamic-app-identity

A comprehensive Expo plugin for dynamic app icon and label switching with production-ready features and fixes.

## 🎯 Why This Plugin?

This plugin provides a production-ready solution for dynamic app icon and label switching with comprehensive fixes:

| # | Feature | Status |
|---|---------|--------|
| 1 | **DEFAULT alias support** | ✅ Creates `MainActivityDEFAULT` alias to prevent crashes |
| 2 | **Deep link migration** | ✅ Automatically migrates all intent filters to aliases |
| 3 | **App label switching** | ✅ Supports `label` property per icon (Android) |
| 4 | **Immediate switch** | ✅ Supports immediate switching (no forced delay) |
| 5 | **Toast feedback** | ✅ Native toast notifications (Android) |
| 6 | **Adaptive icons** | ✅ Full support for Android adaptive icons |
| 7 | **iOS dark mode** | ✅ Support for light/dark/tinted icon variants (iOS 18+) |
| 8 | **Label-only mode** | ✅ Change app name without changing icon |
| 9 | **Safe switching** | ✅ Enable-first, disable-second ordering prevents crashes |

## 📦 Installation

```bash
npm install @praneeth26/expo-dynamic-app-identity
# or
yarn add @praneeth26/expo-dynamic-app-identity
```

After installation, configure the plugin in your `app.json` (see Configuration section below), then run:

```bash
npx expo prebuild --clean
```

This generates the native code with the dynamic icon configuration.

## ⚙️ Configuration

Add the plugin to your `app.json` or `app.config.js`:

### Standard Format (with `icons` wrapper)

```json
{
  "expo": {
    "plugins": [
      [
        "@praneeth26/expo-dynamic-app-identity",
        {
          "icons": {
            "premium": {
              "image": "./assets/icons/premium.png",
              "label": "MyApp Premium"
            },
            "dark": {
              "image": "./assets/icons/dark.png",
              "label": "MyApp Dark"
            },
            "holiday": {
              "image": "./assets/icons/holiday.png"
            }
          }
        }
      ]
    ]
  }
}
```

### Simplified Format (without `icons` wrapper)

The plugin also supports a simplified format where icon definitions are at the root level:

```json
{
  "expo": {
    "plugins": [
      [
        "@praneeth26/expo-dynamic-app-identity",
        {
          "icon1": {
            "android": "./assets/resources/assets/icon.png",
            "ios": "./assets/resources/assets/icon.png",
            "prerendered": true
          },
          "icon2": {
            "android": "./assets/resources/assets/splash-icon.png",
            "ios": "./assets/resources/assets/splash-icon.png",
            "prerendered": true
          },
          "icon3": {
            "android": "./assets/resources/assets/icon4.png",
            "ios": "./assets/resources/assets/icon4.png",
            "prerendered": true
          }
        }
      ]
    ]
  }
}
```

Both formats are fully supported and will be automatically normalized by the plugin.

### Label-Only Mode (Android)

If you only want to change the app name without changing the icon:

```json
{
  "icons": {
    "enterprise": {
      "label": "MyApp Enterprise"
    }
  }
}
```
Note: When no `image` is provided, the default app icon is used.

### iOS Dark Mode Icons (iOS 18+)

Support for light/dark/tinted icon variants:

```json
{
  "icons": {
    "themed": {
      "ios": {
        "light": "./assets/icons/light.png",
        "dark": "./assets/icons/dark.png",
        "tinted": "./assets/icons/tinted.png"
      },
      "android": "./assets/icons/android.png",
      "label": "MyApp Themed"
    }
  }
}
```

### Android Adaptive Icons

Full support for Android adaptive icons:

```json
{
  "icons": {
    "adaptive": {
      "android": {
        "foregroundImage": "./assets/icons/foreground.png",
        "backgroundColor": "#FF5722"
      },
      "ios": "./assets/icons/ios.png",
      "label": "MyApp Adaptive"
    }
  }
}
```

### Platform-Specific Icons (Advanced)

Multiple formats are supported:

```json
{
  "icons": {
    "dark": {
      "image": "./assets/icons/dark.png",
      "androidImage": "./assets/icons/dark-android.png",
      "iosImage": "./assets/icons/dark-ios.png"
    }
  }
}
```

### Configuration Options

#### Icon Configuration

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `image` | string | ❌ | Path to icon image (used for both platforms) |
| `ios` | string \| object | ❌ | iOS icon - string or `{ light, dark, tinted }` |
| `android` | string \| object | ❌ | Android icon - string or `{ foregroundImage, backgroundColor }` |
| `iosImage` | string | ❌ | iOS-specific icon path (alternative to `ios`) |
| `androidImage` | string | ❌ | Android-specific icon path (alternative to `android`) |
| `label` | string | ❌ | App name to display (Android only) |
| `prerendered` | boolean | ❌ | iOS prerendered icon (default: true) |

#### Format Compatibility

This plugin supports multiple configuration formats for flexibility:

```json
// Simple format
{ "image": "./icon.png", "label": "MyApp" }

// Platform-specific
{ "iosImage": "./ios.png", "androidImage": "./android.png" }

// Full format
{ "ios": "./icon.png", "android": "./icon.png" }
{ "ios": { "light": "...", "dark": "...", "tinted": "..." } }
{ "android": { "foregroundImage": "...", "backgroundColor": "#fff" } }
```

#### Runtime Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `showToast` | boolean | true | Show toast after switching (Android only) |
| `immediate` | boolean | true | Switch immediately (false = wait for background on Android) |
| `delay` | number | 5000 | Delay in milliseconds before switching when immediate=false (Android only) |

## 🚀 Usage

### Basic Usage

```typescript
import { setAppIdentity, getAppIdentity } from '@praneeth26/expo-dynamic-app-identity';

// Switch to a named icon
await setAppIdentity('premium');

// Switch back to default
await setAppIdentity(null);
// or
await setAppIdentity('DEFAULT');

// Get current icon
const currentIcon = getAppIdentity();
console.log(currentIcon); // 'premium' or 'DEFAULT'
```

### Advanced Usage

```typescript
import { 
  setAppIdentity, 
  getAppIdentity, 
  getAvailableIcons 
} from '@praneeth26/expo-dynamic-app-identity';

// Switch without toast notification
await setAppIdentity('premium', { showToast: false });

// Switch when app goes to background (legacy behavior)
await setAppIdentity('premium', { immediate: false });

// Switch with custom delay (3 seconds instead of default 5)
await setAppIdentity('premium', { immediate: false, delay: 3000 });

// Get all available icons
const icons = getAvailableIcons();
console.log(icons); // ['DEFAULT', 'premium', 'dark', 'holiday']
```

### Backward Compatibility

Aliases are provided for convenience:

```typescript
import { setAppIcon, getAppIcon } from '@praneeth26/expo-dynamic-app-identity';

// These work the same as setAppIdentity/getAppIdentity
await setAppIcon('premium');
const current = getAppIcon();
```

## 📱 Platform Support

| Feature | Android | iOS |
|---------|---------|-----|
| Icon switching | ✅ | ✅ |
| Label switching | ✅ | ❌ (iOS limitation) |
| Immediate switch | ✅ | ✅ |
| Toast feedback | ✅ | ❌ (uses system alert) |
| Deep link migration | ✅ | N/A |

## 🔧 How It Works

### Android

1. **Config Plugin** modifies `AndroidManifest.xml`:
   - Removes intent filters from base `MainActivity`
   - Creates `MainActivityDEFAULT` alias with all intent filters
   - Creates aliases for each custom icon with `android:label` and intent filters

2. **Resource Generation** copies icons to `mipmap-*` folders:
   - Generates all density variants (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
   - Creates round icon variants

3. **Runtime Module** uses `PackageManager.setComponentEnabledSetting()`:
   - Disables all aliases except the target
   - Shows toast notification (optional)
   - Supports immediate switching (no delay)

### iOS

1. **Config Plugin** modifies `Info.plist`:
   - Adds `CFBundleAlternateIcons` configuration

2. **Resource Copying** adds icons to iOS project

3. **Runtime Module** uses `UIApplication.setAlternateIconName()`:
   - iOS handles icon switching natively
   - System alert is shown by default

## 🐛 Troubleshooting

### Icon not changing on Android

1. Make sure you ran `npx expo prebuild` after adding the plugin
2. Check that icon files exist at the specified paths
3. Verify the icon names in `app.json` match your code

### App crashes when switching back to default

This plugin creates a `MainActivityDEFAULT` alias to prevent crashes. If you still have issues, ensure you're using `setAppIdentity(null)` or `setAppIdentity('DEFAULT')`.

### Deep links not working

This plugin automatically migrates all intent filters to aliases. If you still have issues:

1. Run `npx expo prebuild --clean`
2. Check that deep links are configured in `app.json`

### iOS icon not changing

1. iOS requires icons to be added to the Xcode project
2. Run `npx expo prebuild` to copy icons
3. iOS always shows a system alert when changing icons

## 📄 License

MIT

## 🙏 Credits

Inspired by and improvements upon:
- [@sefatunckanat/expo-dynamic-app-icon]
