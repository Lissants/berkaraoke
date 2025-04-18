import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons'; // For icons

const MusicPlayer = ({ track }) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [position, setPosition] = useState(0); // Current playback position in milliseconds
  const [duration, setDuration] = useState(0); // Total duration of the audio in milliseconds

  // Load the audio track
  useEffect(() => {
    const loadAudio = async () => {
      if (track?.audio) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: track.audio },
          { shouldPlay: false } // Do not play immediately
        );
        setSound(sound);

        // Get the duration of the audio
        const status = await sound.getStatusAsync();
        setDuration(status.durationMillis || 0);

        // Update the playback position every second
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            setPosition(status.positionMillis);
            setIsPlaying(status.isPlaying);
          }
        });
      }
    };

    loadAudio();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [track]);

  // Play or pause the audio
  const handlePlayPause = async () => {
    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Adjust volume
  const handleVolumeChange = (value) => {
    if (sound) {
      sound.setVolumeAsync(value);
      setVolume(value);
    }
  };

  // Seek to a specific position in the audio
  const handleSeek = async (value) => {
    if (sound) {
      await sound.setPositionAsync(value);
      setPosition(value);
    }
  };

  // Format milliseconds into a readable time string (e.g., "1:23")
  const formatTime = (millis) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

   // Determine the speaker icon based on the volume level
   const getSpeakerIcon = () => {
    if (volume === 0) {
      return 'volume-mute'; // Muted
    } else if (volume < 0.33) {
      return 'volume-low'; // Low volume
    } else if (volume < 0.66) {
      return 'volume-medium'; // Medium volume
    } else {
      return 'volume-high'; // High volume
    }
  };

  return (
    <View className="border-2 border-black-200 bg-black-100 p-4 rounded-xl mx-4 my-2">
      <Text className="text-white text-lg font-psemibold">{track?.songName}</Text>
      <Text className="text-white text-sm font-pregular">{track?.artist}</Text>

      {/* Seek Bar */}
      <View className="mt-4">
        <Slider
          style={{ width: '100%' }}
          minimumValue={0}
          maximumValue={duration}
          value={position}
          onValueChange={handleSeek}
          minimumTrackTintColor="#FFFFFF"
          maximumTrackTintColor="#000000"
          thumbTintColor="#FFFFFF"
        />
        <View className="flex-row justify-between mt-1">
          <Text className="text-gray-400 text-xs">{formatTime(position)}</Text>
          <Text className="text-gray-400 text-xs">{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Play/Pause Button and Volume Control */}
      <View className="flex-row items-center justify-between mt-4">
        <TouchableOpacity onPress={handlePlayPause}>
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color="white"
          />
        </TouchableOpacity>

        <View className="flex-row items-center flex-1 mx-4">
          <Ionicons
            name={getSpeakerIcon()} // Dynamic speaker icon
            size={20}
            color="white"
            style={{ marginRight: 8 }}
          />

        <Slider
          style={{ flex: 1 }}
          minimumValue={0}
          maximumValue={1}
          value={volume}
          onValueChange={handleVolumeChange}
          minimumTrackTintColor="#FFFFFF"
          maximumTrackTintColor="#000000"
          thumbTintColor="#FFFFFF"
        />
      </View>
    </View>
  </View>
  );
};

export default MusicPlayer;