import 'package:flutter/material.dart';

import '../theme.dart';

/// Custom bottom navigation matching the web app's BottomNav: white bar with a
/// top border, 40x40 icon chips (mint when active), and 10px uppercase labels.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({super.key, required this.current, required this.onSelect});

  final int current; // 0 home · 1 scan · 2 history · 3 stats
  final ValueChanged<int> onSelect;

  static const List<({IconData icon, String label})> _tabs = [
    (icon: Icons.home_rounded, label: 'Home'),
    (icon: Icons.camera_alt_rounded, label: 'Scan'),
    (icon: Icons.history_rounded, label: 'History'),
    (icon: Icons.bar_chart_rounded, label: 'Stats'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.gray200)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 10),
          child: Row(
            children: List.generate(_tabs.length, (i) {
              final tab = _tabs[i];
              final active = i == current;
              return Expanded(
                child: InkWell(
                  onTap: () => onSelect(i),
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: active ? AppColors.mint : Colors.transparent,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            tab.icon,
                            size: 22,
                            color: active ? AppColors.teal : AppColors.gray400,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          tab.label.toUpperCase(),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.8,
                            color: active ? AppColors.teal : AppColors.gray400,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
