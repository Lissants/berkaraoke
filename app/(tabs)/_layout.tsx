import { Tabs } from 'expo-router';
import { View, Text, Image } from 'react-native';
import { icons } from '../../constants';

const TabIcon = ({ icon, color, name, focused }) => (
  <View className='items-center justify-center gap-2'>
    <Image
      source={icon}
      resizeMode='contain'
      tintColor={color}
      className='w-6 h-6'
    />
    <Text className={`${focused ? 'font-psemibold' : 'font-pregular'} text-xs`} 
          style={{ color: color }}>
      {name}
    </Text>
  </View>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#FFA001',
        tabBarInactiveTintColor: '#CDCDE0',
        tabBarStyle: {
          backgroundColor: '#161622',
          borderTopWidth: 0,
          height: 84,
        },
      }}
    >
      <Tabs.Screen 
        name="home"
        options={{
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon 
              icon={icons.home}
              color={color}
              name="Home"
              focused={focused}
            />
          )
        }}
      />
      
      <Tabs.Screen 
        name="create"
        options={{
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon 
              icon={icons.plus}
              color={color}
              name="Create"
              focused={focused}
            />
          )
        }}
      />
      

      <Tabs.Screen 
        name="profile"
        options={{
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon 
              icon={icons.profile}
              color={color}
              name="Profile"
              focused={focused}
            />
          )
        }}
      />

    </Tabs>
  );
}