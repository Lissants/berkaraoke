import { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Query } from 'react-native-appwrite';
import { useGlobalContext } from '@/context/GlobalProvider';
import { databases, config } from '@/lib/appwrite';
import ProfileTrackCard from '../components/ProfileTrackCard';

const Profile = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useGlobalContext();

    // Helper function to safely parse JSON with escaped characters
    const parseAppwriteJson = (jsonString: string) => {
      try {
        // First try parsing directly
        return JSON.parse(jsonString);
      } catch (firstError) {
        try {
          // If fails, try unescaping quotes
          const unescaped = jsonString.replace(/\\"/g, '"');
          return JSON.parse(unescaped);
        } catch (secondError) {
          console.error('Failed to parse JSON:', secondError);
          return null;
        }
      }
    };
  
    useEffect(() => {
      const fetchRecommendations = async () => {
        if (!user) return;
        
        try {
          const response = await databases.listDocuments(
            config.databaseId,
            config.userKaraokeTrackCollectionId,
            [
              Query.equal('users', user.$id),
              Query.orderDesc('processedAt'),
              Query.limit(1)
            ]
          );
    
          if (response.documents.length > 0) {
            const latest = response.documents[0];
            
            // Parse performance data (handles both escaped and normal JSON)
            if (latest.performanceData && latest.performanceData.length > 0) {
              try {
                const perfData = parseAppwriteJson(latest.performanceData[0]);
                if (perfData) setPerformanceData(perfData);
              } catch (e) {
                console.error('Error parsing performance data:', e);
              }
            }
            
            // Parse recommendations (handles multiple formats)
            if (latest.recommendations && latest.recommendations.length > 0) {
              try {
                let recs = [];
                
                // Case 1: Single string containing array of objects
                if (typeof latest.recommendations[0] === 'string') {
                  const parsed = parseAppwriteJson(latest.recommendations[0]);
                  recs = Array.isArray(parsed) ? parsed : [parsed];
                } 
                // Case 2: Multiple strings in array (one JSON per string)
                else {
                  recs = latest.recommendations.map(item => 
                    typeof item === 'string' ? parseAppwriteJson(item) : item
                  ).filter(Boolean);
                }
                
                // Handle newline-separated JSON objects
                if (recs.length === 1 && typeof recs[0] === 'string' && recs[0].includes('\n')) {
                  recs = recs[0]
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line)
                    .map(line => parseAppwriteJson(line))
                    .filter(Boolean);
                }
  
                // Fetch full track details
                const detailedRecs = await Promise.all(
                  recs.map(async rec => {
                    try {
                      if (!rec?.id) return rec;
                      const track = await databases.getDocument(
                        config.databaseId,
                        config.karaokeTrackCollectionId,
                        rec.id
                      );
                      return {
                        ...track,
                        similarity: rec.similarity || 0
                      };
                    } catch (error) {
                      console.error('Error fetching track details:', error);
                      return {
                        ...rec,
                        $id: rec.id,
                        songName: rec.songName || 'Unknown',
                        artist: rec.artist || 'Unknown',
                        genre: rec.genre || 'Unknown',
                        similarity: rec.similarity || 0
                      };
                    }
                  })
                );
                
                setRecommendations(detailedRecs.filter(Boolean));
              } catch (e) {
                console.error('Error parsing recommendations:', e);
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch recommendations:', error);
        } finally {
          setLoading(false);
        }
      };
    
      fetchRecommendations();
    }, [user]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-primary justify-center items-center">
        <ActivityIndicator size="large" color="#ffffff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <ScrollView className="px-4 py-6" showsVerticalScrollIndicator={false}>
        {/* Vocal Profile Header */}
        <View className="mb-6">
          <Text className="text-2xl font-psemibold text-white">Your Vocal Profile</Text>
          <Text className="text-gray-300 mt-1">
            Based on your recent recordings
          </Text>
        </View>

        {/* Performance Analysis Section */}
        {performanceData && (
          <View className="mb-8 bg-primary-800 p-4 rounded-lg">
            <Text className="text-xl font-psemibold text-secondary-200 mb-3">
              Performance Analysis
            </Text>
            
            {/* Overall Accuracy */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-white font-pmedium">Overall Accuracy</Text>
                <Text className="text-white font-pbold">
                  {Math.round(performanceData.overallAccuracy * 100)}%
                </Text>
              </View>
              <View className="w-full bg-gray-700 rounded-full h-3">
                <View 
                  className="bg-secondary-200 h-3 rounded-full" 
                  style={{ 
                    width: `${Math.min(100, Math.round(performanceData.overallAccuracy * 100))}%` 
                  }}
                />
              </View>
            </View>

            {/* Strong and Weak Notes */}
            <View className="flex-row justify-between">
              {/* Strong Notes Column */}
              <View className="w-[48%]">
                <Text className="text-white font-pmedium mb-2">Strong Notes</Text>
                {Object.entries(performanceData.strongNotes || {}).map(([note, score]) => (
                  <View key={`strong-${note}`} className="mb-2">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-green-400 font-pmedium">{note}</Text>
                      <Text className="text-white font-pmedium">
                        {Math.round(score * 100)}%
                      </Text>
                    </View>
                    <View className="w-full bg-gray-700 rounded-full h-2">
                      <View 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(100, Math.round(score * 100))}%` }}
                      />
                    </View>
                  </View>
                ))}
              </View>

              {/* Weak Notes Column */}
              <View className="w-[48%]">
                <Text className="text-white font-pmedium mb-2">Notes to Improve</Text>
                {Object.entries(performanceData.weakNotes || {}).map(([note, score]) => (
                  <View key={`weak-${note}`} className="mb-2">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-red-400 font-pmedium">{note}</Text>
                      <Text className="text-white font-pmedium">
                        {Math.round(score * 100)}%
                      </Text>
                    </View>
                    <View className="w-full bg-gray-700 rounded-full h-2">
                      <View 
                        className="bg-red-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(100, Math.round(score * 100))}%` }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Recommendations Section */}
        <View className="mb-4">
          <Text className="text-2xl font-psemibold text-white mb-3">
            Top Recommendations
          </Text>
          
          {recommendations.length > 0 ? (
            <FlatList
              data={recommendations}
              scrollEnabled={false}
              keyExtractor={(item) => item.$id}
              renderItem={({ item, index }) => (
                <View className={index === 0 ? "mt-0" : "mt-3"}>
                  <ProfileTrackCard 
                    track={item}
                    similarity={item.similarity}
                    showSimilarity
                  />
                </View>
              )}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          ) : (
            <View className="flex-1 justify-center items-center py-10">
              <Text className="text-white text-center">No recommendations yet</Text>
              <Text className="text-gray-300 mt-2 text-center">
                Record all 3 songs to get personalized recommendations
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;