import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'screens/detail_screen.dart';
import 'screens/history_screen.dart';
import 'screens/home_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/scan_screen.dart';
import 'screens/stats_screen.dart';
import 'services/storage_service.dart';
import 'theme.dart';

const String _onboardingKey = 'snail_sexing_onboarding_done';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SnailSexingApp());
}

class SnailSexingApp extends StatefulWidget {
  const SnailSexingApp({super.key});

  @override
  State<SnailSexingApp> createState() => _SnailSexingAppState();
}

class _SnailSexingAppState extends State<SnailSexingApp> {
  final StorageService _storage = StorageService();
  bool? _onboardingDone;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((prefs) {
      if (!mounted) return;
      setState(() => _onboardingDone = prefs.getBool(_onboardingKey) == true);
    });
  }

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_onboardingKey, true);
    if (!mounted) return;
    setState(() => _onboardingDone = true);
  }

  void _navigate(String screen) {
    if (screen == 'home') {
      setState(() => _tab = 0);
    } else if (screen == 'scan') {
      setState(() => _tab = 1);
    } else if (screen == 'history') {
      setState(() => _tab = 2);
    } else if (screen == 'stats') {
      setState(() => _tab = 3);
    } else if (screen.startsWith('detail:')) {
      final id = screen.substring('detail:'.length);
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => DetailScreen(recordId: id, storage: _storage),
        ),
      ).then((changed) {
        if (changed == true && mounted) setState(() {});
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Snail Sexing AI',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: Builder(
        builder: (context) {
          final done = _onboardingDone;
          if (done == null) {
            return const Scaffold(body: SizedBox.shrink());
          }
          if (!done) {
            return OnboardingScreen(onComplete: _completeOnboarding);
          }
          return Scaffold(
            body: IndexedStack(
              index: _tab,
              children: [
                HomeScreen(storage: _storage, onNavigate: _navigate),
                ScanScreen(storage: _storage, onNavigate: _navigate),
                HistoryScreen(storage: _storage, onNavigate: _navigate),
                StatsScreen(storage: _storage),
              ],
            ),
            bottomNavigationBar: NavigationBar(
              selectedIndex: _tab,
              onDestinationSelected: (i) => setState(() => _tab = i),
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home_rounded),
                  label: 'Home',
                ),
                NavigationDestination(
                  icon: Icon(Icons.qr_code_scanner_rounded),
                  selectedIcon: Icon(Icons.qr_code_scanner_rounded),
                  label: 'Scan',
                ),
                NavigationDestination(
                  icon: Icon(Icons.history_outlined),
                  selectedIcon: Icon(Icons.history_rounded),
                  label: 'History',
                ),
                NavigationDestination(
                  icon: Icon(Icons.bar_chart_outlined),
                  selectedIcon: Icon(Icons.bar_chart_rounded),
                  label: 'Stats',
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
