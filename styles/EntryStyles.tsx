import { StyleSheet } from 'react-native';

const EntryStyles = StyleSheet.create({
  photoContainer: {
    aspectRatio: 1/1,
  },
  editIcon: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 10,
    backgroundColor: 'white',
    padding: 6,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  markdownContainer: {
    paddingTop: 15,
    paddingHorizontal: 15,
  },
})

export default EntryStyles;