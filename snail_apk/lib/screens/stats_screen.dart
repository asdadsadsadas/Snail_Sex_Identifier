import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../services/storage_service.dart';
import '../theme.dart';

class StatsScreen extends StatefulWidget {
  const StatsScreen({super.key, required this.storage});

  final StorageService storage;

  @override
  State<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends State<StatsScreen> {
  List<SnailRecord> _logs = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final logs = await widget.storage.getAll();
    if (!mounted) return;
    setState(() {
      _logs = logs;
      _loading = false;
    });
  }

  int get _maleCount =>
      _logs.where((l) => l.gender == SnailGender.male).length;
  int get _femaleCount =>
      _logs.where((l) => l.gender == SnailGender.female).length;
  int get _pregnantCount =>
      _logs.where((l) => l.pregnantStatus == PregnantStatus.pregnant).length;

  /// Last 6 months of pregnancy trends, newest last (web: grouped by YYYY-MM).
  List<({String label, int pregnant, int total})> get _trends {
    final map = <String, ({int pregnant, int total})>{};
    for (final log in _logs) {
      final month = log.createdAt.year * 100 + log.createdAt.month; // YYYYMM
      final entry = map.putIfAbsent(month.toString(), () => (pregnant: 0, total: 0));
      final isPreg = log.pregnantStatus == PregnantStatus.pregnant;
      map[month.toString()] = (
        pregnant: entry.pregnant + (isPreg ? 1 : 0),
        total: entry.total + 1,
      );
    }
    final keys = map.keys.toList()..sort();
    final last = keys.length > 6 ? keys.sublist(keys.length - 6) : keys;
    return last.map((k) {
      final e = map[k]!;
      return (
        label: DateFormat('MMM yy').format(DateTime(int.parse(k) ~/ 100, int.parse(k) % 100)),
        pregnant: e.pregnant,
        total: e.total,
      );
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.teal))
            : RefreshIndicator(
                onRefresh: _refresh,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
                  children: [
                    // Header
                    const Row(
                      children: [
                        Icon(Icons.bar_chart_rounded,
                            size: 24, color: AppColors.teal),
                        SizedBox(width: 8),
                        Text('Statistics', style: AppText.h1),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_logs.length} total record${_logs.length != 1 ? 's' : ''}',
                      style: AppText.subtitle,
                    ),
                    const SizedBox(height: 20),
                    if (_logs.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 80),
                        child: Center(
                          child: Column(
                            children: [
                              Icon(Icons.trending_up_rounded,
                                  size: 48, color: AppColors.gray200),
                              SizedBox(height: 12),
                              Text('No data yet. Start scanning snails!',
                                  style: AppText.muted),
                            ],
                          ),
                        ),
                      )
                    else ...[
                      // Sex ratio donut
                      _chartCard(
                        icon: Icons.pie_chart_rounded,
                        title: 'Sex Ratio',
                        child: Column(
                          children: [
                            SizedBox(
                              height: 220,
                              child: PieChart(
                                PieChartData(
                                  sectionsSpace: 3,
                                  centerSpaceRadius: 55,
                                  startDegreeOffset: -90,
                                  sections: [
                                    PieChartSectionData(
                                      value: _maleCount.toDouble(),
                                      color: AppColors.pieMale,
                                      radius: 85,
                                      showTitle: false,
                                    ),
                                    PieChartSectionData(
                                      value: _femaleCount.toDouble(),
                                      color: AppColors.pieFemale,
                                      radius: 85,
                                      showTitle: false,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.male_rounded,
                                    size: 16, color: AppColors.pieMale),
                                const SizedBox(width: 6),
                                Text.rich(TextSpan(
                                  text: 'Male: ',
                                  style: const TextStyle(
                                      fontSize: 14, color: AppColors.gray600),
                                  children: [
                                    TextSpan(
                                      text: '$_maleCount',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.gray900),
                                    ),
                                  ],
                                )),
                                const SizedBox(width: 24),
                                const Icon(Icons.female_rounded,
                                    size: 16, color: AppColors.pieFemale),
                                const SizedBox(width: 6),
                                Text.rich(TextSpan(
                                  text: 'Female: ',
                                  style: const TextStyle(
                                      fontSize: 14, color: AppColors.gray600),
                                  children: [
                                    TextSpan(
                                      text: '$_femaleCount',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.gray900),
                                    ),
                                  ],
                                )),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Pregnancy trends
                      _chartCard(
                        icon: Icons.child_care_rounded,
                        title: 'Pregnancy Trends',
                        child: _trends.isEmpty
                            ? const Padding(
                                padding: EdgeInsets.symmetric(vertical: 40),
                                child: Center(
                                  child: Text('Insufficient data for trends',
                                      style: AppText.muted),
                                ),
                              )
                            : SizedBox(
                                height: 220,
                                child: BarChart(
                                  BarChartData(
                                    maxY: _trendsMax.ceilToDouble(),
                                    barTouchData: BarTouchData(enabled: false),
                                    titlesData: FlTitlesData(
                                      leftTitles: AxisTitles(
                                        sideTitles: SideTitles(
                                          showTitles: true,
                                          reservedSize: 32,
                                          getTitlesWidget: _yLabel,
                                        ),
                                      ),
                                      rightTitles: const AxisTitles(
                                          sideTitles: SideTitles(showTitles: false)),
                                      topTitles: const AxisTitles(
                                          sideTitles: SideTitles(showTitles: false)),
                                      bottomTitles: AxisTitles(
                                        sideTitles: SideTitles(
                                          showTitles: true,
                                          reservedSize: 28,
                                          getTitlesWidget: (value, meta) {
                                            final i = value.toInt();
                                            if (i < 0 || i >= _trends.length) {
                                              return const SizedBox.shrink();
                                            }
                                            return Padding(
                                              padding: const EdgeInsets.only(top: 6),
                                              child: Text(
                                                _trends[i].label,
                                                style: const TextStyle(
                                                    fontSize: 11,
                                                    color: AppColors.gray400),
                                              ),
                                            );
                                          },
                                        ),
                                      ),
                                    ),
                                    gridData: FlGridData(
                                      drawVerticalLine: false,
                                      getDrawingHorizontalLine: (value) => FlLine(
                                          color: AppColors.gray100,
                                          strokeWidth: 1,
                                          dashArray: [4, 4]),
                                    ),
                                    borderData: FlBorderData(show: false),
                                    barGroups: [
                                      for (var i = 0; i < _trends.length; i++)
                                        BarChartGroupData(
                                          x: i,
                                          barsSpace: 8,
                                          barRods: [
                                            BarChartRodData(
                                              toY: _trends[i].total.toDouble(),
                                              width: 22,
                                              borderRadius:
                                                  const BorderRadius.vertical(
                                                      top: Radius.circular(4)),
                                              rodStackItems: [
                                                BarChartRodStackItem(
                                                    0, _trends[i].pregnant.toDouble(), AppColors.pregBar),
                                                BarChartRodStackItem(
                                                    _trends[i].pregnant.toDouble(),
                                                    _trends[i].total.toDouble(),
                                                    AppColors.pregBg),
                                              ],
                                            ),
                                          ],
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                      ),
                      const SizedBox(height: 16),
                      // Summary cards
                      Row(
                        children: [
                          Expanded(child: _summaryCard('Male', _maleCount,
                              Icons.male_rounded, AppColors.maleBg, AppColors.maleFg)),
                          const SizedBox(width: 12),
                          Expanded(child: _summaryCard('Female', _femaleCount,
                              Icons.female_rounded, AppColors.femaleBg, AppColors.femaleFg)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(child: _summaryCard('Pregnant', _pregnantCount,
                              Icons.child_care_rounded, AppColors.pregBg, AppColors.pregFg)),
                          const SizedBox(width: 12),
                          Expanded(child: _summaryCard('Total', _logs.length,
                              Icons.filter_vintage_rounded, AppColors.mint, AppColors.teal)),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
      ),
    );
  }

  double get _trendsMax {
    var m = 0;
    for (final t in _trends) {
      if (t.total > m) m = t.total;
    }
    return m == 0 ? 1 : m * 1.2;
  }

  static Widget _yLabel(double value, TitleMeta meta) {
    if (value == meta.max) return const SizedBox.shrink();
    return Text(
      value.toInt().toString(),
      style: const TextStyle(fontSize: 11, color: AppColors.gray400),
      textAlign: TextAlign.right,
    );
  }

  Widget _chartCard({required IconData icon, required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: appCardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: AppColors.teal),
              const SizedBox(width: 8),
              Text(title,
                  style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.gray900)),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }

  Widget _summaryCard(
      String label, int value, IconData icon, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 24, color: fg),
          const SizedBox(height: 8),
          Text(value.toString(),
              style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: AppColors.gray900)),
          Text(label,
              style: TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w500, color: fg)),
        ],
      ),
    );
  }
}
