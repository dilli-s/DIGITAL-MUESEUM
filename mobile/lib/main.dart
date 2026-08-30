import 'package:flutter/material.dart';

import 'screens/physical_museum_screen.dart';

void main() {
  print('MAIN: Calling runApp');
  runApp(const MyApp());
  print('MAIN: runApp called');
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Vanalok Museum',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blueGrey,),
        useMaterial3: true,
         // Assumed font
      ),
      home: const PhysicalMuseumScreen(),
    );
  }
}
