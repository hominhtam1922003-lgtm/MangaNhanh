package com.personal.trungvietdub.pipeline

/** Số luồng suy luận theo số nhân CPU thực tế (tối thiểu 2, tối đa 6 để không quá tải pin/nhiệt). */
object Threads {
    val inference: Int by lazy { Runtime.getRuntime().availableProcessors().coerceIn(2, 6) }
}
