import 'package:flutter/material.dart';

import '../models.dart';
import '../services/storage_service.dart';
import '../theme.dart';
import '../widgets/record_tile.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key, required this.storage, required this.onNavigate});

  final StorageService storage;
  final void Function(String screen) onNavigate;

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<SnailRecord> _all = [];
  bool _loading = true;
  String _search = '';
  String _filterGender = '';
  String _filterPregnancy = '';

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

  bool get _hasFilters =>
      _search.isNotEmpty || _filterGender.isNotEmpty || _filterPregnancy.isNotEmpty;

  List<SnailRecord> get _filtered {
    final q = _search.trim().toLowerCase();
    return _all.where((r) {
      final matchSearch = q.isEmpty ||
          r.date.contains(q) ||
          r.morphologicalNotes.toLowerCase().contains(q);
      final matchGender = _filterGender.isEmpty || r.gender.label == _filterGender;
      final matchPregnancy =
          _filterPregnancy.isEmpty || r.pregnantStatus.label == _filterPregnancy;
      return matchSearch && matchGender && matchPregnancy;
    }).toList();
  }

  void _clearFilters() {
    setState(() {
      _search = '';
      _filterGender = '';
      _filterPregnancy = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.history_rounded,
                          size: 24, color: AppColors.teal),
                      SizedBox(width: 8),
                      Text('History', style: AppText.h1),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _loading
                        ? 'Loading…'
                        : '${_all.length} record${_all.length != 1 ? 's' : ''} in total',
                    style: AppText.subtitle,
                  ),
                ],
              ),
            ),
            // Search bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: TextField(
                onChanged: (v) => setState(() => _search = v),
                decoration: InputDecoration(
                  hintText: 'Search by date or notes...',
                  hintStyle: const TextStyle(color: AppColors.gray400, fontSize: 14),
                  prefixIcon: const Icon(Icons.search_rounded,
                      size: 18, color: AppColors.gray400),
                  filled: true,
                  fillColor: Colors.white,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.gray200),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.gray200),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.tealDark, width: 1.5),
                  ),
                ),
              ),
            ),
            // Filter chips
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 12),
              child: Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  const Icon(Icons.filter_alt_rounded,
                      size: 16, color: AppColors.gray400),
                  _chip('Male', _filterGender == 'Male', () {
                    setState(() => _filterGender = _filterGender == 'Male' ? '' : 'Male');
                  }, activeBg: AppColors.teal),
                  _chip('Female', _filterGender == 'Female', () {
                    setState(() => _filterGender = _filterGender == 'Female' ? '' : 'Female');
                  }, activeBg: AppColors.teal),
                  _chip('Pregnant', _filterPregnancy == 'Pregnant', () {
                    setState(() =>
                        _filterPregnancy = _filterPregnancy == 'Pregnant' ? '' : 'Pregnant');
                  }, activeBg: AppColors.pregBar),
                  _chip('Not Pregnant', _filterPregnancy == 'Not Pregnant', () {
                    setState(() => _filterPregnancy =
                        _filterPregnancy == 'Not Pregnant' ? '' : 'Not Pregnant');
                  }, activeBg: AppColors.pregBar),
                  if (_hasFilters)
                    InkWell(
                      onTap: _clearFilters,
                      borderRadius: BorderRadius.circular(999),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.close_rounded, size: 14, color: AppColors.gray400),
                            SizedBox(width: 4),
                            Text('Clear',
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color: AppColors.gray400)),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
            // List
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(color: AppColors.teal))
                  : _filtered.isEmpty
                      ? _buildEmpty()
                      : RefreshIndicator(
                          onRefresh: _refresh,
                          child: ListView.builder(
                            padding: const EdgeInsets.fromLTRB(24, 4, 24, 32),
                            itemCount: _filtered.length,
                            itemBuilder: (context, i) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: RecordTile(
                                record: _filtered[i],
                                photoSize: 56,
                                onTap: () =>
                                    widget.onNavigate('detail:${_filtered[i].id}'),
                              ),
                            ),
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, bool active, VoidCallback onTap, {required Color activeBg}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? activeBg : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: active ? activeBg : AppColors.gray200),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: active ? Colors.white : AppColors.gray600,
          ),
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.filter_vintage_rounded,
              size: 40, color: AppColors.gray200),
          const SizedBox(height: 12),
          Text(
            _all.isEmpty ? 'No records yet. Start scanning!' : 'No records match your filters.',
            style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: AppColors.gray400),
          ),
        ],
      ),
    );
  }
}
