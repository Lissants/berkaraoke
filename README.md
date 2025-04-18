# Berkaraoke
## In order to get this project working in your environment/machine:
1. Create an Appwrite project
2. Inside the Appwrite project, create a Storage bucket, 3 collections, namely: karaokeTrack, userKaraokeTrack and users
3. Set the attributes of users collection as such:
   - username Required String
   - email Required email
   - avatar Url
   - accountId Required String
5. Set the attributes of karaokeTrack collection as such:
   - songName Required String
   - artist Required String
   - audio Required Url
   - genre Required String
   - notesBinary String[]
   - noteOccurences String[]
6. Set the attribute of userKaraokeTrack as such:
   - users Relationship with users
   - processingStatus Required Enum elements: "pending", "processing", "completed", "failed"
   - recommendations String[]
   - performanceData String[]
   - crepeAnalysis String
   - processedAt Datetime
   - recordingDate Datetime
   - accuracyScore Integer
   - genreFilter String
   - artistFilter String
   - fileIds String[]
   - fileId String
   - isMasterDocument Boolean
   - childDocuments String[]
7. Create an API key in Appwrite with scopes: Auth, Database, Storage, Other checked
8. Copy the current Project ID, Database ID, Storage ID, karaokeTrack collectionID, userKaraokeTrack collection ID, users collection ID and the API key that has been created
9. Create a file named endpoints.env in /local-runner/ and paste this template
```
   APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
    APPWRITE_PROJECT_ID=your Appwrite Project ID
    APPWRITE_API_KEY=your Appwrite API Key
    APPWRITE_DB_ID=your Appwrite Database ID
    APPWRITE_STORAGE_ID=your Appwrite Storage ID
    APPWRITE_KARAOKE_COLLECTION_ID=your Appwrite karaokeTrack collection ID
    APPWRITE_USER_TRACKS_COLLECTION_ID=your Appwrite userKaraokeTrack collection ID
```
11. Start the Expo server with this command:
```
npx expo start
```

13. Start the Flask server with this command:
```
cd local-runner
python run local-server.py
```

### This project was made to comply with the requirement of graduation from both Information Systems program from Sampoerna University and Applied Computing program from The University of Arizona

### This project is the application of the Senior Capstone paper "Enhancing Online Karaoke Experiences through Modified
Performance-Based Recommendations"

## Developed by: Christopher Gerard Lissants<br/>
2021400012 (Sampoerna University)<br/>
23792093 (The University of Arizona)

### This mobile application focuses on providing song recommendation system for karaoke singers based on their singing performance and song preferences.
