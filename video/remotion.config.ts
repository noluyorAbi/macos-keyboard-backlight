/**
 * Remotion config.
 *
 * Keep this file CODEC-AGNOSTIC. It applies to every render regardless of the
 * codec, so a codec-specific option set here breaks the other codec. Putting
 * Config.setCrf() or Config.setPixelFormat() in this file makes every GIF
 * render die with:
 *
 *   TypeError: The "gif" codec does not support the --crf option.
 *
 * Pass codec-specific flags on the CLI instead (see the package.json scripts).
 *
 * setJpegQuality is safe here: it controls the intermediate frame capture, not
 * the codec. 95 keeps small monospaced text free of the ringing artefacts the
 * default (80) leaves around glyph edges.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
