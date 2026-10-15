import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS, ResizeMode, Video } from 'expo-av';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStack } from '../navigation/types';
import { details, playbackSource, VideoDetails } from '../api/piped';
import { Message, styles } from '../components/UI';
export default function Player({ route }: NativeStackScreenProps<RootStack, 'Player'>) {
  const player = useRef<Video>(null);
  const [data, setData] = useState<VideoDetails>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [audioOnly, setAudioOnly] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(''); setData(undefined);
    (async () => {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false, playsInSilentModeIOS: true,
        staysActiveInBackground: true, shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      });
      const result = await details(route.params.id, controller.signal);
      if (!controller.signal.aborted) setData(result);
    })().catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Playback failed.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => { controller.abort(); void player.current?.unloadAsync().catch(() => {}); };
  }, [route.params.id, attempt]);
  const source = data && playbackSource(data, audioOnly);
  return <ScrollView style={styles.screen}>
    {busy ? <Message text="Finding your stream…" busy /> : error ? <Message text={error} retry={() => setAttempt(a => a + 1)} /> : data && <>
      {source ? <Video key={`${source}-${attempt}`} ref={player} source={{ uri: source }} style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }} useNativeControls shouldPlay resizeMode={ResizeMode.CONTAIN} onError={message => setError(`Unable to play this stream: ${message}`)} /> : <Message text="No compatible stream available. Try audio-only mode or another video." />}
      <View style={{ padding: 20, gap: 16 }}><Text style={styles.heading}>{data.title}</Text><Text style={styles.muted}>{data.uploader}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setAudioOnly(value => !value)}><Text style={styles.buttonText}>{audioOnly ? 'Switch to video' : 'Listen audio-only'}</Text></Pressable>
        <Text style={styles.muted}>Keep listening with your screen locked. Leaving this screen stops playback. Switching modes restarts the stream.</Text>
        <Text style={styles.muted}>{data.description?.replace(/<[^>]*>/g, '')}</Text>
      </View></>}
  </ScrollView>;
}
