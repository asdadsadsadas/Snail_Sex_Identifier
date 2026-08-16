import 'package:flutter/material.dart';

import '../models.dart';
import '../services/storage_service.dart';
import '../theme.dart';
import '../widgets/record_tile.dart';

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
    final statCards = [
      _StatSpec('Total', _counts.total, Icons.filter_vintage_rounded, AppColors.mint, AppColors.teal),
      _StatSpec('Male', _counts.male, Icons.male_rounded, AppColors.maleBg, AppColors.maleFg),
      _StatSpec('Female', _counts.female, Icons.female_rounded, AppColors.femaleBg, AppColors.femaleFg),
      _StatSpec('Pregnant', _counts.pregnant, Icons.child_care_rounded, AppColors.pregBg, AppColors.pregFg),
    ];

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
            children: [
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 80),
                  child: Center(child: CircularProgressIndicator(color: AppColors.teal)),
                )
              else ...[
                // Header
                Row(
                  children: [
                    const Icon(Icons.filter_vintage_rounded, size: 24, color: AppColors.teal),
                    const SizedBox(width: 8),
                    const Text('Snail Dashboard', style: AppText.h1),
                  ],
                ),
                const SizedBox(height: 4),
                Text('Live classification overview', style: AppText.subtitle),
                const SizedBox(height: 20),
                // Stats grid (2x2 colored cards)
                Row(
                  children: [
                    Expanded(child: _statCard(statCards[0])),
                    const SizedBox(width: 12),
                    Expanded(child: _statCard(statCards[1])),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _statCard(statCards[2])),
                    const SizedBox(width: 12),
                    Expanded(child: _statCard(statCards[3])),
                  ],
                ),
                const SizedBox(height: 24),
                // Recent logs header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Recent Logs', style: AppText.h2),
                    InkWell(
                      onTap: () => widget.onNavigate('history'),
                      borderRadius: BorderRadius.circular(8),
                      child: const Padding(
                        padding: EdgeInsets.all(4),
                        child: Row(
                          children: [
                            Text('View All',
                                style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                    color: AppColors.teal)),
                            SizedBox(width: 4),
                            Icon(Icons.arrow_forward_rounded,
                                size: 16, color: AppColors.teal),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (_recent.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 28),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(Icons.auto_awesome_rounded,
                              size: 32, color: AppColors.gray300),
                          SizedBox(height: 8),
                          Text('No records yet. Start scanning!',
                              style: AppText.muted),
                        ],
                      ),
                    ),
                  )
                else
                  ..._recent.map(
                    (r) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: RecordTile(
                        record: r,
                        onTap: () => widget.onNavigate('detail:${r.id}'),
                      ),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _statCard(_StatSpec spec) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: spec.bg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(spec.icon, size: 32, color: spec.fg),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(spec.value.toString(),
                  style: const TextStyle(
                      fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.gray900)),
              Text(spec.label,
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: spec.fg)),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatSpec {
  const _StatSpec(this.label, this.value, this.icon, this.bg, this.fg);

  final String label;
  final int value;
  final IconData icon;
  final Color bg;
  final Color fg;
}
