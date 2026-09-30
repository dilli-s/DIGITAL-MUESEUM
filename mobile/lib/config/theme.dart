import 'package:flutter/material.dart';

class VanalokTheme {
  // Brand Antique Colors
  static const Color bgDark = Color(0xFF0E0C0A);
  static const Color surfaceDark = Color(0xFF171410);
  static const Color surfaceElevated = Color(0xFF211C16);
  
  static const Color gold = Color(0xFFC89B3C);
  static const Color goldLight = Color(0xFFDFB758);
  static const Color goldDark = Color(0xFF966F21);

  static const Color parchment = Color(0xFFF5EDE1);
  static const Color parchmentLight = Color(0xFFFAF5EC);
  static const Color parchmentBorder = Color(0xFFD8C8B0);
  static const Color ink = Color(0xFF2B2218);
  static const Color inkMuted = Color(0xFF6B5C4C);

  static const Color textLight = Color(0xFFF4EEE1);
  static const Color textMuted = Color(0xFFA89984);

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: parchmentLight,
      colorScheme: const ColorScheme(
        brightness: Brightness.light,
        primary: gold,
        onPrimary: bgDark,
        secondary: goldDark,
        onSecondary: Colors.white,
        error: Color(0xFFD9534F),
        onError: Colors.white,
        surface: parchment,
        onSurface: ink,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: parchmentLight,
        foregroundColor: ink,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: ink,
          fontSize: 20,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.2,
        ),
      ),
      cardTheme: CardThemeData(
        color: parchment,
        elevation: 1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: parchmentBorder, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: gold,
          foregroundColor: bgDark,
          elevation: 2,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(30),
          ),
          textStyle: const TextStyle(
            fontWeight: FontWeight.bold,
            letterSpacing: 1.1,
          ),
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: bgDark,
      colorScheme: const ColorScheme(
        brightness: Brightness.dark,
        primary: gold,
        onPrimary: bgDark,
        secondary: goldLight,
        onSecondary: bgDark,
        error: Color(0xFFD9534F),
        onError: Colors.white,
        surface: surfaceDark,
        onSurface: textLight,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceDark,
        foregroundColor: textLight,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: textLight,
          fontSize: 20,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.2,
        ),
      ),
      cardTheme: CardThemeData(
        color: surfaceDark,
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: Color(0xFF382E22), width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: gold,
          foregroundColor: bgDark,
          elevation: 3,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(30),
          ),
          textStyle: const TextStyle(
            fontWeight: FontWeight.bold,
            letterSpacing: 1.1,
          ),
        ),
      ),
    );
  }
}
