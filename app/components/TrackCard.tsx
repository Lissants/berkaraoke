import { View, Text, TouchableOpacity } from 'react-native'
import { React, useState } from 'react'

const TrackCard = ({ track: { songName, artist, genre }, onPress }) => {
  const [play, setPlay] = useState(false);

  return (
    <TouchableOpacity onPress={onPress}>
    <View className='flex-col items-center px-4 mb-10'>
      <View className='flex-row gap-3 items-start'>
        <View className='justify-center items-center flex-row flex-1'>
          <View className='justify-center flex-1 ml-3 gap-y-1'>
            <Text className='text-white font- text-m'numberOfLines={1}>{songName}</Text>
            <Text className='text-xs text-gray-100 font-pregular'numberOfLines={1}>{artist}</Text>
            <Text className='text-xs text-secondary font-pregular'>{genre}</Text>
          </View>
        </View>
      </View>
    </View>
    </TouchableOpacity>
  );
};

export default TrackCard;