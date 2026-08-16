import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../models.dart';
import '../services/api_service.dart';
import '../services/photo_utils.dart';
import '../services/storage_service.dart';
import '../theme.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key, required this.onNavigate, required this.storage});

  final void Function(String screen) onNavigate;
  final StorageService storage;

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final ApiService _api = ApiService();
  final ImagePicker _picker = ImagePicker();

  CameraController? _camera;
  bool _cameraStarting = false;
  bool _cameraDenied = false;
  bool _torchOn = false;

  Uint8List? _captured; // current photo (JPEG bytes)
  bool _classifying = false;
  ClassificationResult? _result;
  bool _saving = false;
  bool _saved = false;
  String? _error;

  @override
  void dispose() {
    _camera?.dispose();
    super.dispose();
  }

  // ── Camera management ──────────────────────────────────────────

  Future<void> _startCamera() async {
    setState(() {
      _cameraStarting = true;
      _cameraDenied = false;
      _error = null;
    });
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) throw CameraException('NoCamera', 'No cameras found');
      final back = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      final controller = CameraController(back, ResolutionPreset.high, enableAudio: false);
      await controller.initialize();
      if (!mounted) {
        controller.dispose();
        return;
      }
      await _camera?.dispose();
      setState(() {
        _camera = controller;
        _cameraStarting = false;
        _torchOn = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _cameraStarting = false;
        _cameraDenied = true;
        _error = 'Camera unavailable. Use gallery upload instead.';
      });
    }
  }

  Future<void> _stopCamera() async {
    final cam = _camera;
    _camera = null;
    if (cam != null) {
      try {
        await cam.dispose();
      } catch (_) {}
    }
    if (mounted) {
      setState(() {
        _torchOn = false;
        _cameraStarting = false;
      });
    }
  }

  Future<void> _toggleTorch() async {
    final cam = _camera;
    if (cam == null || !cam.value.isInitialized) return;
    final next = _torchOn ? FlashMode.off : FlashMode.torch;
    try {
      await cam.setFlashMode(next);
      if (mounted) setState(() => _torchOn = !_torchOn);
    } catch (_) {
      // Torch not supported on this device — ignore silently.
    }
  }

  // ── Capture / classify ─────────────────────────────────────────

  Future<void> _capturePhoto() async {
    final cam = _camera;
    if (cam == null || !cam.value.isInitialized) return;
    try {
      final xfile = await cam.takePicture();
      final bytes = await xfile.readAsBytes();
      await _stopCamera();
      await _classifyImage(bytes);
    } catch (e) {
      if (mounted) setState(() => _error = 'Capture failed. Please try again.');
    }
  }

  Future<void> _pickFromGallery() async {
    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1920,
      imageQuality: 88,
    );
    if (file == null) return;
    final bytes = await file.readAsBytes();
    await _stopCamera();
    await _classifyImage(bytes);
  }

  Future<void> _classifyImage(Uint8List raw) async {
    final compressed = compressBytes(raw, maxDim: 720, quality: 80);
    if (!mounted) return;
    setState(() {
      _captured = compressed;
      _classifying = true;
      _result = null;
      _saved = false;
      _error = null;
    });
    try {
      final result = await _api.classify(compressed);
      if (!mounted) return;
      setState(() => _result = result);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Classification failed. Please try again.');
    } finally {
      if (mounted) setState(() => _classifying = false);
    }
  }

  Future<void> _saveRecord() async {
    final captured = _captured;
    final result = _result;
    if (captured == null || result == null || result.noSnail) return;
    setState(() => _saving = true);
    try {
      final now = DateTime.now();
      final date = '${now.year.toString().padLeft(4, '0')}-'
          '${now.month.toString().padLeft(2, '0')}-'
          '${now.day.toString().padLeft(2, '0')}';
      await widget.storage.add(SnailRecord(
        id: StorageService.newId(),
        photoBase64: compressToBase64(captured),
        date: date,
        gender: result.sex ?? SnailGender.male,
        pregnantStatus: result.pregnancyStatus,
        confidence: result.confidence,
        morphologicalNotes: result.morphologicalNotes,
        createdAt: now,
      ));
      if (mounted) setState(() => _saved = true);
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed to save record. Please try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _reset() {
    _stopCamera();
    setState(() {
      _captured = null;
      _result = null;
      _saved = false;
      _error = null;
      _cameraDenied = false;
    });
  }

  // ── Derived state ──────────────────────────────────────────────

  bool get _showWelcome =>
      !_cameraStarting && _camera == null && _captured == null && !_cameraDenied;
  bool get _showLive => _camera != null && _captured == null && !_classifying;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 4),
            child: Row(
              children: [
                Icon(Icons.qr_code_scanner_rounded, color: Colors.white, size: 22),
                const SizedBox(width: 10),
                const Text(
                  'Scan Snail',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          // Main area
          Expanded(
            child: ClipRRect(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (_showWelcome) _buildWelcome(),
                  if (_cameraStarting) _buildStarting(),
                  if (_showLive && _camera != null) _buildLivePreview(),
                  if (_cameraDenied) _buildCameraFallback(),
                  if (_captured != null) _buildCaptured(),
                  if (_classifying) _buildClassifyingOverlay(),
                  if (_result != null && !_classifying) _buildResultOverlay(),
                  if (_error != null && !_cameraDenied) _buildErrorToast(),
                ],
              ),
            ),
          ),
          // Bottom controls
          if (_showLive || _result != null || _saved) _buildBottomControls(),
        ],
      ),
    );
  }

  // ── Sub-widgets ────────────────────────────────────────────────

  Widget _buildWelcome() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF111827), Color(0xFF111827), AppColors.darkBg],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: AppColors.teal.withValues(alpha: 0.2),
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.teal.withValues(alpha: 0.3), width: 3),
              ),
              child: const Icon(Icons.qr_code_scanner_rounded,
                  size: 44, color: AppColors.mint),
            ),
            const SizedBox(height: 24),
            const Text(
              'Scan a Snail',
              style: TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Position the snail shell in the center and tap the shutter to classify its sex and pregnancy status.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade400, height: 1.5),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _startCamera,
                icon: const Icon(Icons.camera_alt_rounded),
                label: const Text('Start Camera'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.teal,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 6,
                  shadowColor: AppColors.teal.withValues(alpha: 0.35),
                ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _pickFromGallery,
                icon: const Icon(Icons.photo_library_rounded),
                label: const Text('Upload from Gallery'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.grey.shade300,
                  side: BorderSide(color: Colors.grey.shade700),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStarting() {
    return Container(
      color: const Color(0xFF111827),
      child: const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: AppColors.mint),
            SizedBox(height: 16),
            Text('Starting camera…', style: TextStyle(color: Colors.white70)),
          ],
        ),
      ),
    );
  }

  Widget _buildLivePreview() {
    return Stack(
      fit: StackFit.expand,
      children: [
        CameraPreview(_camera!),
        // Viewfinder corner overlay
        IgnorePointer(
          child: Center(
            child: AspectRatio(
              aspectRatio: 4 / 3,
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.symmetric(horizontal: 24),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.18),
                    width: 1,
                  ),
                ),
                child: Stack(
                  children: [
                    _corner(Alignment.topLeft),
                    _corner(Alignment.topRight),
                    _corner(Alignment.bottomLeft),
                    _corner(Alignment.bottomRight),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _corner(Alignment alignment) {
    final left = alignment.x == -1.0;
    final top = alignment.y == -1.0;
    return Align(
      alignment: alignment,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          border: Border(
            left: left ? const BorderSide(color: Colors.white, width: 2.5) : BorderSide.none,
            right: !left ? const BorderSide(color: Colors.white, width: 2.5) : BorderSide.none,
            top: top ? const BorderSide(color: Colors.white, width: 2.5) : BorderSide.none,
            bottom: !top ? const BorderSide(color: Colors.white, width: 2.5) : BorderSide.none,
          ),
        ),
      ),
    );
  }

  Widget _buildCameraFallback() {
    return Container(
      color: const Color(0xFF111827),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: Colors.grey.shade800,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.videocam_off_rounded,
                    size: 36, color: Colors.grey.shade500),
              ),
              const SizedBox(height: 16),
              const Text(
                'Camera Unavailable',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Camera access was denied or unavailable. You can still upload a photo from your gallery.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade400, height: 1.5),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _startCamera,
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF111827),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text('Try Again'),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _pickFromGallery,
                  icon: const Icon(Icons.photo_library_rounded),
                  label: const Text('Upload from Gallery'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.grey.shade300,
                    side: BorderSide(color: Colors.grey.shade600),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCaptured() {
    return Image.memory(_captured!, fit: BoxFit.cover);
  }

  Widget _buildClassifyingOverlay() {
    return Container(
      color: Colors.black38,
      child: Center(
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xE6111823),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white12),
          ),
          child: const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 36,
                height: 36,
                child: CircularProgressIndicator(color: AppColors.mint),
              ),
              SizedBox(height: 14),
              Text(
                'Analyzing snail morphology…',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildResultOverlay() {
    final result = _result!;
    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.96),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.4),
              blurRadius: 24,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: result.noSnail ? _buildNoSnail() : _buildResultCard(result),
      ),
    );
  }

  Widget _buildNoSnail() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.cancel_rounded, size: 26, color: Colors.grey.shade400),
        ),
        const SizedBox(height: 10),
        const Text(
          'No Snail Detected',
          style: TextStyle(
            color: Color(0xFF111827),
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'No snail was found in this photo. Move the snail into the frame and try again.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.grey.shade600, fontSize: 13, height: 1.4),
        ),
      ],
    );
  }

  Widget _buildResultCard(ClassificationResult result) {
    final sex = result.sex;
    final isMale = sex == SnailGender.male;
    final isFemale = sex == SnailGender.female;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: isMale
                    ? AppColors.maleBg
                    : isFemale
                        ? AppColors.femaleBg
                        : Colors.grey.shade200,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                isMale
                    ? Icons.male_rounded
                    : isFemale
                        ? Icons.female_rounded
                        : Icons.help_outline_rounded,
                size: 20,
                color: isMale
                    ? AppColors.maleFg
                    : isFemale
                        ? AppColors.femaleFg
                        : Colors.grey.shade500,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Row(
                children: [
                  Text(
                    sex?.label ?? 'Unknown',
                    style: const TextStyle(
                      color: Color(0xFF111827),
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: result.pregnancyStatus == PregnantStatus.pregnant
                          ? AppColors.pregBg
                          : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (result.pregnancyStatus == PregnantStatus.pregnant) ...[
                          const Icon(Icons.child_care_rounded,
                              size: 11, color: AppColors.pregFg),
                          const SizedBox(width: 3),
                        ],
                        Text(
                          result.pregnancyStatus.label,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: result.pregnancyStatus == PregnantStatus.pregnant
                                ? AppColors.pregFg
                                : Colors.grey.shade500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('Confidence',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
                Text(
                  '${result.confidence.toStringAsFixed(1)}%',
                  style: const TextStyle(
                    color: AppColors.teal,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          result.morphologicalNotes,
          style: TextStyle(
            color: Colors.grey.shade600,
            fontSize: 13,
            height: 1.5,
          ),
        ),
      ],
    );
  }

  Widget _buildErrorToast() {
    return SafeArea(
      child: Align(
        alignment: Alignment.topCenter,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF1F0),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFFECACA)),
          ),
          child: Row(
            children: [
              const Icon(Icons.cancel_rounded, color: Color(0xFFDC2626), size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _error!,
                  style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBottomControls() {
    if (_showLive) {
      return _buildLiveControls();
    }
    if (_saved) {
      return _buildSavedControls();
    }
    if (_result != null && _captured != null) {
      return _buildPostResultControls();
    }
    return const SizedBox.shrink();
  }

  Widget _buildLiveControls() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _circleButton(
            icon: Icons.photo_library_rounded,
            onTap: _pickFromGallery,
            tooltip: 'Upload from gallery',
          ),
          const SizedBox(width: 28),
          // Shutter
          GestureDetector(
            onTap: _capturePhoto,
            child: Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.3),
                    blurRadius: 12,
                  ),
                ],
              ),
              child: Container(
                margin: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFF111827), width: 2),
                ),
              ),
            ),
          ),
          const SizedBox(width: 28),
          _circleButton(
            icon: _torchOn ? Icons.flash_on_rounded : Icons.flashlight_on_rounded,
            color: _torchOn ? const Color(0xFFFFE082) : Colors.white,
            onTap: _toggleTorch,
            tooltip: _torchOn ? 'Turn off flash' : 'Turn on flash',
          ),
        ],
      ),
    );
  }

  Widget _circleButton({
    required IconData icon,
    required VoidCallback onTap,
    String? tooltip,
    Color color = Colors.white,
  }) {
    return Tooltip(
      message: tooltip ?? '',
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: Colors.white24,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white30),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
      ),
    );
  }

  Widget _buildPostResultControls() {
    final result = _result!;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      child: Row(
        children: [
          if (!result.noSnail)
            Expanded(
              child: FilledButton.icon(
                onPressed: _saving ? null : _saveRecord,
                icon: _saving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_rounded),
                label: Text(_saving ? 'Saving…' : 'Save to Log'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF111827),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
          if (result.noSnail) const Spacer(),
          const SizedBox(width: 12),
          OutlinedButton.icon(
            onPressed: _reset,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Retake'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: const BorderSide(color: Colors.white38),
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSavedControls() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      child: Row(
        children: [
          Expanded(
            child: FilledButton.icon(
              onPressed: () => widget.onNavigate('history'),
              icon: const Icon(Icons.history_rounded),
              label: const Text('View in History'),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF111827),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton.icon(
              onPressed: _reset,
              icon: const Icon(Icons.qr_code_scanner_rounded),
              label: const Text('Scan Another'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.mint,
                foregroundColor: AppColors.teal,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
