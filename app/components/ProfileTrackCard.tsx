import { View, Text, TouchableOpacity } from 'react-native';
import React from 'react';

const ProfileTrackCard = ({ track, onPress, similarity, showSimilarity = false }) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <View className="bg-primary p-4 m-2 rounded-lg">
        <View className="flex-row justify-between">
          <View>
            <Text className="text-white font-bold">{track.songName}</Text>
            <Text className="text-gray-300">{track.artist}</Text>
            <Text className="text-gray-400 text-xs">{track.genre}</Text>
          </View>
        </View>

        {showSimilarity && (
          <View className='items-end'>
            <Text className='text-secondary-200 font-psemibold'>
              {Math.round(similarity * 100)}%
            </Text>
            <Text className='text-gray-400 text-xs font-pregular'>Match</Text>
          </View>
        )}

      </View>
    </TouchableOpacity>
  );
};

export default ProfileTrackCard;