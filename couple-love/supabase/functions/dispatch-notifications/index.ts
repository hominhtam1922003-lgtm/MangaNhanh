import { createClient } from "npm:@supabase/supabase-js@2.57.4";

Deno.serve(async (request) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (
    request.method !== "POST" ||
    !secret ||
    request.headers.get("Authorization") !== `Bearer ${secret}`
  )
    return new Response("Không được phép.", { status: 401 });

  const url = Deno.env.get("SUPABASE_URL"),
    key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    return new Response("Thiếu cấu hình máy chủ.", { status: 503 });

  const db = createClient(url, key, { auth: { persistSession: false } });

  // Hỗ trợ Database Webhook: khi có bản ghi mới chèn vào bảng `calls` hoặc
  // `messages`, lập tức gửi Expo Push Notification đánh thức máy đối phương
  // (đổ chuông, rung và bật màn hình cuộc gọi đến).
  try {
    const cloned = request.clone();
    const payload = await cloned.json().catch(() => null);
    if (
      payload &&
      payload.type === "INSERT" &&
      (payload.table === "calls" || payload.table === "messages") &&
      payload.record
    ) {
      const record = payload.record;
      const isCall = payload.table === "calls";
      const recipientId = String(
        (isCall ? record.callee_id : record.recipient_id) ?? "",
      ).trim();
      if (!recipientId) {
        return Response.json({ ok: false, reason: "missing_recipient" });
      }
      const { data: profile } = await db
        .from("profiles")
        .select("expo_push_token")
        .eq("id", recipientId)
        .maybeSingle();
      const { data: tokenRows } = await db
        .from("push_tokens")
        .select("token")
        .eq("user_id", recipientId);
      const tokenSet = new Set<string>();
      if (profile?.expo_push_token)
        tokenSet.add(String(profile.expo_push_token));
      for (const row of tokenRows ?? []) {
        if (row?.token) tokenSet.add(String(row.token));
      }
      const validTokens = Array.from(tokenSet).filter((t) =>
        /^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/.test(t),
      );
      if (!validTokens.length) {
        return Response.json({ ok: true, sent: 0 });
      }
      const senderName = String(
        (isCall ? record.caller_name : record.sender_name) || "Người thương",
      );
      const isVideo = Boolean(record.is_video);
      const title = isCall
        ? `${senderName} đang gọi ${isVideo ? "Video " : ""}cho bạn 📞`
        : `${senderName} 💌`;
      const body = isCall
        ? "Chạm để mở màn hình cuộc gọi và nghe máy ngay"
        : String(record.body || "Bạn có một tin nhắn yêu thương mới.");
      const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(Deno.env.get("EXPO_ACCESS_TOKEN")
            ? { Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}` }
            : {}),
        },
        body: JSON.stringify(
          validTokens.map((to) => ({
            to,
            title,
            body,
            sound: "default",
            priority: "high",
            channelId: isCall ? "cuoc-goi-den-khan-v2" : "love-messages",
            data: {
              type: isCall ? "call" : "message",
              open: isCall ? "call" : "chat",
              callId: String(record.call_id ?? record.id ?? ""),
              isVideo,
              senderName,
              body,
            },
            ttl: isCall ? 60 : 86400,
          })),
        ),
        signal: AbortSignal.timeout(15000),
      });
      return Response.json({ ok: pushRes.ok, sent: validTokens.length });
    }
  } catch {}

  const generated = await db.rpc("generate_reminders");
  if (generated.error)
    return new Response("Không tạo được lời nhắc.", { status: 500 });
  const claimed = await db.rpc("claim_push_jobs");
  if (claimed.error)
    return new Response("Không đọc được hàng chờ.", { status: 500 });
  let sent = 0;
  for (const job of claimed.data ?? []) {
    try {
      const { data: alert, error } = await db
        .from("alerts")
        .select("*")
        .eq("id", job.alert_id)
        .maybeSingle();
      if (error) throw error;
      if (!alert) {
        await db.from("push_jobs").delete().eq("id", job.id);
        continue;
      }
      const membership = await db
        .from("members")
        .select("user_id")
        .eq("couple_id", alert.couple_id)
        .eq("user_id", alert.recipient_id)
        .maybeSingle();
      const currentPreference = await db
        .from("preferences")
        .select("allow_cycle_alerts,allow_mood_alerts")
        .eq("user_id", alert.recipient_id)
        .maybeSingle();
      let permitted =
        Boolean(membership.data) &&
        (alert.category !== "mood" ||
          Boolean(currentPreference.data?.allow_mood_alerts));
      if (alert.category === "cycle") {
        const cycle = await db
          .from("cycles")
          .select("owner_id,shared,reminders")
          .eq("couple_id", alert.couple_id)
          .maybeSingle();
        const pref = await db
          .from("preferences")
          .select("allow_cycle_alerts")
          .eq("user_id", alert.recipient_id)
          .maybeSingle();
        permitted =
          permitted &&
          Boolean(
            cycle.data?.reminders &&
            (cycle.data.owner_id === alert.recipient_id ||
              (cycle.data.shared && pref.data?.allow_cycle_alerts)),
          );
      }
      if (!permitted) {
        await db
          .from("push_jobs")
          .update({ status: "cancelled" })
          .eq("id", job.id);
        continue;
      }
      const tokens = await db
        .from("push_tokens")
        .select("token")
        .eq("user_id", alert.recipient_id);
      if (tokens.error) throw tokens.error;
      const values = (tokens.data ?? []).filter((t) =>
        /^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/.test(t.token),
      );
      if (!values.length) {
        await db.from("push_jobs").update({ status: "sent" }).eq("id", job.id);
        continue;
      }
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(Deno.env.get("EXPO_ACCESS_TOKEN")
            ? { Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}` }
            : {}),
        },
        body: JSON.stringify(
          values.map((t) => ({
            to: t.token,
            title: "Mật Mã Yêu",
            body: "Có một lời nhắc yêu thương mới. Mở ứng dụng để xem.",
            sound: "default",
            channelId: "love-reminders",
            data: { alertId: alert.id },
            ttl: 86400,
          })),
        ),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error("Cổng thông báo chưa sẵn sàng.");
      const tickets = (await response.json()).data;
      if (!Array.isArray(tickets) || tickets.length !== values.length)
        throw new Error("Phản hồi cổng thông báo không hợp lệ.");
      let retry = false;
      for (let i = 0; i < tickets.length; i++) {
        if (tickets[i].status === "ok") sent++;
        else if (tickets[i].details?.error === "DeviceNotRegistered")
          await db.from("push_tokens").delete().eq("token", values[i].token);
        else retry = true;
      }
      await db
        .from("push_jobs")
        .update(
          retry
            ? {
                status: "pending",
                next_try: new Date(
                  Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts),
                ).toISOString(),
              }
            : { status: "sent" },
        )
        .eq("id", job.id);
    } catch (_) {
      await db
        .from("push_jobs")
        .update({
          status: job.attempts >= 6 ? "failed" : "pending",
          next_try: new Date(
            Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts),
          ).toISOString(),
        })
        .eq("id", job.id);
    }
  }
  return Response.json({ processed: claimed.data?.length ?? 0, sent });
});
