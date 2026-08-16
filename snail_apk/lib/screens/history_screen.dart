import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../services/storage_service.dart';
import '../theme.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key, required this.storage, required this.onNavigate});

  final StorageService storage;
  final void Function(String screen) onNavigate;

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

enum _Filter { all, male, female, pregnant }

class _HistoryScreenState extends State<HistoryScreen> {
  List<SnailRecord> _all = [];
  bool _loading = true;
  String _query = '';
  _Filter _filter = _Filter.all;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final all = await widget.storage.getAll();
    if (!mounted) return;
    setState(() {
      _all = all;
      _loading = false;
    });
  }

  List<SnailRecord> get _filtered {
    final q = _query.trim().toLowerCase();
    return _all.where((r) {
      if (q.isNotEmpty && !r.date.contains(q)) return false;
      switch (_filter) {
        case _Filter.all:
          return true;
        case _Filter.male:
          return r.gender == SnailGender.male;
        case _Filter.female:
          return r.gender == SnailGender.female;
        case _Filter.pregnant:
          return r.pregnantStatus == PregnantStatus.pregnant;
      }
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('History', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(tooltip: 'Refresh', onPressed: _loading ? null : _refresh, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: TextField(
              onChanged: (v) => setState(() => _query = v),
              decoration: InputDecoration(
                hintText: 'Search by date (YYYY-MM-DD)',
                prefixIcon: const Icon(Icons.search_rounded),
                filled: true,
                fillColor: Colors.white,
                isDense: true,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _chip(_Filter.all, 'All'),
                _chip(_Filter.male, 'Male'),
                _chip(_Filter.female, 'Female'),
                _chip(_Filter.pregnant, 'Pregnant'),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _filtered.isEmpty
                    ? _buildEmpty()
                    : RefreshIndicator(
                        onRefresh: _refresh,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _filtered.length,
                          itemBuilder: (context, i) => _tile(_filtered[i]),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _chip(_Filter f, String label) {
    final active = _filter == f;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: active,
        onSelected: (_) => setState(() => _filter = f),
        selectedColor: AppColors.teal,
        labelStyle: TextStyle(
          color: active ? Colors.white : Colors.grey.shade700,
          fontWeight: active ? FontWeight.w600 : FontWeight.normal,
        ),
        backgroundColor: Colors.white,
        side: BorderSide(color: active ? AppColors.teal : Colors.grey.shade300),
        showCheckmark: false,
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search_off_rounded, size: 48, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text(
            'No records match',
            style: TextStyle(color: Colors.grey.shade500, fontSize: 15),
          ),
        ],
      ),
    );
  }

  Widget _tile(SnailRecord record) {
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
          '${DateFormat('MMM d, yyyy').format(record.createdAt)} · ${record.confidence.toStringAsFixed(1)}% conf.',
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
