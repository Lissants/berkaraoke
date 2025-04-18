import { AppwriteException, Client, Account, ID, Avatars, Databases, Query, Storage } from 'react-native-appwrite';
import * as FileSystem from 'expo-file-system';

export const config = {
  endpoint: 'https://cloud.appwrite.io/v1',
  platform: 'com.lissants.berkaraoke',
  projectId: '67b4807a003ba491f36d',
  databaseId: '67b48be800136c065888',
  karaokeTrackCollectionId: '67d0691a0003fa39ca00',
  userCollectionId: '67b48c06000064e01ece',
  userKaraokeTrackCollectionId: '67b48c36002338cee82c',
  storageId: '67b48ebd0030e7749cef'
}

const {
  endpoint,
  platform,
  projectId,
  databaseId,
  karaokeTrackCollectionId,
  userCollectionId,
  userKaraokeTrackCollectionId,
  storageId
} = config;

// Init your React Native SDK
const client = new Client();

client
    .setEndpoint(config.endpoint) // Your Appwrite Endpoint
    .setProject(config.projectId) // Your project ID
    .setPlatform(config.platform) // Your application ID or bundle ID.
;

export const account = new Account(client);
const avatars = new Avatars(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export const createUser = async (email, password, username) => {
  try {
    const newAccount = await account.create(
      ID.unique(),
      email,
      password,
      username
    );

    if (!newAccount) throw new Error('Failed to create account');

    const session = await account.createEmailPasswordSession(email, password);
    if (!session) throw new Error('Failed to create session');

    const avatarUrl = avatars.getInitials(username);
    const newUser = await databases.createDocument(
      config.databaseId,
      config.userCollectionId,
      ID.unique(), 
      {
        accountId: newAccount.$id,
        email,
        username,
        avatar: avatarUrl
      }
    );
    
    return newUser;
  } catch (error) {
    console.log('Error in createUser:', error);
    throw new Error(error.message);
  }
};

export const signIn = async (email, password) => {
  try {
    
    // Delete existing sessions if any
    try {
      await account.deleteSessions();
    } catch (deleteError) {
      console.log('No sessions to delete');
    }
    // Then create new session
    const session = await account.createEmailPasswordSession(email, password);
    // Verify session
    const currentAccount = await account.get();
    if (!currentAccount) {
      throw new AppwriteException('Session Verification failed');
    }

    return session;
  } catch (error) {
    console.log('SignIn error:', error);
    throw error;
  }
}

export const getCurrentUser = async () => {
  try {
    const currentAccount = await account.get();
    if(!currentAccount) return null;

    const currentUser = await databases.listDocuments(
      config.databaseId,
      config.userCollectionId,
      [Query.equal('accountId', currentAccount.$id)]
    );

    if(!currentUser || currentUser.documents.length === 0) {
      return null;
    } 
    
    const userData = currentUser.documents[0];
    if (!userData.username) {
      console.warn('User document missing username:', userData);
    }

    return userData;
  } catch (error) {
    console.error('getCurrentUser error: ', error);
    return null;
  }
};

export const getAllTracks = async (limit = 25, offset = 0) => {
  try {
    const response = await databases.listDocuments(
      databaseId,
      karaokeTrackCollectionId,
      [
        Query.orderAsc("songName"),
        Query.limit(limit),
        Query.offset(offset)
      ]
    );

    return {
      documents: response.documents,
      total: response.total,
      hasMore: offset + limit < response.total
    };
  } catch (error) {
    throw new Error(error);
  }
}

export const getTracksByArtist = async () => {
  return databases.listDocuments(
    databaseId,
    karaokeTrackCollectionId,
    [Query.orderAsc("artist")]
  );
}

export const getTracksByGenre = async () => {
  return databases.listDocuments(
    databaseId,
    karaokeTrackCollectionId,
    [Query.orderAsc("genre")]
  );
}

// API Helper Function
// Add these helper functions to your appwrite.js
export const getAvailableGenres = async () => {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.karaokeTrackCollectionId,
      [Query.select(['genre'])]
    );
    
    const genres = new Set(response.documents.map(doc => doc.genre));
    return Array.from(genres).sort();
  } catch (error) {
    console.error('Error fetching genres:', error);
    return [];
  }
};

export const getAvailableArtists = async () => {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.karaokeTrackCollectionId,
      [Query.select(['artist'])]
    );
    
    const artists = new Set(response.documents.map(doc => doc.artist));
    return Array.from(artists).sort();
  } catch (error) {
    console.error('Error fetching artists:', error);
    return [];
  }
};

export const processRecording = async (fileIds, userId, genreFilter = 'all', artistFilter = 'all') => {
  try {
    // Create document
    const doc = await databases.createDocument(
      config.databaseId,
      config.userKaraokeTrackCollectionId,
      ID.unique(),
      {
        users: userId,
        fileIds: JSON.stringify(fileIds),
        processingStatus: 'pending',
        genreFilter,
        artistFilter
      }
    );

    // Call Lambda
    const response = await fetch('https://hmfxhbuoqe.execute-api.ap-southeast-1.amazonaws.com/production/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileIds,
        userId,
        documentId: doc.$id,
        genreFilter,
        artistFilter
      })
    });

    if (!response.ok) {
      throw new Error(`Lambda returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Processing error:', error);
    throw error;
  }
};

  /* Usage Example
  const handleProcess = async() => {
    const result = await processRecording(fileId, currentUser.$id);
    console.log(result.recommendations);
  };*/

  // Storage Upload Helper
  export const uploadAudioFile = async (fileUri, fileName) => {
    try {
      console.log('Preparing to upload:', fileUri);
  
      // Verify file exists first
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist at specified URI');
      }
  
      // For React Native, we need to read the file as a blob
      const fileContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
  
      // Create proper file object for Appwrite
      const file = {
        uri: fileUri,
        name: fileName,
        type: 'audio/x-m4a',
        size: fileInfo.size,
        blob: () => Promise.resolve(
          new Blob([fileContent], { type: 'audio/x-m4a' })
        ),
      };
  
      console.log('Uploading file:', {
        size: fileInfo.size,
        name: fileName,
        type: 'audio/x-m4a'
      });
  
      // Upload to Appwrite with proper error handling
      let result;
      try {
        result = await storage.createFile(
          config.storageId,
          ID.unique(),
          file
        );
      } catch (uploadError) {
        console.error('Appwrite upload error:', uploadError);
        throw new Error(`Appwrite upload failed: ${uploadError.message}`);
      }
  
      if (!result?.$id) {
        throw new Error('Appwrite did not return a file ID');
      }
  
      console.log('Upload successful, file ID:', result.$id);
      return result.$id;
      
    } catch (error) {
      console.error('Upload failed:', {
        error: error.message,
        stack: error.stack,
        fileUri,
        fileName
      });
      
      throw new Error(`Upload failed: ${error.message}`);
    }
  };