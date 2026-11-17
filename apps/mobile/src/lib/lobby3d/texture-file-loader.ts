// 3D 모델(GLB) 안에 든 그림을 읽는 방법을 바꾼다. r3f 네이티브는 불러올 때 THREE.TextureLoader를 자기 것으로 바꿔 두는데,
// GLB 안 그림(data:·blob: 주소)을 캐시 폴더에 매번 무작위 이름(uuid)으로 써서, 같은 그림도 읽을 때마다 새 파일이 쌓인다.
// 여기서는 그림 내용으로 정해지는 이름(SHA-256)을 써서 같은 그림은 한 파일만 두고, 이미 있으면 다시 쓰지 않는다.
// 그 밖의 주소(번들 그림, file:, 외부 주소)는 r3f의 방법을 그대로 쓴다. r3f가 먼저 바꿔 둔 뒤에 덮어써야 하므로 그 모듈을 먼저 불러온다.
import "@react-three/fiber/native";
import * as Crypto from "expo-crypto";
import * as LegacyFS from "expo-file-system/legacy";
import { Image, NativeModules, Platform } from "react-native";
import * as THREE from "three";

type Load = THREE.TextureLoader["load"];

/** r3f가 예전에 GLB 안 그림을 쓰던 이름(캐시 폴더 맨 위의 uuid v4 + 그림 확장자). */
const OLD_IMAGE_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpe?g|webp)$/i;
/** 내용 이름으로 쓴 그림 파일의 앞머리. */
const IMAGE_FILE_PREFIX = "model-image-";

function blobScheme(): string | undefined {
  return (NativeModules.BlobModule as { BLOB_URI_SCHEME?: string } | undefined)?.BLOB_URI_SCHEME;
}

/** GLB 안 그림 주소(data:, blob:)인지. */
function isEmbedded(url: unknown): url is string {
  if (typeof url !== "string") return false;
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  const scheme = blobScheme();
  return !!scheme && url.startsWith(scheme);
}

/** blob: 주소를 data: 주소로 푼다(r3f와 같은 방법). */
async function blobToDataUri(url: string): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "blob";
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = reject;
    xhr.send();
  });
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
  return `data:${blob.type};base64,${data}`;
}

// 같은 그림을 동시에 읽으면 쓰기 하나를 함께 기다린다(쓰는 중인 파일을 다른 읽기가 덮어쓰지 않게)
const writing = new Map<string, Promise<string>>();

/** GLB 안 그림을 캐시 폴더의 파일로 두고 그 주소를 준다. 같은 내용이면 같은 파일이고, 이미 있으면 다시 쓰지 않는다. */
export async function embeddedImageFile(url: string): Promise<string> {
  const dataUri = url.startsWith("data:") ? url : await blobToDataUri(url);
  const [header, data = ""] = dataUri.split(";base64,");
  const type = header.split("/")[1] || "png";
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
  const uri = `${LegacyFS.cacheDirectory}${IMAGE_FILE_PREFIX}${hash}.${type}`;
  const pending = writing.get(uri);
  if (pending) return pending;
  const job = (async () => {
    const info = await LegacyFS.getInfoAsync(uri);
    if (!info.exists) await LegacyFS.writeAsStringAsync(uri, data, { encoding: LegacyFS.EncodingType.Base64 });
    return uri;
  })();
  writing.set(uri, job);
  try {
    return await job;
  } finally {
    writing.delete(uri);
  }
}

/**
 * 예전 방식으로 쌓인 그림 파일(캐시 폴더 맨 위의 uuid 이름 png·jpeg·jpg·webp)을 지운다. 지운 수를 준다.
 * 그 밖의 파일·폴더는 건드리지 않고, 읽거나 지우다 실패해도 던지지 않는다.
 */
export async function removeOldEmbeddedImageFiles(): Promise<number> {
  const dir = LegacyFS.cacheDirectory;
  if (!dir) return 0;
  let names: string[];
  try {
    names = await LegacyFS.readDirectoryAsync(dir);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of names) {
    if (!OLD_IMAGE_FILE.test(name)) continue;
    try {
      await LegacyFS.deleteAsync(dir + name, { idempotent: true });
      removed += 1;
    } catch {
      // 지우지 못한 파일은 다음에 다시 지운다
    }
  }
  return removed;
}

if (Platform.OS !== "web") {
  const fallback = THREE.TextureLoader.prototype.load;
  THREE.TextureLoader.prototype.load = function load(this: THREE.TextureLoader, input, onLoad, onProgress, onError) {
    if (!isEmbedded(input)) return fallback.call(this, input, onLoad, onProgress, onError);
    const texture = new THREE.Texture() as THREE.Texture<unknown>;
    embeddedImageFile(input)
      .then(async (uri) => {
        const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) =>
          Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject)
        );
        // r3f와 같은 모양(EXGL이 파일 주소에서 그림을 올린다)
        texture.image = { data: { localUri: uri }, width, height };
        texture.flipY = true;
        texture.needsUpdate = true;
        (texture as THREE.Texture & { isDataTexture: boolean }).isDataTexture = true;
        onLoad?.(texture as THREE.Texture<HTMLImageElement>);
      })
      .catch((error: unknown) => onError?.(error));
    return texture as THREE.Texture<HTMLImageElement>;
  } as Load;
}
