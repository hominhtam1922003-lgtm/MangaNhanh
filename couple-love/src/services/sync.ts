import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
export type Profile = {
  id: string;
  nickname: string;
  avatar_path: string | null;
  mood: string;
  mood_note: string;
  updated_at: string;
};
export type Couple = { id: string; anniversary: string; timezone: string };
export type Cycle = {
  couple_id: string;
  owner_id: string;
  last_period: string;
  cycle_length: number;
  period_length: number;
  shared: boolean;
  reminders: boolean;
  updated_at: string;
};
export type Diary = {
  id: string;
  couple_id: string;
  author_id: string;
  title: string;
  body: string;
  image_path: string | null;
  created_at: string;
};
export type AlertItem = {
  id: string;
  title: string;
  body: string;
  category: string;
  read_at: string | null;
  created_at: string;
};
export type Snapshot = {
  couple: Couple | null;
  profiles: Profile[];
  cycle: Cycle | null;
  diary: Diary[];
  alerts: AlertItem[];
  prefs: { allow_cycle_alerts: boolean; allow_mood_alerts: boolean };
  online: boolean;
};
export const emptySnapshot: Snapshot = {
  couple: null,
  profiles: [],
  cycle: null,
  diary: [],
  alerts: [],
  prefs: { allow_cycle_alerts: false, allow_mood_alerts: true },
  online: false,
};
export class SyncService {
  private channels: RealtimeChannel[] = [];
  private stopped = false;
  private fetching = false;
  private again = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(
    private db: SupabaseClient,
    private uid: string,
    private onData: (snapshot: Snapshot) => void,
    private onError: (error: unknown) => void,
  ) {}
  async load() {
    if (this.stopped) return;
    if (this.fetching) {
      this.again = true;
      return;
    }
    this.fetching = true;
    try {
      const membership = await this.db
        .from("members")
        .select("couple_id")
        .eq("user_id", this.uid)
        .maybeSingle();
      if (membership.error) throw membership.error;
      const id = membership.data?.couple_id;
      const [profiles, couple, cycle, diary, alerts, prefs] = await Promise.all(
        [
          this.db.from("profiles").select("*"),
          id
            ? this.db.from("couples").select("*").eq("id", id).single()
            : Promise.resolve({ data: null, error: null }),
          id
            ? this.db
                .from("cycles")
                .select("*")
                .eq("couple_id", id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          id
            ? this.db
                .from("diary")
                .select("*")
                .eq("couple_id", id)
                .order("created_at", { ascending: false })
                .limit(100)
            : Promise.resolve({ data: [], error: null }),
          this.db
            .from("alerts")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(60),
          this.db
            .from("preferences")
            .select("*")
            .eq("user_id", this.uid)
            .single(),
        ],
      );
      for (const result of [profiles, couple, cycle, diary, alerts, prefs])
        if (result.error) throw result.error;
      if (!this.stopped)
        this.onData({
          profiles: profiles.data || [],
          couple: couple.data,
          cycle: cycle.data,
          diary: diary.data || [],
          alerts: alerts.data || [],
          prefs: prefs.data,
          online: true,
        });
    } catch (error) {
      if (!this.stopped) this.onError(error);
    } finally {
      this.fetching = false;
      if (this.again) {
        this.again = false;
        void this.load();
      }
    }
  }
  start() {
    const channel = this.db.channel("love-" + this.uid);
    for (const table of [
      "profiles",
      "members",
      "couples",
      "cycles",
      "diary",
      "alerts",
      "preferences",
    ])
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => void this.load(),
      );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") void this.load();
      if (
        ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) &&
        !this.stopped
      )
        this.onError(new Error("Mất kết nối đồng bộ. Đang thử nối lại."));
    });
    this.channels.push(channel);
    void this.load();
    this.timer = setInterval(() => void this.load(), 30000);
  }
  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    for (const channel of this.channels) void this.db.removeChannel(channel);
    this.channels = [];
  }
}
