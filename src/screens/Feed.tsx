import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStack } from '../navigation/types';
import { search, trending, VideoItem } from '../api/piped';
import { colors, Message, styles, VideoList } from '../components/UI';
export default function Feed({ navigation, route }: NativeStackScreenProps<RootStack, 'Home' | 'Search'>) {
  const searching = route.name === 'Search';
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [items, setItems] = useState<VideoItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (searching && !query) return;
    const controller = new AbortController();
    setBusy(true); setError('');
    (searching ? search(query, controller.signal) : trending(controller.signal))
      .then(data => { if (!controller.signal.aborted) setItems(data); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load videos.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [searching, query, attempt]);
  const retry = () => setAttempt(a => a + 1);
  return <View style={styles.screen}><View style={{ padding: 20, gap: 12 }}>
    <Text style={styles.heading}>{searching ? 'Find your next watch' : 'Your daily discovery'}</Text>
    <Text style={styles.muted}>{searching ? 'Search videos, not distractions.' : 'Trending now. No ads. Just great videos.'}</Text>
    {searching ? <TextInput accessibilityLabel="Search videos" placeholder="Search YouTube via Piped" placeholderTextColor={colors.muted} value={input} onChangeText={setInput} onSubmitEditing={() => { if (input.trim()) { setQuery(input.trim()); retry(); } }} returnKeyType="search" autoFocus style={{ color: colors.text, backgroundColor: colors.panel, padding: 16, borderRadius: 12 }} /> : <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Search')} style={styles.button}><Text style={styles.buttonText}>Search videos →</Text></Pressable>}
  </View>{busy ? <Message text="Loading videos…" busy /> : error ? <Message text={error} retry={retry} /> : searching && !query ? <Message text="Type a search and press Search to begin." /> : <VideoList items={items} open={id => navigation.navigate('Player', { id })} refreshing={busy} refresh={retry} />}</View>;
}
