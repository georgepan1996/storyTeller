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
        initialRouteName='SignUp'
        screenOptions={{
          gestureEnabled: true,
          headerBackTitleVisible: false,
          headerStyle: {
            backgroundColor: '#101010',
          },
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerTintColor: '#ffd700',
        }}
      >
        <Stack.Screen
          name='SignUp'
          component={SignUp}
          options={{ title: 'Sign Up Screen' }}
          headerMode='float'
        />
        <Stack.Screen
          name='SignIn'
          component={SignIn}
          options={({ route }) => ({
            title: route.params.item.name,
          })}
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
