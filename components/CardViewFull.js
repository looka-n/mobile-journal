import React from 'react';
import { View, ScrollView, Text, TextInput, Pressable, StyleSheet } from 'react-native';

const CardViewFull = ({navigation}) => {
  const saveText = () => {
    navigation.navigate('CardViewEditable')
  };
  const navigateBack = () => {
    console.log('Back')
  };

  return (
    <View style={styles.page}>
      <ScrollView>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Placeholder Title</Text>
        </View>

        {/* Text entry */}
        <View style={styles.inputContainer} />
        
        {/* Buttons */}
        <View style={styles.buttonContainer}>
          {/* Back button */}
          <Pressable style={styles.buttonBack} onPress={navigateBack}>
            <Text style={styles.buttonBackText}>
              Back
            </Text>
          </Pressable>

          {/* Save button */}
          <Pressable style={styles.buttonSave} onPress={saveText}>
            <Text style={styles.buttonSaveText}>
              Edit
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingTop: 65,

    backgroundColor: '#131516'
  },
  titleContainer: {
    marginHorizontal: 20,
    paddingVertical: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: 'bold',
    letterSpacing: .25
  },
  inputContainer: {
    alignContent: 'center',
    height: 500,
    margin: 20,
    padding: 10,
    
    backgroundColor: '#1d2021',
    borderRadius: 10
  },
  inputText: {
    color: '#FFFFFF',
    fontSize: 15
  },
  buttonContainer: {
    flexDirection: 'row'
  },
  buttonBack: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 20,
    paddingVertical: 12,
    paddingHorizontal: 32,
    
    width: 110,
    
    backgroundColor: '#1d2021',
    borderRadius: 10
  },
  buttonBackText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 'bold',
    letterSpacing: 0.25,
    color: '#FFFFFF'
  },
  buttonSave: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginLeft: 'auto',
    marginRight: 20,
    
    width: 110,
    
    backgroundColor: '#1d2021',
    borderRadius: 10
  },
  buttonSaveText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 'bold',
    letterSpacing: .25,
    color: '#FFFFFF'
  }
});

export default CardViewFull;