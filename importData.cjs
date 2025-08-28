// importData.js
const admin = require('firebase-admin');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

// Path to your service account key JSON file
const serviceAccount = require('./serviceAccountKey.json');

// Path to your CSV file (make sure it's in the root folder)
const CSV_FILE_PATH = './students.csv';

// Name of the collection you want to import into
const COLLECTION_NAME = 'students';

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function importCsvToFirestore() {
  // Read the CSV file
  const fileContent = fs.readFileSync(CSV_FILE_PATH);

  // Parse the CSV content
  const records = parse(fileContent, {
    columns: true, // Treat the first row as headers
    skip_empty_lines: true
  });

  console.log(`Found ${records.length} records. Starting import...`);

  for (const record of records) {
    // Ensure 'grade' is a number
    const gradeAsNumber = parseInt(record.grade, 10);

    const dataToUpload = {
      fullName: record.fullName || '',
      grade: isNaN(gradeAsNumber) ? 0 : gradeAsNumber,
      qrId: record.qrId || '',
      studentId: record.studentId || ''
    };

    try {
      // Use studentId as the document ID to prevent duplicates
      await db.collection(COLLECTION_NAME).doc(dataToUpload.studentId).set(dataToUpload);
      console.log(`Successfully added: ${dataToUpload.fullName}`);
    } catch (error) {
      console.error(`Error adding ${dataToUpload.fullName}:`, error);
    }
  }

  console.log('Import complete!');
}

importCsvToFirestore().catch(console.error);