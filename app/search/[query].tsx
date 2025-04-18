import { View, FlatList } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { getAllTracks } from '@/lib/appwrite';
import useAppwrite from '../../lib/useAppwrite';
import TrackCard from '../components/TrackCard';
import EmptyState from '../components/EmptyState';
import MusicPlayer from '../components/MusicPlayer';
import { SafeAreaView } from 'react-native-safe-area-context';

const Search = () => {
  const { query } = useLocalSearchParams();
  const { data: tracks = [], refetch, isLoading } = useAppwrite(getAllTracks);
  const [filteredTracks, setFilteredTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);

  // Filter tracks based on search query
  useEffect(() => {
    if (!query || typeof query !== 'string') {
      setFilteredTracks(tracks);
      return;
    }

    const searchQuery = query.toLowerCase();
    const filtered = tracks.filter((track) => {
      return (
        track.songName?.toLowerCase().includes(searchQuery) ||
        track.artist?.toLowerCase().includes(searchQuery)
      );
    });
    setFilteredTracks(filtered);
  }, [query, tracks]);

  return (
    <View className="pt-8 bg-primary flex-1">
      <FlatList
        data={filteredTracks}
        keyExtractor={(item) => item.$id}
        renderItem={({ item }) => (
          <TrackCard 
            track={item} 
            onPress={() => setCurrentTrack(item)}
          />
        )}
        ListEmptyComponent={() => (
          <EmptyState
            title="No Songs Found"
            subtitle={query ? `No results for "${query}"` : "Search for songs"}
            isLoading={isLoading}
          />
        )}
        contentContainerStyle={{ flexGrow: 1 }}
      />
      
      {currentTrack && (
        <MusicPlayer 
          track={currentTrack} 
          onClose={() => setCurrentTrack(null)}
        />
      )}
    </View>
  );
};

export default Search;