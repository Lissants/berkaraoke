import { View, Text, TouchableOpacity } from 'react-native';
import React from 'react';

const UserTrackCard = ({ track, onPress, isExpanded, onToggleExpand, isRecorded, similarity, showSimilarity = false }) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <View className="bg-primary p-4 m-2 rounded-lg">
        <View className="flex-row justify-between">
          <View>
            <Text className="text-white font-bold">{track.songName}</Text>
            <Text className="text-gray-300">{track.artist}</Text>
            <Text className="text-gray-400 text-xs">{track.genre}</Text>
          </View>
          <Text className={isRecorded ? "text-white text-xs" : "text-secondary-200 text-xs"}>
            {isRecorded ? '✓ Recorded' : 'Not Sung'}
          </Text>
        </View>

        {showSimilarity && (
          <View className='items-end'>
            <Text className='text-secondary-200 font-psemibold'>
              {Math.round(similarity * 100)}%
            </Text>
            <Text className='text-gray-400 text-xs'>Match</Text>
          </View>
        )}
        
        <TouchableOpacity onPress={onToggleExpand} className="mt-2">
          <Text className="text-blue-400 font-pmedium">
            {isExpanded ? 'Hide Lyrics' : 'Show Lyrics'}
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <View className="mt-2">
            <Text className="text-white text-m whitespace-pre-line font-pregular">
              {track.lyrics}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default UserTrackCard;