import { View, TextInput, TouchableOpacity, Image } from 'react-native';
import React, { useState } from 'react';
import { router } from 'expo-router';

import { icons } from '@/constants';

const SearchInput = ({ value, placeholder, handleChangeText, otherStyles }) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = () => {
    if (value.trim()) {
      router.push(`/search/${value}`); // Navigate to the search screen
    }
  };

  return (
    <View
      className={`border-2 w-full h-16 px-4 bg-black-100
        rounded-2xl items-center flex-row
        ${isFocused ? 'border-secondary' : 'border-black-200'} space-x-4`}
    >
      <TextInput
        className='text-base mt-0.5 text-white flex-1 font-pregular'
        value={value}
        placeholder={placeholder}
        placeholderTextColor="#7b7b8b"
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onSubmitEditing={handleSearch} // Trigger search on "Enter"
      />

      <TouchableOpacity onPress={handleSearch}>
        <Image
          source={icons.search}
          className='w-5 h-5'
          resizeMode='contain'
        />
      </TouchableOpacity>
    </View>
  );
};

export default SearchInput;