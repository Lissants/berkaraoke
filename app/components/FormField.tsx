import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native'
import React, { useState } from 'react'

import { icons } from '@/constants'
const FormField = ({ title, value, placeholder, handleChangeText, otherStyles, ...props }) => {
  const [showPassword, setshowPassword] = useState(false)
  const [isFocused, setisFocused] = useState(false)
  
  return (
    <View className={`space-y-2 ${otherStyles}`}>
      <Text className='text-base text-gray-100 font-pmedium'>{title}</Text>

      <View 
        className={`border-2 w-full h-16 px-4 bg-black-100
         rounded-2xl items-center flex-row
          ${isFocused ? 'border-secondary' : 'border-black-200'}`}
      >

        <TextInput 
          className='flex-1 text-white font-psemibold text-base'
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#7b7b8b"
          onChangeText={handleChangeText}
          secureTextEntry={title === 'Password' && !showPassword}
          onFocus={() => setisFocused(true)}
          onBlur={() => setisFocused(false)}
        />
        {title === 'Password' && (
          <TouchableOpacity onPress={() => setshowPassword(!showPassword)}>
            <Image source={!showPassword ? icons.eye :
              icons.eyeHide
            } className='w-6 h-6' resizeMode='contain'
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

export default FormField