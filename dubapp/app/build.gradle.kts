plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.personal.trungvietdub"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.personal.trungvietdub"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        vectorDrawables { useSupportLibrary = true }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }

    packaging {
        resources {
            excludes += setOf(
                "/META-INF/{AL2.0,LGPL2.1}",
                "META-INF/DEPENDENCIES",
                "META-INF/LICENSE",
                "META-INF/LICENSE.txt",
                "META-INF/NOTICE",
                "META-INF/NOTICE.txt",
                "META-INF/versions/9/OSGI-INF/MANIFEST.MF"
            )
        }
        jniLibs {
            useLegacyPackaging = false
            pickFirsts += setOf("lib/*/libonnxruntime.so")
        }
    }

    lint {
        abortOnError = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.lifecycle:lifecycle-service:2.7.0")
    implementation("androidx.lifecycle:lifecycle-process:2.7.0")

    val composeBom = platform("androidx.compose:compose-bom:2024.02.02")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")

    // sherpa-onnx (k2-fsa): ASR tiếng Trung (Paraformer), TTS tiếng Việt (VITS/Piper).
    // AAR không có trên Maven Central; workflow CI tải về app/libs/ từ GitHub Releases v1.13.8.
    implementation(files("libs/sherpa-onnx-1.13.8.aar"))
    // ONNX Runtime Java API: dùng cho UVR (tách giọng) và NLLB (dịch).
    // Lưu ý: sherpa AAR cũng đóng gói libonnxruntime.so; packaging.pickFirst bên dưới xử lý trùng tên.
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.17.3")
    implementation("org.apache.commons:commons-compress:1.26.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
}
