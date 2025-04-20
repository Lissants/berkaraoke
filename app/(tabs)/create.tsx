import { useState, useEffect, useRef } from 'react';
import { 
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  Platform
 } from 'react-native';
import { ID, Query } from 'react-native-appwrite';
import {Picker} from '@react-native-picker/picker';
import { Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import UserTrackCard from '../components/UserTrackCard';
import MusicPlayer from '../components/MusicPlayer';
import { useGlobalContext } from '@/context/GlobalProvider';
import { getAvailableGenres, getAvailableArtists, storage } from '@/lib/appwrite';
import { 
  config,
  databases, 
  getCurrentUser,
  uploadAudioFile,
  processRecording
} from '@/lib/appwrite';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

const create = () => {
  interface RecordingData {
    fileId: string;
    docId: string;
  }

  const [modulesReady, setModulesReady] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedURI, setRecordedURI] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioFilePath, setAudioFilePath] = useState(null);
  const [recordings, setRecordings] = useState<Record<string, RecordingData>>({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [completedRecordings, setCompletedRecordings] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [availableGenres, setAvailableGenres] = useState([]);
  const [availableArtists, setAvailableArtists] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedArtist, setSelectedArtist] = useState('all');
  const recordingRef = useRef<Audio.Recording | null>(null);


  const RECORDING_OPTIONS = {
    android: {
      extension: '.m4a',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
    },
    ios: {
      extension: '.m4a',
      audioQuality: Audio.IOSAudioQuality.MAX,
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/mp4',
      bitsPerSecond: 128000,
    },
  } as const

  const theLyrics = { 
      '67d06b18000814c6ee7c' : `
      Sekai azamuku yuruginai seigi
      Hodoite shinjitsu kono te no naka\n
      Daitan futeki na kage ga karei ni odoru
      Kimi ga kakushiteru himitsu itsuka kikasete yo
      Nobashita te de fureru koto wa dare mo dekinai
      Kimi ga kakushiteru sekai boku ni misasete yo\n
      Yureru nankai na kokoro
      Tokiakashite ubau sono hitomi
      Fuangatte naitetatte mitsukerannai yo
      Nerau shinjitsu wa doko e kieta\n
      Tatoe sekai azamuku kotae da to shite mo
      "Shinjite" sashidasu tenohira
      Kesshite nigenai kowaku wa nai kara
      Me wo ake yowasa wo kakikesunda`,

      '67d06c14000fcb6d79d3' : `
      Kareha mau machikado wo
      Kakenuke teku kawai ta kaze
      Namiki dōri hitonami nuke te
      Doko ka tōku dare mo i nai basho e\n
      Kizui te i ta noni nani mo shira nai furi
      Hitori kiri de wa nani mo deki nakatta\n
      Deae ta maboroshi ni sayonara wo
      Akane sasu kono sora ni
      Kobore ta yowa sa ni tenohira wo
      Hito hira no hanabira sonna fuu ni\n
      Deai kasane negai wo shiru`,
 
      '67e2bebe0008beaed04b' : `
      Kimi ga motte kita manga
      Kuretashiranai namae no ohana
      Kyou wa mada konai ka na?
      Hajimete no kanjou shitte shimatta\n
      Mado ni kazatta kaiga wo nazotte 
      hitori de uchuu wo tabi shite
      Sore dake de ii hazu datta no ni\n
      Kimi no te wo nigitte shimattara
      Kodoku wo shiranai kono machi ni wa
      Mou nidoto kaette kuru 
      koto wa dekinai no deshou
      Kimi ga te wo sashinobeta 
      hikari de kage ga umareru
      Utatte kikasete kono hanashi no tsuzuki
      Tsurete itte mita koto nai hoshi made`
    };

  const specificTrackIds = [
    '67d06b18000814c6ee7c',
    '67d06c14000fcb6d79d3',
    '67e2bebe0008beaed04b'
  ];

  const LOCAL_SERVER_URL = 'http://192.168.1.3:5000';

  const fetchTrack = async () => {
    try {
      setLoading(true);
      const trackPromises = specificTrackIds.map(id => 
        databases.getDocument(
          config.databaseId,
          config.karaokeTrackCollectionId,
          id
        ).then(track => {
          // Merge Appwrite data with hardcoded lyrics
          return {
            ...track,
            lyrics: theLyrics[id] || 'No lyrics available'
          };
        }).catch(e => {
          console.error(`Error fetching document ${id}:`, e);
          return null;
        })
      );
      
      const results = await Promise.all(trackPromises);
      setTracks(results.filter(track => track !== null));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrack();
  }, []);

  const toggleExpand = (id) => {
    setExpandedCardId(expandedCardId === id ? null : id);
  };

  const startRecording = async () => {
    try {
      // Clear any previous recording
      if (recordingRef.current) {
        await stopRecording();
      }
  
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Microphone permission denied');
      }
  
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
  
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(RECORDING_OPTIONS);
      await newRecording.startAsync();
  
      // Update both ref and state
      recordingRef.current = newRecording;
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingTime(0);
  
      // Start timer
      const interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
  
      return () => clearInterval(interval);
  
    } catch (error) {
      console.error('Start recording failed:', error);
      Alert.alert('Error', 'Failed to start recording: ' + error.message);
      return false;
    }
  };
  
  const stopRecording = async () => {
    try {
      if (!recordingRef.current) {
        throw new Error('No active recording to stop');
      }
  
      const recordingToStop = recordingRef.current;
      
      await recordingToStop.stopAndUnloadAsync();
      const uri = recordingToStop.getURI();
      
      if (!uri) {
        throw new Error('Recording URI is null');
      }
  
      // Update state
      setRecordedURI(uri);
      setRecording(null);
      setIsRecording(false);
      recordingRef.current = null;
  
      return uri;
  
    } catch (error) {
      console.error('Stop recording error:', error);
      Alert.alert('Error', 'Failed to stop recording: ' + error.message);
      return null;
    }
  };
  
  const playRecording = async () => {
    try {
      // Stop any existing playback
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }
  
      // Configure audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
  
      const { sound: playbackSound } = await Audio.Sound.createAsync(
        { uri: recordedURI },
        { shouldPlay: true }
      );
      
      setSound(playbackSound);
      
      // Automatically unload when playback finishes
      playbackSound.setOnPlaybackStatusUpdate((status) => {
        setIsPlaying(status.isPlaying);
        if (status.didJustFinish) {
          playbackSound.unloadAsync();
          setSound(null);
          setIsPlaying(false);
        }
      });
    } catch (err) {
      console.error('Failed to play recording', err);
      Alert.alert('Error', 'Failed to play recording');
    }
  };
  
  const stopPlayback = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
  };
  
  // Clean up sound on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const debugCheckDocuments = async () => {
    const currentUser = await getCurrentUser();
    const docs = await databases.listDocuments(
      config.databaseId,
      config.userKaraokeTrackCollectionId,
      [Query.equal('users', currentUser.$id)]
    );
    console.log('All user documents:', docs.documents);
  };

  const triggerPythonProcessing = async (fileId: string, docId: string) => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) throw new Error('User not logged in');
  
      // 1. Verify server connection
      const healthCheck = await fetch(`${LOCAL_SERVER_URL}/`);
      if (!healthCheck.ok) throw new Error('Server not ready');
      
      // 2. Start processing
      const response = await fetch(`${LOCAL_SERVER_URL}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: [fileId],
          documentId: docId,
          userId: currentUser.$id,
          genreFilter: selectedGenre,
          artistFilter: selectedArtist
        })
      });
  
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Processing failed');
      }
  
      return result;
      
    } catch (error) {
      console.error('Processing error:', error);
      // Update UI state to show error
      throw error;
    }
  };

  const saveRecording = async () => {
    setIsUploading(true);
    try {
      if (!currentTrack) {
        Alert.alert('Error', 'No track selected');
        return;
      }
  
      if (!recordedURI) {
        Alert.alert('Error', 'No recording to save');
        return;
      }
  
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to save recordings');
        return;
      }
  
      setUploadProgress(prev => ({
        ...prev,
        [currentTrack.$id]: 'uploading'
      }));
  
      // 1. Upload audio file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${currentUser.username}_${currentTrack.songName}_${timestamp}.m4a`;
      const fileId = await uploadAudioFile(recordedURI, fileName);
  
      // 2. Create NEW document for each recording
      const doc = await databases.createDocument(
        config.databaseId,
        config.userKaraokeTrackCollectionId,
        ID.unique(),
        {
          users: currentUser.$id,
          fileIds: [fileId], // Single file ID array
          fileId: fileId,    // Also store as string (backward compatibility)
          processingStatus: 'pending',
          recordingDate: new Date().toISOString(),
          genreFilter: selectedGenre,
          artistFilter: selectedArtist,
          recommendations: [],
          performanceData: [],
          crepeAnalysis: '',
          accuracyScore: 0,
        }
      );

      await debugCheckDocuments();
      await triggerPythonProcessing(fileId, doc.$id);
  
      // 3. Update state
      setRecordings(prev => ({
        ...prev,
        [currentTrack.$id]: {
          fileId,
          docId: doc.$id
        }
      }));
  
      setUploadProgress(prev => ({
        ...prev,
        [currentTrack.$id]: 'completed'
      }));
  
      setCompletedRecordings(prev => prev + 1);
      
      Alert.alert(
        'Saved!', 
        `New document created: ${doc.$id}\n` +
        `File ID: ${fileId}`
      );
  
    } catch (error) {
      console.error('Save failed:', error);
      Alert.alert('Error', `Save failed: ${error.message}`);
      setUploadProgress(prev => ({
        ...prev,
        [currentTrack.$id]: 'failed'
      }));
    } finally {
      setIsUploading(false);
    }
  };

  // Add this useEffect to load filters
  useEffect(() => {
    const loadFilters = async () => {
      const genres = await getAvailableGenres();
      const artists = await getAvailableArtists();
      setAvailableGenres(genres);
      setAvailableArtists(artists);
    };
    loadFilters();
  }, []);

  const submitAllRecordings = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }
  
      // Get all recorded document IDs
      const recordedDocs = Object.values(recordings)
        .map(r => r.docId)
        .filter(Boolean);
  
      if (recordedDocs.length < 3) {
        Alert.alert('Incomplete', `You've recorded ${recordedDocs.length}/3 songs`);
        return;
      }
  
      // Create a master document linking all recordings
      const masterDoc = await databases.createDocument(
        config.databaseId,
        config.userKaraokeTrackCollectionId,
        ID.unique(),
        {
          users: currentUser.$id,
          processingStatus: 'pending',
          recordingDate: new Date().toISOString(),
          genreFilter: selectedGenre,
          artistFilter: selectedArtist,
          childDocuments: recordedDocs, // Array of document IDs
          isMasterDocument: true
        }
      );
  
      // Trigger Lambda with all file IDs
      const fileIds = Object.values(recordings).map(r => r.fileId);
      const response = await fetch('YOUR_LAMBDA_ENDPOINT', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds,
          documentIds: recordedDocs,
          masterDocumentId: masterDoc.$id,
          userId: currentUser.$id,
          genreFilter: selectedGenre,
          artistFilter: selectedArtist
        })
      });
  
      const result = await response.json();
      console.log('Lambda response:', result);
  
      Alert.alert(
        'Submitted!',
        `Master document: ${masterDoc.$id}\n` +
        `Processing ${fileIds.length} recordings`
      );
  
    } catch (error) {
      console.error('Submission failed:', error);
      Alert.alert('Error', error.message || 'Submission failed');
    }
  };
  
  const handleFinalSubmission = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }
  
      const fileIds = specificTrackIds.map(id => recordings[id]).filter(Boolean);
      
      const doc = await databases.createDocument(
        config.databaseId,
        config.userKaraokeTrackCollectionId,
        ID.unique(),
        {
          users: currentUser.$id,
          fileIds: fileIds,
          processingStatus: 'pending',
          recordingDate: new Date().toISOString(),
          genreFilter: selectedGenre,
          artistFilter: selectedArtist,
          recommendations: [],
          performanceData: [],
          crepeAnalysis: '',
          accuracyScore: 0
        }
      );
      
      // Trigger processing
      const response = await fetch('YOUR_LAMBDA_ENDPOINT', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds,
          userId: currentUser.$id,
          documentId: doc.$id,
          genreFilter: selectedGenre,
          artistFilter: selectedArtist
        })
      });
      
      const result = await response.json();
      console.log('Processing started:', result);
      
      Alert.alert(
        'Success', 
        'Your recordings have been submitted for processing with filters:\n' +
        `Genre: ${selectedGenre}\nArtist: ${selectedArtist}`
      );
      
    } catch (error) {
      console.error('Submission error:', error);
      Alert.alert('Error', error.message || 'Submission failed');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // test Code
  const uploadTestFile = async () => {
    try {
      let testUri;
      
      if (Platform.OS === 'android') {
        // Start recording
        await startRecording();
        
        // Wait for 3 seconds while showing recording status
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Stop recording and get URI
        await stopRecording();
        
        // Add a small delay to ensure URI is set
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!recordedURI) {
          throw new Error('Android recording failed to generate URI');
        }
        
        // Verify the URI exists
        const fileInfo = await FileSystem.getInfoAsync(recordedURI);
        if (!fileInfo.exists) {
          throw new Error('Recorded file does not exist at: ' + recordedURI);
        }
        
        testUri = recordedURI;
      } else {
        // For iOS/web, use bundled asset
        testUri = require('../../assets/Test2.m4a');
      }
  
      console.log('Using test URI:', testUri);
      
      const fileName = `test_${Date.now()}.m4a`;
      const fileId = await uploadAudioFile(testUri, fileName);
      
      if (!fileId) throw new Error('Upload returned no file ID');
      
      return fileId;
    } catch (error) {
      console.error('Test upload failed:', {
        error: error.message,
        stack: error.stack,
        platform: Platform.OS,
        recordedURI // Log the URI for debugging
      });
      throw error;
    }
  };
  
  const createTestDoc = async (fileId) => {
    try {
      const currentUser = await getCurrentUser();
      const doc = await databases.createDocument(
        config.databaseId,
        config.userKaraokeTrackCollectionId,
        ID.unique(),
        {
          users: currentUser.$id,
          fileIds: JSON.stringify([fileId]),
          processingStatus: 'pending',
          genreFilter: 'pop', // Test value
          artistFilter: 'all' // Test value
        }
      );
      console.log('Test document created:', doc.$id);
      return doc.$id;
    } catch (error) {
      console.error('Document creation failed:', error);
      return null;
    }
  };

  const triggerLambdaTest = async (fileId, docId) => {
    try {
      const response = await fetch('https://hmfxhbuoqe.execute-api.ap-southeast-1.amazonaws.com/production/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds: [fileId],
          documentId: docId,
          genreFilter: 'pop', // Test with specific genre
          artistFilter: 'all'
        })
      });
      
      const result = await response.json();
      console.log('Lambda response:', result);
      return result;
    } catch (error) {
      console.error('Lambda invocation failed:', error);
    }
  };

  const runFullTest = async () => {
    try {
      Alert.alert('Test Started', 'Beginning test sequence...');
      
      // 1. Create test recording
      Alert.alert('Info', 'Starting recording...');
      await startRecording();
      
      // Wait 11 seconds for recording
      await new Promise(resolve => setTimeout(resolve, 11000));
      
      const uri = await stopRecording();
      if (!uri) throw new Error('Recording failed - no URI generated');
      
      console.log('Recording URI:', uri);
      
      // 2. Verify file exists
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Recorded file does not exist');
      }
      
      // 3. Upload to Appwrite Storage
      const fileName = `test_${Date.now()}.m4a`;
      const fileId = await uploadAudioFile(uri, fileName);
      
      if (!fileId) throw new Error('Upload failed - no file ID returned');
      
      // 4. Create document in userKaraokeTrack
      const currentUser = await getCurrentUser();
      if (!currentUser) throw new Error('No user logged in');
      
      const doc = await databases.createDocument(
        config.databaseId,
        config.userKaraokeTrackCollectionId,
        ID.unique(),
        {
          users: currentUser.$id,
          fileId: fileId, // Single file ID as string
          processingStatus: 'pending'
        }
      );
      
      Alert.alert('Success', `File uploaded!\nFile ID: ${fileId}\nDoc ID: ${doc.$id}`);
      
      // 5. Trigger Lambda processing
      const lambdaResponse = await fetch('https://hmfxhbuoqe.execute-api.ap-southeast-1.amazonaws.com/production/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds: [fileId], // Array of file IDs
          userId: currentUser.$id,
          documentId: doc.$id,
          genreFilter: 'pop',
          artistFilter: 'all'
        })
      });
      
      const result = await lambdaResponse.json();
      console.log('Lambda response:', result);
      Alert.alert('Lambda Response', JSON.stringify(result, null, 2));
      
    } catch (error) {
      console.error('Test failed:', {
        error: error.message,
        stack: error.stack,
        recordedURI
      });
      Alert.alert('Test Failed', error.message);
    }
  };

  const runThreeFileTest = async () => {
    try {
      console.log('--- Starting 3-file test ---');
      const fileIds = [];
      
      // Get current user first (important for document creation)
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('No user logged in');
      }
  
      for (let i = 0; i < 3; i++) {
        try {
          console.log(`[Recording ${i+1}] Starting...`);
          
          // Start recording
          const started = await startRecording();
          if (!started) throw new Error('Start recording returned false');
          console.log(`[Recording ${i+1}] Recording started`);
  
          // Wait 11 seconds
          await new Promise(resolve => setTimeout(resolve, 11000));
          
          // Stop recording
          console.log(`[Recording ${i+1}] Stopping...`);
          const uri = await stopRecording();
          if (!uri) throw new Error('Stop recording returned no URI');
          console.log(`[Recording ${i+1}] Stopped, URI: ${uri}`);
  
          // Verify file
          const fileInfo = await FileSystem.getInfoAsync(uri);
          console.log(`[Recording ${i+1}] File info:`, fileInfo);
          
          if (!fileInfo.exists || fileInfo.size === 0) {
            throw new Error('File empty or missing');
          }
  
          // Upload
          const fileName = `test_${i}_${Date.now()}.m4a`;
          console.log(`[Recording ${i+1}] Uploading as ${fileName}...`);
          
          const fileId = await uploadAudioFile(uri, fileName);
          if (!fileId) throw new Error('Upload returned no file ID');
          
          console.log(`[Recording ${i+1}] Uploaded, ID: ${fileId}`);
          fileIds.push(fileId);
          
        } catch (error) {
          console.error(`[Recording ${i+1}] Failed:`, error);
          throw new Error(`Recording ${i+1} failed: ${error.message}`);
        }
      }
  
      console.log('All recordings completed, file IDs:', fileIds);
      
      // Create document with all 3 file IDs
      try {
        console.log('Creating document in userKaraokeTrack collection...');
        const doc = await databases.createDocument(
          config.databaseId,
          config.userKaraokeTrackCollectionId,
          ID.unique(),
          {
            users: currentUser.$id,
            fileIds: fileIds, // Array of file IDs
            processingStatus: 'pending',
            recordingDate: new Date().toISOString(),
            genreFilter: 'all',
            artistFilter: 'all'
          }
        );
        
        console.log('Document created:', doc);
        Alert.alert(
          'Complete!', 
          `All files uploaded and document created!\n` +
          `Document ID: ${doc.$id}`
        );
        
        // Trigger Lambda
        const response = await fetch('https://hmfxhbuoqe.execute-api.ap-southeast-1.amazonaws.com/production/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileIds,
            userId: currentUser.$id,
            documentId: doc.$id,
            genreFilter: '',
            artistFilter: ''
          })
        });
        
        const result = await response.json();
        console.log('Lambda response:', result);
        Alert.alert('Processing Complete', 'Check your profile for recommendations!');
        
      } catch (docError) {
        console.error('Document creation failed:', docError);
        throw new Error(`Failed to create document: ${docError.message}`);
      }
      
    } catch (error) {
      console.error('Complete test failed:', error);
      Alert.alert('Test Failed', error.message);
    }
  };
  
  
  const checkStorage = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'Not logged in');
        return;
      }
  
      const files = await storage.listFiles(config.storageId);
      console.log('Storage contents:', files);
      Alert.alert('Storage Info', `${files.total} files in storage`);
    } catch (error) {
      console.error('Storage check failed:', error);
      Alert.alert('Error', 'Failed to check storage');
    }
  };

  const checkAppwriteConnection = async () => {
    try {
      // Try hitting the version endpoint which doesn't require auth
      const versionResponse = await fetch(`${config.endpoint}/version`);
      const versionData = await versionResponse.json();
      
      console.log('Appwrite version:', versionData);
      Alert.alert('Connection Success', `Connected to Appwrite ${versionData.version}`);
      return true;
    } catch (error) {
      console.error('Connection check failed:', error);
      Alert.alert('Connection Error', `Failed to connect: ${error.message}`);
      return false;
    }
  };

  const FilterModal = ({ 
    visible, 
    onClose, 
    genres, 
    artists, 
    selectedGenre, 
    selectedArtist,
    onApply 
  }) => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-primary-800 p-6 rounded-t-3xl max-h-[70vh]">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-secondary text-xl font-psemibold">
              Filter Preferences
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
  
          {/* Genre Filter */}
          <View className="mb-6">
            <Text className="text-secondary font-pmedium mb-3">Select Genre</Text>
            <View className="flex-row flex-wrap">
              <TouchableOpacity
                className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                  selectedGenre === 'all' ? 'bg-secondary-200' : 'bg-gray-700'
                }`}
                onPress={() => setSelectedGenre('all')}
              >
                <Text className={selectedGenre === 'all' ? 'text-primary' : 'text-white'}>
                  All Genres
                </Text>
              </TouchableOpacity>
              {genres.map(genre => (
                <TouchableOpacity
                  key={genre}
                  className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                    selectedGenre === genre ? 'bg-secondary-200' : 'bg-gray-700'
                  }`}
                  onPress={() => setSelectedGenre(genre)}
                >
                  <Text className={selectedGenre === genre ? 'text-primary' : 'text-white'}>
                    {genre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
  
          {/* Artist Filter */}
          <View className="mb-6">
            <Text className="text-secondary font-pmedium mb-3">Select Artist</Text>
            <View className="flex-row flex-wrap">
              <TouchableOpacity
                className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                  selectedArtist === 'all' ? 'bg-secondary-200' : 'bg-gray-700'
                }`}
                onPress={() => setSelectedArtist('all')}
              >
                <Text className={selectedArtist === 'all' ? 'text-primary' : 'text-white'}>
                  All Artists
                </Text>
              </TouchableOpacity>
              {artists.map(artist => (
                <TouchableOpacity
                  key={artist}
                  className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                    selectedArtist === artist ? 'bg-secondary-200' : 'bg-gray-700'
                  }`}
                  onPress={() => setSelectedArtist(artist)}
                >
                  <Text className={selectedArtist === artist ? 'text-primary' : 'text-white'}>
                    {artist}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
  
          <TouchableOpacity
            className="bg-secondary-200 py-3 rounded-full items-center"
            onPress={() => {
              onApply(selectedGenre, selectedArtist);
              onClose();
            }}
          >
            <Text className="text-primary font-psemibold">Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Create',
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => setShowFilterModal(true)}
              className="mr-4"
            >
              <Ionicons name="filter" size={24} color="white" />
            </TouchableOpacity>
          ),
          headerStyle: {
            backgroundColor: '#161622',
          },
          headerTintColor: '#fff',
        }}
      />
      <SafeAreaView className="bg-primary flex-1">
        {/* Header Section */}
        <View className="pt-4 pb-2 px-4">
          <Text className='text-2xl font-psemibold text-secondary-200 text-center'>
            Sing All 3 Songs
          </Text>
          <Text className='font-pmedium text-sm text-gray-100 text-center mt-1'>
            To get your recommendation!
          </Text>
        </View>
  
      {/* Main Content Area */}
      <View className="flex-1">

        {/* Track List with space reserved for music player and recording button */}
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={{ 
            paddingBottom: currentTrack ? 260: 120, // Space for both music player and recording button
            paddingTop: 8,
            paddingHorizontal: 4
          }}
          renderItem={({ item }) => (
            <View className="mb-4">
              <UserTrackCard 
                track={item} 
                onPress={() => setCurrentTrack(item)}
                isExpanded={expandedCardId === item.$id}
                onToggleExpand={() => toggleExpand(item.$id)}
                isRecorded={!!recordings[item.$id]}
                similarity={''}
              />
              
        {/* Add status indicator */}
        <View className="flex-row items-center mt-1 px-4">
          {uploadProgress[item.$id] === 'uploading' && (
            <Text className="text-yellow-500 text-xs font-pmedium">
              Uploading...
            </Text>
          )}
          {uploadProgress[item.$id] === 'completed' && (
            <Text className="text-green-500 text-xs font-pmedium">
              ✓ Recorded
            </Text>
          )}
          {uploadProgress[item.$id] === 'failed' && (
            <Text className="text-red-500 text-xs font-pmedium">
              Upload failed
            </Text>
          )}
            </View>
          </View>
        )}
          ListEmptyComponent={() => (
            <View className="flex-1 justify-center items-center mt-10">
              <Text className="text-white">No tracks available</Text>
            </View>
          )}
        />

        {/* Submission Progress Button */}
        {completedRecordings > 0 && (
          <View className="absolute bottom-28 left-0 right-0 px-4">
            <View className="bg-primary-800 p-3 rounded-lg">
              <Text className="text-white text-center mb-2">
                {completedRecordings}/3 songs recorded
              </Text>
              
              <TouchableOpacity
                onPress={submitAllRecordings}
                disabled={completedRecordings < 3}
                className={`py-3 rounded-full items-center ${
                  completedRecordings < 3 ? 'bg-gray-600' : 'bg-green-500'
                }`}
              >
                <Text className={`font-psemibold text-lg ${
                  completedRecordings < 3 ? 'text-gray-400' : 'text-white'
                }`}>
                  {completedRecordings < 3 
                    ? `Need ${3 - completedRecordings} more` 
                    : 'Get Recommendations'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
    
        {/* Music Player (fixed position but above recording button) */}
        {currentTrack && (
          <View className="absolute bottom-24 left-0 right-0 bg-gray-900/90 backdrop-blur-sm p-4">
            <MusicPlayer track={currentTrack} />
          </View>
        )}    
    
          {/* Recording Controls (always at bottom) */}
          <View className="absolute bottom-0 left-0 right-0 bg-primary p-4 border-t border-gray-800">
          {!recordedURI ? (
            <TouchableOpacity 
              onPress={isRecording ? stopRecording : startRecording}
              className={`p-4 rounded-full items-center ${
                uploadProgress[currentTrack?.$id] === 'completed' 
                  ? 'bg-gray-600' 
                  : 'bg-secondary-200'
              }`}
              disabled={uploadProgress[currentTrack?.$id] === 'completed' || isUploading}
            >
              <Text className="text-primary font-psemibold text-lg">
                {isRecording ? 'Stop Recording' : (
                  uploadProgress[currentTrack?.$id] === 'completed'
                    ? 'Already Recorded'
                    : 'Start Recording'
                )}
              </Text>
              {isRecording && (
                <Text className="text-primary font-pmedium mt-1">
                  {formatTime(recordingTime)}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <View className="flex-row justify-between">
              <TouchableOpacity 
                className={`p-3 rounded flex-1 mr-2 items-center ${sound ? 'bg-orange-500' : 'bg-blue-500'}`}
                onPress={sound ? stopPlayback : playRecording}
              >
                <Text className="text-white font-psemibold">
                  {sound ? 'Stop' : 'Listen'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="bg-green-500 p-3 rounded flex-1 mx-2 items-center"
                onPress={saveRecording}
              >
                <Text className="text-white font-psemibold">✓ Save</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="bg-red-500 p-3 rounded flex-1 ml-2 items-center"
                onPress={() => {
                  setRecordedURI(null);
                  if (sound) {
                    sound.unloadAsync();
                    setSound(null);
                  }
                }}
              >
                <Text className="text-white font-psemibold">✗ Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>

      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        genres={availableGenres}
        artists={availableArtists}
        selectedGenre={selectedGenre}
        selectedArtist={selectedArtist}
        onApply={(genre, artist) => {
          setSelectedGenre(genre);
          setSelectedArtist(artist);
          // You can add additional filter logic here
          console.log('Filters applied:', { genre, artist });
        }}
      />
    </SafeAreaView>
    </>
  );
};

export default create;