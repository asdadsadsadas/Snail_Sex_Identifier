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
  bool _saving = false;

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
    setState(() => _saving = true);
    await widget.storage.update(widget.recordId, updated);
    if (!mounted) return;
    setState(() {
      _record = updated;
      _saving = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Record updated')),
    );
  }

  Future<void> _confirmDelete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete record?'),
        content: const Text('This scan will be permanently removed from your device.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok == true) {
      await widget.storage.delete(widget.recordId);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final record = _record;
    if (record == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Record not found')),
      );
    }
    final isMale = record.gender == SnailGender.male;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan Detail', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            tooltip: 'Delete',
            onPressed: _confirmDelete,
            icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: record.photoBase64.isEmpty
                ? Container(
                    height: 220,
                    color: Colors.grey.shade200,
                    child: const Icon(Icons.image_rounded, size: 48, color: Colors.grey),
                  )
                : Image.memory(
                    base64Decode(record.photoBase64),
                    height: 220,
                    fit: BoxFit.cover,
                  ),
          ),
          const SizedBox(height: 16),
          _card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _row('Date', DateFormat('MMMM d, yyyy').format(record.createdAt)),
                _row('Confidence', '${record.confidence.toStringAsFixed(1)}%'),
                _row('Saved', DateFormat('h:mm a').format(record.createdAt)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Sex',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 8),
                SegmentedButton<SnailGender>(
                  segments: const [
                    ButtonSegment(
                      value: SnailGender.male,
                      label: Text('Male'),
                      icon: Icon(Icons.male_rounded),
                    ),
                    ButtonSegment(
                      value: SnailGender.female,
                      label: Text('Female'),
                      icon: Icon(Icons.female_rounded),
                    ),
                  ],
                  selected: {record.gender},
                  onSelectionChanged: _saving
                      ? null
                      : (s) => _save(record.copyWith(gender: s.first)),
                  style: ButtonStyle(
                    backgroundColor: WidgetStateProperty.resolveWith(
                      (states) => states.contains(WidgetState.selected)
                          ? (isMale ? AppColors.maleBg : AppColors.femaleBg)
                          : null,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Pregnancy',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 8),
                SegmentedButton<PregnantStatus>(
                  segments: const [
                    ButtonSegment(
                      value: PregnantStatus.pregnant,
                      label: Text('Pregnant'),
                    ),
                    ButtonSegment(
                      value: PregnantStatus.notPregnant,
                      label: Text('Not Pregnant'),
                    ),
                  ],
                  selected: {record.pregnantStatus},
                  onSelectionChanged: _saving
                      ? null
                      : (s) => _save(record.copyWith(pregnantStatus: s.first)),
                  style: ButtonStyle(
                    backgroundColor: WidgetStateProperty.resolveWith(
                      (states) => states.contains(WidgetState.selected)
                          ? AppColors.pregBg
                          : null,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Morphological Notes',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 8),
                Text(
                  record.morphologicalNotes,
                  style: TextStyle(
                    color: Colors.grey.shade700,
                    height: 1.5,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _card({required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
          Text(value,
              style: const TextStyle(
                  color: Color(0xFF111827),
                  fontWeight: FontWeight.w600,
                  fontSize: 13)),
        ],
      ),
    );
  }
}
