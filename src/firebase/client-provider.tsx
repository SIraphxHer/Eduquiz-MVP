
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Database } from 'firebase/database';
import { FirebaseStorage } from 'firebase/storage';
import { Auth } from 'firebase/auth';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [instances, setInstances] = useState<{
    firebaseApp: FirebaseApp;
    firestore: Firestore;
    database: Database;
    storage: FirebaseStorage;
    auth: Auth;
  } | null>(null);

  useEffect(() => {
    const { firebaseApp, firestore, database, storage, auth } = initializeFirebase();
    setInstances({ firebaseApp, firestore, database, storage, auth });
  }, []);

  if (!instances) return null;

  return (
    <FirebaseProvider
      firebaseApp={instances.firebaseApp}
      firestore={instances.firestore}
      database={instances.database}
      storage={instances.storage}
      auth={instances.auth}
    >
      {children}
    </FirebaseProvider>
  );
}
