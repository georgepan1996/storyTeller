import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import SignUp from '../screens/SignUp';
import SignIn from '../screens/SignIn';
import Settings from '../screens/Settings';

const Stack = createStackNavigator();

function MainStackNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName='SignIn'
        screenOptions={{
          gestureEnabled: true,
          headerShown: false,
          headerBackTitleVisible: false,
          headerStyle: {
            backgroundColor: '#ff3fff',
          },
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerTintColor: '#ffffff',
        }}
      >
        <Stack.Screen
          name='SignUp'
          component={SignUp}
          options={{ title: '' }}
          headerMode='float'
        />
        <Stack.Screen
          name='SignIn'
          component={SignIn}
          options={{ title: 'Sign In' }}
          headerMode='float'
        />
        <Stack.Screen
          name='Settings'
          component={Settings}
          options={{ title: 'Settings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default MainStackNavigator;
