const fs = require('fs');
const path = require('path');

const isFirebaseEnabled = process.env.FIREBASE_ENABLED === 'true';

let admin = null;
let db = null;

if (isFirebaseEnabled) {
  admin = require('firebase-admin');
  
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
  } else if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  } else if (fs.existsSync(path.join(__dirname, 'serviceAccountKey.json'))) {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    admin.initializeApp();
  }
  db = admin.firestore();
}

const getFilePath = (filename) => path.join(__dirname, 'data', filename);

async function loadData(collectionName, filename, fieldName, defaultValue) {
  if (isFirebaseEnabled) {
    try {
      const doc = await db.collection('data').doc(collectionName).get();
      if (doc.exists && doc.data()[fieldName]) {
        const val = doc.data()[fieldName];
        if (Array.isArray(val) && val.length > 0) {
          return val;
        } else if (!Array.isArray(val) && val) {
          return val;
        }
      }
      
      // If Firestore is empty/missing, seed from local JSON file
      let seedData = defaultValue;
      try {
        const localRaw = fs.readFileSync(getFilePath(filename), 'utf8');
        seedData = JSON.parse(localRaw);
        if (seedData) {
          await db.collection('data').doc(collectionName).set({ [fieldName]: seedData }, { merge: true });
          console.log(`Seeded ${collectionName} into Firestore from local ${filename}.`);
        }
      } catch (fileErr) {
        console.log(`No local ${filename} to seed from.`);
      }
      return seedData;
    } catch (err) {
      console.error(`Error loading ${collectionName} from Firestore:`, err);
      return defaultValue;
    }
  } else {
    try {
      const data = fs.readFileSync(getFilePath(filename), 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.log(`No ${filename} found or error parsing. Returning default.`);
      return defaultValue;
    }
  }
}

async function saveData(collectionName, filename, fieldName, data) {
  if (isFirebaseEnabled) {
    try {
      await db.collection('data').doc(collectionName).set({ [fieldName]: data }, { merge: true });
    } catch (err) {
      console.error(`Error saving ${collectionName} to Firestore:`, err);
    }
  } else {
    try {
      const dir = path.join(__dirname, 'data');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(getFilePath(filename), JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`Error saving ${filename} locally:`, err);
    }
  }
}

async function loadTeams() {
  return await loadData('teams', 'teams.json', 'teams', []);
}

async function saveTeams(teams) {
  await saveData('teams', 'teams.json', 'teams', teams);
}

async function loadListone() {
  return await loadData('listone', 'listone.json', 'players', []);
}

async function saveListone(players) {
  await saveData('listone', 'listone.json', 'players', players);
}

async function loadTransactions() {
  return await loadData('transactions', 'transactions.json', 'transactions', []);
}

async function saveTransactions(transactions) {
  await saveData('transactions', 'transactions.json', 'transactions', transactions);
}

async function loadAuction() {
  const defaultState = {
    status: 'IDLE',
    currentPlayer: null,
    currentBid: 0,
    currentBidder: null,
    timerSeconds: 0
  };
  if (isFirebaseEnabled) {
    try {
      const doc = await db.collection('data').doc('auction').get();
      if (doc.exists) {
        return { ...defaultState, ...doc.data() };
      }
      return defaultState;
    } catch (err) {
      console.error('Error loading auction from Firestore:', err);
      return defaultState;
    }
  } else {
    try {
      const data = fs.readFileSync(getFilePath('auction.json'), 'utf8');
      return { ...defaultState, ...JSON.parse(data) };
    } catch (err) {
      return defaultState;
    }
  }
}

async function saveAuction(state) {
  if (isFirebaseEnabled) {
    try {
      await db.collection('data').doc('auction').set(state);
    } catch (err) {
      console.error('Error saving auction to Firestore:', err);
    }
  } else {
    try {
      const dir = path.join(__dirname, 'data');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(getFilePath('auction.json'), JSON.stringify(state, null, 2));
    } catch (err) {
      console.error('Error saving auction.json locally:', err);
    }
  }
}

async function loadConfig() {
  const defaultConfig = { masterCode: "211287", pins: {} };
  if (isFirebaseEnabled) {
    try {
      const doc = await db.collection('data').doc('config').get();
      if (doc.exists && doc.data() && Object.keys(doc.data().pins || {}).length > 0) {
        return { ...defaultConfig, ...doc.data() };
      }
      try {
        const localRaw = fs.readFileSync(getFilePath('config.json'), 'utf8');
        const localConfig = JSON.parse(localRaw);
        if (localConfig) {
          const merged = { ...defaultConfig, ...localConfig };
          await db.collection('data').doc('config').set(merged);
          return merged;
        }
      } catch (err) {}
      return defaultConfig;
    } catch (err) {
      console.error('Error loading config from Firestore:', err);
      return defaultConfig;
    }
  } else {
    try {
      const data = fs.readFileSync(getFilePath('config.json'), 'utf8');
      return { ...defaultConfig, ...JSON.parse(data) };
    } catch (err) {
      return defaultConfig;
    }
  }
}

async function saveConfig(config) {
  if (isFirebaseEnabled) {
    try {
      await db.collection('data').doc('config').set(config);
    } catch (err) {
      console.error('Error saving config to Firestore:', err);
    }
  } else {
    try {
      const dir = path.join(__dirname, 'data');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(getFilePath('config.json'), JSON.stringify(config, null, 2));
    } catch (err) {
      console.error('Error saving config.json locally:', err);
    }
  }
}

module.exports = {
  loadTeams, saveTeams,
  loadListone, saveListone,
  loadTransactions, saveTransactions,
  loadAuction, saveAuction,
  loadConfig, saveConfig,
  isFirebaseEnabled
};
