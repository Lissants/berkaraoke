import { View, Text, FlatList, Image, RefreshControl, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { images } from '../../constants';
import SearchInput from '../components/SearchInput';
import EmptyState from '../components/EmptyState';
import { getAllTracks } from '@/lib/appwrite';
import useAppwrite from '../../lib/useAppwrite';
import TrackCard from '../components/TrackCard';
import MusicPlayer from '../components/MusicPlayer';
import { useGlobalContext } from '@/context/GlobalProvider';

const Home = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useGlobalContext();
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 25;
  const flatListRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true});
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } }}],
    {
      listener: (event) => {
        const currentOffset = event.nativeEvent.contentOffset.y;
        setShowScrollTop(currentOffset > 300); // Show button after scrolling 300px
      },
      useNativeDriver: true
    }
  );

  const loadTracks = async (reset = false) => {
    if (loading) return;

    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      const response = await getAllTracks(limit, newOffset);

      setTracks(prev => reset ? response.documents : [...prev, ...response.documents]);
      setOffset(newOffset + limit);
      setHasMore(response.documents.length === limit);
    } catch (error) {
      console.error('Error loading tracks', error);
    } finally {
      setLoading(false);
      if (refreshing) setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleEndReached = () => {
    if (!loading && hasMore) {
      loadTracks();
    }
  };

  const handleTrackPress = (track) => {
    setCurrentTrack(track);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/sign-in');
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/search/${searchQuery}`); // Navigate to the search screen
    }
  };

  useEffect(() => {
    loadTracks(true);
  }, []);

  return (
    <SafeAreaView className="bg-primary h-full">
      {/* Music Player */}
      {currentTrack && <MusicPlayer track={currentTrack} />}

      {/* Track List */}
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.$id}
        renderItem={({ item }) => (
          <TrackCard track={item} onPress={() => handleTrackPress(item)} />
        )}
        ListHeaderComponent={() => (
          <View className="my-6 px-4 space-y-6">
            <View className="justify-between items-start flex-row mb-6">
              <View>
                <Text className="font-pmedium text-sm text-gray-100">Bonjour</Text>
                <Text className="text-2xl font-psemibold text-white">
                  {user?.username || 'Guest'}
                </Text>
              </View>
              <View className="mt-1.5">
                <TouchableOpacity onPress={handleLogout}>
                  <Text className="text-secondary items-center font-psemibold">Logout</Text>
                </TouchableOpacity>
              </View>
            </View>

            <SearchInput
              value={searchQuery}
              placeholder="Search any Song Name/Artist"
              handleChangeText={(text) => setSearchQuery(text)}
              handleSearch={handleSearch}
              otherStyles="w-full"
            />
          </View>
        )}
        ListEmptyComponent={() => (
          <EmptyState
            title="No Songs Found"
            subtitle="Stay tuned for more songs!"
          />
        )}
        ListFooterComponent={() => (
          loading && !refreshing ? (
            <View className='py-8'>
              <ActivityIndicator size="large" color="#FFA001"/>
            </View>
          ) : null
        )}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.1}
        refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh} 
          tintColor="#FFA001"
         />
        }
      />

    {showScrollTop && (
      <TouchableOpacity
        onPress={scrollToTop}
        className="absolute bottom-6 right-6 bg-secondary px-4 py-2 rounded-full"
      >
        <Text className="text-white font-psemibold">Top</Text>
      </TouchableOpacity>
    )}

      <StatusBar backgroundColor="#161622" style="light" />
    </SafeAreaView>
  );
};

export default Home;