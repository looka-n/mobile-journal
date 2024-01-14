import React from 'react';
import { View } from 'react-native'
import CardViewEditable from './components/CardViewEditable';
import CardViewFull from './components/CardViewFull';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';

const Stack = createStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="CardViewEditable" component={CardViewEditable} />
        <Stack.Screen name="CardViewFull" component={CardViewFull} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default App;