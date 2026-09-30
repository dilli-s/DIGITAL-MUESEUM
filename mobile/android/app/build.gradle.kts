plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.vanalok.mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.vanalok.mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

val setupAdbPortForwarding = tasks.register("setupAdbPortForwarding") {
    doLast {
        val ports = listOf(5000, 5001, 5173)
        val adbPath = try {
            android.adbExecutable.absolutePath
        } catch (_: Throwable) {
            "adb"
        }

        try {
            val process = ProcessBuilder(adbPath, "devices").start()
            val output = process.inputStream.bufferedReader().readText()
            process.waitFor()

            val deviceIds = output.lines()
                .drop(1)
                .map { it.trim() }
                .filter { it.isNotEmpty() && it.contains("\tdevice") }
                .map { it.split("\t")[0].trim() }

            if (deviceIds.isEmpty()) {
                ports.forEach { port ->
                    ProcessBuilder(adbPath, "reverse", "tcp:$port", "tcp:$port")
                        .redirectErrorStream(true)
                        .start()
                        .waitFor()
                }
            } else {
                deviceIds.forEach { deviceId ->
                    ports.forEach { port ->
                        ProcessBuilder(adbPath, "-s", deviceId, "reverse", "tcp:$port", "tcp:$port")
                            .redirectErrorStream(true)
                            .start()
                            .waitFor()
                    }
                    println("[ADB] Configured adb reverse port forwarding for device $deviceId (ports: $ports)")
                }
            }
        } catch (_: Throwable) {
            // Ignore failure if adb is not found or device is disconnected
        }
    }
}

tasks.matching {
    it.name.startsWith("assemble") ||
    it.name.startsWith("compile") ||
    it.name.startsWith("install") ||
    it.name == "preBuild"
}.configureEach {
    dependsOn(setupAdbPortForwarding)
}

