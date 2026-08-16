import 'package:flutter/material.dart';

/// App palette — matches the web version's Tailwind colors.
class AppColors {
  AppColors._();

  static const Color teal = Color(0xFF03615F);
  static const Color mint = Color(0xFFC0FFFC);
  static const Color background = Color(0xFFF8F9FA);
  static const Color darkBg = Color(0xFF0D1F1E);

  // Male badge
  static const Color maleBg = Color(0xFFBEEDD1);
  static const Color maleFg = Color(0xFF3F6653);
  // Female badge
  static const Color femaleBg = Color(0xFFFFDAD6);
  static const Color femaleFg = Color(0xFFBA1A1A);
  // Pregnant badge
  static const Color pregBg = Color(0xFFC1ECD4);
  static const Color pregFg = Color(0xFF274E3D);
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
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.background,
      foregroundColor: Color(0xFF111827),
      elevation: 0,
      centerTitle: false,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: AppColors.mint.withValues(alpha: 0.45),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
    ),
  );
}
