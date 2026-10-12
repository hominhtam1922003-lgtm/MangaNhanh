# Vosk / JNA
-keep class org.vosk.** { *; }
-keep class com.sun.jna.** { *; }
-dontwarn java.awt.**

# ONNX Runtime
-keep class ai.onnxruntime.** { *; }

# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class com.personal.trungvietdub.** {
    *** Companion;
}
-keepclasseswithmembers class com.personal.trungvietdub.** {
    kotlinx.serialization.KSerializer serializer(...);
}
