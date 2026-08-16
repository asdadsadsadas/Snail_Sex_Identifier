import 'package:flutter/material.dart';

/// App palette — matches the web version's Tailwind colors exactly.
class AppColors {
  AppColors._();

  static const Color teal = Color(0xFF03615F); // primary
  static const Color tealDark = Color(0xFF2D7A78); // hover/alt
  static const Color mint = Color(0xFFC0FFFC);
  static const Color background = Color(0xFFF8F9FA);
  static const Color darkBg = Color(0xFF0D1F1E);

  // Text grays (Tailwind gray-900/700/500/400/300)
  static const Color gray900 = Color(0xFF111827);
  static const Color gray700 = Color(0xFF374151);
  static const Color gray600 = Color(0xFF4B5563);
  static const Color gray500 = Color(0xFF6B7280);
  static const Color gray400 = Color(0xFF9CA3AF);
  static const Color gray300 = Color(0xFFD1D5DB);
  static const Color gray200 = Color(0xFFE5E7EB);
  static const Color gray100 = Color(0xFFF3F4F6);

  // Male badge / card
  static const Color maleBg = Color(0xFFBEEDD1);
  static const Color maleFg = Color(0xFF3F6653);
  // Female badge / card
  static const Color femaleBg = Color(0xFFFFDAD6);
  static const Color femaleFg = Color(0xFFBA1A1A);
  // Pregnant badge / card
  static const Color pregBg = Color(0xFFC1ECD4);
  static const Color pregFg = Color(0xFF274E3D);
  // Stats chart colors (recharts palette)
  static const Color pieMale = Color(0xFF2D7A78);
  static const Color pieFemale = Color(0xFFD48888);
  static const Color pregBar = Color(0xFF527766);
}

/// Shared text styles matching the web (Tailwind) typography scale.
class AppText {
  AppText._();

  static const TextStyle h1 = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.bold,
    color: AppColors.gray900,
  );
  static const TextStyle h2 = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.bold,
    color: AppColors.gray900,
  );
  static const TextStyle subtitle = TextStyle(
    fontSize: 14,
    color: AppColors.gray500,
  );
  static const TextStyle bodySm = TextStyle(fontSize: 13, color: AppColors.gray700);
  static const TextStyle muted = TextStyle(fontSize: 12, color: AppColors.gray400);
}

/// White card with the web's `rounded-2xl border border-gray-100` look.
BoxDecoration appCardDecoration({double radius = 16}) {
  return BoxDecoration(
    color: Colors.white,
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(color: AppColors.gray100),
  );
}

/// Standard teal filled button (web: `rounded-2xl bg-[#03615f] font-semibold`).
ButtonStyle tealButtonStyle({double radius = 16}) {
  return FilledButton.styleFrom(
    backgroundColor: AppColors.teal,
    foregroundColor: Colors.white,
    textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
    padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius)),
  );
}

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.teal,
      primary: AppColors.teal,
    ),
    scaffoldBackgroundColor: AppColors.background,
  );
  return base.copyWith(
    splashFactory: InkSparkle.splashFactory,
    textTheme: base.textTheme.apply(
      bodyColor: AppColors.gray900,
      displayColor: AppColors.gray900,
    ),
  );
}
