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
    expect(find.text('Snail Sexing AI'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);

    // Advance through the 3 slides.
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Get Started'));
    await tester.pumpAndSettle();

    // Now on the Home dashboard.
    expect(find.text('Recent Scans'), findsOneWidget);
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
    expect(find.text('Recent Scans'), findsOneWidget);
    expect(find.text('Continue'), findsNothing);
    expect(find.text('Get Started'), findsNothing);
  });

  testWidgets('bottom nav switches between the four tabs', (tester) async {
    SharedPreferences.setMockInitialValues({'snail_sexing_onboarding_done': true});
    await tester.pumpWidget(const SnailSexingApp());
    await tester.pumpAndSettle();

    // Scan tab.
    await tester.tap(find.text('Scan'));
    await tester.pumpAndSettle();
    expect(find.text('Scan Snail'), findsOneWidget);

    // History tab.
    await tester.tap(find.text('History'));
    await tester.pumpAndSettle();
    expect(find.text('Search by date (YYYY-MM-DD)'), findsOneWidget);

    // Stats tab.
    await tester.tap(find.text('Stats'));
    await tester.pumpAndSettle();
    expect(find.text('Male / Female Ratio'), findsOneWidget);

    // Back to Home.
    await tester.tap(find.text('Home'));
    await tester.pumpAndSettle();
    expect(find.text('Recent Scans'), findsOneWidget);
  });
}
