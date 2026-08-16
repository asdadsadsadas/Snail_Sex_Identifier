import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:snail_sexing_app/main.dart';

void main() {
  testWidgets('shows onboarding first, then home after completing it',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const SnailSexingApp());
    await tester.pumpAndSettle();

    // Onboarding slide 1 is visible.
    expect(find.text('Welcome to Snail Sexing AI'), findsOneWidget);
    expect(find.text('Next'), findsOneWidget);

    // Advance through the 3 slides.
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('How It Works'), findsOneWidget);
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('Camera Access Needed'), findsOneWidget);
    await tester.tap(find.text('Get Started'));
    await tester.pumpAndSettle();

    // Now on the Home dashboard.
    expect(find.text('Snail Dashboard'), findsOneWidget);
    expect(find.text('Recent Logs'), findsOneWidget);
    expect(find.text('Total'), findsOneWidget);
    expect(find.text('Male'), findsOneWidget);
    expect(find.text('Female'), findsOneWidget);
    expect(find.text('Pregnant'), findsOneWidget);
  });

  testWidgets('skips onboarding when already completed', (tester) async {
    SharedPreferences.setMockInitialValues({'snail_sexing_onboarding_done': true});
    await tester.pumpWidget(const SnailSexingApp());
    await tester.pumpAndSettle();

    // Straight to Home — no onboarding.
    expect(find.text('Snail Dashboard'), findsOneWidget);
    expect(find.text('Welcome to Snail Sexing AI'), findsNothing);
    expect(find.text('Next'), findsNothing);
  });

  testWidgets('bottom nav switches between the four tabs', (tester) async {
    SharedPreferences.setMockInitialValues({'snail_sexing_onboarding_done': true});
    await tester.pumpWidget(const SnailSexingApp());
    await tester.pumpAndSettle();

    // Scan tab (nav labels are uppercase, matching the web app).
    await tester.tap(find.text('SCAN'));
    await tester.pumpAndSettle();
    expect(find.text('Scan Snail'), findsOneWidget);

    // History tab.
    await tester.tap(find.text('HISTORY'));
    await tester.pumpAndSettle();
    expect(find.text('History'), findsOneWidget);
    expect(find.text('Search by date or notes...'), findsOneWidget);

    // Stats tab (empty state — no records in the test).
    await tester.tap(find.text('STATS'));
    await tester.pumpAndSettle();
    expect(find.text('Statistics'), findsOneWidget);
    expect(find.text('No data yet. Start scanning snails!'), findsOneWidget);

    // Back to Home.
    await tester.tap(find.text('HOME'));
    await tester.pumpAndSettle();
    expect(find.text('Recent Logs'), findsOneWidget);
  });
}
