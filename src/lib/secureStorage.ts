import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as aesjs from 'aes-js';

// Supabase's session (including the long-lived refresh token) needs a place
// to live on-device. Plain AsyncStorage is unencrypted (readable off a
// rooted/jailbroken device or an unencrypted backup), and expo-secure-store
// alone can't hold it -- iOS Keychain caps each entry around 2KB and a
// session blob can exceed that. So: a random AES-256 key lives in
// SecureStore (small, and OS-Keychain/Keystore-encrypted), and the actual
// session JSON is AES-encrypted before landing in AsyncStorage (unbounded
// size, but now unreadable without the key).
export class LargeSecureStore {
  private async getEncryptionKey(key: string): Promise<Uint8Array | null> {
    const stored = await SecureStore.getItemAsync(this.keyName(key));
    if (!stored) return null;
    return aesjs.utils.hex.toBytes(stored);
  }

  private keyName(key: string) {
    return `${key}-enc-key`;
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    const encryptionKey = await this.getEncryptionKey(key);
    if (!encryptionKey) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(encrypted));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = await Crypto.getRandomBytesAsync(32);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(this.keyName(key), aesjs.utils.hex.fromBytes(encryptionKey));
    await AsyncStorage.setItem(key, aesjs.utils.hex.fromBytes(encryptedBytes));
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(this.keyName(key));
  }
}
