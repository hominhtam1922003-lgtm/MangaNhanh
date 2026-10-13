import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
const hash = (key: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key);
export const secureStorage = {
  async getItem(key: string) {
    const id = await hash(key);
    const count = Number((await SecureStore.getItemAsync(id + "_count")) || 0);
    if (count < 1 || count > 80) return null;
    const pieces = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(id + "_" + i),
      ),
    );
    return pieces.some((p) => p === null) ? null : pieces.join("");
  },
  async setItem(key: string, value: string) {
    const id = await hash(key);
    const count = Number((await SecureStore.getItemAsync(id + "_count")) || 0);
    const chunks = value.match(/[\s\S]{1,1800}/g) || [""];
    for (let i = 0; i < chunks.length; i++)
      await SecureStore.setItemAsync(id + "_" + i, chunks[i]);
    await SecureStore.setItemAsync(id + "_count", String(chunks.length));
    for (let i = chunks.length; i < count; i++)
      await SecureStore.deleteItemAsync(id + "_" + i);
  },
  async removeItem(key: string) {
    const id = await hash(key);
    const count = Number((await SecureStore.getItemAsync(id + "_count")) || 0);
    await SecureStore.deleteItemAsync(id + "_count");
    for (let i = 0; i < count; i++)
      await SecureStore.deleteItemAsync(id + "_" + i);
  },
};
