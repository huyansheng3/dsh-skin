/**
 * Theme package type definitions.
 *
 * A DSH Skin theme package is a ZIP archive containing:
 *   manifest.json  — metadata, versioning, capability flags
 *   theme.json      — color overrides for light/dark modes
 *   theme.css       — additional custom CSS (Safe CSS validated)
 *   background.{webp,jpg,png} — optional 16:9 background image
 *   LICENSE.txt     — optional license for the theme assets
 */

/**
 * The manifest declares theme identity, compatibility, and payload integrity.
 */
export interface ThemeManifest {
  /** Schema version for this manifest format. */
  schema: 1;

  /** Unique theme identifier (kebab-case, 3-63 chars). */
  id: string;

  /** Human-readable display name. */
  name: string;

  /** Author credit. */
  author?: string;

  /** Semantic version of this theme release. */
  version: string;

  /** Legacy compatibility field; the Cordis Host currently does not enforce it. */
  minInjectorVersion?: string;

  /** Legacy target platform metadata; the current runtime supports DSH Web. */
  platform: "any" | "macos" | "windows" | "linux";

  /** Legacy capability declarations retained for schema-1 themes. */
  capabilities: {
    /** Theme overrides CSS variables. */
    "css-variables": boolean;
    /** Theme ships a background image. */
    "background-image": boolean;
    /** Theme includes custom Safe CSS. */
    "safe-css": boolean;
  };

  /** SHA-256 hashes for each payload file, keyed by filename. */
  integrity?: Record<string, string>;
}

/**
 * The theme.json holds the actual color overrides.
 * Keys are CSS custom property names (--dsw-*), values are CSS color values.
 * Both light and dark variants are provided; either may be empty.
 */
export interface ThemeColors {
  /** Overrides applied to `body` (light mode). */
  light?: Record<string, string>;

  /** Overrides applied to `body[data-ds-dark-theme]` (dark mode). */
  dark?: Record<string, string>;
}

/**
 * The full theme.json document.
 */
export interface ThemeJSON {
  schema: 1;
  colors: ThemeColors;
  /** Optional background image configuration. */
  background?: {
    /** Image filename inside the theme package. */
    file: string;
    /** Background-size CSS value. Default: cover. */
    size?: string;
    /** Background-position CSS value. Default: center. */
    position?: string;
    /** Opacity multiplier 0-1 for the background layer. Default: 1. */
    opacity?: number;
    /** Blur in px applied to the background. Default: 0. */
    blur?: number;
  };
}

/**
 * An installed theme in the local theme library.
 */
export interface InstalledTheme {
  manifest: ThemeManifest;
  themeJson: ThemeJSON;
  /** Absolute path to the theme directory. */
  dir: string;
  /** Whether the theme has a background image. */
  hasBackground: boolean;
  /** Background image path if present. */
  backgroundPath?: string;
}

/**
 * The active skin state persisted by the theme manager and Cordis Host API.
 */
export interface SkinState {
  /** Missing on first run; null explicitly selects the official appearance. */
  activeThemeId?: string | null;
  /** Legacy state field retained for compatibility. */
  autoApply: boolean;
  /** Last applied timestamp (ISO 8601). */
  lastApplied: string | null;
  /** Monotonic stylesheet cache revision. */
  revision?: number;
}
