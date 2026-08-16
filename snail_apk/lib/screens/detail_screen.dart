import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../services/storage_service.dart';
import '../theme.dart';

class DetailScreen extends StatefulWidget {
  const DetailScreen({super.key, required this.recordId, required this.storage});

  final String recordId;
  final StorageService storage;

  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  SnailRecord? _record;
  bool _loading = true;
  bool _editing = false;
  bool _saving = false;
  String? _error;
  bool _deleted = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final record = await widget.storage.getById(widget.recordId);
    if (!mounted) return;
    setState(() {
      _record = record;
      _loading = false;
    });
  }

  Future<void> _save(SnailRecord updated) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.storage.update(widget.recordId, updated);
      if (!mounted) return;
      setState(() {
        _record = updated;
        _editing = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Failed to save changes');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _confirmDelete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => _DeleteDialog(
        onDelete: () async {
          await widget.storage.delete(widget.recordId);
          return true;
        },
      ),
    );
    if (ok == true && mounted) {
      setState(() => _deleted = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: AppColors.teal)),
      );
    }
    if (_deleted) {
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.check_circle_rounded,
                    size: 48, color: Color(0xFF16A34A)),
                const SizedBox(height: 16),
                const Text('Record Deleted', style: AppText.h1),
                const SizedBox(height: 8),
                Text('The record has been permanently removed.',
                    style: AppText.subtitle),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  style: tealButtonStyle(),
                  child: const Text('Back to History'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    final record = _record;
    if (record == null) {
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.warning_amber_rounded,
                    size: 48, color: Color(0xFFB45309)),
                const SizedBox(height: 16),
                const Text('Not Found', style: AppText.h1),
                const SizedBox(height: 8),
                Text(_error ?? 'Record not found', style: AppText.subtitle),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: tealButtonStyle(),
                  child: const Text('Back to History'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final isMale = record.gender == SnailGender.male;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            // Scrollable content
            ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: [
                // Photo header with gradient
                Stack(
                  children: [
                    Container(
                      height: 256,
                      width: double.infinity,
                      color: AppColors.gray200,
                      child: record.photoBase64.isEmpty
                          ? const Icon(Icons.filter_vintage_rounded,
                              size: 64, color: AppColors.gray400)
                          : Image.memory(base64Decode(record.photoBase64),
                              fit: BoxFit.cover),
                    ),
                    // Gradient from black/60 at bottom
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                            colors: [
                              Colors.black.withValues(alpha: 0.6),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                // Content card overlapping the photo
                Transform.translate(
                  offset: const Offset(0, -64),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: AppColors.gray100),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.12),
                            blurRadius: 24,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Main info row
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: isMale
                                      ? AppColors.maleBg
                                      : AppColors.femaleBg,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Icon(
                                  isMale
                                      ? Icons.male_rounded
                                      : Icons.female_rounded,
                                  size: 24,
                                  color: isMale
                                      ? AppColors.maleFg
                                      : AppColors.femaleFg,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(record.gender.label,
                                            style: const TextStyle(
                                                fontSize: 20,
                                                fontWeight: FontWeight.bold,
                                                color: AppColors.gray900)),
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: isMale
                                                ? AppColors.maleBg
                                                : AppColors.femaleBg,
                                            borderRadius:
                                                BorderRadius.circular(999),
                                          ),
                                          child: Text(
                                            record.pregnantStatus.label,
                                            style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w500,
                                                color: isMale
                                                    ? AppColors.maleFg
                                                    : AppColors.femaleFg),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      DateFormat('MMM d, yyyy')
                                          .format(record.createdAt),
                                      style: AppText.muted,
                                    ),
                                  ],
                                ),
                              ),
                              if (!_editing)
                                InkWell(
                                  onTap: () => setState(() => _editing = true),
                                  borderRadius: BorderRadius.circular(12),
                                  child: Container(
                                    width: 40,
                                    height: 40,
                                    decoration: BoxDecoration(
                                      color: AppColors.mint,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Icon(Icons.edit_rounded,
                                        size: 18, color: AppColors.teal),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          // Confidence box
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.gray100,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 32,
                                  height: 32,
                                  decoration: BoxDecoration(
                                    color: AppColors.mint,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  alignment: Alignment.center,
                                  child: const Text('AI',
                                      style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.teal)),
                                ),
                                const SizedBox(width: 12),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Confidence Score', style: AppText.muted),
                                    Text(
                                      '${record.confidence.toStringAsFixed(1)}%',
                                      style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.gray900),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 24),
                          // Morphological notes
                          const Text('Morphological Notes',
                              style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.gray900)),
                          const SizedBox(height: 8),
                          Text(
                            record.morphologicalNotes.isEmpty
                                ? 'No notes recorded.'
                                : record.morphologicalNotes,
                            style: const TextStyle(
                                fontSize: 14,
                                color: AppColors.gray600,
                                height: 1.5),
                          ),
                          if (_editing) ...[
                            const SizedBox(height: 20),
                            const Divider(color: AppColors.gray100),
                            const SizedBox(height: 16),
                            _buildEditor(record),
                          ],
                          if (_error != null) ...[
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF2F2),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.warning_amber_rounded,
                                      size: 14, color: Color(0xFFB91C1C)),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(_error!,
                                        style: const TextStyle(
                                            fontSize: 12,
                                            color: Color(0xFFB91C1C))),
                                  ),
                                ],
                              ),
                            ),
                          ],
                          if (!_editing) ...[
                            const SizedBox(height: 24),
                            // Delete button
                            InkWell(
                              onTap: _confirmDelete,
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                      color: const Color(0xFFFECACA)),
                                ),
                                child: const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.delete_outline_rounded,
                                        size: 16, color: Color(0xFFDC2626)),
                                    SizedBox(width: 8),
                                    Text('Delete Record',
                                        style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w500,
                                            color: Color(0xFFDC2626))),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            // Floating back button
            Positioned(
              top: 8,
              left: 16,
              child: InkWell(
                onTap: () => Navigator.of(context).pop(),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.arrow_back_rounded,
                      size: 20, color: AppColors.gray700),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEditor(SnailRecord record) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Edit Classification',
            style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900)),
        const SizedBox(height: 12),
        // Sex selector
        const Text('Sex',
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.gray500)),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _selectButton('Male', record.gender == SnailGender.male,
                AppColors.maleBg, AppColors.maleFg, Icons.male_rounded, () {
              _save(record.copyWith(gender: SnailGender.male));
            })),
            const SizedBox(width: 8),
            Expanded(child: _selectButton('Female', record.gender == SnailGender.female,
                AppColors.femaleBg, AppColors.femaleFg, Icons.female_rounded, () {
              _save(record.copyWith(gender: SnailGender.female));
            })),
          ],
        ),
        const SizedBox(height: 16),
        // Pregnancy selector (females only)
        if (record.gender == SnailGender.female) ...[
          const Text('Pregnancy Status',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: AppColors.gray500)),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _selectButton('Pregnant',
                  record.pregnantStatus == PregnantStatus.pregnant,
                  AppColors.pregBg, AppColors.pregFg, Icons.child_care_rounded, () {
                _save(record.copyWith(pregnantStatus: PregnantStatus.pregnant));
              })),
              const SizedBox(width: 8),
              Expanded(child: _selectButton('Not Pregnant',
                  record.pregnantStatus == PregnantStatus.notPregnant,
                  AppColors.pregBg, AppColors.pregFg, null, () {
                _save(record.copyWith(pregnantStatus: PregnantStatus.notPregnant));
              })),
            ],
          ),
        ] else
          Text('Pregnancy status only applies to female snails.',
              style: TextStyle(
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  color: AppColors.gray400)),
        const SizedBox(height: 16),
        // Save / cancel
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: _saving ? null : () => setState(() => _editing = false),
                icon: _saving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.save_rounded, size: 16),
                label: const Text('Save'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.teal,
                  foregroundColor: Colors.white,
                  textStyle: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w500),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(width: 8),
            InkWell(
              onTap: () => setState(() => _editing = false),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.gray100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.close_rounded,
                    size: 16, color: AppColors.gray600),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _selectButton(
    String label,
    bool active,
    Color activeBg,
    Color activeFg,
    IconData? icon,
    VoidCallback onTap,
  ) {
    return InkWell(
      onTap: _saving ? null : onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: active ? activeBg : AppColors.gray100,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 16, color: active ? activeFg : AppColors.gray500),
              const SizedBox(width: 6),
            ],
            Text(label,
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: active ? activeFg : AppColors.gray500)),
          ],
        ),
      ),
    );
  }
}

/// Delete confirmation dialog styled like the web modal.
class _DeleteDialog extends StatelessWidget {
  const _DeleteDialog({required this.onDelete});

  final Future<bool> Function() onDelete;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.delete_outline_rounded,
                  size: 28, color: Color(0xFFDC2626)),
            ),
            const SizedBox(height: 12),
            const Text('Delete Record?',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.gray900)),
            const SizedBox(height: 8),
            Text(
              'This will permanently delete this snail record. This action cannot be undone.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 14,
                  color: AppColors.gray500,
                  height: 1.4),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: () async {
                      final done = await onDelete();
                      if (done && context.mounted) Navigator.pop(context, true);
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFDC2626),
                      foregroundColor: Colors.white,
                      textStyle: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.delete_outline_rounded, size: 18),
                        SizedBox(width: 8),
                        Text('Delete'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: () => Navigator.pop(context, false),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.gray100,
                      foregroundColor: AppColors.gray600,
                      textStyle: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Text('Cancel'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
