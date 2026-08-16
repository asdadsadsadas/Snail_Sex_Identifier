/// Photo helpers — resize + JPEG re-encode, mirroring the web app's
/// compressImage() so records stay small in local storage.
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:image/image.dart' as img;

/// Resize [bytes] so the longest side is at most [maxDim] and re-encode as
/// JPEG at [quality] (0–100). Returns the compressed JPEG bytes.
Uint8List compressBytes(Uint8List bytes, {int maxDim = 720, int quality = 80}) {
  final decoded = img.decodeImage(bytes);
  if (decoded == null) return bytes;
  final resized = _fit(decoded, maxDim);
  return Uint8List.fromList(img.encodeJpg(resized, quality: quality));
}

/// Compress to ~480px / quality 60 and return a base64 string (no data-URL
/// prefix) — what gets stored in a SnailRecord.
String compressToBase64(Uint8List bytes) {
  final compressed = compressBytes(bytes, maxDim: 480, quality: 60);
  return base64Encode(compressed);
}

img.Image _fit(img.Image image, int maxDim) {
  final w = image.width, h = image.height;
  if (w <= maxDim && h <= maxDim) return image;
  if (w >= h) {
    return img.copyResize(image, width: maxDim);
  }
  return img.copyResize(image, height: maxDim);
}
