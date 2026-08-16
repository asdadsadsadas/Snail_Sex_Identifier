import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../services/storage_service.dart';
import '../theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.storage, required this.onNavigate});

  final StorageService storage;
  final void Function(String screen) onNavigate;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  SnailCounts _counts = const SnailCounts(total: 0, male: 0, female: 0, pregnant: 0);
  List<SnailRecord> _recent = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final counts = await widget.storage.getCounts();
    final recent = await widget.storage.getRecent(3);
    if (!mounted) return;
    setState(() {
      _counts = counts;
      _recent = recent;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Snail Sexing AI', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _refresh,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Count cards
            Row(
              children: [
                _countCard('Total', _counts.total, AppColors.teal, Icons.scanner_rounded),
                const SizedBox(width: 10),
                _countCard('Male', _counts.male, AppColors.maleFg, Icons.male_rounded),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _countCard('Female', _counts.female, AppColors.femaleFg, Icons.female_rounded),
                const SizedBox(width: 10),
                _countCard('Pregnant', _counts.pregnant, AppColors.pregFg, Icons.child_care_rounded),
              ],
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Recent Scans',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                TextButton(
                  onPressed: () => widget.onNavigate('history'),
                  child: const Text('View all'),
                ),
              ],
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_recent.isEmpty)
              _buildEmpty()
            else
              ..._recent.map(_recentTile),
          ],
        ),
      ),
    );
  }

  Widget _countCard(String label, int value, Color color, IconData icon) {
    return Expanded(
      child: Container(
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: color),
                const Spacer(),
                Text(
                  value.toString(),
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF111827),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(Icons.inbox_rounded, size: 40, color: Colors.grey.shade300),
          const SizedBox(height: 10),
          Text(
            'No scans yet. Tap Scan to classify your first snail!',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey.shade500, height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _recentTile(SnailRecord record) {
    final isMale = record.gender == SnailGender.male;
    final badgeColor = isMale ? AppColors.maleBg : AppColors.femaleBg;
    final iconColor = isMale ? AppColors.maleFg : AppColors.femaleFg;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
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
      child: ListTile(
        onTap: () => widget.onNavigate('detail:${record.id}'),
        leading: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: record.photoBase64.isEmpty
              ? Container(
                  width: 48,
                  height: 48,
                  color: Colors.grey.shade200,
                  child: const Icon(Icons.image_rounded, color: Colors.grey),
                )
              : Image.memory(
                  base64Decode(record.photoBase64),
                  width: 48,
                  height: 48,
                  fit: BoxFit.cover,
                ),
        ),
        title: Text(
          '${record.gender.label} · ${record.pregnantStatus.label}',
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        subtitle: Text(
          DateFormat('MMM d, yyyy').format(record.createdAt),
          style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
        ),
        trailing: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: badgeColor,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(isMale ? Icons.male_rounded : Icons.female_rounded,
              size: 18, color: iconColor),
        ),
      ),
    );
  }
}
