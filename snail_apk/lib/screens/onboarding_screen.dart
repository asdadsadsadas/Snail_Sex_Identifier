import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../theme.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onComplete});

  final VoidCallback onComplete;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _controller = PageController();
  int _page = 0;
  bool? _cameraGranted;
  bool _requestingCamera = false;

  static const List<({IconData icon, String title, String subtitle})> _slides = [
    (
      icon: Icons.filter_vintage_rounded,
      title: 'Welcome to Snail Sexing AI',
      subtitle: 'AI-powered snail classification for researchers and hobbyists',
    ),
    (
      icon: Icons.qr_code_scanner_rounded,
      title: 'How It Works',
      subtitle: 'Three simple steps to classify your snails',
    ),
    (
      icon: Icons.camera_alt_rounded,
      title: 'Camera Access Needed',
      subtitle: 'Allow camera access to photograph snail shells for AI analysis',
    ),
  ];

  static const List<({List<Color> colors})> _gradients = [
    (colors: [AppColors.teal, AppColors.tealDark]),
    (colors: [AppColors.tealDark, AppColors.maleFg]),
    (colors: [AppColors.maleFg, AppColors.teal]),
  ];

  static const List<({IconData icon, String label, String desc})> _steps = [
    (icon: Icons.camera_alt_rounded, label: 'Capture', desc: 'Take a photo of the snail shell'),
    (icon: Icons.psychology_rounded, label: 'Analyze', desc: 'AI model predicts sex & pregnancy'),
    (icon: Icons.check_circle_rounded, label: 'Results', desc: 'Review & save to your log'),
  ];

  Future<void> _requestCameraPermission() async {
    setState(() => _requestingCamera = true);
    try {
      // Initializing a controller triggers Android's runtime permission dialog.
      final cameras = await availableCameras();
      if (cameras.isNotEmpty) {
        final controller = CameraController(
          cameras.firstWhere(
            (c) => c.lensDirection == CameraLensDirection.back,
            orElse: () => cameras.first,
          ),
          ResolutionPreset.low,
          enableAudio: false,
        );
        await controller.initialize();
        await controller.dispose();
      }
      if (mounted) setState(() => _cameraGranted = true);
    } catch (_) {
      if (mounted) setState(() => _cameraGranted = false);
    } finally {
      if (mounted) setState(() => _requestingCamera = false);
    }
  }

  void _next() {
    if (_page < _slides.length - 1) {
      _controller.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    } else {
      widget.onComplete();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _page == _slides.length - 1;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          // Skip button
          if (!isLast)
            Positioned(
              top: 0,
              right: 0,
              child: SafeArea(
                child: TextButton(
                  onPressed: widget.onComplete,
                  child: Text('Skip',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: AppColors.gray400)),
                ),
              ),
            ),
          SafeArea(
            child: Column(
              children: [
                // Slide content
                Expanded(
                  child: PageView.builder(
                    controller: _controller,
                    itemCount: _slides.length,
                    onPageChanged: (i) => setState(() => _page = i),
                    itemBuilder: (context, i) => _buildSlide(i),
                  ),
                ),
                // Dots
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_slides.length, (i) {
                      final active = i == _page;
                      return InkWell(
                        onTap: () => _controller.animateToPage(
                          i,
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeOut,
                        ),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 250),
                          margin: const EdgeInsets.symmetric(horizontal: 5),
                          width: active ? 32 : 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: active ? AppColors.teal : AppColors.gray300,
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      );
                    }),
                  ),
                ),
                // Next / Get Started
                Padding(
                  padding: const EdgeInsets.fromLTRB(32, 20, 32, 24),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _next,
                      icon: isLast
                          ? const Icon(Icons.auto_awesome_rounded, size: 20)
                          : const Icon(Icons.chevron_right_rounded, size: 20),
                      label: Text(isLast ? 'Get Started' : 'Next',
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w600)),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.teal,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                        shadowColor: AppColors.teal.withValues(alpha: 0.35),
                        elevation: 6,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSlide(int i) {
    final slide = _slides[i];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Gradient header with icon + decorative circles
        Container(
          height: 280,
          width: double.infinity,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: _gradients[i].colors,
            ),
          ),
          child: Stack(
            children: [
              // Decorative circles
              Positioned(
                top: -60,
                right: -60,
                child: Container(
                  width: 220,
                  height: 220,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: 0.05),
                  ),
                ),
              ),
              Positioned(
                bottom: -30,
                left: -30,
                child: Container(
                  width: 160,
                  height: 160,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: 0.05),
                  ),
                ),
              ),
              Positioned(
                top: 90,
                left: 100,
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: 0.05),
                  ),
                ),
              ),
              // Sparkles
              Positioned(
                top: 40,
                right: 40,
                child: Icon(Icons.auto_awesome_rounded,
                    size: 24, color: Colors.white30),
              ),
              Positioned(
                bottom: 40,
                left: 40,
                child: Icon(Icons.auto_awesome_rounded,
                    size: 16, color: Colors.white24),
              ),
              // Icon chip
              Center(
                child: Container(
                  width: 112,
                  height: 112,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.white30),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.15),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Icon(slide.icon, size: 56, color: Colors.white),
                ),
              ),
            ],
          ),
        ),
        // Text + content
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(32, 28, 32, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(slide.title,
                    style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: AppColors.gray900,
                        height: 1.2)),
                const SizedBox(height: 8),
                Text(slide.subtitle,
                    style: const TextStyle(
                        fontSize: 15,
                        color: AppColors.gray500,
                        height: 1.5)),
                if (i == 1) ...[
                  const SizedBox(height: 24),
                  for (final step in _steps) ...[
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: AppColors.mint,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(step.icon,
                              size: 20, color: AppColors.teal),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(step.label,
                                    style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.gray900)),
                                const SizedBox(height: 2),
                                Text(step.desc,
                                    style: const TextStyle(
                                        fontSize: 14,
                                        color: AppColors.gray500)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],
                ],
                if (i == 2) _buildCameraPermissionCard(),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCameraPermissionCard() {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.gray200),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.shield_rounded, size: 20, color: AppColors.teal),
                    SizedBox(width: 12),
                    Text('Camera Permission',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.gray900)),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Snail Sexing AI needs camera access to photograph snail shells for AI-powered classification. Your photos are processed securely and stored on your device.',
                  style: const TextStyle(
                      fontSize: 14, color: AppColors.gray500, height: 1.5),
                ),
                const SizedBox(height: 16),
                if (_cameraGranted == null) ...[
                  FilledButton.icon(
                    onPressed: _requestingCamera ? null : _requestCameraPermission,
                    icon: _requestingCamera
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.camera_alt_rounded, size: 18),
                    label: Text(_requestingCamera ? 'Requesting...' : 'Grant Camera Access',
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600)),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.tealDark,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ] else if (_cameraGranted == true)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.check_circle_rounded,
                            size: 18, color: Color(0xFF16A34A)),
                        SizedBox(width: 8),
                        Text('Camera access granted!',
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF15803D))),
                      ],
                    ),
                  )
                else ...[
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.camera_alt_rounded,
                            size: 18, color: Color(0xFFB45309)),
                        SizedBox(width: 8),
                        Text('Camera access denied',
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF92400E))),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'You can still use the gallery to upload photos. To enable camera later, go to your device settings.',
                    style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.gray400,
                        height: 1.5),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _requestingCamera ? null : _requestCameraPermission,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.teal,
                      side: const BorderSide(color: AppColors.teal),
                      minimumSize: const Size.fromHeight(44),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Try Again',
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w500)),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFDBEAFE)),
            ),
            child: const Text(
              '🔒 Privacy first: All photos are processed locally for AI inference and stored securely. We never share your data with third parties.',
              style: TextStyle(
                  fontSize: 12, color: Color(0xFF1D4ED8), height: 1.5),
            ),
          ),
        ],
      ),
    );
  }
}
