import 'react-native-url-polyfill/auto'
import "../global.css";
import { Text, View, Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Redirect, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView, ScrollView } from "react-native-gesture-handler";
import { images } from '../constants'
import CustomButton from "./components/CustomButton";
import { useGlobalContext } from '@/context/GlobalProvider';

export default function RootLayout() {
  const { isLoading, isLoggedIn } = useGlobalContext();

  // Redirect to home if user already logged in
  if (!isLoading && isLoggedIn) return <Redirect href="/home"/>

  return (
    <GestureHandlerRootView>
    <SafeAreaView className="bg-primary h-full">
      <ScrollView contentContainerStyle={{height: '100%'}}>
        <View className="w-full justify-center items-center min-h-[85vh] px-4">
          <Image 
            source={images.logo}
            className="w-[232px] h-[43px]"
            resizeMode="contain"
          />

          <Image 
            source={images.cards}
            className="max-w-[380px] w-full h-[300px]"
            resizeMode="contain"
          />

          <View className="relative mt-5">
            <Text className="text-3xl text-white font-bold text-center">
              Discover your true voice with{' '}
              <Text className="text-secondary-200">BerKaraoke</Text>
            </Text>
          </View>
        <Text className="text-sm font-pregular text-gray-100 mt-7 text-center">
          Your dearest karaoke companion,
          now in your hands.
        </Text>
        <CustomButton 
          title="Continue with Email"
          handlePress={() => router.push('/sign-in')}
          containerStyles="w-full mt-7"
        />
        </View>
      </ScrollView>
      <StatusBar 
        backgroundColor='#161622' style='light'
      />
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}