import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RootStack } from './src/navigation/types';
import Feed from './src/screens/Feed';
import Player from './src/screens/Player';
import { colors } from './src/components/UI';
const Stack = createNativeStackNavigator<RootStack>();
export default function App() {
  return <SafeAreaProvider><StatusBar style="light" /><NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent } }}><Stack.Navigator screenOptions={{ headerTintColor: colors.text, headerShadowVisible: false, contentStyle: { backgroundColor: colors.bg } }}><Stack.Screen name="Home" component={Feed} options={{ title: '◉ PipeTube' }} /><Stack.Screen name="Search" component={Feed} /><Stack.Screen name="Player" component={Player} options={{ title: 'Now playing' }} /></Stack.Navigator></NavigationContainer></SafeAreaProvider>;
}
