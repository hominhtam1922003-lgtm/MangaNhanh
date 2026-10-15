import React from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { VideoItem, videoId } from '../api/piped';
export const colors = { bg: '#0c0e12', panel: '#191d25', text: '#f4f5f8', muted: '#9da7ba', accent: '#a7f36b' };
export function Message({ text, retry, busy = false }: { text: string; retry?: () => void; busy?: boolean }) {
  return <View style={styles.message}>{busy && <ActivityIndicator color={colors.accent} />}<Text style={styles.muted}>{text}</Text>{retry && <Pressable accessibilityRole="button" onPress={retry} style={styles.button}><Text style={styles.buttonText}>Try again</Text></Pressable>}</View>;
}
export function VideoList({ items, open, refreshing, refresh }: { items: VideoItem[]; open: (id: string) => void; refreshing?: boolean; refresh?: () => void }) {
  return <FlatList data={items} keyExtractor={(item, i) => `${item.url}-${i}`} refreshing={refreshing} onRefresh={refresh} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} ListEmptyComponent={<Message text="No videos found." />} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Play ${item.title}`} style={styles.card} onPress={() => { const id = videoId(item.url); if (id) open(id); }}><View><Image source={{ uri: item.thumbnail }} style={styles.thumbnail} /><Text style={styles.duration}>{item.duration > 0 ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}` : 'LIVE'}</Text></View><Text numberOfLines={2} style={styles.title}>{item.title}</Text><Text style={styles.muted}>{item.uploaderName} · {Intl.NumberFormat('en', { notation: 'compact' }).format(item.views || 0)} views</Text></Pressable>} />;
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  heading: { color: colors.text, fontSize: 30, fontWeight: '800', marginBottom: 6 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  title: { color: colors.text, fontSize: 17, fontWeight: '600', marginTop: 12, marginBottom: 5 },
  card: { marginBottom: 26 }, thumbnail: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.panel, borderRadius: 14 },
  duration: { position: 'absolute', bottom: 8, right: 8, backgroundColor: '#000c', color: '#fff', padding: 4, borderRadius: 4, fontSize: 12 },
  message: { padding: 32, alignItems: 'center', gap: 16 },
  button: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: colors.accent, borderRadius: 12 },
  buttonText: { color: '#142009', fontWeight: '700' },
});
